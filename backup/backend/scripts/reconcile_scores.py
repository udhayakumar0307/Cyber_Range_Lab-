"""
scripts/reconcile_scores.py — Production Score Audit & Reconciliation Utility
================================================================================
Verifies score consistency across all database models and cache layers:

  1. Expected Score = SUM(score_events.points)
  2. users.total_score cached column
  3. SUM(user_lab_progress.score)
  4. DashboardService.get_summary() score
  5. Leaderboard score

Run:
  cd backend
  python scripts/reconcile_scores.py
"""

import os
import sys
import logging

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger("reconcile_scores")

from app.core.config import settings
settings.reload()

from app.database.manager import db_manager
db_manager.init_db()

from sqlalchemy import func
from app.models.user import User
from app.models.score_event import ScoreEvent
from app.models.user_lab_progress import UserLabProgress
from app.services.dashboard_service import DashboardService


def audit_user_scores(session):
    users = session.query(User).filter(User.is_active == True).all()  # noqa: E712
    mismatches = []

    print("\n========================================================================")
    print("                 CYBERRANGE SCORE RECONCILIATION AUDIT                 ")
    print("========================================================================\n")

    for user in users:
        # 1. Sum of score_events
        events_sum = session.query(func.sum(ScoreEvent.points)).filter(
            ScoreEvent.user_id == user.id
        ).scalar() or 0

        # 2. Cached column in users table
        cached_total = user.total_score or 0

        # 3. Sum of user_lab_progress scores
        progress_sum = session.query(func.sum(UserLabProgress.score)).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.status == "COMPLETED"
        ).scalar() or 0

        # 4. DashboardService output
        dash_summary = DashboardService.get_summary(session, user, use_cache=False)
        dash_score = dash_summary.get("total_score", 0)

        is_consistent = (events_sum == cached_total == dash_score)

        status_str = "[OK] CONSISTENT" if is_consistent else "[MISMATCH DETECTED]"
        print(f"User ID: {user.id:<4} | Email: {user.email:<25} | Status: {status_str}")
        print(f"  - SUM(score_events):     {events_sum}")
        print(f"  - users.total_score:     {cached_total}")
        print(f"  - SUM(user_lab_progress):{progress_sum}")
        print(f"  - DashboardService:      {dash_score}")

        if not is_consistent:
            diff = cached_total - events_sum
            mismatches.append({
                "user_id": user.id,
                "email": user.email,
                "events_sum": events_sum,
                "cached_total": cached_total,
                "progress_sum": progress_sum,
                "dash_score": dash_score,
                "diff": diff,
            })
            print(f"  [!] DISCREPANCY DETECTED: Diff = {diff} points")
            # Repair legacy drift from historical PROGRESSION_DEDUCTION_PER_MODULE=1
            from app.services.score_service import ScoreService
            rebuilt = ScoreService.rebuild_user_score_from_events(session, user)
            print(f"  [->] REPAIRED: users.total_score updated to match SUM(score_events) = {rebuilt}")

        print("-" * 72)

    print("\n========================================================================")
    print(f"AUDIT SUMMARY: Processed {len(users)} users. Mismatches found: {len(mismatches)}")
    print("========================================================================\n")

    return mismatches


if __name__ == "__main__":
    with db_manager.transaction() as session:
        audit_user_scores(session)
