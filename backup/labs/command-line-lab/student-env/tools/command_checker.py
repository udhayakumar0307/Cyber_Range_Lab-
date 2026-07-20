#!/usr/bin/env python3
"""
command_checker.py
Called from PROMPT_COMMAND (see shell_profile) after every command the
student runs. It only APPENDS a log line — it makes no scoring decisions
itself. progress_service.py (running outside this container) reads this
log via `docker exec` and re-derives objective completion, so a student
editing this file or the log cannot fabricate progress.
"""

import os
import sys
import subprocess
import time

LOG_PATH = "/var/log/session/commands.log"


def last_history_command():
    try:
        out = subprocess.check_output(["bash", "-i", "-c", "history 1"], stderr=subprocess.DEVNULL)
        line = out.decode(errors="ignore").strip()
        parts = line.split(None, 1)
        return parts[1] if len(parts) > 1 else ""
    except Exception:
        return ""


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else last_history_command()
    cwd = os.getcwd()
    ts = int(time.time())
    line = f"{ts}|{cwd}|{cmd}\n"
    try:
        with open(LOG_PATH, "a") as f:
            f.write(line)
    except Exception:
        # Never break the student's shell if logging fails
        pass


if __name__ == "__main__":
    main()
