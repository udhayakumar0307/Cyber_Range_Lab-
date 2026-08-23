#!/usr/bin/env python3
"""
Point #8 tenant-state repair for the live legacy data discovered by the RBAC audit.

Intentional changes only:
1. Activate Organization #14 ("IITM").
2. Mark User #14's AdminProfile for Org #14 verified.
3. Remove User #14's stale ADMIN/COLLEGE:450 RBAC binding.
4. Remove UserAffiliation #17 (User #14 -> College #450).

Everything is protected by exact-state assertions and one DB transaction.
Run from the backend root with PYTHONPATH="$PWD".

Default mode is DRY RUN.
Use --apply to commit.
"""

from __future__ import annotations

import argparse
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.admin_models import AdminProfile, Organization
from app.models.rbac import UserRoleBinding
from app.models.user import User
from app.models.user_affiliation import UserAffiliation


EXPECTED_USER_ID = 14
EXPECTED_EMAIL = "udhaya@cyberrange.in"

EXPECTED_ORG_ID = 14
EXPECTED_ORG_NAME = "IITM"

STALE_AFFILIATION_ID = 17
STALE_COLLEGE_ID = 450


def fail(message: str) -> None:
    raise RuntimeError(message)


def validate(db: Session):
    user = db.query(User).filter(User.id == EXPECTED_USER_ID).first()
    if user is None:
        fail(f"User #{EXPECTED_USER_ID} not found.")
    if (user.email or "").lower() != EXPECTED_EMAIL:
        fail(
            f"User #{EXPECTED_USER_ID} email mismatch: "
            f"expected {EXPECTED_EMAIL!r}, got {user.email!r}"
        )

    org = db.query(Organization).filter(Organization.id == EXPECTED_ORG_ID).first()
    if org is None:
        fail(f"Organization #{EXPECTED_ORG_ID} not found.")
    if org.name != EXPECTED_ORG_NAME:
        fail(
            f"Organization #{EXPECTED_ORG_ID} name mismatch: "
            f"expected {EXPECTED_ORG_NAME!r}, got {org.name!r}"
        )
    if str(org.status or "").upper() not in {"PENDING", "ACTIVE"}:
        fail(
            f"Organization #{EXPECTED_ORG_ID} has unexpected status "
            f"{org.status!r}; refusing to change it."
        )

    profile = (
        db.query(AdminProfile)
        .filter(
            AdminProfile.user_id == EXPECTED_USER_ID,
            AdminProfile.organization_id == EXPECTED_ORG_ID,
        )
        .first()
    )
    if profile is None:
        fail(
            f"AdminProfile for user #{EXPECTED_USER_ID} / "
            f"organization #{EXPECTED_ORG_ID} not found."
        )

    affiliation = (
        db.query(UserAffiliation)
        .filter(UserAffiliation.id == STALE_AFFILIATION_ID)
        .first()
    )
    if affiliation is None:
        fail(f"Expected stale affiliation #{STALE_AFFILIATION_ID} not found.")
    if affiliation.user_id != EXPECTED_USER_ID:
        fail(
            f"Affiliation #{STALE_AFFILIATION_ID} belongs to user "
            f"#{affiliation.user_id}, not #{EXPECTED_USER_ID}."
        )
    if affiliation.affiliation_type != "college":
        fail(
            f"Affiliation #{STALE_AFFILIATION_ID} type is "
            f"{affiliation.affiliation_type!r}, not 'college'."
        )
    if affiliation.college_id != STALE_COLLEGE_ID:
        fail(
            f"Affiliation #{STALE_AFFILIATION_ID} points to college "
            f"#{affiliation.college_id}, not #{STALE_COLLEGE_ID}."
        )
    if affiliation.organization_id is not None:
        fail(
            f"Affiliation #{STALE_AFFILIATION_ID} unexpectedly also has "
            f"organization_id={affiliation.organization_id}."
        )

    org_binding = (
        db.query(UserRoleBinding)
        .filter(
            UserRoleBinding.user_id == EXPECTED_USER_ID,
            UserRoleBinding.role == "ADMIN",
            UserRoleBinding.scope_type == "ORGANIZATION",
            UserRoleBinding.organization_id == EXPECTED_ORG_ID,
        )
        .first()
    )
    if org_binding is None:
        fail(
            f"ADMIN organization binding for user #{EXPECTED_USER_ID} / "
            f"org #{EXPECTED_ORG_ID} not found."
        )

    stale_bindings = (
        db.query(UserRoleBinding)
        .filter(
            UserRoleBinding.user_id == EXPECTED_USER_ID,
            UserRoleBinding.scope_type == "COLLEGE",
            UserRoleBinding.college_id == STALE_COLLEGE_ID,
        )
        .all()
    )
    if not stale_bindings:
        fail(
            f"No College #{STALE_COLLEGE_ID} role binding found for "
            f"user #{EXPECTED_USER_ID}."
        )

    return user, org, profile, affiliation, org_binding, stale_bindings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the repair. Without this flag the script rolls back.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        (
            user,
            org,
            profile,
            affiliation,
            org_binding,
            stale_bindings,
        ) = validate(db)

        print("=" * 88)
        print("POINT #8 TENANT-STATE REPAIR")
        print("=" * 88)
        print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
        print()
        print(
            f"User #{user.id}: {user.email} "
            f"(compatibility role={user.role!r})"
        )
        print(
            f"Organization #{org.id}: {org.name!r} "
            f"status {org.status!r} -> 'ACTIVE'"
        )
        print(
            f"AdminProfile: is_verified "
            f"{profile.is_verified!r} -> True"
        )
        print(
            f"Organization binding retained: "
            f"{org_binding.role} {org_binding.scope_key}"
        )
        for binding in stale_bindings:
            print(
                f"College RBAC binding DELETE: "
                f"id={binding.id} role={binding.role} "
                f"scope={binding.scope_key}"
            )
        print(
            f"College affiliation DELETE: "
            f"id={affiliation.id} college_id={affiliation.college_id}"
        )

        org.status = "ACTIVE"
        profile.is_verified = True

        for binding in stale_bindings:
            db.delete(binding)

        db.delete(affiliation)
        db.flush()

        # Post-change assertions before commit.
        assert str(org.status).upper() == "ACTIVE"
        assert profile.is_verified is True

        remaining_college_bindings = (
            db.query(UserRoleBinding)
            .filter(
                UserRoleBinding.user_id == EXPECTED_USER_ID,
                UserRoleBinding.scope_type == "COLLEGE",
                UserRoleBinding.college_id == STALE_COLLEGE_ID,
            )
            .count()
        )
        assert remaining_college_bindings == 0

        remaining_affiliation = (
            db.query(UserAffiliation)
            .filter(UserAffiliation.id == STALE_AFFILIATION_ID)
            .count()
        )
        assert remaining_affiliation == 0

        if args.apply:
            db.commit()
            print()
            print("✅ Repair committed.")
        else:
            db.rollback()
            print()
            print("✅ Dry run validated all preconditions and changes.")
            print("Nothing was committed.")
            print("Run again with --apply to commit.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
