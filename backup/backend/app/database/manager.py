"""
DatabaseManager — Production-Grade Connection Pool Manager
==========================================================
Responsibilities:
  - Create and manage the SQLAlchemy engine and session factory
  - Retry connection on transient failures
  - Expose a transaction() context manager for safe read-write sessions
  - Health-check endpoint support via check_health()

Explicitly NOT responsible for:
  - Schema creation (use scripts/migrate.py)
  - Index creation (use scripts/migrate.py)
  - Data seeding (use scripts/seed.py)
  - Admin bootstrapping (use scripts/bootstrap_admin.py)
  - Lab scanning (use scripts/scan_labs.py)
"""

import logging
import threading
import time
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.database.connection import create_db_engine

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Thread-safe singleton that owns the SQLAlchemy engine and session factory.

    Lifecycle:
        init_db()   — called once at application startup
        shutdown()  — called once at application shutdown
    """

    def __init__(self):
        self.engine = None
        self.session_factory = None
        self.current_url: str | None = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    def init_db(self, force: bool = False) -> None:
        """
        Initialize the database connection pool.

        If force=False and the URL hasn't changed, this is a no-op.
        Retries up to 5 times with exponential back-off on transient failures.
        """
        with self._lock:
            settings.reload()
            target_url = settings.get_database_url()

            if (
                not force
                and self.engine is not None
                and self.session_factory is not None
                and self.current_url == target_url
            ):
                logger.debug("Database already initialized — skipping.")
                return

            # Dispose previous engine if we're re-initialising
            if self.engine is not None:
                logger.info("Re-initializing database — disposing previous engine...")
                try:
                    self.engine.dispose()
                except Exception as exc:
                    logger.warning(f"Error disposing old engine: {exc}")

            logger.info("Initializing database connection pool...")
            self._connect_with_retry(target_url)

    def _connect_with_retry(self, target_url: str, max_attempts: int = 5) -> None:
        """Attempt to connect, retrying with exponential back-off."""
        delay = 2
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"Database connection attempt {attempt}/{max_attempts}...")
                engine = create_db_engine(target_url)

                # Smoke-test the connection immediately
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))

                self.engine = engine
                self.session_factory = sessionmaker(
                    autocommit=False, autoflush=False, bind=self.engine
                )
                self.current_url = target_url

                dialect = self.engine.dialect.name
                logger.info(
                    f"Database connection established (dialect={dialect})."
                )
                return

            except OperationalError as exc:
                err = str(exc).lower()
                if "password authentication" in err or "authentication" in err:
                    logger.error("Database connection failed: authentication error — check credentials.")
                elif "timeout" in err:
                    logger.error("Database connection failed: connection timed out.")
                elif "ssl" in err:
                    logger.error("Database connection failed: SSL error.")
                else:
                    logger.error(f"Database connection attempt {attempt} failed: {exc}")

                if attempt < max_attempts:
                    logger.info(f"Retrying in {delay}s...")
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
                else:
                    raise RuntimeError(
                        f"Could not connect to database after {max_attempts} attempts."
                    ) from exc

            except Exception as exc:
                logger.error(f"Unexpected error during DB connection attempt {attempt}: {exc}")
                if attempt < max_attempts:
                    logger.info(f"Retrying in {delay}s...")
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
                else:
                    raise RuntimeError(
                        f"Could not connect to database after {max_attempts} attempts."
                    ) from exc

    # ------------------------------------------------------------------
    # Session Management
    # ------------------------------------------------------------------

    def get_session(self) -> Session:
        """
        Return a new database session.

        Auto-initialises if called before init_db() (safety net for tests).
        """
        target_url = settings.get_database_url()
        if self.session_factory is None or self.current_url != target_url:
            logger.info("Session requested before init or URL changed — calling init_db()...")
            self.init_db(force=(self.session_factory is None))

        if self.session_factory is None:
            raise RuntimeError("DatabaseManager not initialized. Call init_db() first.")

        return self.session_factory()

    @contextmanager
    def transaction(self):
        """
        Context manager that yields a session, commits on success, rolls back on error.

        Usage::

            with db_manager.transaction() as db:
                db.add(obj)
        """
        session = self.get_session()
        try:
            yield session
            session.commit()
        except Exception as exc:
            session.rollback()
            logger.error(f"Transaction rolled back: {exc}")
            raise
        finally:
            session.close()

    # ------------------------------------------------------------------
    # Health Check
    # ------------------------------------------------------------------

    def check_health(self) -> bool:
        """Return True if the database is reachable."""
        if not self.engine:
            return False
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as exc:
            logger.error(f"Database health check failed: {exc}")
            return False

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    def shutdown(self) -> None:
        """Gracefully dispose of all connection pool resources."""
        with self._lock:
            if self.engine is not None:
                logger.info("Disposing database connection pool...")
                try:
                    self.engine.dispose()
                except Exception as exc:
                    logger.warning(f"Error during database shutdown: {exc}")
                finally:
                    self.engine = None
                    self.session_factory = None
                    self.current_url = None


# Module-level singleton
db_manager = DatabaseManager()
