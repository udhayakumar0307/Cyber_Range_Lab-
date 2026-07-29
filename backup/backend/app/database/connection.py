"""
Database Engine Factory
=======================
Creates a SQLAlchemy engine with production-grade connection pool settings.

Pool configuration:
  pool_size      = 5    — persistent connections held open
  max_overflow   = 10   — extra connections allowed under burst load
  pool_timeout   = 30s  — max wait for a connection from the pool
  pool_recycle   = 1800s — recycle connections every 30 min (prevents stale)
  pool_pre_ping  = True  — test connection before use (detects dropped connections)

SQLite (development only):
  No pool — uses StaticPool for thread safety in development.
  WAL journal mode enabled for concurrent reads.
"""

import logging
from sqlalchemy import create_engine, event, text

logger = logging.getLogger(__name__)


def create_db_engine(url: str):
    """
    Create and return a SQLAlchemy engine tuned for production use.

    For SQLite: single-connection StaticPool with WAL mode.
    For PostgreSQL/MySQL: QueuePool with production-grade settings.
    """
    if url.startswith("sqlite"):
        from sqlalchemy.pool import StaticPool

        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        # Enable WAL mode for SQLite — allows concurrent readers during writes
        @event.listens_for(engine, "connect")
        def set_sqlite_wal(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA cache_size=-64000")   # 64 MB page cache
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        logger.info("SQLite engine created (WAL mode, StaticPool).")
        return engine

    # PostgreSQL / MySQL — production pool configuration
    logger.info(f"Creating connection pool for: {url.split('://')[0]}")
    return create_engine(
        url,
        # Connection pool sizing
        pool_size=5,          # Persistent connections; scale with concurrent workers
        max_overflow=10,      # Burst capacity on top of pool_size
        pool_timeout=30,      # Raise TimeoutError after 30s waiting for a connection
        # Connection hygiene
        pool_recycle=1800,    # Recycle connections after 30 min (avoids stale server-side disconnect)
        pool_pre_ping=True,   # Validate connection health before each use
        # Logging (SQLAlchemy internal)
        echo=False,
    )
