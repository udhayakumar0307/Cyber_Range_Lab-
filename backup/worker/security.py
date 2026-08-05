import asyncio
import logging
from datetime import datetime, timedelta
from app.database.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.security_alert import SecurityAlert
from app.models.user import User

logger = logging.getLogger("SecurityWorker")

async def run_security_monitor():
    logger.info("[+] Security Intrusion Detection worker loop started.")
    while True:
        db = SessionLocal()
        try:
            # 1. DDoS Telemetry Check (Rate limit violations check)
            # Find any IP with abnormally high request frequency in the last 2 minutes
            two_mins_ago = datetime.utcnow() - timedelta(minutes=2)
            from sqlalchemy import func
            ddos_checks = db.query(
                AuditLog.ip_address, func.count(AuditLog.id).label("req_count")
            ).filter(
                AuditLog.timestamp >= two_mins_ago
            ).group_by(
                AuditLog.ip_address
            ).all()

            for ip, count in ddos_checks:
                if ip and ip != "Local" and count > 150: # Trigger alert threshold
                    # Check if alert already exists to prevent duplicate spamming
                    existing = db.query(SecurityAlert).filter(
                        SecurityAlert.alert_type == "DDoS / Rate Limit Abuse",
                        SecurityAlert.source_ip == ip,
                        SecurityAlert.status == "UNRESOLVED"
                    ).first()

                    if not existing:
                        alert = SecurityAlert(
                            alert_type="DDoS / Rate Limit Abuse",
                            severity="HIGH",
                            source_ip=ip,
                            description=f"IP address {ip} triggered {count} audit requests in the last 2 minutes. Potential DDoS or scrape attack.",
                            status="UNRESOLVED"
                        )
                        db.add(alert)
                        db.commit()
                        logger.warning(f"[!] DDoS Security Alert created for IP: {ip}")

            # 2. RBAC Privilege Escalation Check
            # Check for non-admin accounts executing admin endpoints
            violations = db.query(AuditLog).filter(
                AuditLog.timestamp >= two_mins_ago,
                AuditLog.endpoint.ilike("/api/v1/system/%"),
                AuditLog.performed_by_role.in_(["user", "USER", "student", "STUDENT"])
            ).all()

            for v in violations:
                existing = db.query(SecurityAlert).filter(
                    SecurityAlert.alert_type == "RBAC Privilege Violation",
                    SecurityAlert.user_email == v.performed_by,
                    SecurityAlert.status == "UNRESOLVED"
                ).first()

                if not existing:
                    alert = SecurityAlert(
                        alert_type="RBAC Privilege Violation",
                        severity="CRITICAL",
                        source_ip=v.ip_address,
                        user_email=v.performed_by,
                        description=f"Student account {v.performed_by} attempted unauthorized privilege access to sysadmin endpoint: {v.endpoint}.",
                        status="UNRESOLVED"
                    )
                    db.add(alert)
                    db.commit()
                    logger.warning(f"[!] Privilege Violation Alert created for user: {v.performed_by}")

        except Exception as e:
            logger.error(f"Error in Security Telemetry Monitor loop: {e}")
        finally:
            db.close()

        await asyncio.sleep(20) # Scans every 20 seconds
