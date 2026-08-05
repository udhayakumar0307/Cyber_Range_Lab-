import asyncio
import logging
from datetime import datetime
from app.database.session import SessionLocal
from app.models.study_session import StudySession
from app.models.admin_models import PurchasedLab, License
from app.models.user import User

logger = logging.getLogger("LabTimerManager")

async def run_lab_timer_manager():
    logger.info("[+] Active Lab Container timer check loop started.")
    while True:
        # Step 1: Query active session IDs in a short-lived read transaction
        db = SessionLocal()
        active_session_ids = []
        try:
            active_sessions = db.query(StudySession.id).filter(StudySession.logout_time.is_(None)).all()
            active_session_ids = [s[0] for s in active_sessions]
        except Exception as e:
            logger.error(f"Error querying active sessions: {e}")
        finally:
            db.close()

        # Step 2: Process each active session within its own isolated transaction
        deduct_hours = 30.0 / 3600.0  # 30 seconds of execution
        for session_id in active_session_ids:
            db = SessionLocal()
            try:
                s = db.query(StudySession).filter(StudySession.id == session_id).first()
                if not s or s.logout_time is not None:
                    continue

                if s.lab_id:
                    pl = db.query(PurchasedLab).filter(
                        PurchasedLab.lab_id == s.lab_id,
                        PurchasedLab.hours_remaining > 0
                    ).first()
                    
                    if pl:
                        pl.hours_used = (pl.hours_used or 0.0) + deduct_hours
                        pl.hours_remaining = max(0.0, (pl.hours_remaining or 0.0) - deduct_hours)
                        logger.debug(f"Deducted {deduct_hours} hours from PurchasedLab '{s.lab_id}'. Remaining: {pl.hours_remaining}")

                        if pl.hours_remaining <= 0.0:
                            s.logout_time = datetime.utcnow()
                            s.duration_minutes = (s.logout_time - s.login_time).total_seconds() / 60.0
                            logger.warning(f"Session #{s.id} terminated: PurchasedLab out of remaining hours.")
                            
                    # Update individual license remaining hours
                    user = db.query(User).filter(User.id == s.user_id).first() if hasattr(s, 'user_id') else None
                    if user:
                        lic = db.query(License).filter(
                            License.allocated_user_email == user.email,
                            License.hours_remaining > 0
                        ).first() if hasattr(License, 'hours_remaining') else None
                        
                        if lic:
                            lic.hours_used = (lic.hours_used or 0.0) + deduct_hours
                            lic.hours_remaining = max(0.0, (lic.hours_remaining or 0.0) - deduct_hours)
                
                db.commit()
            except Exception as session_err:
                db.rollback()
                logger.error(f"Failed to deduct hours for session #{session_id}: {session_err}")
            finally:
                db.close()

        await asyncio.sleep(30) # Evaluates running session container usage every 30 seconds
