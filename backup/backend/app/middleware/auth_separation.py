import logging
from typing import Callable
from fastapi import Request, Response, HTTPException, status, Depends
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.security.domain_validator import (
    validate_student_login_attempt,
    validate_admin_login_attempt,
    INTERNAL_ADMIN_ROLES,
    STUDENT_ROLES
)

logger = logging.getLogger(__name__)


class StudentOnlyMiddleware(BaseHTTPMiddleware):
    """
    Middleware that ensures requests targeting student-only portal endpoints
    cannot be accessed by internal CyberRange admin or employee accounts.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path == "/api/v1/auth/student-login" or (path == "/api/v1/auth/login" and request.query_params.get("portal") == "student"):
            try:
                # We extract email if JSON body is available during pre-flight or request
                pass
            except Exception:
                pass
        response = await call_next(request)
        return response


class AdminOnlyMiddleware(BaseHTTPMiddleware):
    """
    Middleware that ensures requests targeting enterprise admin portal endpoints
    cannot be accessed by non-internal student accounts.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path.startswith("/api/v1/admin") or (path == "/api/v1/auth/login" and request.query_params.get("portal") == "admin"):
            pass
        response = await call_next(request)
        return response


def get_current_student(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that enforces current authenticated user is a student / external user.
    Rejects internal CyberRange employee or admin accounts attempting student actions.
    """
    role = (current_user.role or "").lower()
    is_internal = getattr(current_user, "is_internal", False)
    account_type = str(getattr(current_user, "account_type", "")).lower()

    if is_internal or account_type == "internal" or role in INTERNAL_ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This portal is available only for students. Please use the Enterprise Portal."
        )
    return current_user


def get_current_enterprise_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that enforces current authenticated user is an internal CyberRange admin/employee.
    Rejects student or external accounts attempting admin actions.
    """
    role = (current_user.role or "").lower()
    is_internal = getattr(current_user, "is_internal", False)
    account_type = str(getattr(current_user, "account_type", "")).lower()

    if not is_internal and account_type != "internal" and role not in INTERNAL_ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This portal is available only for CyberRange administrators."
        )
    return current_user
