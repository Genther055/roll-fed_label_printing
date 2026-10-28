import os
import re
import datetime
import urllib.parse
import pymupdf

PT_TO_MM = 25.4 / 72.0
MM_TO_PT = 72.0 / 25.4

def get_cyrillic_font():
    """
    Finds a font supporting Ukrainian Cyrillic characters.
    Checks bundled open-source fonts first (for cross-platform & Vercel Linux support),
    then falls back to Windows system fonts.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    bundled_reg = os.path.join(base_dir, "fonts", "DejaVuSans.ttf")
    bundled_bold = os.path.join(base_dir, "fonts", "DejaVuSans-Bold.ttf")
    if os.path.exists(bundled_reg) and os.path.exists(bundled_bold):
        return bundled_reg, bundled_bold

    reg_font = None
    bold_font = None
    if os.path.exists(r"C:\Windows\Fonts\arial.ttf"):
        reg_font = r"C:\Windows\Fonts\arial.ttf"
    if os.path.exists(r"C:\Windows\Fonts\arialbd.ttf"):
        bold_font = r"C:\Windows\Fonts\arialbd.ttf"
    elif reg_font:
        bold_font = reg_font
    return reg_font, bold_font

def get_source_cut_clip(src_page):
    """
    Finds the cut contour rect or TrimBox in the source PDF page to clip to.
    If no contour or TrimBox is found, returns the page rect.
    """
    drawings = src_page.get_drawings()
    for d in drawings:
        color = d.get("color")
        if color and len(color) >= 3:
            r, g, b = color[0], color[1], color[2]
            if r > 0.7 and g < 0.3:
                r_rect = d["rect"]
                cand_w = r_rect.width * PT_TO_MM
                cand_h = r_rect.height * PT_TO_MM
                if cand_w > 5 and cand_h > 5:
                    return r_rect
    trimbox = getattr(src_page, 'trimbox', None)
    if trimbox and round(trimbox.width, 1) != round(src_page.rect.width, 1):
        return trimbox
    return src_page.rect

def generate_imposition_pdf(
    source_file_path,
    layout_result,
    output_pdf_path,
    original_filename=None,
    add_eye_marks=True,
    add_cut_lines=True,
    add_info_banner=True,
    include_cmyk_scale=True,
    add_print_direction=True,
    sheet_number=5,
    circulation=10000,
    waste="5"
):
    """
    Generates a print-ready 2-page vector PDF:
    - Page 1: Imposition on roll 1000 mm x 330 mm (clean for press/RIP).
    - Page 2: Compact Technical Passport (A5 landscape: 210 mm x 148 mm) for easy viewing, reading & archiving.
    """
    has_source = bool(source_file_path and os.path.exists(source_file_path))
    is_pdf = False
    if has_source:
        ext = os.path.splitext(source_file_path)[1].lower()
        is_pdf = (ext == ".pdf")

    params = layout_result["params"]
    active = layout_result["active"]
    positions = layout_result["positions"]

    roll_w_mm = float(params["roll_width"])          # 330 mm
    meter_l_mm = float(params["meter_length"])       # 1000 mm
    printable_w_mm = float(params["printable_width"])# 305 mm
    bleed_mm = float(params.get("bleed", 0.0))
    label_w_mm = float(params["label_width"])
    label_h_mm = float(params["label_height"])

    if not original_filename:
        if has_source:
            raw_name = os.path.basename(source_file_path)
            original_filename = re.sub(r'^[a-f0-9]{8}_', '', raw_name)
        else:
            original_filename = f"спуск_висічки_{int(label_w_mm)}x{int(label_h_mm)}мм"

    font_reg, font_bold = get_cyrillic_font()

    doc = pymupdf.open()
    src_doc = pymupdf.open(source_file_path) if (has_source and is_pdf) else None
    src_clip = get_source_cut_clip(src_doc[0]) if (src_doc and is_pdf) else None

    # =========================================================================
    # PAGE 1: IMPOSITION ON 1000 mm x 330 mm ROLL
    # =========================================================================
    p1_w_pt = meter_l_mm * MM_TO_PT
    p1_h_pt = roll_w_mm * MM_TO_PT
    page1 = doc.new_page(width=p1_w_pt, height=p1_h_pt)

    if font_reg:
        page1.insert_font(fontname="ArialCustom", fontfile=font_reg)
    if font_bold:
        page1.insert_font(fontname="ArialBoldCustom", fontfile=font_bold)

    fname_reg = "ArialCustom" if font_reg else "helv"
    fname_bold = "ArialBoldCustom" if font_bold else "helv"

    # 1. Printable Area guidelines (305 mm centered across 330 mm -> 12.5 mm margins)
    p_margin_mm = (roll_w_mm - printable_w_mm) / 2.0
    p_top_pt = p_margin_mm * MM_TO_PT
    p_bottom_pt = (roll_w_mm - p_margin_mm) * MM_TO_PT

    page1.draw_line(
        pymupdf.Point(0, p_top_pt),
        pymupdf.Point(p1_w_pt, p_top_pt),
        color=(0.1, 0.6, 0.9),
        width=0.4,
        dashes="[4 3] 0"
    )
    page1.draw_line(
        pymupdf.Point(0, p_bottom_pt),
        pymupdf.Point(p1_w_pt, p_bottom_pt),
        color=(0.1, 0.6, 0.9),
        width=0.4,
        dashes="[4 3] 0"
    )

    # 2. CMYK & Spot Color Control Strip along Top Margin (Y = 2.6..6.4 mm)
    if include_cmyk_scale:
        cmyk_patches = [
            (0.85, 0.22, 0.12), # Red / Spot
            (0.09, 0.09, 0.10), # Black
            (0.0, 0.62, 0.89),  # Cyan
            (0.90, 0.0, 0.50),  # Magenta
            (1.0, 0.92, 0.0),   # Yellow
        ]
        patch_l_pt = 14.0 * MM_TO_PT
        patch_w_pt = 3.8 * MM_TO_PT
        strip_y_pt = 2.6 * MM_TO_PT

        for cycle_x in range(10, int(meter_l_mm) - 50, 92):
            cur_x = cycle_x * MM_TO_PT
            # Red patch
            page1.draw_rect(
                pymupdf.Rect(cur_x, strip_y_pt, cur_x + patch_l_pt, strip_y_pt + patch_w_pt),
                color=cmyk_patches[0],
                fill=cmyk_patches[0]
            )
            cur_x += patch_l_pt + 1.2 * MM_TO_PT

            # Alignment dash
            dash_y = strip_y_pt + patch_w_pt / 2.0
            page1.draw_rect(
                pymupdf.Rect(cur_x, dash_y - 0.4 * MM_TO_PT, cur_x + 3.0 * MM_TO_PT, dash_y + 0.4 * MM_TO_PT),
                color=(0, 0, 0),
                fill=(0, 0, 0)
            )
            cur_x += 4.5 * MM_TO_PT

            # Black, Cyan, Magenta, Yellow patches
            for col in cmyk_patches[1:]:
                page1.draw_rect(
                    pymupdf.Rect(cur_x, strip_y_pt, cur_x + patch_l_pt, strip_y_pt + patch_w_pt),
                    color=col,
                    fill=col
                )
                cur_x += patch_l_pt + 1.2 * MM_TO_PT

            # Micro marks
            mark_x = cur_x + 1.0 * MM_TO_PT
            page1.draw_rect(
                pymupdf.Rect(mark_x, strip_y_pt, mark_x + 4.2 * MM_TO_PT, strip_y_pt + 0.7 * MM_TO_PT),
                color=(0, 0, 0),
                fill=(0, 0, 0)
            )
            page1.draw_rect(
                pymupdf.Rect(mark_x, strip_y_pt + patch_w_pt - 0.7 * MM_TO_PT, mark_x + 4.2 * MM_TO_PT, strip_y_pt + patch_w_pt),
                color=(0, 0, 0),
                fill=(0, 0, 0)
            )

    # 3. Eye Marks along Top Margin (Y ≈ 7.0 mm)
    if add_eye_marks and active.get("repeats", 0) > 0:
        step_x_mm = active["step_x"]
        start_x_mm = positions[0]["x"] if positions else 2.0
        eye_y_pt = 7.0 * MM_TO_PT
        for r in range(active["repeats"]):
            eye_x_pt = (start_x_mm + r * step_x_mm) * MM_TO_PT
            page1.draw_rect(
                pymupdf.Rect(eye_x_pt, eye_y_pt, eye_x_pt + 4.0 * MM_TO_PT, eye_y_pt + 2.0 * MM_TO_PT),
                color=(0, 0, 0),
                fill=(0, 0, 0)
            )

    # 4. Place Labels with exact gaps (пропуски) between them
    for pos in positions:
        cut_x_mm = pos["x"]
        cut_y_mm = pos["y"]
        cut_w_mm = pos["width"]
        cut_h_mm = pos["height"]

        target_rect = pymupdf.Rect(
            cut_x_mm * MM_TO_PT,
            cut_y_mm * MM_TO_PT,
            (cut_x_mm + cut_w_mm) * MM_TO_PT,
            (cut_y_mm + cut_h_mm) * MM_TO_PT
        )

        if has_source:
            rot_on_page = (pos["rotation"] + 270) % 360
            if is_pdf and src_doc:
                page1.show_pdf_page(target_rect, src_doc, 0, clip=src_clip, rotate=rot_on_page)
            else:
                page1.insert_image(target_rect, filename=source_file_path, rotate=rot_on_page)
        else:
            # Clean technical die-cut blank
            page1.draw_rect(target_rect, color=(0.9, 0.93, 0.98), fill=(1.0, 1.0, 1.0), width=0.3)
            if cut_w_mm >= 10 and cut_h_mm >= 8:
                center_pt = pymupdf.Point(
                    (cut_x_mm + cut_w_mm / 2.0 - 5.5) * MM_TO_PT,
                    (cut_y_mm + cut_h_mm / 2.0 + 1.6) * MM_TO_PT
                )
                page1.insert_text(center_pt, f"{label_w_mm:g}×{label_h_mm:g}", fontname=fname_reg, fontsize=4.2, color=(0.45, 0.5, 0.6))

        if add_cut_lines:
            page1.draw_rect(target_rect, color=(1.0, 0.0, 1.0), width=0.4)

    # 5. Print Direction Arrow along Bottom Margin
    if add_print_direction:
        arrow_y_pt = (roll_w_mm - 5.5) * MM_TO_PT
        arrow_end_x_pt = (meter_l_mm - 20.0) * MM_TO_PT
        arrow_start_x_pt = 20.0 * MM_TO_PT

        page1.draw_line(
            pymupdf.Point(arrow_start_x_pt, arrow_y_pt),
            pymupdf.Point(arrow_end_x_pt, arrow_y_pt),
            color=(0.85, 0.15, 0.15),
            width=1.0
        )
        head_l_pt = 7.0 * MM_TO_PT
        head_w_pt = 3.0 * MM_TO_PT
        page1.draw_line(
            pymupdf.Point(arrow_end_x_pt - head_l_pt, arrow_y_pt - head_w_pt),
            pymupdf.Point(arrow_end_x_pt, arrow_y_pt),
            color=(0.85, 0.15, 0.15),
            width=1.2
        )
        page1.draw_line(
            pymupdf.Point(arrow_end_x_pt - head_l_pt, arrow_y_pt + head_w_pt),
            pymupdf.Point(arrow_end_x_pt, arrow_y_pt),
            color=(0.85, 0.15, 0.15),
            width=1.2
        )

        # Chevrons
        for chx in (180, 360, 540, 720, 900):
            ch_x_pt = chx * MM_TO_PT
            page1.draw_line(
                pymupdf.Point(ch_x_pt - 3 * MM_TO_PT, arrow_y_pt - 2.0 * MM_TO_PT),
                pymupdf.Point(ch_x_pt, arrow_y_pt),
                color=(0.85, 0.15, 0.15),
                width=0.8
            )
            page1.draw_line(
                pymupdf.Point(ch_x_pt - 3 * MM_TO_PT, arrow_y_pt + 2.0 * MM_TO_PT),
                pymupdf.Point(ch_x_pt, arrow_y_pt),
                color=(0.85, 0.15, 0.15),
                width=0.8
            )

    # 6. Millimeter Scale Ticks along bottom edge
    ruler_y_pt = (roll_w_mm - 1.0) * MM_TO_PT
    for mm in range(0, int(meter_l_mm) + 1, 10):
        t_len_pt = (4.0 if mm % 100 == 0 else (2.5 if mm % 50 == 0 else 1.5)) * MM_TO_PT
        page1.draw_line(
            pymupdf.Point(mm * MM_TO_PT, ruler_y_pt),
            pymupdf.Point(mm * MM_TO_PT, ruler_y_pt - t_len_pt),
            color=(0.4, 0.5, 0.6),
            width=0.4
        )
        if mm % 100 == 0 and mm > 0 and mm < meter_l_mm:
            page1.insert_text(
                pymupdf.Point(mm * MM_TO_PT - 6.0 * MM_TO_PT, ruler_y_pt - 5.5 * MM_TO_PT),
                f"{mm} мм",
                fontname=fname_reg,
                fontsize=4.2,
                color=(0.3, 0.4, 0.5)
            )

    # 7. Clean compact slug in margin referring to Page 2
    slug_y_pt = (roll_w_mm - 8.5) * MM_TO_PT
    page1.insert_text(
        pymupdf.Point(20.0 * MM_TO_PT, slug_y_pt),
        f"ROLL-PRINT CAD  |  Файл: {original_filename}  |  Полотно 330 мм (друк: {active['layout_width']} мм)  |  Вихід: {active['total_per_meter']} шт/м  |  Техпаспорт див. на Стор. 2",
        fontname=fname_reg,
        fontsize=5.2,
        color=(0.3, 0.35, 0.45)
    )

    # =========================================================================
    # PAGE 2: COMPACT TECHNICAL PASSPORT (A5 Landscape: 210 mm x 148 mm)
    # =========================================================================
    if add_info_banner:
        p2_w_pt = 210.0 * MM_TO_PT
        p2_h_pt = 148.0 * MM_TO_PT
        page2 = doc.new_page(width=p2_w_pt, height=p2_h_pt)

        if font_reg:
            page2.insert_font(fontname="ArialCustom", fontfile=font_reg)
        if font_bold:
            page2.insert_font(fontname="ArialBoldCustom", fontfile=font_bold)

        now_str = datetime.datetime.now().strftime("%d.%m.%Y")
        app_type_val = params.get("application_type", "manual")
        app_type_str = "РУЧНЕ" if app_type_val == "manual" else f"АВТОМАТИЧНЕ (Схема №{params.get('winding_scheme', 1)})"

        # Document Header
        page2.insert_text(
            pymupdf.Point(15 * MM_TO_PT, 16 * MM_TO_PT),
            "ТЕХНІЧНИЙ ПАСПОРТ РОЗКЛАДКИ",
            fontname=fname_bold,
            fontsize=13,
            color=(0.08, 0.12, 0.2)
        )
        page2.insert_text(
            pymupdf.Point(15 * MM_TO_PT, 22 * MM_TO_PT),
            "Спуск на рулонне полотно 330 мм (довжина 1000 мм)",
            fontname=fname_reg,
            fontsize=8.5,
            color=(0.4, 0.45, 0.55)
        )
        page2.insert_text(
            pymupdf.Point(155 * MM_TO_PT, 16 * MM_TO_PT),
            f"Дата: {now_str}",
            fontname=fname_reg,
            fontsize=9,
            color=(0.4, 0.45, 0.55)
        )

        # Thin divider
        page2.draw_line(
            pymupdf.Point(15 * MM_TO_PT, 25 * MM_TO_PT),
            pymupdf.Point(195 * MM_TO_PT, 25 * MM_TO_PT),
            color=(0.8, 0.85, 0.9),
            width=0.8
        )

        # Left Column: Die-Cut parameters (X = 15 mm)
        page2.insert_text(pymupdf.Point(15 * MM_TO_PT, 33 * MM_TO_PT), "ПАРАМЕТРИ ВИСІЧКИ", fontname=fname_bold, fontsize=9.5, color=(0.1, 0.4, 0.8))
        page2.insert_text(pymupdf.Point(15 * MM_TO_PT, 40 * MM_TO_PT), f"Файл: {original_filename}", fontname=fname_reg, fontsize=8.5, color=(0.15, 0.15, 0.15))
        page2.insert_text(pymupdf.Point(15 * MM_TO_PT, 46 * MM_TO_PT), f"Розмір висічки: {label_w_mm} × {label_h_mm} мм", fontname=fname_bold, fontsize=8.5, color=(0.15, 0.15, 0.15))
        page2.insert_text(pymupdf.Point(15 * MM_TO_PT, 52 * MM_TO_PT), f"Вильоти під обріз (бліди): {bleed_mm} мм", fontname=fname_reg, fontsize=8.5, color=(0.3, 0.3, 0.3))
        page2.insert_text(pymupdf.Point(15 * MM_TO_PT, 58 * MM_TO_PT), f"Спосіб нанесення: {app_type_str}", fontname=fname_bold, fontsize=8.5, color=(0.05, 0.55, 0.35))

        # Right Column: Roll parameters (X = 110 mm)
        page2.insert_text(pymupdf.Point(110 * MM_TO_PT, 33 * MM_TO_PT), "ПАРАМЕТРИ СПУСКУ НА РУЛОН", fontname=fname_bold, fontsize=9.5, color=(0.1, 0.4, 0.8))
        page2.insert_text(pymupdf.Point(110 * MM_TO_PT, 40 * MM_TO_PT), f"Ширина матеріалу: {roll_w_mm} мм", fontname=fname_reg, fontsize=8.5, color=(0.15, 0.15, 0.15))
        page2.insert_text(pymupdf.Point(110 * MM_TO_PT, 46 * MM_TO_PT), f"Ширина друку: {active['layout_width']} мм (ліміт: {printable_w_mm} мм)", fontname=fname_bold, fontsize=8.5, color=(0.15, 0.15, 0.15))
        page2.insert_text(pymupdf.Point(110 * MM_TO_PT, 52 * MM_TO_PT), f"Бокові поля рулону: {active['side_margin']} мм", fontname=fname_reg, fontsize=8.5, color=(0.3, 0.3, 0.3))
        page2.insert_text(pymupdf.Point(110 * MM_TO_PT, 58 * MM_TO_PT), f"Міжструмковий зазор (Y): {params.get('gap_y', 2.0)} мм  |  Крок (рапорт X): {active['step_x']} мм", fontname=fname_reg, fontsize=8.5, color=(0.3, 0.3, 0.3))

        # Large KPI Card
        box_rect = pymupdf.Rect(15 * MM_TO_PT, 67 * MM_TO_PT, 195 * MM_TO_PT, 110 * MM_TO_PT)
        page2.draw_rect(box_rect, color=(0.85, 0.9, 0.96), fill=(0.95, 0.97, 1.0), width=0.8)

        page2.insert_text(pymupdf.Point(20 * MM_TO_PT, 76 * MM_TO_PT), "ГОЛОВНИЙ ВИРОБНИЧИЙ ПОКАЗНИК ВИХОДУ:", fontname=fname_bold, fontsize=8.5, color=(0.2, 0.35, 0.6))
        page2.insert_text(pymupdf.Point(20 * MM_TO_PT, 91 * MM_TO_PT), f"{active['total_per_meter']} шт / пог. метр", fontname=fname_bold, fontsize=24, color=(0.08, 0.42, 0.85))
        page2.insert_text(pymupdf.Point(20 * MM_TO_PT, 101 * MM_TO_PT), f"Розкладка: {active['lanes']} струмків × {active['repeats']} рядів на 1000 мм   |   Корисне заповнення: {active['efficiency_pct']}%", fontname=fname_reg, fontsize=8.5, color=(0.2, 0.25, 0.35))

        # Miniature artwork preview inside KPI Box
        thumb_rect = pymupdf.Rect(155 * MM_TO_PT, 71 * MM_TO_PT, 185 * MM_TO_PT, 106 * MM_TO_PT)
        if has_source:
            if is_pdf and src_doc:
                page2.show_pdf_page(thumb_rect, src_doc, 0, rotate=0)
            else:
                page2.insert_image(thumb_rect, filename=source_file_path, rotate=0)
            page2.draw_rect(thumb_rect, color=(0.8, 0.85, 0.9), width=0.5)
        else:
            page2.draw_rect(thumb_rect, color=(0.9, 0.2, 0.6), fill=(1.0, 1.0, 1.0), width=0.8)
            page2.insert_text(
                pymupdf.Point(thumb_rect.x0 + 3 * MM_TO_PT, thumb_rect.y0 + 12 * MM_TO_PT),
                "ВИСІЧКА",
                fontname=fname_bold,
                fontsize=7.5,
                color=(0.9, 0.2, 0.6)
            )
            page2.insert_text(
                pymupdf.Point(thumb_rect.x0 + 3 * MM_TO_PT, thumb_rect.y0 + 20 * MM_TO_PT),
                f"{label_w_mm:g} × {label_h_mm:g} мм",
                fontname=fname_bold,
                fontsize=7.0,
                color=(0.1, 0.2, 0.4)
            )
            page2.insert_text(
                pymupdf.Point(thumb_rect.x0 + 3 * MM_TO_PT, thumb_rect.y0 + 28 * MM_TO_PT),
                "Без макету",
                fontname=fname_reg,
                fontsize=6.5,
                color=(0.5, 0.55, 0.65)
            )

        # Circulation estimation block
        circ = int(circulation or 10000)
        lanes = max(1, active.get("lanes", 1))
        step_x = active.get("step_x", 26.0)
        rows_needed = int((circ + lanes - 1) // lanes)
        m_net = (rows_needed * step_x) / 1000.0
        waste_str = str(waste)
        if waste_str.endswith("m"):
            m_gross = m_net + float(waste_str[:-1] or 0)
        else:
            m_gross = m_net * (1.0 + float(waste_str or 5) / 100.0)
        sq_m = m_gross * (roll_w_mm / 1000.0)

        circ_box = pymupdf.Rect(15 * MM_TO_PT, 112 * MM_TO_PT, 195 * MM_TO_PT, 125 * MM_TO_PT)
        page2.draw_rect(circ_box, color=(0.75, 0.85, 0.95), fill=(0.94, 0.97, 1.0), width=0.6)
        page2.insert_text(
            pymupdf.Point(20 * MM_TO_PT, 117 * MM_TO_PT),
            f"ПРОРАХУНОК ТИРАЖУ ЗАМОВЛЕННЯ: {circ:,} шт".replace(",", " "),
            fontname=fname_bold,
            fontsize=8.0,
            color=(0.1, 0.35, 0.7)
        )
        page2.insert_text(
            pymupdf.Point(20 * MM_TO_PT, 122 * MM_TO_PT),
            f"Чистий метраж: ~{m_net:.1f} м ({rows_needed:,} рядів)   |   З приладкою (+{waste_str}{'' if waste_str.endswith('m') else '%'}): ~{m_gross:.1f} пог. м   |   Матеріал: {sq_m:.1f} м²".replace(",", " "),
            fontname=fname_reg,
            fontsize=7.2,
            color=(0.15, 0.45, 0.25)
        )

        # Footer notes
        page2.insert_text(pymupdf.Point(15 * MM_TO_PT, 131 * MM_TO_PT), "ROLL-PRINT CAD  •  Спуск рулонної етикетки на 1 погонний метр", fontname=fname_reg, fontsize=7, color=(0.55, 0.6, 0.68))
        page2.insert_text(pymupdf.Point(15 * MM_TO_PT, 136 * MM_TO_PT), "Документ містить точні параметри для налаштування друкарської машини та виготовлення висічного ножа.", fontname=fname_reg, fontsize=6.5, color=(0.6, 0.65, 0.72))

    doc.save(output_pdf_path)
    doc.close()
    if src_doc:
        src_doc.close()
