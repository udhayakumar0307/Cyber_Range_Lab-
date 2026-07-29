import os
import sys
import json
from datetime import datetime

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from app.main import app
from app.database.manager import db_manager
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.user_achievement import UserAchievement
from app.models.audit_log import AuditLog
from app.models.lab import Lab
from app.core.security import create_access_token

def run_pipeline_verification():
    client = TestClient(app)
    db = db_manager.get_session()

    try:
        # Get active lab dynamically from DB
        active_lab = db.query(Lab).first()
        lab_id = active_lab.id if active_lab else "lab1-recon"

        # Get or create demo user
        user = db.query(User).filter(User.email == "student@cyberrange.io").first()
        if not user:
            user = db.query(User).filter(User.role == "student").first()
        if not user:
            user = db.query(User).first()

        print(f"\n[+] Active Test User: id={user.id}, name='{user.name}', email='{user.email}'")

        token = create_access_token(data={"sub": user.email, "role": user.role})
        headers = {"Authorization": f"Bearer {token}"}

        print("\n==================================================")
        print("STEP 2: TESTING MODULE 1 (module1) FLAG SUBMISSION")
        print("==================================================")

        payload_m1 = {
            "lab_id": lab_id,
            "module_id": "module1",
            "flag": "FLAG{test_module1_correct_flag}",
            "correct": True,
            "client_ip": "127.0.0.1",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
        }

        res1 = client.post("/api/v1/reporting/submit-flag", json=payload_m1, headers=headers)
        print(f"[>] HTTP Response Status: {res1.status_code}")
        print(f"[>] Response JSON: {res1.json()}")

        assert res1.status_code == 200, f"Expected 200, got {res1.status_code}"
        assert res1.json()["success"] == True

        # Assert database updates for Module 1
        db.expire_all()
        user = db.query(User).filter(User.id == user.id).first()
        progress_m1 = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.module_id == "module1"
        ).first()

        assert progress_m1 is not None, "UserLabProgress record for module1 missing!"
        assert progress_m1.status == "COMPLETED"
        assert progress_m1.score == 100
        print(f"[OK] UserLabProgress created for module1: status={progress_m1.status}, score={progress_m1.score}")

        achievements_m1 = db.query(UserAchievement).filter(UserAchievement.user_id == user.id).all()
        ach_ids = [a.achievement_id for a in achievements_m1]
        print(f"[OK] UserAchievements unlocked: {ach_ids}")
        assert "first-lab" in ach_ids
        assert "first-module" in ach_ids

        audit_logs_m1 = db.query(AuditLog).filter(AuditLog.user_id == user.id).all()
        log_actions = [l.action for l in audit_logs_m1]
        print(f"[OK] AuditLog entries recorded: {log_actions}")
        assert "Correct Flag" in log_actions
        assert "Module Completed" in log_actions

        print(f"[OK] User total_score after Module 1: {user.total_score} points")

        print("\n==================================================")
        print("STEP 3: TESTING MODULE 2 (module2) FLAG SUBMISSION")
        print("==================================================")

        payload_m2 = {
            "lab_id": lab_id,
            "module_id": "module2",
            "flag": "FLAG{test_module2_correct_flag}",
            "correct": True,
            "client_ip": "127.0.0.1",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
        }

        res2 = client.post("/api/v1/reporting/submit-flag", json=payload_m2, headers=headers)
        print(f"[>] HTTP Response Status: {res2.status_code}")
        print(f"[>] Response JSON: {res2.json()}")

        assert res2.status_code == 200, f"Expected 200, got {res2.status_code}: {res2.text}"
        assert res2.json()["success"] == True

        # Assert database updates for Module 2
        db.expire_all()
        user = db.query(User).filter(User.id == user.id).first()
        progress_m2 = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.module_id == "module2"
        ).first()

        assert progress_m2 is not None, "UserLabProgress record for module2 missing!"
        assert progress_m2.status == "COMPLETED"
        assert progress_m2.score == 150
        print(f"[OK] UserLabProgress created for module2: status={progress_m2.status}, score={progress_m2.score}")

        total_progress_count = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.status == "COMPLETED"
        ).count()
        print(f"[OK] Total UserLabProgress completed rows: {total_progress_count}")
        assert total_progress_count == 2

        print(f"[OK] User total_score after Module 2: {user.total_score} points")

        print("\n==================================================")
        print("STEP 4: VERIFYING REPORTING DASHBOARD & LEADERBOARDS")
        print("==================================================")

        dash_res = client.get("/api/v1/reporting/dashboard", headers=headers)
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        print(f"[OK] Dashboard Stats API response: {json.dumps(dash_data, indent=2)}")
        assert len(dash_data["recent_activity"]) == 2
        assert dash_data["score"] == user.total_score

        lead_res = client.get("/api/v1/reporting/leaderboard?type=global", headers=headers)
        assert lead_res.status_code == 200
        lead_data = lead_res.json()
        print(f"[OK] Global Leaderboard API response: total_ranked={lead_data['total']}, ranks_returned={len(lead_data['ranks'])}")

        print("\n==================================================")
        print("ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY!")
        print("==================================================")

    finally:
        db.close()

if __name__ == "__main__":
    run_pipeline_verification()
