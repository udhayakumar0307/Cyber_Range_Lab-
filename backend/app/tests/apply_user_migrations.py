import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings
from app.database.connection import create_db_engine
from sqlalchemy import text

def apply_migrations():
    print(f"Connecting to AWS RDS database at {settings.DATABASE_URL.split('@')[-1]}...")
    engine = create_db_engine(settings.DATABASE_URL)
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        print("Executing ALTER TABLE users...")
        conn.execute(text("""
            ALTER TABLE users 
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
        print("MIGRATION SUCCESSFUL! All missing profile, settings, demographics, and theme columns added to AWS RDS PostgreSQL.")

if __name__ == "__main__":
    apply_migrations()
