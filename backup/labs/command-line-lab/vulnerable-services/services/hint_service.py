#!/usr/bin/env python3

"""
hint_service.py

Serves escalating hints per module and tracks how many a student has
used (and therefore how many points to deduct). State is persisted to
/flags/hints_state.json so scoring-server can read the deduction total
when computing a student's score.
"""

import json
from pathlib import Path

from flask import Flask, jsonify


CONFIG_PATH = Path(__file__).parent / "module_config.json"
STATE_PATH = Path("/flags/hints_state.json")

app = Flask(__name__)


with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    CONFIG_DATA = json.load(f)

TRACKS_CONFIG = CONFIG_DATA.get("tracks", {})
LEGACY_MODULES = CONFIG_DATA.get("modules", {})

HINT_COSTS = [10, 20, 35]


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


def _request_hint(student_id, track_id, module_id):
    module = None

    # New multi-track configuration
    if track_id in TRACKS_CONFIG:
        module = (
            TRACKS_CONFIG[track_id]
            .get("modules", {})
            .get(module_id)
        )

    # Legacy flat configuration fallback
    if not module:
        module = LEGACY_MODULES.get(module_id)

    if not module:
        return jsonify({
            "error": f"module not found: {track_id}/{module_id}"
        }), 404

    hints = module.get("hints", [])

    state = load_state()
    student_state = state.setdefault(student_id, {})

    # Important: module1 exists in every track.
    # Keep each track/module pair separate.
    state_key = f"{track_id}:{module_id}"

    used = student_state.setdefault(state_key, 0)

    if used >= len(hints):
        return jsonify({
            "error": "No more hints available for this module."
        }), 200

    hint_text = hints[used]
    cost = HINT_COSTS[min(used, len(HINT_COSTS) - 1)]

    student_state[state_key] = used + 1
    save_state(state)

    return jsonify({
        "track": track_id,
        "module": module_id,
        "hint": hint_text,
        "cost": cost,
        "hints_used": used + 1,
    })


# New multi-track endpoint
@app.route(
    "/hint/<student_id>/<track_id>/<module_id>",
    methods=["POST"],
)
def request_hint(student_id, track_id, module_id):
    return _request_hint(
        student_id,
        track_id,
        module_id,
    )


# Backward compatibility for existing Linux-only helper
@app.route(
    "/hint/<student_id>/<module_id>",
    methods=["POST"],
)
def request_hint_legacy(student_id, module_id):
    return _request_hint(
        student_id,
        "linux",
        module_id,
    )


@app.route("/hint-deductions/<student_id>")
def hint_deductions(student_id):
    """Return total points deducted from hint usage."""

    state = load_state().get(student_id, {})
    total = 0

    for state_key, used in state.items():
        for i in range(used):
            total += HINT_COSTS[min(i, len(HINT_COSTS) - 1)]

    return jsonify({
        "student_id": student_id,
        "total_deduction": total,
        "detail": state,
    })


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9600)
