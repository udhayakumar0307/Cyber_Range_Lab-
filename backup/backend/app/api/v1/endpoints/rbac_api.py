"""RBAC introspection and system-admin role-binding management."""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_system_admin, get_current_user, get_db
from app.core.capabilities import CANONICAL_ROLES, normalize_role
from app.models.audit_log import AuditLog
from app.models.professor import ProfessorProfile
from app.models.rbac import UserRoleBinding
from app.models.user import User
from app.services.authorization_service import AuthorizationService

router = APIRouter()


class RoleBindingInput(BaseModel):
    role: str
    scope_type: str
    organization_id: Optional[int] = None
    college_id: Optional[int] = None
    is_active: bool = True


class ReplaceRoleBindingsRequest(BaseModel):
    bindings: List[RoleBindingInput]


class ProfessorProfileInput(BaseModel):
    department: Optional[str] = None
    academic_title: Optional[str] = None
    employee_id: Optional[str] = None
    office: Optional[str] = None


@router.get("/me")
def my_authorization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AuthorizationService.authorization_payload(db, current_user)


@router.get("/users/{user_id}")
def user_authorization(
    user_id: int,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return AuthorizationService.authorization_payload(db, user)


@router.put("/users/{user_id}/bindings")
def replace_role_bindings(
    user_id: int,
    payload: ReplaceRoleBindingsRequest,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=409,
            detail="Use another system administrator to change your own role bindings.",
        )

    normalized = []
    seen = set()
    for item in payload.bindings:
        role = normalize_role(item.role)
        if role not in CANONICAL_ROLES:
            raise HTTPException(status_code=422, detail=f"Invalid role: {item.role}")
        scope_type = item.scope_type.upper()
        key = AuthorizationService.scope_key(scope_type, item.organization_id, item.college_id)
        if (role, key) in seen:
            raise HTTPException(status_code=422, detail=f"Duplicate role binding: {role} / {key}")
        seen.add((role, key))
        normalized.append({
            "role": role,
            "scope_type": scope_type,
            "scope_key": key,
            "organization_id": item.organization_id,
            "college_id": item.college_id,
            "is_active": item.is_active,
        })

    try:
        db.query(UserRoleBinding).filter(UserRoleBinding.user_id == user.id).delete(synchronize_session=False)
        db.flush()
        rows = []
        for item in normalized:
            row = UserRoleBinding(
                user_id=user.id,
                role=item["role"],
                scope_type=item["scope_type"],
                scope_key=item["scope_key"],
                organization_id=item["organization_id"],
                college_id=item["college_id"],
                is_active=item["is_active"],
                granted_by=current_admin.id,
            )
            db.add(row)
            rows.append(row)
        db.flush()
        AuthorizationService.sync_legacy_role(user, rows)
        db.add(AuditLog(
            user_id=current_admin.id,
            action="RBAC Bindings Replaced",
            resource="User",
            resource_id=str(user.id),
            performed_by=current_admin.email,
            performed_by_role=current_admin.role,
            status="SUCCESS",
            new_value=json.dumps(normalized, default=str),
        ))
        db.commit()
        return AuthorizationService.authorization_payload(db, user)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update RBAC: {exc}")


@router.put("/users/{user_id}/professor-profile")
def upsert_professor_profile(
    user_id: int,
    payload: ProfessorProfileInput,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    roles = {binding.role for binding in AuthorizationService.active_bindings(db, user.id)}
    if "PROFESSOR" not in roles:
        raise HTTPException(status_code=409, detail="Professor profile requires an active PROFESSOR role binding.")

    try:
        profile = db.query(ProfessorProfile).filter(ProfessorProfile.user_id == user.id).first()
        if profile is None:
            profile = ProfessorProfile(user_id=user.id)
            db.add(profile)
        profile.department = payload.department
        profile.academic_title = payload.academic_title
        profile.employee_id = payload.employee_id
        profile.office = payload.office
        db.add(AuditLog(
            user_id=current_admin.id,
            action="Professor Profile Updated",
            resource="ProfessorProfile",
            resource_id=str(user.id),
            performed_by=current_admin.email,
            performed_by_role=current_admin.role,
            status="SUCCESS",
        ))
        db.commit()
        return AuthorizationService.authorization_payload(db, user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update professor profile: {exc}")
