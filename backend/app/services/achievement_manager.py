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

    def evaluate_user_rules(self, db: Session, user_id: int) -> list[str]:
        """
        Loads certificate rules from config and evaluates both profile score milestones
        and lab completions dynamically, awarding achievements and issuing certificates.
        """
        import os
        import json
        from app.models.user import User
        from app.models.lab import Lab
        from app.models.lab_module import LabModule
        from app.models.user_lab_progress import UserLabProgress
        from app.models.achievement import Achievement
        from app.models.user_achievement import UserAchievement
        from app.models.certificate import Certificate

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        rules_path = os.path.join(base_dir, "core", "certificate_rules.json")
        
        if not os.path.exists(rules_path):
            logger.error(f"Rules config not found at {rules_path}")
            return []
            
        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                rules_cfg = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load certificate rules: {e}")
            return []
            
        rules = rules_cfg.get("rules", {})
        
        # Fetch user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
            
        total_score = user.total_score or 0
        
        # Query all completed lab progress for this user
        progress_rows = (
            db.query(UserLabProgress)
            .filter(UserLabProgress.user_id == user_id, UserLabProgress.status == "COMPLETED")
            .all()
        )
        
        # Group completed modules by lab_id
        completed_modules_by_lab = {}
        for p in progress_rows:
            completed_modules_by_lab.setdefault(p.lab_id, set()).add(p.module_id)
            
        # Get total modules count per lab from DB
        lab_modules_counts = {}
        all_modules = db.query(LabModule.lab_id, LabModule.id).all()
        for lab_id, mod_id in all_modules:
            lab_modules_counts.setdefault(lab_id, set()).add(mod_id)

        awarded_this_run = []
        
        for ach_id, rule in rules.items():
            trigger_type = rule.get("trigger_type")
            should_award = False
            lab_accuracy = 100
            lab_duration = 0
            lab_score = 100
            target_id = ach_id
            
            if trigger_type == "profile_score":
                min_points = rule.get("min_points", 0)
                if total_score >= min_points:
                    should_award = True
                    target_id = ach_id
            elif trigger_type == "lab_completion":
                target_lab_id = rule.get("target_lab_id")
                target_id = target_lab_id
                required_modules = lab_modules_counts.get(target_lab_id, set())
                completed_modules = completed_modules_by_lab.get(target_lab_id, set())
                
                if required_modules and required_modules.issubset(completed_modules):
                    should_award = True
                    lab_progress_rows = [p for p in progress_rows if p.lab_id == target_lab_id]
                    lab_duration = sum((p.time_taken_seconds or 0) for p in lab_progress_rows)
                    correct_count = sum(1 for p in lab_progress_rows if p.flag_correct)
                    total_count = len(lab_progress_rows)
                    lab_accuracy = round((correct_count / total_count) * 100) if total_count > 0 else 100
                    lab_score = sum((p.score or 0) for p in lab_progress_rows)
                    
            if should_award:
                # A. Ensure Achievement exists in DB
                ach = db.query(Achievement).filter(Achievement.id == ach_id).first()
                if not ach:
                    if trigger_type == "profile_score":
                        title = ach_id.replace("-", " ").title()
                        desc = f"Reached a total of {rule.get('min_points')} learning points!"
                    else:
                        title = "Network Reconnaissance" if target_id == "lab1-recon" else f"{target_id.replace('-', ' ').title()} Master"
                        desc = "Successfully completed all modules of Network Reconnaissance." if target_id == "lab1-recon" else f"Successfully completed all modules of {target_id.replace('-', ' ').title()}."
                    
                    ach = Achievement(
                        id=ach_id,
                        title=title,
                        description=desc,
                        icon="trophy",
                        condition=f"complete:{target_id}" if trigger_type == "lab_completion" else f"points:{min_points}",
                        reward_points=rule.get("min_points", 100) if trigger_type == "profile_score" else 100
                    )
                    try:
                        db.add(ach)
                        db.commit()
                    except Exception:
                        db.rollback()
                        
                # B. Ensure UserAchievement is awarded
                existing_ua = (
                    db.query(UserAchievement)
                    .filter(UserAchievement.user_id == user_id, UserAchievement.achievement_id == ach_id)
                    .first()
                )
                if not existing_ua:
                    ua = UserAchievement(
                        user_id=user_id,
                        achievement_id=ach_id,
                        earned_at=datetime.utcnow()
                    )
                    try:
                        db.add(ua)
                        db.commit()
                        logger.info(f"Awarded achievement '{ach_id}' to user_id={user_id}")
                        awarded_this_run.append(ach_id)
                    except Exception as e:
                        db.rollback()
                        logger.error(f"Failed to award achievement '{ach_id}': {e}")
                        
                # C. Ensure Certificate is issued
                existing_cert = (
                    db.query(Certificate)
                    .filter(Certificate.user_id == user_id, Certificate.lab_id == target_id)
                    .first()
                )
                if not existing_cert:
                    try:
                        certificate_manager.get_or_issue_certificate(
                            db=db,
                            user_id=user_id,
                            lab_id=target_id,
                            score=lab_score,
                            percentage=lab_accuracy,
                            points=rule.get("min_points", 100) if trigger_type == "profile_score" else 100,
                            duration_seconds=lab_duration,
                            completed_at=datetime.utcnow()
                        )
                    except Exception as cert_err:
                        logger.error(f"Certificate issuance failed for user_id={user_id}, rule={ach_id}: {cert_err}", exc_info=True)

        invalidate_dashboard(user_id)
        return awarded_this_run

    def process_lab_completion(
        self,
        db: Session,
        user_id: int,
        lab_id: str,
        score: int = 100,
        completed_at: Optional[datetime] = None
    ) -> dict:
        completed_at = completed_at or datetime.utcnow()
        self.evaluate_user_rules(db, user_id)
        
        from app.models.certificate import Certificate
        cert = (
            db.query(Certificate)
            .filter(Certificate.user_id == user_id, Certificate.lab_id == lab_id)
            .first()
        )
        cert_data = None
        if cert:
            cert_data = {
                "uuid": cert.uuid,
                "display_certificate_id": cert.display_certificate_id,
                "pdf_path": cert.pdf_path,
                "png_path": cert.png_path,
                "verification_url": f"/certificate/verify/{cert.display_certificate_id}"
            }
            
        return {
            "user_id": user_id,
            "lab_id": lab_id,
            "achievement_awarded": f"ach-{lab_id}",
            "certificate": cert_data
        }

achievement_manager = AchievementManager()
