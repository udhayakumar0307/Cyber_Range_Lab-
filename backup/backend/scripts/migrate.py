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
            ("phone_verified", "BOOLEAN DEFAULT 0"),
            ("designation", "VARCHAR(100) NULL"),
        ]
        for col, definition in user_cols:
            add_col_if_missing("users", col, definition)

        # colleges
        college_cols = [
            ("code", "VARCHAR(50) NULL"),
            ("city", "VARCHAR(100) NULL"),
            ("district", "VARCHAR(100) NULL"),
            ("state", "VARCHAR(100) NULL"),
            ("country", "VARCHAR(100) NULL"),
            ("contact_number", "VARCHAR(100) NULL"),
            ("email", "VARCHAR(150) NULL"),
            ("website", "VARCHAR(200) NULL"),
            ("logo_url", "VARCHAR(500) NULL"),
            ("status", "VARCHAR(50) DEFAULT 'ACTIVE'"),
            ("created_at", "TIMESTAMP NULL"),
            ("updated_at", "TIMESTAMP NULL"),
        ]
        for col, definition in college_cols:
            add_col_if_missing("colleges", col, definition)

        # labs
        add_col_if_missing("labs", "price_per_hour", "FLOAT DEFAULT 100.0")

        # lab_modules
        add_col_if_missing("lab_modules", "track", "VARCHAR(100) DEFAULT 'linux'")

        # organizations
        add_col_if_missing("organizations", "status", "VARCHAR(50) DEFAULT 'ACTIVE'")

        # assignments
        add_col_if_missing("assignments", "reminder_intervals", "VARCHAR(100) DEFAULT '24h,1h,15m'")

        # audit_logs
        audit_cols = [
            ("timestamp", "TIMESTAMP NULL"),
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

        # purchased_labs
        add_col_if_missing("purchased_labs", "hours_purchased", "INTEGER DEFAULT 0")
        add_col_if_missing("purchased_labs", "hours_used", "INTEGER DEFAULT 0")
        add_col_if_missing("purchased_labs", "hours_remaining", "INTEGER DEFAULT 0")
        add_col_if_missing("purchased_labs", "assigned_to", "VARCHAR(50) DEFAULT 'both'")
        add_col_if_missing("purchased_labs", "fixed_rate", "FLOAT DEFAULT 0.0")

        # cart_items
        add_col_if_missing("cart_items", "hours_purchased", "FLOAT DEFAULT 40.0")

        # order_items
        add_col_if_missing("order_items", "hours_purchased", "FLOAT DEFAULT 40.0")
        add_col_if_missing("order_items", "item_type", "VARCHAR(20) DEFAULT 'lab' NOT NULL")
        add_col_if_missing("order_items", "ctf_id", "INTEGER NULL")

        # licenses
        add_col_if_missing("licenses", "hours_allocated", "FLOAT DEFAULT 1.0")
        add_col_if_missing("licenses", "hours_used", "FLOAT DEFAULT 0.0")




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
                ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NULL;
            """))
            logger.info("  users: column migrations applied")

        if table_exists("colleges"):
            conn.execute(text("""
                ALTER TABLE colleges
                ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL,
                ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS district VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL,
                ADD COLUMN IF NOT EXISTS contact_number VARCHAR(250) NULL,
                ADD COLUMN IF NOT EXISTS email VARCHAR(250) NULL,
                ADD COLUMN IF NOT EXISTS website VARCHAR(200) NULL,
                ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL,
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE',
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            """))
            # Alter existing columns to match wider VARCHAR requirements
            try:
                conn.execute(text("""
                    ALTER TABLE colleges 
                    ALTER COLUMN name TYPE VARCHAR(500),
                    ALTER COLUMN address TYPE VARCHAR(1000),
                    ALTER COLUMN contact_number TYPE VARCHAR(250),
                    ALTER COLUMN email TYPE VARCHAR(250);
                """))
            except Exception as alt_err:
                logger.warning(f"Could not alter colleges column sizes: {alt_err}")
            logger.info("  colleges: column migrations and type resizes applied")

        if table_exists("lab_modules"):
            conn.execute(text("""
                ALTER TABLE lab_modules
                ADD COLUMN IF NOT EXISTS track VARCHAR(100) DEFAULT 'linux';
            """))
            logger.info("  lab_modules: column migrations applied")

        if table_exists("organizations"):
            conn.execute(text("""
                ALTER TABLE organizations
                ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
            """))
            logger.info("  organizations: column migrations applied")

        if table_exists("assignments"):
            conn.execute(text("""
                ALTER TABLE assignments
                ADD COLUMN IF NOT EXISTS reminder_intervals VARCHAR(100) DEFAULT '24h,1h,15m';
            """))
            logger.info("  assignments: column migrations applied")

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

        if table_exists("purchased_labs"):
            conn.execute(text("""
                ALTER TABLE purchased_labs
                ADD COLUMN IF NOT EXISTS hours_purchased INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS hours_used INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS hours_remaining INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(50) DEFAULT 'both',
                ADD COLUMN IF NOT EXISTS fixed_rate FLOAT DEFAULT 0.0;
            """))
            logger.info("  purchased_labs: column migrations applied")

        if table_exists("cart_items"):
            conn.execute(text("""
                ALTER TABLE cart_items
                ADD COLUMN IF NOT EXISTS hours_purchased FLOAT DEFAULT 40.0;
            """))
            conn.execute(text("""
                ALTER TABLE cart_items
                ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'lab';
            """))
            conn.execute(text("""
                ALTER TABLE cart_items
                ADD COLUMN IF NOT EXISTS ctf_id INTEGER;
            """))
            logger.info("  cart_items: column migrations applied")

        if table_exists("order_items"):
            conn.execute(text("""
                ALTER TABLE order_items
                ADD COLUMN IF NOT EXISTS hours_purchased FLOAT DEFAULT 40.0,
                ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'lab' NOT NULL,
                ADD COLUMN IF NOT EXISTS ctf_id INTEGER NULL;
            """))
            logger.info("  order_items: column migrations applied")

        if table_exists("licenses"):
            conn.execute(text("""
                ALTER TABLE licenses
                ADD COLUMN IF NOT EXISTS hours_allocated FLOAT DEFAULT 1.0,
                ADD COLUMN IF NOT EXISTS hours_used FLOAT DEFAULT 0.0;
            """))
            logger.info("  licenses: column migrations applied")




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

    # 4. Migrate existing data to user_affiliations
    migrate_existing_data(engine)

    # Reset colleges sequence for PostgreSQL to prevent sequence mismatch errors
    if dialect == "postgresql":
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            try:
                conn.execute(text("SELECT setval('colleges_id_seq', COALESCE((SELECT MAX(id)+1 FROM colleges), 1), false);"))
                logger.info("Reset colleges primary key sequence.")
            except Exception as seq_err:
                logger.warning(f"Could not reset colleges sequence: {seq_err}")

    # 5. Seed colleges from CSV datasets
    seed_colleges(engine)

    engine.dispose()
    logger.info("Migration complete.")


def migrate_existing_data(engine):
    """Maps existing users/admins to user_affiliations table."""
    logger.info("Migrating existing data to user_affiliations...")
    from sqlalchemy.orm import Session
    from app.models.user import User
    from app.models.user_affiliation import UserAffiliation
    from app.models.admin_models import Organization, AdminProfile

    session = Session(bind=engine)
    try:
        users = session.query(User).all()
        for u in users:
            existing_affs = session.query(UserAffiliation).filter(UserAffiliation.user_id == u.id).all()
            if existing_affs:
                continue

            primary_set = False

            # 1. Admin Organization ID mapping from profiles
            if u.role in ("admin", "SYSTEM_ADMIN", "super_admin"):
                profile = session.query(AdminProfile).filter(AdminProfile.user_id == u.id).first()
                if profile and profile.organization_id:
                    aff = UserAffiliation(
                        user_id=u.id,
                        affiliation_type="organization",
                        organization_id=profile.organization_id,
                        is_primary=True
                    )
                    session.add(aff)
                    primary_set = True
            
            # 2. College ID mapping
            if u.college_id:
                aff = UserAffiliation(
                    user_id=u.id,
                    affiliation_type="college",
                    college_id=u.college_id,
                    is_primary=not primary_set
                )
                session.add(aff)
                primary_set = True

            # 3. Organization text string mapping
            if hasattr(u, "organization") and u.organization:
                org = session.query(Organization).filter(Organization.name.ilike(u.organization.strip())).first()
                if not org:
                    org = Organization(name=u.organization.strip(), institution_type="Company", status="APPROVED")
                    session.add(org)
                    session.flush()
                
                aff = UserAffiliation(
                    user_id=u.id,
                    affiliation_type="organization",
                    organization_id=org.id,
                    is_primary=not primary_set
                )
                session.add(aff)

        session.commit()
        logger.info("Data migration completed successfully.")
    except Exception as e:
        session.rollback()
        logger.error(f"Error during data migration: {e}")
    finally:
        session.close()


def seed_colleges(engine):
    """
    Scans the backend/data/seed/ directory, parses college CSV files,
    and seeds/updates the colleges table in the database.
    """
    logger.info("Scanning for college CSV datasets in data/seed/...")
    import csv
    import glob
    from sqlalchemy.orm import Session
    from app.models.college import College

    session = Session(bind=engine)
    
    seed_dir = os.path.join(BACKEND_DIR, "data", "seed")
    csv_files = glob.glob(os.path.join(seed_dir, "*.csv"))
    
    if not csv_files:
        logger.info("No CSV files found in data/seed/")
        session.close()
        return

    imported = 0
    updated = 0
    skipped = 0
    failed = 0

    # Cache existing colleges in a dict for O(1) lookups and single DB round-trip
    existing_colleges = {c.name: c for c in session.query(College).all()}
    base_count = len(existing_colleges)

    for csv_file in csv_files:
        logger.info(f"Processing CSV dataset: {os.path.basename(csv_file)}")
        try:
            with open(csv_file, mode="r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader, start=1):
                    name = (row.get("College Name") or row.get("college_name") or row.get("Name") or "").strip()
                    address = (row.get("Address") or row.get("address") or "").strip()
                    state = (row.get("State") or row.get("state") or "Tamil Nadu").strip()
                    contact_number = (row.get("Contact No(s)") or row.get("Contact Number") or row.get("contact_number") or "").strip()
                    email = (row.get("E-Mail ID") or row.get("Email") or row.get("email") or "").strip()
                    website = (row.get("Weblink") or row.get("Website") or row.get("website") or "").strip()
                    city = (row.get("City") or row.get("city") or "").strip()
                    district = (row.get("District") or row.get("district") or "").strip()
                    country = (row.get("Country") or row.get("country") or "India").strip()

                    if not name:
                        skipped += 1
                        continue

                    # Try to extract city from address if empty
                    if not city and address:
                        parts = [p.strip() for p in address.split(",") if p.strip()]
                        if len(parts) >= 2:
                            city = parts[-2]

                    # Find existing college
                    college = existing_colleges.get(name)
                    
                    if college:
                        # Update changed fields
                        changed = False
                        if college.address != address:
                            college.address = address
                            changed = True
                        if college.state != state:
                            college.state = state
                            changed = True
                        if college.contact_number != contact_number:
                            college.contact_number = contact_number
                            changed = True
                        if college.email != email:
                            college.email = email
                            changed = True
                        if college.website != website:
                            college.website = website
                            changed = True
                        if city and college.city != city:
                            college.city = city
                            changed = True
                        if district and college.district != district:
                            college.district = district
                            changed = True
                        
                        if changed:
                            updated += 1
                        else:
                            skipped += 1
                    else:
                        # Generate unique college code
                        code = f"TNC{base_count + imported + 1:04d}"
                        
                        college = College(
                            name=name,
                            code=code,
                            address=address,
                            state=state,
                            contact_number=contact_number,
                            email=email,
                            website=website,
                            city=city,
                            district=district,
                            country=country,
                            status="ACTIVE"
                        )
                        session.add(college)
                        # Add to cached dictionary in case of CSV duplicates
                        existing_colleges[name] = college
                        imported += 1
                        
                    if idx % 100 == 0:
                        session.flush()

            session.commit()
        except Exception as exc:
            session.rollback()
            logger.error(f"Error importing {csv_file}: {exc}")
            failed += 1

    session.close()
    logger.info("========================================")
    logger.info("SEED DATABASE REPORT:")
    logger.info(f"  Imported: {imported}")
    logger.info(f"  Updated:  {updated}")
    logger.info(f"  Skipped:  {skipped}")
    logger.info(f"  Failed:   {failed}")
    logger.info("========================================")


if __name__ == "__main__":
    main()
