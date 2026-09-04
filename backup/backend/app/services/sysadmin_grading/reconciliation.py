from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.lab_module import LabModule
from app.models.sysadmin_submission import SysadminSubmission
from app.models.user import User

from .progress_projection import (
    SysadminProgressProjectionResult,
    project_sysadmin_assignment_progress,
)


class SysadminReconciliationError(RuntimeError):
    """Raised when historical Sysadmin assignment evidence is ambiguous."""


@dataclass(frozen=True)
class SysadminReconciliationResult:
    assignment_id: int
    student_id: int
    candidate_submission_ids: tuple[int, ...]
    newly_scoped_submission_ids: tuple[int, ...]
    already_scoped_submission_ids: tuple[int, ...]
    projected_modules: tuple[SysadminProgressProjectionResult, ...]


def _assert_student_belongs_to_assignment(
    *,
    assignment: Assignment,
    student: User,
) -> None:
    if assignment.student_id is not None:
        if int(assignment.student_id) != int(student.id):
            raise SysadminReconciliationError(
                f"Student {student.id} does not own assignment "
                f"{assignment.id}."
            )
        return

    if assignment.group_id is None:
        raise SysadminReconciliationError(
            f"Assignment {assignment.id} has neither student_id nor group_id."
        )

    if student.group_id is None or int(student.group_id) != int(assignment.group_id):
        raise SysadminReconciliationError(
            f"Student {student.id} is not a member of assignment "
            f"{assignment.id}'s group."
        )


def reconcile_sysadmin_assignment_progress(
    db: Session,
    *,
    assignment_id: int,
    student_id: int,
    marketplace_lab_id: str,
) -> SysadminReconciliationResult:
    """
    Reconcile historical Sysadmin PASS/FAIL submissions into one assignment.

    Selection is intentionally conservative:
      - explicit assignment ID;
      - explicit student ID;
      - student must belong to the assignment;
      - assignment must target the Sysadmin marketplace lab;
      - submission timestamp must fall inside the assignment window;
      - submission lab ID must exist as a LabModule for the marketplace lab;
      - only academic PASS/FAIL attempts are eligible;
      - rows already bound to another assignment are never reassigned.

    The caller owns commit/rollback. This makes dry-run reconciliation trivial:
    execute this function, inspect the result, then rollback.
    """
    if assignment_id <= 0 or student_id <= 0:
        raise SysadminReconciliationError(
            "assignment_id and student_id must be positive."
        )

    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.id == assignment_id,
            Assignment.deleted_at.is_(None),
        )
        .first()
    )
    if assignment is None:
        raise SysadminReconciliationError(
            f"Assignment {assignment_id} does not exist."
        )

    if assignment.lab_id != marketplace_lab_id:
        raise SysadminReconciliationError(
            f"Assignment {assignment_id} targets {assignment.lab_id!r}, "
            f"not {marketplace_lab_id!r}."
        )

    student = (
        db.query(User)
        .filter(User.id == student_id)
        .first()
    )
    if student is None:
        raise SysadminReconciliationError(
            f"Student {student_id} does not exist."
        )

    _assert_student_belongs_to_assignment(
        assignment=assignment,
        student=student,
    )

    module_ids = tuple(
        module_id
        for (module_id,) in (
            db.query(LabModule.id)
            .filter(LabModule.lab_id == marketplace_lab_id)
            .order_by(LabModule.display_order.asc(), LabModule.id.asc())
            .all()
        )
    )

    if not module_ids:
        raise SysadminReconciliationError(
            f"No LabModule catalog exists for {marketplace_lab_id!r}."
        )

    candidates = (
        db.query(SysadminSubmission)
        .filter(
            SysadminSubmission.student_id == student_id,
            SysadminSubmission.lab_id.in_(module_ids),
            SysadminSubmission.status.in_(("PASS", "FAIL")),
            SysadminSubmission.submitted_at >= assignment.start_datetime,
            SysadminSubmission.submitted_at <= assignment.end_datetime,
        )
        .order_by(
            SysadminSubmission.submitted_at.asc(),
            SysadminSubmission.id.asc(),
        )
        .all()
    )

    conflicting = [
        row
        for row in candidates
        if row.assignment_id is not None
        and int(row.assignment_id) != int(assignment.id)
    ]

    if conflicting:
        detail = ", ".join(
            f"{row.id}->{row.assignment_id}"
            for row in conflicting
        )
        raise SysadminReconciliationError(
            "Refusing to reassign submissions already owned by another "
            f"assignment: {detail}"
        )

    newly_scoped = [
        row
        for row in candidates
        if row.assignment_id is None
    ]

    already_scoped = [
        row
        for row in candidates
        if row.assignment_id == assignment.id
    ]

    for row in newly_scoped:
        row.assignment_id = assignment.id

    # Ensure the aggregate projector can see all newly assigned rows.
    db.flush()

    projected: list[SysadminProgressProjectionResult] = []

    # Recompute once per module using the latest academic attempt. The
    # projector itself aggregates all assignment-scoped attempts.
    latest_by_module: dict[str, SysadminSubmission] = {}
    for row in candidates:
        latest_by_module[row.lab_id] = row

    for module_id in module_ids:
        row = latest_by_module.get(module_id)
        if row is None:
            continue

        result = project_sysadmin_assignment_progress(
            db,
            submission=row,
            marketplace_lab_id=marketplace_lab_id,
        )
        if result is not None:
            projected.append(result)

    return SysadminReconciliationResult(
        assignment_id=int(assignment.id),
        student_id=int(student.id),
        candidate_submission_ids=tuple(
            int(row.id)
            for row in candidates
        ),
        newly_scoped_submission_ids=tuple(
            int(row.id)
            for row in newly_scoped
        ),
        already_scoped_submission_ids=tuple(
            int(row.id)
            for row in already_scoped
        ),
        projected_modules=tuple(projected),
    )
