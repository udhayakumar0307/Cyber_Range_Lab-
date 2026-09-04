from datetime import datetime, timedelta
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.assignment import Assignment
from app.models.group import Group
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.sysadmin_submission import SysadminSubmission
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.services.sysadmin_grading.reconciliation import (
    SysadminReconciliationError,
    reconcile_sysadmin_assignment_progress,
)


MARKETPLACE_LAB_ID = "linux-sysadmin-lab"
MODULE_ID = "TUPE-C03-006"


class SysadminReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

        Group.__table__.create(self.engine)
        User.__table__.create(self.engine)
        Lab.__table__.create(self.engine)
        LabModule.__table__.create(self.engine)
        Assignment.__table__.create(self.engine)
        SysadminSubmission.__table__.create(self.engine)
        UserLabProgress.__table__.create(self.engine)

        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.group = Group(
            id=29,
            name="Test Group",
            max_size=40,
        )
        self.db.add(self.group)

        self.student = User(
            id=230,
            email="student@example.com",
            name="Student",
            password_hash="test-password-hash",
            role="student",
            group_id=29,
        )
        self.db.add(self.student)

        self.db.add(
            Lab(
                id=MARKETPLACE_LAB_ID,
                name="Linux System Administration",
                category="Linux & System Administration",
                difficulty="Beginner",
                max_points=2100,
                estimated_time=300,
                status="ACTIVE",
                description="Test Linux Sysadmin marketplace lab",
                price_inr=0,
                rating=0,
                review_count=0,
                registry_path="/tmp/linux-sysadmin-lab",
                price_per_hour=0,
            )
        )

        self.db.add(
            LabModule(
                id=MODULE_ID,
                lab_id=MARKETPLACE_LAB_ID,
                module_number=16,
                title="Dynamic Command Report",
                description="Test module",
                points=100,
                display_order=16,
                track="unix-programming-environment",
            )
        )

        self.start = datetime(2026, 9, 4, 5, 12, 0)
        self.end = datetime(2026, 9, 4, 6, 12, 0)

        self.assignment = Assignment(
            id=112,
            lab_id=MARKETPLACE_LAB_ID,
            group_id=29,
            start_datetime=self.start,
            end_datetime=self.end,
            status="Scheduled",
        )
        self.db.add(self.assignment)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_attempt(
        self,
        *,
        submission_id,
        minute,
        status,
        score,
        assignment_id=None,
        student_id=230,
    ):
        submitted_at = self.start + timedelta(minutes=minute)

        row = SysadminSubmission(
            id=submission_id,
            student_id=student_id,
            assignment_id=assignment_id,
            lab_id=MODULE_ID,
            filename="dynamic_report.sh",
            submission_content=f"# attempt {submission_id}\n",
            submission_sha256=f"{submission_id:064x}",
            seed=1000 + submission_id,
            status=status,
            score=score,
            max_score=100,
            pass_score=70,
            passed=(status == "PASS"),
            submitted_at=submitted_at,
            completed_at=submitted_at + timedelta(seconds=10),
            graded_at=submitted_at + timedelta(seconds=10),
        )

        self.db.add(row)
        self.db.flush()
        return row

    def reconcile(self):
        return reconcile_sysadmin_assignment_progress(
            self.db,
            assignment_id=112,
            student_id=230,
            marketplace_lab_id=MARKETPLACE_LAB_ID,
        )

    def test_backfills_only_submissions_inside_assignment_window(self):
        before = SysadminSubmission(
            id=36,
            student_id=230,
            assignment_id=None,
            lab_id=MODULE_ID,
            filename="dynamic_report.sh",
            submission_content="# before\n",
            submission_sha256=f"{36:064x}",
            seed=1036,
            status="PASS",
            score=100,
            max_score=100,
            pass_score=70,
            passed=True,
            submitted_at=self.start - timedelta(minutes=5),
            completed_at=self.start - timedelta(minutes=2),
            graded_at=self.start - timedelta(minutes=2),
        )
        self.db.add(before)

        self.add_attempt(
            submission_id=37,
            minute=2,
            status="PASS",
            score=100,
        )
        self.add_attempt(
            submission_id=38,
            minute=3,
            status="FAIL",
            score=45,
        )
        self.db.commit()

        result = self.reconcile()

        self.assertEqual(
            result.candidate_submission_ids,
            (37, 38),
        )
        self.assertEqual(
            result.newly_scoped_submission_ids,
            (37, 38),
        )

        self.assertIsNone(
            self.db.get(SysadminSubmission, 36).assignment_id
        )
        self.assertEqual(
            self.db.get(SysadminSubmission, 37).assignment_id,
            112,
        )
        self.assertEqual(
            self.db.get(SysadminSubmission, 38).assignment_id,
            112,
        )

        progress = self.db.query(UserLabProgress).one()

        self.assertEqual(progress.status, "COMPLETED")
        self.assertEqual(progress.score, 100)
        self.assertEqual(progress.attempts, 2)

    def test_reconciliation_is_idempotent(self):
        self.add_attempt(
            submission_id=37,
            minute=2,
            status="PASS",
            score=100,
        )
        self.add_attempt(
            submission_id=38,
            minute=3,
            status="FAIL",
            score=45,
        )
        self.db.commit()

        first = self.reconcile()
        second = self.reconcile()

        self.assertEqual(
            first.newly_scoped_submission_ids,
            (37, 38),
        )
        self.assertEqual(
            second.newly_scoped_submission_ids,
            (),
        )
        self.assertEqual(
            second.already_scoped_submission_ids,
            (37, 38),
        )
        self.assertEqual(
            self.db.query(UserLabProgress).count(),
            1,
        )
        self.assertEqual(
            self.db.query(UserLabProgress).one().attempts,
            2,
        )

    def test_refuses_submission_owned_by_different_assignment(self):
        self.add_attempt(
            submission_id=37,
            minute=2,
            status="PASS",
            score=100,
            assignment_id=999,
        )
        self.db.commit()

        with self.assertRaises(SysadminReconciliationError):
            self.reconcile()

    def test_refuses_student_outside_assignment_group(self):
        other = User(
            id=231,
            email="other@example.com",
            name="Other Student",
            password_hash="test-password-hash",
            role="student",
            group_id=None,
        )
        self.db.add(other)
        self.db.commit()

        with self.assertRaises(SysadminReconciliationError):
            reconcile_sysadmin_assignment_progress(
                self.db,
                assignment_id=112,
                student_id=231,
                marketplace_lab_id=MARKETPLACE_LAB_ID,
            )


if __name__ == "__main__":
    unittest.main()
