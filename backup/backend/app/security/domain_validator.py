import re
import fnmatch
import logging
from typing import Optional, List
from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger(__name__)

# Roles categorized by domain and access isolation
INTERNAL_ADMIN_ROLES = {
    "super_admin",
    "cyberrange_super_admin",
    "platform_admin",
    "security_admin",
    "support_engineer",
    "cyberrange_support",
    "operations_team",
    "admin",
    "cyberrange_admin"
}

STUDENT_ROLES = {
    "student",
    "user",
    "individual",
    "instructor",
    "college_admin"
}


def extract_domain(email: str) -> str:
    """
    Extract normalized domain name from email string.
    Returns lowercase domain string or empty string if invalid.
    """
    if not email or "@" not in email:
        return ""
    parts = email.strip().split("@")
    if len(parts) != 2:
        return ""
    return parts[1].strip().lower()


def match_domain_pattern(domain: str, allowed_patterns: List[str]) -> bool:
    """
    Check if a domain matches any allowed pattern string.
    Supports exact matching ('gmail.com') and wildcard suffix patterns ('*.edu', '*.ac.in').
    """
    if not domain or not allowed_patterns:
        return False
    
    domain = domain.lower()
    for pattern in allowed_patterns:
        pat = pattern.strip().lower()
        if not pat:
            continue
        if pat == domain:
            return True
        if pat.startswith("*."):
            suffix = pat[1:]  # e.g. '.edu' or '.ac.in'
            if domain.endswith(suffix) or domain == pat[2:]:
                return True
        elif fnmatch.fnmatch(domain, pat):
            return True
    return False


def is_admin_domain(email: str) -> bool:
    """
    Check if email domain belongs to configured CyberRange admin domains (e.g. cyberrange.in).
    """
    domain = extract_domain(email)
    admin_domains = settings.ADMIN_ALLOWED_DOMAINS
    return match_domain_pattern(domain, admin_domains)


def is_student_domain_allowed(email: str) -> bool:
    """
    Allow any email domain for students.
    """
    return True


def validate_student_login_attempt(email: str, user: Optional[object] = None) -> None:
    """
    Validates a login attempt at the Student Portal.
    """
    if user is not None:
        status_val = getattr(user, "account_status", "active")
        if status_val and status_val.lower() == "blocked":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been blocked. Please contact support."
            )


def validate_admin_login_attempt(email: str, user: Optional[object] = None) -> None:
    """
    Validates a login attempt at the Administrative Portal.
    """
    if user is not None:
        role = str(getattr(user, "role", "")).lower()
        if role not in ["admin", "system_admin", "super_admin", "professor", "ta", "organization_admin"]:
            logger.warning(f"Admin Portal login rejected for user: id={getattr(user, 'id', None)} role={role}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrative accounts can access this portal."
            )




