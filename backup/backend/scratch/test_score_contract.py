"""Point #7 score-unit contract acceptance and regression test."""

from datetime import datetime, timedelta
from pathlib import Path

from app.database.session import SessionLocal
from app.models.assignment import Assignment
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.score_event import ScoreEvent
from app.models.user import User
from app.services.gradebook_service import GradebookService
from app.services.rubric_service import RubricService
from app.services.score_contract_service import ScoreContractService


def run():
    print("=" * 80)
    print("POINT #7 SCORE CONTRACT ACCEPTANCE TEST")
    print("=" * 80)

    # Pure unit semantics: mathematically equivalent ratios must produce the
    # same 0..100 percentage regardless of raw magnitude.
    assert ScoreContractService.normalize_percent(700, 1000) == 70.0
    assert ScoreContractService.normalize_percent(70, 100) == 70.0
    assert ScoreContractService.normalize_percent(0.7, 1) == 70.0
    assert ScoreContractService.normalize_percent(50, 0) is None
    assert ScoreContractService.normalize_percent(50, None) is None
    assert ScoreContractService.normalize_percent(120, 100) == 100.0
    print("✅ CASE A: 700/1000, 70/100, and 0.7/1 all normalize to 70%")
    print("✅ CASE B: unavailable denominator returns None, not a fake 0%")
    print("✅ CASE C: current academic percentage policy caps at 100%")

    db = SessionLocal()
    tx = db.begin_nested()

    try:
        users = (
            db.query(User)
            .filter(~User.role.ilike("%admin%"))
            .order_by(User.id.asc())
            .limit(2)
            .all()
        )
        assert users, "Need at least one non-admin user."
        student = users[0]
        grader = users[1] if len(users) > 1 else users[0]

        lab = db.query(Lab).join(LabModule, LabModule.lab_id == Lab.id).first()
        assert lab is not None, "Need a lab with LabModules."

        modules = (
            db.query(LabModule)
            .filter(LabModule.lab_id == lab.id)
            .order_by(LabModule.display_order.asc(), LabModule.module_number.asc())
            .all()
        )
        assert modules, "Need at least one LabModule."

        now = datetime.utcnow()
        assignment = Assignment(
            lab_id=lab.id,
            student_id=student.id,
            group_id=None,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            status="Assigned",
            assigned_by=str(grader.id),
        )
        db.add(assignment)
        db.flush()
        RubricService.snapshot_assignment(
            db,
            assignment.id,
            created_by=grader.id,
        )
        db.flush()

        first = modules[0]
        db.add(
            ScoreEvent(
                assignment_id=assignment.id,
                user_id=student.id,
                lab_id=lab.id,
                track_id=first.track,
                module_id=first.id,
                event_type="MODULE_COMPLETION",
                points=first.points,
                created_at=now,
            )
        )
        db.flush()

        contract = ScoreContractService.get_assignment_score(
            db,
            assignment,
            student.id,
        )
        possible = sum(float(module.points or 0) for module in modules)
        expected = ScoreContractService.normalize_percent(
            float(first.points or 0),
            possible,
        )

        assert contract["score_earned"] == float(first.points or 0)
        assert contract["score_possible"] == possible
        assert contract["score_percent"] == expected
        assert contract["score_units"] == "points"
        assert contract["percent_units"] == "percent_0_100"
        print("✅ CASE D: DB assignment ledger exposes explicit earned/possible/percent")

        # A separate assignment-scoped penalty must affect raw earned points
        # and therefore the normalized score without changing the denominator.
        db.add(
            ScoreEvent(
                assignment_id=assignment.id,
                user_id=student.id,
                lab_id=lab.id,
                track_id=first.track,
                module_id=first.id,
                event_type="HINT_PENALTY",
                points=-20,
                created_at=now + timedelta(seconds=1),
            )
        )
        db.flush()

        penalized = ScoreContractService.get_assignment_score(
            db,
            assignment,
            student.id,
        )
        assert penalized["score_earned"] == max(
            0.0,
            float(first.points or 0) - 20.0,
        )
        assert penalized["score_possible"] == possible
        print("✅ CASE E: assignment-scoped penalties change earned points, not possible points")

        book = GradebookService.get_gradebook(db, assignment.id)
        row = book["students"][0]

        assert "score_earned" in row
        assert "score_possible" in row
        assert "score_percent" in row
        assert "rubric_percent" in row
        assert "final_percent" in row
        assert "auto_score_earned" not in row
        assert "auto_percent" not in row
        assert "final_score" not in row
        assert row["score_earned"] == penalized["score_earned"]
        assert row["score_percent"] == penalized["score_percent"]
        print("✅ CASE F: gradebook API exposes only explicit public score units")

        summary = book["summary"]
        assert "average_score_earned" in summary
        assert "average_score_percent" in summary
        assert "average_auto_percent" not in summary
        assert "average_score" not in summary
        print("✅ CASE G: gradebook summary has no ambiguous average_score field")

        print("=" * 80)
        print("✅ ALL POINT #7 SCORE CONTRACT TESTS PASSED")
        print("=" * 80)

    finally:
        tx.rollback()
        db.rollback()
        db.close()
        print("Test transaction rolled back.")


if __name__ == "__main__":
    run()
