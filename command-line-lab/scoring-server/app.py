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
from flask import Flask, render_template, request, jsonify, abort

app = Flask(__name__)

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
    student = get_student(STUDENT_ID)
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
        })
    return render_template(
        "index.html",
        student_id=STUDENT_ID,
        total_points=student["points"],
        modules=modules,
        terminal_ws_host=TERMINAL_WS_HOST,
        terminal_ws_port=TERMINAL_WS_PORT,
    )


@app.route("/docs/<module_id>")
def view_docs(module_id):
    md_filename = "MODULE_" + module_id.replace("module", "") + ".md"
    md_path = MODULES_DIR / md_filename
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
    try:
        resp = requests.get(f"{SERVICES_URL}/progress/{STUDENT_ID}/{module_id}", timeout=4)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/submit", methods=["POST"])
def api_submit():
    payload = request.get_json(force=True, silent=True) or {}
    student_id = payload.get("student_id", STUDENT_ID)
    module_id = payload.get("module")
    submitted_flag = (payload.get("flag") or "").strip()

    if module_id not in MODULE_CONFIG:
        return jsonify({"correct": False, "message": "Unknown module."}), 400

    expected = generate_flag(student_id, module_id)
    student = get_student(student_id)

    if module_id in student["solved"]:
        return jsonify({
            "correct": True, "message": "Already solved.",
            "points": 0, "total_points": student["points"],
        })

    if submitted_flag != expected:
        return jsonify({"correct": False, "message": "That's not the right key for this module."})

    points = MODULE_CONFIG[module_id]["points"]
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
    student = get_student(STUDENT_ID)
    return jsonify({"student_id": STUDENT_ID, "points": student["points"], "solved": student["solved"]})


@app.route("/reset", methods=["POST"])
def reset():
    payload = request.get_json(force=True, silent=True) or {}
    if payload.get("secret") != RESET_SECRET:
        abort(403)
    student_id = payload.get("student_id", STUDENT_ID)
    leaderboard[student_id] = {"points": 0, "solved": {}}
    save_leaderboard()
    return jsonify({"reset": True, "student_id": student_id})


load_leaderboard()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
