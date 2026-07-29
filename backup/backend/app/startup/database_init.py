"""
database_init.py — Minimal startup connector
=============================================
All schema creation, seeding, and admin bootstrapping has been moved to
dedicated scripts in backend/scripts/. This module now only initialises
the connection pool — nothing more.

Run once before first deployment:

    python scripts/migrate.py         # create tables, apply indexes
    python scripts/seed.py            # seed static data
    python scripts/bootstrap_admin.py # create admin accounts

These scripts are idempotent and safe to re-run.
"""

import logging
from app.database.manager import db_manager

logger = logging.getLogger(__name__)


def initialize_database() -> None:
    """
    Called from main.py lifespan. Creates the connection pool and verifies
    database connectivity. Does NOT create tables, seed data, or run migrations.
    """
    logger.info("Initializing database connection pool...")
    db_manager.init_db()
    logger.info("Database ready.")
