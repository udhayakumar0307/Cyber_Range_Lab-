import os
import sys
import unittest
from unittest.mock import MagicMock, patch

from fastapi import BackgroundTasks

# Ensure backend directory is in Python path
sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from app.core.config import settings
from app.core.security import verify_password
from app.database.manager import db_manager
from app.models.college import College
from app.models.admin_student_roster import AdminStudentRoster  # noqa: F401
from app.models.user import User
from app.models.user_affiliation import UserAffiliation
from app.api.v1.endpoints.admin_api import (
    UserCreateRequest,
    create_admin_user,
)


class TestManualStudentCreation(unittest.TestCase):

    def setUp(self):
        self.db_file = "test_manual_student_creation.db"

        if os.path.exists(self.db_file):
            try:
                os.remove(self.db_file)
            except Exception:
                pass

        self.reload_patcher = patch.object(
            settings,
            "reload",
            return_value=None,
        )
        self.get_db_url_patcher = patch.object(
            settings,
            "get_database_url",
            return_value=f"sqlite:///{self.db_file}",
        )

        self.reload_patcher.start()
        self.get_db_url_patcher.start()

        settings.DATABASE_URL = f"sqlite:///{self.db_file}"
        db_manager.init_db(force=True)

        db = db_manager.get_session()

        # db_manager.init_db() currently encounters an unrelated legacy CTF
        # duplicate-index definition while creating the isolated SQLite schema.
        # Ensure the new ownership table required by these tests exists.
        AdminStudentRoster.__table__.create(
            bind=db.get_bind(),
            checkfirst=True,
        )

        try:
            if db.query(College).filter(College.id == 1).first() is None:
                db.add(
                    College(
                        id=1,
                        name="Indian Institute of Technology Madras",
                        code="IITM",
                        status="ACTIVE",
                    )
                )

            db.flush()

            admin = User(
                name="IITM Professor",
                email="professor@iitm.ac.in",
                password_hash="admin-hash",
                role="admin",
                account_type="academic",
                is_active=True,
                email_verified=True,
                organization="Indian Institute of Technology Madras",
            )
            db.add(admin)
            db.flush()

            db.add(
                UserAffiliation(
                    user_id=admin.id,
                    affiliation_type="college",
                    college_id=1,
                    organization_id=None,
                    is_primary=True,
                )
            )

            db.commit()
            self.admin_id = admin.id

        finally:
            db.close()

    def tearDown(self):
        db_manager.shutdown()

        self.reload_patcher.stop()
        self.get_db_url_patcher.stop()

        if os.path.exists(self.db_file):
            try:
                os.remove(self.db_file)
            except Exception:
                pass

    def _admin(self, db):
        return (
            db.query(User)
            .filter(User.id == self.admin_id)
            .one()
        )

    @patch(
        "app.api.v1.endpoints.admin_api.get_admin_org_id",
        return_value=None,
    )
    @patch(
        "app.services.audit_service.log_audit_event",
        return_value=None,
    )
    @patch(
        "app.api.v1.endpoints.admin_api.secrets.token_urlsafe",
        return_value="UniqueGeneratedTemp123",
    )
    def test_manual_add_generates_server_side_password_and_queues_email(
        self,
        mock_token,
        mock_audit,
        mock_org,
    ):
        db = db_manager.get_session()

        try:
            background = BackgroundTasks()

            payload = UserCreateRequest(
                name="Manual Student",
                email="manual.student@smail.iitm.ac.in",

                # Deliberately supply the old browser fallback.
                # Backend must IGNORE it.
                password="CyberRange#2026!",

                role="admin",  # Must not allow browser to create an admin.
                year="I Year",
                department="Computer Science",
                roll_number="TEST001",
            )

            response = create_admin_user(
                data=payload,
                request=MagicMock(),
                background_tasks=background,
                current_user=self._admin(db),
                db=db,
            )

            self.assertEqual(response["status"], "success")
            self.assertTrue(response["credential_email_queued"])
            self.assertNotIn("password", response)

            student = (
                db.query(User)
                .filter(
                    User.email == "manual.student@smail.iitm.ac.in"
                )
                .one()
            )

            # Browser-provided role/password must not control student identity.
            self.assertEqual(student.role, "user")
            self.assertEqual(student.account_type, "student")
            self.assertEqual(student.auth_type, "INDIVIDUAL")

            self.assertTrue(
                verify_password(
                    "UniqueGeneratedTemp123",
                    student.password_hash,
                )
            )

            self.assertFalse(
                verify_password(
                    "CyberRange#2026!",
                    student.password_hash,
                )
            )

            # Manual creation must produce the same academic scope shape
            # as bulk roster creation.
            self.assertEqual(student.college_id, 1)
            self.assertEqual(
                student.organization,
                "Indian Institute of Technology Madras",
            )
            self.assertEqual(student.department, "Computer Science")
            self.assertEqual(student.year, 1)
            self.assertEqual(student.roll_number, "TEST001")

            affs = (
                db.query(UserAffiliation)
                .filter(UserAffiliation.user_id == student.id)
                .all()
            )

            self.assertEqual(len(affs), 1)
            self.assertEqual(affs[0].affiliation_type, "college")
            self.assertEqual(affs[0].college_id, 1)
            self.assertTrue(affs[0].is_primary)

            # Credential email must receive the exact server-generated password.
            self.assertEqual(len(background.tasks), 1)

            task = background.tasks[0]

            self.assertEqual(
                task.args[0],
                [
                    (
                        "manual.student@smail.iitm.ac.in",
                        "UniqueGeneratedTemp123",
                    )
                ],
            )

            self.assertEqual(
                task.args[1],
                "IITM Professor",
            )

            mock_token.assert_called_once_with(12)

        finally:
            db.close()

    @patch(
        "app.api.v1.endpoints.admin_api.get_admin_org_id",
        return_value=None,
    )
    def test_manual_add_rejects_existing_email(
        self,
        mock_org,
    ):
        db = db_manager.get_session()

        try:
            existing = User(
                name="Existing Student",
                email="existing@smail.iitm.ac.in",
                password_hash="existing-hash",
                role="user",
                is_active=True,
            )
            db.add(existing)
            db.commit()

            background = BackgroundTasks()

            payload = UserCreateRequest(
                name="Duplicate Student",
                email="existing@smail.iitm.ac.in",
                year="I Year",
                department="Computer Science",
                roll_number="DUP001",
            )

            from fastapi import HTTPException

            with self.assertRaises(HTTPException) as ctx:
                create_admin_user(
                    data=payload,
                    request=MagicMock(),
                    background_tasks=background,
                    current_user=self._admin(db),
                    db=db,
                )

            self.assertEqual(ctx.exception.status_code, 400)
            self.assertEqual(len(background.tasks), 0)

            users = (
                db.query(User)
                .filter(User.email == "existing@smail.iitm.ac.in")
                .all()
            )

            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].name, "Existing Student")

        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
