import os
import json
import asyncio
import logging
from pathlib import Path
from app.database.session import SessionLocal
from app.models.lab import Lab

logger = logging.getLogger("LabAllocatorSync")

async def run_lab_allocator_sync():
    logger.info("[+] Lab & Puzzle directory auto-sync scanner worker loop started.")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_root = os.path.dirname(current_dir)
    labs_dir = os.path.join(workspace_root, "labs")
    puzzle_dir = os.path.join(workspace_root, "puzzle")

    while True:
        db = SessionLocal()
        try:
            # 1. Scan /labs directory
            if os.path.exists(labs_dir):
                for path in Path(labs_dir).iterdir():
                    if path.is_dir():
                        lab_id = path.name
                        metadata_file = path / "metadata.json"
                        
                        # Load defaults
                        name = lab_id.replace("-", " ").title()
                        category = "General Security"
                        difficulty = "Medium"
                        max_points = 100
                        docker_image = f"cyberrange/{lab_id}:latest"
                        price_per_hour = 100.0

                        if metadata_file.exists():
                            try:
                                with open(metadata_file, "r") as f:
                                    meta = json.load(f)
                                name = meta.get("name", name)
                                category = meta.get("category", category)
                                difficulty = meta.get("difficulty", difficulty)
                                max_points = int(meta.get("max_points", 100))
                                docker_image = meta.get("docker_image", docker_image)
                                price_per_hour = float(meta.get("price_per_hour", 100.0))
                            except Exception as json_err:
                                logger.error(f"Failed to parse metadata.json in {lab_id}: {json_err}")

                        # Check if exists in DB
                        existing = db.query(Lab).filter(Lab.id == lab_id).first()
                        if not existing:
                            new_lab = Lab(
                                id=lab_id,
                                name=name,
                                category=category,
                                difficulty=difficulty,
                                max_points=max_points,
                                docker_image=docker_image,
                                price_per_hour=price_per_hour,
                                status="PENDING_REVIEW"
                            )
                            db.add(new_lab)
                            db.commit()
                            logger.info(f"[+] Auto-detected & registered new lab: {lab_id} (PENDING_REVIEW)")

            # 2. Scan /puzzle directory
            if os.path.exists(puzzle_dir):
                for path in Path(puzzle_dir).iterdir():
                    if path.is_dir():
                        puzzle_id = path.name
                        # Check special case or folder name mapping
                        if puzzle_id == "techcorp-labs":
                            puzzle_id = "techcorp-sysadmin-labs" # Keep compatibility with terminal_api.py constants

                        metadata_file = path / "metadata.json"
                        
                        name = puzzle_id.replace("-", " ").title()
                        category = "Puzzle"
                        difficulty = "Intermediate"
                        max_points = 340 # 34 levels
                        docker_image = "techcorp-sysadmin-labs:latest"
                        price_per_hour = 150.0

                        if metadata_file.exists():
                            try:
                                with open(metadata_file, "r") as f:
                                    meta = json.load(f)
                                name = meta.get("name", name)
                                category = meta.get("category", category)
                                difficulty = meta.get("difficulty", difficulty)
                                max_points = int(meta.get("max_points", max_points))
                                docker_image = meta.get("docker_image", docker_image)
                                price_per_hour = float(meta.get("price_per_hour", price_per_hour))
                            except Exception as json_err:
                                logger.error(f"Failed to parse metadata.json in puzzle {puzzle_id}: {json_err}")

                        existing = db.query(Lab).filter(Lab.id == puzzle_id).first()
                        if not existing:
                            new_lab = Lab(
                                id=puzzle_id,
                                name=name,
                                category=category,
                                difficulty=difficulty,
                                max_points=max_points,
                                docker_image=docker_image,
                                price_per_hour=price_per_hour,
                                status="PENDING_REVIEW"
                            )
                            db.add(new_lab)
                            db.commit()
                            logger.info(f"[+] Auto-detected & registered new puzzle lab: {puzzle_id} (PENDING_REVIEW)")

        except Exception as e:
            logger.error(f"Error in Lab/Puzzle directory allocator sync loop: {e}")
        finally:
            db.close()

        await asyncio.sleep(30) # Scans directories every 30 seconds
