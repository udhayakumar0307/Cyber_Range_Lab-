#!/usr/bin/env python3
"""
OT Water Treatment Lab - Scoring Server
Validates flag submissions and maintains leaderboard
"""

import os
import json
from datetime import datetime
from pathlib import Path

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Expected flags for each module
MODULE_FLAGS = {
    1:  {"flag": "172.28.0.10",  "points": 100, "title": "Network Recon"},
    2:  {"flag": "3",            "points": 100, "title": "Protocol Identification"},
    3:  {"flag": "31337",        "points": 150, "title": "Register Mapping"},
    4:  {"flag": "5",            "points": 200, "title": "Pump Manipulation"},
    5:  {"flag": "99",           "points": 200, "title": "Emergency Shutdown"},
    6:  {"flag": "2",            "points": 250, "title": "Chemical Dosing Sabotage"},
    7:  {"flag": "0x06",         "points": 250, "title": "Stealthy Register Tampering"},
    8:  {"flag": "2",            "points": 200, "title": "Intrusion Detection (Coils)"},
    9:  {"flag": "7",            "points": 200, "title": "Intrusion Detection (Registers)"},
    10: {"flag": "0_45_40",      "points": 350, "title": "Incident Response"},
}

# Persistent storage
DATA_DIR = Path("/data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
LEADERBOARD_FILE = DATA_DIR / "leaderboard.json"

leaderboard = {}
submissions = []


def load_leaderboard():
    global leaderboard, submissions
    if LEADERBOARD_FILE.exists():
        try:
            with open(LEADERBOARD_FILE, 'r') as f:
                data = json.load(f)
                leaderboard = data.get("leaderboard", {})
                submissions = data.get("submissions", [])
        except Exception:
            pass


def save_leaderboard():
    try:
        with open(LEADERBOARD_FILE, 'w') as f:
            json.dump({"leaderboard": leaderboard, "submissions": submissions}, f, indent=2)
    except Exception as e:
        print(f"Error saving: {e}")


@app.route('/')
def index():
    return render_template('index.html',
                         modules=MODULE_FLAGS,
                         leaderboard=sorted(leaderboard.items(),
                                          key=lambda x: x[1].get('points', 0),
                                          reverse=True))


@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})


@app.route('/api/submit-flag', methods=['POST'])
def submit_flag():
    data = request.get_json()
    student_id = data.get('student_id', '').strip()
    module = int(data.get('module', 0))
    submitted_flag = data.get('flag', '').strip()

    if not student_id:
        return jsonify({"status": "error", "message": "student_id required"}), 400
    if module not in MODULE_FLAGS:
        return jsonify({"status": "error", "message": f"Invalid module: {module}"}), 400
    if not submitted_flag:
        return jsonify({"status": "error", "message": "flag required"}), 400

    expected = MODULE_FLAGS[module]
    is_correct = submitted_flag.lower().strip() == expected["flag"].lower().strip()

    submission = {
        "timestamp": datetime.now().isoformat(),
        "student_id": student_id,
        "module": module,
        "correct": is_correct
    }
    submissions.append(submission)

    if is_correct:
        if student_id not in leaderboard:
            leaderboard[student_id] = {"points": 0, "solved": {}}

        mod_key = f"M{module}"
        if mod_key not in leaderboard[student_id]["solved"]:
            leaderboard[student_id]["points"] += expected["points"]
            leaderboard[student_id]["solved"][mod_key] = {
                "points": expected["points"],
                "timestamp": datetime.now().isoformat(),
                "title": expected["title"]
            }
            save_leaderboard()
            return jsonify({
                "status": "success",
                "message": f"Correct! +{expected['points']} points",
                "points_earned": expected["points"],
                "total_points": leaderboard[student_id]["points"]
            })
        else:
            return jsonify({
                "status": "already_solved",
                "message": "You already solved this module."
            })
    else:
        save_leaderboard()
        return jsonify({
            "status": "incorrect",
            "message": "Wrong flag. Try again!"
        })


@app.route('/api/leaderboard')
def get_leaderboard():
    sorted_teams = sorted(leaderboard.items(),
                         key=lambda x: x[1].get('points', 0), reverse=True)
    return jsonify({
        "leaderboard": [
            {
                "rank": i + 1,
                "student_id": sid,
                "points": data.get('points', 0),
                "flags_captured": len(data.get('solved', {}))
            }
            for i, (sid, data) in enumerate(sorted_teams)
        ]
    })


@app.route('/api/reset', methods=['POST'])
def reset():
    data = request.get_json() or {}
    if data.get('secret') != 'instructor_reset_2024':
        return jsonify({"error": "Invalid reset secret"}), 403
    global leaderboard, submissions
    leaderboard = {}
    submissions = []
    save_leaderboard()
    return jsonify({"status": "reset complete"})


if __name__ == '__main__':
    load_leaderboard()
    app.run(host='0.0.0.0', port=5000, debug=False)
