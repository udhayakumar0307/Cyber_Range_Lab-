# backend/routers/course.py
"""
course_admin scoped endpoints.

Endpoints:
  GET    /course/my-courses                        list assigned courses
  POST   /course/{content_id}/deploy               deploy with guardrail enforcement
  POST   /course/{content_id}/participants/{uid}   enroll participant
  DELETE /course/{content_id}/participants/{uid}   unenroll participant
  GET    /course/{content_id}/participants         list enrolled participants
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.pg import get_pg
from backend.dependencies.authz import CourseAdminOrAbove
from backend.schemas.auth import CurrentUser
from backend.schemas.labs import LabDeployRequest
from backend.config import (
    get_settings,
    GUARDRAIL_DEFAULT_MAX_CONCURRENT,
    GUARDRAIL_DEFAULT_MAX_DURATION_HOURS,
)
from backend.limiter import limiter

log = logging.getLogger("course")
router = APIRouter(prefix="/course", tags=["Course"])
settings = get_settings()


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _verify_course_assignment(
    pg: AsyncSession,
    course_admin_id: str,
    content_id: str,
) -> None:
    """Raises 403 if the course_admin is not assigned to this course."""
    result = await pg.execute(
        text("""
            SELECT 1 FROM course_admin_assignments
            WHERE user_id = :user_id AND content_id = :content_id
        """),
        {"user_id": course_admin_id, "content_id": content_id},
    )
    if not result.fetchone():
        raise HTTPException(
            status_code=403,
            detail="You are not assigned as course_admin for this course.",
        )


async def _get_guardrails(
    pg: AsyncSession,
    course_admin_id: str,
    content_id: str,
) -> tuple[int, int]:
    """
    Returns (max_concurrent_deployments, max_duration_hours).
    Falls back to config defaults if no guardrail row exists.
    """
    result = await pg.execute(
        text("""
            SELECT max_concurrent_deployments, max_duration_hours
            FROM course_guardrails
            WHERE course_admin_id = :course_admin_id
              AND content_id = :content_id
        """),
        {"course_admin_id": course_admin_id, "content_id": content_id},
    )
    row = result.fetchone()
    if row:
        return row.max_concurrent_deployments, row.max_duration_hours
    return GUARDRAIL_DEFAULT_MAX_CONCURRENT, GUARDRAIL_DEFAULT_MAX_DURATION_HOURS


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/my-courses")
async def my_courses(
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(CourseAdminOrAbove),
):
    """List all courses assigned to the current course_admin."""
    result = await pg.execute(
        text("""
            SELECT ci.id, ci.title, ci.description, ci.difficulty,
                   ci.duration_minutes, ci.is_active, caa.assigned_at,
                   g.max_concurrent_deployments, g.max_duration_hours
            FROM course_admin_assignments caa
            JOIN content_items ci ON caa.content_id = ci.id
            LEFT JOIN course_guardrails g
                ON g.course_admin_id = caa.user_id AND g.content_id = caa.content_id
            WHERE caa.user_id = :user_id
            ORDER BY caa.assigned_at DESC
        """),
        {"user_id": str(current_user.id)},
    )
    rows = result.fetchall()
    return {
        "count": len(rows),
        "courses": [
            {
                "content_id":                 r.id,
                "title":                      r.title,
                "description":                r.description,
                "difficulty":                 r.difficulty,
                "duration_minutes":           r.duration_minutes,
                "is_active":                  r.is_active,
                "assigned_at":                r.assigned_at,
                "max_concurrent_deployments": r.max_concurrent_deployments
                                              or GUARDRAIL_DEFAULT_MAX_CONCURRENT,
                "max_duration_hours":         r.max_duration_hours
                                              or GUARDRAIL_DEFAULT_MAX_DURATION_HOURS,
            }
            for r in rows
        ],
    }


@router.post("/{content_id}/deploy")
@limiter.limit(settings.RATE_LIMIT_DEPLOY)
async def deploy_course_lab(
    body: LabDeployRequest,
    request: Request,
    response: Response,
    content_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(CourseAdminOrAbove),
):
    """
    Deploy a lab for a course.
    Enforces guardrails: max concurrent deployments and max duration.
    Automatically adds all enrolled participants to deployment_members.
    """
    await _verify_course_assignment(pg, str(current_user.id), content_id)

    # Verify course exists and is active
    course = await pg.execute(
        text("""
            SELECT id, metadata FROM content_items
            WHERE id = :id AND type = 'lab' AND is_active = true
        """),
        {"id": content_id},
    )
    course_row = course.fetchone()
    if not course_row:
        raise HTTPException(status_code=404, detail="Course not found")

    lab_type = (course_row.metadata or {}).get("lab_type")
    if not lab_type:
        raise HTTPException(
            status_code=500,
            detail="Course is misconfigured: missing lab_type in metadata.",
        )

    # Normalise expires_at timezone
    if body.expires_at.tzinfo is None:
        expires_at = body.expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = body.expires_at

    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="expires_at must be in the future.")

    # ── Guardrail checks ──────────────────────────────────────────────────────
    max_concurrent, max_duration_hours = await _get_guardrails(
        pg, str(current_user.id), content_id
    )

    # Check duration
    max_expires_at = datetime.now(timezone.utc) + timedelta(hours=max_duration_hours)
    if expires_at > max_expires_at:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Lab duration cannot exceed {max_duration_hours} hours for this course. "
                f"Please set expires_at to at most {max_expires_at.isoformat()}."
            ),
        )

    # Check concurrent deployments
    active_count_result = await pg.execute(
        text("""
            SELECT COUNT(*) FROM lab_deployments
            WHERE user_id = :user_id
              AND content_id = :content_id
              AND status IN ('queued', 'provisioning', 'running')
        """),
        {"user_id": str(current_user.id), "content_id": content_id},
    )
    active_count = active_count_result.scalar()
    if active_count >= max_concurrent:
        raise HTTPException(
            status_code=400,
            detail=(
                f"You have reached the maximum of {max_concurrent} concurrent "
                f"deployments for this course. Please wait for an existing "
                f"deployment to expire before creating a new one."
            ),
        )

    # ── Insert deployment ─────────────────────────────────────────────────────
    deployment_id = uuid4()
    workspace = f"ws-{deployment_id}"

    await pg.execute(
        text("""
            INSERT INTO lab_deployments (
                id, user_id, content_id, lab_type,
                status, terraform_workspace, expires_at
            ) VALUES (
                :id, :user_id, :content_id, :lab_type,
                'queued', :workspace, :expires_at
            )
        """),
        {
            "id":         deployment_id,
            "user_id":    str(current_user.id),
            "content_id": content_id,
            "lab_type":   lab_type,
            "workspace":  workspace,
            "expires_at": expires_at,
        },
    )

    # ── Auto-add enrolled participants to deployment_members ──────────────────
    participants = await pg.execute(
        text("""
            SELECT user_id FROM course_participants
            WHERE content_id = :content_id
        """),
        {"content_id": content_id},
    )
    participant_rows = participants.fetchall()

    for p in participant_rows:
        await pg.execute(
            text("""
                INSERT INTO deployment_members (deployment_id, user_id, added_by)
                VALUES (:deployment_id, :user_id, :added_by)
                ON CONFLICT (deployment_id, user_id) DO NOTHING
            """),
            {
                "deployment_id": str(deployment_id),
                "user_id":       str(p.user_id),
                "added_by":      str(current_user.id),
            },
        )

    await pg.commit()

    log.info(
        "Course lab queued: deployment_id=%s course_admin=%s content_id=%s "
        "lab_type=%s expires_at=%s participants_added=%d",
        deployment_id, current_user.id, content_id,
        lab_type, expires_at, len(participant_rows),
    )
    return {
        "deployment_id":      str(deployment_id),
        "status":             "queued",
        "expires_at":         expires_at,
        "participants_added": len(participant_rows),
    }


@router.post("/{content_id}/participants/{user_id}", status_code=201)
async def enroll_participant(
    content_id: str = Path(...),
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Enroll a participant in a course."""
    await _verify_course_assignment(pg, str(current_user.id), content_id)

    # Verify user exists and is active
    user = await pg.execute(
        text("SELECT id, email, is_active, role FROM users WHERE id = :id"),
        {"id": user_id},
    )
    user_row = user.fetchone()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    if not user_row.is_active:
        raise HTTPException(status_code=400, detail="User is inactive")

    await pg.execute(
        text("""
            INSERT INTO course_participants (user_id, content_id, enrolled_by)
            VALUES (:user_id, :content_id, :enrolled_by)
            ON CONFLICT (user_id, content_id) DO NOTHING
        """),
        {
            "user_id":     user_id,
            "content_id":  content_id,
            "enrolled_by": str(current_user.id),
        },
    )
    await pg.commit()

    log.info(
        "Participant enrolled: content_id=%s user_id=%s by=%s",
        content_id, user_id, current_user.id,
    )
    return {
        "content_id": content_id,
        "user_id":    user_id,
        "email":      user_row.email,
        "message":    "Participant enrolled successfully",
    }


@router.delete("/{content_id}/participants/{user_id}", status_code=200)
async def unenroll_participant(
    content_id: str = Path(...),
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Unenroll a participant from a course."""
    await _verify_course_assignment(pg, str(current_user.id), content_id)

    result = await pg.execute(
        text("""
            DELETE FROM course_participants
            WHERE user_id = :user_id AND content_id = :content_id
            RETURNING user_id
        """),
        {"user_id": user_id, "content_id": content_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Participant not enrolled in this course")

    await pg.commit()
    log.info(
        "Participant unenrolled: content_id=%s user_id=%s by=%s",
        content_id, user_id, current_user.id,
    )
    return {
        "content_id": content_id,
        "user_id":    user_id,
        "message":    "Participant unenrolled",
    }


@router.get("/{content_id}/participants")
async def list_participants(
    content_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(CourseAdminOrAbove),
):
    """List all participants enrolled in a course."""
    await _verify_course_assignment(pg, str(current_user.id), content_id)

    result = await pg.execute(
        text("""
            SELECT cp.user_id, u.email, cp.enrolled_by, cp.enrolled_at
            FROM course_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.content_id = :content_id
            ORDER BY cp.enrolled_at ASC
        """),
        {"content_id": content_id},
    )
    rows = result.fetchall()
    return {
        "content_id": content_id,
        "count":      len(rows),
        "participants": [
            {
                "user_id":     r.user_id,
                "email":       r.email,
                "enrolled_by": r.enrolled_by,
                "enrolled_at": r.enrolled_at,
            }
            for r in rows
        ],
    }


@router.get("/{content_id}/deployments")
async def list_course_managed_deployments(
    content_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(CourseAdminOrAbove),
):
    """List all managed lab runs for a course, with attached members."""
    # 1. Scope check (sys_admin bypasses)
    if current_user.role != "sys_admin":
        await _verify_course_assignment(pg, str(current_user.id), content_id)

    # 2. Fetch deployments for this course/content_id
    result = await pg.execute(
        text("""
            SELECT id AS deployment_id, status, lab_type, created_at, expires_at, error_message
            FROM lab_deployments
            WHERE content_id = :content_id
            ORDER BY created_at DESC
        """),
        {"content_id": content_id}
    )
    deployment_rows = result.fetchall()

    deployments = []
    for row in deployment_rows:
        members_res = await pg.execute(
            text("""
                SELECT dm.user_id, u.email
                FROM deployment_members dm
                JOIN users u ON dm.user_id = u.id
                WHERE dm.deployment_id = :deployment_id
            """),
            {"deployment_id": row.deployment_id}
        )
        member_rows = members_res.fetchall()
        deployments.append({
            "deployment_id": str(row.deployment_id),
            "status": row.status,
            "lab_type": row.lab_type,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None,
            "error_message": row.error_message,
            "members": [
                {
                    "user_id": str(m.user_id),
                    "email": m.email
                }
                for m in member_rows
            ]
        })

    return {
        "count": len(deployments),
        "deployments": deployments
    }