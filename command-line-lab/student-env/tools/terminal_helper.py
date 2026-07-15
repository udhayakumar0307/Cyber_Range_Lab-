#!/usr/bin/env python3
"""
terminal_helper.py
Runs at shell start (from shell_profile) and on-demand via the `progress`
alias. Talks to progress_service over the internal network to show the
student a live objective checklist. This is a convenience view only —
the authoritative check happens server-side in progress_service.py.
"""

import os
import sys
import json
import urllib.request

SERVICES_URL = os.environ.get("SERVICES_URL", "http://10.20.0.10:9500")
STUDENT_ID = os.environ.get("STUDENT_ID", "student")


def fetch_progress():
    try:
        req = urllib.request.Request(f"{SERVICES_URL}/progress/{STUDENT_ID}")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}


def print_banner():
    print("")
    print("+--------------------------------------------------+")
    print("|            COMMAND LINE LAB - WORKSTATION          |")
    print("|         Linux Fundamentals Track (Beginner)       |")
    print("+--------------------------------------------------+")
    print(f"  Student: {STUDENT_ID}")
    print("  Type 'progress' anytime to see your objective checklist.")
    print("  Type 'hint' if you're stuck (costs a few points).")
    print("")


def print_progress():
    data = fetch_progress()
    if "error" in data:
        print(f"[!] Could not reach progress service: {data['error']}")
        return
    module = data.get("module", "module1")
    print(f"\nObjectives — {module}")
    print("-" * 40)
    for obj in data.get("objectives", []):
        mark = "[x]" if obj.get("complete") else "[ ]"
        print(f" {mark} {obj.get('label')}")
    print("-" * 40)
    if data.get("module_complete"):
        print("All objectives complete — go find your key and submit it!")
    print("")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "progress":
        print_progress()
    else:
        print_banner()
