"""
scripts/rederive_user_events.py — Score Ledger Migration & Re-derivation Utility
==================================================================================
Migrates legacy score_events and user_lab_progress rows to match configured
LabModule.points exactly (no -1 deductions, no stale calculations).

Steps:
  1. For every user, find all completed modules.
  2. Lookup canonical configured points from LabModule.points.
  3. Update/insert ScoreEvent rows to match configured points exactly.
  4. Update user_lab_progress.score to match configured points.
  5. Rebuild users.total_score = SUM(score_events.points).
  6. Invalidate dashboard and leaderboard caches.
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


def rederive_user_scores(session):
    users = session.query(User).filter(User.is_active == True).all()  # noqa: E712

    print("==========================================================================")
    print("           CYBERRANGE SCORE LEDGER MIGRATION & RE-DERIVATION             ")
    print("==========================================================================\n")

    for user in users:
        # Find all completed progress rows or score events for this user
        events = session.query(ScoreEvent).filter(
            ScoreEvent.user_id == user.id,
            ScoreEvent.event_type == ScoreEventType.MODULE_COMPLETION
        ).order_by(ScoreEvent.id.asc()).all()

        if not events:
            continue

        updated_count = 0
        running_configured = 0

        for ev in events:
            mod = session.query(LabModule).filter(LabModule.id == ev.module_id).first()
            if not mod or not mod.points:
                continue

            configured_pts = mod.points
            running_configured += configured_pts

            if ev.points != configured_pts:
                ev.points = configured_pts
                session.add(ev)
                updated_count += 1

            # Sync matching UserLabProgress row
            ulp = session.query(UserLabProgress).filter(
                UserLabProgress.user_id == user.id,
                UserLabProgress.module_id == ev.module_id,
            ).first()
            if ulp:
                ulp.score = configured_pts
                session.add(ulp)

        # Re-derive total_score cache from updated score_events
        new_total = session.query(func.sum(ScoreEvent.points)).filter(
            ScoreEvent.user_id == user.id
        ).scalar() or 0

        user.total_score = new_total
        session.add(user)

        print(f"User ID: {user.id:<4} | Email: {user.email:<25}")
        print(f"  - Score Events Updated: {updated_count}")
        print(f"  - Configured Total:     {running_configured}")
        print(f"  - New users.total_score:{new_total}")
        print("-" * 72)

        invalidate_dashboard(str(user.id))

    invalidate_leaderboard()
    session.commit()
    print("\nMigration & Re-derivation Complete.")


if __name__ == "__main__":
    with db_manager.transaction() as session:
        rederive_user_scores(session)
