from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 - register all models with Base.metadata
from app.models.base import Base
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.user_progress import UserProgress
from app.api.v1.endpoints.recon_api import (
    MODULE_IDS,
    _generate_recon_flag,
    submit_recon_flag,
)
from app.api.v1.endpoints.reporting import get_progress
from app.services.progress_service import get_user_lab_statistics


def test_recon_five_module_completion_appears_in_statistics():
    engine = create_engine("sqlite:///:memory:")
    # Some legacy CTF models reuse index names; SQLite requires them to be
    # unique across the database during this isolated metadata setup.
    for table in Base.metadata.tables.values():
        table.indexes.clear()
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    try:
        user = User(
            name="Recon Test Student",
            email="recon-statistics-test@example.com",
            password_hash="test",
            role="user",
            account_type="student",
            auth_type="INDIVIDUAL",
        )
        session.add(user)
        session.flush()

        session.add(
            Lab(
                id="lab1-recon",
                name="Network Reconnaissance Lab",
                category="recon",
                difficulty="Intermediate",
                max_points=1000,
                estimated_time=180,
                status="ACTIVE",
            )
        )
        session.add_all(
            [
                LabModule(
                    id=f"lab1-recon_module{number}",
                    lab_id="lab1-recon",
                    module_number=number,
                    title=f"Module {number}",
                    points=points,
                    track="recon",
                )
                for number, points in enumerate((100, 150, 200, 250, 300), start=1)
            ]
        )
        session.commit()

        for module_id in MODULE_IDS:
            response = submit_recon_flag(
                {"module": module_id, "flag": _generate_recon_flag(str(user.id), module_id)[0]},
                db=session,
                current_user=user,
            )
            assert response["correct"] is True

        progress_rows = session.query(UserLabProgress).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.status == "COMPLETED",
        ).all()
        legacy_rows = session.query(UserProgress).filter(
            UserProgress.user_id == str(user.id),
            UserProgress.completed == True,  # noqa: E712
        ).all()
        assert {row.module_id for row in progress_rows} == {
            f"lab1-recon_{module_id}" for module_id in MODULE_IDS
        }
        assert {row.module_id for row in legacy_rows} == set(MODULE_IDS)

        history = get_progress(lab_id=None, current_user=user, db=session)
        assert {row["module_id"] for row in history} == {
            f"lab1-recon_{module_id}" for module_id in MODULE_IDS
        }

        stats = get_user_lab_statistics(session, str(user.id), use_cache=False)
        assert stats["lab_completed_modules"]["lab1-recon"] == 5
        assert stats["completedLabs"] == 1
    finally:
        session.close()
        engine.dispose()
