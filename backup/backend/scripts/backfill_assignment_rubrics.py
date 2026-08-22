"""Create default rubric templates and immutable snapshots for existing assignments."""

from app.database.session import SessionLocal
from app.models.assignment import Assignment
from app.models.rubric import AssignmentRubric
from app.services.rubric_service import RubricService


def run():
    db = SessionLocal()
    try:
        assignments = (
            db.query(Assignment)
            .filter(Assignment.deleted_at.is_(None))
            .order_by(Assignment.id.asc())
            .all()
        )
        created = 0
        skipped = 0

        for assignment in assignments:
            existing = (
                db.query(AssignmentRubric)
                .filter(AssignmentRubric.assignment_id == assignment.id)
                .first()
            )
            if existing:
                skipped += 1
                continue

            RubricService.snapshot_assignment(db, assignment.id)
            created += 1

        db.commit()
        print(f"✅ Assignment rubric snapshots created: {created}")
        print(f"✅ Existing snapshots preserved: {skipped}")
        print("✅ Point #6 rubric backfill complete")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
