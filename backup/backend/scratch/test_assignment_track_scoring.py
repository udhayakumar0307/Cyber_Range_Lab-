"""
Acceptance tests for assignment-scoped track-based progress and scoring.

Tests:
A. Alice completes linux/module1 under Assignment A.
B. Duplicate under Assignment A is blocked.
C. Same module under Assignment B is allowed.
D. Bob independently completes the same module.
E. UserProgress rows retain the correct assignment_id.
F. ScoreEvent rows retain the correct assignment_id.
G. Hint penalty retains assignment_id.

All changes are rolled back at the end.
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
from app.models.user_progress import UserProgress
from app.models.score_event import ScoreEvent

from app.services.completion_service import CompletionService
from app.services.score_service import ScoreService

from app.core.constants import ScoreEventType


LAB_ID = "command-line-lab"
TRACK_ID = "linux"
MODULE_ID = "module1"

CANONICAL_MODULE_ID = (
    f"{LAB_ID}_{TRACK_ID}_{MODULE_ID}"
)


def main():
    db = db_manager.get_session()

    try:
        # ---------------------------------------------------------
        # Find two ordinary student accounts
        # ---------------------------------------------------------

        students = (
            db.query(User)
            .filter(User.role.ilike("%user%"))
            .order_by(User.id.asc())
            .limit(2)
            .all()
        )

        if len(students) < 2:
            raise RuntimeError(
                "Need at least two student users "
                "to run this acceptance test."
            )

        alice = students[0]
        bob = students[1]

        # ---------------------------------------------------------
        # Confirm the lab exists
        # ---------------------------------------------------------

        lab = (
            db.query(Lab)
            .filter(Lab.id == LAB_ID)
            .first()
        )

        if not lab:
            raise RuntimeError(
                f"Required lab {LAB_ID!r} does not exist."
            )

        print("=" * 80)
        print(
            "TRACK-BASED ASSIGNMENT-SCOPED "
            "SCORING ACCEPTANCE TEST"
        )
        print("=" * 80)

        print(
            f"Alice: id={alice.id}, "
            f"email={alice.email}"
        )

        print(
            f"Bob:   id={bob.id}, "
            f"email={bob.email}"
        )

        now = datetime.utcnow()

        # ---------------------------------------------------------
        # Create two assignments for Alice
        # ---------------------------------------------------------

        assignment_a = Assignment(
            lab_id=LAB_ID,
            student_id=alice.id,
            start_datetime=(
                now - timedelta(minutes=5)
            ),
            end_datetime=(
                now + timedelta(hours=1)
            ),
            status="Assigned",
            assigned_by="track-scope-test",
        )

        assignment_b = Assignment(
            lab_id=LAB_ID,
            student_id=alice.id,
            start_datetime=(
                now - timedelta(minutes=5)
            ),
            end_datetime=(
                now + timedelta(hours=1)
            ),
            status="Assigned",
            assigned_by="track-scope-test",
        )

        db.add_all([
            assignment_a,
            assignment_b,
        ])

        db.flush()

        print(
            f"\nAssignment A = {assignment_a.id}"
        )

        print(
            f"Assignment B = {assignment_b.id}"
        )

        # =========================================================
        # CASE A
        # First completion under Assignment A
        # =========================================================

        result_a = (
            CompletionService.complete_track_module(
                db=db,
                user=alice,
                lab_id=LAB_ID,
                track_id=TRACK_ID,
                module_id=MODULE_ID,
                base_points=100,
                assignment_id=assignment_a.id,
            )
        )

        db.flush()

        assert (
            result_a.already_completed is False
        ), (
            "CASE A FAILED: "
            "first completion was treated as duplicate"
        )

        print(
            "\n✅ CASE A: "
            "Alice completed track module "
            "under Assignment A"
        )

        # =========================================================
        # CASE B
        # Duplicate under Assignment A
        # =========================================================

        duplicate_a = (
            CompletionService.complete_track_module(
                db=db,
                user=alice,
                lab_id=LAB_ID,
                track_id=TRACK_ID,
                module_id=MODULE_ID,
                base_points=100,
                assignment_id=assignment_a.id,
            )
        )

        assert (
            duplicate_a.already_completed is True
        ), (
            "CASE B FAILED: "
            "duplicate under the same assignment "
            "was not blocked"
        )

        print(
            "✅ CASE B: "
            "duplicate under Assignment A blocked"
        )

        # =========================================================
        # CASE C
        # Same student/module under Assignment B
        # =========================================================

        result_b = (
            CompletionService.complete_track_module(
                db=db,
                user=alice,
                lab_id=LAB_ID,
                track_id=TRACK_ID,
                module_id=MODULE_ID,
                base_points=100,
                assignment_id=assignment_b.id,
            )
        )

        db.flush()

        assert (
            result_b.already_completed is False
        ), (
            "CASE C FAILED: "
            "same module under different assignment "
            "was incorrectly blocked"
        )

        print(
            "✅ CASE C: "
            "same track module under Assignment B "
            "was allowed"
        )

        # =========================================================
        # CASE D
        # Independent student
        # =========================================================

        assignment_bob = Assignment(
            lab_id=LAB_ID,
            student_id=bob.id,
            start_datetime=(
                now - timedelta(minutes=5)
            ),
            end_datetime=(
                now + timedelta(hours=1)
            ),
            status="Assigned",
            assigned_by="track-scope-test",
        )

        db.add(assignment_bob)
        db.flush()

        result_bob = (
            CompletionService.complete_track_module(
                db=db,
                user=bob,
                lab_id=LAB_ID,
                track_id=TRACK_ID,
                module_id=MODULE_ID,
                base_points=100,
                assignment_id=assignment_bob.id,
            )
        )

        db.flush()

        assert (
            result_bob.already_completed is False
        ), (
            "CASE D FAILED: "
            "Bob's independent completion was blocked"
        )

        print(
            "✅ CASE D: "
            "Bob independently completed "
            "the same track module"
        )

        # =========================================================
        # CASE E
        # Verify UserProgress assignment identities
        # =========================================================

        alice_progress = (
            db.query(UserProgress)
            .filter(
                UserProgress.user_id
                == str(alice.id),

                UserProgress.track_id
                == TRACK_ID,

                UserProgress.module_id
                == MODULE_ID,

                UserProgress.assignment_id.in_([
                    assignment_a.id,
                    assignment_b.id,
                ]),
            )
            .order_by(
                UserProgress.assignment_id.asc()
            )
            .all()
        )

        assert len(alice_progress) == 2, (
            "CASE E FAILED: expected two independent "
            "UserProgress rows for Alice"
        )

        assert {
            row.assignment_id
            for row in alice_progress
        } == {
            assignment_a.id,
            assignment_b.id,
        }, (
            "CASE E FAILED: UserProgress assignment "
            "identities do not match"
        )

        print(
            "✅ CASE E: "
            "UserProgress contains independent "
            "assignment-scoped rows"
        )

        # =========================================================
        # CASE F
        # Verify ScoreEvent assignment identities
        # =========================================================

        alice_events = (
            db.query(ScoreEvent)
            .filter(
                ScoreEvent.user_id
                == alice.id,

                ScoreEvent.module_id
                == CANONICAL_MODULE_ID,

                ScoreEvent.event_type
                == ScoreEventType.MODULE_COMPLETION,

                ScoreEvent.assignment_id.in_([
                    assignment_a.id,
                    assignment_b.id,
                ]),
            )
            .order_by(
                ScoreEvent.assignment_id.asc()
            )
            .all()
        )

        assert len(alice_events) == 2, (
            "CASE F FAILED: expected two independent "
            "ScoreEvent completion rows"
        )

        assert {
            event.assignment_id
            for event in alice_events
        } == {
            assignment_a.id,
            assignment_b.id,
        }, (
            "CASE F FAILED: ScoreEvent assignment "
            "identities do not match"
        )

        print(
            "✅ CASE F: "
            "ScoreEvent contains correct "
            "assignment identities"
        )

        # =========================================================
        # CASE G
        # Assignment-scoped hint penalty
        # =========================================================

        ScoreService.record_hint_penalty(
            db=db,
            user=alice,
            lab_id=LAB_ID,
            module_id=CANONICAL_MODULE_ID,
            track_id=TRACK_ID,
            penalty_points=20,
            assignment_id=assignment_a.id,
        )

        db.flush()

        penalty_event = (
            db.query(ScoreEvent)
            .filter(
                ScoreEvent.user_id
                == alice.id,

                ScoreEvent.module_id
                == CANONICAL_MODULE_ID,

                ScoreEvent.event_type
                == ScoreEventType.HINT_PENALTY,

                ScoreEvent.assignment_id
                == assignment_a.id,
            )
            .first()
        )

        assert penalty_event is not None, (
            "CASE G FAILED: "
            "hint penalty ScoreEvent not found"
        )

        assert (
            penalty_event.assignment_id
            == assignment_a.id
        ), (
            "CASE G FAILED: "
            "hint penalty lost assignment context"
        )

        assert penalty_event.points == -20, (
            "CASE G FAILED: "
            f"expected -20 points, "
            f"got {penalty_event.points}"
        )

        print(
            "✅ CASE G: "
            "hint penalty retained assignment context"
        )

        # =========================================================
        # Diagnostics
        # =========================================================

        print("\nUserProgress rows:")

        progress_rows = (
            db.query(UserProgress)
            .filter(
                UserProgress.user_id.in_([
                    str(alice.id),
                    str(bob.id),
                ]),
                UserProgress.track_id == TRACK_ID,
                UserProgress.module_id == MODULE_ID,
                UserProgress.assignment_id.isnot(None),
            )
            .order_by(UserProgress.id.asc())
            .all()
        )

        for row in progress_rows:
            print(
                f"  progress={row.id}, "
                f"user={row.user_id}, "
                f"assignment={row.assignment_id}, "
                f"track={row.track_id}, "
                f"module={row.module_id}, "
                f"score={row.module_score}, "
                f"completed={row.completed}"
            )

        print("\nScoreEvent rows:")

        events = (
            db.query(ScoreEvent)
            .filter(
                ScoreEvent.user_id.in_([
                    alice.id,
                    bob.id,
                ]),
                ScoreEvent.assignment_id.isnot(None),
                ScoreEvent.module_id
                == CANONICAL_MODULE_ID,
            )
            .order_by(ScoreEvent.id.asc())
            .all()
        )

        for event in events:
            print(
                f"  event={event.id}, "
                f"user={event.user_id}, "
                f"assignment={event.assignment_id}, "
                f"type={event.event_type}, "
                f"points={event.points}"
            )

        print("\n" + "=" * 80)
        print(
            "✅ ALL TRACK-BASED ASSIGNMENT "
            "SCOPING TESTS PASSED"
        )
        print("=" * 80)

        # ---------------------------------------------------------
        # Acceptance test must leave no fake data behind
        # ---------------------------------------------------------

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