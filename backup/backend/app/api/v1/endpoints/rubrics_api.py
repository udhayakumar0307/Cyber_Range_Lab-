"""Capability-secured rubric template and criterion-grading API."""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_assignment_capability, require_capability
from app.core.capabilities import Capability
from app.models.audit_log import AuditLog
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.rubric import LabRubric
from app.models.user import User
from app.services.authorization_service import AuthorizationService
from app.services.gradebook_service import GradebookService
from app.services.rubric_service import RubricService

router = APIRouter()


class RubricVersionPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=5000)
    criteria: List[dict]


class CriterionUpdate(BaseModel):
    criterion_key: str
    score_percent: float = Field(ge=0, le=100)
    feedback: Optional[str] = Field(default="", max_length=5000)


class CriterionBatchUpdate(BaseModel):
    criteria: List[CriterionUpdate]


def _serialize_template(rubric: LabRubric) -> dict:
    return {
        "id": rubric.id,
        "lab_id": rubric.lab_id,
        "version": rubric.version,
        "name": rubric.name,
        "description": rubric.description or "",
        "status": rubric.status,
        "rubric": rubric.rubric_json,
        "created_by": rubric.created_by,
        "created_at": rubric.created_at.isoformat() if rubric.created_at else None,
    }


def _audit(db: Session, actor: User, action: str, resource_id: str, payload: dict):
    db.add(AuditLog(
        user_id=actor.id,
        action=action,
        resource="Rubric",
        resource_id=resource_id,
        performed_by=actor.email,
        performed_by_role=actor.role,
        status="SUCCESS",
        new_value=json.dumps(payload, default=str),
    ))


def _assert_roster_student(db: Session, assignment_id: int, student_id: int):
    assignment = GradebookService.get_assignment(db, assignment_id)
    roster_ids = {student.id for student in GradebookService.get_roster(db, assignment) if student is not None}
    if student_id not in roster_ids:
        raise HTTPException(status_code=422, detail="Student is not part of this assignment roster.")


@router.get("/labs")
def list_labs_with_rubrics(
    current_user: User = Depends(require_capability(Capability.RUBRIC_VIEW)),
    db: Session = Depends(get_db),
):
    can_manage = AuthorizationService.has_capability(db, current_user, Capability.RUBRIC_MANAGE)
    labs = db.query(Lab).order_by(Lab.name.asc()).all()
    result = []
    for lab in labs:
        active = (
            db.query(LabRubric)
            .filter(LabRubric.lab_id == lab.id, LabRubric.status == "ACTIVE")
            .order_by(LabRubric.version.desc())
            .first()
        )
        module_count = db.query(LabModule).filter(LabModule.lab_id == lab.id).count()
        result.append({
            "lab_id": lab.id,
            "lab_name": lab.name,
            "category": lab.category,
            "module_count": module_count,
            "active_rubric_id": active.id if active else None,
            "active_version": active.version if active else None,
            "active_rubric_name": active.name if active else None,
            "can_manage": can_manage,
        })
    return result


@router.get("/labs/{lab_id}/modules")
def get_lab_modules(
    lab_id: str,
    current_user: User = Depends(require_capability(Capability.RUBRIC_VIEW)),
    db: Session = Depends(get_db),
):
    modules = (
        db.query(LabModule)
        .filter(LabModule.lab_id == lab_id)
        .order_by(LabModule.display_order.asc(), LabModule.module_number.asc(), LabModule.id.asc())
        .all()
    )
    return [{"id": m.id, "title": m.title, "points": m.points, "track": m.track} for m in modules]


@router.get("/labs/{lab_id}")
def get_active_lab_rubric(
    lab_id: str,
    current_user: User = Depends(require_capability(Capability.RUBRIC_VIEW)),
    db: Session = Depends(get_db),
):
    active = (
        db.query(LabRubric)
        .filter(LabRubric.lab_id == lab_id, LabRubric.status == "ACTIVE")
        .order_by(LabRubric.version.desc())
        .first()
    )
    can_manage = AuthorizationService.has_capability(db, current_user, Capability.RUBRIC_MANAGE)
    if active is None:
        return {
            "active": None,
            "default_preview": RubricService.generate_default_payload(db, lab_id),
            "can_manage": can_manage,
        }
    return {"active": _serialize_template(active), "default_preview": None, "can_manage": can_manage}


@router.post("/labs/{lab_id}/versions")
def create_rubric_version(
    lab_id: str,
    payload: RubricVersionPayload,
    current_user: User = Depends(require_capability(Capability.RUBRIC_MANAGE)),
    db: Session = Depends(get_db),
):
    try:
        rubric = RubricService.create_version(db, lab_id, payload.model_dump(), created_by=current_user.id)
        _audit(db, current_user, "Lab Rubric Version Created", str(rubric.id), {
            "lab_id": lab_id, "version": rubric.version, "name": rubric.name,
        })
        db.commit()
        db.refresh(rubric)
        return _serialize_template(rubric)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create rubric: {exc}")


@router.post("/labs/{lab_id}/generate-default")
def create_default_rubric_version(
    lab_id: str,
    current_user: User = Depends(require_capability(Capability.RUBRIC_MANAGE)),
    db: Session = Depends(get_db),
):
    try:
        payload = RubricService.generate_default_payload(db, lab_id)
        rubric = RubricService.create_version(db, lab_id, payload, created_by=current_user.id)
        _audit(db, current_user, "Default Lab Rubric Generated", str(rubric.id), {
            "lab_id": lab_id, "version": rubric.version,
        })
        db.commit()
        db.refresh(rubric)
        return _serialize_template(rubric)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate default rubric: {exc}")


@router.get("/assignments/{assignment_id}")
def get_assignment_rubric(
    assignment_id: int,
    current_user: User = Depends(require_assignment_capability(Capability.GRADE_VIEW)),
    db: Session = Depends(get_db),
):
    snapshot = RubricService.get_assignment_snapshot(db, assignment_id)
    return {
        "id": snapshot.id,
        "assignment_id": snapshot.assignment_id,
        "lab_rubric_id": snapshot.lab_rubric_id,
        "rubric_version": snapshot.rubric_version,
        "rubric": snapshot.rubric_json,
        "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
    }


@router.get("/assignments/{assignment_id}/students/{student_id}")
def get_student_rubric(
    assignment_id: int,
    student_id: int,
    current_user: User = Depends(require_assignment_capability(Capability.GRADE_VIEW)),
    db: Session = Depends(get_db),
):
    _assert_roster_student(db, assignment_id, student_id)
    return RubricService.calculate_student_rubric(db, assignment_id, student_id)


@router.put("/assignments/{assignment_id}/students/{student_id}")
def save_student_manual_criteria(
    assignment_id: int,
    student_id: int,
    payload: CriterionBatchUpdate,
    current_user: User = Depends(require_assignment_capability(Capability.GRADE_EDIT)),
    db: Session = Depends(get_db),
):
    _assert_roster_student(db, assignment_id, student_id)
    try:
        updates = [item.model_dump() for item in payload.criteria]
        updated = RubricService.save_manual_criteria(
            db, assignment_id, student_id, updates, graded_by=current_user.id
        )
        _audit(db, current_user, "Rubric Criteria Graded", f"{assignment_id}:{student_id}", {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "updated_criteria": updated,
        })
        db.commit()
        return {
            "success": True,
            "updated_criteria": updated,
            "rubric": RubricService.calculate_student_rubric(db, assignment_id, student_id),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save criterion grades: {exc}")
