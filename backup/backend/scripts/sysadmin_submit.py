#!/usr/bin/env python3
"""
Development/MVP terminal client for the Linux Sysadmin autograder.

IMPORTANT: this first client uses a normal CyberRange access token. Do not bake
that token into an untrusted student workspace image. The production workspace
phase should replace it with a short-lived submission-only credential.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def request_json(url: str, token: str, payload: dict) -> tuple[int, dict]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, {"detail": raw or exc.reason}


def main() -> int:
    parser = argparse.ArgumentParser(prog="submit", description="Submit a Bash script to CyberRange.")
    parser.add_argument("script", help="Bash script to submit")
    parser.add_argument(
        "--lab",
        default=os.getenv("CYBERRANGE_SYSADMIN_LAB_ID", "RHSA-USERS-001"),
        help="Question-bank lab ID (default: CYBERRANGE_SYSADMIN_LAB_ID or RHSA-USERS-001)",
    )
    parser.add_argument(
        "--api",
        default=os.getenv("CYBERRANGE_API_URL", "http://127.0.0.1:8000/api/v1"),
        help="CyberRange API v1 base URL",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("CYBERRANGE_ACCESS_TOKEN", ""),
        help="MVP access token (or set CYBERRANGE_ACCESS_TOKEN)",
    )
    args = parser.parse_args()

    path = Path(args.script)
    if not path.is_file():
        print(f"submit: file not found: {path}", file=sys.stderr)
        return 1
    if not args.token:
        print(
            "submit: CYBERRANGE_ACCESS_TOKEN is not set. "
            "For the MVP, export a real student's access token first.",
            file=sys.stderr,
        )
        return 1

    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        print("submit: submission must be UTF-8 text.", file=sys.stderr)
        return 1

    print(f"Submitting {path.name} to {args.lab} ...")
    status, data = request_json(
        args.api.rstrip("/") + "/sysadmin-grading/submissions",
        args.token,
        {"lab_id": args.lab, "filename": path.name, "content": content},
    )

    if status >= 400:
        detail = data.get("detail", data)
        if isinstance(detail, dict):
            message = detail.get("message") or json.dumps(detail)
            submission_id = detail.get("submission_id")
            if submission_id:
                print(f"Submission ID: {submission_id}", file=sys.stderr)
        else:
            message = str(detail)
        print(f"Grading error ({status}): {message}", file=sys.stderr)
        return 1

    print(f"Submission ID: {data['submission_id']}")
    print(f"Lab: {data['lab_id']}")
    print("=" * 72)
    for item in data.get("tests", []):
        label = "PASS" if item.get("passed") else "FAIL"
        print(
            f"[{label:4}] {item.get('id',''):<26} "
            f"{item.get('points',0):>3}/{item.get('max_points',0):<3}  "
            f"{item.get('feedback','')}"
        )
    print("-" * 72)
    print(f"Final score: {data.get('score')}/{data.get('max_score')}")
    print(f"Pass mark:   {data.get('pass_score')}")
    print(f"Outcome:     {'PASS' if data.get('passed') else 'FAIL'}")
    return 0 if data.get("passed") else 2


if __name__ == "__main__":
    raise SystemExit(main())
