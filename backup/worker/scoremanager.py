import asyncio
import logging
from app.database.session import SessionLocal
from sqlalchemy import func
from app.models.user_lab_progress import UserLabProgress
from app.models.user import User

logger = logging.getLogger("ScoreEvaluator")

async def run_score_evaluator():
    logger.info("[+] Live Score submission progress evaluator started.")
    while True:
        db = SessionLocal()
        try:
            # Audit student lab scores and sync overall User achievements/XP in real-time
            students = db.query(User).filter(User.role == "user").all()
            for student in students:
                total_sum = db.query(func.sum(UserLabProgress.score)).filter(
                    UserLabProgress.user_id == student.id,
                    UserLabProgress.status == "COMPLETED"
                ).scalar() or 0

                if student.total_score != total_sum:
                    student.total_score = total_sum
                    logger.info(f"[+] Synced total XP score for student {student.email} to {student.total_score} points.")
            
            db.commit()
        except Exception as e:
            logger.error(f"Error in Score Evaluator loop: {e}")
        finally:
            db.close()

        await asyncio.sleep(45) # Runs every 45 seconds
