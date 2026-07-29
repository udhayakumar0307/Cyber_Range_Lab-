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
    CONFIG_DATA = json.load(f)

TRACKS_CONFIG = CONFIG_DATA.get("tracks", {})
# Legacy fallback flat modules mapping if tracks key is missing
FLAT_MODULES = CONFIG_DATA.get("modules", {})


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


def parse_command_log(log_text):
    """
    Parses commands.log lines into structured tuples: (timestamp, cwd, cmd, raw_line).
    Each line in commands.log is formatted as: timestamp|cwd|cmd
    """
    entries = []
    for line in log_text.splitlines():
        line_str = line.strip()
        if not line_str:
            continue
        parts = line_str.split("|", 2)
        if len(parts) == 3:
            ts, cwd, cmd = parts
            entries.append((ts, cwd, cmd, line_str))
        else:
            entries.append(("", "", line_str, line_str))
    return entries


def filter_log_for_module(parsed_log, track_id, module_id):
    """
    Filters parsed command log entries so that ONLY commands executed
    within the specific module's working directory context are evaluated.
    Prevents cross-module, cross-track, and historical command carryover.
    """
    module_path_key = f"{track_id}/{module_id}".lower()
    filtered = []
    for ts, cwd, cmd, raw_line in parsed_log:
        cwd_lower = cwd.lower()
        if module_path_key in cwd_lower or not cwd:
            filtered.append((ts, cwd, cmd, raw_line))
    return filtered


def check_log_regex(pattern, parsed_log):
    """
    Checks pattern against:
    1. Bare command (cmd)
    2. Working directory / formatted raw log line (raw_line)
    3. Stripped pattern without leading '^' against cmd
    Returns (matched_bool, matched_cmd_string).
    """
    try:
        flags = re.MULTILINE | re.IGNORECASE if 'access_key' in pattern.lower() else re.MULTILINE
        regex = re.compile(pattern, flags)
    except re.error:
        return False, None

    for ts, cwd, cmd, raw_line in parsed_log:
        if regex.search(cmd):
            return True, cmd
        if regex.search(raw_line):
            return True, cmd
        if pattern.startswith("^"):
            clean_pat = pattern[1:]
            try:
                if re.search(clean_pat, cmd, flags):
                    return True, cmd
            except re.error:
                pass
    return False, None


def check_fs_test(test_cmd):
    ok, _ = docker_exec("bash", "-c", test_cmd)
    return ok


def evaluate_module(module_id, track_id="linux"):
    module = None
    if TRACKS_CONFIG and track_id in TRACKS_CONFIG:
        module = TRACKS_CONFIG[track_id].get("modules", {}).get(module_id)
    if not module and FLAT_MODULES:
        module = FLAT_MODULES.get(module_id)

    if not module:
        return None

    log_text = read_command_log()
    parsed_log = parse_command_log(log_text)
    module_log = filter_log_for_module(parsed_log, track_id, module_id)

    # Print log of all received commands for debug
    for ts, cwd, cmd, _ in module_log:
        if cmd:
            print(f"[DEBUG] received command: {cmd}", flush=True)

    results = []
    for obj in module.get("objectives", []):
        complete = False
        matched_cmd = None
        if obj["type"] == "log_regex":
            complete, matched_cmd = check_log_regex(obj["pattern"], module_log)
        elif obj["type"] == "fs_test":
            complete = check_fs_test(obj["test_cmd"])
        else:
            complete = False

        if complete:
            rec_cmd = matched_cmd if matched_cmd else (module_log[-1][2] if module_log else "N/A")
            print(f"[DEBUG] received command: {rec_cmd}", flush=True)
            print(f"[DEBUG] matched objective: {obj['label']}", flush=True)
            print(f"[DEBUG] objective completed: {obj['id']}", flush=True)

        results.append({"id": obj["id"], "label": obj["label"], "complete": complete})

    module_complete = all(r["complete"] for r in results) if results else False
    return {
        "module": module_id,
        "track": track_id,
        "title": module.get("title", ""),
        "objectives": results,
        "module_complete": module_complete,
    }


@app.route("/progress/<student_id>")
def progress_default(student_id):
    # Default to linux track module1
    data = evaluate_module("module1", "linux")
    return jsonify(data)


@app.route("/progress/<student_id>/<track_id>/<module_id>")
@app.route("/progress/<student_id>/<module_id>")
def progress_module(student_id, module_id, track_id=None):
    if not track_id:
        track_id = "linux"
    data = evaluate_module(module_id, track_id)
    if data is None:
        return jsonify({"error": "unknown module"}), 404
    return jsonify(data)


@app.route("/progress-all/<student_id>")
def progress_all(student_id):
    res = {}
    for tid, tcfg in TRACKS_CONFIG.items():
        for mid in tcfg.get("modules", {}).keys():
            res[f"{tid}_{mid}"] = evaluate_module(mid, tid)
    return jsonify(res)


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9500)
