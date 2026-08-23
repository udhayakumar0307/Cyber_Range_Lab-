"""
Canonical resolver for academic assignment context.

Every lab/progress/scoring endpoint should use this service rather than
attempting to infer Assignment ownership independently.

Rules
-----
1. An explicit assignment_id is never trusted blindly.
2. The assignment must belong to the requested lab.
3. The student must either:
   - be directly assigned through Assignment.student_id, or
   - currently belong to Assignment.group_id.
4. Soft-deleted assignments are ignored.
5. Without an explicit assignment_id:
   - exactly one active applicable assignment -> use it
   - zero active assignments -> personal/unassigned context (None)
   - multiple active assignments -> reject as ambiguous
"""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.user import User
from app.core.assignment_time import utc_now_naive


class AssignmentContextService:
    """Resolve and validate the academic Assignment for a lab action."""

    @staticmethod
    def _student_has_access(
        assignment: Assignment,
        user: User,
    ) -> bool:
        """
        Return True when the assignment belongs directly to this student
        or to the student's current group.
        """

        if assignment.student_id == user.id:
            return True

        if (
            assignment.group_id is not None
            and user.group_id is not None
            and assignment.group_id == user.group_id
        ):
            return True

        return False

    @staticmethod
    def _is_active(
        assignment: Assignment,
    ) -> bool:
        """
        Determine whether an assignment is currently executable.

        This intentionally follows the platform's existing assignment
        datetime conventions. Full timezone normalization belongs to
        Point 10.
        """

        if assignment.deleted_at is not None:
            return False

        status_value = (assignment.status or "").strip().lower()

        if status_value in {
            "completed",
            "ended",
            "expired",
            "archived",
        }:
            return False

        now = utc_now_naive()

        if assignment.start_datetime and now < assignment.start_datetime:
            return False

        if assignment.end_datetime and now > assignment.end_datetime:
            return False

        return True

    @classmethod
    def resolve(
        cls,
        db: Session,
        user: User,
        lab_id: str,
        requested_assignment_id: Optional[int] = None,
        *,
        require_active: bool = True,
        allow_unassigned: bool = True,
    ) -> Optional[Assignment]:
        """
        Resolve the Assignment that should own progress/scoring.

        Parameters
        ----------
        db:
            Current SQLAlchemy session.

        user:
            Authenticated student.

        lab_id:
            Canonical lab ID.

        requested_assignment_id:
            Assignment explicitly supplied by the client. The value is
            validated; ownership is never assumed.

        require_active:
            If True, scheduled/expired/completed assignments cannot be
            used to submit progress.

        allow_unassigned:
            If True, return None when this is a personal/non-academic
            lab session.

        Returns
        -------
        Optional[Assignment]
            Canonical assignment, or None for personal/unassigned play.
        """

        # --------------------------------------------------------------
        # Explicit assignment context
        # --------------------------------------------------------------

        if requested_assignment_id is not None:
            assignment = (
                db.query(Assignment)
                .filter(
                    Assignment.id == requested_assignment_id,
                    Assignment.deleted_at.is_(None),
                )
                .first()
            )

            if not assignment:
                raise HTTPException(
                    status_code=404,
                    detail="Assignment not found.",
                )

            if assignment.lab_id != lab_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Assignment does not belong to the requested lab."
                    ),
                )

            if not cls._student_has_access(assignment, user):
                raise HTTPException(
                    status_code=403,
                    detail="You do not have access to this assignment.",
                )

            if require_active and not cls._is_active(assignment):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "This assignment is not currently active."
                    ),
                )

            return assignment

        # --------------------------------------------------------------
        # Implicit resolution
        # --------------------------------------------------------------

        query = (
            db.query(Assignment)
            .filter(
                Assignment.lab_id == lab_id,
                Assignment.deleted_at.is_(None),
            )
        )

        candidates = query.all()

        applicable = [
            assignment
            for assignment in candidates
            if cls._student_has_access(assignment, user)
        ]

        if require_active:
            applicable = [
                assignment
                for assignment in applicable
                if cls._is_active(assignment)
            ]

        # Personal / marketplace / non-academic lab.
        if not applicable:
            if allow_unassigned:
                return None

            raise HTTPException(
                status_code=404,
                detail="No applicable assignment was found.",
            )

        # Safe automatic resolution.
        if len(applicable) == 1:
            return applicable[0]

        # Never silently attribute work when multiple academic
        # assignments could own the same lab attempt.
        raise HTTPException(
            status_code=409,
            detail=(
                "Multiple active assignments exist for this lab. "
                "An explicit assignment_id is required."
            ),
        )


def resolve_assignment(
    db: Session,
    user: User,
    lab_id: str,
    requested_assignment_id: Optional[int] = None,
    *,
    require_active: bool = True,
    allow_unassigned: bool = True,
) -> Optional[Assignment]:
    """
    Convenience wrapper used by API endpoints.
    """

    return AssignmentContextService.resolve(
        db=db,
        user=user,
        lab_id=lab_id,
        requested_assignment_id=requested_assignment_id,
        require_active=require_active,
        allow_unassigned=allow_unassigned,
    )