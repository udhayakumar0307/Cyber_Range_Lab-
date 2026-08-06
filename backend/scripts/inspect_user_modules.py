"""
scripts/inspect_user_modules.py — Inspect Score Events and Modules for User 5
=============================================================================
Prints all score_events and user_lab_progress for uk03072005@gmail.com
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


def inspect(session):
    user = session.query(User).filter(User.email == "uk03072005@gmail.com").first()
    if not user:
        print("User not found.")
        return

    print(f"USER: {user.name} ({user.email}) | ID: {user.id} | users.total_score = {user.total_score}")
    print("=" * 90)

    events = session.query(ScoreEvent).filter(ScoreEvent.user_id == user.id).order_by(ScoreEvent.id.asc()).all()

    running = 0
    for idx, ev in enumerate(events, 1):
        mod = session.query(LabModule).filter(LabModule.id == ev.module_id).first()
        mod_pts = mod.points if mod else "N/A"
        running += ev.points
        print(f"{idx:<3} | Lab: {ev.lab_id:<20} | Module: {ev.module_id:<32} | EvPts: {ev.points:<5} | ModPts: {mod_pts:<5} | Running: {running:<6}")

    print("=" * 90)
    print(f"Total Events: {len(events)} | Sum of Score Events: {running}")


if __name__ == "__main__":
    with db_manager.transaction() as session:
        inspect(session)
