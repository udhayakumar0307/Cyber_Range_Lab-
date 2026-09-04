from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings as app_settings


TOKEN_TYPE = "sysadmin_workspace_submit"
TOKEN_SCOPE = "sysadmin:submit"
TOKEN_AUDIENCE = "cyberrange-sysadmin-grading"
TOKEN_ISSUER = "cyberrange-backend"


class WorkspaceTokenError(ValueError):
    """Raised when a workspace submission credential is invalid."""


def _workspace_secret() -> str:
    """
    Use a signing key that is cryptographically separate from normal CyberRange
    access tokens. This prevents a workspace credential from being accepted by
    the legacy access-token fallback path elsewhere in the application.
    """
    configured = os.getenv("SYSADMIN_WORKSPACE_TOKEN_SECRET", "").strip()
    if configured:
        return configured
    material = f"{app_settings.SECRET_KEY}::sysadmin-workspace-submit::v1"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class WorkspaceSubmissionClaims:
    user_id: int
    lab_id: str
    workspace_id: str
    jti: str
    expires_at: datetime
    assignment_id: int | None = None


def create_workspace_submission_token(
    *,
    user_id: int,
    lab_id: str,
    workspace_id: str,
    ttl_minutes: int,
    assignment_id: int | None = None,
) -> tuple[str, datetime]:
    if user_id <= 0:
        raise WorkspaceTokenError("Workspace token requires a persisted user ID.")
    if not lab_id:
        raise WorkspaceTokenError("Workspace token requires a lab ID.")
    if not workspace_id:
        raise WorkspaceTokenError("Workspace token requires a workspace ID.")
    if assignment_id is not None and assignment_id <= 0:
        raise WorkspaceTokenError("Workspace token assignment ID must be positive.")
    if ttl_minutes < 5 or ttl_minutes > 240:
        raise WorkspaceTokenError("Workspace token TTL must be between 5 and 240 minutes.")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=ttl_minutes)
    payload = {
        "sub": f"sysadmin-workspace:{user_id}",
        "user_id": user_id,
        "lab_id": lab_id,
        "workspace_id": workspace_id,
        "scope": TOKEN_SCOPE,
        "type": TOKEN_TYPE,
        "iss": TOKEN_ISSUER,
        "aud": TOKEN_AUDIENCE,
        "iat": now,
        "exp": expires_at,
        "jti": str(uuid.uuid4()),
    }
    if assignment_id is not None:
        payload["assignment_id"] = assignment_id

    token = jwt.encode(payload, _workspace_secret(), algorithm=app_settings.ALGORITHM)
    return token, expires_at


def decode_workspace_submission_token(token: str) -> WorkspaceSubmissionClaims:
    if not token:
        raise WorkspaceTokenError("Missing workspace submission token.")
    try:
        payload = jwt.decode(
            token,
            _workspace_secret(),
            algorithms=[app_settings.ALGORITHM],
            audience=TOKEN_AUDIENCE,
            issuer=TOKEN_ISSUER,
        )
    except jwt.ExpiredSignatureError as exc:
        raise WorkspaceTokenError("Workspace submission token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise WorkspaceTokenError("Invalid workspace submission token.") from exc

    if payload.get("type") != TOKEN_TYPE or payload.get("scope") != TOKEN_SCOPE:
        raise WorkspaceTokenError("Token is not authorized for Sysadmin submissions.")

    try:
        user_id = int(payload["user_id"])
        lab_id = str(payload["lab_id"])
        workspace_id = str(payload["workspace_id"])
        jti = str(payload["jti"])
        exp = datetime.fromtimestamp(float(payload["exp"]), tz=timezone.utc)
        raw_assignment_id = payload.get("assignment_id")
        assignment_id = (
            int(raw_assignment_id)
            if raw_assignment_id is not None
            else None
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise WorkspaceTokenError("Workspace submission token is missing required claims.") from exc

    if user_id <= 0 or not lab_id or not workspace_id or not jti:
        raise WorkspaceTokenError("Workspace submission token contains invalid claims.")
    if assignment_id is not None and assignment_id <= 0:
        raise WorkspaceTokenError(
            "Workspace submission token contains invalid assignment ID."
        )

    return WorkspaceSubmissionClaims(
        user_id=user_id,
        lab_id=lab_id,
        workspace_id=workspace_id,
        jti=jti,
        expires_at=exp,
        assignment_id=assignment_id,
    )
