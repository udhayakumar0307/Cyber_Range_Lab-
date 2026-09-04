from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.lab_module import LabModule
from app.models.sysadmin_submission import SysadminSubmission
from app.models.user_lab_progress import UserLabProgress


class SysadminProgressProjectionError(RuntimeError):
    """Raised when academic Sysadmin progress cannot be projected safely."""


@dataclass(frozen=True)
class SysadminProgressProjectionResult:
    assignment_id: int
    user_id: int
    module_id: str
    status: str
    score: int
    attempts: int
    completed: bool
    created: bool


def _attempt_end(row: SysadminSubmission) -> datetime:
    return (
        row.completed_at
        or row.graded_at
        or row.started_at
        or row.submitted_at
        or datetime.utcnow()
    )


def project_sysadmin_assignment_progress(
    db: Session,
    *,
    submission: SysadminSubmission,
    marketplace_lab_id: str,
) -> SysadminProgressProjectionResult | None:
    """
    Recompute assignment-scoped UserLabProgress from authoritative submissions.

    Only academic PASS/FAIL attempts count. Infrastructure ERROR/TIMED_OUT rows
    do not count as student attempts.

    Projection is monotonic:
      - any historical PASS keeps the module COMPLETED;
      - score is the best academic attempt;
      - attempts are recomputed from rows, never incremented blindly;
      - completed_at is the first successful completion;
      - rerunning the projection is idempotent.
    """
    assignment_id = submission.assignment_id

    # Personal/unassigned and historical pre-provenance submissions are not
    # projected into assignment-scoped academic progress.
    if assignment_id is None:
        return None

    module = (
        db.query(LabModule)
        .filter(LabModule.id == submission.lab_id)
        .first()
    )

    if module is None:
        raise SysadminProgressProjectionError(
            f"LabModule {submission.lab_id!r} does not exist. "
            "Synchronize the Sysadmin question-bank catalog first."
        )

    if module.lab_id != marketplace_lab_id:
        raise SysadminProgressProjectionError(
            f"LabModule {submission.lab_id!r} belongs to {module.lab_id!r}, "
            f"not {marketplace_lab_id!r}."
        )

    # Flush the just-graded submission so the aggregate query sees its
    # terminal status inside the same outer transaction.
    db.flush()

    attempts = (
        db.query(SysadminSubmission)
        .filter(
            SysadminSubmission.assignment_id == assignment_id,
            SysadminSubmission.student_id == submission.student_id,
            SysadminSubmission.lab_id == submission.lab_id,
            SysadminSubmission.status.in_(("PASS", "FAIL")),
        )
        .order_by(
            SysadminSubmission.submitted_at.asc(),
            SysadminSubmission.id.asc(),
        )
        .all()
    )

    if not attempts:
        return None

    successful = [
        row
        for row in attempts
        if str(row.status or "").upper() == "PASS"
        or row.passed is True
    ]

    completed = bool(successful)
    status = "COMPLETED" if completed else "STARTED"

    best_score = max(
        int(row.score or 0)
        for row in attempts
    )

    # LabModule.points is the gradebook scale. Question-bank score/max_score
    # currently matches it directly; clamp defensively against malformed data.
    module_points = max(int(module.points or 0), 0)
    if module_points > 0:
        best_score = min(best_score, module_points)

    first_attempt = attempts[0]
    latest_attempt = attempts[-1]

    started_at = (
        first_attempt.submitted_at
        or first_attempt.started_at
        or datetime.utcnow()
    )

    if completed:
        first_pass = successful[0]
        completed_at = _attempt_end(first_pass)
        timing_end = completed_at
    else:
        completed_at = None
        timing_end = _attempt_end(latest_attempt)

    time_taken_seconds = max(
        int((timing_end - started_at).total_seconds()),
        0,
    )

    progress = (
        db.query(UserLabProgress)
        .filter(
            UserLabProgress.assignment_id == assignment_id,
            UserLabProgress.user_id == submission.student_id,
            UserLabProgress.module_id == submission.lab_id,
        )
        .first()
    )

    created = progress is None

    if progress is None:
        progress = UserLabProgress(
            assignment_id=assignment_id,
            user_id=submission.student_id,
            lab_id=marketplace_lab_id,
            module_id=submission.lab_id,
        )
        db.add(progress)

    progress.assignment_id = assignment_id
    progress.user_id = submission.student_id
    progress.lab_id = marketplace_lab_id
    progress.module_id = submission.lab_id

    progress.status = status
    progress.score = best_score
    progress.attempts = len(attempts)
    progress.started_at = started_at
    progress.completed_at = completed_at
    progress.time_taken_seconds = time_taken_seconds
    progress.last_submission = (
        f"sysadmin_submission:{latest_attempt.id}"
    )
    progress.flag_correct = completed

    db.flush()

    return SysadminProgressProjectionResult(
        assignment_id=int(assignment_id),
        user_id=int(submission.student_id),
        module_id=str(submission.lab_id),
        status=status,
        score=best_score,
        attempts=len(attempts),
        completed=completed,
        created=created,
    )
