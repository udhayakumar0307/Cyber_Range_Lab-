#!/usr/bin/env python3
"""
progress_service.py
Server-authoritative objective checker. Runs OUTSIDE the student's
container and independently verifies each objective by either:
  - grepping the student's command log for a pattern (log_regex), or
  - running a real bash test expression inside the container (fs_test)
via `docker exec`. The student cannot fake completion by editing
client-side scripts because this process does its own checking.
"""

import os
import json
import re
import subprocess
from pathlib import Path
from flask import Flask, jsonify

STUDENT_CONTAINER = os.environ.get("STUDENT_CONTAINER", "cll-student")
CONFIG_PATH = Path(__file__).parent / "module_config.json"
LOG_PATH_IN_CONTAINER = "/var/log/session/commands.log"

app = Flask(__name__)

with open(CONFIG_PATH) as f:
    MODULE_CONFIG = json.load(f)["modules"]


def docker_exec(*args, timeout=5):
    """Run a command inside the student container as root; return (ok, stdout)."""
    try:
        result = subprocess.run(
            ["docker", "exec", "-u", "root", STUDENT_CONTAINER, *args],
            capture_output=True, text=True, timeout=timeout,
        )
        return result.returncode == 0, result.stdout
    except Exception as e:
        return False, str(e)


def read_command_log():
    ok, out = docker_exec("cat", LOG_PATH_IN_CONTAINER)
    if not ok:
        return ""
    return out


def check_log_regex(pattern, log_text):
    try:
        return re.search(pattern, log_text, re.MULTILINE) is not None
    except re.error:
        return False


def check_fs_test(test_cmd):
    ok, _ = docker_exec("bash", "-c", test_cmd)
    return ok


def evaluate_module(module_id):
    module = MODULE_CONFIG.get(module_id)
    if not module:
        return None

    log_text = read_command_log()
    results = []
    for obj in module["objectives"]:
        if obj["type"] == "log_regex":
            complete = check_log_regex(obj["pattern"], log_text)
        elif obj["type"] == "fs_test":
            complete = check_fs_test(obj["test_cmd"])
        else:
            complete = False
        results.append({"id": obj["id"], "label": obj["label"], "complete": complete})

    module_complete = all(r["complete"] for r in results)
    return {
        "module": module_id,
        "title": module["title"],
        "objectives": results,
        "module_complete": module_complete,
    }


@app.route("/progress/<student_id>")
def progress_default(student_id):
    # Show the first module that isn't fully complete yet, else the last one.
    for module_id in MODULE_CONFIG.keys():
        data = evaluate_module(module_id)
        if not data["module_complete"]:
            return jsonify(data)
    last = list(MODULE_CONFIG.keys())[-1]
    return jsonify(evaluate_module(last))


@app.route("/progress/<student_id>/<module_id>")
def progress_module(student_id, module_id):
    data = evaluate_module(module_id)
    if data is None:
        return jsonify({"error": "unknown module"}), 404
    return jsonify(data)


@app.route("/progress-all/<student_id>")
def progress_all(student_id):
    return jsonify({m: evaluate_module(m) for m in MODULE_CONFIG.keys()})


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9500)
