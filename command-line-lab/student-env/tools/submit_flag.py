#!/usr/bin/env python3
"""
submit_flag.py
Terminal-based flag submission, for students who prefer the CLI over
the browser's Verify box. Talks directly to the scoring-server, which
independently recomputes the expected flag — this script never decides
whether a flag is correct.

Usage:
    submitflag module1 "FLAG{...}"
"""

import os
import sys
import json
import urllib.request

SCORING_URL = os.environ.get("SCORING_URL", "http://10.20.0.99:5000")
STUDENT_ID = os.environ.get("STUDENT_ID", "student")


def main():
    if len(sys.argv) < 3:
        print("Usage: submitflag <module> <FLAG{...}>")
        sys.exit(1)

    module, flag = sys.argv[1], sys.argv[2]
    payload = json.dumps({"student_id": STUDENT_ID, "module": module, "flag": flag}).encode()
    req = urllib.request.Request(
        f"{SCORING_URL}/api/submit",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"[!] Could not reach scoring server: {e}")
        sys.exit(1)

    if data.get("correct"):
        print(f"Correct! +{data.get('points', 0)} points. Total: {data.get('total_points', 0)}")
    else:
        print(f"Incorrect: {data.get('message', 'try again')}")


if __name__ == "__main__":
    main()
