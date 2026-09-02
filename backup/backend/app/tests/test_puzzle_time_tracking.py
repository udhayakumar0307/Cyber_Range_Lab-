from datetime import datetime, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 - register all models with Base.metadata
from app.models.base import Base
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.api.v1.endpoints.techcorp_api import _ensure_level_started
from app.services.completion_service import CompletionService


def test_puzzle_level_tracks_real_elapsed_time_and_starts_next_level():
    engine = create_engine("sqlite:///:memory:")

    # Some legacy models reuse index names. SQLite requires index names to be
    # globally unique during this isolated metadata setup.
    for table in Base.metadata.tables.values():
        table.indexes.clear()

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    try:
        user = User(
            name="Puzzle Timing Student",
            email="puzzle-timing-test@example.com",
            password_hash="test",
            role="user",
            account_type="student",
            auth_type="INDIVIDUAL",
        )
        session.add(user)

        session.add(
            Lab(
                id="techcorp-sysadmin-labs",
                name="Puzzle Lab",
                category="sysadmin",
                difficulty="Intermediate",
                max_points=1000,
                estimated_time=180,
                status="ACTIVE",
            )
        )

        session.add_all(
            [
                LabModule(
                    id="techcorp_level0",
                    lab_id="techcorp-sysadmin-labs",
                    module_number=1,
                    title="Level 0",
                    points=50,
                    display_order=1,
                    track="puzzle",
                ),
                LabModule(
                    id="techcorp_level1",
                    lab_id="techcorp-sysadmin-labs",
                    module_number=2,
                    title="Level 1",
                    points=60,
                    display_order=2,
                    track="puzzle",
                ),
            ]
        )

        session.commit()

        # Pretend the student entered Level 0 about two minutes ago.
        level0_started_at = datetime.utcnow() - timedelta(seconds=125)

        level0 = _ensure_level_started(
            db=session,
            user_id=user.id,
            lab_id="techcorp-sysadmin-labs",
            assignment_id=None,
            level=0,
            started_at=level0_started_at,
        )

        assert level0.status == "STARTED"
        assert level0.attempts == 0
        assert level0.completed_at is None
        assert level0.started_at == level0_started_at

        # Re-entering/re-provisioning the same level must NOT reset its timer.
        same_level0 = _ensure_level_started(
            db=session,
            user_id=user.id,
            lab_id="techcorp-sysadmin-labs",
            assignment_id=None,
            level=0,
            started_at=datetime.utcnow(),
        )

        assert same_level0.id == level0.id
        assert same_level0.started_at == level0_started_at

        level0_count = (
            session.query(UserLabProgress)
            .filter(
                UserLabProgress.user_id == user.id,
                UserLabProgress.lab_id == "techcorp-sysadmin-labs",
                UserLabProgress.module_id == "techcorp_level0",
                UserLabProgress.assignment_id.is_(None),
            )
            .count()
        )
        assert level0_count == 1

        # Isolate timing/progress behavior from the score-ledger subsystem.
        with patch(
            "app.services.completion_service.ScoreService.award_module_points",
            return_value=(50, 50),
        ):
            CompletionService.complete_lab_module(
                db=session,
                user=user,
                lab_id="techcorp-sysadmin-labs",
                module_id="techcorp_level0",
                track_id="techcorp",
                base_points=50,
                submitted_flag=None,
                assignment_id=None,
            )

        session.flush()
        session.refresh(level0)

        assert level0.status == "COMPLETED"
        assert level0.completed_at is not None

        # Allow a little runtime variance around the 125-second setup.
        assert 120 <= level0.time_taken_seconds <= 135

        # STARTED rows begin at zero attempts; successful completion must
        # register at least one actual attempt.
        assert level0.attempts == 1

        # Advancing starts the next level's independent timer immediately.
        transition_time = datetime.utcnow()

        level1 = _ensure_level_started(
            db=session,
            user_id=user.id,
            lab_id="techcorp-sysadmin-labs",
            assignment_id=None,
            level=1,
            started_at=transition_time,
        )

        assert level1.module_id == "techcorp_level1"
        assert level1.status == "STARTED"
        assert level1.completed_at is None
        assert level1.attempts == 0
        assert abs((level1.started_at - transition_time).total_seconds()) < 1

        assert (
            session.query(UserLabProgress)
            .filter(
                UserLabProgress.user_id == user.id,
                UserLabProgress.lab_id == "techcorp-sysadmin-labs",
            )
            .count()
            == 2
        )

    finally:
        session.close()
        engine.dispose()
