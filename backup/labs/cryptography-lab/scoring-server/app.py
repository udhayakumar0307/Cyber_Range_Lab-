#!/usr/bin/env python3
"""
Cryptography Lab — Cyber Range Scoring Server
Handles standalone Jinja2 template rendering, flag verification, and progress state.
"""

import os
import json
import sqlite3
import hashlib
from pathlib import Path
from datetime import datetime

from flask import Flask, render_template, request, jsonify, abort

app = Flask(__name__)

STUDENT_ID = os.environ.get("STUDENT_ID", "student")
LAB_SEED = os.environ.get("LAB_SEED", "defaultseed")
SERVICES_URL = os.environ.get("SERVICES_URL", "http://10.30.0.10:9500")
TERMINAL_WS_HOST = os.environ.get("TERMINAL_WS_HOST", "localhost")
TERMINAL_WS_PORT = os.environ.get("TERMINAL_WS_PORT", "8022")
RESET_SECRET = os.environ.get("RESET_SECRET", "instructor_reset_2026")

DATA_DIR = Path("/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "cyberrange_crypto.db"

CONFIG_PATH = Path(__file__).parent / "module_config.json"

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    CONFIG_DATA = json.load(f)

TRACKS_CONFIG = CONFIG_DATA.get("tracks", {})
TRACK_ORDER = list(TRACKS_CONFIG.keys())


def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            total_score INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
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
    cursor.execute("""
        INSERT INTO users (id, username, total_score)
        VALUES (?, ?, 0)
        ON CONFLICT(id) DO NOTHING
    """, (STUDENT_ID, STUDENT_ID))
    conn.commit()
    conn.close()


def generate_flag(student_id: str, track_id: str, module_id: str, lab_seed: str = LAB_SEED) -> list:
    raw1 = f"crypto_{track_id}_{module_id}_{student_id}_{lab_seed}"
    digest1 = hashlib.sha256(raw1.encode()).hexdigest()[:8]
    flag1 = f"FLAG{{crypto_{track_id}_{module_id}_{student_id}_{digest1}}}"

    raw2 = f"crypto_{module_id}_{student_id}_{lab_seed}"
    digest2 = hashlib.sha256(raw2.encode()).hexdigest()[:8]
    flag2 = f"FLAG{{crypto_{module_id}_{student_id}_{digest2}}}"

    return [flag1, flag2]


@app.route("/")
def index():
    user_id = request.headers.get("X-User-Id") or request.args.get("student_id") or STUDENT_ID
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT total_score FROM users WHERE id = ?", (user_id,))
    urow = cursor.fetchone()
    total_score = urow["total_score"] if urow else 0
    conn.close()

    tracks = []
    for tid in TRACK_ORDER:
        tcfg = TRACKS_CONFIG[tid]
        mod_dict = tcfg.get("modules", {})
        mod_keys = list(mod_dict.keys())
        modules = []
        for mid in mod_keys:
            mcfg = mod_dict[mid]
            modules.append({
                "id": mid,
                "track": tid,
                "full_id": f"{tid}_{mid}",
                "title": mcfg["title"],
                "phase": mcfg.get("phase"),
                "phase_title": mcfg.get("phase_title", ""),
                "difficulty": mcfg["difficulty"],
                "points": mcfg["points"],
                "story": mcfg.get("story", ""),
                "mission": mcfg.get("mission", ""),
                "objectives": mcfg.get("objectives", []),
                "hints": mcfg.get("hints", []),
                "solved": False,
                "unlocked": True,
            })
        tracks.append({
            "id": tid,
            "title": tcfg["title"],
            "subtitle": tcfg.get("subtitle", ""),
            "description": tcfg.get("description", ""),
            "difficulty": tcfg.get("difficulty", 1),
            "total_points": tcfg.get("total_points", 1000),
            "solved_count": 0,
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


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
