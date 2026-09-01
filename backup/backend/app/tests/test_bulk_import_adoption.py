import io
import os
import sys
import unittest
from unittest.mock import patch

import openpyxl
from fastapi import BackgroundTasks, UploadFile

# Ensure backend directory is in Python path
sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from app.core.config import settings
from app.database.manager import db_manager
from app.models.user import User
from app.models.user_affiliation import UserAffiliation
from app.models.college import College
from app.api.v1.endpoints.admin_api import bulk_import_users


class TestBulkImportStudentAdoption(unittest.TestCase):
    """
    Regression coverage for the roster-import / Academic-SSO race.

    Production incident reproduced:
      1. Professor deletes/prepares roster.
      2. Student logs in before XLSX import.
      3. Academic SSO auto-creates an unaffiliated User.
      4. Bulk importer sees the email already exists.

    Required behavior:
      - Compatible student accounts are adopted.
      - Authentication credentials are preserved.
      - Missing academic scope is attached.
      - Re-import is idempotent.
      - Privileged accounts are protected.
      - Students belonging exclusively to another scope are protected.
    """

    def setUp(self):
        self.db_file = "test_bulk_import_adoption.db"

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

        try:
            # UserAffiliation.college_id is a real foreign key, so the
            # isolated SQLite fixture must contain the colleges used below.
            if db.query(College).filter(College.id == 1).first() is None:
                db.add(
                    College(
                        id=1,
                        name="Indian Institute of Technology Madras",
                        code="IITM",
                        status="ACTIVE",
                    )
                )

            if db.query(College).filter(College.id == 2).first() is None:
                db.add(
                    College(
                        id=2,
                        name="Another University",
                        code="OTHER",
                        status="ACTIVE",
                    )
                )

            db.flush()

            admin = User(
                name="IITM Professor",
                email="professor@iitm.ac.in",
                password_hash="admin-password-hash",
                role="admin",
                is_active=True,
                account_type="academic",
                organization="Indian Institute of Technology Madras",
                email_verified=True,
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

    @staticmethod
    def _xlsx(rows):
        """
        Create the same XLSX shape accepted by /admin/users/import.
        """
        wb = openpyxl.Workbook()
        ws = wb.active

        ws.append([
            "Full Name",
            "Email",
            "Department / Year",
            "Roll Number",
        ])

        for row in rows:
            ws.append([
                row["name"],
                row["email"],
                row.get("department_year", "B. Cyber - I"),
                row.get("roll_number", ""),
            ])

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    def _admin(self, db):
        return db.query(User).filter(User.id == self.admin_id).one()

    async def _import(self, db, rows):
        background_tasks = BackgroundTasks()

        upload = UploadFile(
            filename="students.xlsx",
            file=self._xlsx(rows),
        )

        with patch(
            "app.api.v1.endpoints.admin_api.log_audit_event",
            return_value=None,
        ):
            result = await bulk_import_users(
                background_tasks=background_tasks,
                file=upload,
                request=None,
                current_user=self._admin(db),
                db=db,
            )

        return result, background_tasks

    def test_unaffiliated_sso_student_is_adopted_without_replacing_authentication(self):
        """
        Exact regression for the production incident:
        an Academic-SSO student exists before the professor imports the XLSX.
        """
        import asyncio

        email = "id26y003@smail.iitm.ac.in"
        original_password_hash = "EXISTING-SSO-PASSWORD-HASH"

        db = db_manager.get_session()

        try:
            student = User(
                name="Id26y003",
                email=email,
                password_hash=original_password_hash,
                role="user",
                is_active=True,
                account_type="academic",
                auth_type="SSO",
                organization="Enterprise CyberRange",
                email_verified=True,
            )
            db.add(student)
            db.commit()

            result, background = asyncio.run(
                self._import(
                    db,
                    [{
                        "name": "Akshara Maheshwari",
                        "email": email,
                        "department_year": "B. Cyber - I",
                        "roll_number": "id26y003",
                    }],
                )
            )

            self.assertEqual(result["status"], "success")
            self.assertEqual(result["success_count"], 1)
            self.assertEqual(result["created_count"], 0)
            self.assertEqual(result["adopted_count"], 1)
            self.assertEqual(result["failure_count"], 0)

            db.expire_all()

            repaired = (
                db.query(User)
                .filter(User.email == email)
                .one()
            )

            self.assertEqual(repaired.name, "Akshara Maheshwari")
            self.assertEqual(repaired.role, "user")
            self.assertEqual(repaired.account_type.lower(), "student")

            # Critical: preserve existing login state.
            self.assertEqual(repaired.auth_type, "SSO")
            self.assertEqual(
                repaired.password_hash,
                original_password_hash,
            )

            self.assertEqual(repaired.college_id, 1)
            self.assertEqual(
                repaired.organization,
                "Indian Institute of Technology Madras",
            )
            self.assertEqual(repaired.department, "B. Cyber")
            self.assertEqual(repaired.year, 1)
            self.assertEqual(repaired.roll_number, "id26y003")

            affs = (
                db.query(UserAffiliation)
                .filter(UserAffiliation.user_id == repaired.id)
                .all()
            )

            self.assertEqual(len(affs), 1)
            self.assertEqual(affs[0].affiliation_type, "college")
            self.assertEqual(affs[0].college_id, 1)
            self.assertTrue(affs[0].is_primary)

            # The endpoint still queues its background wrapper, but an adopted
            # account must not receive newly generated credentials.
            self.assertEqual(len(background.tasks), 1)
            created_users_arg = background.tasks[0].args[0]
            self.assertEqual(created_users_arg, [])

        finally:
            db.close()

    def test_brand_new_student_is_created_with_roster_scope(self):
        import asyncio

        email = "id26y100@smail.iitm.ac.in"

        db = db_manager.get_session()

        try:
            result, background = asyncio.run(
                self._import(
                    db,
                    [{
                        "name": "Brand New Student",
                        "email": email,
                        "department_year": "B. Cyber - I",
                        "roll_number": "id26y100",
                    }],
                )
            )

            self.assertEqual(result["status"], "success")
            self.assertEqual(result["success_count"], 1)
            self.assertEqual(result["created_count"], 1)
            self.assertEqual(result["adopted_count"], 0)
            self.assertEqual(result["failure_count"], 0)

            created = (
                db.query(User)
                .filter(User.email == email)
                .one()
            )

            self.assertEqual(created.name, "Brand New Student")
            self.assertEqual(created.role, "user")
            self.assertEqual(created.college_id, 1)
            self.assertEqual(
                created.organization,
                "Indian Institute of Technology Madras",
            )
            self.assertEqual(created.department, "B. Cyber")
            self.assertEqual(created.year, 1)
            self.assertEqual(created.roll_number, "id26y100")

            affs = (
                db.query(UserAffiliation)
                .filter(UserAffiliation.user_id == created.id)
                .all()
            )

            self.assertEqual(len(affs), 1)
            self.assertEqual(affs[0].college_id, 1)
            self.assertTrue(affs[0].is_primary)

            # Newly-created students DO have credentials queued.
            self.assertEqual(len(background.tasks), 1)
            created_users_arg = background.tasks[0].args[0]

            self.assertEqual(len(created_users_arg), 1)
            self.assertEqual(created_users_arg[0][0], email)
            self.assertTrue(created_users_arg[0][1])

        finally:
            db.close()

    def test_privileged_account_is_rejected_and_unchanged(self):
        import asyncio

        email = "existing-admin@iitm.ac.in"

        db = db_manager.get_session()

        try:
            existing = User(
                name="Existing Administrator",
                email=email,
                password_hash="ADMIN-SECRET-HASH",
                role="admin",
                is_active=True,
                account_type="academic",
                auth_type="INDIVIDUAL",
                organization="Indian Institute of Technology Madras",
                email_verified=True,
            )
            db.add(existing)
            db.commit()

            original_id = existing.id

            result, _ = asyncio.run(
                self._import(
                    db,
                    [{
                        "name": "Attempted Student Rewrite",
                        "email": email,
                        "department_year": "B. Cyber - I",
                        "roll_number": "fake-roll",
                    }],
                )
            )

            self.assertEqual(result["success_count"], 0)
            self.assertEqual(result["created_count"], 0)
            self.assertEqual(result["adopted_count"], 0)
            self.assertEqual(result["failure_count"], 1)

            self.assertIn(
                "protected account",
                result["errors"][0]["error_detail"].lower(),
            )

            db.expire_all()

            protected = (
                db.query(User)
                .filter(User.id == original_id)
                .one()
            )

            self.assertEqual(protected.name, "Existing Administrator")
            self.assertEqual(protected.role, "admin")
            self.assertEqual(
                protected.password_hash,
                "ADMIN-SECRET-HASH",
            )
            self.assertIsNone(protected.roll_number)

        finally:
            db.close()

    def test_duplicate_email_inside_same_xlsx_is_reported(self):
        import asyncio

        email = "duplicate@smail.iitm.ac.in"

        db = db_manager.get_session()

        try:
            result, _ = asyncio.run(
                self._import(
                    db,
                    [
                        {
                            "name": "First Version",
                            "email": email,
                            "department_year": "B. Cyber - I",
                            "roll_number": "dup001",
                        },
                        {
                            "name": "Second Version",
                            "email": email,
                            "department_year": "B. Cyber - I",
                            "roll_number": "dup002",
                        },
                    ],
                )
            )

            self.assertEqual(result["success_count"], 1)
            self.assertEqual(result["created_count"], 1)
            self.assertEqual(result["adopted_count"], 0)
            self.assertEqual(result["failure_count"], 1)

            self.assertIn(
                "more than once",
                result["errors"][0]["error_detail"],
            )

            users = (
                db.query(User)
                .filter(User.email == email)
                .all()
            )

            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].name, "First Version")
            self.assertEqual(users[0].roll_number, "dup001")

        finally:
            db.close()

    def test_reimport_is_idempotent_and_does_not_duplicate_affiliation(self):
        import asyncio

        email = "reimport@smail.iitm.ac.in"

        db = db_manager.get_session()

        try:
            first_result, _ = asyncio.run(
                self._import(
                    db,
                    [{
                        "name": "Reimport Student",
                        "email": email,
                        "department_year": "B. Cyber - I",
                        "roll_number": "re001",
                    }],
                )
            )

            self.assertEqual(first_result["created_count"], 1)

            first_user = (
                db.query(User)
                .filter(User.email == email)
                .one()
            )
            original_password_hash = first_user.password_hash

            first_aff_count = (
                db.query(UserAffiliation)
                .filter(UserAffiliation.user_id == first_user.id)
                .count()
            )

            self.assertEqual(first_aff_count, 1)

            second_result, background = asyncio.run(
                self._import(
                    db,
                    [{
                        "name": "Reimport Student Updated",
                        "email": email,
                        "department_year": "B. Cyber - I",
                        "roll_number": "re001",
                    }],
                )
            )

            self.assertEqual(second_result["success_count"], 1)
            self.assertEqual(second_result["created_count"], 0)
            self.assertEqual(second_result["adopted_count"], 1)
            self.assertEqual(second_result["failure_count"], 0)

            db.expire_all()

            second_user = (
                db.query(User)
                .filter(User.email == email)
                .one()
            )

            self.assertEqual(
                second_user.name,
                "Reimport Student Updated",
            )
            self.assertEqual(
                second_user.password_hash,
                original_password_hash,
            )

            second_aff_count = (
                db.query(UserAffiliation)
                .filter(UserAffiliation.user_id == second_user.id)
                .count()
            )

            self.assertEqual(second_aff_count, 1)

            # Re-import must not generate replacement credentials.
            self.assertEqual(len(background.tasks), 1)
            self.assertEqual(background.tasks[0].args[0], [])

        finally:
            db.close()

    def test_student_in_different_college_is_rejected_and_unchanged(self):
        import asyncio

        email = "other-college@student.example"
        original_password_hash = "OTHER-COLLEGE-HASH"

        db = db_manager.get_session()

        try:
            existing = User(
                name="Other College Student",
                email=email,
                password_hash=original_password_hash,
                role="user",
                is_active=True,
                account_type="student",
                auth_type="INDIVIDUAL",
                college_id=2,
                organization="Another University",
                department="Physics",
                year=4,
                roll_number="OTHER001",
                email_verified=True,
            )
            db.add(existing)
            db.flush()

            db.add(
                UserAffiliation(
                    user_id=existing.id,
                    affiliation_type="college",
                    college_id=2,
                    organization_id=None,
                    is_primary=True,
                )
            )

            db.commit()
            existing_id = existing.id

            result, _ = asyncio.run(
                self._import(
                    db,
                    [{
                        "name": "Malicious Rewrite",
                        "email": email,
                        "department_year": "B. Cyber - I",
                        "roll_number": "iitm999",
                    }],
                )
            )

            self.assertEqual(result["success_count"], 0)
            self.assertEqual(result["created_count"], 0)
            self.assertEqual(result["adopted_count"], 0)
            self.assertEqual(result["failure_count"], 1)

            self.assertIn(
                "different academic scope",
                result["errors"][0]["error_detail"].lower(),
            )

            db.expire_all()

            protected = (
                db.query(User)
                .filter(User.id == existing_id)
                .one()
            )

            self.assertEqual(protected.name, "Other College Student")
            self.assertEqual(protected.college_id, 2)
            self.assertEqual(protected.organization, "Another University")
            self.assertEqual(protected.department, "Physics")
            self.assertEqual(protected.year, 4)
            self.assertEqual(protected.roll_number, "OTHER001")
            self.assertEqual(
                protected.password_hash,
                original_password_hash,
            )

            affs = (
                db.query(UserAffiliation)
                .filter(UserAffiliation.user_id == existing_id)
                .all()
            )

            self.assertEqual(len(affs), 1)
            self.assertEqual(affs[0].college_id, 2)

        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
