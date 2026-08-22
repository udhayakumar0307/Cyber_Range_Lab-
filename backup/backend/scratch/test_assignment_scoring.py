"""
Acceptance test for assignment-scoped progress and scoring.

Verifies:
1. Student can complete module under Assignment A.
2. Duplicate under Assignment A is blocked.
3. Same module under Assignment B is allowed.
4. Another student can independently complete same module.
5. Legacy/personal assignment_id=None still preserves duplicate protection.
"""

import os
import sys
from datetime import datetime, timedelta

sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)

from app.database.manager import db_manager
from app.models.assignment import Assignment
from app.models.lab import Lab
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.score_event import ScoreEvent
from app.services.completion_service import CompletionService


LAB_ID = "lab1-recon"
MODULE_ID = "lab1-recon_module1"


def main():
    db = db_manager.get_session()

    created_assignment_ids = []
    created_event_ids = []
    created_progress_ids = []

    try:
        # -------------------------------------------------------------
        # Find test users
        # -------------------------------------------------------------
        students = (
            db.query(User)
            .filter(User.role.ilike("%user%"))
            .order_by(User.id.asc())
            .limit(2)
            .all()
        )

        if len(students) < 2:
            raise RuntimeError(
                "Need at least two student users in the database."
            )

        alice = students[0]
        bob = students[1]

        lab = db.query(Lab).filter(Lab.id == LAB_ID).first()

        if not lab:
            raise RuntimeError(
                f"Lab {LAB_ID!r} does not exist."
            )

        print("=" * 80)
        print("ASSIGNMENT-SCOPED SCORING ACCEPTANCE TEST")
        print("=" * 80)

        print(
            f"Alice: id={alice.id}, email={alice.email}"
        )
        print(
            f"Bob:   id={bob.id}, email={bob.email}"
        )

        # -------------------------------------------------------------
        # Create Assignment A and Assignment B
        # -------------------------------------------------------------
        now = datetime.utcnow()

        assignment_a = Assignment(
            lab_id=LAB_ID,
            student_id=alice.id,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            status="Assigned",
            assigned_by="assignment-scope-test",
        )

        assignment_b = Assignment(
            lab_id=LAB_ID,
            student_id=alice.id,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            status="Assigned",
            assigned_by="assignment-scope-test",
        )

        db.add_all([assignment_a, assignment_b])
        db.flush()

        created_assignment_ids.extend([
            assignment_a.id,
            assignment_b.id,
        ])

        print(
            f"\nAssignment A = {assignment_a.id}"
        )
        print(
            f"Assignment B = {assignment_b.id}"
        )

        # -------------------------------------------------------------
        # CASE A
        # Alice completes module under Assignment A
        # -------------------------------------------------------------
        result_a = CompletionService.complete_lab_module(
            db=db,
            user=alice,
            lab_id=LAB_ID,
            module_id=MODULE_ID,
            base_points=100,
            assignment_id=assignment_a.id,
        )

        db.flush()

        assert result_a.already_completed is False, (
            "CASE A FAILED: first completion was treated as duplicate"
        )

        print(
            "\n✅ CASE A:"
            " Alice completed module under Assignment A"
        )

        # -------------------------------------------------------------
        # CASE B
        # Alice attempts same module again under Assignment A
        # -------------------------------------------------------------
        result_duplicate = CompletionService.complete_lab_module(
            db=db,
            user=alice,
            lab_id=LAB_ID,
            module_id=MODULE_ID,
            base_points=100,
            assignment_id=assignment_a.id,
        )

        assert result_duplicate.already_completed is True, (
            "CASE B FAILED: duplicate was not blocked"
        )

        print(
            "✅ CASE B:"
            " duplicate under Assignment A was blocked"
        )

        # -------------------------------------------------------------
        # CASE C
        # Same Alice + same module + Assignment B
        # -------------------------------------------------------------
        result_b = CompletionService.complete_lab_module(
            db=db,
            user=alice,
            lab_id=LAB_ID,
            module_id=MODULE_ID,
            base_points=100,
            assignment_id=assignment_b.id,
        )

        db.flush()

        assert result_b.already_completed is False, (
            "CASE C FAILED:"
            " completion under different assignment was blocked"
        )

        print(
            "✅ CASE C:"
            " same module under Assignment B was allowed"
        )

        # -------------------------------------------------------------
        # CASE D
        # Bob completes same module
        # -------------------------------------------------------------
        assignment_bob = Assignment(
            lab_id=LAB_ID,
            student_id=bob.id,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            status="Assigned",
            assigned_by="assignment-scope-test",
        )

        db.add(assignment_bob)
        db.flush()

        created_assignment_ids.append(
            assignment_bob.id
        )

        result_bob = CompletionService.complete_lab_module(
            db=db,
            user=bob,
            lab_id=LAB_ID,
            module_id=MODULE_ID,
            base_points=100,
            assignment_id=assignment_bob.id,
        )

        db.flush()

        assert result_bob.already_completed is False, (
            "CASE D FAILED:"
            " Bob's independent completion was blocked"
        )

        print(
            "✅ CASE D:"
            " Bob independently completed the same module"
        )

        # -------------------------------------------------------------
        # CASE E
        # Legacy / personal run
        # -------------------------------------------------------------
        existing_personal = (
            db.query(ScoreEvent)
            .filter(
                ScoreEvent.user_id == alice.id,
                ScoreEvent.module_id == MODULE_ID,
                ScoreEvent.assignment_id.is_(None),
                ScoreEvent.event_type == "MODULE_COMPLETION",
            )
            .first()
        )

        if existing_personal:
            print(
                "⚠️ CASE E skipped:"
                " Alice already has a legacy/personal completion"
            )
        else:
            personal_first = CompletionService.complete_lab_module(
                db=db,
                user=alice,
                lab_id=LAB_ID,
                module_id=MODULE_ID,
                base_points=100,
                assignment_id=None,
            )

            db.flush()

            assert personal_first.already_completed is False

            personal_second = CompletionService.complete_lab_module(
                db=db,
                user=alice,
                lab_id=LAB_ID,
                module_id=MODULE_ID,
                base_points=100,
                assignment_id=None,
            )

            assert personal_second.already_completed is True

            print(
                "✅ CASE E:"
                " legacy/personal duplicate behavior preserved"
            )

        # -------------------------------------------------------------
        # Inspect generated records
        # -------------------------------------------------------------
        events = (
            db.query(ScoreEvent)
            .filter(
                ScoreEvent.user_id.in_(
                    [alice.id, bob.id]
                ),
                ScoreEvent.module_id == MODULE_ID,
            )
            .all()
        )

        print("\nScore events:")
        for event in events:
            print(
                f"  event={event.id}, "
                f"user={event.user_id}, "
                f"assignment={event.assignment_id}, "
                f"points={event.points}"
            )

        progress_rows = (
            db.query(UserLabProgress)
            .filter(
                UserLabProgress.user_id.in_(
                    [alice.id, bob.id]
                ),
                UserLabProgress.module_id == MODULE_ID,
            )
            .all()
        )

        print("\nProgress rows:")
        for row in progress_rows:
            print(
                f"  progress={row.id}, "
                f"user={row.user_id}, "
                f"assignment={row.assignment_id}, "
                f"status={row.status}, "
                f"score={row.score}"
            )

        print("\n" + "=" * 80)
        print("✅ ALL ASSIGNMENT-SCOPING TESTS PASSED")
        print("=" * 80)

        # IMPORTANT:
        # Roll everything back because this is an acceptance test.
        db.rollback()

        print(
            "\nTest transaction rolled back."
        )

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()