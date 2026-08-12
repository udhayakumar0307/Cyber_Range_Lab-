import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.database.manager import db_manager
from app.models.ctf import CTF, CTFParticipation, CTFChallenge
from app.models.user import User
from app.ws.ctf_ws import ctf_ws_manager
from app.services.ctf_scoring import recalculate_dynamic_scores

logger = logging.getLogger(__name__)

async def activate_scheduled_ctfs() -> None:
    db: Session = db_manager.get_session()
    try:
        now = datetime.utcnow()
        scheduled_ctfs = db.query(CTF).filter(
            CTF.status == "scheduled",
            CTF.start_time <= now
        ).all()

        if scheduled_ctfs:
            logger.info(f"[CTF Job] Found {len(scheduled_ctfs)} scheduled CTF(s) to activate.")

        for ctf in scheduled_ctfs:
            ctf.status = "active"
            # Auto-enroll all active student users
            students = db.query(User).filter(
                User.role == "user",
                User.is_active.is_(True)
            ).all()

            for student in students:
                existing = db.query(CTFParticipation).filter(
                    CTFParticipation.ctf_id == ctf.id,
                    CTFParticipation.participant_id == student.id
                ).first()
                if not existing:
                    p = CTFParticipation(
                        ctf_id=ctf.id,
                        participant_id=student.id,
                        total_points=0,
                        solve_count=0
                    )
                    db.add(p)
            
            logger.info(f"[CTF Job] Activated CTF '{ctf.title}' (ID: {ctf.id}) and enrolled {len(students)} students.")
            
            # Broadcast ctf_started event
            try:
                await ctf_ws_manager.broadcast(ctf.id, {"type": "ctf_started"})
            except Exception as ws_err:
                logger.warning(f"[CTF Job] Failed to broadcast ctf_started: {ws_err}")

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception(f"[CTF Job] activate_scheduled_ctfs failed: {exc}")
    finally:
        db.close()


async def expire_ended_ctfs() -> None:
    db: Session = db_manager.get_session()
    try:
        now = datetime.utcnow()
        active_ctfs = db.query(CTF).filter(
            CTF.status == "active",
            CTF.end_time <= now
        ).all()

        if active_ctfs:
            logger.info(f"[CTF Job] Found {len(active_ctfs)} active CTF(s) to expire.")

        for ctf in active_ctfs:
            ctf.status = "completed"
            
            # Deactivate challenge URLs
            challenges = db.query(CTFChallenge).filter(CTFChallenge.ctf_id == ctf.id).all()
            for ch in challenges:
                ch.url_active = False

            logger.info(f"[CTF Job] Expired CTF '{ctf.title}' (ID: {ctf.id}) and deactivated {len(challenges)} challenge URLs.")
            
            # Broadcast ctf_ended event
            try:
                await ctf_ws_manager.broadcast(ctf.id, {"type": "ctf_ended"})
            except Exception as ws_err:
                logger.warning(f"[CTF Job] Failed to broadcast ctf_ended: {ws_err}")

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception(f"[CTF Job] expire_ended_ctfs failed: {exc}")
    finally:
        db.close()


def recalculate_dynamic_scores_task(challenge_id: int) -> None:
    """FastAPI BackgroundTasks callable to recalculate dynamic challenge scores."""
    db: Session = db_manager.get_session()
    try:
        recalculate_dynamic_scores(db, challenge_id)
        db.commit()
        
        ch = db.query(CTFChallenge).filter(CTFChallenge.id == challenge_id).first()
        if ch:
            # Broadcast updated leaderboard
            from app.api.v1.endpoints.ctf_api import _broadcast_leaderboard_sync
            _broadcast_leaderboard_sync(db, ch.ctf_id)
    except Exception as exc:
        db.rollback()
        logger.exception(f"[CTF Recalc Job] Failed to recalculate score for challenge {challenge_id}: {exc}")
    finally:
        db.close()


async def ctf_scheduler_loop() -> None:
    """Runs every 60 seconds to activate/expire CTF events."""
    logger.info("[CTF Job] Starting CTF background scheduler loop...")
    while True:
        try:
            await activate_scheduled_ctfs()
            await expire_ended_ctfs()
        except Exception as exc:
            logger.exception(f"[CTF Job] Scheduler iteration failed: {exc}")
        await asyncio.sleep(60)
