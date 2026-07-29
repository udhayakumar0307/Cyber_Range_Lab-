"""
Enterprise Authentication Separation Schema Migration Script
Ensures all required enterprise fields (role, account_type, account_status, email_verified, tenant_id, is_internal)
exist in the users database table and populates proper default values.
"""

import sys
import os
import logging
from sqlalchemy import create_engine, text

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    db_url = settings.get_database_url()
    logger.info(f"Connecting to database for auth schema migration...")
    
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Add columns if not existing (PostgreSQL / SQLite compatible)
            columns_to_add = [
                ("account_type", "VARCHAR(50) DEFAULT 'student' NOT NULL"),
                ("account_status", "VARCHAR(50) DEFAULT 'active' NOT NULL"),
                ("email_verified", "BOOLEAN DEFAULT TRUE NOT NULL"),
                ("tenant_id", "VARCHAR(100) DEFAULT 'default'"),
                ("is_internal", "BOOLEAN DEFAULT FALSE NOT NULL"),
                ("google_id", "VARCHAR(255)"),
                ("provider", "VARCHAR(50) DEFAULT 'local' NOT NULL")
            ]

            is_sqlite = "sqlite" in db_url.lower()

            for col_name, col_def in columns_to_add:
                if is_sqlite:
                    # SQLite syntax
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}"))
                        logger.info(f"Added column '{col_name}' to SQLite users table.")
                    except Exception as e:
                        logger.info(f"Column '{col_name}' already exists or not added: {e}")
                else:
                    # PostgreSQL syntax
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def};"))
                    logger.info(f"Ensured column '{col_name}' in PostgreSQL users table.")

            # 2. Update existing accounts based on domain and role
            # Mark all @cyberrange.in accounts and admin/super_admin roles as internal
            update_internal_sql = text("""
                UPDATE users
                SET is_internal = TRUE,
                    account_type = 'internal',
                    tenant_id = 'cyberrange'
                WHERE LOWER(email) LIKE '%@cyberrange.in'
                   OR LOWER(role) IN ('admin', 'super_admin', 'platform_admin', 'security_admin', 'support_engineer', 'operations_team')
            """)
            result_internal = conn.execute(update_internal_sql)
            logger.info(f"Updated internal admin accounts (is_internal=True). Count: {result_internal.rowcount if hasattr(result_internal, 'rowcount') else 'N/A'}")

            # Mark all other accounts as external student/user accounts if not set
            update_student_sql = text("""
                UPDATE users
                SET is_internal = FALSE,
                    account_type = 'student'
                WHERE LOWER(email) NOT LIKE '%@cyberrange.in'
                  AND LOWER(role) NOT IN ('admin', 'super_admin', 'platform_admin', 'security_admin', 'support_engineer', 'operations_team')
                  AND (account_type IS NULL OR account_type = 'INDIVIDUAL' OR account_type = 'student')
            """)
            result_student = conn.execute(update_student_sql)
            logger.info(f"Updated student accounts (is_internal=False). Count: {result_student.rowcount if hasattr(result_student, 'rowcount') else 'N/A'}")

            trans.commit()
            logger.info("✅ Auth Schema Migration Completed Successfully!")
        except Exception as e:
            trans.rollback()
            logger.error(f"❌ Migration failed: {e}")
            raise e

if __name__ == "__main__":
    migrate()
