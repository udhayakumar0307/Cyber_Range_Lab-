#!/usr/bin/env python3
"""
submit_flag.py — Submit a captured flag to the scoring server.
Usage: python3 /opt/tools/submit_flag.py <module> <flag> [key=value ...]

Examples:
  python3 /opt/tools/submit_flag.py module1 "FLAG{...}" ports="21,22,80" ftp_anon="yes"
  python3 /opt/tools/submit_flag.py module3 "FLAG{...}" svc_type="HTTP" url="http://10.10.0.10:9000/debug"
"""

import sys
import json
import urllib.request

SCORING_URL = "http://10.10.0.99:5000"

def submit(module, flag, evidence):
    payload = json.dumps({
        "lab": 1,
        "module": int(module.replace("module", "")),
        "submitted_flag": flag,
        "student_id": "student"
    }).encode()
    req = urllib.request.Request(
        f"{SCORING_URL}/api/submit-flag",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    module = sys.argv[1]
    flag   = sys.argv[2]
    evidence = {}
    for arg in sys.argv[3:]:
        if "=" in arg:
            k, v = arg.split("=", 1)
            evidence[k] = v

    try:
        result = submit(module, flag, evidence)
        status = result.get("status")

        if status == "correct":
            print(f"\n🚩 FLAG CAPTURED!")
            print(f"   {result['message']}")
            print(f"   Points earned : {result['points_earned']}")
            if result.get("speed_bonus"):
                print(f"   Speed bonus   : +{result['speed_bonus']} pts!")
            print(f"   Total points  : {result['total_points']}")
            print(f"   Progress      : {result['modules_solved']}/{result['modules_solved'] + result['modules_remaining']} modules")
            if result.get("lab_complete"):
                print(f"\n🏆 LAB 1 COMPLETE! All flags captured!")
        elif status == "already_solved":
            print(f"✓ Already captured {module}. Points awarded earlier.")
        elif status == "incorrect":
            print(f"✗ Incorrect flag for {module}.")
            print(f"  Attempts: {result.get('attempts', '?')}")
            if result.get("hint"):
                print(f"  💡 Hint: {result['hint']}")
        else:
            print(f"Response: {result}")
    except Exception as e:
        print(f"Error: {e}")
        print("Is the scoring server running? Check: curl http://10.10.0.99:5000/status")

if __name__ == "__main__":
    main()
