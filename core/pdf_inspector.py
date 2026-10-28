import os
import base64
from PIL import Image
import pymupdf

PT_TO_MM = 25.4 / 72.0
MM_TO_PT = 72.0 / 25.4

def inspect_file(file_path):
    """
    Inspects a PDF or Image (PNG/JPG) file to extract dimensions,
    cut contour, bleed, and generate a preview data URL.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return _inspect_pdf(file_path)
    elif ext in [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"]:
        return _inspect_image(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

def _inspect_pdf(file_path):
    doc = pymupdf.open(file_path)
    if len(doc) == 0:
        raise ValueError("PDF has no pages.")

    page = doc[0]
    rect = page.rect
    total_w_mm = round(rect.width * PT_TO_MM, 2)
    total_h_mm = round(rect.height * PT_TO_MM, 2)

    cut_w_mm = None
    cut_h_mm = None
    bleed_mm = 0.0
    has_cut_contour = False
    cut_rect = None

    drawings = page.get_drawings()
    for d in drawings:
        color = d.get("color")
        if color and len(color) >= 3:
            r, g, b = color[0], color[1], color[2]
            if r > 0.7 and g < 0.3:
                r_rect = d["rect"]
                cand_w = round(r_rect.width * PT_TO_MM, 2)
                cand_h = round(r_rect.height * PT_TO_MM, 2)
                if cand_w > 5 and cand_h > 5 and cand_w <= total_w_mm and cand_h <= total_h_mm:
                    cut_w_mm = cand_w
                    cut_h_mm = cand_h
                    cut_rect = r_rect
                    has_cut_contour = True
                    break

    if has_cut_contour and cut_w_mm and cut_h_mm:
        bleed_x = (total_w_mm - cut_w_mm) / 2.0
        bleed_y = (total_h_mm - cut_h_mm) / 2.0
        bleed_mm = round(max(bleed_x, bleed_y), 2)
    else:
        trimbox = getattr(page, 'trimbox', None)
        if trimbox and (round(trimbox.width, 1) != round(rect.width, 1) or round(trimbox.height, 1) != round(rect.height, 1)):
            cut_w_mm = round(trimbox.width * PT_TO_MM, 2)
            cut_h_mm = round(trimbox.height * PT_TO_MM, 2)
            bleed_mm = round((total_w_mm - cut_w_mm) / 2.0, 2)
            cut_rect = trimbox
            has_cut_contour = True
        else:
            cut_w_mm = total_w_mm
            cut_h_mm = total_h_mm
            cut_rect = rect
            bleed_mm = 0.0

    # Clip preview pixmap to exact cut contour so preview matches cut contour 1:1
    clip_target = cut_rect if has_cut_contour and cut_rect else None
    if clip_target:
        pix = page.get_pixmap(clip=clip_target, dpi=200, alpha=True)
    else:
        pix = page.get_pixmap(dpi=200, alpha=True)
    img_bytes = pix.tobytes("png")
    base64_preview = base64.b64encode(img_bytes).decode("ascii")
    data_url = f"data:image/png;base64,{base64_preview}"

    doc.close()

    return {
        "filename": os.path.basename(file_path),
        "file_type": "pdf",
        "total_width_mm": total_w_mm,
        "total_height_mm": total_h_mm,
        "cut_width_mm": cut_w_mm,
        "cut_height_mm": cut_h_mm,
        "bleed_mm": bleed_mm,
        "has_cut_contour": has_cut_contour,
        "preview_data_url": data_url
    }

def _inspect_image(file_path):
    img = Image.open(file_path)
    dpi = img.info.get("dpi", (150, 150))
    dpi_x = float(dpi[0]) if dpi[0] > 0 else 150.0
    dpi_y = float(dpi[1]) if dpi[1] > 0 else 150.0

    w_px, h_px = img.size
    w_mm = round((w_px / dpi_x) * 25.4, 1)
    h_mm = round((h_px / dpi_y) * 25.4, 1)

    # Convert to thumbnail preview
    thumb = img.copy()
    thumb.thumbnail((800, 800), Image.Resampling.LANCZOS)
    import io
    buf = io.BytesIO()
    thumb.save(buf, format="PNG")
    base64_preview = base64.b64encode(buf.getvalue()).decode("ascii")
    data_url = f"data:image/png;base64,{base64_preview}"

    return {
        "filename": os.path.basename(file_path),
        "file_type": "image",
        "total_width_mm": w_mm,
        "total_height_mm": h_mm,
        "cut_width_mm": w_mm,
        "cut_height_mm": h_mm,
        "bleed_mm": 0.0,
        "has_cut_contour": False,
        "preview_data_url": data_url
    }

# Backward compatibility alias
inspect_pdf = inspect_file
