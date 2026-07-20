"""Production AWS SNS notification delivery and persistent notification audit."""
import json
import logging
from datetime import datetime
from typing import Iterable, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.notification import Notification, NotificationPreference

logger = logging.getLogger(__name__)


class NotificationService:
    def _sns_client(self):
        if not settings.AWS_REGION or not settings.SNS_TOPIC_ARN:
            raise RuntimeError("AWS_REGION and SNS_TOPIC_ARN must be configured for SNS delivery")
        # boto3's standard credential chain supports IAM roles in production. Explicit
        # credentials are used only when supplied through environment variables.
        kwargs = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            kwargs.update(
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
        return boto3.client("sns", **kwargs)

    def create_and_send(self, db: Session, user_id: int, title: str, message: str,
                        notification_type: str, phone_number: Optional[str] = None) -> Notification:
        if not title.strip() or not message.strip() or len(title) > 200:
            raise ValueError("Invalid notification payload")
        event = Notification(user_id=user_id, title=title.strip(), message=message.strip(), type=notification_type)
        db.add(event)
        db.flush()
        preference = db.query(NotificationPreference).filter_by(user_id=user_id).first()
        if not preference:
            preference = NotificationPreference(user_id=user_id, phone_number=phone_number)
            db.add(preference)
            db.flush()

        try:
            client = self._sns_client()
            delivered = False
            # Topic delivery is the supported SNS fan-out channel for email/push subscribers.
            if preference.email_enabled or preference.push_enabled:
                client.publish(
                    TopicArn=settings.SNS_TOPIC_ARN,
                    Subject=title[:100],
                    Message=json.dumps({"user_id": user_id, "title": title, "message": message, "type": notification_type}),
                )
                delivered = True
            if preference.sms_enabled and (preference.phone_number or phone_number):
                client.publish(PhoneNumber=preference.phone_number or phone_number, Message=f"{title}: {message}")
                delivered = True
            event.status = "SENT" if delivered else "PREFERENCE_DISABLED"
        except (RuntimeError, BotoCoreError, ClientError) as exc:
            # The database event is retained as an auditable failed real delivery; no mock success is reported.
            event.status = "FAILED"
            logger.error("SNS notification delivery failed for user_id=%s: %s", user_id, exc)

        db.add(AuditLog(user_id=user_id, action="Notification Event", resource="Notification",
                        resource_id=str(event.id), status=event.status,
                        new_value=f"{notification_type}: {title}"))
        return event

    def notify_users(self, db: Session, users: Iterable, title: str, message: str, notification_type: str):
        return [self.create_and_send(db, user.id, title, message, notification_type, getattr(user, "phone", None)) for user in users]

    def notify_administrators(self, db: Session, title: str, message: str, notification_type: str):
        """Use from payment, container telemetry, resource monitoring, and security alert workers."""
        from app.models.user import User
        admins = db.query(User).filter(User.is_active.is_(True), User.role.in_(["admin", "SYSTEM_ADMIN"])).all()
        return self.notify_users(db, admins, title, message, notification_type)


notification_service = NotificationService()
