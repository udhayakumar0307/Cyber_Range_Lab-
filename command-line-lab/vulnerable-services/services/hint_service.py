#!/usr/bin/env python3
"""
hint_service.py
Serves escalating hints per module and tracks how many a student has
used (and therefore how many points to deduct). State is persisted to
/flags/hints_state.json so scoring-server can read the deduction total
when computing a student's score.
"""

import os
import json
from pathlib import Path
from flask import Flask, jsonify

CONFIG_PATH = Path(__file__).parent / "module_config.json"
STATE_PATH = Path("/flags/hints_state.json")

app = Flask(__name__)

with open(CONFIG_PATH) as f:
    MODULE_CONFIG = json.load(f)["modules"]

HINT_COSTS = [10, 20, 35]  # escalating cost per hint requested


def load_state():
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except Exception:
            pass
    return {}


def save_state(state):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2))


@app.route("/hint/<student_id>/<module_id>", methods=["POST"])
def request_hint(student_id, module_id):
    module = MODULE_CONFIG.get(module_id)
    if not module:
        return jsonify({"error": "unknown module"}), 404

    hints = module.get("hints", [])
    state = load_state()
    student_state = state.setdefault(student_id, {})
    used = student_state.setdefault(module_id, 0)

    if used >= len(hints):
        return jsonify({"error": "No more hints available for this module."}), 200

    hint_text = hints[used]
    cost = HINT_COSTS[min(used, len(HINT_COSTS) - 1)]
    student_state[module_id] = used + 1
    save_state(state)

    return jsonify({"hint": hint_text, "cost": cost, "hints_used": used + 1})


@app.route("/hint-deductions/<student_id>")
def hint_deductions(student_id):
    """Used by scoring-server to compute total points lost to hints."""
    state = load_state().get(student_id, {})
    total = 0
    for module_id, used in state.items():
        for i in range(used):
            total += HINT_COSTS[min(i, len(HINT_COSTS) - 1)]
    return jsonify({"student_id": student_id, "total_deduction": total, "detail": state})


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9600)
