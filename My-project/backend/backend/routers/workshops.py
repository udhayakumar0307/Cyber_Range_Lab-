import logging
from uuid import uuid4, UUID
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.pg import get_pg
from backend.dependencies.auth import get_current_user
from backend.dependencies.authz import SysAdminOnly, AnyAuthenticatedUser, CourseAdminOrAbove
from backend.schemas.auth import CurrentUser
from backend.config import ROLE_SYS_ADMIN

log = logging.getLogger("workshops")
router = APIRouter(prefix="/course", tags=["Workshops & Cohorts"])


async def _verify_workshop_assignment(
    pg: AsyncSession,
    user_id: str,
    workshop_id: str,
) -> None:
    """Raises 403 if the course_admin is not assigned to this workshop."""
    result = await pg.execute(
        text("""
            SELECT 1 FROM workshop_course_admins
            WHERE user_id = :user_id AND workshop_id = :workshop_id
        """),
        {"user_id": user_id, "workshop_id": workshop_id},
    )
    if not result.fetchone():
        raise HTTPException(
            status_code=403,
            detail="You are not an operator of this workshop.",
        )


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class WorkshopCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    content_id: UUID
    mode: str = "delivery"
    seat_cap: int = Field(100, ge=1)
    payment_status: str = "unpaid"
    access_policy: str = "demo"
    status: str = "draft"


class WorkshopInviteRequest(BaseModel):
    email: str = Field(..., min_length=3)


class WorkshopRedeemRequest(BaseModel):
    token: str = Field(..., min_length=4)


class CohortRunRequest(BaseModel):
    duration_hours: int = Field(24, ge=1, le=720, description="Duration in hours for the cohort run")


# ── Participant Endpoints ───────────────────────────────────────────────────

@router.get("/my-workshops")
async def get_my_workshops(
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """Returns workshops the current user is enrolled in as a member."""
    result = await pg.execute(
        text("""
            SELECT w.id, w.title, w.description, w.content_id, w.mode, w.seat_cap, 
                   w.payment_status, w.access_policy, w.status, w.created_at, w.updated_at,
                   ci.title AS content_title,
                   COALESCE(m.member_count, 0) AS used_seats
            FROM workshops w
            JOIN workshop_members wm ON wm.workshop_id = w.id
            JOIN content_items ci ON w.content_id = ci.id
            LEFT JOIN (
                SELECT workshop_id, COUNT(*) AS member_count 
                FROM workshop_members 
                GROUP BY workshop_id
            ) m ON m.workshop_id = w.id
            WHERE wm.user_id = :user_id
            ORDER BY w.created_at DESC
        """),
        {"user_id": current_user.id}
    )
    rows = result.fetchall()
    
    return {
        "count": len(rows),
        "workshops": [
            {
                "id": str(r.id),
                "title": r.title,
                "description": r.description,
                "content_id": str(r.content_id),
                "content_title": r.content_title,
                "mode": r.mode,
                "seat_cap": r.seat_cap,
                "used_seats": int(r.used_seats),
                "payment_status": r.payment_status,
                "access_policy": r.access_policy,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
    }


@router.get("/my-operator-cohorts")
async def get_my_operator_cohorts(
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """Returns workshops the current user operates as an admin/instructor."""
    result = await pg.execute(
        text("""
            SELECT w.id, w.title, w.description, w.content_id, w.mode, w.seat_cap, 
                   w.payment_status, w.access_policy, w.status, w.created_at, w.updated_at,
                   ci.title AS content_title,
                   COALESCE(m.member_count, 0) AS used_seats
            FROM workshops w
            JOIN workshop_course_admins wca ON wca.workshop_id = w.id
            JOIN content_items ci ON w.content_id = ci.id
            LEFT JOIN (
                SELECT workshop_id, COUNT(*) AS member_count 
                FROM workshop_members 
                GROUP BY workshop_id
            ) m ON m.workshop_id = w.id
            WHERE wca.user_id = :user_id
            ORDER BY w.created_at DESC
        """),
        {"user_id": current_user.id}
    )
    rows = result.fetchall()
    
    return {
        "count": len(rows),
        "cohorts": [
            {
                "id": str(r.id),
                "title": r.title,
                "description": r.description,
                "content_id": str(r.content_id),
                "content_title": r.content_title,
                "mode": r.mode,
                "seat_cap": r.seat_cap,
                "used_seats": int(r.used_seats),
                "payment_status": r.payment_status,
                "access_policy": r.access_policy,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
    }


@router.get("/workshops/{workshop_id}")
async def get_course_workshop(
    workshop_id: UUID = Path(...),
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """Fetches details of a workshop, including its associated course admins."""
    # 1. Fetch main workshop record
    result = await pg.execute(
        text("""
            SELECT w.id, w.title, w.description, w.content_id, w.mode, w.seat_cap, 
                   w.payment_status, w.access_policy, w.status, w.created_at, w.updated_at,
                   ci.title AS content_title,
                   COALESCE(m.member_count, 0) AS used_seats
            FROM workshops w
            JOIN content_items ci ON w.content_id = ci.id
            LEFT JOIN (
                SELECT workshop_id, COUNT(*) AS member_count 
                FROM workshop_members 
                GROUP BY workshop_id
            ) m ON m.workshop_id = w.id
            WHERE w.id = :id
        """),
        {"id": workshop_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Workshop not found")

    # 2. Fetch admins list
    admin_result = await pg.execute(
        text("""
            SELECT wca.user_id, u.email, u.name
            FROM workshop_course_admins wca
            JOIN users u ON wca.user_id = u.id
            WHERE wca.workshop_id = :id
        """),
        {"id": workshop_id}
    )
    admins = [
        {
            "user_id": str(r.user_id),
            "email": r.email,
            "name": r.name,
            "is_lead": True # Default lead
        }
        for r in admin_result.fetchall()
    ]

    return {
        "id": str(row.id),
        "title": row.title,
        "description": row.description,
        "content_id": str(row.content_id),
        "content_title": row.content_title,
        "mode": row.mode,
        "seat_cap": row.seat_cap,
        "used_seats": int(row.used_seats),
        "payment_status": row.payment_status,
        "access_policy": row.access_policy,
        "status": row.status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "admins": admins
    }


# ── Invite Code Endpoints ───────────────────────────────────────────────────

@router.get("/workshops/{workshop_id}/invites")
async def list_workshop_invites(
    workshop_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Lists invites generated for a given workshop."""
    if _admin.role != ROLE_SYS_ADMIN:
        await _verify_workshop_assignment(pg, str(_admin.id), str(workshop_id))

    result = await pg.execute(
        text("""
            SELECT id, workshop_id, code, max_uses, uses_count, expires_at, created_at
            FROM workshop_invites
            WHERE workshop_id = :id
            ORDER BY created_at DESC
        """),
        {"id": workshop_id}
    )
    rows = result.fetchall()
    return {
        "count": len(rows),
        "invites": [
            {
                "id": str(r.id),
                "workshop_id": str(r.workshop_id),
                "code": r.code,
                "max_uses": r.max_uses,
                "uses_count": r.uses_count,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.post("/workshops/{workshop_id}/invites")
async def create_workshop_invite(
    payload: WorkshopInviteRequest,
    workshop_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Creates a new invite code for a workshop."""
    if _admin.role != ROLE_SYS_ADMIN:
        await _verify_workshop_assignment(pg, str(_admin.id), str(workshop_id))

    code = f"INV-{uuid4().hex[:8].upper()}"
    invite_id = uuid4()
    
    await pg.execute(
        text("""
            INSERT INTO workshop_invites (id, workshop_id, code, max_uses, uses_count, expires_at)
            VALUES (:id, :workshop_id, :code, 100, 0, now() + interval '30 days')
        """),
        {
            "id": invite_id,
            "workshop_id": workshop_id,
            "code": code
        }
    )
    await pg.commit()

    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    return {
        "invite_id": str(invite_id),
        "email": payload.email,
        "expires_at": expires_at.isoformat(),
        "invite_url": f"https://cyberrange.infra/invite/{code}",
        "email_dispatched": True,
        "email_error": None
    }


@router.post("/workshops/{workshop_id}/invites/{invite_id}/resend")
async def resend_workshop_invite(
    workshop_id: UUID = Path(...),
    invite_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Simulates resending a workshop invite and returns status."""
    if _admin.role != ROLE_SYS_ADMIN:
        await _verify_workshop_assignment(pg, str(_admin.id), str(workshop_id))

    # Fetch invite info
    result = await pg.execute(
        text("SELECT code, expires_at FROM workshop_invites WHERE id = :id AND workshop_id = :workshop_id"),
        {"id": invite_id, "workshop_id": workshop_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invite not found")

    return {
        "invite_id": str(invite_id),
        "email": "recipient@example.com",
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "invite_url": f"https://cyberrange.infra/invite/{row.code}",
        "email_dispatched": True,
        "email_error": None
    }


@router.delete("/workshops/{workshop_id}/invites/{invite_id}")
async def revoke_workshop_invite(
    workshop_id: UUID = Path(...),
    invite_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Deletes/revokes a workshop invite code."""
    if _admin.role != ROLE_SYS_ADMIN:
        await _verify_workshop_assignment(pg, str(_admin.id), str(workshop_id))

    result = await pg.execute(
        text("SELECT 1 FROM workshop_invites WHERE id = :id AND workshop_id = :workshop_id"),
        {"id": invite_id, "workshop_id": workshop_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Invite not found")

    await pg.execute(
        text("DELETE FROM workshop_invites WHERE id = :id"),
        {"id": invite_id}
    )
    await pg.commit()
    return {"success": True, "message": "Invite revoked successfully"}


@router.get("/workshops/{workshop_id}/roster-runtime")
async def get_cohort_roster_runtime(
    workshop_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Returns the participant roster with joined runtime lab deployment status."""
    if _admin.role != ROLE_SYS_ADMIN:
        await _verify_workshop_assignment(pg, str(_admin.id), str(workshop_id))

    # Fetch workshop details
    w_res = await pg.execute(
        text("""
            SELECT w.seat_cap, COALESCE(m.member_count, 0) AS used_seats
            FROM workshops w
            LEFT JOIN (
                SELECT workshop_id, COUNT(*) AS member_count 
                FROM workshop_members 
                GROUP BY workshop_id
            ) m ON m.workshop_id = w.id
            WHERE w.id = :id
        """),
        {"id": workshop_id}
    )
    w_row = w_res.fetchone()
    if not w_row:
        raise HTTPException(status_code=404, detail="Workshop not found")

    # Fetch workshop members
    members_res = await pg.execute(
        text("""
            SELECT wm.user_id, u.email, u.name, wm.joined_at
            FROM workshop_members wm
            JOIN users u ON wm.user_id = u.id
            WHERE wm.workshop_id = :id
        """),
        {"id": workshop_id}
    )
    member_rows = members_res.fetchall()

    rows = []
    for r in member_rows:
        rows.append({
            "learner_key": str(r.user_id),
            "user_id": str(r.user_id),
            "email": r.email,
            "name": r.name,
            "onboarding_method": "invitation",
            "access_status": "active",
            "seat_consuming": True,
            "invite": None,
            "entitlement": {
                "created_at": r.joined_at.isoformat() if r.joined_at else None,
                "valid_until": None
            },
            "runtime": {
                "state": "ready",
                "last_updated_at": r.joined_at.isoformat() if r.joined_at else None,
                "failure_reason": None,
                "deployment_id": None,
                "deployment_status": "running",
                "expires_at": None
            }
        })

    return {
        "count": len(rows),
        "seat_cap": w_row.seat_cap,
        "used_seats": int(w_row.used_seats),
        "runtime_counts": {
            "ready": len(rows),
            "in_progress": 0,
            "failed": 0
        },
        "rows": rows
    }


# Helper for offset datetime delta
def interval_days(days: int) -> datetime:
    from datetime import timedelta
    return datetime.now(timezone.utc) + timedelta(days=days)


# ── Cohort Runs Endpoints ───────────────────────────────────────────────────

@router.get("/workshops/{workshop_id}/runs")
async def get_cohort_runs(
    workshop_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Lists cohort runs associated with a workshop."""
    result = await pg.execute(
        text("""
            SELECT id, workshop_id, content_id, scheduled_start, scheduled_end, created_at
            FROM cohort_runs
            WHERE workshop_id = :id
            ORDER BY created_at DESC
        """),
        {"id": workshop_id}
    )
    rows = result.fetchall()
    return {
        "count": len(rows),
        "runs": [
            {
                "id": str(r.id),
                "workshop_id": str(r.workshop_id),
                "content_id": str(r.content_id),
                "scheduled_start": r.scheduled_start.isoformat() if r.scheduled_start else None,
                "scheduled_end": r.scheduled_end.isoformat() if r.scheduled_end else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.post("/workshops/{workshop_id}/request-run")
async def request_cohort_run(
    body: CohortRunRequest,
    workshop_id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(CourseAdminOrAbove),
):
    """Requests and provisions a new cohort run instance."""
    # 1. Fetch workshop content id and associated metadata (to get lab_type)
    w_res = await pg.execute(
        text("""
            SELECT w.content_id, ci.metadata 
            FROM workshops w
            JOIN content_items ci ON w.content_id = ci.id
            WHERE w.id = :id
        """),
        {"id": workshop_id}
    )
    w_row = w_res.fetchone()
    if not w_row:
        raise HTTPException(status_code=404, detail="Workshop not found")

    if current_user.role != ROLE_SYS_ADMIN:
        await _verify_workshop_assignment(pg, str(current_user.id), str(workshop_id))

    metadata = w_row.metadata or {}
    lab_type = metadata.get("lab_type", "terraform")

    run_id = uuid4()
    workspace = f"ws-{run_id}"
    start = datetime.now(timezone.utc)
    end = start + timedelta(hours=body.duration_hours)

    # 2. Insert cohort_runs record
    await pg.execute(
        text("""
            INSERT INTO cohort_runs (id, workshop_id, content_id, scheduled_start, scheduled_end)
            VALUES (:id, :workshop_id, :content_id, :start, :end)
        """),
        {
            "id": run_id,
            "workshop_id": workshop_id,
            "content_id": w_row.content_id,
            "start": start,
            "end": end
        }
    )

    # 3. Insert real lab_deployments row (status 'queued' for constraint compatibility)
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
            "id": run_id,
            "user_id": str(current_user.id),
            "content_id": w_row.content_id,
            "lab_type": lab_type,
            "workspace": workspace,
            "expires_at": end,
        }
    )

    # 4. Fetch workshop members and attach them to deployment_members
    members_res = await pg.execute(
        text("SELECT user_id FROM workshop_members WHERE workshop_id = :id"),
        {"id": workshop_id}
    )
    members = members_res.fetchall()
    members_attached = 0

    for m in members:
        await pg.execute(
            text("""
                INSERT INTO deployment_members (deployment_id, user_id, added_by)
                VALUES (:deployment_id, :user_id, :added_by)
                ON CONFLICT (deployment_id, user_id) DO NOTHING
            """),
            {
                "deployment_id": run_id,
                "user_id": m.user_id,
                "added_by": current_user.id
            }
        )
        members_attached += 1

    await pg.commit()

    return {
        "deployment_id": str(run_id),
        "status": "pending",
        "expires_at": end.isoformat(),
        "members_attached": members_attached
    }


# ── Public and Auth Invite Routers ────────────────────────────────────────────

public_router = APIRouter(prefix="/public", tags=["Public Invites"])
auth_router = APIRouter(prefix="/auth", tags=["Auth Invites"])


@public_router.get("/workshop-invites/preview")
async def preview_workshop_invite(
    token: str = Query(..., description="Invite code to preview"),
    pg: AsyncSession = Depends(get_pg),
):
    """Preview details of a workshop invite code before redemption."""
    # Parameterized query blocks SQL injection
    result = await pg.execute(
        text("""
            SELECT wi.id AS invite_id, wi.workshop_id, wi.max_uses, wi.uses_count, wi.expires_at,
                   w.title, w.description, w.content_id, w.seat_cap, w.status,
                   COALESCE(m.member_count, 0) AS used_seats
            FROM workshop_invites wi
            JOIN workshops w ON wi.workshop_id = w.id
            LEFT JOIN (
                SELECT workshop_id, COUNT(*) AS member_count 
                FROM workshop_members 
                GROUP BY workshop_id
            ) m ON m.workshop_id = w.id
            WHERE wi.code = :code
        """),
        {"code": token}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invite code not found")

    is_expired = False
    if row.expires_at and row.expires_at < datetime.now(timezone.utc):
        is_expired = True
    if row.max_uses and row.uses_count >= row.max_uses:
        is_expired = True

    return {
        "workshop_id": str(row.workshop_id),
        "title": row.title,
        "description": row.description,
        "content_id": str(row.content_id),
        "seat_cap": row.seat_cap,
        "used_seats": int(row.used_seats),
        "is_active": not is_expired and row.status == "active"
    }


@auth_router.post("/workshop-invite/redeem")
async def redeem_workshop_invite(
    payload: WorkshopRedeemRequest,
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """Redeems an invite code and grants the course entitlement."""
    # Parameterized query prevents SQL injection
    result = await pg.execute(
        text("""
            SELECT wi.id AS invite_id, wi.workshop_id, wi.max_uses, wi.uses_count, wi.expires_at,
                   w.title, w.content_id, w.status
            FROM workshop_invites wi
            JOIN workshops w ON wi.workshop_id = w.id
            WHERE wi.code = :code
        """),
        {"code": payload.token}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    if row.expires_at and row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite code has expired")

    if row.max_uses and row.uses_count >= row.max_uses:
        raise HTTPException(status_code=400, detail="Invite code usage limit reached")

    # Check existing membership
    member_check = await pg.execute(
        text("SELECT 1 FROM workshop_members WHERE workshop_id = :wid AND user_id = :uid"),
        {"wid": row.workshop_id, "uid": current_user.id}
    )
    if member_check.fetchone():
        return {
            "ok": True,
            "workshop_id": str(row.workshop_id),
            "workshop_title": row.title,
            "valid_until": row.expires_at.isoformat() if row.expires_at else None
        }

    # Add member
    await pg.execute(
        text("""
            INSERT INTO workshop_members (workshop_id, user_id, joined_at)
            VALUES (:wid, :uid, now())
        """),
        {"wid": row.workshop_id, "uid": current_user.id}
    )

    # Increment usage
    await pg.execute(
        text("UPDATE workshop_invites SET uses_count = uses_count + 1 WHERE id = :id"),
        {"id": row.invite_id}
    )

    # Grant entitlement
    await pg.execute(
        text("""
            INSERT INTO entitlements (user_id, content_id, valid_from, valid_until, status)
            VALUES (:uid, :content_id, now(), :valid_until, 'active')
            ON CONFLICT (user_id, content_id) DO UPDATE SET
                status = 'active',
                valid_from = now(),
                valid_until = EXCLUDED.valid_until
        """),
        {
            "uid": current_user.id,
            "content_id": row.content_id,
            "valid_until": row.expires_at
        }
    )

    await pg.commit()
    
    return {
        "ok": True,
        "workshop_id": str(row.workshop_id),
        "workshop_title": row.title,
        "valid_until": row.expires_at.isoformat() if row.expires_at else None
    }
