"""Point #8 professor identity + scoped RBAC acceptance test."""

from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import inspect

from app.core.capabilities import Capability
from app.database.session import SessionLocal
from app.models.assignment import Assignment
from app.models.admin_models import Organization
from app.models.group import Group
from app.models.lab import Lab
from app.models.professor import ProfessorProfile
from app.models.rbac import UserRoleBinding
from app.models.user import User
from app.services.authorization_service import AuthorizationService


def run():
    db = SessionLocal()
    tx = db.begin_nested()
    try:
        print("=" * 80)
        print("POINT #8 PROFESSOR IDENTITY + SCOPED RBAC ACCEPTANCE TEST")
        print("=" * 80)

        tables = set(inspect(db.get_bind()).get_table_names())
        assert "professor_profiles" in tables
        assert "user_role_bindings" in tables
        assert "professors" not in tables
        print("✅ CASE A: canonical RBAC/Profile tables exist and active professors table is gone")

        users = db.query(User).order_by(User.id.asc()).limit(3).all()
        assert len(users) >= 2, "Need at least two users for RBAC acceptance test."
        professor = users[0]
        system_admin = users[1]

        profile_columns = set(ProfessorProfile.__table__.columns.keys())
        assert "user_id" in profile_columns
        assert "name" not in profile_columns
        assert "email" not in profile_columns
        print("✅ CASE B: ProfessorProfile contains metadata only; User owns identity")

        suffix = uuid4().hex[:8]
        org_a = Organization(name=f"RBAC Test Org A {suffix}", institution_type="University", status="ACTIVE")
        org_b = Organization(name=f"RBAC Test Org B {suffix}", institution_type="University", status="ACTIVE")
        db.add_all([org_a, org_b])
        db.flush()

        group_a = Group(name=f"RBAC-A-{suffix}", organization_id=org_a.id, description="Point #8 acceptance")
        group_b = Group(name=f"RBAC-B-{suffix}", organization_id=org_b.id, description="Point #8 acceptance")
        db.add_all([group_a, group_b])
        db.flush()

        lab = db.query(Lab).order_by(Lab.id.asc()).first()
        assert lab is not None, "Need at least one lab."
        now = datetime.utcnow()
        assignment_a = Assignment(
            lab_id=lab.id,
            group_id=group_a.id,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            assigned_by=professor.email,
            status="Assigned",
        )
        assignment_b = Assignment(
            lab_id=lab.id,
            group_id=group_b.id,
            start_datetime=now - timedelta(minutes=5),
            end_datetime=now + timedelta(hours=1),
            assigned_by=system_admin.email,
            status="Assigned",
        )
        db.add_all([assignment_a, assignment_b])
        db.flush()

        db.query(UserRoleBinding).filter(UserRoleBinding.user_id.in_([professor.id, system_admin.id])).delete(synchronize_session=False)
        db.flush()
        professor_binding = UserRoleBinding(
            user_id=professor.id,
            role="PROFESSOR",
            scope_type="ORGANIZATION",
            scope_key=f"ORG:{org_a.id}",
            organization_id=org_a.id,
            is_active=True,
        )
        sys_binding = UserRoleBinding(
            user_id=system_admin.id,
            role="SYSTEM_ADMIN",
            scope_type="GLOBAL",
            scope_key="GLOBAL",
            is_active=True,
        )
        db.add_all([professor_binding, sys_binding])
        db.flush()

        assert AuthorizationService.has_capability(db, professor, Capability.LAB_ASSIGN)
        assert AuthorizationService.has_capability(db, professor, Capability.GRADE_PUBLISH)
        assert not AuthorizationService.has_capability(db, professor, Capability.RUBRIC_MANAGE)
        assert not AuthorizationService.has_capability(db, professor, Capability.SYSTEM_ADMIN)
        print("✅ CASE C: professor has academic powers but not global/system powers")

        assert AuthorizationService.can_access_assignment(db, professor, assignment_a, Capability.GRADE_VIEW)
        assert not AuthorizationService.can_access_assignment(db, professor, assignment_b, Capability.GRADE_VIEW)
        print("✅ CASE D: professor assignment access is organization-scoped")

        denied = False
        try:
            AuthorizationService.assert_assignment_access(db, professor, assignment_b.id, Capability.GRADE_VIEW)
        except HTTPException as exc:
            denied = exc.status_code == 403
        assert denied
        print("✅ CASE E: cross-organization assignment access fails closed")

        assert AuthorizationService.primary_organization_id(db, professor) == org_a.id
        print("✅ CASE F: organization context resolves from role binding")

        assert AuthorizationService.has_capability(db, system_admin, Capability.RUBRIC_MANAGE)
        assert AuthorizationService.can_access_assignment(db, system_admin, assignment_a, Capability.GRADE_VIEW)
        assert AuthorizationService.can_access_assignment(db, system_admin, assignment_b, Capability.GRADE_VIEW)
        print("✅ CASE G: system admin retains explicit GLOBAL authority")

        professor.role = "professor"
        professor_binding.is_active = False
        db.flush()
        assert not AuthorizationService.has_capability(db, professor, Capability.GRADE_VIEW)
        print("✅ CASE H: legacy User.role cannot bypass a revoked binding")
        professor_binding.is_active = True
        db.flush()

        payload = AuthorizationService.authorization_payload(db, professor)
        assert "PROFESSOR" in payload["roles"]
        assert "GRADE_EDIT" in payload["capabilities"]
        assert any(scope["organization_id"] == org_a.id for scope in payload["scopes"])
        print("✅ CASE I: authorization payload exposes roles, capabilities, and scopes")

        print("=" * 80)
        print("✅ ALL POINT #8 RBAC TESTS PASSED")
        print("=" * 80)
    finally:
        tx.rollback()
        db.rollback()
        db.close()
        print("Test transaction rolled back.")


if __name__ == "__main__":
    run()
