#!/usr/bin/env python3
"""
OT Railroad North Lab - Scoring Server
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
    1:  {"flag": "172.25.0.10",                   "points": 100, "title": "Network Recon"},
    2:  {"flag": "502",                            "points": 100, "title": "Protocol Identification"},
    3:  {"flag": "4",                              "points": 150, "title": "API Endpoint Discovery"},
    4:  {"flag": "ROUTE_C",                        "points": 200, "title": "Unauthorized Track Switch"},
    5:  {"flag": "dynamic_gte_50",                 "points": 200, "title": "Alarm Flooding"},
    6:  {"flag": "Conflicting routes at junction", "points": 300, "title": "Safety Interlock Bypass"},
    7:  {"flag": "Invalid route: ROUTE_XYZ",       "points": 300, "title": "API Fuzzing"},
    8:  {"flag": "segment_id",                     "points": 250, "title": "Packet Capture Analysis"},
    9:  {"flag": "emergency_cleared",              "points": 200, "title": "Emergency Recovery"},
    10: {"flag": "FLAG{modbus_master_pwned}",      "points": 400, "title": "Deep Memory Forensics"},
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


def validate_flag(module, submitted):
    """Custom validation that handles dynamic flags"""
    expected = MODULE_FLAGS.get(module)
    if not expected:
        return False

    if expected["flag"] == "dynamic_gte_50":
        # Module 5: accept any integer >= 50
        try:
            return int(submitted) >= 50
        except ValueError:
            return False

    return submitted.lower().strip() == expected["flag"].lower().strip()


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

    is_correct = validate_flag(module, submitted_flag)

    submission = {
        "timestamp": datetime.now().isoformat(),
        "student_id": student_id,
        "module": module,
        "correct": is_correct
    }
    submissions.append(submission)

    if is_correct:
        expected = MODULE_FLAGS[module]
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
