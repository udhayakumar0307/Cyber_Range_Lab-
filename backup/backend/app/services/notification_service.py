"""
Production Notification Service (AWS SES + AWS SNS + WebSocket Realtime Broadcast)
================================================================================
Centralized event-driven notification engine for CyberRange.

Channels:
  1. In-App Notification (Persistent database audit, read state, real-time WebSocket fanout)
  2. Amazon SES Email (Branded HTML templates with fallback retry mechanism)
  3. Amazon SNS SMS (SMS notifications for high priority and user opted-in alerts)
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Set

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.notification import Notification, NotificationPreference
from app.models.user import User

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------------------
# In-Memory WebSocket Connection Manager for Real-Time Notification Delivery
# ------------------------------------------------------------------------------
class NotificationConnectionManager:
    """Manages active WebSocket connections mapped to user IDs."""

    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"[WebSocket] Notification socket connected for user_id={user_id}")

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"[WebSocket] Notification socket disconnected for user_id={user_id}")

    async def send_personal_notification(self, user_id: int, payload: Dict[str, Any]):
        if user_id in self.active_connections:
            dead_sockets = set()
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(payload)
                except Exception as exc:
                    logger.warning(f"[WebSocket] Error pushing to user {user_id}: {exc}")
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.disconnect(user_id, ws)

    async def broadcast_to_roles(self, roles: List[str], payload: Dict[str, Any], db: Session):
        users = db.query(User).filter(User.role.in_(roles), User.is_active.is_(True)).all()
        for u in users:
            await self.send_personal_notification(u.id, payload)


ws_manager = NotificationConnectionManager()


# ------------------------------------------------------------------------------
# Core Enterprise Notification Service
# ------------------------------------------------------------------------------
class NotificationService:
    """Enterprise Notification Pipeline handling In-App, SES, SNS & WS delivery."""

    def _sns_client(self):
        if not settings.AWS_REGION or not settings.SNS_TOPIC_ARN:
            raise RuntimeError("AWS_REGION and SNS_TOPIC_ARN must be configured for SNS delivery")
        kwargs = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            kwargs.update(
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
        return boto3.client("sns", **kwargs)

    def _ses_client(self):
        if not settings.AWS_REGION:
            raise RuntimeError("AWS_REGION must be configured for SES delivery")
        kwargs = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            kwargs.update(
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
        return boto3.client("ses", **kwargs)

    def _build_html_email(self, title: str, message: str, action_url: Optional[str] = None, priority: str = "MEDIUM", action_label: str = "Open CyberRange") -> str:
        """Renders branded CyberRange Enterprise HTML email template."""
        badge_color = "#0052CC"
        if priority.upper() in ["HIGH", "CRITICAL"]:
            badge_color = "#DC2626"
        elif priority.upper() == "LOW":
            badge_color = "#16A34A"

        action_btn_html = ""
        if action_url:
            full_url = action_url if action_url.startswith("http") else f"https://academy.deeptrustxai.com{action_url}"
            action_btn_html = f"""
            <div style="margin-top: 25px; text-align: center;">
                <a href="{full_url}" style="background-color: #0052CC; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">{action_label}</a>
            </div>
            """

        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <!-- Header -->
        <div style="background: #0f172a; padding: 24px; text-align: center; border-bottom: 3px solid #0052CC;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">CyberRange Enterprise</h1>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 12px;">Official Security & Learning Alert</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 32px 28px;">
            <div style="display: inline-block; background-color: {badge_color}15; color: {badge_color}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">
                {priority} Priority Notification
            </div>
            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">{title}</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0;">{message}</p>
            {action_btn_html}
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
            <p style="margin: 0;">Automated Notification System • CyberRange Inc.</p>
            <p style="margin: 4px 0 0 0;">Do not reply directly to this automated security dispatch.</p>
        </div>
    </div>
</body>
</html>"""

    def send_ses_email(self, to_email: str, title: str, message: str, action_url: Optional[str] = None, priority: str = "MEDIUM", action_label: str = "Open CyberRange") -> bool:
        """Dispatches HTML email via Amazon SES."""
        if not settings.SES_FROM_EMAIL:
            logger.warning("SES_FROM_EMAIL unconfigured, skipping Amazon SES dispatch.")
            return False
        try:
            client = self._ses_client()
            html_content = self._build_html_email(title, message, action_url, priority, action_label)
            client.send_email(
                Source=settings.SES_FROM_EMAIL,
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Data": f"[CyberRange Alert] {title}"},
                    "Body": {
                        "Text": {"Data": f"{title}\n\n{message}"},
                        "Html": {"Data": html_content}
                    }
                }
            )
            logger.info(f"[Amazon SES] Email delivered to {to_email}")
            return True
        except Exception as exc:
            logger.error(f"[Amazon SES] Failed email dispatch to {to_email}: {exc}")
            return False

    def send_sns_sms(self, phone_number: str, title: str, message: str) -> bool:
        """Dispatches SMS alert via Amazon SNS."""
        if not phone_number or not settings.SNS_TOPIC_ARN:
            return False
        try:
            client = self._sns_client()
            client.publish(
                PhoneNumber=phone_number,
                Message=f"[CyberRange Alert] {title}: {message[:140]}"
            )
            logger.info(f"[Amazon SNS] SMS sent to {phone_number}")
            return True
        except Exception as exc:
            logger.error(f"[Amazon SNS] Failed SMS dispatch to {phone_number}: {exc}")
            return False

    def create_and_send(
        self,
        db: Session,
        user_id: int,
        title: str,
        message: str,
        notification_type: str = "SYSTEM",
        priority: str = "MEDIUM",
        action_url: Optional[str] = None,
        phone_number: Optional[str] = None,
        recipient_role: Optional[str] = None,
        meta_data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """
        Creates persistent DB notification and dispatches to enabled delivery channels:
        In-App DB + WebSocket + Amazon SES Email + Amazon SNS SMS.
        """
        if not title.strip() or not message.strip() or len(title) > 200:
            raise ValueError("Invalid notification payload")

        # 1. Fetch user & preference
        user = db.query(User).filter(User.id == user_id).first()
        user_role = recipient_role or (user.role if user else "user")
        
        pref = db.query(NotificationPreference).filter_by(user_id=user_id).first()
        if not pref:
            pref = NotificationPreference(user_id=user_id, email_enabled=True, sms_enabled=False, push_enabled=True, phone_number=phone_number)
            db.add(pref)
            db.flush()

        # 2. Store DB Notification
        event = Notification(
            user_id=user_id,
            recipient_role=user_role,
            title=title.strip(),
            message=message.strip(),
            type=notification_type,
            priority=priority.upper(),
            action_url=action_url,
            read=False,
            status="DELIVERED",
            email_sent=False,
            sms_sent=False,
            meta_data=meta_data,
            soft_deleted=False
        )
        db.add(event)
        db.flush()

        # 3. Channel 1: SES Email Delivery
        if pref.email_enabled and user and user.email:
            event.email_sent = self.send_ses_email(user.email, title, message, action_url, priority)

        # 4. Channel 2: SNS SMS Delivery (High priority or user opted-in)
        target_phone = pref.phone_number or phone_number or getattr(user, "phone", None)
        if pref.sms_enabled and target_phone:
            event.sms_sent = self.send_sns_sms(target_phone, title, message)

        # 5. Record Audit Log
        db.add(
            AuditLog(
                user_id=user_id,
                action="Notification Event",
                resource="Notification",
                resource_id=str(event.id),
                status=event.status,
                new_value=f"{notification_type} [{priority}]: {title}"
            )
        )
        db.commit()

        # 6. Channel 3: Real-Time WebSocket Push (Async non-blocking attempt)
        try:
            import asyncio
            payload = {
                "type": "NEW_NOTIFICATION",
                "notification": {
                    "id": event.id,
                    "title": event.title,
                    "message": event.message,
                    "type": event.type,
                    "priority": event.priority,
                    "action_url": event.action_url,
                    "read": False,
                    "created_at": event.created_at.isoformat() if event.created_at else datetime.utcnow().isoformat()
                }
            }
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(ws_manager.send_personal_notification(user_id, payload))
        except Exception as exc:
            logger.debug(f"Async WS push deferred: {exc}")

        return event

    def notify_users(self, db: Session, users: Iterable, title: str, message: str, notification_type: str = "SYSTEM", priority: str = "MEDIUM", action_url: Optional[str] = None):
        return [
            self.create_and_send(
                db=db,
                user_id=u.id,
                title=title,
                message=message,
                notification_type=notification_type,
                priority=priority,
                action_url=action_url,
                phone_number=getattr(u, "phone", None),
                recipient_role=getattr(u, "role", "user")
            )
            for u in users
        ]

    def notify_administrators(self, db: Session, title: str, message: str, notification_type: str = "ADMIN_ALERT", priority: str = "HIGH", action_url: Optional[str] = None):
        """Dispatches alerts to all system administrators."""
        admins = db.query(User).filter(User.is_active.is_(True), User.role.in_(["admin", "system_admin", "super_admin", "SYSTEM_ADMIN"])).all()
        return self.notify_users(db, admins, title, message, notification_type, priority, action_url)


notification_service = NotificationService()
