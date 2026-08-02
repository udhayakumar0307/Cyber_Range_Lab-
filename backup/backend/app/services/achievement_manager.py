import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.achievement import Achievement
from app.models.user_achievement import UserAchievement
from app.models.user_lab_progress import UserLabProgress
from app.services.certificate_manager import certificate_manager
from app.core.cache import invalidate_dashboard, dashboard_cache

logger = logging.getLogger("achievement_manager")

class AchievementManager:
    """
    Central Orchestration Layer for CyberRange Achievements.
    Evaluates achievement rules, awards badges, triggers certificate generation,
    and synchronizes telemetry.
    """

    def process_lab_completion(
        self,
        db: Session,
        user_id: int,
        lab_id: str,
        score: int = 100,
        completed_at: Optional[datetime] = None
    ) -> dict:
        completed_at = completed_at or datetime.utcnow()

        # 1. Award Lab Completion Achievement / Badge if defined
        ach_id = f"ach-{lab_id}"
        ach = db.query(Achievement).filter(Achievement.id == ach_id).first()
        if not ach:
            ach = Achievement(
                id=ach_id,
                title=f"{lab_id.replace('-', ' ').title()} Master",
                description=f"Successfully completed all modules of {lab_id.replace('-', ' ').title()}.",
                icon="trophy",
                condition=f"complete:{lab_id}",
                reward_points=100
            )
            try:
                db.add(ach)
                db.commit()
            except Exception:
                db.rollback()

        existing_ua = (
            db.query(UserAchievement)
            .filter(UserAchievement.user_id == user_id, UserAchievement.achievement_id == ach_id)
            .first()
        )
        if not existing_ua:
            ua = UserAchievement(
                user_id=user_id,
                achievement_id=ach_id,
                earned_at=completed_at
            )
            try:
                db.add(ua)
                db.commit()
                logger.info(f"Awarded achievement '{ach_id}' to user_id={user_id}")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to award achievement '{ach_id}': {e}")

        # 2. Compute telemetry from UserLabProgress
        progress_rows = (
            db.query(UserLabProgress)
            .filter(UserLabProgress.user_id == user_id, UserLabProgress.lab_id == lab_id)
            .all()
        )
        total_time = sum((p.time_taken_seconds or 0) for p in progress_rows)
        correct_count = sum(1 for p in progress_rows if p.flag_correct)
        total_count = max(1, len(progress_rows))
        percentage = round((correct_count / total_count) * 100) if total_count > 0 else 100

        # 3. Non-blocking Certificate Generation via CertificateManager
        cert_data = None
        try:
            cert = certificate_manager.get_or_issue_certificate(
                db=db,
                user_id=user_id,
                lab_id=lab_id,
                score=score,
                percentage=percentage,
                points=100,
                duration_seconds=total_time,
                completed_at=completed_at
            )
            cert_data = {
                "uuid": cert.uuid,
                "display_certificate_id": cert.display_certificate_id,
                "pdf_path": cert.pdf_path,
                "png_path": cert.png_path,
                "verification_url": f"/certificate/verify/{cert.display_certificate_id}"
            }
        except Exception as cert_err:
            logger.error(f"Non-blocking certificate issuance failed for user_id={user_id}, lab_id={lab_id}: {cert_err}", exc_info=True)

        # 4. Invalidate Caches
        invalidate_dashboard(user_id)

        return {
            "user_id": user_id,
            "lab_id": lab_id,
            "achievement_awarded": ach_id,
            "certificate": cert_data
        }

achievement_manager = AchievementManager()
