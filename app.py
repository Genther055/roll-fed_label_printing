import os
import sys
import json
import uuid
import re
import urllib.parse
import tornado.ioloop
import tornado.web
from tornado.escape import json_decode

from core.pdf_inspector import inspect_file
from core.layout_engine import calculate_layout, FINAT_SCHEMES
from core.pdf_imposer import generate_imposition_pdf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_DIR = os.path.join(BASE_DIR, "samples")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
if os.environ.get("VERCEL") or not os.access(BASE_DIR, os.W_OK):
    import tempfile
    UPLOADS_DIR = os.path.join(tempfile.gettempdir(), "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "static")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(SAMPLES_DIR, exist_ok=True)

SUPPORTED_EXTS = (".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp")

class BaseHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with, content-type")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def options(self, *args, **kwargs):
        self.set_status(204)
        self.finish()

class SamplesHandler(BaseHandler):
    def get(self):
        samples = []
        if os.path.exists(SAMPLES_DIR):
            for fname in os.listdir(SAMPLES_DIR):
                if fname.lower().endswith(SUPPORTED_EXTS):
                    fpath = os.path.join(SAMPLES_DIR, fname)
                    try:
                        info = inspect_file(fpath)
                        clean_name = os.path.splitext(fname)[0]
                        samples.append({
                            "id": fname,
                            "name": clean_name,
                            "filename": fname,
                            "original_filename": fname,
                            "file_type": info["file_type"],
                            "type": "sample",
                            "cut_width_mm": info["cut_width_mm"],
                            "cut_height_mm": info["cut_height_mm"],
                            "bleed_mm": info["bleed_mm"],
                            "preview_data_url": info["preview_data_url"]
                        })
                    except Exception as e:
                        print(f"Error inspecting sample {fname}: {e}")
        self.write({"samples": samples})

class UploadHandler(BaseHandler):
    def post(self):
        if "file" not in self.request.files:
            self.set_status(400)
            self.write({"error": "No file uploaded"})
            return

        file_info = self.request.files["file"][0]
        filename = file_info["filename"]
        unique_name = f"{uuid.uuid4().hex[:8]}_{filename}"
        fpath = os.path.join(UPLOADS_DIR, unique_name)

        with open(fpath, "wb") as f:
            f.write(file_info["body"])

        try:
            info = inspect_file(fpath)
            self.write({
                "id": unique_name,
                "name": os.path.splitext(filename)[0],
                "filename": unique_name,
                "original_filename": filename,
                "file_type": info["file_type"],
                "type": "upload",
                "cut_width_mm": info["cut_width_mm"],
                "cut_height_mm": info["cut_height_mm"],
                "bleed_mm": info["bleed_mm"],
                "preview_data_url": info["preview_data_url"]
            })
        except Exception as e:
            self.set_status(500)
            self.write({"error": f"Failed to inspect file: {str(e)}"})

class InspectHandler(BaseHandler):
    def post(self):
        data = json_decode(self.request.body)
        filename = data.get("filename")
        file_type = data.get("type", "sample")

        if file_type == "upload":
            fpath = os.path.join(UPLOADS_DIR, filename)
        else:
            fpath = os.path.join(SAMPLES_DIR, filename)

        if not os.path.exists(fpath):
            self.set_status(404)
            self.write({"error": "File not found"})
            return

        try:
            info = inspect_file(fpath)
            self.write(info)
        except Exception as e:
            self.set_status(500)
            self.write({"error": str(e)})

class CalculateHandler(BaseHandler):
    def post(self):
        data = json_decode(self.request.body)

        label_w = float(data.get("label_width", 24.0))
        label_h = float(data.get("label_height", 40.0))
        bleed = float(data.get("bleed", 0.0))
        roll_w = float(data.get("roll_width", 330.0))
        printable_w = float(data.get("printable_width", 305.0))
        meter_l = float(data.get("meter_length", 1000.0))
        gap_x = float(data.get("gap_x", 2.0))
        gap_y = float(data.get("gap_y", 2.0))
        app_type = data.get("application_type", "manual")
        orient_mode = data.get("orientation_mode", "auto_max")
        winding_scheme = int(data.get("winding_scheme", 1))

        layout = calculate_layout(
            label_width=label_w,
            label_height=label_h,
            bleed=bleed,
            roll_width=roll_w,
            printable_width=printable_w,
            meter_length=meter_l,
            gap_x=gap_x,
            gap_y=gap_y,
            application_type=app_type,
            orientation_mode=orient_mode,
            winding_scheme=winding_scheme
        )

        self.write({
            "layout": layout,
            "finat_schemes": FINAT_SCHEMES
        })

class ExportPdfHandler(BaseHandler):
    def post(self):
        data = json_decode(self.request.body)
        filename = data.get("filename")
        original_filename = data.get("original_filename")
        file_type = data.get("type", "sample")

        if file_type == "none" or not filename:
            src_path = None
        elif file_type == "upload":
            src_path = os.path.join(UPLOADS_DIR, filename)
        else:
            src_path = os.path.join(SAMPLES_DIR, filename)

        if src_path and not os.path.exists(src_path):
            self.set_status(404)
            self.write({"error": "Source file not found"})
            return

        layout = data.get("layout")
        if not layout:
            self.set_status(400)
            self.write({"error": "No layout provided"})
            return

        # Determine clean name like the uploaded file
        if original_filename:
            clean_name = original_filename
        elif src_path:
            clean_name = re.sub(r'^[a-f0-9]{8}_', '', os.path.basename(src_path))
        else:
            w = int(layout.get("params", {}).get("label_width", 50))
            h = int(layout.get("params", {}).get("label_height", 80))
            clean_name = f"спуск_висічки_{w}x{h}мм"

        base_no_ext = os.path.splitext(clean_name)[0]
        # Downloaded file name: exact file name with .pdf extension
        download_name = f"{base_no_ext}.pdf"

        # Unique file on disk to prevent concurrent collision
        disk_name = f"{uuid.uuid4().hex[:8]}_{download_name}"
        out_path = os.path.join(UPLOADS_DIR, disk_name)

        circulation = int(data.get("circulation") or 10000)
        waste = data.get("waste", "5")

        try:
            generate_imposition_pdf(
                source_file_path=src_path,
                layout_result=layout,
                output_pdf_path=out_path,
                original_filename=clean_name,
                add_eye_marks=data.get("add_eye_marks", True),
                add_cut_lines=data.get("add_cut_lines", True),
                add_info_banner=data.get("add_info_banner", True),
                include_cmyk_scale=data.get("include_cmyk_scale", True),
                add_print_direction=data.get("add_print_direction", True),
                sheet_number=data.get("sheet_number", 5),
                circulation=circulation,
                waste=waste
            )
            self.write({
                "download_url": f"/download/{disk_name}",
                "filename": download_name
            })
        except Exception as e:
            self.set_status(500)
            self.write({"error": f"PDF Export failed: {str(e)}"})

class DownloadHandler(tornado.web.StaticFileHandler):
    def set_extra_headers(self, path):
        fname = os.path.basename(path)
        clean_name = re.sub(r'^[a-f0-9]{8}_', '', fname)
        ascii_fallback = clean_name.encode('ascii', 'replace').decode('ascii')
        quoted_utf8 = urllib.parse.quote(clean_name)
        # Set Content-Disposition with RFC 5987 / RFC 6266 for UTF-8 Cyrillic file names
        disposition = f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{quoted_utf8}'
        self.set_header("Content-Disposition", disposition)

def make_app():
    return tornado.web.Application([
        (r"/", tornado.web.RedirectHandler, {"url": "/static/index.html"}),
        (r"/api/samples", SamplesHandler),
        (r"/api/upload", UploadHandler),
        (r"/api/inspect", InspectHandler),
        (r"/api/calculate", CalculateHandler),
        (r"/api/export_pdf", ExportPdfHandler),
        (r"/download/(.*)", DownloadHandler, {"path": UPLOADS_DIR}),
        (r"/static/(.*)", tornado.web.StaticFileHandler, {"path": STATIC_DIR}),
    ], debug=False)

if __name__ == "__main__":
    port = 8088
    app = make_app()
    app.listen(port)
    print(f"=== Roll-Fed Label Printing App started on http://localhost:{port} ===")
    tornado.ioloop.IOLoop.current().start()
