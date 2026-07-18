import os
import sys
import unittest
from unittest.mock import patch

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from app.main import app
from app.database.manager import db_manager
from app.models.user import User
from app.models.otp import OTPVerification
from app.models.college import College
from app.models.achievement import Achievement
from app.models.user_achievement import UserAchievement
from app.models.user_lab_progress import UserLabProgress
from app.models.audit_log import AuditLog
from app.core.config import settings

class TestEnterpriseFeatures(unittest.TestCase):
    def setUp(self):
        self.db_file = "test_enterprise_auth.db"
        if os.path.exists(self.db_file):
            try:
                os.remove(self.db_file)
            except Exception:
                pass
                
        self.reload_patcher = patch.object(settings, "reload", return_value=None)
        self.get_db_url_patcher = patch.object(settings, "get_database_url", return_value=f"sqlite:///{self.db_file}")
        self.reload_patcher.start()
        self.get_db_url_patcher.start()
        
        settings.DATABASE_URL = f"sqlite:///{self.db_file}"
        db_manager.init_db(force=True)
        self.client = TestClient(app)

    def tearDown(self):
        db_manager.shutdown()
        self.reload_patcher.stop()
        self.get_db_url_patcher.stop()
        if os.path.exists(self.db_file):
            try:
                os.remove(self.db_file)
            except Exception:
                pass

    @patch("app.services.ses_service.ses_service.send_otp_email")
    def test_student_registration_and_otp_flow(self, mock_send_email):
        # 1. Register student
        payload = {
            "name": "Bruce Banner",
            "email": "banner@iitm.ac.in",
            "password": "SecretPassword123",
            "account_type": "STUDENT",
            "college_id": 1,
            "department": "Physics",
            "year": 1,
            "roll_number": "PH23B001"
        }
        res = self.client.post("/api/v1/auth/register", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["email"], "banner@iitm.ac.in")
        self.assertEqual(data["account_type"], "STUDENT")
        self.assertEqual(data["college_id"], 1)

        # Verify OTP record created
        db = db_manager.get_session()
        otp_rec = db.query(OTPVerification).filter(OTPVerification.email == "banner@iitm.ac.in").first()
        self.assertIsNotNone(otp_rec)
        db.close()

        # 2. Verify OTP
        verify_payload = {
            "email": "banner@iitm.ac.in",
            "otp_code": otp_rec.otp_code
        }
        res = self.client.post("/api/v1/auth/verify-otp", json=verify_payload)
        self.assertEqual(res.status_code, 200)
        verify_data = res.json()
        self.assertTrue(verify_data["success"])
        self.assertIn("token", verify_data)

        # 3. Check login and audit log
        db = db_manager.get_session()
        user = db.query(User).filter(User.email == "banner@iitm.ac.in").first()
        self.assertTrue(user.is_active)
        
        # Verify Registration & OTP verification audit logs
        logs = db.query(AuditLog).filter(AuditLog.user_id == user.id).all()
        actions = [l.action for l in logs]
        self.assertIn("Registration", actions)
        self.assertIn("OTP Verification", actions)
        db.close()

    @patch("app.services.ses_service.ses_service.send_otp_email")
    def test_transactional_flag_submission(self, mock_send_email):
        # 1. Register student
        register_payload = {
            "name": "Tony Stark",
            "email": "tony@stark.com",
            "password": "IronManPassword123",
            "account_type": "STUDENT",
            "college_id": 1,
            "department": "Mech",
            "year": 4,
            "roll_number": "ME20B100"
        }
        res = self.client.post("/api/v1/auth/register", json=register_payload)
        self.assertEqual(res.status_code, 201)

        db = db_manager.get_session()
        otp_rec = db.query(OTPVerification).filter(OTPVerification.email == "tony@stark.com").first()
        verify_payload = {"email": "tony@stark.com", "otp_code": otp_rec.otp_code}
        res = self.client.post("/api/v1/auth/verify-otp", json=verify_payload)
        self.assertEqual(res.status_code, 200)
        token = res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Submit wrong flag
        wrong_payload = {
            "module_id": "linux_module1",
            "flag": "FLAG{wrong_flag}",
            "correct": False,
            "client_ip": "192.168.1.50",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0"
        }
        res = self.client.post("/api/v1/reporting/submit-flag", json=wrong_payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["success"])

        # Verify wrong flag audit log created
        db.close()
        db = db_manager.get_session()
        logs = db.query(AuditLog).filter(AuditLog.action == "Wrong Flag").all()
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0].ip_address, "192.168.1.50")
        self.assertEqual(logs[0].browser, "Chrome")
        self.assertEqual(logs[0].device, "Windows PC")

        # 3. Submit correct flag
        correct_payload = {
            "module_id": "linux_module1",
            "flag": "FLAG{correct_flag_placeholder}",
            "correct": True,
            "client_ip": "192.168.1.50",
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/15.6.1"
        }
        res = self.client.post("/api/v1/reporting/submit-flag", json=correct_payload, headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])

        db.close()
        db = db_manager.get_session()
        # Verify user score is updated (100 points for linux_module1 + achievements points)
        user = db.query(User).filter(User.email == "tony@stark.com").first()
        self.assertGreaterEqual(user.total_score, 100)

        # Verify achievements unlocked: first-lab, first-module
        user_ach = db.query(UserAchievement).filter(UserAchievement.user_id == user.id).all()
        ach_ids = [ua.achievement_id for ua in user_ach]
        self.assertIn("first-lab", ach_ids)
        self.assertIn("first-module", ach_ids)

        # Verify completed module progress record
        progress = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user.id,
            UserLabProgress.module_id == "linux_module1"
        ).first()
        self.assertIsNotNone(progress)
        self.assertEqual(progress.status, "COMPLETED")
        self.assertEqual(progress.browser, "Safari")
        self.assertEqual(progress.device, "Macbook")

        # 4. Query leaderboard filter options
        global_res = self.client.get("/api/v1/reporting/leaderboard?type=global", headers=headers)
        self.assertEqual(global_res.status_code, 200)
        self.assertGreaterEqual(global_res.json()["total"], 1)

        college_res = self.client.get("/api/v1/reporting/leaderboard?type=college", headers=headers)
        self.assertEqual(college_res.status_code, 200)
        self.assertGreaterEqual(college_res.json()["total"], 1)

        personal_res = self.client.get("/api/v1/reporting/leaderboard?type=personal", headers=headers)
        self.assertEqual(personal_res.status_code, 200)
        self.assertEqual(personal_res.json()["name"], "Tony Stark")

        # 5. Check dashboard aggregation
        dash_res = self.client.get("/api/v1/reporting/dashboard", headers=headers)
        self.assertEqual(dash_res.status_code, 200)
        dash_data = dash_res.json()
        self.assertEqual(dash_data["badges_count"], len(user_ach))
        db.close()

if __name__ == "__main__":
    unittest.main()
