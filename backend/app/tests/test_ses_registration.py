import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from app.main import app
from app.database.manager import db_manager
from app.models.user import User
from app.models.otp import OTPVerification
from app.core.config import settings

class TestSESRegistration(unittest.TestCase):
    def setUp(self):
        # Force file-based SQLite db for unit testing and prevent config reload from overriding it
        self.db_file = "test_ses_auth.db"
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

    @patch("app.services.ses_service.boto3.client")
    def test_startup_validation_missing_env(self, mock_boto_client):
        # Mock settings to represent missing variables
        with patch.object(settings, "AWS_ACCESS_KEY_ID", ""), \
             patch.object(settings, "AWS_SECRET_ACCESS_KEY", ""), \
             patch.object(settings, "AWS_REGION", "eu-north-1"), \
             patch.object(settings, "SES_FROM_EMAIL", "from@example.com"):
             
            from app.services.ses_service import SESService
            test_service = SESService()
            self.assertFalse(test_service.is_enabled)
            self.assertIsNone(test_service.client)

    @patch("app.services.ses_service.boto3.client")
    def test_startup_validation_valid_env(self, mock_boto_client):
        # Mock settings to represent all variables present
        with patch.object(settings, "AWS_ACCESS_KEY_ID", "fake-key"), \
             patch.object(settings, "AWS_SECRET_ACCESS_KEY", "fake-secret"), \
             patch.object(settings, "AWS_REGION", "eu-north-1"), \
             patch.object(settings, "SES_FROM_EMAIL", "from@example.com"):
             
            from app.services.ses_service import SESService
            test_service = SESService()
            self.assertTrue(test_service.is_enabled)
            self.assertIsNotNone(test_service.client)

    @patch("app.services.ses_service.ses_service")
    def test_registration_success(self, mock_ses_service):
        mock_ses_service.is_enabled = True
        mock_ses_service.client = MagicMock()
        
        payload = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "securepassword123"
        }
        
        response = self.client.post("/api/v1/auth/register", json=payload)
        self.assertEqual(response.status_code, 201)
        
        # Verify user is created in database
        session = db_manager.get_session()
        user = session.query(User).filter(User.email == "test@example.com").first()
        self.assertIsNotNone(user)
        self.assertEqual(user.name, "Test User")
        
        # Verify OTP is created in database
        otp_rec = session.query(OTPVerification).filter(OTPVerification.email == "test@example.com").first()
        self.assertIsNotNone(otp_rec)
        self.assertEqual(len(otp_rec.otp_code), 6)
        
        session.close()
        
        # Verify send_otp_email was called with correct parameters
        mock_ses_service.send_otp_email.assert_called_once_with("test@example.com", otp_rec.otp_code)

    @patch("app.services.ses_service.ses_service")
    def test_registration_rollback_on_ses_failure(self, mock_ses_service):
        mock_ses_service.is_enabled = True
        mock_ses_service.client = MagicMock()
        # Mock send_otp_email to raise a RuntimeError
        mock_ses_service.send_otp_email.side_effect = RuntimeError("AWS credentials not found. Please contact administration.")
        
        payload = {
            "name": "Failed User",
            "email": "fail@example.com",
            "password": "securepassword123"
        }
        
        response = self.client.post("/api/v1/auth/register", json=payload)
        self.assertEqual(response.status_code, 500)
        self.assertIn("AWS credentials not found", response.json()["message"])
        
        # Verify user is NOT created in database (rolled back)
        session = db_manager.get_session()
        user = session.query(User).filter(User.email == "fail@example.com").first()
        self.assertIsNone(user)
        
        # Verify OTP is NOT created in database (rolled back)
        otp_rec = session.query(OTPVerification).filter(OTPVerification.email == "fail@example.com").first()
        self.assertIsNone(otp_rec)
        
        session.close()

    @patch("app.services.ses_service.ses_service")
    def test_forgot_password_success(self, mock_ses_service):
        mock_ses_service.is_enabled = True
        mock_ses_service.client = MagicMock()
        mock_ses_service.send_reset_email.return_value = "msg-id-12345"

        # Create user first in DB so they exist
        session = db_manager.get_session()
        user = User(
            name="Forgot User",
            email="forgot@example.com",
            password_hash="old-hash",
            role="user",
            is_active=True
        )
        session.add(user)
        session.commit()
        session.close()

        payload = {"email": "forgot@example.com"}
        response = self.client.post("/api/v1/auth/forgot-password", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

        # Verify token record is created in DB
        session = db_manager.get_session()
        from app.models.password_reset import PasswordReset
        reset_rec = session.query(PasswordReset).filter(PasswordReset.email == "forgot@example.com").first()
        self.assertIsNotNone(reset_rec)
        self.assertIsNotNone(reset_rec.token_hash)
        session.close()

        mock_ses_service.send_reset_email.assert_called_once()

    @patch("app.services.ses_service.ses_service")
    def test_forgot_password_rollback_on_ses_failure(self, mock_ses_service):
        mock_ses_service.is_enabled = True
        mock_ses_service.client = MagicMock()
        mock_ses_service.send_reset_email.side_effect = RuntimeError("AWS credentials not found.")

        # Create user in DB
        session = db_manager.get_session()
        user = User(
            name="Forgot Failed User",
            email="forgot-fail@example.com",
            password_hash="old-hash",
            role="user",
            is_active=True
        )
        session.add(user)
        session.commit()
        session.close()

        payload = {"email": "forgot-fail@example.com"}
        response = self.client.post("/api/v1/auth/forgot-password", json=payload)
        self.assertEqual(response.status_code, 500)

        # Verify reset token is NOT in database
        session = db_manager.get_session()
        from app.models.password_reset import PasswordReset
        reset_rec = session.query(PasswordReset).filter(PasswordReset.email == "forgot-fail@example.com").first()
        self.assertIsNone(reset_rec)
        session.close()

    def test_reset_password_success(self):
        # Create user and reset token in DB
        session = db_manager.get_session()
        user = User(
            name="Reset User",
            email="reset@example.com",
            password_hash="old-hash",
            role="user",
            is_active=True
        )
        session.add(user)

        import hashlib
        from datetime import datetime, timedelta
        from app.models.password_reset import PasswordReset
        
        token = "secret-token-123"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        reset_rec = PasswordReset(
            email="reset@example.com",
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=15)
        )
        session.add(reset_rec)
        session.commit()
        session.close()

        payload = {
            "token": token,
            "new_password": "brandnewpassword123!"
        }
        response = self.client.post("/api/v1/auth/reset-password", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["success"], True)

        # Verify password hash updated and token record deleted
        session = db_manager.get_session()
        updated_user = session.query(User).filter(User.email == "reset@example.com").first()
        self.assertNotEqual(updated_user.password_hash, "old-hash")
        
        deleted_token = session.query(PasswordReset).filter(PasswordReset.token_hash == token_hash).first()
        self.assertIsNone(deleted_token)
        session.close()

    def test_reset_password_expired(self):
        # Create user and reset token in DB with past expiry
        session = db_manager.get_session()
        user = User(
            name="Reset Expired User",
            email="reset-expired@example.com",
            password_hash="old-hash",
            role="user",
            is_active=True
        )
        session.add(user)

        import hashlib
        from datetime import datetime, timedelta
        from app.models.password_reset import PasswordReset
        
        token = "expired-token-123"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        reset_rec = PasswordReset(
            email="reset-expired@example.com",
            token_hash=token_hash,
            expires_at=datetime.utcnow() - timedelta(minutes=1) # Expired 1 min ago
        )
        session.add(reset_rec)
        session.commit()
        session.close()

        payload = {
            "token": token,
            "new_password": "brandnewpassword123!"
        }
        response = self.client.post("/api/v1/auth/reset-password", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", response.json()["message"])

        # Verify password remains unchanged
        session = db_manager.get_session()
        updated_user = session.query(User).filter(User.email == "reset-expired@example.com").first()
        self.assertEqual(updated_user.password_hash, "old-hash")
        session.close()

if __name__ == "__main__":
    unittest.main()

