"""Capability- and scope-secured interactive gradebook API."""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_assignment_capability, require_capability
from app.core.capabilities import Capability
from app.models.assignment import Assignment
from app.models.audit_log import AuditLog
from app.models.lab import Lab
from app.models.user import User
from app.services.authorization_service import AuthorizationService
from app.services.gradebook_service import GradebookService

router = APIRouter()


class GradeUpdate(BaseModel):
    student_id: int
    manual_adjustment: float = Field(default=0, ge=-100, le=100)
    feedback: Optional[str] = Field(default=None, max_length=5000)


class GradeBatchUpdate(BaseModel):
    grades: List[GradeUpdate]


def _audit(db: Session, actor: User, action: str, assignment_id: int, payload: dict):
    db.add(AuditLog(
        user_id=actor.id,
        action=action,
        resource="AssignmentGrade",
        resource_id=str(assignment_id),
        performed_by=actor.email,
        performed_by_role=actor.role,
        status="SUCCESS",
        new_value=json.dumps(payload, default=str),
    ))


def _assert_roster_student(db: Session, assignment: Assignment, student_id: int):
    roster_ids = {student.id for student in GradebookService.get_roster(db, assignment) if student is not None}
    if student_id not in roster_ids:
        raise HTTPException(status_code=422, detail="Student is not part of this assignment roster.")


@router.get("/assignments")
def list_gradebook_assignments(
    current_user: User = Depends(require_capability(Capability.GRADE_VIEW)),
    db: Session = Depends(get_db),
):
    assignments = (
        db.query(Assignment)
        .filter(Assignment.deleted_at.is_(None))
        .order_by(Assignment.created_at.desc(), Assignment.id.desc())
        .all()
    )
    assignments = AuthorizationService.filter_accessible_assignments(
        db, current_user, assignments, Capability.GRADE_VIEW
    )

    result = []
    for assignment in assignments:
        lab = db.query(Lab).filter(Lab.id == assignment.lab_id).first()
        roster = GradebookService.get_roster(db, assignment)
        result.append({
            "assignment_id": assignment.id,
            "lab_id": assignment.lab_id,
            "lab_title": lab.name if lab else assignment.lab_id,
            "group_id": assignment.group_id,
            "student_id": assignment.student_id,
            "student_count": len(roster),
            "start_datetime": assignment.start_datetime.isoformat() if assignment.start_datetime else None,
            "end_datetime": assignment.end_datetime.isoformat() if assignment.end_datetime else None,
            "status": assignment.status,
        })
    return result


@router.get("/assignments/{assignment_id}")
def get_gradebook(
    assignment_id: int,
    current_user: User = Depends(require_assignment_capability(Capability.GRADE_VIEW)),
    db: Session = Depends(get_db),
):
    return GradebookService.get_gradebook(db, assignment_id)


@router.put("/assignments/{assignment_id}")
def save_gradebook_drafts(
    assignment_id: int,
    payload: GradeBatchUpdate,
    current_user: User = Depends(require_assignment_capability(Capability.GRADE_EDIT)),
    db: Session = Depends(get_db),
):
    try:
        assignment = GradebookService.get_assignment(db, assignment_id)
        updated = 0
        for item in payload.grades:
            _assert_roster_student(db, assignment, item.student_id)
            GradebookService.save_draft(
                db=db,
                assignment_id=assignment_id,
                student_id=item.student_id,
                manual_adjustment=item.manual_adjustment,
                feedback=item.feedback,
                graded_by=current_user.id,
            )
            updated += 1
        _audit(db, current_user, "Gradebook Draft Saved", assignment_id, {
            "updated_rows": updated,
            "student_ids": [item.student_id for item in payload.grades],
        })
        db.commit()
        return {
            "success": True,
            "updated_rows": updated,
            "gradebook": GradebookService.get_gradebook(db, assignment_id),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save gradebook: {exc}")


@router.post("/assignments/{assignment_id}/publish")
def publish_gradebook(
    assignment_id: int,
    current_user: User = Depends(require_assignment_capability(Capability.GRADE_PUBLISH)),
    db: Session = Depends(get_db),
):
    try:
        published = GradebookService.publish(db, assignment_id, graded_by=current_user.id)
        _audit(db, current_user, "Gradebook Published", assignment_id, {"published_rows": published})
        db.commit()
        return {
            "success": True,
            "published_rows": published,
            "gradebook": GradebookService.get_gradebook(db, assignment_id),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to publish gradebook: {exc}")


@router.post("/assignments/{assignment_id}/reopen")
def reopen_gradebook(
    assignment_id: int,
    current_user: User = Depends(require_assignment_capability(Capability.GRADE_PUBLISH)),
    db: Session = Depends(get_db),
):
    try:
        reopened = GradebookService.reopen(db, assignment_id, graded_by=current_user.id)
        _audit(db, current_user, "Gradebook Reopened", assignment_id, {"reopened_rows": reopened})
        db.commit()
        return {
            "success": True,
            "reopened_rows": reopened,
            "gradebook": GradebookService.get_gradebook(db, assignment_id),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reopen gradebook: {exc}")
