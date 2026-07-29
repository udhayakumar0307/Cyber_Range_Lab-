"""
scripts/trace_user_score.py — Detailed Module-by-Module Score Tracer
======================================================================
Traces every completed module for user uk03072005@gmail.com (ID 5), comparing:
  - Configured LabModule points
  - Stored user_lab_progress score
  - ScoreEvent points
  - Running totals
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
setup_logging()

from app.database.manager import db_manager
db_manager.init_db()

from sqlalchemy import desc
from app.models.user import User
from app.models.score_event import ScoreEvent
from app.models.user_lab_progress import UserLabProgress
from app.models.lab_module import LabModule


def trace_user(session, email: str = "uk03072005@gmail.com"):
    user = session.query(User).filter(User.email == email).first()
    if not user:
        print(f"User {email} not found.")
        return

    print("==========================================================================================")
    print(f"MODULE-BY-MODULE SCORE TRACE FOR USER: {user.name} ({user.email}) | ID: {user.id}")
    print(f"Current users.total_score in DB: {user.total_score}")
    print("==========================================================================================\n")

    events = session.query(ScoreEvent).filter(
        ScoreEvent.user_id == user.id
    ).order_by(ScoreEvent.created_at.asc(), ScoreEvent.id.asc()).all()

    running_expected = 0
    running_actual = 0

    print(f"{'#':<3} | {'Lab':<20} | {'Module ID':<32} | {'Config':<6} | {'Event':<6} | {'Run Expected':<12} | {'Run Actual':<12} | {'Diff':<5}")
    print("-" * 115)

    discrepancies = []

    for idx, ev in enumerate(events, 1):
        mod = session.query(LabModule).filter(LabModule.id == ev.module_id).first()
        config_pts = mod.points if (mod and mod.points) else ev.points

        # What should have been awarded vs what was awarded in event
        expected_pts = config_pts
        actual_pts = ev.points

        running_expected += expected_pts
        running_actual += actual_pts

        diff = running_actual - running_expected

        if diff != 0 and not discrepancies:
            discrepancies.append((idx, ev.lab_id, ev.module_id, config_pts, actual_pts, running_expected, running_actual))

        print(f"{idx:<3} | {ev.lab_id:<20} | {ev.module_id:<32} | {config_pts:<6} | {actual_pts:<6} | {running_expected:<12} | {running_actual:<12} | {diff:<5}")

    print("\n==========================================================================================")
    print(f"TOTAL SCORE EVENTS: {len(events)}")
    print(f"SUM OF CONFIG MODULE POINTS (EXPECTED): {running_expected}")
    print(f"SUM OF SCORE EVENTS POINTS (ACTUAL):   {running_actual}")
    print(f"CURRENT DB USERS.TOTAL_SCORE:           {user.total_score}")
    print("==========================================================================================")

    if discrepancies:
        print("\nFIRST POINT DISCREPANCY DETECTED AT:")
        for d in discrepancies:
            print(f"  Step #{d[0]}: Lab={d[1]}, Module={d[2]}, ConfigPoints={d[3]}, EventPoints={d[4]}, ExpectedTotal={d[5]}, ActualTotal={d[6]}")


if __name__ == "__main__":
    with db_manager.transaction() as session:
        trace_user(session)
