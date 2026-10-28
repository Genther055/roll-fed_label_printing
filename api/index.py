import os
import sys
import uuid
import re
import urllib.parse
from flask import Flask, request, jsonify, send_file

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.pdf_inspector import inspect_file
from core.layout_engine import calculate_layout, FINAT_SCHEMES
from core.pdf_imposer import generate_imposition_pdf

def get_static_folder():
    for candidate in [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static"),
        os.path.join(os.getcwd(), "static"),
        os.path.join(os.getcwd(), "public", "static"),
        "/var/task/api/static",
        "/var/task/static",
    ]:
        if os.path.exists(candidate) and os.path.isdir(candidate):
            return candidate
    return os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=get_static_folder(), static_url_path="/static")

class VercelPathMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched = environ.get("HTTP_X_MATCHED_PATH")
        query = environ.get("QUERY_STRING", "")
        if "__path__=" in query:
            qs = urllib.parse.parse_qs(query)
            if "__path__" in qs and qs["__path__"]:
                matched = qs["__path__"][0]

        if matched and matched not in ("/api/index.py", "/api/index"):
            environ["PATH_INFO"] = matched
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

def find_dir(name):
    for root in [
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        os.path.dirname(os.path.abspath(__file__)),
        os.getcwd(),
        "/var/task"
    ]:
        p = os.path.join(root, name)
        if os.path.exists(p) and os.path.isdir(p):
            return p
    return os.path.join(BASE_DIR, name)

SAMPLES_DIR = find_dir("samples")

# Vercel serverless has a read-only filesystem except /tmp
if os.environ.get("VERCEL") or not os.access(os.path.join(BASE_DIR, "uploads"), os.W_OK):
    UPLOADS_DIR = os.path.join("/tmp", "uploads")
else:
    UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

os.makedirs(UPLOADS_DIR, exist_ok=True)
SUPPORTED_EXTS = (".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp")

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, x-requested-with"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route("/", methods=["GET"])
@app.route("/index.html", methods=["GET"])
def index():
    for candidate in [
        os.path.join(BASE_DIR, "public", "index.html"),
        os.path.join(BASE_DIR, "index.html"),
        os.path.join(BASE_DIR, "static", "index.html"),
        os.path.join(os.getcwd(), "public", "index.html"),
        os.path.join(os.getcwd(), "index.html"),
    ]:
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return send_file(candidate, mimetype="text/html")
    return "ROLL-PRINT CAD is running."

@app.route("/api/samples", methods=["GET"])
@app.route("/samples", methods=["GET"])
def api_samples():
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
    return jsonify({"samples": samples})

@app.route("/api/upload", methods=["POST"])
@app.route("/upload", methods=["POST"])
def api_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file_item = request.files["file"]
    filename = file_item.filename
    unique_name = f"{uuid.uuid4().hex[:8]}_{filename}"
    fpath = os.path.join(UPLOADS_DIR, unique_name)
    file_item.save(fpath)

    try:
        info = inspect_file(fpath)
        return jsonify({
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
        return jsonify({"error": f"Failed to inspect file: {str(e)}"}), 500

@app.route("/api/inspect", methods=["POST"])
@app.route("/inspect", methods=["POST"])
def api_inspect():
    data = request.get_json(force=True, silent=True) or {}
    filename = data.get("filename")
    file_type = data.get("type", "sample")

    if file_type == "upload":
        fpath = os.path.join(UPLOADS_DIR, filename)
    else:
        fpath = os.path.join(SAMPLES_DIR, filename)

    if not os.path.exists(fpath):
        return jsonify({"error": "File not found"}), 404

    try:
        info = inspect_file(fpath)
        return jsonify(info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/calculate", methods=["POST"])
@app.route("/calculate", methods=["POST"])
def api_calculate():
    data = request.get_json(force=True, silent=True) or {}

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

    return jsonify({
        "layout": layout,
        "finat_schemes": FINAT_SCHEMES
    })

@app.route("/api/export_pdf", methods=["POST"])
@app.route("/export_pdf", methods=["POST"])
def api_export_pdf():
    data = request.get_json(force=True, silent=True) or {}
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
        return jsonify({"error": "Source file not found"}), 404

    layout = data.get("layout")
    if not layout:
        return jsonify({"error": "No layout provided"}), 400

    if original_filename:
        clean_name = original_filename
    elif src_path:
        clean_name = re.sub(r'^[a-f0-9]{8}_', '', os.path.basename(src_path))
    else:
        w = int(layout.get("params", {}).get("label_width", 50))
        h = int(layout.get("params", {}).get("label_height", 80))
        clean_name = f"спуск_висічки_{w}x{h}мм"

    base_no_ext = os.path.splitext(clean_name)[0]
    download_name = f"{base_no_ext}.pdf"
    disk_name = f"{uuid.uuid4().hex[:8]}_{download_name}"
    out_path = os.path.join(UPLOADS_DIR, disk_name)

    circulation = int(data.get("circulation") or 10000)
    waste = data.get("waste", "5")

    try:
        pdf_bytes = generate_imposition_pdf(
            source_file_path=src_path,
            layout_result=layout,
            output_pdf_path=None,
            original_filename=clean_name,
            add_eye_marks=data.get("add_eye_marks", True),
            add_cut_lines=data.get("add_cut_lines", True),
            add_info_banner=data.get("add_info_banner", True),
            include_cmyk_scale=data.get("include_cmyk_scale", True),
            add_print_direction=False,
            sheet_number=data.get("sheet_number", 5),
            circulation=circulation,
            waste=waste
        )
        response = Response(pdf_bytes, mimetype="application/pdf")
        ascii_fallback = download_name.encode('ascii', 'replace').decode('ascii')
        quoted_utf8 = urllib.parse.quote(download_name)
        response.headers["Content-Disposition"] = f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{quoted_utf8}'
        response.headers["Content-Length"] = str(len(pdf_bytes))
        response.headers["Cache-Control"] = "no-cache"
        response.headers["X-Filename"] = quoted_utf8
        return response
    except Exception as e:
        return jsonify({"error": f"PDF Export failed: {str(e)}"}), 500

@app.route("/download/<path:filename>", methods=["GET"])
@app.route("/api/download/<path:filename>", methods=["GET"])
def api_download(filename):
    fpath = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(fpath):
        return jsonify({"error": "File not found"}), 404

    clean_name = re.sub(r'^[a-f0-9]{8}_', '', filename)
    ascii_fallback = clean_name.encode('ascii', 'replace').decode('ascii')
    quoted_utf8 = urllib.parse.quote(clean_name)
    disposition = f'attachment; filename="{ascii_fallback}"; filename*=UTF-8\'\'{quoted_utf8}'

    response = send_file(fpath, mimetype="application/pdf", as_attachment=True, download_name=clean_name)
    response.headers["Content-Disposition"] = disposition
    return response

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Not Found",
        "path": request.path,
        "full_path": request.full_path,
        "url": request.url,
        "environ_path_info": request.environ.get("PATH_INFO"),
        "environ_request_uri": request.environ.get("REQUEST_URI"),
    }), 404
