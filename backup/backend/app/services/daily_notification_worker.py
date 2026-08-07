"""In-process daily worker. For multi-instance production, schedule the same job through
AWS EventBridge Scheduler to the protected worker endpoint instead of enabling it on
every replica."""
import asyncio
import logging
from datetime import datetime, timedelta
from app.database.manager import db_manager
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


async def run_daily_notifications() -> None:
    db = db_manager.get_session()
    try:
        now = datetime.utcnow()
        today_date = now.date()

        # 1. User Daily Digest & Milestone/Lab Due Reminders
        for user in db.query(User).filter(User.is_active.is_(True)).all():
            completed = db.query(UserLabProgress).filter(
                UserLabProgress.user_id == user.id, UserLabProgress.status == "COMPLETED"
            ).count()
            in_progress = db.query(UserLabProgress).filter(
                UserLabProgress.user_id == user.id, UserLabProgress.status == "IN_PROGRESS"
            ).count()

            if in_progress > 0:
                notification_service.create_and_send(
                    db=db,
                    user_id=user.id,
                    title="In-Progress Lab Reminder",
                    message=f"You have {in_progress} active lab session(s) in progress. Resume your work to maintain your streak!",
                    notification_type="LAB_DUE",
                    priority="MEDIUM",
                    action_url="/labs",
                    phone_number=user.phone
                )

        # 2. License Expiry & Renewal Alerts (30 Days, 7 Days, 1 Day, Expired Today)
        from app.models.admin_models import PurchasedLab
        purchased_labs = db.query(PurchasedLab).filter(PurchasedLab.status == "ACTIVE").all()

        for lab in purchased_labs:
            if not lab.expiry_date:
                continue
            days_left = (lab.expiry_date.date() - today_date).days

            if days_left == 30:
                notification_service.create_and_send(
                    db=db, user_id=lab.user_id, title="License Expiring in 30 Days",
                    message=f"Your license key {lab.license_key} for '{lab.lab_title}' will expire in 30 days.",
                    notification_type="LICENSE_EXPIRY", priority="MEDIUM", action_url="/admin/purchased-labs"
                )
            elif days_left == 7:
                notification_service.create_and_send(
                    db=db, user_id=lab.user_id, title="License Expiring in 7 Days",
                    message=f"Urgent: Your license key {lab.license_key} for '{lab.lab_title}' expires in 7 days.",
                    notification_type="LICENSE_EXPIRY", priority="HIGH", action_url="/admin/purchased-labs"
                )
            elif days_left == 1:
                notification_service.create_and_send(
                    db=db, user_id=lab.user_id, title="License Expires Tomorrow",
                    message=f"Critical: License key {lab.license_key} for '{lab.lab_title}' expires tomorrow!",
                    notification_type="LICENSE_EXPIRY", priority="CRITICAL", action_url="/admin/purchased-labs"
                )
            elif days_left <= 0:
                lab.status = "EXPIRED"
                notification_service.create_and_send(
                    db=db, user_id=lab.user_id, title="License Expired Today",
                    message=f"License key {lab.license_key} for '{lab.lab_title}' has expired and been deactivated.",
                    notification_type="LICENSE_EXPIRY", priority="HIGH", action_url="/admin/purchased-labs"
                )
                logger.info(f"[Background Job] Automatically deactivated expired lab license {lab.license_key}")

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Daily notification and license expiry worker failed")
    finally:
        db.close()


async def daily_notification_loop() -> None:
    """Runs automatically once per UTC day while this worker process is active."""
    while True:
        now = datetime.utcnow()
        next_run = (now + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
        await asyncio.sleep(max(1, (next_run - now).total_seconds()))
        await run_daily_notifications()


async def check_assignment_reminders() -> None:
    from app.models.assignment import Assignment
    from app.models.notification import Notification
    from app.models.user import User
    from app.services.ses_service import ses_service
    from sqlalchemy import not_, or_, func

    db = db_manager.get_session()
    try:
        now = datetime.now()
        active_assigns = db.query(Assignment).filter(
            or_(Assignment.status != "Completed", Assignment.status.is_(None))
        ).all()

        for a in active_assigns:
            users = []
            if a.group_id:
                users = db.query(User).filter(
                    User.group_id == a.group_id,
                    User.is_active.is_(True),
                    not_(or_(func.lower(User.role) == "super_admin", func.lower(User.role) == "system_admin", func.lower(User.role) == "sysadmin"))
                ).all()
            elif a.student_id:
                u = db.query(User).filter(User.id == a.student_id, User.is_active.is_(True)).first()
                if u:
                    users = [u]

            for user in users:
                # Starting notifications and 15m reminders removed per user request.
                # Only direct notification on creation is sent.
                pass

    except Exception:
        db.rollback()
        logger.exception("check_assignment_reminders failed")
    finally:
        db.close()


async def assignment_reminder_loop() -> None:
    """Runs every 60 seconds to check for upcoming or starting lab assignments."""
    while True:
        await check_assignment_reminders()
        await asyncio.sleep(60)
