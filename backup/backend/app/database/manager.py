import os
import time
import logging
import threading
from contextlib import contextmanager
from sqlalchemy import text, create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from app.core.config import settings
from app.database.connection import create_db_engine

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.engine = None
        self.session_factory = None
        self.current_url = None
        self._lock = threading.Lock()

    def init_db(self, force=False):
        """
        Initializes the database connection.
        If force=True or the URL in config has changed, it disposes of old pools
        and connects to the new target.
        """
        with self._lock:
            # Re-read config (reloads .env internally)
            settings.reload()
            target_url = settings.get_database_url()
            
            if self.engine is not None and self.session_factory is not None and self.current_url == target_url and not force:
                return

            # Check and create database if using PostgreSQL
            if "postgresql" in target_url or "postgres" in target_url:
                target_db = "unknown"
                try:
                    parsed_url = make_url(target_url)
                    target_db = parsed_url.database
                    
                    if target_db and target_db != "postgres":
                        # Construct a connection URL pointing to default 'postgres' database
                        postgres_url = parsed_url.set(database="postgres")
                        logger.info(f"Connecting to database server's default 'postgres' database to verify if '{target_db}' exists...")
                        
                        # Connect with a temporary engine
                        temp_engine = create_engine(postgres_url)
                        
                        # Set isolation level to AUTOCOMMIT (required for CREATE DATABASE)
                        with temp_engine.connect() as conn:
                            conn = conn.execution_options(isolation_level="AUTOCOMMIT")
                            
                            # Verify if target db exists
                            query = text("SELECT 1 FROM pg_database WHERE datname = :dbname")
                            result = conn.execute(query, {"dbname": target_db})
                            db_exists = bool(result.scalar())
                            
                            if not db_exists:
                                logger.info(f"Database '{target_db}' not found on server. Creating database '{target_db}'...")
                                # Execute CREATE DATABASE
                                conn.execute(text(f'CREATE DATABASE "{target_db}"'))
                                logger.info(f"Database '{target_db}' created successfully.")
                            else:
                                logger.info(f"Database '{target_db}' verified to exist on server.")
                                
                        temp_engine.dispose()
                except Exception as e:
                    logger.error(f"Failed to check or auto-create database '{target_db}': {e}", exc_info=True)

            logger.info("Initializing database connection pool...")
            
            # Dispose of old engine if it exists
            if self.engine is not None:
                logger.info("Disposing of previous database engine connection pool...")
                try:
                    self.engine.dispose()
                except Exception as e:
                    logger.error(f"Error disposing old engine: {e}")
            
            # Connect with retry logic
            max_retries = 5
            retry_delay = 2
            connected = False
            
            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"Database connection attempt {attempt} of {max_retries}...")
                    engine = create_db_engine(target_url)
                    
                    # Test connection
                    with engine.connect() as conn:
                        conn.execute(text("SELECT 1"))
                        
                    self.engine = engine
                    self.session_factory = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
                    self.current_url = target_url
                    
                    dialect_name = self.engine.dialect.name
                    if dialect_name == "postgresql":
                        logger.info("Connected to AWS RDS / PostgreSQL database successfully.")
                    else:
                        logger.info(f"Successfully connected to database with dialect: {dialect_name}")
                        
                    connected = True
                    break
                except OperationalError as oe:
                    err_str = str(oe).lower()
                    if "timeout" in err_str:
                        logger.error(f"Database connection attempt {attempt} failed due to Connection Timeout.")
                    elif "password authentication failed" in err_str or "authentication" in err_str:
                        logger.error(f"Database connection attempt {attempt} failed due to Authentication Error (invalid credentials).")
                    elif "ssl" in err_str:
                        logger.error(f"Database connection attempt {attempt} failed due to SSL Error.")
                    else:
                        logger.error(f"Database connection attempt {attempt} failed due to OperationalError: {oe}")
                    
                    if attempt < max_retries:
                        logger.info(f"Retrying connection in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        raise RuntimeError(f"Could not connect to database after {max_retries} attempts due to OperationalError.") from oe
                except Exception as e:
                    logger.error(f"Database connection attempt {attempt} failed due to unexpected error: {e}")
                    if attempt < max_retries:
                        logger.info(f"Retrying connection in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        raise RuntimeError(f"Could not connect to database after {max_retries} attempts.") from e
            
            if connected:
                # Automatic table creation (Development / Dynamic Switching fallback)
                self._auto_create_tables()

    def _auto_create_tables(self):
        """
        Automatically creates tables using SQLAlchemy ORM.
        This handles both development automatic table creation and dynamic database setup.
        """
        try:
            from app.models.base import Base
            # Import models to ensure they are registered with Base
            import app.models
            
            # Dynamic migrations for existing tables
            dialect = self.engine.dialect.name
            with self.engine.begin() as conn:
                if dialect == "sqlite":
                    users_exists = bool(conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")).first())
                    if users_exists:
                        cols = [c[1] for c in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                        if "account_type" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN account_type VARCHAR(50) DEFAULT 'INDIVIDUAL'"))
                        if "department" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN department VARCHAR(100) NULL"))
                        if "year" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN year INTEGER NULL"))
                        if "roll_number" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN roll_number VARCHAR(100) NULL"))
                        if "total_score" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN total_score INTEGER DEFAULT 0"))
                        if "profile_completed" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN profile_completed BOOLEAN DEFAULT 0"))
                        if "profile_photo" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN profile_photo VARCHAR(500) NULL"))
                        if "phone" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL"))
                        if "dob" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN dob VARCHAR(50) NULL"))
                        if "gender" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR(50) NULL"))
                        if "country" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL"))
                        if "state" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN state VARCHAR(100) NULL"))
                        if "city" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN city VARCHAR(100) NULL"))
                        if "profession" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN profession VARCHAR(100) NULL"))
                        if "organization" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN organization VARCHAR(100) NULL"))
                        if "experience" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN experience VARCHAR(100) NULL"))
                        if "highest_qualification" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN highest_qualification VARCHAR(100) NULL"))
                        if "course" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN course VARCHAR(100) NULL"))
                        if "semester" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN semester INTEGER NULL"))
                        if "section" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN section VARCHAR(50) NULL"))
                        if "professor" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN professor VARCHAR(100) NULL"))
                        if "batch" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN batch VARCHAR(100) NULL"))
                        if "student_id_num" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN student_id_num VARCHAR(100) NULL"))
                        if "theme" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'dark'"))
                        if "language" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN language VARCHAR(20) DEFAULT 'en'"))
                        if "timezone" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC'"))
                        if "notification_settings" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN notification_settings TEXT NULL"))
                        if "security_settings" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN security_settings TEXT NULL"))
                        if "appearance_settings" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN appearance_settings TEXT NULL"))
                        if "last_login" not in cols:
                            conn.execute(text("ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL"))
                    
                    colleges_exists = bool(conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='colleges'")).first())
                    if colleges_exists:
                        col_cols = [c[1] for c in conn.execute(text("PRAGMA table_info(colleges)")).fetchall()]
                        if "code" not in col_cols:
                            conn.execute(text("ALTER TABLE colleges ADD COLUMN code VARCHAR(50) NULL"))
                        if "city" not in col_cols:
                            conn.execute(text("ALTER TABLE colleges ADD COLUMN city VARCHAR(100) NULL"))
                        if "country" not in col_cols:
                            conn.execute(text("ALTER TABLE colleges ADD COLUMN country VARCHAR(100) NULL"))
                        if "status" not in col_cols:
                            conn.execute(text("ALTER TABLE colleges ADD COLUMN status VARCHAR(50) DEFAULT 'ACTIVE'"))
                        if "created_at" not in col_cols:
                            conn.execute(text("ALTER TABLE colleges ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
                    
                    lm_exists = bool(conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='lab_modules'")).first())
                    if lm_exists:
                        lm_cols = [c[1] for c in conn.execute(text("PRAGMA table_info(lab_modules)")).fetchall()]
                        if "track" not in lm_cols:
                            conn.execute(text("ALTER TABLE lab_modules ADD COLUMN track VARCHAR(100) DEFAULT 'linux'"))
                else:
                    # Postgres migrations
                    try:
                        with self.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as pconn:
                            users_exists = bool(pconn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')")).scalar())
                            if users_exists:
                                pconn.execute(text("""
                                    ALTER TABLE users 
                                    ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'INDIVIDUAL',
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
                            colleges_exists = bool(pconn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'colleges')")).scalar())
                            if colleges_exists:
                                pconn.execute(text("""
                                    ALTER TABLE colleges
                                    ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL,
                                    ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL,
                                    ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL,
                                    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE',
                                    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                                """))
                            lm_exists = bool(pconn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lab_modules')")).scalar())
                            if lm_exists:
                                pconn.execute(text("""
                                    ALTER TABLE lab_modules
                                    ADD COLUMN IF NOT EXISTS track VARCHAR(100) DEFAULT 'linux';
                                """))
                            audit_exists = bool(pconn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs')")).scalar())
                            if audit_exists:
                                pconn.execute(text("""
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
                            groups_exists = bool(pconn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups')")).scalar())
                            if groups_exists:
                                pconn.execute(text("""
                                    ALTER TABLE groups
                                    ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100) NULL;
                                """))
                    except Exception as pg_err:
                        logger.warning(f"Postgres migration check skipped or deferred: {pg_err}")

            
            logger.info("Verifying and creating missing database tables...")
            Base.metadata.create_all(bind=self.engine)
            logger.info("Tables created")
            
            # Triggers default admin creation
            self._create_default_admin()
        except Exception as e:
            logger.error(f"Failed to auto-create tables or default admin: {e}", exc_info=True)

    def _create_default_admin(self):
        """
        Checks for and creates the default admin user.
        """
        try:
            # We defer import to avoid circular dependencies
            from app.startup.database_init import create_default_admin_logic
            create_default_admin_logic(self.session_factory)
        except Exception as e:
            logger.error(f"Error running default admin logic: {e}")

    def check_health(self) -> bool:
        """
        Checks database connection health.
        """
        if not self.engine:
            return False
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    def get_session(self) -> Session:
        """
        Returns a database session. Automatically initializes or re-initializes if uninitialized
        or if DATABASE_URL changes.
        """
        target_url = settings.get_database_url()
        if self.session_factory is None or self.current_url != target_url:
            logger.info("Database session requested before initialization or URL change detected. Triggering init_db()...")
            self.init_db(force=(self.session_factory is None))
            
        if self.session_factory is None:
            raise RuntimeError("DatabaseManager has not been initialized. Call init_db() first.")
            
        return self.session_factory()

    @contextmanager
    def transaction(self):
        """
        Transaction context manager.
        """
        session = self.get_session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Transaction failed and was rolled back: {e}")
            raise e
        finally:
            session.close()

    def shutdown(self):
        """
        Gracefully disposes of database connection pools.
        """
        with self._lock:
            if self.engine is not None:
                logger.info("Shutting down Database Manager connection pool...")
                try:
                    self.engine.dispose()
                except Exception as e:
                    logger.error(f"Error during database shutdown: {e}")
                self.engine = None
                self.session_factory = None
                self.current_url = None

db_manager = DatabaseManager()
