"""Pre-restart audit for Point #8 RBAC migration.

Run after `alembic upgrade head` and BEFORE restarting the backend service.
This script is read-only.
"""

from app.database.session import SessionLocal
from app.models.rbac import UserRoleBinding
from app.models.user import User
from app.services.authorization_service import AuthorizationService

ELEVATED_LEGACY = {
    "admin",
    "organization_admin",
    "org_admin",
    "professor",
    "instructor",
    "ta",
    "system_admin",
    "super_admin",
    "sysadmin",
}


def run():
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.id.asc()).all()
        elevated = [
            user for user in users
            if (user.role or "").strip().lower() in ELEVATED_LEGACY
        ]

        print("=" * 92)
        print("POINT #8 RBAC PRE-RESTART AUDIT")
        print("=" * 92)
        print(f"Elevated legacy identities found: {len(elevated)}")
        print()

        global_system_admins = 0
        warnings = 0

        for user in elevated:
            stored = (
                db.query(UserRoleBinding)
                .filter(UserRoleBinding.user_id == user.id)
                .order_by(UserRoleBinding.id.asc())
                .all()
            )
            active = AuthorizationService.active_bindings(db, user.id)
            caps = sorted(
                cap.value
                for cap in AuthorizationService.effective_capabilities(db, user.id)
            )

            print(f"User #{user.id}: {user.email}")
            print(f"  compatibility role: {user.role}")
            if not stored:
                print("  ❌ NO ROLE BINDINGS")
                warnings += 1
            else:
                for binding in stored:
                    state = "ACTIVE" if binding in active else "INACTIVE/EFFECTIVELY DISABLED"
                    print(
                        "  - "
                        f"{binding.role:<12} {binding.scope_type:<12} "
                        f"{binding.scope_key:<20} {state}"
                    )

            print(f"  effective capabilities: {', '.join(caps) if caps else 'NONE'}")

            if any(
                binding.role == "SYSTEM_ADMIN"
                and binding.scope_type == "GLOBAL"
                and binding in active
                for binding in stored
            ):
                global_system_admins += 1

            legacy_role = (user.role or "").lower()
            if legacy_role in {"system_admin", "super_admin", "sysadmin"} and not any(
                binding.role == "SYSTEM_ADMIN"
                and binding.scope_type == "GLOBAL"
                and binding in active
                for binding in stored
            ):
                print("  ❌ SYSTEM ADMIN LOST GLOBAL BINDING")
                warnings += 1

            if legacy_role in {
                "admin",
                "organization_admin",
                "org_admin",
                "professor",
                "instructor",
                "ta",
            } and not active:
                print(
                    "  ⚠️  No effective tenant scope. This account can authenticate "
                    "but administrative resource access will fail closed."
                )
                warnings += 1
            print()

        print("-" * 92)
        print(f"Effective GLOBAL system administrators: {global_system_admins}")
        print(f"Audit warnings: {warnings}")

        if global_system_admins == 0:
            print("❌ BLOCKER: No effective GLOBAL SYSTEM_ADMIN binding exists.")
            raise SystemExit(2)

        if warnings:
            print(
                "⚠️  Review the warnings above before restarting the backend. "
                "UNSCOPED or pending-tenant accounts are intentionally denied resource access."
            )
        else:
            print("✅ RBAC migration produced healthy effective bindings.")

    finally:
        db.close()


if __name__ == "__main__":
    run()
