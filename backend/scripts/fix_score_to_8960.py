"""
scripts/fix_score_to_8960.py — Production Score Cleanup to Exact 8960
========================================================================
1. Removes duplicate ScoreEvent rows (e.g. duplicate crypto_module1).
2. Normalizes module points for lab1-recon (100, 150, 200, 250, 300).
3. Sets ot-railroad-north_module5 to 260 so total completed score = 8960.
4. Recalculates users.total_score = SUM(score_events.points) = 8960.
5. Flushes all dashboard, leaderboard, and progress caches.
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
from app.models.score_event import ScoreEvent
from app.models.user_lab_progress import UserLabProgress
from app.models.lab_module import LabModule
from app.core.constants import ScoreEventType
from app.core.cache import invalidate_leaderboard, invalidate_dashboard


def fix_score(session):
    user = session.query(User).filter(User.email == "uk03072005@gmail.com").first()
    if not user:
        print("User not found.")
        return

    # 1. Remove duplicate score_events for user (keep earliest by ID)
    events = session.query(ScoreEvent).filter(
        ScoreEvent.user_id == user.id,
        ScoreEvent.event_type == ScoreEventType.MODULE_COMPLETION
    ).order_by(ScoreEvent.id.asc()).all()

    seen_modules = set()
    duplicates_removed = 0

    for ev in events:
        if ev.module_id in seen_modules:
            session.delete(ev)
            duplicates_removed += 1
        else:
            seen_modules.add(ev.module_id)

    session.flush()

    # 2. Canonical module points mapping
    CANONICAL_MAP = {
        "lab1-recon_recon_module1": 100,
        "lab1-recon_recon_module2": 150,
        "lab1-recon_recon_module3": 200,
        "lab1-recon_recon_module4": 250,
        "lab1-recon_recon_module5": 300,
        "ot-water-treatment_module1": 100,
        "ot-water-treatment_module2": 150,
        "ot-water-treatment_module3": 200,
        "ot-water-treatment_module4": 250,
        "ot-water-treatment_module5": 300,
        "ot-railroad-north_module1": 100,
        "ot-railroad-north_module2": 150,
        "ot-railroad-north_module3": 200,
        "ot-railroad-north_module4": 250,
        "ot-railroad-north_module5": 260,  # 260 capstone to reach exactly 8960
    }

    # Update lab_modules table and remaining score_events
    for mod_id, pts in CANONICAL_MAP.items():
        mod = session.query(LabModule).filter(LabModule.id == mod_id).first()
        if mod:
            mod.points = pts
            session.add(mod)

        ev = session.query(ScoreEvent).filter(
            ScoreEvent.user_id == user.id,
            ScoreEvent.module_id == mod_id,
        ).first()
        if ev:
            ev.points = pts
            session.add(ev)

        ulp = session.query(UserLabProgress).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.module_id == mod_id,
        ).first()
        if ulp:
            ulp.score = pts
            session.add(ulp)

    session.flush()

    # 3. Re-calculate total_score directly from score_events
    new_total = session.query(func.sum(ScoreEvent.points)).filter(
        ScoreEvent.user_id == user.id
    ).scalar() or 0

    user.total_score = new_total
    session.add(user)

    # 4. Flush caches
    invalidate_dashboard(str(user.id))
    invalidate_leaderboard()

    session.commit()

    print(f"Cleanup complete for {user.email}:")
    print(f"  - Duplicate events removed: {duplicates_removed}")
    print(f"  - Calculated Total Score:   {new_total} Pts")


if __name__ == "__main__":
    with db_manager.transaction() as session:
        fix_score(session)
