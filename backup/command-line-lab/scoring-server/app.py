#!/usr/bin/env python3
"""
Command Line Lab — Scoring Server
Validates flag submissions, serves the single-page lab UI (module list,
browser terminal, verify box), and renders module documentation.
"""

import os
import json
import hashlib
from pathlib import Path

import requests
import markdown as md
import jwt
from flask import Flask, render_template, request, jsonify, abort, session

SECRET_KEY = os.environ.get("SECRET_KEY", "cyber_range_secret_key_12345")
ALGORITHM = os.environ.get("ALGORITHM", "HS256")

app = Flask(__name__)
app.secret_key = SECRET_KEY

STUDENT_ID = os.environ.get("STUDENT_ID", "student")
LAB_SEED = os.environ.get("LAB_SEED", "defaultseed")
SERVICES_URL = os.environ.get("SERVICES_URL", "http://10.20.0.10:9500")
HINT_SERVICE_URL = os.environ.get("HINT_SERVICE_URL", "http://10.20.0.10:9600")
TERMINAL_WS_HOST = os.environ.get("TERMINAL_WS_HOST", "localhost")
TERMINAL_WS_PORT = os.environ.get("TERMINAL_WS_PORT", "8022")
RESET_SECRET = os.environ.get("RESET_SECRET", "instructor_reset_2026")

DATA_DIR = Path("/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
LEADERBOARD_FILE = DATA_DIR / "leaderboard.json"

MODULES_DIR = Path("/app/static/modules")
CONFIG_PATH = Path(__file__).parent / "module_config.json"

with open(CONFIG_PATH) as f:
    MODULE_CONFIG = json.load(f)["modules"]
MODULE_ORDER = list(MODULE_CONFIG.keys())

leaderboard = {}


# ── Deterministic flag generation — MUST match vulnerable-services/entrypoint.sh ──
def generate_flag(student_id: str, module_id: str, lab_seed: str = LAB_SEED) -> str:
    raw = f"cll_{module_id}_{student_id}_{lab_seed}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:8]
    return f"FLAG{{cll_{module_id}_{student_id}_{digest}}}"


def load_leaderboard():
    global leaderboard
    if LEADERBOARD_FILE.exists():
        try:
            leaderboard = json.loads(LEADERBOARD_FILE.read_text())
        except Exception:
            leaderboard = {}


def save_leaderboard():
    try:
        LEADERBOARD_FILE.write_text(json.dumps(leaderboard, indent=2))
    except Exception as e:
        print(f"[!] Could not save leaderboard: {e}")


def get_student(student_id):
    return leaderboard.setdefault(student_id, {"points": 0, "solved": {}})


@app.route("/")
def index():
    token = request.args.get("token") or request.cookies.get("access_token")
    student_id = session.get("student_id")
    
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            student_id = payload.get("sub")
            if student_id:
                session["student_id"] = student_id
                session["token"] = token
        except Exception as e:
            print(f"[!] JWT validation failed: {e}")

    if not student_id:
        return """
        <html>
            <head><title>Unauthorized</title></head>
            <body style="font-family: sans-serif; text-align: center; margin-top: 100px; background-color: #f8f9fa; color: #2d3436;">
                <h1 style="color: #e53e3e;">Unauthorized Access</h1>
                <p>Please log in to your CyberRange account to access this lab.</p>
                <a href="/login" style="color: #0052cc; text-decoration: none; font-weight: bold;">Go to Login</a>
            </body>
        </html>
        """, 401

    student = get_student(student_id)
    modules = []
    for mid in MODULE_ORDER:
        cfg = MODULE_CONFIG[mid]
        modules.append({
            "id": mid,
            "title": cfg["title"],
            "difficulty": cfg["difficulty"],
            "points": cfg["points"],
            "story": cfg["story"],
            "mission": cfg["mission"],
            "objectives": cfg["objectives"],
            "solved": mid in student["solved"],
            "track": cfg.get("track", "linux"),
        })
    return render_template(
        "index.html",
        student_id=student_id,
        total_points=student["points"],
        modules=modules,
        terminal_ws_host=TERMINAL_WS_HOST,
        terminal_ws_port=TERMINAL_WS_PORT,
    )


@app.route("/docs/<module_id>")
def view_docs(module_id):
    # Sanitize module_id to prevent directory traversal
    clean_id = os.path.basename(module_id)
    
    # If legacy module ID (e.g. module1), treat as linux_module1
    resolved_id = clean_id
    if resolved_id.startswith("module") and "_" not in resolved_id:
        resolved_id = "linux_" + resolved_id
        
    md_filename = "MODULE_" + resolved_id.replace("module", "") + ".md"
    md_path = MODULES_DIR / md_filename
    
    # Fallback to legacy file name (e.g., MODULE_1.md instead of MODULE_linux_1.md)
    if not md_path.exists() and "linux_" in md_filename:
        fallback_filename = md_filename.replace("linux_", "")
        md_path = MODULES_DIR / fallback_filename
        
    if not md_path.exists():
        abort(404)
        
    raw = md_path.read_text()
    html = md.markdown(raw, extensions=["fenced_code", "tables", "toc", "codehilite"])
    # Lightweight callout styling: lines like "> **Note:** ..." become styled boxes.
    for kind in ("Note", "Tip", "Warning"):
        html = html.replace(
            f"<blockquote>\n<p><strong>{kind}:</strong>",
            f'<blockquote class="callout callout-{kind.lower()}"><p><strong>{kind}:</strong>',
        )
    return render_template("view_md.html", module_id=module_id, content=html,
                            title=MODULE_CONFIG.get(module_id, {}).get("title", module_id))


@app.route("/api/progress/<module_id>")
def api_progress(module_id):
    student_id = session.get("student_id") or STUDENT_ID
    try:
        resp = requests.get(f"{SERVICES_URL}/progress/{student_id}/{module_id}", timeout=4)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/submit", methods=["POST"])
def api_submit():
    payload = request.get_json(force=True, silent=True) or {}
    student_id = session.get("student_id") or payload.get("student_id", STUDENT_ID)
    module_id = payload.get("module")
    submitted_flag = (payload.get("flag") or "").strip()

    if module_id not in MODULE_CONFIG:
        return jsonify({"correct": False, "message": "Unknown module."}), 400

    expected = generate_flag(STUDENT_ID, module_id)
    student = get_student(student_id)

    if module_id in student["solved"]:
        return jsonify({
            "correct": True, "message": "Already solved.",
            "points": 0, "total_points": student["points"],
        })

    # Resolve token for backend verification
    token = session.get("token") or request.cookies.get("access_token") or request.args.get("token")
    if not token and student_id:
        token = jwt.encode({"sub": student_id, "role": "user"}, SECRET_KEY, algorithm=ALGORITHM)

    backend_url = os.environ.get("CYBERRANGE_BACKEND_URL", "http://host.docker.internal:8000")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    if submitted_flag != expected:
        # Notify backend of a wrong flag submission for audit logging
        try:
            requests.post(
                f"{backend_url}/api/v1/reporting/submit-flag",
                json={
                    "lab_id": "command-line-lab",
                    "module_id": module_id,
                    "flag": submitted_flag,
                    "correct": False,
                    "client_ip": request.remote_addr,
                    "user_agent": request.headers.get("User-Agent", "")
                },
                headers=headers,
                timeout=4
            )
        except Exception as e:
            print(f"[!] Backend wrong flag log failed: {e}")

        return jsonify({"correct": False, "message": "That's not the right key for this module."})

    points = MODULE_CONFIG[module_id]["points"]

    # Post update to main CyberRange backend
    try:
        resp = requests.post(
            f"{backend_url}/api/v1/reporting/submit-flag",
            json={
                "lab_id": "command-line-lab",
                "module_id": module_id,
                "flag": submitted_flag,
                "correct": True,
                "client_ip": request.remote_addr,
                "user_agent": request.headers.get("User-Agent", "")
            },
            headers=headers,
            timeout=5
        )
        if resp.status_code != 200:
            try:
                err_msg = resp.json().get("detail", "Backend error")
            except Exception:
                err_msg = resp.text or "Backend error"
            return jsonify({"correct": False, "message": f"Failed to submit flag: {err_msg}"}), 400
    except Exception as e:
        print(f"[!] Backend update failed: {e}")
        return jsonify({"correct": False, "message": f"Connection to CyberRange core failed: {str(e)}"}), 502

    student["solved"][module_id] = True
    student["points"] += points
    save_leaderboard()

    return jsonify({
        "correct": True,
        "message": "Correct!",
        "points": points,
        "total_points": student["points"],
    })


@app.route("/status")
def status():
    student_id = session.get("student_id") or STUDENT_ID
    student = get_student(student_id)
    solved_keys = list(student.get("solved", {}).keys())
    
    linux_solved = sum(1 for m in solved_keys if m.startswith("linux_") or (m.startswith("module") and "_" not in m))
    python_solved = sum(1 for m in solved_keys if m.startswith("python_"))
    c_solved = sum(1 for m in solved_keys if m.startswith("c_"))
    cpp_solved = sum(1 for m in solved_keys if m.startswith("cpp_"))
    
    return jsonify({
        "student_id": STUDENT_ID,
        "points": student["points"],
        "solved": student["solved"],
        "progress": {
            "linux": f"{linux_solved}/5",
            "python": f"{python_solved}/5",
            "c": f"{c_solved}/5",
            "cpp": f"{cpp_solved}/5"
        }
    })


@app.route("/reset", methods=["POST"])
def reset():
    payload = request.get_json(force=True, silent=True) or {}
    if payload.get("secret") != RESET_SECRET:
        abort(403)
    student_id = session.get("student_id") or payload.get("student_id", STUDENT_ID)
    leaderboard[student_id] = {"points": 0, "solved": {}}
    save_leaderboard()
    return jsonify({"reset": True, "student_id": student_id})


load_leaderboard()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
