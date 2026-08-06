"""
scripts/scan_labs.py — Lab Filesystem Scanner
==============================================
Syncs lab metadata from labs/*/metadata.json into the database.

Run whenever you add, update, or remove a lab from the filesystem:

    cd backend
    python scripts/scan_labs.py

This replaces the startup-time scan_lab_directory() call.
"""

import os
import sys
import logging

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
setup_logging()
logger = logging.getLogger("scan_labs")

from app.core.config import settings
settings.reload()

from app.database.manager import db_manager
db_manager.init_db()


def main():
    from app.services.lab_scanner import scan_lab_directory
    with db_manager.transaction() as session:
        result = scan_lab_directory(session, notify=False)
    logger.info(f"Lab scan complete: {result}")


if __name__ == "__main__":
    main()
