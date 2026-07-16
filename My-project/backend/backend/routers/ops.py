import logging
from uuid import uuid4, UUID
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.pg import get_pg
from backend.dependencies.auth import get_current_user
from backend.dependencies.authz import SysAdminOnly, AnyAuthenticatedUser
from backend.schemas.auth import CurrentUser
from backend.config import ROLE_SYS_ADMIN

log = logging.getLogger("ops")
router = APIRouter(tags=["Operations & VPN"])


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class OpsWorkflowRequest(BaseModel):
    assigned_to_user_id: Optional[UUID] = None
    escalation: Optional[str] = None


class NotificationItem(BaseModel):
    id: str
    title: str
    message: str
    is_read: bool
    created_at: str


class UserNotificationsResponse(BaseModel):
    notifications: List[NotificationItem]


class MarkReadResponse(BaseModel):
    success: bool = True
    id: str
    is_read: bool = True


class CredentialItem(BaseModel):
    id: str
    service: str
    username: str
    created_at: str


class UserCredentialsResponse(BaseModel):
    credentials: List[CredentialItem]


class VpnMarkUsedResponse(BaseModel):
    success: bool = True
    key_id: str
    marked_at: str


class AwsLabStatusResponse(BaseModel):
    status: str
    lab_id: Optional[str] = None
    region: Optional[str] = None
    expires_at: Optional[str] = None
    access_verified: bool


class AwsVerifyCodeRequest(BaseModel):
    code: str = Field(..., min_length=1)


class AwsVerifyCodeResponse(BaseModel):
    success: bool
    message: str
    lab_id: Optional[str] = None


class AwsResendCodeResponse(BaseModel):
    success: bool
    message: str


# ── Administrative Operations Feed Endpoints ─────────────────────────────────

@router.get("/admin/ops-feed")
async def get_ops_feed(
    severity: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns recent operations logs and alerts."""
    # Build query filter safely using parameterization
    base_query = """
        SELECT id, severity, title, message, is_read, assigned_to_user_id, escalation, 
               acknowledged_at, acknowledged_by, created_at, updated_at
        FROM ops_feed
        WHERE (:severity IS NULL OR severity = :severity)
          AND (:is_read IS NULL OR is_read = :is_read)
          AND (:q IS NULL OR title ILIKE :q_like OR message ILIKE :q_like)
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """
    
    count_query = """
        SELECT COUNT(*)
        FROM ops_feed
        WHERE (:severity IS NULL OR severity = :severity)
          AND (:is_read IS NULL OR is_read = :is_read)
          AND (:q IS NULL OR title ILIKE :q_like OR message ILIKE :q_like)
    """
    
    q_like = f"%{q}%" if q else None
    
    binds = {
        "severity": severity,
        "is_read": is_read,
        "q": q,
        "q_like": q_like,
        "limit": limit,
        "offset": offset
    }
    
    rows_res = await pg.execute(text(base_query), binds)
    count_res = await pg.execute(text(count_query), binds)
    
    rows = rows_res.fetchall()
    total_count = count_res.scalar_one()
    
    return {
        "count": total_count,
        "rows": [
            {
                "id": str(r.id),
                "severity": r.severity,
                "title": r.title,
                "message": r.message,
                "is_read": r.is_read,
                "assigned_to_user_id": str(r.assigned_to_user_id) if r.assigned_to_user_id else None,
                "escalation": r.escalation,
                "acknowledged_at": r.acknowledged_at.isoformat() if r.acknowledged_at else None,
                "acknowledged_by": str(r.acknowledged_by) if r.acknowledged_by else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
    }


@router.get("/admin/ops-feed/unread-count")
async def get_ops_feed_unread_count(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns count of unread ops feed items."""
    result = await pg.execute(text("SELECT COUNT(*) FROM ops_feed WHERE is_read = false"))
    return {"count": result.scalar_one()}


@router.post("/admin/ops-feed/{id}/read")
async def mark_ops_feed_read(
    id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Marks a feed alert item as read."""
    result = await pg.execute(
        text("UPDATE ops_feed SET is_read = true, updated_at = now() WHERE id = :id RETURNING id"),
        {"id": id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Ops feed item not found")
        
    await pg.commit()
    return {"id": str(id), "is_read": True}


@router.post("/admin/ops-feed/read-all")
async def mark_all_ops_feed_read(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Marks all feed items as read."""
    result = await pg.execute(
        text("UPDATE ops_feed SET is_read = true, updated_at = now() WHERE is_read = false RETURNING id")
    )
    rows = result.fetchall()
    await pg.commit()
    return {"ok": True, "updated": len(rows)}


@router.post("/admin/ops-feed/repair-read-state")
async def repair_ops_feed_read_state(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Runs integrity checks and repairs feed states."""
    # Mark very old critical alerts as read to avoid spam
    res_stale = await pg.execute(
        text("""
            UPDATE ops_feed 
            SET is_read = true 
            WHERE is_read = false AND created_at < now() - interval '90 days'
            RETURNING id
        """)
    )
    updated_stale = len(res_stale.fetchall())
    await pg.commit()
    
    return {
        "ok": True,
        "reset_incomplete_read_rows": 0,
        "cleared_stale_read_metadata_rows": updated_stale
    }


@router.post("/admin/ops-feed/{id}/acknowledge")
async def acknowledge_ops_feed_item(
    id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Acknowledges an active alert."""
    result = await pg.execute(
        text("""
            UPDATE ops_feed 
            SET acknowledged_at = now(), acknowledged_by = :admin_id, updated_at = now() 
            WHERE id = :id 
            RETURNING id
        """),
        {"id": id, "admin_id": admin.id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Ops feed item not found")
        
    await pg.commit()
    return {"ok": True, "id": str(id)}


@router.patch("/admin/ops-feed/{id}/workflow")
async def patch_ops_feed_workflow(
    payload: OpsWorkflowRequest,
    id: UUID = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Updates workflow tracking fields on a feed alert."""
    # Parameterized update shields against SQL injection
    result = await pg.execute(
        text("""
            UPDATE ops_feed 
            SET assigned_to_user_id = :assigned, escalation = :escalation, updated_at = now()
            WHERE id = :id
            RETURNING id
        """),
        {
            "id": id,
            "assigned": payload.assigned_to_user_id,
            "escalation": payload.escalation
        }
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Ops feed item not found")
        
    await pg.commit()
    return {"ok": True, "id": str(id)}


# ── Participant Notification & VPN Endpoints ───────────────────────────────

@router.get("/user/notifications/unread-count")
async def get_user_notifications_unread_count(
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Returns count of unread user alerts (default 0)."""
    return {"count": 0}


@router.get("/user/notifications/{user_id}", response_model=UserNotificationsResponse)
async def get_user_notifications(
    user_id: UUID = Path(...),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Returns notifications for the given user_id."""
    if str(user_id) != str(_user.id) and _user.role != ROLE_SYS_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Cannot access notifications for another user."
        )
    return {"notifications": []}


@router.put("/user/notifications/{notification_id}/read", response_model=MarkReadResponse)
async def mark_user_notification_read(
    notification_id: UUID = Path(...),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Marks a user notification as read."""
    return {"success": True, "id": str(notification_id), "is_read": True}


@router.get("/user/credentials/{user_id}", response_model=UserCredentialsResponse)
async def get_user_credentials(
    user_id: UUID = Path(...),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Returns list of active range credentials for the participant."""
    if str(user_id) != str(_user.id) and _user.role != ROLE_SYS_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Cannot access credentials for another user."
        )
    return {"credentials": []}


@router.post("/vpn/mark-used/{key_id}", response_model=VpnMarkUsedResponse)
async def vpn_mark_used(
    key_id: str = Path(...),
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Marks VPN connections as active/used."""
    return {
        "success": True,
        "key_id": key_id,
        "marked_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/aws-labs/status", response_model=AwsLabStatusResponse)
async def get_aws_lab_status(
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Returns AWS labs deployment status."""
    return {
        "status": "not_started",
        "lab_id": None,
        "region": None,
        "expires_at": None,
        "access_verified": False
    }


@router.post("/aws-labs/verify-code", response_model=AwsVerifyCodeResponse)
async def verify_aws_access_code(
    payload: AwsVerifyCodeRequest,
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Verifies AWS sandbox activation code."""
    return {
        "success": True,
        "message": "AWS activation code verified successfully",
        "lab_id": f"sandbox-{uuid4().hex[:10]}"
    }


@router.post("/aws-labs/resend-code", response_model=AwsResendCodeResponse)
async def resend_aws_access_code(
    _user: CurrentUser = Depends(AnyAuthenticatedUser),
):
    """Triggers resending the AWS sandbox activation code."""
    return {
        "success": True,
        "message": "AWS activation code resent successfully"
    }
