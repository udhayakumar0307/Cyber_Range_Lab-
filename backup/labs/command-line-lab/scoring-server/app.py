#!/usr/bin/env python3
"""
Command Line Lab & Cyber Range — Multi-Track Scoring Server
Uses existing database architecture with `users` table and `user_progress` table.
Guarantees server-authoritative scoring, objective verification, transactional integrity,
hint penalty persistence, and progress restoration after login.
"""

import os
import json
import sqlite3
import hashlib
from pathlib import Path
from datetime import datetime

import requests
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
DB_PATH = DATA_DIR / "cyberrange.db"
LEADERBOARD_FILE = DATA_DIR / "leaderboard.json"

CONFIG_PATH = Path(__file__).parent / "module_config.json"

with open(CONFIG_PATH) as f:
    CONFIG_DATA = json.load(f)

TRACKS_CONFIG = CONFIG_DATA.get("tracks", {})
TRACK_ORDER = list(TRACKS_CONFIG.keys())


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Audit and reuse existing users table, add total_score if missing, create user_progress."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Reuse or create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            total_score INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Check if total_score column exists on users table
    cursor.execute("PRAGMA table_info(users)")
    columns = [row["name"] for row in cursor.fetchall()]
    if "total_score" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN total_score INTEGER DEFAULT 0")

    # 2. Create user_progress table with user_id Foreign Key
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            track_id TEXT NOT NULL,
            module_id TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            module_score INTEGER DEFAULT 0,
            hint1_used BOOLEAN DEFAULT FALSE,
            hint2_used BOOLEAN DEFAULT FALSE,
            flag_submitted TEXT,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, track_id, module_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Ensure default STUDENT_ID exists in users table
    cursor.execute("""
        INSERT INTO users (id, username, total_score)
        VALUES (?, ?, 0)
        ON CONFLICT(id) DO NOTHING
    """, (STUDENT_ID, STUDENT_ID))

    conn.commit()
    conn.close()


def ensure_user_exists(user_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO users (id, username, total_score) VALUES (?, ?, 0) ON CONFLICT(id) DO NOTHING", (user_id, user_id))
    conn.commit()
    conn.close()


def generate_flag(student_id: str, track_id: str, module_id: str, lab_seed: str = LAB_SEED) -> list:
    raw1 = f"cll_{track_id}_{module_id}_{student_id}_{lab_seed}"
    digest1 = hashlib.sha256(raw1.encode()).hexdigest()[:8]
    flag1 = f"FLAG{{cll_{track_id}_{module_id}_{student_id}_{digest1}}}"

    raw2 = f"cll_{module_id}_{student_id}_{lab_seed}"
    digest2 = hashlib.sha256(raw2.encode()).hexdigest()[:8]
    flag2 = f"FLAG{{cll_{module_id}_{student_id}_{digest2}}}"

    return [flag1, flag2]


def reconcile_user_score(conn, user_id: str) -> int:
    """
    Consistency Check: users.total_score = SUM(completed module scores) - SUM(hints on incomplete modules)
    Clamped to minimum 0.
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN completed THEN module_score ELSE 0 END), 0) AS solved_score,
            COALESCE(SUM(CASE WHEN NOT completed AND hint1_used THEN 20 ELSE 0 END), 0) +
            COALESCE(SUM(CASE WHEN NOT completed AND hint2_used THEN 20 ELSE 0 END), 0) AS hint_penalties
        FROM user_progress
        WHERE user_id = ?
    """, (user_id,))
    row = cursor.fetchone()
    solved_score = row["solved_score"] if row else 0
    hint_penalties = row["hint_penalties"] if row else 0

    total_score = max(0, solved_score - hint_penalties)

    cursor.execute("UPDATE users SET total_score = ? WHERE id = ?", (total_score, user_id))
    return total_score


@app.route("/")
def index():
    user_id = request.headers.get("X-User-Id") or request.args.get("student_id") or STUDENT_ID
    ensure_user_exists(user_id)

    conn = get_db()
    cursor = conn.cursor()

    # Ensure score consistency
    total_score = reconcile_user_score(conn, user_id)
    conn.commit()

    # Load user progress from database
    cursor.execute("SELECT * FROM user_progress WHERE user_id = ?", (user_id,))
    progress_rows = cursor.fetchall()
    conn.close()

    user_solved = {}
    user_hints = {}

    for row in progress_rows:
        tid = row["track_id"]
        mid = row["module_id"]
        full_key = f"{tid}_{mid}"
        if row["completed"]:
            user_solved[full_key] = True
        if row["hint1_used"]:
            user_hints[f"{tid}_{mid}_hint1"] = True
        if row["hint2_used"]:
            user_hints[f"{tid}_{mid}_hint2"] = True

    tracks = []
    for tid in TRACK_ORDER:
        tcfg = TRACKS_CONFIG[tid]
        mod_dict = tcfg.get("modules", {})
        mod_keys = list(mod_dict.keys())

        modules = []
        unlocked = True
        solved_count = 0

        for mid in mod_keys:
            mcfg = mod_dict[mid]
            full_key = f"{tid}_{mid}"
            is_solved = full_key in user_solved
            if is_solved:
                solved_count += 1

            modules.append({
                "id": mid,
                "track": tid,
                "full_id": full_key,
                "title": mcfg["title"],
                "difficulty": mcfg["difficulty"],
                "points": mcfg["points"],
                "story": mcfg["story"],
                "mission": mcfg["mission"],
                "objectives": mcfg["objectives"],
                "hints": mcfg.get("hints", []),
                "solved": is_solved,
                "unlocked": unlocked,
            })
            unlocked = is_solved

        tracks.append({
            "id": tid,
            "title": tcfg["title"],
            "subtitle": tcfg.get("subtitle", ""),
            "description": tcfg["description"],
            "difficulty": tcfg["difficulty"],
            "total_points": tcfg.get("total_points", 1000),
            "solved_count": solved_count,
            "total_modules": len(mod_keys),
            "modules": modules,
        })

    return render_template(
        "index.html",
        student_id=user_id,
        total_points=total_score,
        tracks=tracks,
        tracks_json=tracks,
        terminal_ws_host=TERMINAL_WS_HOST,
        terminal_ws_port=TERMINAL_WS_PORT,
    )


@app.route("/api/progress/<track_id>/<module_id>")
@app.route("/api/progress/<module_id>")
def api_progress(module_id, track_id=None):
    if not track_id:
        track_id = "linux"

    user_id = request.headers.get("X-User-Id") or request.args.get("student_id") or STUDENT_ID
    ensure_user_exists(user_id)

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg:
        return jsonify({"error": "Unknown track"}), 404

    mod_keys = list(tcfg["modules"].keys())
    idx = mod_keys.index(module_id) if module_id in mod_keys else -1

    conn = get_db()
    cursor = conn.cursor()

    if idx > 0:
        prev_mid = mod_keys[idx - 1]
        cursor.execute("SELECT completed FROM user_progress WHERE user_id = ? AND track_id = ? AND module_id = ?", (user_id, track_id, prev_mid))
        row = cursor.fetchone()
        if not row or not row["completed"]:
            conn.close()
            return jsonify({"error": "Module locked"}), 403

    conn.close()

    try:
        resp = requests.get(f"{SERVICES_URL}/progress/{user_id}/{track_id}/{module_id}", timeout=2)
        return jsonify(resp.json())
    except Exception:
        return jsonify({"objectives": tcfg["modules"][module_id]["objectives"]})


@app.route("/api/hint", methods=["POST"])
def api_hint():
    payload = request.get_json(force=True, silent=True) or {}
    user_id = request.headers.get("X-User-Id") or payload.get("user_id") or payload.get("student_id") or STUDENT_ID
    ensure_user_exists(user_id)

    track_id = payload.get("track", "linux")
    module_id = payload.get("module", "module1")
    hint_index = int(payload.get("hint_index", 1))

    if hint_index not in (1, 2):
        return jsonify({"error": "Invalid hint index. Must be 1 or 2."}), 400

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg["modules"]:
        return jsonify({"error": "Unknown track or module."}), 400

    mcfg = tcfg["modules"][module_id]
    hints = mcfg.get("hints", [])
    if len(hints) < hint_index:
        return jsonify({"error": "Hint not available."}), 404

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM user_progress WHERE user_id = ? AND track_id = ? AND module_id = ?", (user_id, track_id, module_id))
    row = cursor.fetchone()

    hint1_used = row["hint1_used"] if row else False
    hint2_used = row["hint2_used"] if row else False

    if hint_index == 2 and not hint1_used:
        conn.close()
        return jsonify({"error": "Unlock Hint 1 first before unlocking Hint 2."}), 403

    already_unlocked = bool((hint_index == 1 and hint1_used) or (hint_index == 2 and hint2_used))

    if not already_unlocked:
        try:
            conn.execute("BEGIN TRANSACTION")
            if hint_index == 1:
                hint1_used = True
            elif hint_index == 2:
                hint2_used = True

            cursor.execute("""
                INSERT INTO user_progress (user_id, track_id, module_id, hint1_used, hint2_used, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, track_id, module_id) DO UPDATE SET
                    hint1_used = excluded.hint1_used,
                    hint2_used = excluded.hint2_used,
                    updated_at = CURRENT_TIMESTAMP
            """, (user_id, track_id, module_id, hint1_used, hint2_used))

            total_score = reconcile_user_score(conn, user_id)
            conn.commit()
        except Exception as e:
            conn.rollback()
            conn.close()
            return jsonify({"error": f"Database transaction failed: {e}"}), 500
    else:
        cursor.execute("SELECT total_score FROM users WHERE id = ?", (user_id,))
        urow = cursor.fetchone()
        total_score = urow["total_score"] if urow else 0

    conn.close()

    return jsonify({
        "success": True,
        "hint": hints[hint_index - 1],
        "hint_index": hint_index,
        "penalty": 0 if already_unlocked else 20,
        "already_unlocked": bool(already_unlocked),
        "total_points": total_score,
    })


@app.route("/api/submit", methods=["POST"])
def api_submit():
    payload = request.get_json(force=True, silent=True) or {}
    user_id = request.headers.get("X-User-Id") or payload.get("user_id") or payload.get("student_id") or STUDENT_ID
    ensure_user_exists(user_id)

    track_id = payload.get("track", "linux")
    module_id = payload.get("module")
    submitted_flag = (payload.get("flag") or "").strip()

    if not module_id or not track_id:
        return jsonify({"correct": False, "message": "Missing track or module."}), 400

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg["modules"]:
        return jsonify({"correct": False, "message": "Unknown track or module."}), 400

    mod_keys = list(tcfg["modules"].keys())
    idx = mod_keys.index(module_id)
    next_module_id = mod_keys[idx + 1] if (idx + 1) < len(mod_keys) else None

    conn = get_db()
    cursor = conn.cursor()

    if idx > 0:
        prev_mid = mod_keys[idx - 1]
        cursor.execute("SELECT completed FROM user_progress WHERE user_id = ? AND track_id = ? AND module_id = ?", (user_id, track_id, prev_mid))
        row = cursor.fetchone()
        if not row or not row["completed"]:
            conn.close()
            return jsonify({"correct": False, "message": "Module is locked. Complete previous module first."}), 403

    cursor.execute("SELECT * FROM user_progress WHERE user_id = ? AND track_id = ? AND module_id = ?", (user_id, track_id, module_id))
    row = cursor.fetchone()

    cursor.execute("SELECT total_score FROM users WHERE id = ?", (user_id,))
    urow = cursor.fetchone()
    current_total_score = urow["total_score"] if urow else 0

    if row and row["completed"]:
        conn.close()
        return jsonify({
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total_score,
            "next_module": next_module_id,
        })

    # Objective validation check
    try:
        prog_resp = requests.get(f"{SERVICES_URL}/progress/{user_id}/{track_id}/{module_id}", timeout=2)
        prog_data = prog_resp.json()
        if not prog_data.get("module_complete", False):
            conn.close()
            return jsonify({
                "correct": False,
                "message": "Complete all required objectives before submitting the flag."
            })
    except Exception as e:
        print(f"[!] Warning: Progress service check failed: {e}")

    valid_flags = generate_flag(user_id, track_id, module_id)
    if submitted_flag not in valid_flags:
        conn.close()
        return jsonify({"correct": False, "message": "That's not the right key for this module."})

    base_points = tcfg["modules"][module_id]["points"]
    hint1_used = row["hint1_used"] if row else False
    hint2_used = row["hint2_used"] if row else False
    penalties = (20 if hint1_used else 0) + (20 if hint2_used else 0)
    earned_module_score = max(0, base_points - penalties)

    try:
        conn.execute("BEGIN TRANSACTION")
        cursor.execute("""
            INSERT INTO user_progress (user_id, track_id, module_id, completed, module_score, flag_submitted, completed_at, updated_at)
            VALUES (?, ?, ?, TRUE, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, track_id, module_id) DO UPDATE SET
                completed = TRUE,
                module_score = excluded.module_score,
                flag_submitted = excluded.flag_submitted,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, track_id, module_id, earned_module_score, submitted_flag))

        new_total_score = reconcile_user_score(conn, user_id)
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"correct": False, "message": f"Database transaction error: {e}"}), 500

    conn.close()

    return jsonify({
        "correct": True,
        "message": "Correct! Next module unlocked.",
        "points": earned_module_score,
        "total_points": new_total_score,
        "next_module": next_module_id,
        "track": track_id,
    })


@app.route("/api/leaderboard")
def api_leaderboard():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, total_score FROM users ORDER BY total_score DESC")
    rows = cursor.fetchall()
    conn.close()
    return jsonify([{"user_id": r["id"], "username": r["username"], "total_score": r["total_score"]} for r in rows])


@app.route("/status")
def status():
    user_id = request.headers.get("X-User-Id") or request.args.get("student_id") or STUDENT_ID
    ensure_user_exists(user_id)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT total_score FROM users WHERE id = ?", (user_id,))
    urow = cursor.fetchone()
    total_score = urow["total_score"] if urow else 0

    cursor.execute("SELECT track_id, module_id, completed, module_score FROM user_progress WHERE user_id = ?", (user_id,))
    rows = cursor.fetchall()
    conn.close()

    solved_map = {f"{r['track_id']}_{r['module_id']}": r["module_score"] for r in rows if r["completed"]}
    return jsonify({"user_id": user_id, "total_score": total_score, "solved": solved_map})


@app.route("/reset", methods=["POST"])
def reset():
    payload = request.get_json(force=True, silent=True) or {}
    if payload.get("secret") != RESET_SECRET:
        abort(403)
    user_id = payload.get("user_id") or payload.get("student_id") or STUDENT_ID

    conn = get_db()
    cursor = conn.cursor()
    try:
        conn.execute("BEGIN TRANSACTION")
        cursor.execute("DELETE FROM user_progress WHERE user_id = ?", (user_id,))
        cursor.execute("UPDATE users SET total_score = 0 WHERE id = ?", (user_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"reset": False, "error": str(e)}), 500

    conn.close()
    return jsonify({"reset": True, "user_id": user_id})


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
