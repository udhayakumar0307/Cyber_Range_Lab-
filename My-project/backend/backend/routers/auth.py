"""
backend/routers/auth.py (updated)

Changes vs previous:
- sso_callback: issue_token now returns (token, jti); audit 'issued' event written.
- logout: revoke_token_by_payload now takes pg + user context for audit trail.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Path
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Security
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from backend.pg import get_pg
from backend.services.auth_service import upsert_user, issue_token
from backend.dependencies.auth import get_current_user
from backend.dependencies.authz import SysAdminOnly, CourseAdminOrAbove
from backend.schemas.auth import SSOCallbackRequest, TokenResponse, CurrentUser, DevLoginRequest
from backend.config import get_settings, ROLE_SYS_ADMIN, ROLE_PARTICIPANT
from backend.limiter import limiter
from backend.utils.security import decode_token, revoke_token_by_payload
from backend.utils.audit import log_token_event

log = logging.getLogger("auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()

_google_request = google_requests.Request()
_bearer = HTTPBearer()


def _verify_google_token(raw_token: str) -> dict:
    try:
        payload = google_id_token.verify_oauth2_token(
            raw_token,
            _google_request,
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        log.warning("Google token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired SSO token")

    if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        log.warning("Google token has unexpected issuer: %s", payload.get("iss"))
        raise HTTPException(status_code=401, detail="Invalid SSO token issuer")

    return payload


@router.post("/sso/callback", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def sso_callback(
    request: Request,
    response: Response,
    payload: SSOCallbackRequest,
    pg: AsyncSession = Depends(get_pg),
):
    provider = payload.provider.strip().lower()
    if provider not in [p.lower() for p in settings.ALLOWED_SSO_PROVIDERS]:
        raise HTTPException(status_code=400, detail="Unsupported SSO provider")

    if provider == "google":
        verified = _verify_google_token(payload.id_token)
        subject = verified["sub"]
        email   = verified["email"].strip().lower()
        name    = verified.get("name") or verified.get("given_name")

        if not verified.get("email_verified", False):
            raise HTTPException(
                status_code=403,
                detail="Google account email is not verified",
            )
    else:
        raise HTTPException(status_code=400, detail="Unsupported SSO provider")

    user_id = await upsert_user(pg, provider, subject, email, name)
    # upsert_user commits internally — open a fresh implicit transaction
    # for the audit write below.
    token, jti = issue_token(user_id, provider)

    await log_token_event(
        pg,
        user_id=str(user_id),
        jti=jti,
        event="issued",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await pg.commit()

    log.info("SSO login: provider=%s email=%s user_id=%s", provider, email, user_id)
    return TokenResponse(access_token=token)

@router.get("/me", response_model=CurrentUser)
async def me(user: CurrentUser = Depends(get_current_user)):
    """Return the currently authenticated user including their role."""
    return user


@router.post("/admin/users/{user_id}/disable", status_code=200)
async def disable_user(
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Marks a user account as inactive."""
    if str(admin.id) == user_id:
        raise HTTPException(
            status_code=400,
            detail="sys_admin cannot disable their own account.",
        )

    result = await pg.execute(
        text("""
            UPDATE users SET is_active = false, updated_at = now()
            WHERE id = :uid RETURNING id
        """),
        {"uid": user_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    await pg.commit()
    log.info("User disabled: user_id=%s by sys_admin=%s", user_id, admin.id)
    return {"user_id": user_id, "is_active": False}


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
    pg: AsyncSession = Depends(get_pg),
):
    """Revoke the current JWT (Redis blocklist) and write a revoked audit entry."""
    payload = await decode_token(credentials.credentials)

    await revoke_token_by_payload(
        payload,
        pg=pg,
        user_id=payload.get("sub", "unknown"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await pg.commit()

    log.info(
        "User logged out: sub=%s jti=%s",
        payload.get("sub"), payload.get("jti"),
    )

@router.get("/admin/users")
async def list_users(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(CourseAdminOrAbove),
):
    """course_admin or sys_admin. List all user accounts."""
    result = await pg.execute(
        text("""
            SELECT id, email, role, is_active, created_at
            FROM users
            ORDER BY created_at ASC
        """)
    )
    rows = result.fetchall()
    return {
        "count": len(rows),
        "users": [
            {
                "user_id":    r.id,
                "email":      r.email,
                "role":       r.role,
                "is_active":  r.is_active,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }


DEV_UPSERT_USER = text("""
INSERT INTO users (sso_provider, sso_subject, email, name, role)
VALUES (:provider, :subject, :email, :name, :role)
ON CONFLICT (sso_provider, sso_subject)
DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, updated_at = now()
RETURNING id;
""")

@router.post("/dev-login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def dev_login(
    request: Request,
    response: Response,
    pg: AsyncSession = Depends(get_pg),
):
    """Local dev convenience admin login. Gated behind settings.ENABLE_DOCS."""
    if not settings.ENABLE_DOCS:
        raise HTTPException(
            status_code=403,
            detail="Dev admin login is disabled in this environment."
        )

    provider = "dev"
    email = "devtest@cyberrange.dev"
    name = "Dev Admin"
    role = ROLE_SYS_ADMIN
    subject = "dev-local-user"

    result = await pg.execute(
        DEV_UPSERT_USER,
        {
            "provider": provider,
            "subject": subject,
            "email": email,
            "name": name,
            "role": role,
        }
    )
    user_id = result.scalar_one()

    await pg.commit()

    token, jti = issue_token(user_id, provider)

    await log_token_event(
        pg,
        user_id=str(user_id),
        jti=jti,
        event="issued",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await pg.commit()

    log.info("Dev login: email=%s role=%s user_id=%s", email, role, user_id)
    return TokenResponse(access_token=token)


@router.post("/dev-login-participant", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def dev_login_participant(
    request: Request,
    response: Response,
    payload: DevLoginRequest,
    pg: AsyncSession = Depends(get_pg),
):
    """Local dev convenience login. Gated behind settings.ENABLE_DOCS."""
    if not settings.ENABLE_DOCS:
        raise HTTPException(
            status_code=403,
            detail="Dev participant login is disabled in this environment."
        )

    provider = "dev"
    email = (payload.email or "dev-participant@cyberrange.local").strip().lower()
    name = payload.name or "Dev Participant"
    role = payload.role or ROLE_PARTICIPANT
    subject = f"dev-{email}"

    if not payload.create_if_missing:
        check_user = await pg.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": email}
        )
        existing_user_id = check_user.scalar()
        if not existing_user_id and email not in ["student@academy.io", "course_admin@academy.io"]:
            raise HTTPException(
                status_code=404,
                detail=f"Email ID {email} is not registered. Please contact your CTF Admin to onboard."
            )

    # Parameterized SQL query execution prevents SQL injection
    result = await pg.execute(
        DEV_UPSERT_USER,
        {
            "provider": provider,
            "subject": subject,
            "email": email,
            "name": name,
            "role": role,
        }
    )
    user_id = result.scalar_one()

    # Commit the upsert so issue_token/log_token_event works correctly
    await pg.commit()

    token, jti = issue_token(user_id, provider)

    await log_token_event(
        pg,
        user_id=str(user_id),
        jti=jti,
        event="issued",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await pg.commit()

    log.info("Dev login: email=%s role=%s user_id=%s", email, role, user_id)
    return TokenResponse(access_token=token)


@router.post("/admin/users/{user_id}/enable", status_code=200)
async def enable_user(
    user_id: str = Path(...),
    pg: AsyncSession = Depends(get_pg),
    admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Marks a user account as active."""
    # Parameterized update statement blocks SQL injection
    result = await pg.execute(
        text("""
            UPDATE users SET is_active = true, updated_at = now()
            WHERE id = :uid RETURNING id
        """),
        {"uid": user_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    await pg.commit()
    log.info("User enabled: user_id=%s by sys_admin=%s", user_id, admin.id)
    return {"user_id": user_id, "is_active": True}


@router.get("/admin/users/overview")
async def admin_users_overview(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns billing and entitlement counts per user."""
    # Parameterized joins without string concatenation to ensure SQL injection protection
    result = await pg.execute(
        text("""
            SELECT 
                u.id AS user_id,
                COALESCE(pur.cnt, 0) AS purchase_count,
                COALESCE(pay.cnt, 0) AS pending_payment_count,
                COALESCE(ent_act.cnt, 0) AS entitlement_active,
                COALESCE(ent_exp.cnt, 0) AS entitlement_expired,
                COALESCE(ent_rev.cnt, 0) AS entitlement_revoked
            FROM users u
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM purchases 
                GROUP BY user_id
            ) pur ON pur.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM payments 
                WHERE status = 'pending' 
                GROUP BY user_id
            ) pay ON pay.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM entitlements 
                WHERE status = 'active' 
                GROUP BY user_id
            ) ent_act ON ent_act.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM entitlements 
                WHERE status = 'expired' 
                GROUP BY user_id
            ) ent_exp ON ent_exp.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM entitlements 
                WHERE status = 'revoked' 
                GROUP BY user_id
            ) ent_rev ON ent_rev.user_id = u.id
            ORDER BY u.created_at ASC
        """)
    )
    rows = result.fetchall()
    return {
        "rows": [
            {
                "user_id": str(r.user_id),
                "purchase_count": r.purchase_count,
                "pending_payment_count": r.pending_payment_count,
                "entitlement_active": r.entitlement_active,
                "entitlement_expired": r.entitlement_expired,
                "entitlement_revoked": r.entitlement_revoked,
            }
            for r in rows
        ]
    }


@router.get("/admin/users/ops-summary")
async def admin_users_ops_summary(
    pg: AsyncSession = Depends(get_pg),
    _admin: CurrentUser = Depends(SysAdminOnly),
):
    """sys_admin only. Returns operations & demographics summary per user."""
    # Joint statistics dynamically aggregated on SQL server safely without injection risk
    result = await pg.execute(
        text("""
            SELECT 
                u.id AS user_id,
                u.email,
                u.role,
                u.is_active,
                u.created_at,
                COALESCE(pur.cnt, 0) AS purchase_count,
                COALESCE(pay.cnt, 0) AS pending_payment_count,
                COALESCE(ent_act.cnt, 0) AS entitlement_active,
                COALESCE(ent_exp.cnt, 0) AS entitlement_expired,
                COALESCE(ent_rev.cnt, 0) AS entitlement_revoked,
                COALESCE(dep_att.cnt, 0) AS attempts30d,
                COALESCE(dep_fail.cnt, 0) AS failed30d,
                COALESCE(dep_live.cnt, 0) AS live_now,
                CASE WHEN dep_fail_any.cnt > 0 THEN TRUE ELSE FALSE END AS has_failed_any
            FROM users u
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM purchases 
                GROUP BY user_id
            ) pur ON pur.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM payments 
                WHERE status = 'pending' 
                GROUP BY user_id
            ) pay ON pay.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM entitlements 
                WHERE status = 'active' 
                GROUP BY user_id
            ) ent_act ON ent_act.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM entitlements 
                WHERE status = 'expired' 
                GROUP BY user_id
            ) ent_exp ON ent_exp.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM entitlements 
                WHERE status = 'revoked' 
                GROUP BY user_id
            ) ent_rev ON ent_rev.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM lab_deployments 
                WHERE created_at >= NOW() - INTERVAL '30 days' 
                GROUP BY user_id
            ) dep_att ON dep_att.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM lab_deployments 
                WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '30 days' 
                GROUP BY user_id
            ) dep_fail ON dep_fail.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM lab_deployments 
                WHERE status = 'running' 
                GROUP BY user_id
            ) dep_live ON dep_live.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*) AS cnt 
                FROM lab_deployments 
                WHERE status = 'failed' 
                GROUP BY user_id
            ) dep_fail_any ON dep_fail_any.user_id = u.id
            ORDER BY u.created_at ASC
        """)
    )
    rows = result.fetchall()
    return {
        "rows": [
            {
                "user_id": str(r.user_id),
                "email": r.email,
                "role": r.role,
                "is_active": r.is_active,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "purchase_count": r.purchase_count,
                "pending_payment_count": r.pending_payment_count,
                "entitlement_active": r.entitlement_active,
                "entitlement_expired": r.entitlement_expired,
                "entitlement_revoked": r.entitlement_revoked,
                "attempts30d": r.attempts30d,
                "failed30d": r.failed30d,
                "live_now": r.live_now,
                "has_failed_any": r.has_failed_any,
            }
            for r in rows
        ]
    }