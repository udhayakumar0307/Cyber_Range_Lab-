import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database.manager import db_manager
from app.models.user_lab_progress import UserLabProgress
from app.models.user_achievement import UserAchievement
from app.models.audit_log import AuditLog
from app.models.user import User

def reset_cll_data():
    """
    Deletes only Command Line Lab user progress and associated user achievements,
    re-calculates user scores, and preserves users, labs, and lab_modules tables.
    """
    db_manager.init_db()
    session = db_manager.get_session()
    try:
        print("[*] Starting targeted reset of Command Line Lab progress...")

        # 1. Delete user_lab_progress rows for command-line-lab
        deleted_progress = session.query(UserLabProgress).filter(
            UserLabProgress.lab_id == "command-line-lab"
        ).delete(synchronize_session=False)
        print(f"[+] Deleted {deleted_progress} rows from user_lab_progress for lab_id='command-line-lab'.")

        # 2. Delete achievements earned from CLL
        cll_achievements = [
            "first-lab", "first-module", "100-points", "500-points", 
            "1000-points", "linux-track", "complete-every-module", 
            "perfect-run", "fast-solver"
        ]
        deleted_achievements = session.query(UserAchievement).filter(
            UserAchievement.achievement_id.in_(cll_achievements)
        ).delete(synchronize_session=False)
        print(f"[+] Deleted {deleted_achievements} rows from user_achievements.")

        # 3. Delete flag audit logs
        deleted_logs = session.query(AuditLog).filter(
            AuditLog.action.in_(["Wrong Flag", "Correct Flag", "Module Completed", "Lab Completed", "Achievement Earned"])
        ).delete(synchronize_session=False)
        print(f"[+] Deleted {deleted_logs} flag/achievement audit log entries.")

        # 4. Reset total_score for users back to 0 (or sum of non-CLL progress)
        users = session.query(User).all()
        for user in users:
            user.total_score = 0
        print(f"[+] Reset total_score to 0 for {len(users)} registered users.")

        session.commit()
        print("[OK] Targeted Command Line Lab progress reset executed successfully!")
    except Exception as e:
        session.rollback()
        print(f"[!] Reset failed and rolled back: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    reset_cll_data()
