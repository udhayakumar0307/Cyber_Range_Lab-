"""
scripts/clean_canonical_points.py — Canonical Points Normalization & Final Re-derivation
=======================================================================================
Normalizes lab_modules.points to clean canonical catalog values:
  - Module 1: 100
  - Module 2: 150
  - Module 3: 200
  - Module 4: 250
  - Module 5: 300

Then re-derives all score_events, user_lab_progress.score, and users.total_score.
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
setup_logging()

from app.database.manager import db_manager
db_manager.init_db()

from sqlalchemy import func
from app.models.user import User
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.score_event import ScoreEvent
from app.models.user_lab_progress import UserLabProgress
from app.core.constants import ScoreEventType
from app.core.cache import invalidate_leaderboard, invalidate_dashboard


def normalize_canonical_points(session):
    # 1. Update lab_modules.points for 5-module labs to exact canonical standards
    STANDARD_5MOD_LABS = [
        ("lab1-recon", ["lab1-recon_recon_module", "lab1-recon_module"]),
        ("ot-water-treatment", ["ot-water-treatment_module"]),
        ("ot-railroad-north", ["ot-railroad-north_module"]),
        ("cloud-security-lab", ["cloud-security-lab_cloud_mod"]),
        ("ot-security-lab", ["ot-security-lab_module"]),
    ]

    CANONICAL_POINTS = [100, 150, 200, 250, 300]

    for lab_id, prefixes in STANDARD_5MOD_LABS:
        for idx, pts in enumerate(CANONICAL_POINTS, 1):
            for prefix in prefixes:
                mod_id = f"{prefix}{idx}"
                mod = session.query(LabModule).filter(LabModule.id == mod_id).first()
                if mod:
                    mod.points = pts
                    session.add(mod)

    session.flush()

    # 2. Re-derive score_events and user_lab_progress for all users
    users = session.query(User).filter(User.is_active == True).all()  # noqa: E712

    for user in users:
        events = session.query(ScoreEvent).filter(
            ScoreEvent.user_id == user.id,
            ScoreEvent.event_type == ScoreEventType.MODULE_COMPLETION
        ).all()

        for ev in events:
            mod = session.query(LabModule).filter(LabModule.id == ev.module_id).first()
            if mod and mod.points:
                ev.points = mod.points
                session.add(ev)

                # Sync user_lab_progress
                ulp = session.query(UserLabProgress).filter(
                    UserLabProgress.user_id == user.id,
                    UserLabProgress.module_id == ev.module_id,
                ).first()
                if ulp:
                    ulp.score = mod.points
                    session.add(ulp)

        session.flush()

        # Rebuild users.total_score from score_events
        new_total = session.query(func.sum(ScoreEvent.points)).filter(
            ScoreEvent.user_id == user.id
        ).scalar() or 0

        user.total_score = new_total
        session.add(user)
        invalidate_dashboard(str(user.id))

    invalidate_leaderboard()
    session.commit()
    print("Canonical points normalization & re-derivation complete.")


if __name__ == "__main__":
    with db_manager.transaction() as session:
        normalize_canonical_points(session)
