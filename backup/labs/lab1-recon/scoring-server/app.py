#!/usr/bin/env python3
"""
TechCorp Lab Scoring Server
Validates flag submissions and maintains leaderboard
"""

import os
import sys
import json
import hashlib
from datetime import datetime
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_file, abort

app = Flask(__name__)

# Configuration
SCORING_DATABASE = Path("/app/data/scoring.db")
SCORING_DATABASE.parent.mkdir(parents=True, exist_ok=True)

# Shared flag generation (same as target container)
def generate_flag(student_id: str, lab: int, module: int, lab_seed: str = "defaultseed") -> str:
    """
    Generate a deterministic flag for a specific student, lab, and module
    MUST match the target container's algorithm exactly
    """
    raw_input = f"lab{lab}_mod{module}_{student_id}_{lab_seed}"
    hash_digest = hashlib.sha256(raw_input.encode()).hexdigest()[:8]
    flag = f"FLAG{{techcorp_lab{lab}_mod{module}_{student_id}_{hash_digest}}}"
    return flag


# In-memory leaderboard (replace with DB for production)
leaderboard = {}
submissions = []


def load_leaderboard():
    """Load leaderboard from disk if it exists"""
    global leaderboard, submissions
    db_file = SCORING_DATABASE.parent / "leaderboard.json"
    if db_file.exists():
        try:
            with open(db_file, 'r') as f:
                data = json.load(f)
                leaderboard = data.get("leaderboard", {})
                submissions = data.get("submissions", [])
        except:
            pass


def save_leaderboard():
    """Save leaderboard to disk"""
    db_file = SCORING_DATABASE.parent / "leaderboard.json"
    try:
        with open(db_file, 'w') as f:
            json.dump({"leaderboard": leaderboard, "submissions": submissions}, f, indent=2)
    except Exception as e:
        print(f"[!] Error saving leaderboard: {e}", file=sys.stderr)


@app.route('/')
def index():
    """Main dashboard page - shows individual student's progress"""
    student_id = os.environ.get('STUDENT_ID', 'student')
    
    # Get this student's data
    student_data = leaderboard.get(student_id, {
        'points': 0,
        'solved': {}
    })
    
    # Build scores object for template
    scores = {
        'total_points': student_data.get('points', 0),
        'solved': student_data.get('solved', {})
    }
    
    return render_template('index.html', 
                         student_id=student_id,
                         scores=scores)


@app.route('/api/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})


@app.route('/api/submit-flag', methods=['POST'])
def submit_flag():
    """
    Submit a flag for validation
    
    Request JSON:
    {
        "student_id": "alice",
        "lab": 1,
        "module": 1,
        "submitted_flag": "FLAG{...}",
        "lab_seed": "defaultseed"  (optional)
    }
    """
    try:
        data = request.get_json()
        
        student_id = data.get('student_id', '').strip()
        lab = int(data.get('lab', 1))
        module = int(data.get('module', 1))
        submitted_flag = data.get('submitted_flag', '').strip()
        lab_seed = data.get('lab_seed', os.environ.get('LAB_SEED', 'defaultseed'))
        
        # Validation
        if not student_id:
            return jsonify({"status": "error", "message": "student_id required"}), 400
        if not submitted_flag:
            return jsonify({"status": "error", "message": "submitted_flag required"}), 400
        
        # Generate expected flag
        expected_flag = generate_flag(student_id, lab, module, lab_seed)
        
        # Check if correct
        is_correct = submitted_flag == expected_flag
        
        # Record submission
        submission = {
            "timestamp": datetime.now().isoformat(),
            "student_id": student_id,
            "lab": lab,
            "module": module,
            "submitted": submitted_flag,
            "expected": expected_flag,
            "correct": is_correct
        }
        submissions.append(submission)
        save_leaderboard()
        
        if is_correct:
            # Calculate points (100 base per flag)
            points = 100
            
            # Speed bonus: first 10% of class to submit gets +25 pts
            student_submissions = [s for s in submissions if s['student_id'] == student_id and s['correct']]
            if len(student_submissions) == 1:  # First correct flag for this student
                points += 10  # Small bonus for early submission
            
            # Update leaderboard
            if student_id not in leaderboard:
                leaderboard[student_id] = {
                    "points": 0,
                    "solved": {},
                    "first_submit": datetime.now().isoformat()
                }
            
            # Record this flag as solved with metadata
            mod_id = f"L{lab}M{module}"
            leaderboard[student_id]["points"] += points
            leaderboard[student_id]["solved"][mod_id] = {
                "points": points,
                "timestamp": datetime.now().isoformat(),
                "attempts": len([s for s in submissions if s['student_id'] == student_id and s['lab'] == lab and s['module'] == module])
            }
            leaderboard[student_id]["last_submit"] = datetime.now().isoformat()
            
            save_leaderboard()
            
            return jsonify({
                "status": "success",
                "message": "Flag correct!",
                "points_earned": points,
                "total_points": leaderboard[student_id]["points"],
                "flags_captured": len(leaderboard[student_id]["solved"])
            })
        else:
            return jsonify({
                "status": "incorrect",
                "message": "Flag incorrect. Try again!",
                "hint": f"Make sure you have the exact flag for Lab {lab} Module {module}"
            })
    
    except ValueError as e:
        return jsonify({"status": "error", "message": f"Invalid input: {str(e)}"}), 400
    except Exception as e:
        print(f"[!] Error: {e}", file=sys.stderr)
        return jsonify({"status": "error", "message": "Server error"}), 500


@app.route('/api/leaderboard')
def get_leaderboard():
    """Get current leaderboard as JSON"""
    sorted_teams = sorted(leaderboard.items(), key=lambda x: x[1].get('points', 0), reverse=True)
    return jsonify({
        "timestamp": datetime.now().isoformat(),
        "leaderboard": [
            {
                "rank": i + 1,
                "student_id": team_id,
                "points": data.get('points', 0),
                "flags_captured": len(data.get('solved', {}))
            }
            for i, (team_id, data) in enumerate(sorted_teams)
        ]
    })


@app.route('/api/student/<student_id>')
def get_student(student_id):
    """Get a specific student's info"""
    if student_id in leaderboard:
        return jsonify({
            "student_id": student_id,
            **leaderboard[student_id]
        })
    return jsonify({"error": "Student not found"}), 404

@app.route('/modules/<filename>')
def view_module(filename):
    return render_template('view_md.html', filename=filename)


if __name__ == '__main__':
    load_leaderboard()
    app.run(host='0.0.0.0', port=5000, debug=False)
