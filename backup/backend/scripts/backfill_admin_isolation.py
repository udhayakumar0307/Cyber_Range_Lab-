#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Running `python scripts/backfill_admin_isolation.py` places only the
# scripts/ directory on sys.path. Add the backend root so `app.*` imports
# resolve consistently with the other backend entry points.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func

from app.database.session import SessionLocal
from app.models.admin_student_roster import AdminStudentRoster
from app.models.audit_log import AuditLog
from app.models.group import Group
from app.models.user import User


MANAGER_ROLES = {
    "admin",
    "super_admin",
    "system_admin",
    "sysadmin",
    "professor",
    "ta",
}


def normalize_role(value) -> str:
    return str(value or "").strip().lower()


def is_student_like(user: User) -> bool:
    role = normalize_role(user.role)
    account_type = normalize_role(getattr(user, "account_type", None))
    return role in {"user", "student"} or account_type == "student"


def is_manager_identity(user: User | None, audit_role=None) -> bool:
    if user is None:
        return False

    if normalize_role(user.role) not in MANAGER_ROLES:
        return False

    logged_role = normalize_role(audit_role)
    if logged_role and logged_role not in MANAGER_ROLES:
        return False

    return True


def resolve_user_by_email(db, email):
    if not email:
        return None
    return db.query(User).filter(func.lower(User.email) == str(email).strip().lower()).first()


def add_roster_link(db, manager_id: int, student_id: int) -> bool:
    existing = db.query(AdminStudentRoster).filter(
        AdminStudentRoster.manager_user_id == manager_id,
        AdminStudentRoster.student_user_id == student_id,
    ).first()
    if existing is not None:
        return False
    db.add(AdminStudentRoster(manager_user_id=manager_id, student_user_id=student_id))
    return True


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Backfill historical admin/group ownership. "
            "Defaults to dry-run; use --apply to commit."
        )
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--apply",
        action="store_true",
        help="Commit the deterministic ownership backfill.",
    )
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicit dry-run mode (also the default).",
    )
    parser.add_argument(
        "--allow-unresolved",
        action="store_true",
        help=(
            "With --apply, permit deterministic rows to commit even when "
            "some historical ownership remains unresolved."
        ),
    )
    args = parser.parse_args()

    db = SessionLocal()
    group_updates = 0
    roster_adds = 0
    unresolved_groups = []
    ambiguous_groups = []

    try:
        print("=" * 72)
        print("ADMIN ISOLATION BACKFILL")
        print("=" * 72)

        for group in db.query(Group).order_by(Group.id).all():
            if group.owner_user_id is not None:
                continue
            logs = db.query(AuditLog).filter(
                AuditLog.action == "Group Create",
                AuditLog.entity == "Group",
                AuditLog.entity_id == str(group.id),
                AuditLog.performed_by.is_not(None),
            ).order_by(AuditLog.id).all()
            owners = {}
            for log in logs:
                owner = resolve_user_by_email(db, log.performed_by)
                if is_manager_identity(owner, log.performed_by_role):
                    owners[owner.id] = owner
            if len(owners) == 1:
                owner = next(iter(owners.values()))
                group.owner_user_id = owner.id
                group_updates += 1
                print(f"GROUP group_id={group.id} name={group.name!r} owner_id={owner.id} owner={owner.email}")
            elif len(owners) > 1:
                ambiguous_groups.append((group.id, group.name, sorted(u.email for u in owners.values())))
            else:
                unresolved_groups.append((group.id, group.name))

        db.flush()

        logs = db.query(AuditLog).filter(
            AuditLog.action == "User Creation",
            AuditLog.entity == "User",
            AuditLog.entity_id.is_not(None),
            AuditLog.performed_by.is_not(None),
        ).order_by(AuditLog.id).all()
        for log in logs:
            try:
                student_id = int(str(log.entity_id))
            except (TypeError, ValueError):
                continue
            student = db.query(User).filter(User.id == student_id).first()
            manager = resolve_user_by_email(db, log.performed_by)

            if student is None:
                continue
            if not is_manager_identity(manager, log.performed_by_role):
                continue
            if not is_student_like(student):
                continue

            if add_roster_link(db, manager.id, student.id):
                roster_adds += 1
                print(f"ROSTER manual manager={manager.email} student_id={student.id} student={student.email}")

        for group in db.query(Group).filter(Group.owner_user_id.is_not(None)).order_by(Group.id).all():
            for student in db.query(User).filter(User.group_id == group.id).order_by(User.id).all():
                if not is_student_like(student):
                    continue
                if add_roster_link(db, group.owner_user_id, student.id):
                    roster_adds += 1
                    print(f"ROSTER group owner_id={group.owner_user_id} group_id={group.id} student_id={student.id} student={student.email}")

        db.flush()
        linked_ids = {row[0] for row in db.query(AdminStudentRoster.student_user_id).distinct().all()}
        unresolved_students = []
        candidates = db.query(User).filter(
            (func.lower(User.role).in_(["user", "student"]))
            | (func.lower(User.account_type) == "student")
        ).order_by(User.id).all()
        for student in candidates:
            if student.id in linked_ids:
                continue
            if student.group_id is not None:
                group = db.query(Group).filter(Group.id == student.group_id).first()
                if group and group.owner_user_id is not None:
                    continue
            unresolved_students.append((student.id, student.email, student.group_id))

        print()
        print(f"group_updates={group_updates}")
        print(f"roster_adds={roster_adds}")
        print(f"unresolved_groups={len(unresolved_groups)}")
        print(f"ambiguous_groups={len(ambiguous_groups)}")
        print(f"unresolved_students={len(unresolved_students)}")
        if unresolved_groups:
            print("UNRESOLVED GROUPS:")
            for row in unresolved_groups:
                print(" ", row)
        if ambiguous_groups:
            print("AMBIGUOUS GROUPS:")
            for row in ambiguous_groups:
                print(" ", row)
        if unresolved_students:
            print("UNRESOLVED STUDENTS (first 50):")
            for row in unresolved_students[:50]:
                print(" ", row)

        unresolved = bool(unresolved_groups or ambiguous_groups or unresolved_students)
        if not args.apply:
            db.rollback()
            print("DRY_RUN (default): rollback complete")
        elif unresolved and not args.allow_unresolved:
            db.rollback()
            raise SystemExit(
                "REFUSING COMMIT: unresolved historical ownership exists. "
                "Review it before enabling fail-closed isolation."
            )
        else:
            db.commit()
            print("COMMIT: complete")

        print("=" * 72)
        print("ADMIN ISOLATION BACKFILL COMPLETE")
        print("=" * 72)
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
