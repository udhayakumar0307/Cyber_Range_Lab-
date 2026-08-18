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
                "download_url": f"/api/v1/reporting/certificates/{cert.display_certificate_id}/download" if cert.png_path else None,
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

    def evaluate_user_achievements(self, db: Session, user_id: int) -> list:
        """
        Rule Engine: Evaluates all badge thresholds for a user against DB stats.
        Auto-issues distinct certificates for satisfied rules and binds unique display_certificate_id.
        """
        from app.models.user import User
        from app.models.lab import Lab

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []

        total_score = user.total_score or 0

        # Query user completed labs
        completed_labs = (
            db.query(UserLabProgress.lab_id)
            .filter(UserLabProgress.user_id == user_id)
            .distinct()
            .all()
        )
        completed_lab_ids = [l[0] for l in completed_labs]

        # Query all active labs dynamically to auto-create badges for any new or existing lab
        all_labs = db.query(Lab).all()
        dynamic_lab_rules = []
        seen_lab_ids = set()

        for lab_obj in all_labs:
            lid = str(lab_obj.id).lower()
            if lid in seen_lab_ids:
                continue
            seen_lab_ids.add(lid)

            lab_title = (getattr(lab_obj, "name", None) or getattr(lab_obj, "title", None) or lid.replace("-", " ").title())
            is_completed = lid in completed_lab_ids or any(lid in c.lower() for c in completed_lab_ids)

            dynamic_lab_rules.append({
                "id": lid,
                "title": f"{lab_title} Master",
                "description": f"Mastered 100% of the {lab_title} environment.",
                "reward_points": getattr(lab_obj, "max_points", 100) or 100,
                "threshold": 100,
                "unlocked": is_completed
            })

        # Base Milestone Badges
        badge_rules = [
            {
                "id": "first_lab",
                "title": "First Lab",
                "description": "Started and completed your first security lab environment!",
                "reward_points": 50,
                "threshold": 50,
                "unlocked": total_score >= 50 or len(completed_lab_ids) >= 1
            },
            {
                "id": "score_100",
                "title": "Centurion",
                "description": "Earned 100 total points across CyberRange labs!",
                "reward_points": 100,
                "threshold": 100,
                "unlocked": total_score >= 100 or len(completed_lab_ids) >= 1
            },
            {
                "id": "score_250",
                "title": "Defender",
                "description": "Earned 250 total points in practical cyber defense!",
                "reward_points": 250,
                "threshold": 250,
                "unlocked": total_score >= 250
            },
            {
                "id": "score_500",
                "title": "Cyber Master",
                "description": "Mastered 500 total points in complex range environments!",
                "reward_points": 500,
                "threshold": 500,
                "unlocked": total_score >= 500
            },
            {
                "id": "score_1000",
                "title": "Range Champion",
                "description": "Achieved legendary status with 1000 total score points!",
                "reward_points": 1000,
                "threshold": 1000,
                "unlocked": total_score >= 1000
            }
        ] + dynamic_lab_rules

        evaluated_badges = []
        for rule in badge_rules:
            badge_info = {
                "id": rule["id"],
                "title": rule["title"],
                "description": rule["description"],
                "reward_points": rule["reward_points"],
                "unlocked": rule["unlocked"],
                "_threshold": rule["threshold"],
                "display_certificate_id": None,
                "verification_url": None
            }

            if rule["unlocked"]:
                try:
                    cert = certificate_manager.get_or_issue_certificate(
                        db=db,
                        user_id=user_id,
                        lab_id=rule["id"],
                        score=max(rule["reward_points"], total_score),
                        percentage=100,
                        points=rule["reward_points"],
                        duration_seconds=1800
                    )
                    badge_info["display_certificate_id"] = cert.display_certificate_id
                    badge_info["verification_url"] = f"/certificate/verify/{cert.display_certificate_id}"
                except Exception as cert_err:
                    logger.warning(f"Could not issue cert for badge {rule['id']}: {cert_err}")

            evaluated_badges.append(badge_info)

        return evaluated_badges


achievement_manager = AchievementManager()

