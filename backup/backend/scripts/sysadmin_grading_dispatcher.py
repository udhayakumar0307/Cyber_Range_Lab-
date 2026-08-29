#!/usr/bin/env python3
from __future__ import annotations

import argparse
import logging
import os
import sys

# Ensure the backend package is importable when invoked from scripts/ or systemd.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

from app.core.logging_config import setup_logging
from app.database.session import SessionLocal
from app.services.sysadmin_grading.config import SysadminGradingSettings
from app.services.sysadmin_grading.dispatcher import SysadminGradingDispatcher


setup_logging()
logger = logging.getLogger("sysadmin-grading-dispatcher")


def main() -> int:
    parser = argparse.ArgumentParser(description="CyberRange Sysadmin SQS grading dispatcher")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Long-poll once and process at most one message, then exit.",
    )
    args = parser.parse_args()

    settings = SysadminGradingSettings.from_env()
    settings.assert_queue_ready()
    dispatcher = SysadminGradingDispatcher(
        settings=settings,
        session_factory=SessionLocal,
    )

    if args.once:
        dispatcher.run_once()
        return 0

    dispatcher.run_forever()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        logger.info("Sysadmin grading dispatcher stopped by operator")
        raise SystemExit(0)
