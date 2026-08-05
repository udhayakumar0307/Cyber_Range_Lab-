import os
import json
import asyncio
import logging
from pathlib import Path
from app.database.session import SessionLocal
from app.models.lab import Lab

logger = logging.getLogger("LabAllocatorSync")

async def run_lab_allocator_sync():
    logger.info("[+] Lab Registry auto-sync worker loop started.")
    
    # Establish registry directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    registry_dir = os.path.join(current_dir, "registry", "labs")
    os.makedirs(registry_dir, exist_ok=True)

    # Place a default demo lab JSON file if folder is empty
    demo_file = os.path.join(registry_dir, "demo_lab.json")
    if not os.path.exists(demo_file):
        with open(demo_file, "w") as f:
            json.dump({
                "id": "registry-simulated-iot",
                "name": "Simulated Industrial IoT Supervisory SCADA Lab",
                "category": "Industrial Control Systems",
                "difficulty": "Advanced",
                "max_points": 500,
                "status": "PENDING_REVIEW"
            }, f, indent=2)

    while True:
        db = SessionLocal()
        try:
            for filepath in Path(registry_dir).glob("*.json"):
                try:
                    with open(filepath, "r") as f:
                        data = json.load(f)
                    
                    lab_id = data.get("id")
                    if not lab_id:
                        continue

                    # Check if lab already exists in DB
                    existing = db.query(Lab).filter(Lab.id == lab_id).first()
                    if not existing:
                        new_lab = Lab(
                            id=lab_id,
                            name=data.get("name"),
                            category=data.get("category", "General"),
                            difficulty=data.get("difficulty", "Medium"),
                            max_points=data.get("max_points", 100),
                            status="PENDING_REVIEW" # Platform owner must approve to toggle to ACTIVE
                        )
                        db.add(new_lab)
                        db.commit()
                        logger.info(f"[+] Auto-registered new Lab configuration from file: {lab_id}")
                except Exception as file_err:
                    logger.error(f"Failed to parse lab registry file {filepath.name}: {file_err}")

        except Exception as e:
            logger.error(f"Error in Lab allocator sync loop: {e}")
        finally:
            db.close()

        await asyncio.sleep(30) # Scans registry every 30 seconds
