#!/usr/bin/env python3
"""
recon_helper.py — Guided recon tool for Lab 1.
Walks students through discovery steps with explanations.
Usage: python3 /opt/tools/recon_helper.py [--step N]
"""

import subprocess
import sys
import time

TARGET = "10.10.0.10"

def run(cmd, desc):
    print(f"\n[*] {desc}")
    print(f"    Command: {cmd}\n")
    time.sleep(0.5)
    subprocess.run(cmd, shell=True)

STEPS = [
    # Step 1 — Quick ping sweep
    (
        f"ping -c 3 {TARGET}",
        "Step 1: Verify the target is alive (ICMP ping)"
    ),
    # Step 2 — Fast common port scan
    (
        f"nmap -F {TARGET}",
        "Step 2: Fast scan of the 100 most common ports"
    ),
    # Step 3 — Version detection on discovered ports
    (
        f"nmap -sV -p 21,22,80,3306 {TARGET}",
        "Step 3: Service version fingerprinting on known ports"
    ),
    # Step 4 — Full port scan (slow but thorough)
    (
        f"nmap -p- --min-rate 1000 {TARGET}",
        "Step 4: Full range scan — finds services on non-standard ports"
    ),
    # Step 5 — Script scan for extra info
    (
        f"nmap -sC -sV -p 21,22,80,3306,8888,9000 {TARGET}",
        "Step 5: Script scan — grabs banners and service details"
    ),
]

def main():
    step = None
    if "--step" in sys.argv:
        idx = sys.argv.index("--step")
        step = int(sys.argv[idx + 1]) - 1

    print("=" * 60)
    print("  SecureGuard Recon Helper — Lab 1")
    print(f"  Target: {TARGET}")
    print("=" * 60)

    if step is not None:
        if 0 <= step < len(STEPS):
            cmd, desc = STEPS[step]
            run(cmd, desc)
        else:
            print(f"Invalid step. Choose 1-{len(STEPS)}")
    else:
        print("\nAvailable steps:")
        for i, (_, desc) in enumerate(STEPS, 1):
            print(f"  {i}. {desc}")
        print(f"\nRun a specific step: python3 {sys.argv[0]} --step N")
        print("Or run all steps:    python3 {sys.argv[0]} --all")

        if "--all" in sys.argv:
            for cmd, desc in STEPS:
                run(cmd, desc)
                input("\n[Press Enter to continue to next step...]\n")

if __name__ == "__main__":
    main()
