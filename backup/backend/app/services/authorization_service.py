"""Capability-based, scope-aware authorization service."""

from __future__ import annotations

from typing import Iterable, List, Optional, Sequence, Set

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.capabilities import Capability, capabilities_for_role, normalize_role
from app.models.assignment import Assignment
from app.models.group import Group
from app.models.rbac import UserRoleBinding
from app.models.user import User
from app.models.user_affiliation import UserAffiliation


class AuthorizationService:
    @staticmethod
    def active_bindings(db: Session, user_id: int) -> List[UserRoleBinding]:
        rows = (
            db.query(UserRoleBinding)
            .filter(
                UserRoleBinding.user_id == user_id,
                UserRoleBinding.is_active.is_(True),
            )
            .order_by(UserRoleBinding.id.asc())
            .all()
        )

        # A pending/disabled institution must not confer operational authority.
        active: List[UserRoleBinding] = []
        for binding in rows:
            if binding.scope_type == "ORGANIZATION":
                from app.models.admin_models import Organization
                organization = db.query(Organization).filter(Organization.id == binding.organization_id).first()
                if organization is None or str(organization.status or "").upper() not in {"ACTIVE", "APPROVED"}:
                    continue
            elif binding.scope_type == "COLLEGE":
                from app.models.college import College
                college = db.query(College).filter(College.id == binding.college_id).first()
                if college is None or str(getattr(college, "status", "ACTIVE") or "").upper() not in {"ACTIVE", "APPROVED"}:
                    continue
            active.append(binding)
        return active

    @staticmethod
    def bindings_for_capability(db: Session, user_id: int, capability: Capability | str) -> List[UserRoleBinding]:
        cap = Capability(capability)
        return [
            binding
            for binding in AuthorizationService.active_bindings(db, user_id)
            if cap in capabilities_for_role(binding.role)
        ]

    @staticmethod
    def effective_capabilities(db: Session, user_id: int) -> Set[Capability]:
        result: Set[Capability] = set()
        for binding in AuthorizationService.active_bindings(db, user_id):
            result.update(capabilities_for_role(binding.role))
        return result

    @staticmethod
    def has_capability(db: Session, user: User, capability: Capability | str) -> bool:
        return Capability(capability) in AuthorizationService.effective_capabilities(db, user.id)

    @staticmethod
    def require_capability(db: Session, user: User, capability: Capability | str) -> User:
        cap = Capability(capability)
        if not AuthorizationService.has_capability(db, user, cap):
            raise HTTPException(status_code=403, detail=f"Missing required capability: {cap.value}")
        return user

    @staticmethod
    def _scope_sets(bindings: Sequence[UserRoleBinding]) -> tuple[bool, Set[int], Set[int]]:
        # Same UNSCOPED-as-GLOBAL treatment as primary_organization_id below:
        # UNSCOPED (bootstrap/seed default, and the historical RBAC
        # migration's blanket default for pre-existing admins) means "not
        # restricted to one org/college," not "no access." This is the
        # helper behind can_access_user/can_access_group/can_access_assignment
        # — leaving it unfixed here caused e.g. group creation to succeed
        # (via primary_organization_id) while adding members to that same
        # group still 403'd (via this helper, through assert_group_access).
        global_access = any(binding.scope_type in ("GLOBAL", "UNSCOPED") for binding in bindings)
        organization_ids = {
            int(binding.organization_id)
            for binding in bindings
            if binding.scope_type == "ORGANIZATION" and binding.organization_id is not None
        }
        college_ids = {
            int(binding.college_id)
            for binding in bindings
            if binding.scope_type == "COLLEGE" and binding.college_id is not None
        }
        return global_access, organization_ids, college_ids

    @staticmethod
    def user_scope_ids(db: Session, target: User) -> tuple[Set[int], Set[int]]:
        organization_ids: Set[int] = set()
        college_ids: Set[int] = set()
        if target.college_id is not None:
            college_ids.add(int(target.college_id))

        affiliations = db.query(UserAffiliation).filter(UserAffiliation.user_id == target.id).all()
        for affiliation in affiliations:
            if affiliation.organization_id is not None:
                organization_ids.add(int(affiliation.organization_id))
            if affiliation.college_id is not None:
                college_ids.add(int(affiliation.college_id))

        if target.group_id is not None:
            group = db.query(Group).filter(Group.id == target.group_id).first()
            if group and group.organization_id is not None:
                organization_ids.add(int(group.organization_id))

        return organization_ids, college_ids

    @staticmethod
    def can_access_user(db: Session, actor: User, target: User, capability: Capability | str) -> bool:
        bindings = AuthorizationService.bindings_for_capability(db, actor.id, capability)
        if not bindings:
            return False
        global_access, organization_ids, college_ids = AuthorizationService._scope_sets(bindings)
        if global_access:
            return True
        target_orgs, target_colleges = AuthorizationService.user_scope_ids(db, target)
        return bool(organization_ids.intersection(target_orgs) or college_ids.intersection(target_colleges))

    @staticmethod
    def assert_user_access(db: Session, actor: User, target_user_id: int, capability: Capability | str) -> User:
        target = db.query(User).filter(User.id == target_user_id).first()
        if target is None:
            raise HTTPException(status_code=404, detail="User not found.")
        if not AuthorizationService.can_access_user(db, actor, target, capability):
            raise HTTPException(status_code=403, detail="User is outside your authorized scope.")
        return target

    @staticmethod
    def can_access_group(db: Session, actor: User, group: Group, capability: Capability | str) -> bool:
        bindings = AuthorizationService.bindings_for_capability(db, actor.id, capability)
        if not bindings:
            return False
        global_access, organization_ids, _ = AuthorizationService._scope_sets(bindings)
        if global_access:
            return True
        return group.organization_id is not None and int(group.organization_id) in organization_ids

    @staticmethod
    def assert_group_access(db: Session, actor: User, group_id: int, capability: Capability | str) -> Group:
        group = db.query(Group).filter(Group.id == group_id).first()
        if group is None:
            raise HTTPException(status_code=404, detail="Group not found.")
        if not AuthorizationService.can_access_group(db, actor, group, capability):
            raise HTTPException(status_code=403, detail="Group is outside your authorized scope.")
        return group

    @staticmethod
    def can_access_assignment(db: Session, actor: User, assignment: Assignment, capability: Capability | str) -> bool:
        bindings = AuthorizationService.bindings_for_capability(db, actor.id, capability)
        if not bindings:
            return False
        global_access, _, _ = AuthorizationService._scope_sets(bindings)
        if global_access:
            return True

        if assignment.student_id is not None:
            student = db.query(User).filter(User.id == assignment.student_id).first()
            return bool(student and AuthorizationService.can_access_user(db, actor, student, capability))

        if assignment.group_id is not None:
            group = db.query(Group).filter(Group.id == assignment.group_id).first()
            return bool(group and AuthorizationService.can_access_group(db, actor, group, capability))

        return bool(
            assignment.assigned_by
            and actor.email
            and assignment.assigned_by.lower() == actor.email.lower()
        )

    @staticmethod
    def assert_assignment_access(db: Session, actor: User, assignment_id: int, capability: Capability | str) -> Assignment:
        assignment = (
            db.query(Assignment)
            .filter(Assignment.id == assignment_id, Assignment.deleted_at.is_(None))
            .first()
        )
        if assignment is None:
            raise HTTPException(status_code=404, detail="Assignment not found.")
        if not AuthorizationService.can_access_assignment(db, actor, assignment, capability):
            raise HTTPException(status_code=403, detail="Assignment is outside your authorized scope.")
        return assignment

    @staticmethod
    def filter_accessible_assignments(db: Session, actor: User, assignments: Iterable[Assignment], capability: Capability | str) -> List[Assignment]:
        return [
            assignment
            for assignment in assignments
            if AuthorizationService.can_access_assignment(db, actor, assignment, capability)
        ]

    @staticmethod
    def assert_assignment_target_access(
        db: Session,
        actor: User,
        *,
        group_id: Optional[int],
        student_id: Optional[int],
        capability: Capability | str = Capability.LAB_ASSIGN,
    ) -> None:
        if group_id is None and student_id is None:
            raise HTTPException(status_code=422, detail="Assignment must target a group or student.")
        if group_id is not None:
            AuthorizationService.assert_group_access(db, actor, group_id, capability)
        if student_id is not None:
            AuthorizationService.assert_user_access(db, actor, student_id, capability)

    @staticmethod
    def primary_organization_id(db: Session, user: User) -> int:
        bindings = AuthorizationService.active_bindings(db, user.id)
        # UNSCOPED is what bootstrap/seed scripts (and the historical RBAC
        # migration's blanket default for every pre-existing admin) assign
        # when an admin wasn't given a specific organization at creation
        # time. It means "not restricted to one org" — the same operational
        # intent as GLOBAL — not "no access". Treating it as having zero
        # scope (the previous behavior) is what made this 403 fire for
        # nearly every admin account instead of only genuinely unscoped ones.
        global_access = any(binding.scope_type in ("GLOBAL", "UNSCOPED") for binding in bindings)
        org_ids = {
            int(binding.organization_id)
            for binding in bindings
            if binding.scope_type == "ORGANIZATION" and binding.organization_id is not None
        }

        try:
            from app.models.admin_models import AdminProfile
            profile = db.query(AdminProfile).filter(AdminProfile.user_id == user.id).first()
            if profile and profile.organization_id is not None:
                profile_org = int(profile.organization_id)
                if global_access or profile_org in org_ids:
                    return profile_org
        except Exception:
            pass

        primary_aff = (
            db.query(UserAffiliation)
            .filter(
                UserAffiliation.user_id == user.id,
                UserAffiliation.is_primary.is_(True),
                UserAffiliation.organization_id.is_not(None),
            )
            .first()
        )
        if primary_aff and primary_aff.organization_id is not None:
            primary_org = int(primary_aff.organization_id)
            if global_access or primary_org in org_ids:
                return primary_org

        # Still nothing: the account may only have a COLLEGE affiliation
        # (e.g. IIT Madras) with no mirrored ORGANIZATION binding ever
        # created for it — or no active role binding row at all (accounts
        # created before RBAC bindings existed, or where the binding was
        # never inserted). This lookup is intentionally NOT gated behind
        # global_access: it only ever resolves to an organization this
        # specific user already has a real UserAffiliation row pointing at
        # (by college), read-only, so it can't grant access beyond what the
        # account's own affiliation data already represents.
        college_aff = (
            db.query(UserAffiliation)
            .filter(
                UserAffiliation.user_id == user.id,
                UserAffiliation.college_id.is_not(None),
            )
            .order_by(UserAffiliation.is_primary.desc())
            .first()
        )
        if college_aff and college_aff.college_id is not None:
            from app.models.college import College
            from app.models.admin_models import Organization
            college = db.query(College).filter(College.id == college_aff.college_id).first()
            if college:
                matching_org = (
                    db.query(Organization)
                    .filter(Organization.name.ilike(college.name))
                    .first()
                )
                if matching_org:
                    return int(matching_org.id)

        # Fall back to the user's own denormalized college_id column too
        # (some flows set User.college_id without a UserAffiliation row).
        if getattr(user, "college_id", None) is not None:
            from app.models.college import College
            from app.models.admin_models import Organization
            college = db.query(College).filter(College.id == user.college_id).first()
            if college:
                matching_org = (
                    db.query(Organization)
                    .filter(Organization.name.ilike(college.name))
                    .first()
                )
                if matching_org:
                    return int(matching_org.id)

        if len(org_ids) == 1:
            return next(iter(org_ids))
        if len(org_ids) > 1:
            raise HTTPException(
                status_code=409,
                detail="Multiple organization scopes are active. Select an organization context before performing this operation.",
            )
        raise HTTPException(
            status_code=403,
            detail="No active organization scope is assigned to this account.",
        )

    @staticmethod
    def authorization_payload(db: Session, user: User) -> dict:
        bindings = AuthorizationService.active_bindings(db, user.id)
        roles = sorted({normalize_role(binding.role) for binding in bindings})
        capabilities = sorted(cap.value for cap in AuthorizationService.effective_capabilities(db, user.id))
        scopes = [
            {
                "binding_id": binding.id,
                "role": normalize_role(binding.role),
                "scope_type": binding.scope_type,
                "organization_id": binding.organization_id,
                "college_id": binding.college_id,
            }
            for binding in bindings
        ]

        from app.models.professor import ProfessorProfile
        profile = db.query(ProfessorProfile).filter(ProfessorProfile.user_id == user.id).first()

        return {
            "user_id": user.id,
            "legacy_role": user.role,
            "roles": roles,
            "capabilities": capabilities,
            "scopes": scopes,
            "professor_profile": (
                {
                    "id": profile.id,
                    "department": profile.department,
                    "academic_title": profile.academic_title,
                    "employee_id": profile.employee_id,
                    "office": profile.office,
                }
                if profile else None
            ),
        }

    @staticmethod
    def scope_key(scope_type: str, organization_id: Optional[int], college_id: Optional[int]) -> str:
        scope_type = scope_type.upper()
        if scope_type == "GLOBAL":
            if organization_id is not None or college_id is not None:
                raise HTTPException(status_code=422, detail="GLOBAL scope cannot include tenant IDs.")
            return "GLOBAL"
        if scope_type == "UNSCOPED":
            if organization_id is not None or college_id is not None:
                raise HTTPException(status_code=422, detail="UNSCOPED cannot include tenant IDs.")
            return "UNSCOPED"
        if scope_type == "ORGANIZATION":
            if organization_id is None or college_id is not None:
                raise HTTPException(status_code=422, detail="Invalid organization scope.")
            return f"ORG:{int(organization_id)}"
        if scope_type == "COLLEGE":
            if college_id is None or organization_id is not None:
                raise HTTPException(status_code=422, detail="Invalid college scope.")
            return f"COLLEGE:{int(college_id)}"
        raise HTTPException(status_code=422, detail="Invalid scope_type.")

    @staticmethod
    def sync_legacy_role(user: User, bindings: Sequence[UserRoleBinding]) -> None:
        active_roles = {normalize_role(binding.role) for binding in bindings if binding.is_active}
        selected = next(
            (role for role in ["SYSTEM_ADMIN", "ADMIN", "PROFESSOR", "TA", "STUDENT"] if role in active_roles),
            "STUDENT",
        )
        user.role = {
            "SYSTEM_ADMIN": "system_admin",
            "ADMIN": "admin",
            "PROFESSOR": "professor",
            "TA": "ta",
            "STUDENT": "user",
        }[selected]
