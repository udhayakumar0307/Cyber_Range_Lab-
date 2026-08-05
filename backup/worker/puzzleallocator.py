import os
import json
import asyncio
import logging
from pathlib import Path
from app.database.session import SessionLocal

logger = logging.getLogger("PuzzleAllocatorSync")

async def run_puzzle_allocator_sync():
    logger.info("[+] Puzzle/CTF Registry auto-sync worker loop started.")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    registry_dir = os.path.join(current_dir, "registry", "puzzles")
    os.makedirs(registry_dir, exist_ok=True)

    demo_file = os.path.join(registry_dir, "demo_puzzle.json")
    if not os.path.exists(demo_file):
        with open(demo_file, "w") as f:
            json.dump({
                "id": "ctf-pwn-buffer-overflow",
                "title": "Stack Clash Buffer Overflow",
                "points": 350,
                "category": "Binary Exploitation",
                "status": "PENDING_REVIEW"
            }, f, indent=2)

    while True:
        # Puzzles are integrated with CTF database if applicable. Let's perform a simple check.
        db = SessionLocal()
        try:
            # Standalone logger tracking puzzle configurations discovered
            for filepath in Path(registry_dir).glob("*.json"):
                try:
                    with open(filepath, "r") as f:
                        data = json.load(f)
                    # Sync logging logic or registry database tables updates
                    # For production compliance, we verify files are logged correctly
                    logger.debug(f"Registered/scanned puzzle config file: {data.get('id')}")
                except Exception as file_err:
                    logger.error(f"Failed to scan puzzle registry file {filepath.name}: {file_err}")
        except Exception as e:
            logger.error(f"Error in Puzzle allocator loop: {e}")
        finally:
            db.close()

        await asyncio.sleep(40)
