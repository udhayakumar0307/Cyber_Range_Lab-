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
    Check if email domain is permitted for Student Portal login.
    Admin domains (e.g. cyberrange.in) are strictly disallowed on Student Portal.
    """
    domain = extract_domain(email)
    if not domain:
        return False
    
    # Internal admin domains are strictly blocked for student portal
    if is_admin_domain(email):
        return False
        
    student_patterns = settings.STUDENT_ALLOWED_DOMAINS
    return match_domain_pattern(domain, student_patterns)


def validate_student_login_attempt(email: str, user: Optional[object] = None) -> None:
    """
    Validates a login attempt at the Student Portal (http://localhost:5173/login).
    
    Blocked:
    - @cyberrange.in accounts
    - Internal employees / Super Admin / Platform Admin / Security Admin / Support / Ops
    
    Returns 403 Forbidden with exact business error message if blocked.
    """
    email_clean = email.strip().lower() if email else ""
    
    # 1. Domain Check
    if is_admin_domain(email_clean):
        logger.warning(f"Student Portal login blocked for internal admin domain: {email_clean}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This portal is available only for students. Please use the Enterprise Portal."
        )

    if not is_student_domain_allowed(email_clean):
        logger.warning(f"Student Portal login blocked for disallowed domain: {email_clean}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This portal is available only for students. Please use the Enterprise Portal."
        )

    # 2. Database User Inspection (if user exists)
    if user is not None:
        role = str(getattr(user, "role", "")).lower()
        if role == "system_admin":
            logger.info(f"Bypassing student login validation for System Admin user: {email_clean}")
            return

        is_internal = getattr(user, "is_internal", False)
        account_type = str(getattr(user, "account_type", "")).lower()
        
        if is_internal or account_type == "internal" or role in INTERNAL_ADMIN_ROLES:
            logger.warning(f"Student Portal login rejected for internal user record: id={getattr(user, 'id', None)} email={email_clean} role={role}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This portal is available only for students. Please use the Enterprise Portal."
            )


def validate_admin_login_attempt(email: str, user: Optional[object] = None) -> None:
    """
    Validates a login attempt at the Academic Admin Portal.
    
    Allowed:
    - @cyberrange.in internal accounts
    - College/University domains (.ac.in, .edu, .edu.in, .ac.uk, .edu.sg, .ac.jp, .edu.au)
    
    Blocked:
    - Gmail / Yahoo / Outlook / Personal emails / other non-academic domains
    
    Returns 403 Forbidden with exact business error message if blocked.
    """
    email_clean = email.strip().lower() if email else ""
    
    # 1. Suffix and Domain Check
    email_domain = email_clean.split("@")[-1] if "@" in email_clean else ""
    academic_suffixes = [".edu", ".ac.in", ".edu.in", ".ac.uk", ".edu.sg", ".ac.jp", ".edu.au"]
    is_cyberrange = email_domain == "cyberrange.in"
    is_academic = any(email_domain.endswith(suffix) or "college" in email_domain or "univ" in email_domain for suffix in academic_suffixes)

    if not is_cyberrange and not is_academic:
        logger.warning(f"Admin Portal login blocked for non-admin/non-academic domain: {email_clean}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only CyberRange employees or verified academic institutions can access this portal."
        )

    # 2. Database User Inspection (if user exists)
    if user is not None:
        role = str(getattr(user, "role", "")).lower()
        if role not in ["admin", "system_admin"]:
            logger.warning(f"Admin Portal login rejected for non-admin user record: id={getattr(user, 'id', None)} email={email_clean} role={role}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only CyberRange employees or verified academic institutions can access this portal."
            )
