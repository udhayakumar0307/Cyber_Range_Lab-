"""Point #6 formal rubric acceptance test."""

from datetime import datetime, timedelta

from fastapi import HTTPException

from app.database.session import SessionLocal
from app.models.assignment import Assignment
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.rubric import AssignmentRubric
from app.models.score_event import ScoreEvent
from app.models.user import User
from app.services.gradebook_service import GradebookService
from app.services.rubric_service import RubricService


def run():
    db = SessionLocal()
    tx = db.begin_nested()

    try:
        print("=" * 80)
        print("FORMAL GRADING RUBRIC ACCEPTANCE TEST")
        print("=" * 80)

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
            .limit(2)
            .all()
        )
        assert modules, "Need at least one LabModule."
        module = modules[0]

        # Version 1: default auto rubric.
        default = RubricService.generate_default_payload(db, lab.id)
        v1 = RubricService.create_version(
            db,
            lab.id,
            default,
            created_by=grader.id,
        )

        now = datetime.utcnow()
        a1 = Assignment(
            lab_id=lab.id,
            student_id=student.id,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            status="Assigned",
            assigned_by=str(grader.id),
        )
        db.add(a1)
        db.flush()
        s1 = RubricService.snapshot_assignment(db, a1.id, grader.id)

        assert s1.rubric_version == v1.version
        print("✅ CASE A: assignment captured immutable rubric version 1")

        # Create a new active rubric containing auto + manual criteria.
        custom = {
            "name": "Mixed Assessment Rubric",
            "description": "Auto evidence plus professor assessment.",
            "criteria": [
                {
                    "key": "technical",
                    "title": "Technical Execution",
                    "description": "Automatic module evidence.",
                    "weight_percent": 70,
                    "grading_mode": "AUTO",
                    "evidence": {
                        "type": "MODULES",
                        "module_ids": [module.id],
                        "event_types": ["MODULE_COMPLETION", "HINT_PENALTY"],
                    },
                },
                {
                    "key": "analysis",
                    "title": "Analysis & Explanation",
                    "description": "Professor assessment of reasoning and explanation.",
                    "weight_percent": 30,
                    "grading_mode": "MANUAL",
                    "evidence": {"type": "MANUAL"},
                },
            ],
        }
        v2 = RubricService.create_version(
            db,
            lab.id,
            custom,
            created_by=grader.id,
        )
        assert v2.version == v1.version + 1

        # Existing assignment stays on v1.
        preserved = RubricService.get_assignment_snapshot(db, a1.id)
        assert preserved.rubric_version == v1.version
        print("✅ CASE B: publishing rubric v2 did not rewrite assignment v1")

        a2 = Assignment(
            lab_id=lab.id,
            student_id=student.id,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            status="Assigned",
            assigned_by=str(grader.id),
        )
        db.add(a2)
        db.flush()
        s2 = RubricService.snapshot_assignment(db, a2.id, grader.id)
        assert s2.rubric_version == v2.version
        print("✅ CASE C: new assignment captured active rubric version 2")

        db.add(
            ScoreEvent(
                assignment_id=a2.id,
                user_id=student.id,
                lab_id=lab.id,
                track_id=module.track,
                module_id=module.id,
                event_type="MODULE_COMPLETION",
                points=module.points,
                created_at=now,
            )
        )
        db.flush()

        rubric = RubricService.calculate_student_rubric(db, a2.id, student.id)
        technical = next(c for c in rubric["criteria"] if c["key"] == "technical")
        analysis = next(c for c in rubric["criteria"] if c["key"] == "analysis")

        assert technical["score_percent"] == 100.0
        assert analysis["pending"] is True
        assert rubric["rubric_percent"] == 70.0
        assert rubric["pending_manual_criteria"] == 1
        print("✅ CASE D: auto evidence and pending manual criterion calculated")

        # Publication must fail while manual criterion is missing.
        blocked = False
        try:
            GradebookService.publish(db, a2.id, graded_by=grader.id)
        except HTTPException as exc:
            blocked = exc.status_code == 409
        assert blocked
        print("✅ CASE E: incomplete manual rubric blocked publication")

        RubricService.save_manual_criteria(
            db,
            a2.id,
            student.id,
            [
                {
                    "criterion_key": "analysis",
                    "score_percent": 80,
                    "feedback": "Clear explanation.",
                }
            ],
            graded_by=grader.id,
        )
        db.flush()

        rubric = RubricService.calculate_student_rubric(db, a2.id, student.id)
        assert rubric["pending_manual_criteria"] == 0
        assert rubric["rubric_percent"] == 94.0
        print("✅ CASE F: weighted rubric grade = 70%*100 + 30%*80 = 94")

        GradebookService.publish(db, a2.id, graded_by=grader.id)
        db.flush()
        book = GradebookService.get_gradebook(db, a2.id)
        row = book["students"][0]
        assert row["rubric_percent"] == 94.0
        assert row["grade_status"] == "PUBLISHED"
        print("✅ CASE G: gradebook published rubric-backed final snapshot")

        locked = False
        try:
            RubricService.save_manual_criteria(
                db,
                a2.id,
                student.id,
                [
                    {
                        "criterion_key": "analysis",
                        "score_percent": 90,
                        "feedback": "Should be locked.",
                    }
                ],
                graded_by=grader.id,
            )
        except HTTPException as exc:
            locked = exc.status_code == 409
        assert locked
        print("✅ CASE H: criterion grades locked after publication")

        GradebookService.reopen(db, a2.id, graded_by=grader.id)
        RubricService.save_manual_criteria(
            db,
            a2.id,
            student.id,
            [
                {
                    "criterion_key": "analysis",
                    "score_percent": 90,
                    "feedback": "Regraded after reopen.",
                }
            ],
            graded_by=grader.id,
        )
        db.flush()

        reopened = RubricService.calculate_student_rubric(db, a2.id, student.id)
        assert reopened["rubric_percent"] == 97.0
        print("✅ CASE I: reopen unlocked criterion grading")

        print("=" * 80)
        print("✅ ALL FORMAL GRADING RUBRIC TESTS PASSED")
        print("=" * 80)

    finally:
        tx.rollback()
        db.rollback()
        db.close()
        print("Test transaction rolled back.")


if __name__ == "__main__":
    run()
