#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys

from app.database.session import SessionLocal
from app.services.sysadmin_grading.config import SysadminGradingSettings
from app.services.sysadmin_grading.reconciliation import (
    SysadminReconciliationError,
    reconcile_sysadmin_assignment_progress,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Reconcile historical Linux Sysadmin submissions into "
            "assignment-scoped UserLabProgress."
        )
    )
    parser.add_argument(
        "--assignment-id",
        type=int,
        required=True,
    )
    parser.add_argument(
        "--student-id",
        type=int,
        required=True,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Commit changes. Without this flag the command always rolls back."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    settings = SysadminGradingSettings.from_env()
    db = SessionLocal()

    try:
        result = reconcile_sysadmin_assignment_progress(
            db,
            assignment_id=args.assignment_id,
            student_id=args.student_id,
            marketplace_lab_id=settings.marketplace_lab_id,
        )

        print("=" * 68)
        print("SYSADMIN ASSIGNMENT RECONCILIATION")
        print("=" * 68)
        print(f"mode={'APPLY' if args.apply else 'DRY-RUN'}")
        print(f"assignment_id={result.assignment_id}")
        print(f"student_id={result.student_id}")

        print()
        print(
            "candidate_submission_ids="
            + ",".join(
                str(value)
                for value in result.candidate_submission_ids
            )
        )
        print(
            "newly_scoped_submission_ids="
            + ",".join(
                str(value)
                for value in result.newly_scoped_submission_ids
            )
        )
        print(
            "already_scoped_submission_ids="
            + ",".join(
                str(value)
                for value in result.already_scoped_submission_ids
            )
        )

        print()
        print("Projected modules:")

        if not result.projected_modules:
            print("  NONE")
        else:
            for item in result.projected_modules:
                print(
                    f"  {item.module_id}: "
                    f"status={item.status} "
                    f"score={item.score} "
                    f"attempts={item.attempts} "
                    f"completed={item.completed}"
                )

        if args.apply:
            db.commit()
            print()
            print("COMMIT: reconciliation persisted")
        else:
            db.rollback()
            print()
            print("ROLLBACK: dry-run only; no changes persisted")

        return 0

    except SysadminReconciliationError as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
