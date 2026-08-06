"""
scripts/migrate.py — One-time Database Schema Migration Script
==============================================================
Run ONCE before the first deployment or after model changes:

    cd backend
    python scripts/migrate.py

What this script does:
  1. Creates all tables using SQLAlchemy metadata (create_all)
  2. Applies SQLite / PostgreSQL column migrations (ALTER TABLE IF NOT EXISTS)
  3. Creates all performance indexes

This script is IDEMPOTENT — safe to run multiple times.
It will NOT recreate existing tables or indexes.

Do NOT call this from application startup (main.py).
"""

import os
import sys
import logging

# Ensure the backend package is importable when called from the scripts/ directory
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger("migrate")

from app.core.config import settings
settings.reload()

from app.database.connection import create_db_engine
from sqlalchemy import text, inspect


def run_sqlite_column_migrations(engine):
    """Apply missing columns to existing SQLite tables."""
    logger.info("Running SQLite column migrations...")
    with engine.begin() as conn:
        def table_exists(name):
            return bool(conn.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{name}'")).first())

        def get_cols(table):
            return [c[1] for c in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()]

        def add_col_if_missing(table, col, col_def):
            if table_exists(table) and col not in get_cols(table):
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                logger.info(f"  + {table}.{col}")

        # users
        user_cols = [
            ("account_type", "VARCHAR(50) DEFAULT 'INDIVIDUAL'"),
            ("account_status", "VARCHAR(50) DEFAULT 'active'"),
            ("email_verified", "BOOLEAN DEFAULT 1"),
            ("tenant_id", "VARCHAR(100) DEFAULT 'default'"),
            ("is_internal", "BOOLEAN DEFAULT 0"),
            ("google_id", "VARCHAR(255) NULL"),
            ("provider", "VARCHAR(50) DEFAULT 'local'"),
            ("department", "VARCHAR(100) NULL"),
            ("year", "INTEGER NULL"),
            ("roll_number", "VARCHAR(100) NULL"),
            ("total_score", "INTEGER DEFAULT 0"),
            ("profile_completed", "BOOLEAN DEFAULT 0"),
            ("profile_photo", "VARCHAR(500) NULL"),
            ("phone", "VARCHAR(50) NULL"),
            ("dob", "VARCHAR(50) NULL"),
            ("gender", "VARCHAR(50) NULL"),
            ("country", "VARCHAR(100) NULL"),
            ("state", "VARCHAR(100) NULL"),
            ("city", "VARCHAR(100) NULL"),
            ("profession", "VARCHAR(100) NULL"),
            ("organization", "VARCHAR(100) NULL"),
            ("experience", "VARCHAR(100) NULL"),
            ("highest_qualification", "VARCHAR(100) NULL"),
            ("course", "VARCHAR(100) NULL"),
            ("semester", "INTEGER NULL"),
            ("section", "VARCHAR(50) NULL"),
            ("professor", "VARCHAR(100) NULL"),
            ("batch", "VARCHAR(100) NULL"),
            ("student_id_num", "VARCHAR(100) NULL"),
            ("theme", "VARCHAR(20) DEFAULT 'dark'"),
            ("language", "VARCHAR(20) DEFAULT 'en'"),
            ("timezone", "VARCHAR(50) DEFAULT 'UTC'"),
            ("notification_settings", "TEXT NULL"),
            ("security_settings", "TEXT NULL"),
            ("appearance_settings", "TEXT NULL"),
            ("last_login", "TIMESTAMP NULL"),
        ]
        for col, definition in user_cols:
            add_col_if_missing("users", col, definition)

        # colleges
        college_cols = [
            ("code", "VARCHAR(50) NULL"),
            ("city", "VARCHAR(100) NULL"),
            ("country", "VARCHAR(100) NULL"),
            ("status", "VARCHAR(50) DEFAULT 'ACTIVE'"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ]
        for col, definition in college_cols:
            add_col_if_missing("colleges", col, definition)

        # lab_modules
        add_col_if_missing("lab_modules", "track", "VARCHAR(100) DEFAULT 'linux'")

        # audit_logs
        audit_cols = [
            ("timestamp", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("action", "VARCHAR(100) NULL"),
            ("entity", "VARCHAR(100) NULL"),
            ("entity_id", "VARCHAR(100) NULL"),
            ("performed_by", "VARCHAR(255) NULL"),
            ("performed_by_role", "VARCHAR(50) NULL"),
            ("organization_id", "VARCHAR(100) NULL"),
            ("ip_address", "VARCHAR(100) NULL"),
            ("browser", "VARCHAR(100) NULL"),
            ("operating_system", "VARCHAR(100) NULL"),
            ("request_method", "VARCHAR(20) NULL"),
            ("endpoint", "VARCHAR(255) NULL"),
            ("status", "VARCHAR(50) DEFAULT 'SUCCESS'"),
            ("old_value", "TEXT NULL"),
            ("new_value", "TEXT NULL"),
            ("user_id", "INTEGER NULL"),
            ("request_id", "VARCHAR(100) NULL"),
            ("resource", "VARCHAR(100) NULL"),
            ("resource_id", "VARCHAR(100) NULL"),
            ("device", "VARCHAR(100) NULL"),
        ]
        for col, definition in audit_cols:
            add_col_if_missing("audit_logs", col, definition)

        # groups
        add_col_if_missing("groups", "organization_id", "VARCHAR(100) NULL")


def run_postgres_column_migrations(engine):
    """Apply missing columns to existing PostgreSQL tables using IF NOT EXISTS."""
    logger.info("Running PostgreSQL column migrations...")
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        def table_exists(name):
            return bool(conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=:t)"
            ), {"t": name}).scalar())

        if table_exists("users"):
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'INDIVIDUAL',
                ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active',
                ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'default',
                ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) NULL,
                ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'local',
                ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS year INTEGER NULL,
                ADD COLUMN IF NOT EXISTS roll_number VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS total_score INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500) NULL,
                ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS dob VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS gender VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS profession VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS organization VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS experience VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS highest_qualification VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS course VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS semester INTEGER NULL,
                ADD COLUMN IF NOT EXISTS section VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS professor VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS batch VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS student_id_num VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'dark',
                ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en',
                ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
                ADD COLUMN IF NOT EXISTS notification_settings TEXT NULL,
                ADD COLUMN IF NOT EXISTS security_settings TEXT NULL,
                ADD COLUMN IF NOT EXISTS appearance_settings TEXT NULL,
                ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;
            """))
            logger.info("  users: column migrations applied")

        if table_exists("colleges"):
            conn.execute(text("""
                ALTER TABLE colleges
                ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE',
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            """))
            logger.info("  colleges: column migrations applied")

        if table_exists("lab_modules"):
            conn.execute(text("""
                ALTER TABLE lab_modules
                ADD COLUMN IF NOT EXISTS track VARCHAR(100) DEFAULT 'linux';
            """))
            logger.info("  lab_modules: column migrations applied")

        if table_exists("audit_logs"):
            conn.execute(text("""
                ALTER TABLE audit_logs
                ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ADD COLUMN IF NOT EXISTS action VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS entity VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS entity_id VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS performed_by VARCHAR(255) NULL,
                ADD COLUMN IF NOT EXISTS performed_by_role VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS browser VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS request_method VARCHAR(20) NULL,
                ADD COLUMN IF NOT EXISTS endpoint VARCHAR(255) NULL,
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'SUCCESS',
                ADD COLUMN IF NOT EXISTS old_value TEXT NULL,
                ADD COLUMN IF NOT EXISTS new_value TEXT NULL,
                ADD COLUMN IF NOT EXISTS user_id INTEGER NULL,
                ADD COLUMN IF NOT EXISTS request_id VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS resource VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS resource_id VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS device VARCHAR(100) NULL;
            """))
            logger.info("  audit_logs: column migrations applied")

        if table_exists("groups"):
            conn.execute(text("""
                ALTER TABLE groups
                ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100) NULL;
            """))
            logger.info("  groups: column migrations applied")

        if table_exists("orders"):
            conn.execute(text("""
                ALTER TABLE orders
                ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(150) NULL,
                ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING';
            """))
            logger.info("  orders: column migrations applied")


def apply_indexes(engine):
    """Create performance indexes if they don't already exist."""
    dialect = engine.dialect.name
    indexes = [
        # users
        ("ix_users_total_score", "users", "total_score"),
        ("ix_users_role", "users", "role"),
        ("ix_users_college_id", "users", "college_id"),
        ("ix_users_is_active", "users", "is_active"),
        # user_lab_progress
        ("ix_ulp_user_status", "user_lab_progress", "user_id, status"),
        ("ix_ulp_user_lab_status", "user_lab_progress", "user_id, lab_id, status"),
        ("ix_ulp_completed_at", "user_lab_progress", "completed_at"),
        ("ix_ulp_module_id", "user_lab_progress", "module_id"),
        # audit_logs
        ("ix_audit_user_timestamp", "audit_logs", "user_id, timestamp"),
        ("ix_audit_org_timestamp", "audit_logs", "organization_id, timestamp"),
        # study_sessions
        ("ix_study_user_id", "study_sessions", "user_id"),
        ("ix_study_logout_time", "study_sessions", "logout_time"),
        # user_achievements
        ("ix_ua_user_id", "user_achievements", "user_id"),
        # lab_modules
        ("ix_lm_lab_id", "lab_modules", "lab_id"),
        # score_events
        ("ix_se_user_module", "score_events", "user_id, module_id"),
        # certificates
        ("ix_cert_user_lab", "certificates", "user_id, lab_id"),
        ("ix_cert_display_id", "certificates", "display_certificate_id"),
    ]

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    created = skipped = 0

    with engine.connect() as conn:
        for idx_name, table, cols in indexes:
            if table not in existing_tables:
                skipped += 1
                continue
            try:
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{table}" ({cols})'))
                try:
                    conn.commit()
                except Exception:
                    pass
                logger.info(f"  Index: {idx_name} on {table}({cols})")
                created += 1
            except Exception as exc:
                err = str(exc).lower()
                if "already exists" in err or "duplicate" in err:
                    skipped += 1
                else:
                    logger.warning(f"  Index {idx_name} failed: {exc}")

    logger.info(f"Indexes: {created} created, {skipped} skipped.")


def main():
    url = settings.get_database_url()
    logger.info(f"Migration target: {url.split('://')[0]}")

    engine = create_db_engine(url)

    # 1. Create all tables
    logger.info("Creating tables (create_all)...")
    from app.models.base import Base
    import app.models  # noqa: F401 — registers all ORM models
    Base.metadata.create_all(bind=engine)
    logger.info("Tables: done.")

    # 2. Apply column migrations
    dialect = engine.dialect.name
    if dialect == "sqlite":
        run_sqlite_column_migrations(engine)
    else:
        run_postgres_column_migrations(engine)

    # 3. Apply performance indexes
    logger.info("Applying performance indexes...")
    apply_indexes(engine)

    engine.dispose()
    logger.info("Migration complete.")


if __name__ == "__main__":
    main()
