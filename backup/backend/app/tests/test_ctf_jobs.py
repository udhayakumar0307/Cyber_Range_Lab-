import os
import sys
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, AsyncMock

# Ensure the backend root is on sys.path
sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
)

import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
# Import all models to ensure they are registered in Base.metadata
import app.models.user
import app.models.ctf
import app.models.group

from app.models.ctf import CTF, CTFParticipation, CTFChallenge
from app.models.user import User
from app.jobs.ctf_jobs import (
    activate_scheduled_ctfs,
    expire_ended_ctfs,
    recalculate_dynamic_scores_task,
)

_DB_COUNTER = 0

def _make_session():
    global _DB_COUNTER
    _DB_COUNTER += 1
    db_path = f"/tmp/ctf_jobs_test_{_DB_COUNTER}.db"
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass

    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False}
    )

    # Clear indexes to avoid global index name conflicts in SQLite
    for table in Base.metadata.tables.values():
        table.indexes.clear()
        
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    session = Session()
    session._test_db_path = db_path
    session._test_engine = engine
    return session


class TestCTFJobsSuite(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = _make_session()
        # Mock close to prevent detaching instances during background job execution
        self.db.close = MagicMock()

    def tearDown(self):
        # Call the original close to clean up
        self.db.close.__sliced__ = True
        sa.orm.Session.close(self.db)
        try:
            if hasattr(self.db, "_test_db_path") and os.path.exists(self.db._test_db_path):
                os.remove(self.db._test_db_path)
        except Exception:
            pass

    @patch("app.jobs.ctf_jobs.db_manager.get_session")
    @patch("app.jobs.ctf_jobs.ctf_ws_manager.broadcast")
    async def test_activate_scheduled_ctfs(self, mock_broadcast, mock_get_session):
        mock_get_session.return_value = self.db
        
        # 1. Create a CTF whose start time has passed (should activate)
        now = datetime.utcnow()
        ctf_to_activate = CTF(
            title="Scheduled CTF",
            start_time=now - timedelta(minutes=5),
            end_time=now + timedelta(hours=2),
            status="scheduled",
            created_at=now,
            updated_at=now,
        )
        # 2. Create another scheduled CTF whose start time is in the future (should not activate)
        future_ctf = CTF(
            title="Future CTF",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=3),
            status="scheduled",
            created_at=now,
            updated_at=now,
        )
        self.db.add_all([ctf_to_activate, future_ctf])

        # 3. Create active student, inactive student, and admin users
        active_student = User(id=10, role="user", is_active=True, email="s1@test.com", password_hash="hash")
        inactive_student = User(id=11, role="user", is_active=False, email="s2@test.com", password_hash="hash")
        admin_user = User(id=12, role="admin", is_active=True, email="admin@test.com", password_hash="hash")
        self.db.add_all([active_student, inactive_student, admin_user])
        self.db.commit()

        # Run job
        await activate_scheduled_ctfs()

        # Refresh objects
        self.db.refresh(ctf_to_activate)
        self.db.refresh(future_ctf)

        # Assertions
        self.assertEqual(ctf_to_activate.status, "active")
        self.assertEqual(future_ctf.status, "scheduled")

        # Enrollment checks
        enrolled_active = self.db.query(CTFParticipation).filter(
            CTFParticipation.ctf_id == ctf_to_activate.id,
            CTFParticipation.participant_id == 10
        ).first()
        self.assertIsNotNone(enrolled_active)

        enrolled_inactive = self.db.query(CTFParticipation).filter(
            CTFParticipation.ctf_id == ctf_to_activate.id,
            CTFParticipation.participant_id == 11
        ).first()
        self.assertIsNone(enrolled_inactive)

        enrolled_admin = self.db.query(CTFParticipation).filter(
            CTFParticipation.ctf_id == ctf_to_activate.id,
            CTFParticipation.participant_id == 12
        ).first()
        self.assertIsNone(enrolled_admin)

        # WebSocket broadcast was made
        mock_broadcast.assert_any_call(ctf_to_activate.id, {"type": "ctf_started"})

    @patch("app.jobs.ctf_jobs.db_manager.get_session")
    @patch("app.jobs.ctf_jobs.ctf_ws_manager.broadcast")
    async def test_expire_ended_ctfs(self, mock_broadcast, mock_get_session):
        mock_get_session.return_value = self.db
        
        now = datetime.utcnow()
        # 1. Create an active CTF whose end time has passed (should expire)
        ctf_to_expire = CTF(
            title="Active CTF",
            start_time=now - timedelta(hours=2),
            end_time=now - timedelta(minutes=5),
            status="active",
            created_at=now,
            updated_at=now,
        )
        self.db.add(ctf_to_expire)
        self.db.flush()

        # 2. Add challenge target
        ch = CTFChallenge(
            ctf_id=ctf_to_expire.id,
            title="Chal 1",
            category="Web",
            description="desc",
            scoring_mode="static",
            static_points=500,
            solve_count=0,
            is_hidden=False,
            url_active=True,
            created_at=now,
            updated_at=now,
        )
        self.db.add(ch)
        self.db.commit()

        # Run job
        await expire_ended_ctfs()

        # Refresh
        self.db.refresh(ctf_to_expire)
        self.db.refresh(ch)

        # Assertions
        self.assertEqual(ctf_to_expire.status, "completed")
        self.assertFalse(ch.url_active)

        # WebSocket broadcast
        mock_broadcast.assert_any_call(ctf_to_expire.id, {"type": "ctf_ended"})

    @patch("app.jobs.ctf_jobs.db_manager.get_session")
    @patch("app.jobs.ctf_jobs.recalculate_dynamic_scores")
    @patch("app.jobs.ctf_jobs.ctf_ws_manager.broadcast")
    def test_recalculate_dynamic_scores_task(self, mock_broadcast, mock_recalc, mock_get_session):
        mock_get_session.return_value = self.db
        
        now = datetime.utcnow()
        ctf = CTF(title="Test", start_time=now, end_time=now, status="active", created_at=now, updated_at=now)
        self.db.add(ctf)
        self.db.flush()

        ch = CTFChallenge(
            ctf_id=ctf.id,
            title="Chal 1",
            category="Web",
            description="desc",
            scoring_mode="dynamic",
            dynamic_ceiling=1000,
            dynamic_floor=100,
            decay_constant=4.0,
            solve_count=0,
            is_hidden=False,
            url_active=True,
            created_at=now,
            updated_at=now,
        )
        self.db.add(ch)
        self.db.commit()

        # Call recalculate task
        recalculate_dynamic_scores_task(ch.id)

        # Assertions
        mock_recalc.assert_called_once_with(self.db, ch.id)
