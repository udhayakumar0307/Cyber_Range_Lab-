"""
scripts/copy_puzzle_files.py — Copies sysadmin (3) files to backup/Puzzle/
========================================================================
"""

import os
import shutil

SOURCE_DIR = r"C:\Users\Udhayakumar\Downloads\sysadmin (3)\sysadmin"
TARGET_DIR = r"d:\IITM ASTRA\cyberrange-main\cyberrange\backup\Puzzle"

def copy_files():
    if not os.path.exists(SOURCE_DIR):
        print(f"Source directory {SOURCE_DIR} does not exist.")
        return

    if os.path.exists(TARGET_DIR):
        print(f"Target directory {TARGET_DIR} already exists. Cleaning...")
        shutil.rmtree(TARGET_DIR)

    shutil.copytree(SOURCE_DIR, TARGET_DIR)
    print(f"Successfully copied all files from {SOURCE_DIR} to {TARGET_DIR}.")

if __name__ == "__main__":
    copy_files()
