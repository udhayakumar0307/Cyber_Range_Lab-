#!/usr/bin/env python3
"""
hint_helper.py
The `hint` command. Asks hint_service (server-side) for the next unused
hint on the student's current module. Points deducted server-side so
this script cannot be used to get free hints by editing it.
"""

import os
import sys
import json
import urllib.request

HINT_SERVICE_URL = os.environ.get("HINT_SERVICE_URL", "http://10.20.0.10:9600")
STUDENT_ID = os.environ.get("STUDENT_ID", "student")


def main():
    module = sys.argv[1] if len(sys.argv) > 1 else "module1"
    url = f"{HINT_SERVICE_URL}/hint/{STUDENT_ID}/{module}"
    try:
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"[!] Could not reach hint service: {e}")
        return

    if data.get("error"):
        print(f"[!] {data['error']}")
        return

    print(f"\nHint ({data.get('cost', 0)} pts): {data.get('hint')}\n")


if __name__ == "__main__":
    main()
