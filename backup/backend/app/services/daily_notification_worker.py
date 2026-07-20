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
        for user in db.query(User).filter(User.is_active.is_(True)).all():
            completed = db.query(UserLabProgress).filter(
                UserLabProgress.user_id == user.id, UserLabProgress.status == "COMPLETED"
            ).count()
            notification_service.create_and_send(
                db, user.id, "Daily CyberRange Update",
                f"Progress summary: {completed} completed modules. Check your available and assigned labs.",
                "DAILY_UPDATE", user.phone,
            )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Daily notification worker failed")
    finally:
        db.close()


async def daily_notification_loop() -> None:
    """Runs automatically once per UTC day while this worker process is active."""
    while True:
        now = datetime.utcnow()
        next_run = (now + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
        await asyncio.sleep(max(1, (next_run - now).total_seconds()))
        await run_daily_notifications()
