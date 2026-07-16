"""
backend/routers/labs.py (updated)

Changes vs previous:
- AdminOnly → SysAdminOnly throughout.
- Log messages updated: 'admin' → 'sys_admin', 'Member' → 'Participant'.
- All logic unchanged — course_admin scoping comes in Phase 2.
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.dependencies.auth import get_current_user
from backend.dependencies.authz import SysAdminOnly, AnyAuthenticatedUser
from backend.schemas.auth import CurrentUser
from backend.schemas.labs import LabDeployRequest, LabDeployForUserRequest
from backend.pg import get_pg
from backend.config import get_settings
from backend.limiter import limiter
from backend.infrastructure.headscale import mint_preauth_key
from backend.utils.audit import log_token_event

log = logging.getLogger("labs")
router = APIRouter(prefix="/labs", tags=["Labs"])
settings = get_settings()

_ACTIVE_STATUSES = {"running"}
_ERROR_MESSAGE = (
    "Deployment failed. Contact support with your deployment ID for details."
)
JOIN_KEY_TTL_MINUTES = 15


@router.post("/deploy")
@limiter.limit(settings.RATE_LIMIT_DEPLOY)
async def deploy_lab(
    request: Request,
    response: Response,
    body: LabDeployRequest,
    current_user: CurrentUser = Depends(SysAdminOnly),
    pg: AsyncSession = Depends(get_pg),
):
    """sys_admin only. Queue a lab deployment with explicit expires_at."""
    if body.expires_at.tzinfo is None:
        expires_at = body.expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = body.expires_at

    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="expires_at must be in the future.")

    result = await pg.execute(
        text("""
            SELECT id, metadata FROM content_items
            WHERE id = :content_id AND type = 'lab' AND is_active = true
        """),
        {"content_id": body.content_id},
    )
    lab = result.fetchone()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    lab_type = (lab.metadata or {}).get("lab_type")
    if not lab_type:
        raise HTTPException(
            status_code=500,
            detail="Lab is misconfigured: missing lab_type in metadata.",
        )

    existing = await pg.execute(
        text("""
            SELECT 1 FROM lab_deployments
            WHERE user_id = :user_id AND content_id = :content_id
              AND status IN ('queued', 'provisioning', 'running')
            LIMIT 1
        """),
        {"user_id": current_user.id, "content_id": body.content_id},
    )
    if existing.fetchone():
        raise HTTPException(
            status_code=400,
            detail="An active deployment already exists for this lab.",
        )

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
            "id": deployment_id,
            "user_id": current_user.id,
            "content_id": body.content_id,
            "lab_type": lab_type,
            "workspace": workspace,
            "expires_at": expires_at,
        },
    )
    await pg.commit()

    log.info(
        "Lab queued: deployment_id=%s sys_admin_id=%s lab_type=%s expires_at=%s",
        deployment_id, current_user.id, lab_type, expires_at,
    )
    return {"deployment_id": str(deployment_id), "status": "queued", "expires_at": expires_at}


@router.get("/status")
async def list_labs(
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """
    Returns deployments visible to the current user.
    Owners see full details including IPs.
    Participants see status and join availability only.
    """
    own_result = await pg.execute(
        text("""
            SELECT ld.id, ld.status, ld.instance_public_ip, ld.instance_private_ip,
                   ld.error_message, ld.created_at, ld.expires_at, ci.title,
                   true AS is_owner
            FROM lab_deployments ld
            JOIN content_items ci ON ld.content_id = ci.id
            WHERE ld.user_id = :uid
            ORDER BY ld.created_at DESC
        """),
        {"uid": current_user.id},
    )
    own_rows = own_result.fetchall()

    member_result = await pg.execute(
        text("""
            SELECT ld.id, ld.status, ld.error_message, ld.created_at,
                   ld.expires_at, ci.title, false AS is_owner
            FROM deployment_members dm
            JOIN lab_deployments ld ON dm.deployment_id = ld.id
            JOIN content_items ci ON ld.content_id = ci.id
            WHERE dm.user_id = :uid
            ORDER BY ld.created_at DESC
        """),
        {"uid": current_user.id},
    )
    member_rows = member_result.fetchall()

    deployments = []

    for r in own_rows:
        deployments.append({
            "deployment_id": r.id,
            "status": r.status,
            "is_owner": True,
            "public_ip":  r.instance_public_ip  if r.status in _ACTIVE_STATUSES else None,
            "private_ip": r.instance_private_ip if r.status in _ACTIVE_STATUSES else None,
            "error": _ERROR_MESSAGE if r.error_message else None,
            "lab_title": r.title,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
            "can_join": False,
        })

    for r in member_rows:
        if any(d["deployment_id"] == r.id for d in deployments):
            continue
        deployments.append({
            "deployment_id": r.id,
            "status": r.status,
            "is_owner": False,
            "public_ip": None,
            "private_ip": None,
            "error": _ERROR_MESSAGE if r.error_message else None,
            "lab_title": r.title,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
            "can_join": r.status in _ACTIVE_STATUSES,
        })

    return {"count": len(deployments), "deployments": deployments}


@router.post("/join/{deployment_id}")
@limiter.limit(settings.RATE_LIMIT_TAILNET)
async def join_deployment(
    request: Request,
    response: Response,
    deployment_id: str = Path(...),
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """Mint a short-lived Headscale device key for a deployment the user is a member of."""
    result = await pg.execute(
        text("SELECT id, user_id, status, expires_at FROM lab_deployments WHERE id = :id"),
        {"id": deployment_id},
    )
    deployment = result.fetchone()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if deployment.status != "running":
        raise HTTPException(
            status_code=400,
            detail=f"Lab is not ready yet (status: {deployment.status}). Try again shortly.",
        )

    is_owner = str(deployment.user_id) == str(current_user.id)

    if not is_owner:
        member_check = await pg.execute(
            text("""
                SELECT 1 FROM deployment_members
                WHERE deployment_id = :deployment_id AND user_id = :user_id
            """),
            {"deployment_id": deployment_id, "user_id": current_user.id},
        )
        if not member_check.fetchone():
            raise HTTPException(
                status_code=403,
                detail="You are not a participant of this deployment.",
            )

    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    dep_expires = deployment.expires_at
    if dep_expires.tzinfo is None:
        dep_expires = dep_expires.replace(tzinfo=timezone.utc)

    expires_at = min(
        datetime.now(timezone.utc) + timedelta(minutes=JOIN_KEY_TTL_MINUTES),
        dep_expires,
    )

    authkey = await mint_preauth_key(
        pg=pg,
        user_id=str(current_user.id),
        key_type="device",
        expires_at=expires_at,
        acl_tags=[],
        reusable=False,
        ephemeral=True,
    )

    await log_token_event(
        pg,
        user_id=str(current_user.id),
        jti=authkey,
        event="join_key_issued",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await pg.commit()

    login_server = settings.HEADSCALE_API_URL
    command = (
        f"sudo tailscale up "
        f"--login-server={login_server} "
        f"--authkey={authkey} "
        f"--accept-routes=true"
    )

    log.info(
        "Join token minted: deployment_id=%s user_id=%s is_owner=%s",
        deployment_id, current_user.id, is_owner,
    )

    return {
        "deployment_id": deployment_id,
        "login_server": login_server,
        "authkey": authkey,
        "expires_at": expires_at.isoformat(),
        "command": command,
        "ttl_minutes": JOIN_KEY_TTL_MINUTES,
    }


@router.post("/admin/deployments/{deployment_id}/members/{user_id}", status_code=201)
async def add_participant(
    deployment_id: str = Path(...),
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Add a participant to a deployment."""
    dep = await pg.execute(
        text("SELECT id FROM lab_deployments WHERE id = :id"),
        {"id": deployment_id},
    )
    if not dep.fetchone():
        raise HTTPException(status_code=404, detail="Deployment not found")

    usr = await pg.execute(
        text("SELECT id, email, is_active FROM users WHERE id = :id"),
        {"id": user_id},
    )
    user_row = usr.fetchone()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    if not user_row.is_active:
        raise HTTPException(status_code=400, detail="User is inactive")

    await pg.execute(
        text("""
            INSERT INTO deployment_members (deployment_id, user_id, added_by)
            VALUES (:deployment_id, :user_id, :added_by)
            ON CONFLICT (deployment_id, user_id) DO NOTHING
        """),
        {"deployment_id": deployment_id, "user_id": user_id, "added_by": str(admin.id)},
    )
    await pg.commit()

    log.info(
        "Participant added: deployment_id=%s user_id=%s by sys_admin=%s",
        deployment_id, user_id, admin.id,
    )
    return {
        "deployment_id": deployment_id,
        "user_id": user_id,
        "email": user_row.email,
        "message": "Participant added to deployment successfully",
    }


@router.delete("/admin/deployments/{deployment_id}/members/{user_id}", status_code=200)
async def remove_participant(
    deployment_id: str = Path(...),
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Remove a participant from a deployment."""
    result = await pg.execute(
        text("""
            DELETE FROM deployment_members
            WHERE deployment_id = :deployment_id AND user_id = :user_id
            RETURNING deployment_id
        """),
        {"deployment_id": deployment_id, "user_id": user_id},
    )
    if not result.fetchone():
        raise HTTPException(
            status_code=404,
            detail="Participant not found on this deployment",
        )

    await pg.commit()
    log.info(
        "Participant removed: deployment_id=%s user_id=%s",
        deployment_id, user_id,
    )
    return {"deployment_id": deployment_id, "user_id": user_id, "message": "Participant removed"}


@router.get("/admin/deployments/{deployment_id}/members")
async def list_participants(
    deployment_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. List all participants in a deployment."""
    result = await pg.execute(
        text("""
            SELECT dm.user_id, u.email, dm.added_by, dm.added_at
            FROM deployment_members dm
            JOIN users u ON dm.user_id = u.id
            WHERE dm.deployment_id = :deployment_id
            ORDER BY dm.added_at ASC
        """),
        {"deployment_id": deployment_id},
    )
    rows = result.fetchall()

    return {
        "deployment_id": deployment_id,
        "count": len(rows),
        "participants": [
            {
                "user_id": r.user_id,
                "email": r.email,
                "added_by": r.added_by,
                "added_at": r.added_at,
            }
            for r in rows
        ],
    }


@router.get("/admin/all")
async def list_all_labs(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns all deployments across all users."""
    result = await pg.execute(
        text("""
            SELECT ld.id, ld.status, ld.lab_type, ld.user_id, u.email,
                   ld.instance_public_ip, ld.instance_private_ip,
                   ld.error_message, ld.created_at, ld.expires_at,
                   ci.title, COUNT(dm.user_id) AS participant_count
            FROM lab_deployments ld
            JOIN content_items ci ON ld.content_id = ci.id
            JOIN users u ON ld.user_id = u.id
            LEFT JOIN deployment_members dm ON ld.id = dm.deployment_id
            GROUP BY ld.id, ci.title, u.email
            ORDER BY ld.created_at DESC
            LIMIT 500
        """)
    )
    rows = result.fetchall()

    return {
        "count": len(rows),
        "deployments": [
            {
                "deployment_id": r.id,
                "status": r.status,
                "lab_type": r.lab_type,
                "user_id": r.user_id,
                "user_email": r.email,
                "public_ip": r.instance_public_ip,
                "private_ip": r.instance_private_ip,
                "error": r.error_message,
                "lab_title": r.title,
                "created_at": r.created_at,
                "expires_at": r.expires_at,
                "participant_count": r.participant_count,
            }
            for r in rows
        ],
    }


@router.get("/admin/deployments/{deployment_id}")
async def admin_deployment_detail(
    deployment_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns details of a single deployment."""
    # Parameterized SQL query execution prevents SQL injection
    result = await pg.execute(
        text("""
            SELECT ld.id, ld.status, ld.lab_type, ld.user_id, u.email,
                   ld.instance_public_ip, ld.instance_private_ip,
                   ld.error_message, ld.created_at, ld.expires_at,
                   ci.title, COUNT(dm.user_id) AS participant_count
            FROM lab_deployments ld
            JOIN content_items ci ON ld.content_id = ci.id
            JOIN users u ON ld.user_id = u.id
            LEFT JOIN deployment_members dm ON ld.id = dm.deployment_id
            WHERE ld.id = :deployment_id
            GROUP BY ld.id, ci.title, u.email
        """),
        {"deployment_id": deployment_id},
    )
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Deployment not found")

    return {
        "deployment": {
            "deployment_id": r.id,
            "status": r.status,
            "lab_type": r.lab_type,
            "user_id": r.user_id,
            "user_email": r.email,
            "public_ip": r.instance_public_ip,
            "private_ip": r.instance_private_ip,
            "error": r.error_message,
            "lab_title": r.title,
            "created_at": r.created_at,
            "expires_at": r.expires_at,
            "participant_count": r.participant_count,
        }
    }


@router.post("/admin/deploy-for-user")
@limiter.limit(settings.RATE_LIMIT_DEPLOY)
async def deploy_lab_for_user(
    request: Request,
    response: Response,
    body: LabDeployForUserRequest,
    _admin: CurrentUser = Depends(SysAdminOnly),
    pg: AsyncSession = Depends(get_pg),
):
    """sys_admin only. Queue a lab deployment for an arbitrary target user."""
    if body.expires_at.tzinfo is None:
        expires_at = body.expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = body.expires_at

    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="expires_at must be in the future.")

    # Parameterized verification queries protect against SQL injection
    user_result = await pg.execute(
        text("SELECT id FROM users WHERE id = :uid"),
        {"uid": body.target_user_id},
    )
    if not user_result.fetchone():
        raise HTTPException(status_code=404, detail="Target user not found")

    result = await pg.execute(
        text("""
            SELECT id, metadata FROM content_items
            WHERE id = :content_id AND type = 'lab' AND is_active = true
        """),
        {"content_id": body.content_id},
    )
    lab = result.fetchone()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found")

    lab_type = (lab.metadata or {}).get("lab_type")
    if not lab_type:
        raise HTTPException(
            status_code=500,
            detail="Lab is misconfigured: missing lab_type in metadata.",
        )

    existing = await pg.execute(
        text("""
            SELECT 1 FROM lab_deployments
            WHERE user_id = :user_id AND content_id = :content_id
              AND status IN ('queued', 'provisioning', 'running')
            LIMIT 1
        """),
        {"user_id": body.target_user_id, "content_id": body.content_id},
    )
    if existing.fetchone():
        raise HTTPException(
            status_code=400,
            detail="An active deployment already exists for this lab and target user.",
        )

    deployment_id = uuid4()
    workspace = f"ws-{deployment_id}"

    # Parameterized insert statement blocks SQL injection
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
            "id": deployment_id,
            "user_id": body.target_user_id,
            "content_id": body.content_id,
            "lab_type": lab_type,
            "workspace": workspace,
            "expires_at": expires_at,
        },
    )
    await pg.commit()

    log.info(
        "Lab queued for user: deployment_id=%s target_user_id=%s lab_type=%s expires_at=%s",
        deployment_id, body.target_user_id, lab_type, expires_at,
    )
    return {"deployment_id": str(deployment_id), "status": "queued", "expires_at": expires_at}


@router.get("/access-details/{deployment_id}")
async def get_access_details(
    deployment_id: str = Path(...),
    current_user: CurrentUser = Depends(AnyAuthenticatedUser),
    pg: AsyncSession = Depends(get_pg),
):
    """Returns Tailnet/VPN connection and machine credentials for a deployment."""
    # Parameterized select statement blocks SQL injection
    result = await pg.execute(
        text("""
            SELECT ld.id, ld.user_id, ld.status, ld.lab_type, ld.expires_at, 
                   ld.instance_public_ip, ld.instance_private_ip, ld.terraform_outputs,
                   ci.title
                FROM lab_deployments ld
                JOIN content_items ci ON ld.content_id = ci.id
                WHERE ld.id = :id
        """),
        {"id": deployment_id},
    )
    deployment = result.fetchone()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    is_owner = str(deployment.user_id) == str(current_user.id)
    if not is_owner:
        member_check = await pg.execute(
            text("""
                SELECT 1 FROM deployment_members
                WHERE deployment_id = :deployment_id AND user_id = :user_id
            """),
            {"deployment_id": deployment_id, "user_id": current_user.id},
        )
        if not member_check.fetchone():
            raise HTTPException(
                status_code=403,
                detail="You are not a participant of this deployment.",
            )

    status = deployment.status
    lab_type = deployment.lab_type
    expires_at = deployment.expires_at.isoformat() if deployment.expires_at else None

    instructions = []
    machines = []
    access_model = "tailnet" if not deployment.instance_public_ip else "direct"

    if status == "running":
        instructions = [
            "Install Tailscale on your host machine.",
            "Click the Connect button to get your Tailscale join command.",
            "Verify Tailscale connection is active by pinging the machine private IP."
        ]
        
        outputs = deployment.terraform_outputs or {}
        
        if "machines" in outputs and isinstance(outputs["machines"], list):
            machines = outputs["machines"]
        else:
            machines = [
                {
                    "name": "Target Machine",
                    "private_ip": deployment.instance_private_ip,
                    "public_ip": deployment.instance_public_ip,
                    "username": outputs.get("username", {}).get("value") or outputs.get("username") or "ubuntu",
                    "password": outputs.get("password", {}).get("value") or outputs.get("password") or None,
                    "credential_label": "default SSH credentials"
                }
            ]
    else:
        instructions = [f"Lab status is currently: {status}. Access details will become available once the lab is running."]

    return {
        "deployment_id": str(deployment.id),
        "lab_type": lab_type,
        "status": status,
        "is_owner": is_owner,
        "access_model": access_model,
        "expires_at": expires_at,
        "instructions": instructions,
        "machines": machines
    }


@router.get("/admin/coverage")
async def admin_deployment_coverage(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns coverage metrics for all deployments."""
    # Parameterized SQL query execution prevents SQL injection
    result = await pg.execute(
        text("""
            SELECT 
                ld.id AS deployment_id,
                ld.content_id,
                ci.title AS lab_title,
                u.email AS owner_email,
                ld.status,
                ld.created_at,
                COALESCE(dm.cnt, 0) AS attached_count,
                COALESCE(ent.cnt, 0) AS enrolled_count
            FROM lab_deployments ld
            JOIN content_items ci ON ld.content_id = ci.id
            JOIN users u ON ld.user_id = u.id
            LEFT JOIN (
                SELECT deployment_id, COUNT(*) AS cnt 
                FROM deployment_members 
                GROUP BY deployment_id
            ) dm ON dm.deployment_id = ld.id
            LEFT JOIN (
                SELECT content_id, COUNT(*) AS cnt 
                FROM entitlements 
                WHERE status = 'active'
                GROUP BY content_id
            ) ent ON ent.content_id = ld.content_id
            ORDER BY ld.created_at DESC
        """)
    )
    rows = result.fetchall()
    
    res_rows = []
    for r in rows:
        attached = r.attached_count
        enrolled = r.enrolled_count
        status = r.status
        
        if status != "running":
            state = "not_running"
        elif attached == 0:
            state = "no_users_added"
        elif attached >= enrolled:
            state = "all_users_added"
        else:
            state = "users_missing"
            
        gap = max(0, enrolled - attached)
        
        res_rows.append({
            "deployment_id": str(r.deployment_id),
            "content_id": str(r.content_id),
            "lab_title": r.lab_title,
            "owner_email": r.owner_email,
            "status": status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "attached_count": attached,
            "enrolled_count": enrolled,
            "gap_count": gap,
            "coverage_state": state
        })
        
    return {"rows": res_rows}


@router.get("/admin/memberships/by-user")
async def admin_memberships_by_user(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns memberships list grouped by user."""
    # Parameterized SQL query execution prevents SQL injection
    result = await pg.execute(
        text("""
            SELECT 
                dm.user_id,
                dm.deployment_id,
                ci.title AS lab_title,
                ld.status
            FROM deployment_members dm
            JOIN lab_deployments ld ON dm.deployment_id = ld.id
            JOIN content_items ci ON ld.content_id = ci.id
            ORDER BY dm.added_at DESC
        """)
    )
    rows = result.fetchall()
    return {
        "rows": [
            {
                "user_id": str(r.user_id),
                "deployment_id": str(r.deployment_id),
                "lab_title": r.lab_title,
                "status": r.status
            }
            for r in rows
        ]
    }


@router.post("/admin/deployments/{deployment_id}/terminate", status_code=200)
async def terminate_deployment(
    deployment_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Manually terminate/expire a running deployment."""
    dep = await pg.execute(
        text("SELECT id FROM lab_deployments WHERE id = :id"),
        {"id": deployment_id},
    )
    if not dep.fetchone():
        raise HTTPException(status_code=404, detail="Deployment not found")

    await pg.execute(
        text("""
            UPDATE lab_deployments
            SET expires_at = now() - INTERVAL '1 minute',
                updated_at = now()
            WHERE id = :id
        """),
        {"id": deployment_id},
    )
    await pg.commit()

    log.info(
        "Deployment scheduled for termination by sys_admin: deployment_id=%s",
        deployment_id,
    )
    return {
        "deployment_id": deployment_id,
        "message": "Deployment scheduled for termination successfully",
        "success": True
    }


from pydantic import BaseModel
from typing import List, Optional

class CTFGroupPayload(BaseModel):
    id: str
    name: str
    emails: List[str]

class CTFSchedulePayload(BaseModel):
    id: str
    lab_id: str
    lab_title: str
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    start_time: str
    duration_hours: int
    status: str
    deployment_id: Optional[str] = None


@router.get("/admin/ctf-groups")
async def list_ctf_groups(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. List all student groups/cohorts."""
    res = await pg.execute(text("SELECT id, name, emails FROM public.ctf_groups ORDER BY name"))
    rows = res.fetchall()
    return [
        {
            "id": r.id,
            "name": r.name,
            "emails": r.emails
        }
        for r in rows
    ]


@router.post("/admin/ctf-groups")
async def save_ctf_group(
    payload: CTFGroupPayload,
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Create or update a student group/cohort."""
    import json
    emails_json = json.dumps(payload.emails)
    await pg.execute(
        text("""
            INSERT INTO public.ctf_groups (id, name, emails)
            VALUES (:id, :name, :emails)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                emails = EXCLUDED.emails
        """),
        {
            "id": payload.id,
            "name": payload.name,
            "emails": emails_json
        }
    )
    await pg.commit()
    return {"success": True, "message": "Group saved successfully"}


@router.delete("/admin/ctf-groups/{group_id}")
async def delete_ctf_group(
    group_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Delete a student group."""
    await pg.execute(
        text("DELETE FROM public.ctf_groups WHERE id = :id"),
        {"id": group_id}
    )
    await pg.commit()
    return {"success": True, "message": "Group deleted successfully"}


@router.get("/admin/ctf-schedules")
async def list_ctf_schedules(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. List all scheduled lab launches."""
    res = await pg.execute(
        text("""
            SELECT id, lab_id, lab_title, group_id, group_name, start_time, duration_hours, status, deployment_id
            FROM public.ctf_schedules
            ORDER BY start_time ASC
        """)
    )
    rows = res.fetchall()
    return [
        {
            "id": r.id,
            "lab_id": r.lab_id,
            "lab_title": r.lab_title,
            "group_id": r.group_id,
            "group_name": r.group_name,
            "start_time": r.start_time.isoformat() if r.start_time else None,
            "duration_hours": r.duration_hours,
            "status": r.status,
            "deployment_id": r.deployment_id
        }
        for r in rows
    ]


@router.post("/admin/ctf-schedules")
async def save_ctf_schedule(
    payload: CTFSchedulePayload,
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Create or update a scheduled lab launch."""
    dt = datetime.fromisoformat(payload.start_time.replace("Z", "+00:00"))
    await pg.execute(
        text("""
            INSERT INTO public.ctf_schedules (id, lab_id, lab_title, group_id, group_name, start_time, duration_hours, status, deployment_id)
            VALUES (:id, :lab_id, :lab_title, :group_id, :group_name, :start_time, :duration_hours, :status, :deployment_id)
            ON CONFLICT (id) DO UPDATE
            SET lab_id = EXCLUDED.lab_id,
                lab_title = EXCLUDED.lab_title,
                group_id = EXCLUDED.group_id,
                group_name = EXCLUDED.group_name,
                start_time = EXCLUDED.start_time,
                duration_hours = EXCLUDED.duration_hours,
                status = EXCLUDED.status,
                deployment_id = EXCLUDED.deployment_id
        """),
        {
            "id": payload.id,
            "lab_id": payload.lab_id,
            "lab_title": payload.lab_title,
            "group_id": payload.group_id,
            "group_name": payload.group_name,
            "start_time": dt,
            "duration_hours": payload.duration_hours,
            "status": payload.status,
            "deployment_id": payload.deployment_id
        }
    )
    await pg.commit()
    return {"success": True, "message": "Schedule saved successfully"}


@router.delete("/admin/ctf-schedules/{schedule_id}")
async def delete_ctf_schedule(
    schedule_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Delete a schedule."""
    await pg.execute(
        text("DELETE FROM public.ctf_schedules WHERE id = :id"),
        {"id": schedule_id}
    )
    await pg.commit()
    return {"success": True, "message": "Schedule deleted successfully"}


@router.get("/ctf-allocations")
async def get_my_ctf_allocations(
    pg: AsyncSession = Depends(get_pg),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get list of lab IDs allocated/scheduled for the logged-in student's email."""
    email = current_user.email.lower()
    res = await pg.execute(
        text("""
            SELECT s.lab_id, s.start_time, s.duration_hours, g.emails, s.group_id, s.status
            FROM public.ctf_schedules s
            LEFT JOIN public.ctf_groups g ON s.group_id = g.id
        """)
    )
    rows = res.fetchall()
    
    allocated_labs = []
    import json
    from datetime import datetime, timezone, timedelta
    for r in rows:
        is_member = False
        if not r.group_id:
            is_member = True
        elif r.emails:
            emails_list = r.emails
            if isinstance(emails_list, str):
                try:
                    emails_list = json.loads(emails_list)
                except Exception:
                    emails_list = []
            if isinstance(emails_list, list):
                if any(e.lower() == email for e in emails_list):
                    is_member = True
        
        if is_member:
            is_active = False
            if r.status == "started":
                is_active = True
            elif r.status == "scheduled":
                now = datetime.now(timezone.utc)
                start = r.start_time.replace(tzinfo=timezone.utc) if r.start_time.tzinfo is None else r.start_time
                end = start + timedelta(hours=r.duration_hours)
                if start <= now <= end:
                    is_active = True
            
            if is_active:
                allocated_labs.append({
                    "lab_id": r.lab_id,
                    "start_time": r.start_time.isoformat() if r.start_time else None,
                    "duration_hours": r.duration_hours
                })
            
    return {"allocations": allocated_labs}