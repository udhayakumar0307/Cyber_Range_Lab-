"""
scripts/bootstrap_admin.py — Admin Account Bootstrap Script
============================================================
Run to create or update admin and system admin accounts:

    cd backend
    python scripts/bootstrap_admin.py

This script is IDEMPOTENT. It reads credentials from .env settings.

Accounts created/updated:
  - Default admin (admin@cyberrange.in)
  - Configured admin (ADMIN_EMAIL from .env, if different)
  - System Admin (SYSTEM_ADMIN_EMAIL from .env)
  - Demo user (user@cyberrange.in)

SECURITY: Passwords are hashed with bcrypt. Plain-text passwords are
never stored. This script updates passwords on every run — useful for
rotating credentials during deployment.
"""

import os
import sys
import logging

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger("bootstrap_admin")

from app.core.config import settings
settings.reload()

from app.database.manager import db_manager
db_manager.init_db()


def upsert_user(session, email: str, name: str, password: str, role: str, organization: str = None):
    """Create or update a user account."""
    from app.models.user import User
    from app.core.security import get_password_hash

    hashed = get_password_hash(password)
    user = session.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            name=name,
            email=email,
            password_hash=hashed,
            role=role,
            organization=organization,
            is_active=True,
        )
        session.add(user)
        logger.info(f"  Created: {email} (role={role})")
    else:
        user.password_hash = hashed
        user.role = role
        user.is_active = True
        if organization:
            user.organization = organization
        logger.info(f"  Updated: {email} (role={role})")
    session.flush()
    return user


def main():
    with db_manager.transaction() as session:
        # 1. Default admin
        upsert_user(session, "admin@cyberrange.in", "Admin", "password", "admin", "CyberRange HQ")

        # 2. Configured admin from .env (if distinct from default)
        if settings.ADMIN_EMAIL and settings.ADMIN_EMAIL != "admin@cyberrange.in":
            password = settings.ADMIN_PASSWORD or "password"
            upsert_user(session, settings.ADMIN_EMAIL, settings.ADMIN_USERNAME or "Admin",
                        password, "admin")

        # 3. System admin from .env
        sys_email = settings.SYSTEM_ADMIN_EMAIL or "sysadmin@cyberrange.in"
        sys_password = settings.SYSTEM_ADMIN_PASSWORD or "sysadmin_password_2026"
        sys_name = settings.SYSTEM_ADMIN_NAME or "System Admin"
        upsert_user(session, sys_email, sys_name, sys_password, "SYSTEM_ADMIN", "CyberRange Platform")

        # 4. Demo user
        upsert_user(session, "user@cyberrange.in", "Alex Operator", "password", "user")

    logger.info("Admin bootstrap complete.")


if __name__ == "__main__":
    main()
