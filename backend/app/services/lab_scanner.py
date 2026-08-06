"""Filesystem-backed production lab registry."""
import json
import logging
import re
from pathlib import Path
from typing import Dict
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.lab import Lab
from app.models.user import User
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)
REQUIRED_FIELDS = {"name", "category", "difficulty", "description", "duration", "price", "docker_image"}


def _lab_id(directory: Path) -> str:
    return re.sub(r"[^a-z0-9-]", "-", directory.name.lower()).strip("-")


def _metadata(path: Path) -> Dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = REQUIRED_FIELDS - data.keys()
    if missing:
        raise ValueError(f"missing required fields: {', '.join(sorted(missing))}")
    if not all(isinstance(data[key], str) and data[key].strip() for key in REQUIRED_FIELDS):
        raise ValueError("metadata fields must be non-empty strings")
    return data


def scan_lab_directory(db: Session, labs_directory: str | None = None, notify: bool = True) -> Dict[str, int]:
    root = Path(labs_directory or settings.LABS_DIRECTORY)
    result = {"added": 0, "updated": 0, "failed": 0}
    if not root.is_dir():
        logger.warning("Lab registry directory does not exist: %s", root)
        return result
    for metadata_file in root.glob("*/metadata.json"):
        try:
            data, directory = _metadata(metadata_file), metadata_file.parent
            lab_id = _lab_id(directory)
            lab = db.query(Lab).filter(Lab.id == lab_id).first()
            is_new = lab is None
            if is_new:
                lab = Lab(id=lab_id)
                db.add(lab)
            lab.name = data["name"].strip()
            lab.category = data["category"].strip()
            lab.difficulty = data["difficulty"].strip().title()
            lab.description = data["description"].strip()
            lab.estimated_time = round(float(data["duration"]) * 60)  # store as minutes
            lab.price_inr = float(data["price"])
            lab.docker_image = data["docker_image"].strip()
            lab.registry_path = str(directory.resolve())
            lab.status = "ACTIVE"
            result["added" if is_new else "updated"] += 1
            db.flush()

            # Sync module_config.json into lab_modules if present
            config_file = directory / "scoring-server" / "module_config.json"
            if not config_file.exists():
                config_file = directory / "module_config.json"
            if config_file.exists():
                try:
                    from app.models.lab_module import LabModule
                    cfg_data = json.loads(config_file.read_text(encoding="utf-8"))
                    tracks_cfg = cfg_data.get("tracks", {})
                    order_num = 1
                    for track_id, track_info in tracks_cfg.items():
                        mods = track_info.get("modules", {})
                        for mod_id, mod_info in mods.items():
                            mod_pk = f"{lab_id}_{track_id}_{mod_id}"
                            existing_mod = db.query(LabModule).filter(LabModule.id == mod_pk).first()
                            if not existing_mod:
                                existing_mod = LabModule(
                                    id=mod_pk,
                                    lab_id=lab_id,
                                    module_number=order_num,
                                    title=mod_info.get("title", f"{track_id.title()} {mod_id.title()}"),
                                    description=mod_info.get("mission", mod_info.get("story", "")),
                                    points=mod_info.get("points", 200),
                                    display_order=order_num,
                                    track=track_id
                                )
                                db.add(existing_mod)
                            else:
                                existing_mod.title = mod_info.get("title", existing_mod.title)
                                existing_mod.description = mod_info.get("mission", existing_mod.description)
                                existing_mod.points = mod_info.get("points", existing_mod.points)
                                existing_mod.track = track_id
                            order_num += 1
                except Exception as mod_exc:
                    logger.warning("Error syncing lab_modules for %s: %s", lab_id, mod_exc)

            if is_new and notify:
                students = db.query(User).filter(User.is_active.is_(True), User.role.in_(["user", "student"])).all()
                notification_service.notify_users(db, students, "New Cyber Lab Available",
                                                  "A new cybersecurity lab has been added.", "LAB_PUBLISHED")
                admins = db.query(User).filter(User.is_active.is_(True), User.role.in_(["admin", "SYSTEM_ADMIN"])).all()
                notification_service.notify_users(db, admins, "New Lab Created",
                                                  f"{lab.name} was added to the lab registry.", "ADMIN_LAB_CREATED")
        except Exception as exc:
            result["failed"] += 1
            logger.warning("Skipping invalid lab metadata %s: %s", metadata_file, exc)
    db.commit()
    return result
