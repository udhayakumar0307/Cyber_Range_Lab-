from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.user import User
from app.services.assignment_context_service import AssignmentContextService

from .config import SysadminGradingSettings
from .workspace import SysadminWorkspaceService


def resolve_current_sysadmin_assignment_id(
    db: Session,
    *,
    user: User,
    marketplace_lab_id: str,
) -> int | None:
    """
    Resolve the active academic Sysadmin assignment.

    A user with no academic assignment may still use an explicitly supported
    personal/unassigned workspace.

    However, an applicable scheduled/expired/completed assignment must never
    silently fall through into personal mode. That fallback was the lifecycle
    bug that allowed a killed assignment to open a new workspace.
    """
    assignment = AssignmentContextService.resolve(
        db,
        user,
        marketplace_lab_id,
        require_active=True,
        allow_unassigned=True,
    )

    if assignment is not None:
        return int(assignment.id)

    scopes = [
        Assignment.student_id == int(user.id),
    ]

    group_id = getattr(user, "group_id", None)
    if group_id is not None:
        scopes.append(
            Assignment.group_id == int(group_id)
        )

    applicable_but_inactive = (
        db.query(Assignment)
        .filter(
            Assignment.lab_id == marketplace_lab_id,
            Assignment.deleted_at.is_(None),
            or_(*scopes),
        )
        .order_by(
            Assignment.created_at.desc(),
            Assignment.id.desc(),
        )
        .first()
    )

    if applicable_but_inactive is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Linux System Administration is not currently active "
                "for this assignment."
            ),
        )

    return None


def assert_workspace_assignment_context(
    db: Session,
    *,
    user: User,
    marketplace_lab_id: str,
    workspace_assignment_id: Any,
) -> int | None:
    """
    Revalidate workspace assignment ownership at every security boundary.

    This blocks:
      - stale tokens after an assignment is killed;
      - stale sessions from a previous assignment;
      - unassigned workspaces while an academic assignment governs the user.
    """
    active_assignment_id = resolve_current_sysadmin_assignment_id(
        db,
        user=user,
        marketplace_lab_id=marketplace_lab_id,
    )

    if workspace_assignment_id is None:
        if active_assignment_id is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This workspace is not bound to the currently active "
                    "Linux System Administration assignment."
                ),
            )
        return None

    try:
        workspace_assignment_id = int(workspace_assignment_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workspace assignment context is invalid.",
        ) from exc

    if active_assignment_id != workspace_assignment_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This workspace belongs to an assignment that is no longer "
                "active."
            ),
        )

    return active_assignment_id


def stop_sysadmin_assignment_workspaces(
    db: Session,
    *,
    assignment: Assignment,
    reason: str,
    settings: SysadminGradingSettings | None = None,
    workspace_service: SysadminWorkspaceService | None = None,
) -> int:
    """
    Stop stored Fargate workspaces for every user owned by this assignment.

    Non-Sysadmin assignments are ignored.
    """
    settings = settings or SysadminGradingSettings.from_env()

    if assignment.lab_id != settings.marketplace_lab_id:
        return 0

    user_ids: list[int] = []

    if assignment.student_id is not None:
        user_ids.append(int(assignment.student_id))

    elif assignment.group_id is not None:
        user_ids.extend(
            int(user_id)
            for (user_id,) in (
                db.query(User.id)
                .filter(User.group_id == assignment.group_id)
                .all()
            )
        )

    service = workspace_service or SysadminWorkspaceService(settings)

    stopped = 0

    for user_id in sorted(set(user_ids)):
        if service.stop(
            user_id=user_id,
            reason=reason,
        ):
            stopped += 1

    return stopped
