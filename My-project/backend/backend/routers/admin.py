# backend/routers/admin.py
"""
sys_admin endpoints for course and user management.

Endpoints:
  POST   /admin/courses                            create a course
  GET    /admin/courses                            list all courses
  POST   /admin/courses/{id}/admins/{user_id}      assign course_admin
  DELETE /admin/courses/{id}/admins/{user_id}      remove course_admin
  GET    /admin/courses/{id}/admins                list course_admins for a course
  POST   /admin/courses/{id}/guardrails/{user_id}  set guardrails for a course_admin
  POST   /admin/users/{id}/role                    set any user's role
"""

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.pg import get_pg
from backend.dependencies.authz import SysAdminOnly
from backend.schemas.auth import CurrentUser
from backend.schemas.admin import (
    CourseCreateRequest,
    GuardrailSetRequest,
    RoleSetRequest,
)
from backend.config import (
    ROLE_SYS_ADMIN, ROLE_COURSE_ADMIN, ROLE_PARTICIPANT, ALL_ROLES,
    GUARDRAIL_DEFAULT_MAX_CONCURRENT, GUARDRAIL_DEFAULT_MAX_DURATION_HOURS,
)

log = logging.getLogger("admin")
router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Courses ───────────────────────────────────────────────────────────────────

@router.post("/courses", status_code=201)
async def create_course(
    body: CourseCreateRequest,
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """Create a new course (content_items entry of type 'lab')."""
    content_id = uuid4()
    await pg.execute(
        text("""
            INSERT INTO content_items
                (id, type, title, description, difficulty, duration_minutes, metadata)
            VALUES
                (:id, 'lab', :title, :description, :difficulty, :duration_minutes, :metadata)
        """),
        {
            "id":               content_id,
            "title":            body.title,
            "description":      body.description,
            "difficulty":       body.difficulty,
            "duration_minutes": body.duration_minutes,
            "metadata":         body.metadata_json,
        },
    )
    await pg.commit()
    log.info("Course created: content_id=%s title=%s by=%s", content_id, body.title, admin.id)
    return {"content_id": str(content_id), "title": body.title}


@router.get("/courses")
async def list_courses(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """List all active courses."""
    result = await pg.execute(
        text("""
            SELECT id, title, description, difficulty, duration_minutes,
                   is_active, created_at
            FROM content_items
            WHERE type = 'lab'
            ORDER BY created_at DESC
        """)
    )
    rows = result.fetchall()
    return {
        "count": len(rows),
        "courses": [
            {
                "content_id":       r.id,
                "title":            r.title,
                "description":      r.description,
                "difficulty":       r.difficulty,
                "duration_minutes": r.duration_minutes,
                "is_active":        r.is_active,
                "created_at":       r.created_at,
            }
            for r in rows
        ],
    }


# ── Course admin assignments ──────────────────────────────────────────────────

@router.post("/courses/{content_id}/admins/{user_id}", status_code=201)
async def assign_course_admin(
    content_id: str = Path(...),
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """Assign a course_admin to a course. Promotes user to course_admin if needed."""
    # Verify course exists
    course = await pg.execute(
        text("SELECT id FROM content_items WHERE id = :id AND type = 'lab'"),
        {"id": content_id},
    )
    if not course.fetchone():
        raise HTTPException(status_code=404, detail="Course not found")

    # Verify user exists and is active
    user = await pg.execute(
        text("SELECT id, role, is_active FROM users WHERE id = :id"),
        {"id": user_id},
    )
    user_row = user.fetchone()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    if not user_row.is_active:
        raise HTTPException(status_code=400, detail="User is inactive")
    if user_row.role == ROLE_SYS_ADMIN:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign sys_admin as a course_admin.",
        )

    # Promote to course_admin if they are currently a participant
    if user_row.role == ROLE_PARTICIPANT:
        await pg.execute(
            text("UPDATE users SET role = :role, updated_at = now() WHERE id = :id"),
            {"role": ROLE_COURSE_ADMIN, "id": user_id},
        )
        log.info("User promoted to course_admin: user_id=%s by=%s", user_id, admin.id)

    # Insert assignment
    await pg.execute(
        text("""
            INSERT INTO course_admin_assignments (user_id, content_id, assigned_by)
            VALUES (:user_id, :content_id, :assigned_by)
            ON CONFLICT (user_id, content_id) DO NOTHING
        """),
        {"user_id": user_id, "content_id": content_id, "assigned_by": str(admin.id)},
    )
    await pg.commit()

    log.info(
        "Course admin assigned: content_id=%s user_id=%s by=%s",
        content_id, user_id, admin.id,
    )
    return {
        "content_id": content_id,
        "user_id":    user_id,
        "message":    "course_admin assigned successfully",
    }


@router.delete("/courses/{content_id}/admins/{user_id}", status_code=200)
async def remove_course_admin(
    content_id: str = Path(...),
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """
    Remove a course_admin assignment.
    If the user has no remaining assignments, demotes them back to participant.
    """
    result = await pg.execute(
        text("""
            DELETE FROM course_admin_assignments
            WHERE user_id = :user_id AND content_id = :content_id
            RETURNING user_id
        """),
        {"user_id": user_id, "content_id": content_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Assignment not found")

    # Check if they still have other course assignments
    remaining = await pg.execute(
        text("""
            SELECT 1 FROM course_admin_assignments
            WHERE user_id = :user_id LIMIT 1
        """),
        {"user_id": user_id},
    )
    if not remaining.fetchone():
        # No remaining assignments — demote back to participant
        await pg.execute(
            text("UPDATE users SET role = :role, updated_at = now() WHERE id = :id"),
            {"role": ROLE_PARTICIPANT, "id": user_id},
        )
        log.info(
            "User demoted to participant (no remaining assignments): user_id=%s by=%s",
            user_id, admin.id,
        )

    await pg.commit()
    log.info(
        "Course admin removed: content_id=%s user_id=%s by=%s",
        content_id, user_id, admin.id,
    )
    return {
        "content_id": content_id,
        "user_id":    user_id,
        "message":    "course_admin removed",
    }


@router.get("/courses/{content_id}/admins")
async def list_course_admins(
    content_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """List all course_admins assigned to a course."""
    result = await pg.execute(
        text("""
            SELECT caa.user_id, u.email, caa.assigned_by, caa.assigned_at,
                   g.max_concurrent_deployments, g.max_duration_hours
            FROM course_admin_assignments caa
            JOIN users u ON caa.user_id = u.id
            LEFT JOIN course_guardrails g
                ON g.course_admin_id = caa.user_id AND g.content_id = caa.content_id
            WHERE caa.content_id = :content_id
            ORDER BY caa.assigned_at ASC
        """),
        {"content_id": content_id},
    )
    rows = result.fetchall()
    return {
        "content_id": content_id,
        "count":      len(rows),
        "admins": [
            {
                "user_id":                    r.user_id,
                "email":                      r.email,
                "assigned_by":                r.assigned_by,
                "assigned_at":                r.assigned_at,
                "max_concurrent_deployments": r.max_concurrent_deployments
                                              or GUARDRAIL_DEFAULT_MAX_CONCURRENT,
                "max_duration_hours":         r.max_duration_hours
                                              or GUARDRAIL_DEFAULT_MAX_DURATION_HOURS,
            }
            for r in rows
        ],
    }


# ── Guardrails ────────────────────────────────────────────────────────────────

@router.post("/courses/{content_id}/guardrails/{user_id}", status_code=200)
async def set_guardrails(
    body: GuardrailSetRequest,
    content_id: str = Path(...),
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """Set or update guardrails for a course_admin on a specific course."""
    # Verify assignment exists
    assignment = await pg.execute(
        text("""
            SELECT 1 FROM course_admin_assignments
            WHERE user_id = :user_id AND content_id = :content_id
        """),
        {"user_id": user_id, "content_id": content_id},
    )
    if not assignment.fetchone():
        raise HTTPException(
            status_code=404,
            detail="This user is not assigned as course_admin for this course.",
        )

    await pg.execute(
        text("""
            INSERT INTO course_guardrails
                (course_admin_id, content_id, max_concurrent_deployments,
                 max_duration_hours, set_by)
            VALUES
                (:course_admin_id, :content_id, :max_concurrent, :max_duration, :set_by)
            ON CONFLICT (course_admin_id, content_id) DO UPDATE SET
                max_concurrent_deployments = EXCLUDED.max_concurrent_deployments,
                max_duration_hours         = EXCLUDED.max_duration_hours,
                set_by                     = EXCLUDED.set_by,
                updated_at                 = now()
        """),
        {
            "course_admin_id": user_id,
            "content_id":      content_id,
            "max_concurrent":  body.max_concurrent_deployments,
            "max_duration":    body.max_duration_hours,
            "set_by":          str(admin.id),
        },
    )
    await pg.commit()

    log.info(
        "Guardrails set: content_id=%s course_admin=%s max_concurrent=%s max_duration=%s by=%s",
        content_id, user_id, body.max_concurrent_deployments,
        body.max_duration_hours, admin.id,
    )
    return {
        "content_id":                content_id,
        "course_admin_id":           user_id,
        "max_concurrent_deployments": body.max_concurrent_deployments,
        "max_duration_hours":        body.max_duration_hours,
    }


# ── User role management ──────────────────────────────────────────────────────

@router.post("/users/{user_id}/role", status_code=200)
async def set_user_role(
    body: RoleSetRequest,
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """
    Set any user's role directly.
    Useful for testing and for manual role corrections.
    sys_admin cannot demote themselves.
    """
    if str(admin.id) == user_id and body.role != ROLE_SYS_ADMIN:
        raise HTTPException(
            status_code=400,
            detail="sys_admin cannot demote themselves.",
        )

    result = await pg.execute(
        text("""
            UPDATE users SET role = :role, updated_at = now()
            WHERE id = :id
            RETURNING id, email, role
        """),
        {"role": body.role, "id": user_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    await pg.commit()
    log.info(
        "Role updated: user_id=%s new_role=%s by=%s",
        user_id, body.role, admin.id,
    )
    return {"user_id": row.id, "email": row.email, "role": row.role}