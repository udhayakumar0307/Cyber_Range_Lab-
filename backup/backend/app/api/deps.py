from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.security import decode_access_token
from app.repository.user import user_repository
from app.models.user import User


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Resolve identity only. Authorization comes from UserRoleBinding rows."""
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    from app.security.token_manager import token_manager
    if token_manager.is_token_revoked(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired credentials")

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject identity")

    from app.core.config import settings
    if username.endswith("@testcyberrange.in") and settings.ENV == "development":
        return User(
            id=-999,
            name="CyberRange Test Student",
            email=username,
            role="student",
            account_type="academic",
            is_active=True,
            email_verified=True,
            department="Testing",
            year=3,
        )

    try:
        user = user_repository.get_by_email(db, username)
        if not user:
            user = user_repository.get_by_name(db, username)
    except Exception:
        user = None

    if not user:
        # Compatibility fallback grants no RBAC authority because it has no DB binding.
        user = User(
            id=payload.get("user_id", 4),
            name=username.split("@")[0],
            email=username,
            role=payload.get("role", "user"),
            account_type=payload.get("account_type", "student"),
            is_active=True,
            profile_completed=True,
            email_verified=True,
        )
    return user


def get_current_user_optional(request: Request, db: Session = Depends(get_db)):
    try:
        return get_current_user(request, db)
    except Exception:
        return None


def require_capability(capability):
    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.services.authorization_service import AuthorizationService
        return AuthorizationService.require_capability(db, current_user, capability)
    return dependency


def require_assignment_capability(capability):
    def dependency(
        assignment_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.services.authorization_service import AuthorizationService
        AuthorizationService.require_capability(db, current_user, capability)
        AuthorizationService.assert_assignment_access(db, current_user, assignment_id, capability)
        return current_user
    return dependency


def require_group_capability(capability):
    def dependency(
        group_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.services.authorization_service import AuthorizationService
        AuthorizationService.require_capability(db, current_user, capability)
        AuthorizationService.assert_group_access(db, current_user, group_id, capability)
        return current_user
    return dependency


def require_student_capability(capability):
    def dependency(
        student_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.services.authorization_service import AuthorizationService
        AuthorizationService.require_capability(db, current_user, capability)
        AuthorizationService.assert_user_access(db, current_user, student_id, capability)
        return current_user
    return dependency


def require_user_capability(capability):
    def dependency(
        user_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.services.authorization_service import AuthorizationService
        AuthorizationService.require_capability(db, current_user, capability)
        AuthorizationService.assert_user_access(db, current_user, user_id, capability)
        return current_user
    return dependency


def enforce_admin_rbac(request: Request, db: Session = Depends(get_db)):
    """Authoritative policy gate for every /api/v1/admin/* route."""
    path = request.url.path.rstrip("/")
    method = request.method.upper()

    # Registration has its own verification workflow and grants only a scoped binding.
    if path.endswith("/api/v1/admin/register"):
        return None

    current_user = get_current_user(request, db)
    from app.core.capabilities import Capability
    from app.services.authorization_service import AuthorizationService

    capability = Capability.DASHBOARD_VIEW
    if path.endswith("/labs/sync"):
        capability = Capability.CONTENT_MANAGE
    elif path.endswith("/ctf/sync"):
        capability = Capability.CTF_MANAGE
    elif "/organizations/" in path or path.endswith("/organizations/pending") or "/api-keys" in path:
        capability = Capability.SYSTEM_ADMIN
    elif "/users" in path:
        if path.endswith("/export"):
            capability = Capability.REPORT_EXPORT
        elif "/analytics" in path:
            capability = Capability.PROGRESS_VIEW
        elif method == "GET":
            capability = Capability.ROSTER_VIEW
        else:
            capability = Capability.ROSTER_MANAGE
    elif "/groups" in path:
        capability = Capability.ROSTER_VIEW if method == "GET" else Capability.ROSTER_MANAGE
    elif "/assignments" in path:
        capability = Capability.PROGRESS_VIEW if path.endswith("/analytics") else Capability.LAB_ASSIGN
    elif "/allocations" in path:
        capability = Capability.LAB_ASSIGN
    elif any(token in path for token in ["/inventory", "/licenses", "/purchased-labs"]):
        capability = Capability.LAB_PURCHASE
    elif "/sessions" in path:
        capability = Capability.PROGRESS_VIEW if method == "GET" else Capability.LAB_ASSIGN
    elif "/dashboard" in path or "/global-search" in path or "/profile" in path:
        capability = Capability.DASHBOARD_VIEW

    AuthorizationService.require_capability(db, current_user, capability)

    params = request.path_params or {}
    if "assignment_id" in params:
        AuthorizationService.assert_assignment_access(db, current_user, int(params["assignment_id"]), capability)
    if "group_id" in params:
        AuthorizationService.assert_group_access(db, current_user, int(params["group_id"]), capability)
    if "user_id" in params:
        AuthorizationService.assert_user_access(db, current_user, int(params["user_id"]), capability)
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Compatibility dependency for platform-content admin operations."""
    from app.core.capabilities import Capability
    from app.services.authorization_service import AuthorizationService
    return AuthorizationService.require_capability(db, current_user, Capability.CONTENT_MANAGE)


def get_current_system_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    from app.core.capabilities import Capability
    from app.services.authorization_service import AuthorizationService
    return AuthorizationService.require_capability(db, current_user, Capability.SYSTEM_ADMIN)


def get_admin_org_id(user: User, db: Session) -> int:
    """Resolve an active organization scope without creating authorization data."""
    from app.services.authorization_service import AuthorizationService
    return AuthorizationService.primary_organization_id(db, user)
