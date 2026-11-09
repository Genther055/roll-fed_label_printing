import os
import datetime
import pymupdf as fitz

PT_TO_MM = 25.4 / 72.0
MM_TO_PT = 72.0 / 25.4

def generate_approval_pdf(
    source_file_path=None,
    preview_image_path=None,
    data=None,
    output_pdf_path=None
):
    if data is None:
        data = {}

    doc = fitz.open()
    # A4 Landscape: 841.89 x 595.28 pt (297 x 210 mm)
    page_w = 841.89
    page_h = 595.28
    page = doc.new_page(width=page_w, height=page_h)

    # Fonts
    font_bold = "core/fonts/DejaVuSans-Bold.ttf" if os.path.exists("core/fonts/DejaVuSans-Bold.ttf") else None
    font_reg = "core/fonts/DejaVuSans.ttf" if os.path.exists("core/fonts/DejaVuSans.ttf") else None
    
    fname_bold = "CustomBold"
    fname_reg = "CustomReg"
    if font_bold and font_reg:
        page.insert_font(fontname=fname_bold, fontfile=font_bold)
        page.insert_font(fontname=fname_reg, fontfile=font_reg)
    else:
        fname_bold = "helv-bold"
        fname_reg = "helv"

    # Colors exactly matched to sample
    c_header_cyan = (0.0, 0.682, 0.937)     # #00aeef
    c_light_cyan = (0.553, 0.847, 0.973)     # #8dd8f8
    c_yellow = (1.0, 0.949, 0.0)             # #fff200
    c_red_border = (0.925, 0.110, 0.141)     # #ed1c24
    c_red_text = (0.824, 0.137, 0.165)       # #d2232a
    c_dark = (0.137, 0.122, 0.125)           # #231f20
    c_white = (1.0, 1.0, 1.0)
    c_magenta = (0.925, 0.0, 0.549)          # #ec008c

    # Extract fields with sensible defaults
    today_str = data.get("date") or datetime.date.today().strftime("%d.%m.%Y")
    filename_str = data.get("filename") or "Маproduction_label_PRINT"
    label_w = float(data.get("label_width", 72.0))
    label_h = float(data.get("label_height", 36.0))
    dims_str = f"{label_w:g}x{label_h:g}мм"
    circulation_str = f"{data.get('circulation', '10000')} шт"
    roll_w_str = f"{data.get('roll_width', '330')} мм"
    exit_w_str = data.get("exit_width", "")
    knife_str = data.get("knife", "")
    material_str = data.get("material", "білий поліпропілен")
    glue_type = data.get("glue", "acrylic") # acrylic / rubber
    applicator_type = data.get("application_type", "auto") # auto / manual
    labels_per_roll_str = f"{data.get('labels_per_roll', '1000')} шт"
    gap_str = data.get("gap", "4 мм (стандарт)")
    lanes_str = f"{data.get('lanes', '1')} шт"
    core_str = f"{data.get('core', '76')} мм"
    manager_str = data.get("manager", "")
    designer_str = data.get("designer", "")
    approved_str = data.get("approved_by", "")
    approval_date_str = data.get("approval_date", "")
    pantone_str = data.get("pantone", "відсутні")
    no_branding = bool(data.get("no_branding", False))
    winding_scheme = int(data.get("winding_scheme", 1))

    # =========================================================================
    # 1. TOP HEADER BANNER
    # =========================================================================
    page.draw_rect(fitz.Rect(0, 0, page_w, 44.8), color=None, fill=c_header_cyan)
    
    # Title (white bold)
    title_text = "ТЕХНІЧНЕ ЗАВДАННЯ НА ВИГОТОВЛЕННЯ ЕТИКЕТКИ ЦИФРОВИЙ РУЛОННИЙ ДРУК"
    page.insert_text(fitz.Point(28, 28), title_text, fontname=fname_bold, fontsize=13.0, color=c_white)
    
    # Date label and box
    page.insert_text(fitz.Point(672, 28), "ДАТА:", fontname=fname_bold, fontsize=13.0, color=c_white)
    date_rect = fitz.Rect(722, 14, 815, 34)
    page.draw_rect(date_rect, color=c_dark, fill=c_white, width=1.0)
    page.insert_text(fitz.Point(date_rect.x0 + 8, date_rect.y0 + 14), today_str, fontname=fname_bold, fontsize=11.5, color=c_dark)

    # =========================================================================
    # 2. SUBHEADER (Filename + Cut Contour)
    # =========================================================================
    page.draw_rect(fitz.Rect(0, 44.8, 590, 68), color=None, fill=c_light_cyan)
    page.insert_text(fitz.Point(28, 61), "Назва файлу", fontname=fname_bold, fontsize=12.0, color=c_dark)
    
    # Filename box
    fn_rect = fitz.Rect(118, 48, 385, 65)
    page.draw_rect(fn_rect, color=c_dark, fill=c_white, width=1.0)
    display_fn = filename_str if len(filename_str) < 45 else filename_str[:42] + "..."
    page.insert_text(fitz.Point(fn_rect.x0 + 6, fn_rect.y0 + 12), display_fn, fontname=fname_bold, fontsize=9.0, color=c_dark)

    # Cut Contour Box (Yellow with Magenta Dashed Line)
    cut_box = fitz.Rect(398, 48, 580, 65)
    page.draw_rect(cut_box, color=c_magenta, fill=c_yellow, width=1.0)
    page.insert_text(fitz.Point(cut_box.x0 + 8, cut_box.y0 + 12), "Контур різу", fontname=fname_bold, fontsize=11.0, color=c_dark)
    
    # Dashed line
    page.draw_line(
        fitz.Point(cut_box.x0 + 80, cut_box.y0 + 8.5),
        fitz.Point(cut_box.x1 - 8, cut_box.y0 + 8.5),
        color=c_magenta,
        width=2.0,
        dashes="[4 3] 0"
    )

    # =========================================================================
    # 3. RIGHT SIDEBAR
    # =========================================================================
    sb_x0 = 590
    page.draw_rect(fitz.Rect(sb_x0, 44.8, page_w, page_h), color=None, fill=c_light_cyan)

    def draw_param_row(label_lines, y_center, box_x0=688, box_w=125, box_h=16, val="", val_color=c_red_text, font_sz=11.0):
        box_rect = fitz.Rect(box_x0, y_center - box_h/2, box_x0 + box_w, y_center + box_h/2)
        if isinstance(label_lines, str):
            label_lines = [label_lines]
        
        if len(label_lines) == 1:
            page.insert_text(fitz.Point(sb_x0 + 6, y_center + 4), label_lines[0], fontname=fname_bold, fontsize=9.5, color=c_dark)
        else:
            page.insert_text(fitz.Point(sb_x0 + 6, y_center - 1), label_lines[0], fontname=fname_bold, fontsize=8.5, color=c_dark)
            page.insert_text(fitz.Point(sb_x0 + 6, y_center + 8), label_lines[1], fontname=fname_bold, fontsize=8.5, color=c_dark)
            
        page.draw_rect(box_rect, color=c_dark, fill=c_white, width=1.0)
        if val:
            page.insert_text(fitz.Point(box_rect.x0 + 6, box_rect.y0 + box_h - 4), str(val), fontname=fname_bold, fontsize=font_sz, color=val_color)
        return box_rect

    # Parameter Rows
    draw_param_row("Тираж, шт", 86, val=circulation_str)
    
    # Вихід з рулону & Ніж
    draw_param_row(["Вихід з рулону", "(ширина, мм)"], 110, box_w=58, val=exit_w_str)
    page.insert_text(fitz.Point(755, 114), "НІЖ", fontname=fname_bold, fontsize=10.5, color=c_dark)
    page.draw_rect(fitz.Rect(785, 102, 813, 118), color=c_dark, fill=c_white, width=1.0)
    if knife_str:
        page.insert_text(fitz.Point(788, 114), knife_str, fontname=fname_bold, fontsize=9.5, color=c_red_text)

    draw_param_row("Ширина, мм", 134, box_w=65, val=roll_w_str)
    draw_param_row("Матеріал", 158, val=material_str, font_sz=9.5)
    
    # Клей: Акрил + / Каучук
    page.insert_text(fitz.Point(sb_x0 + 8, 184), "Клей", fontname=fname_bold, fontsize=10.0, color=c_dark)
    page.insert_text(fitz.Point(692, 184), "Акрил", fontname=fname_bold, fontsize=9.5, color=c_dark)
    b_akr = fitz.Rect(728, 176, 745, 192)
    page.draw_rect(b_akr, color=c_dark, fill=c_white, width=1.0)
    if glue_type == "acrylic":
        page.insert_text(fitz.Point(b_akr.x0 + 4, b_akr.y0 + 12), "+", fontname=fname_bold, fontsize=12.0, color=c_red_text)

    page.insert_text(fitz.Point(756, 184), "Каучук", fontname=fname_bold, fontsize=9.5, color=c_dark)
    b_kauc = fitz.Rect(796, 176, 813, 192)
    page.draw_rect(b_kauc, color=c_dark, fill=c_white, width=1.0)
    if glue_type == "rubber":
        page.insert_text(fitz.Point(b_kauc.x0 + 4, b_kauc.y0 + 12), "+", fontname=fname_bold, fontsize=12.0, color=c_red_text)

    # Поклейщик: Автм. + / Ручний
    page.insert_text(fitz.Point(sb_x0 + 8, 208), "Поклейщик", fontname=fname_bold, fontsize=10.0, color=c_dark)
    page.insert_text(fitz.Point(692, 208), "Автм.", fontname=fname_bold, fontsize=9.5, color=c_dark)
    b_avt = fitz.Rect(728, 200, 745, 216)
    page.draw_rect(b_avt, color=c_dark, fill=c_white, width=1.0)
    if applicator_type == "auto":
        page.insert_text(fitz.Point(b_avt.x0 + 4, b_avt.y0 + 12), "+", fontname=fname_bold, fontsize=12.0, color=c_red_text)

    page.insert_text(fitz.Point(756, 208), "Ручний", fontname=fname_bold, fontsize=9.5, color=c_dark)
    b_ruch = fitz.Rect(796, 200, 813, 216)
    page.draw_rect(b_ruch, color=c_dark, fill=c_white, width=1.0)
    if applicator_type == "manual":
        page.insert_text(fitz.Point(b_ruch.x0 + 4, b_ruch.y0 + 12), "+", fontname=fname_bold, fontsize=12.0, color=c_red_text)

    draw_param_row(["К-сть. етикеток", "в рулоні, шт"], 232, val=labels_per_roll_str)
    draw_param_row(["Відстань між", "етикетками,мм"], 256, val=gap_str, font_sz=9.5)
    draw_param_row(["Кількість рядів", "в рулоні, шт"], 280, val=lanes_str)
    draw_param_row("Втулка, мм", 304, val=core_str)

    # Signature Fields
    sig_fields = [
        ("Менеджер:", manager_str, 332),
        ("Дизайнер:", designer_str, 356),
        ("Затвердив:", approved_str, 380),
        ("Дата:", approval_date_str, 404),
    ]
    for lbl, val, y in sig_fields:
        page.insert_text(fitz.Point(sb_x0 + 12, y + 4), lbl, fontname=fname_bold, fontsize=9.5, color=c_dark)
        b_sig = fitz.Rect(688, y - 8, 813, y + 10)
        page.draw_rect(b_sig, color=c_dark, fill=c_white, width=1.0)
        if val:
            page.insert_text(fitz.Point(b_sig.x0 + 6, b_sig.y0 + 13), val, fontname=fname_reg, fontsize=9.0, color=c_dark)

    # Yellow Attention Warning Box
    warn_rect = fitz.Rect(sb_x0 + 10, 444, 815, 574)
    page.draw_rect(warn_rect, color=c_red_border, fill=c_yellow, width=1.5)
    page.insert_text(fitz.Point(warn_rect.x0 + 8, warn_rect.y0 + 16), "Будь ласка, будьте уважні!", fontname=fname_bold, fontsize=11.5, color=c_dark)
    
    warn_lines = [
        "Після затвердження макета Замовник несе",
        "відповідальність за правильність всієї вказаної",
        "інформації, а саме: дані по матеріалу, розміри",
        "та конфігурація етикетки, намотка, текстова",
        "інформація, штрих-код, наявність та",
        "розташування знаків та елементів дизайну."
    ]
    wy = warn_rect.y0 + 32
    for wl in warn_lines:
        page.insert_text(fitz.Point(warn_rect.x0 + 8, wy), wl, fontname=fname_reg, fontsize=8.5, color=c_dark)
        wy += 13.5

    # =========================================================================
    # 4. MIDDLE STRIP: CMYK, PANTONE, BRANDING
    # =========================================================================
    mid_y0 = 368
    mid_y1 = 402
    page.draw_rect(fitz.Rect(0, mid_y0, 590, mid_y1), color=None, fill=c_light_cyan)

    # CMYK Swatches
    cmyk_defs = [
        ("C", (0.0, 0.682, 0.937), c_white),
        ("M", (0.925, 0.0, 0.549), c_white),
        ("Y", (1.0, 0.949, 0.0), c_dark),
        ("K", (0.137, 0.122, 0.125), c_white)
    ]
    cx = 50
    for letter, bg, fg in cmyk_defs:
        sq = fitz.Rect(cx, mid_y0 + 4, cx + 24, mid_y1 - 4)
        page.draw_rect(sq, color=c_dark, fill=bg, width=0.8)
        page.insert_text(fitz.Point(sq.x0 + 6, sq.y0 + 20), letter, fontname=fname_bold, fontsize=15.0, color=fg)
        cx += 28

    # Pantone
    page.insert_text(fitz.Point(175, mid_y0 + 22), "Додаткові кольори (Pantone)", fontname=fname_bold, fontsize=10.0, color=c_dark)
    p_box = fitz.Rect(348, mid_y0 + 7, 428, mid_y1 - 7)
    page.draw_rect(p_box, color=c_dark, fill=c_white, width=1.0)
    page.insert_text(fitz.Point(p_box.x0 + 6, p_box.y0 + 14), pantone_str, fontname=fname_bold, fontsize=9.0, color=c_dark)

    # Без брендування
    page.insert_text(fitz.Point(448, mid_y0 + 22), "Без брендування", fontname=fname_bold, fontsize=10.0, color=c_dark)
    nb_box = fitz.Rect(545, mid_y0 + 7, 565, mid_y1 - 7)
    page.draw_rect(nb_box, color=c_dark, fill=c_white, width=1.0)
    if no_branding:
        page.insert_text(fitz.Point(nb_box.x0 + 4, nb_box.y0 + 15), "+", fontname=fname_bold, fontsize=13.0, color=c_red_text)

    # =========================================================================
    # 5. CENTRAL ARTWORK AREA (Top)
    # =========================================================================
    # Dimension title above or beside artwork
    page.insert_text(fitz.Point(360, 115), dims_str, fontname=fname_bold, fontsize=22.0, color=c_dark)

    has_art = False
    art_path = source_file_path or preview_image_path
    if art_path and os.path.exists(art_path):
        target_art_rect = fitz.Rect(70, 110, 340, 350)
        try:
            if art_path.lower().endswith(".pdf"):
                src_doc = fitz.open(art_path)
                p0 = src_doc[0]
                aspect = p0.rect.width / p0.rect.height if p0.rect.height > 0 else 1.0
                src_doc.close()
            else:
                from PIL import Image
                im = Image.open(art_path)
                aspect = im.width / im.height if im.height > 0 else 1.0

            avail_w = target_art_rect.width
            avail_h = target_art_rect.height
            if avail_w / avail_h > aspect:
                w = avail_h * aspect
                h = avail_h
            else:
                w = avail_w
                h = avail_w / aspect
            
            cx = (target_art_rect.x0 + target_art_rect.x1) / 2
            cy = (target_art_rect.y0 + target_art_rect.y1) / 2
            placed_rect = fitz.Rect(cx - w/2, cy - h/2, cx + w/2, cy + h/2)

            if art_path.lower().endswith(".pdf"):
                src_doc = fitz.open(art_path)
                page.show_pdf_page(placed_rect, src_doc, 0)
                src_doc.close()
            else:
                page.insert_image(placed_rect, filename=art_path)

            # Draw dashed magenta cut contour around placed artwork
            page.draw_rect(placed_rect, color=c_magenta, width=1.2, dashes="[5 3] 0")
            has_art = True
        except Exception as e:
            print(f"Error placing central artwork: {e}")

    if not has_art:
        ph_rect = fitz.Rect(120, 130, 320, 320)
        page.draw_rect(ph_rect, color=c_magenta, fill=(0.98, 0.98, 0.99), width=1.5, dashes="[5 3] 0")
        page.insert_text(fitz.Point(ph_rect.x0 + 35, ph_rect.y0 + 80), "МАКЕТ ЕТИКЕТКИ", fontname=fname_bold, fontsize=14.0, color=(0.6, 0.6, 0.7))
        page.insert_text(fitz.Point(ph_rect.x0 + 55, ph_rect.y0 + 105), dims_str, fontname=fname_bold, fontsize=12.0, color=c_dark)

    # =========================================================================
    # 6. BOTTOM UNWINDING SCHEME (Paper Roll + Web + Repeated Labels)
    # =========================================================================
    unwind_y0 = 415
    page.insert_text(fitz.Point(210, unwind_y0 + 16), "напрямок розмотування", fontname=fname_bold, fontsize=11.0, color=c_dark)
    page.insert_text(fitz.Point(200, unwind_y0 + 29), "Увага! Перевірте схему намотки!", fontname=fname_bold, fontsize=9.0, color=c_red_text)

    # Roll Cylinder on Left
    rx_c = 150
    ry_c = 445
    r_major = 60
    r_minor = 16

    # Roll Top Ellipse
    page.draw_oval(fitz.Rect(rx_c - r_major, ry_c - r_minor, rx_c + r_major, ry_c + r_minor), color=c_dark, fill=c_white, width=1.2)
    # Core Hole
    core_w = 20
    core_h = 6
    page.draw_oval(fitz.Rect(rx_c - core_w, ry_c - core_h, rx_c + core_w, ry_c + core_h), color=c_dark, fill=(0.85, 0.85, 0.85), width=1.0)
    
    # Core Size callout lines
    page.draw_line(fitz.Point(rx_c - core_w, ry_c - 16), fitz.Point(rx_c - core_w, ry_c + 6), color=c_red_border, width=0.8)
    page.draw_line(fitz.Point(rx_c + core_w, ry_c - 16), fitz.Point(rx_c + core_w, ry_c + 6), color=c_red_border, width=0.8)
    page.draw_line(fitz.Point(rx_c - core_w - 4, ry_c - 16), fitz.Point(rx_c + core_w + 4, ry_c - 16), color=c_red_border, width=0.8)
    page.insert_text(fitz.Point(rx_c - 10, ry_c - 20), core_str, fontname=fname_bold, fontsize=8.0, color=c_dark)

    # Cylinder Body
    cyl_bottom_y = 560
    page.draw_line(fitz.Point(rx_c - r_major, ry_c), fitz.Point(rx_c - r_major, cyl_bottom_y), color=c_dark, width=1.2)
    p_curve = fitz.Point(rx_c, cyl_bottom_y + r_minor)
    page.draw_bezier(
        fitz.Point(rx_c - r_major, cyl_bottom_y),
        fitz.Point(rx_c - r_major/2, cyl_bottom_y + r_minor),
        fitz.Point(rx_c + r_major/2, cyl_bottom_y + r_minor),
        fitz.Point(rx_c + r_major, cyl_bottom_y),
        color=c_dark,
        width=1.2
    )

    # Web unwinding to right
    web_y0 = 475
    web_y1 = 560
    web_x0 = rx_c
    web_x1 = 515
    page.draw_rect(fitz.Rect(web_x0, web_y0, web_x1, web_y1), color=c_dark, fill=c_white, width=1.0)

    # Red Arrow at Top of Web (unwinding direction)
    arr_y = web_y0 - 8
    page.draw_line(fitz.Point(web_x0 + 40, arr_y), fitz.Point(web_x1, arr_y), color=c_red_border, width=1.5)
    page.draw_polyline([
        fitz.Point(web_x1 - 6, arr_y - 3),
        fitz.Point(web_x1, arr_y),
        fitz.Point(web_x1 - 6, arr_y + 3)
    ], color=c_red_border, fill=c_red_border)

    # Repeated Labels along the Web (2 repeats)
    lbl_box_w = 120
    lbl_box_h = 75
    rot_map = {1: 0, 2: 180, 3: 90, 4: 270}
    scheme_rot = rot_map.get(winding_scheme, 0)

    for i in range(2):
        lx0 = web_x0 + 20 + i * (lbl_box_w + 20)
        ly0 = web_y0 + 5
        l_rect = fitz.Rect(lx0, ly0, lx0 + lbl_box_w, ly0 + lbl_box_h)
        page.draw_rect(l_rect, color=c_magenta, fill=(0.99, 0.99, 1.0), width=0.8, dashes="[3 2] 0")
        
        if art_path and os.path.exists(art_path):
            try:
                if art_path.lower().endswith(".pdf"):
                    sdoc = fitz.open(art_path)
                    page.show_pdf_page(l_rect, sdoc, 0, rotate=scheme_rot)
                    sdoc.close()
                else:
                    page.insert_image(l_rect, filename=art_path, rotate=scheme_rot)
            except Exception as e:
                pass
        else:
            page.insert_text(fitz.Point(l_rect.x0 + 25, l_rect.y0 + 40), f"ЕТИКЕТКА {i+1}", fontname=fname_bold, fontsize=8.0, color=(0.5, 0.5, 0.6))

    # Gap dimension callout between labels
    g_x = web_x0 + 20 + lbl_box_w + 2
    page.draw_line(fitz.Point(g_x, web_y0 - 2), fitz.Point(g_x + 16, web_y0 - 2), color=c_red_border, width=0.8)
    page.insert_text(fitz.Point(g_x + 1, web_y0 - 4), "2мм", fontname=fname_bold, fontsize=7.0, color=c_dark)

    # Vertical Height Callout Arrow on right of web
    h_x = web_x1 + 12
    page.draw_line(fitz.Point(h_x, web_y0), fitz.Point(h_x, web_y1), color=c_red_border, width=1.0)
    page.draw_polyline([fitz.Point(h_x - 2.5, web_y0 + 5), fitz.Point(h_x, web_y0), fitz.Point(h_x + 2.5, web_y0 + 5)], color=c_red_border, fill=c_red_border)
    page.draw_polyline([fitz.Point(h_x - 2.5, web_y1 - 5), fitz.Point(h_x, web_y1), fitz.Point(h_x + 2.5, web_y1 - 5)], color=c_red_border, fill=c_red_border)
    
    # Rotated height text
    h_text = f"Висота {int(label_h + 8)}мм"
    page.insert_text(fitz.Point(h_x + 14, (web_y0 + web_y1)/2 + 25), h_text, fontname=fname_bold, fontsize=10.0, color=c_dark, rotate=270)

    # Save to bytes or file
    if output_pdf_path:
        doc.save(output_pdf_path, deflate=True, garbage=4)
        doc.close()
        return output_pdf_path
    else:
        pdf_bytes = doc.tobytes(deflate=True, garbage=4)
        doc.close()
        return pdf_bytes

if __name__ == "__main__":
    out_pdf = "temp_previews/test_kefir_approval.pdf"
    generate_approval_pdf(
        preview_image_path="samples/Kefir_1000g_1%_US_05 (новий).png",
        data={
            "filename": "Kefir_1000g_1%_US_05",
            "date": "09.11.2026",
            "label_width": 256.1,
            "label_height": 114.1,
            "circulation": "5000",
            "roll_width": "330",
            "material": "білий поліпропілен",
            "glue": "acrylic",
            "application_type": "auto",
            "labels_per_roll": "2000",
            "gap": "3 мм",
            "lanes": "1",
            "core": "76",
            "manager": "Олена",
            "designer": "Дмитро",
            "approved_by": "Замовник",
            "winding_scheme": 1
        },
        output_pdf_path=out_pdf
    )
    print("Generated PDF:", out_pdf)
    
    doc = fitz.open(out_pdf)
    pix = doc[0].get_pixmap(dpi=150)
    out_png = "temp_previews/test_kefir_approval.png"
    pix.save(out_png)
    doc.close()
    print("Saved preview to:", out_png)
