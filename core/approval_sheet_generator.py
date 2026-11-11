import os
import datetime
import pymupdf as fitz

PT_TO_MM = 25.4 / 72.0
MM_TO_PT = 72.0 / 25.4


def _fit_font_size(font_obj, text, max_width, start_size=9.5, min_size=4.5):
    """Returns the largest font size <= start_size that fits within max_width."""
    sz = start_size
    while sz > min_size:
        w = font_obj.text_length(str(text), fontsize=sz)
        if w <= max_width:
            return sz
        sz -= 0.25
    return min_size


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
        fobj_bold = fitz.Font(fontfile=font_bold)
        fobj_reg = fitz.Font(fontfile=font_reg)
    else:
        fname_bold = "hebo"
        fname_reg = "helv"
        fobj_bold = fitz.Font("hebo")
        fobj_reg = fitz.Font("helv")

    # Colors matched to sample template
    c_header_cyan = (0.0, 0.682, 0.937)     # #00aeef
    c_light_cyan = (0.553, 0.847, 0.973)     # #8dd8f8
    c_yellow = (1.0, 0.949, 0.0)             # #fff200
    c_red_border = (0.925, 0.110, 0.141)     # #ed1c24
    c_red_text = (0.824, 0.137, 0.165)       # #d2232a
    c_dark = (0.137, 0.122, 0.125)           # #231f20
    c_white = (1.0, 1.0, 1.0)
    c_magenta = (0.925, 0.0, 0.549)          # #ec008c

    # Extract fields with defaults
    today_str = data.get("date") or datetime.date.today().strftime("%d.%m.%Y")
    filename_str = data.get("filename") or "макет_етикетки"
    label_w = float(data.get("label_width", 72.0))
    label_h = float(data.get("label_height", 36.0))
    dims_str = f"{label_w:g}x{label_h:g}мм"
    circulation_str = f"{data.get('circulation', '10000')} шт"
    roll_w_str = f"{data.get('roll_width', '330')} мм"
    exit_w_str = data.get("exit_width", "")
    knife_str = data.get("knife", "")
    material_str = data.get("material", "білий глянцевий поліпропілен")
    glue_type = data.get("glue", "acrylic")
    applicator_type = data.get("application_type", "auto")
    labels_per_roll_str = f"{data.get('labels_per_roll', '1000')} шт"
    gap_str = data.get("gap", "4 мм (стандарт)")
    lanes_raw = str(data.get("lanes", "1 шт")).strip()
    lanes_str = lanes_raw if "шт" in lanes_raw else f"{lanes_raw} шт"
    core_raw = str(data.get("core", "76")).replace("мм", "").strip()
    core_str = f"{core_raw} мм"
    manager_str = data.get("manager", "")
    designer_str = data.get("designer", "")
    approved_str = data.get("approved_by", "")
    approval_date_str = data.get("approval_date", "")
    pantone_str = data.get("pantone", "відсутні")
    no_branding = bool(data.get("no_branding", False))
    winding_scheme = int(data.get("winding_scheme", 1))
    rot_map = {1: 0, 2: 180, 3: 90, 4: 270}
    if "roll_rotation" in data and data.get("roll_rotation") not in (None, ""):
        layout_rot = int(float(data.get("roll_rotation"))) % 360
    else:
        layout_rot = rot_map.get(winding_scheme, 0)

    # =========================================================================
    # 1. TOP HEADER BANNER
    # =========================================================================
    page.draw_rect(fitz.Rect(0, 0, page_w, 44.8), color=None, fill=c_header_cyan)

    title_text = "ТЕХНІЧНЕ ЗАВДАННЯ НА ВИГОТОВЛЕННЯ ЕТИКЕТКИ ЦИФРОВИЙ РУЛОННИЙ ДРУК"
    page.insert_text(fitz.Point(28, 28), title_text, fontname=fname_bold, fontsize=13.0, color=c_white)

    page.insert_text(fitz.Point(672, 28), "ДАТА:", fontname=fname_bold, fontsize=13.0, color=c_white)
    date_rect = fitz.Rect(722, 14, 815, 34)
    page.draw_rect(date_rect, color=c_dark, fill=c_white, width=1.0)
    page.insert_text(fitz.Point(date_rect.x0 + 8, date_rect.y0 + 14), today_str, fontname=fname_bold, fontsize=11.5, color=c_dark)

    # =========================================================================
    # 2. SUBHEADER (Filename + Cut Contour)
    # =========================================================================
    page.draw_rect(fitz.Rect(0, 44.8, 590, 68), color=None, fill=c_light_cyan)
    page.insert_text(fitz.Point(28, 61), "Назва файлу", fontname=fname_bold, fontsize=12.0, color=c_dark)

    fn_rect = fitz.Rect(122, 48, 385, 65)
    page.draw_rect(fn_rect, color=c_dark, fill=c_white, width=1.0)
    fn_sz = _fit_font_size(fobj_bold, filename_str, fn_rect.width - 10, start_size=9.5, min_size=5.0)
    page.insert_text(fitz.Point(fn_rect.x0 + 6, fn_rect.y0 + 12), filename_str, fontname=fname_bold, fontsize=fn_sz, color=c_dark)

    # Cut Contour Box (Yellow with Magenta Dashed Line)
    cut_box = fitz.Rect(398, 48, 580, 65)
    page.draw_rect(cut_box, color=c_magenta, fill=c_yellow, width=1.0)
    page.insert_text(fitz.Point(cut_box.x0 + 8, cut_box.y0 + 12), "Контур різу", fontname=fname_bold, fontsize=11.0, color=c_dark)
    page.draw_line(
        fitz.Point(cut_box.x0 + 86, cut_box.y0 + 8.5),
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

    def draw_param_row(label_lines, y_center, box_x0=692, box_w=125, box_h=16, val="", val_color=c_red_text, font_sz=10.5):
        box_rect = fitz.Rect(box_x0, y_center - box_h / 2, box_x0 + box_w, y_center + box_h / 2)
        if isinstance(label_lines, str):
            label_lines = [label_lines]

        if len(label_lines) == 1:
            page.insert_text(fitz.Point(sb_x0 + 6, y_center + 4), label_lines[0], fontname=fname_bold, fontsize=9.0, color=c_dark)
        else:
            page.insert_text(fitz.Point(sb_x0 + 6, y_center - 1), label_lines[0], fontname=fname_bold, fontsize=8.0, color=c_dark)
            page.insert_text(fitz.Point(sb_x0 + 6, y_center + 8), label_lines[1], fontname=fname_bold, fontsize=8.0, color=c_dark)

        page.draw_rect(box_rect, color=c_dark, fill=c_white, width=1.0)
        if val:
            fit_sz = _fit_font_size(fobj_bold, str(val), box_w - 10, start_size=font_sz, min_size=4.5)
            page.insert_text(fitz.Point(box_rect.x0 + 5, box_rect.y0 + box_h - 4.5), str(val), fontname=fname_bold, fontsize=fit_sz, color=val_color)
        return box_rect

    draw_param_row("Тираж, шт", 86, val=circulation_str)

    # Вихід з рулону & Ніж
    draw_param_row(["Вихід з рулону", "(ширина, мм)"], 110, box_w=56, val=exit_w_str)
    page.insert_text(fitz.Point(755, 114), "НІЖ", fontname=fname_bold, fontsize=10.5, color=c_dark)
    page.draw_rect(fitz.Rect(785, 102, 817, 118), color=c_dark, fill=c_white, width=1.0)
    if knife_str:
        k_sz = _fit_font_size(fobj_bold, knife_str, 24, start_size=9.5, min_size=6.0)
        page.insert_text(fitz.Point(788, 114), knife_str, fontname=fname_bold, fontsize=k_sz, color=c_red_text)

    draw_param_row("Ширина, мм", 134, box_w=65, val=roll_w_str)
    draw_param_row("Матеріал", 158, val=material_str, font_sz=9.0)

    # Клей: Акрил + / Каучук
    page.insert_text(fitz.Point(sb_x0 + 6, 184), "Клей", fontname=fname_bold, fontsize=9.5, color=c_dark)
    page.insert_text(fitz.Point(692, 184), "Акрил", fontname=fname_bold, fontsize=9.0, color=c_dark)
    b_akr = fitz.Rect(730, 176, 747, 192)
    page.draw_rect(b_akr, color=c_dark, fill=c_white, width=1.0)
    if glue_type == "acrylic":
        page.insert_text(fitz.Point(b_akr.x0 + 4, b_akr.y0 + 12), "+", fontname=fname_bold, fontsize=12.0, color=c_red_text)

    page.insert_text(fitz.Point(756, 184), "Каучук", fontname=fname_bold, fontsize=9.0, color=c_dark)
    b_kauc = fitz.Rect(800, 176, 817, 192)
    page.draw_rect(b_kauc, color=c_dark, fill=c_white, width=1.0)
    if glue_type == "rubber":
        page.insert_text(fitz.Point(b_kauc.x0 + 4, b_kauc.y0 + 12), "+", fontname=fname_bold, fontsize=12.0, color=c_red_text)

    # Поклейщик: Автм. + / Ручний
    page.insert_text(fitz.Point(sb_x0 + 6, 208), "Поклейщик", fontname=fname_bold, fontsize=9.5, color=c_dark)
    page.insert_text(fitz.Point(692, 208), "Автм.", fontname=fname_bold, fontsize=9.0, color=c_dark)
    b_avt = fitz.Rect(730, 200, 747, 216)
    page.draw_rect(b_avt, color=c_dark, fill=c_white, width=1.0)
    if applicator_type == "auto":
        page.insert_text(fitz.Point(b_avt.x0 + 4, b_avt.y0 + 12), "+", fontname=fname_bold, fontsize=12.0, color=c_red_text)

    page.insert_text(fitz.Point(756, 208), "Ручний", fontname=fname_bold, fontsize=9.0, color=c_dark)
    b_ruch = fitz.Rect(800, 200, 817, 216)
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
        page.insert_text(fitz.Point(sb_x0 + 10, y + 4), lbl, fontname=fname_bold, fontsize=9.5, color=c_dark)
        b_sig = fitz.Rect(692, y - 8, 817, y + 10)
        page.draw_rect(b_sig, color=c_dark, fill=c_white, width=1.0)
        if val:
            s_sz = _fit_font_size(fobj_reg, val, b_sig.width - 10, start_size=9.0, min_size=6.5)
            page.insert_text(fitz.Point(b_sig.x0 + 6, b_sig.y0 + 13), val, fontname=fname_reg, fontsize=s_sz, color=c_dark)

    # Yellow Attention Warning Box
    warn_rect = fitz.Rect(sb_x0 + 10, 444, 817, 574)
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
        page.insert_text(fitz.Point(warn_rect.x0 + 8, wy), wl, fontname=fname_reg, fontsize=8.3, color=c_dark)
        wy += 13.5

    # =========================================================================
    # 4. MIDDLE STRIP: CMYK, PANTONE, BRANDING
    # =========================================================================
    mid_y0 = 368
    mid_y1 = 402
    page.draw_rect(fitz.Rect(0, mid_y0, 590, mid_y1), color=None, fill=c_light_cyan)

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

    page.insert_text(fitz.Point(175, mid_y0 + 22), "Додаткові кольори (Pantone)", fontname=fname_bold, fontsize=10.0, color=c_dark)
    p_box = fitz.Rect(348, mid_y0 + 7, 428, mid_y1 - 7)
    page.draw_rect(p_box, color=c_dark, fill=c_white, width=1.0)
    p_sz = _fit_font_size(fobj_bold, pantone_str, p_box.width - 10, start_size=9.0, min_size=6.5)
    page.insert_text(fitz.Point(p_box.x0 + 6, p_box.y0 + 14), pantone_str, fontname=fname_bold, fontsize=p_sz, color=c_dark)

    page.insert_text(fitz.Point(442, mid_y0 + 22), "Без брендування", fontname=fname_bold, fontsize=10.0, color=c_dark)
    nb_box = fitz.Rect(552, mid_y0 + 7, 572, mid_y1 - 7)
    page.draw_rect(nb_box, color=c_dark, fill=c_white, width=1.0)
    if no_branding:
        page.insert_text(fitz.Point(nb_box.x0 + 4, nb_box.y0 + 15), "+", fontname=fname_bold, fontsize=13.0, color=c_red_text)

    # =========================================================================
    # 5. CENTRAL ARTWORK AREA (Top)
    # =========================================================================
    page.insert_text(fitz.Point(360, 115), dims_str, fontname=fname_bold, fontsize=22.0, color=c_dark)

    has_art = False
    art_aspect = label_w / label_h if label_h > 0 else 1.0
    art_path = source_file_path or preview_image_path

    if art_path and os.path.exists(art_path):
        target_art_rect = fitz.Rect(70, 110, 340, 350)
        try:
            if art_path.lower().endswith(".pdf"):
                src_doc = fitz.open(art_path)
                p0 = src_doc[0]
                art_aspect = p0.rect.width / p0.rect.height if p0.rect.height > 0 else 1.0
                src_doc.close()
            else:
                from PIL import Image
                im = Image.open(art_path)
                art_aspect = im.width / im.height if im.height > 0 else 1.0

            avail_w = target_art_rect.width
            avail_h = target_art_rect.height
            if avail_w / avail_h > art_aspect:
                w = avail_h * art_aspect
                h = avail_h
            else:
                w = avail_w
                h = avail_w / art_aspect

            acx = (target_art_rect.x0 + target_art_rect.x1) / 2
            acy = (target_art_rect.y0 + target_art_rect.y1) / 2
            placed_rect = fitz.Rect(acx - w / 2, acy - h / 2, acx + w / 2, acy + h / 2)

            if art_path.lower().endswith(".pdf"):
                src_doc = fitz.open(art_path)
                page.show_pdf_page(placed_rect, src_doc, 0)
                src_doc.close()
            else:
                page.insert_image(placed_rect, filename=art_path)

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
    # 6. BOTTOM UNWINDING SCHEME (Clean roll + web + undistorted labels)
    # =========================================================================
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

    # Core Size callout lines & label
    page.draw_line(fitz.Point(rx_c - core_w, ry_c - 16), fitz.Point(rx_c - core_w, ry_c + 6), color=c_red_border, width=0.8)
    page.draw_line(fitz.Point(rx_c + core_w, ry_c - 16), fitz.Point(rx_c + core_w, ry_c + 6), color=c_red_border, width=0.8)
    page.draw_line(fitz.Point(rx_c - core_w - 4, ry_c - 16), fitz.Point(rx_c + core_w + 4, ry_c - 16), color=c_red_border, width=0.8)
    page.insert_text(fitz.Point(rx_c - 12, ry_c - 20), core_str, fontname=fname_bold, fontsize=8.0, color=c_dark)

    # Cylinder Body
    cyl_bottom_y = 560
    page.draw_line(fitz.Point(rx_c - r_major, ry_c), fitz.Point(rx_c - r_major, cyl_bottom_y), color=c_dark, width=1.2)
    page.draw_bezier(
        fitz.Point(rx_c - r_major, cyl_bottom_y),
        fitz.Point(rx_c - r_major / 2, cyl_bottom_y + r_minor),
        fitz.Point(rx_c + r_major / 2, cyl_bottom_y + r_minor),
        fitz.Point(rx_c + r_major, cyl_bottom_y),
        color=c_dark,
        width=1.2
    )

    # Web unwinding to right
    web_y0 = 472
    web_y1 = 562
    web_x0 = rx_c
    web_x1 = 540
    page.draw_rect(fitz.Rect(web_x0, web_y0, web_x1, web_y1), color=c_dark, fill=c_white, width=1.0)

    # Clean Red Arrow at Top of Web showing unwinding direction
    arr_y = web_y0 - 9
    page.draw_line(fitz.Point(web_x0 + 40, arr_y), fitz.Point(web_x1, arr_y), color=c_red_border, width=1.5)
    page.draw_polyline([
        fitz.Point(web_x1 - 6, arr_y - 3),
        fitz.Point(web_x1, arr_y),
        fitz.Point(web_x1 - 6, arr_y + 3)
    ], color=c_red_border, fill=c_red_border)

    # Compute exact undistorted label size on the horizontal unwinding web
    # Matches roll imposition convention: (layout_rot + 270) % 360
    web_rot = (layout_rot + 270) % 360
    is_rot_90 = web_rot in (90, 270)
    vis_aspect = (1.0 / art_aspect) if (is_rot_90 and art_aspect > 0) else art_aspect

    web_h = web_y1 - web_y0
    pad_y = 7.0
    max_lbl_h = web_h - 2 * pad_y
    gap_between = 14.0
    avail_web_w = (web_x1 - web_x0) - 36.0 # 18pt left/right margin

    # Start with height = max_lbl_h and derive proportional width
    vis_h = max_lbl_h
    vis_w = vis_h * vis_aspect

    # Make sure at least 2 repeats fit inside avail_web_w without deformation
    max_two_w = (avail_web_w - gap_between) / 2.0
    if vis_w > max_two_w:
        vis_w = max_two_w
        vis_h = vis_w / vis_aspect if vis_aspect > 0 else max_lbl_h

    # Decide repeat count (2 to 6)
    repeats = int((avail_web_w + gap_between) // (vis_w + gap_between))
    repeats = max(2, min(6, repeats))

    # Center labels vertically and horizontally on the web
    ly0 = web_y0 + (web_h - vis_h) / 2.0
    start_lx = web_x0 + 18.0

    for i in range(repeats):
        lx0 = start_lx + i * (vis_w + gap_between)
        l_rect = fitz.Rect(lx0, ly0, lx0 + vis_w, ly0 + vis_h)
        page.draw_rect(l_rect, color=c_magenta, fill=(0.99, 0.99, 1.0), width=0.8, dashes="[3 2] 0")

        if art_path and os.path.exists(art_path):
            try:
                if art_path.lower().endswith(".pdf"):
                    sdoc = fitz.open(art_path)
                    page.show_pdf_page(l_rect, sdoc, 0, rotate=web_rot)
                    sdoc.close()
                else:
                    page.insert_image(l_rect, filename=art_path, rotate=web_rot)
            except Exception:
                pass
        else:
            page.insert_text(fitz.Point(l_rect.x0 + 8, l_rect.y0 + vis_h / 2 + 3), f"ЕТИКЕТКА {i+1}", fontname=fname_bold, fontsize=7.5, color=(0.5, 0.5, 0.6))

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
    out_pdf = "temp_previews/test_kefir_v2.pdf"
    generate_approval_pdf(
        preview_image_path="samples/Kefir_1000g_1%_US_05 (новий).png",
        data={
            "filename": "Kefir_1000g_1%_US_05",
            "date": "11.11.2026",
            "label_width": 256.1,
            "label_height": 114.1,
            "circulation": "10000",
            "roll_width": "330",
            "material": "білий глянцевий крейдований папір",
            "glue": "acrylic",
            "application_type": "manual",
            "labels_per_roll": "1000",
            "gap": "4 мм (стандарт)",
            "lanes": "1 шт",
            "core": "76",
            "manager": "",
            "designer": "",
            "approved_by": "",
            "winding_scheme": 1
        },
        output_pdf_path=out_pdf
    )
    doc = fitz.open(out_pdf)
    pix = doc[0].get_pixmap(dpi=150)
    out_png = "temp_previews/test_kefir_v2.png"
    pix.save(out_png)
    doc.close()
    print("Saved preview to:", out_png)
