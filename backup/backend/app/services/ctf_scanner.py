"""Filesystem-backed CTF event registry, mirroring lab_scanner.py's convention.

Each subfolder of settings.CTF_DIRECTORY with an event.json is one CTF event.
Re-running the scan updates the event and its challenges in place (matched by
title within the event) rather than duplicating them.
"""
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ctf import CTF, CTFChallenge
from app.models.user import User
from app.services.notification_service import notification_service
from app.services.ctf_flag import generate_salt, hash_flag

logger = logging.getLogger(__name__)
REQUIRED_EVENT_FIELDS = {"title", "description", "start_time", "end_time"}
REQUIRED_CHALLENGE_FIELDS = {"title", "category", "flag"}


def _event_metadata(path: Path) -> Dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    missing = REQUIRED_EVENT_FIELDS - data.keys()
    if missing:
        raise ValueError(f"missing required event fields: {', '.join(sorted(missing))}")
    return data


def scan_ctf_directory(db: Session, ctf_directory: str | None = None, notify: bool = True) -> Dict[str, int]:
    root = Path(ctf_directory or settings.CTF_DIRECTORY)
    result = {"events_added": 0, "events_updated": 0, "challenges_added": 0, "challenges_updated": 0, "failed": 0}
    if not root.is_dir():
        logger.warning("CTF registry directory does not exist: %s", root)
        return result

    for event_file in root.glob("*/event.json"):
        try:
            data = _event_metadata(event_file)
            directory = event_file.parent

            event = db.query(CTF).filter(CTF.title == data["title"].strip()).first()
            is_new_event = event is None
            if is_new_event:
                event = CTF(title=data["title"].strip())
                db.add(event)

            event.description = data.get("description", "").strip()
            event.start_time = datetime.fromisoformat(data["start_time"])
            event.end_time = datetime.fromisoformat(data["end_time"])
            event.status = data.get("status", event.status or "scheduled")
            event.is_public = bool(data.get("is_public", True))
            result["events_added" if is_new_event else "events_updated"] += 1
            db.flush()

            for ch_data in data.get("challenges", []):
                missing = REQUIRED_CHALLENGE_FIELDS - ch_data.keys()
                if missing:
                    logger.warning("Skipping challenge in %s: missing %s", directory, missing)
                    result["failed"] += 1
                    continue

                challenge = db.query(CTFChallenge).filter(
                    CTFChallenge.ctf_id == event.id,
                    CTFChallenge.title == ch_data["title"].strip()
                ).first()
                is_new_challenge = challenge is None
                if is_new_challenge:
                    challenge = CTFChallenge(ctf_id=event.id, title=ch_data["title"].strip())
                    db.add(challenge)

                challenge.description = ch_data.get("description", "").strip()
                challenge.category = ch_data["category"].strip()
                challenge.connection_string = ch_data.get("connection_string")
                challenge.challenge_url = ch_data.get("challenge_url")
                challenge.scoring_mode = ch_data.get("scoring_mode", "static")
                challenge.static_points = ch_data.get("static_points", 100)
                challenge.dynamic_ceiling = ch_data.get("dynamic_ceiling")
                challenge.dynamic_floor = ch_data.get("dynamic_floor")
                challenge.decay_constant = ch_data.get("decay_constant")
                challenge.is_hidden = bool(ch_data.get("is_hidden", False))

                salt = generate_salt()
                challenge.flag_salt = salt
                challenge.flag_hash = hash_flag(ch_data["flag"], salt)

                result["challenges_added" if is_new_challenge else "challenges_updated"] += 1

            db.flush()

            if is_new_event and notify:
                admins = db.query(User).filter(User.is_active.is_(True), User.role.in_(["admin", "SYSTEM_ADMIN"])).all()
                notification_service.notify_users(
                    db, admins, "New CTF Event Available",
                    f"{event.title} was added to the CTF registry.", "ADMIN_CTF_CREATED"
                )
        except Exception as exc:
            result["failed"] += 1
            logger.warning("Skipping invalid CTF event %s: %s", event_file, exc)

    db.commit()
    return result


async def ctf_directory_sync_loop(interval_seconds: int = 300) -> None:
    """
    Runs automatically in the background: rescans settings.CTF_DIRECTORY every
    interval_seconds so new event folders dropped in ctf/ appear on the SysAdmin
    CTF tab without any manual "Sync Now" action or server restart.
    """
    from app.database.manager import db_manager
    while True:
        try:
            db = db_manager.get_session()
            try:
                result = scan_ctf_directory(db)
                if result["events_added"] or result["challenges_added"]:
                    logger.info("[CTF auto-sync] %s", result)
            finally:
                db.close()
        except Exception:
            logger.exception("CTF directory auto-sync failed")
        await asyncio.sleep(interval_seconds)
