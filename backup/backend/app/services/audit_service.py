import logging
from typing import Optional, Any
from fastapi import Request
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

def parse_user_agent(user_agent: str) -> tuple[str, str]:
    """Simple parser for browser and operating system from User-Agent string."""
    browser = "Unknown Browser"
    os_name = "Unknown OS"
    if not user_agent:
        return browser, os_name

    ua_lower = user_agent.lower()
    if "edg" in ua_lower:
        browser = "Microsoft Edge"
    elif "chrome" in ua_lower:
        browser = "Google Chrome"
    elif "firefox" in ua_lower:
        browser = "Mozilla Firefox"
    elif "safari" in ua_lower:
        browser = "Apple Safari"
    else:
        browser = user_agent.split("/")[0] if "/" in user_agent else "Browser"

    if "windows" in ua_lower:
        os_name = "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        os_name = "macOS"
    elif "linux" in ua_lower:
        os_name = "Linux"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        os_name = "iOS"

    return browser, os_name

def log_audit_event(
    db: Session,
    action: str,
    entity: Optional[str] = None,
    entity_id: Optional[Any] = None,
    performed_by: Optional[str] = None,
    performed_by_role: Optional[str] = None,
    organization_id: Optional[int] = None,
    user_id: Optional[int] = None,
    status: str = "SUCCESS",
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    request: Optional[Request] = None
) -> Optional[AuditLog]:
    """Creates and persists an AuditLog entry."""
    try:
        ip_address = None
        browser = None
        operating_system = None
        request_method = None
        endpoint = None

        if request:
            ip_address = request.client.host if request.client else None
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                ip_address = forwarded.split(",")[0].strip()

            ua_string = request.headers.get("user-agent", "")
            browser, operating_system = parse_user_agent(ua_string)
            request_method = request.method
            endpoint = str(request.url.path)

        audit_entry = AuditLog(
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            performed_by=performed_by,
            performed_by_role=performed_by_role,
            organization_id=organization_id,
            user_id=user_id,
            ip_address=ip_address,
            browser=browser,
            operating_system=operating_system,
            request_method=request_method,
            endpoint=endpoint,
            status=status,
            old_value=old_value,
            new_value=new_value,
            resource=entity,
            resource_id=str(entity_id) if entity_id is not None else None,
            device=operating_system
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry
    except Exception as e:
        logger.error(f"Failed to record audit log event ({action}): {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
        return None
