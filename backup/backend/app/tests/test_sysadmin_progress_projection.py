from datetime import datetime, timedelta
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.sysadmin_submission import SysadminSubmission
from app.models.user_lab_progress import UserLabProgress
from app.services.sysadmin_grading.progress_projection import (
    project_sysadmin_assignment_progress,
)


MARKETPLACE_LAB_ID = "linux-sysadmin-lab"
MODULE_ID = "TUPE-C03-006"


class SysadminProgressProjectionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

        Lab.__table__.create(self.engine)
        LabModule.__table__.create(self.engine)
        SysadminSubmission.__table__.create(self.engine)
        UserLabProgress.__table__.create(self.engine)

        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

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

        self.db.commit()

        self.base_time = datetime(2026, 9, 4, 5, 14, 0)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_attempt(
        self,
        *,
        assignment_id=112,
        student_id=230,
        status,
        score,
        minute,
    ):
        passed = status == "PASS"
        submitted_at = self.base_time + timedelta(minutes=minute)
        completed_at = submitted_at + timedelta(seconds=10)

        row = SysadminSubmission(
            student_id=student_id,
            assignment_id=assignment_id,
            lab_id=MODULE_ID,
            filename="dynamic_report.sh",
            submission_content=f"# attempt {minute}\n",
            submission_sha256=f"{minute:064x}",
            seed=1000 + minute,
            status=status,
            score=score,
            max_score=100,
            pass_score=70,
            passed=passed,
            submitted_at=submitted_at,
            completed_at=completed_at,
            graded_at=completed_at,
        )

        self.db.add(row)
        self.db.flush()
        return row

    def get_progress(self, *, assignment_id=112, student_id=230):
        return (
            self.db.query(UserLabProgress)
            .filter(
                UserLabProgress.assignment_id == assignment_id,
                UserLabProgress.user_id == student_id,
                UserLabProgress.module_id == MODULE_ID,
            )
            .one()
        )

    def project(self, row):
        return project_sysadmin_assignment_progress(
            self.db,
            submission=row,
            marketplace_lab_id=MARKETPLACE_LAB_ID,
        )

    def test_fail_then_pass_becomes_completed_with_best_score(self):
        failed = self.add_attempt(
            status="FAIL",
            score=45,
            minute=0,
        )
        self.project(failed)

        progress = self.get_progress()
        self.assertEqual(progress.status, "STARTED")
        self.assertEqual(progress.score, 45)
        self.assertEqual(progress.attempts, 1)
        self.assertFalse(progress.flag_correct)
        self.assertIsNone(progress.completed_at)

        passed = self.add_attempt(
            status="PASS",
            score=100,
            minute=2,
        )
        self.project(passed)

        progress = self.get_progress()
        self.assertEqual(progress.status, "COMPLETED")
        self.assertEqual(progress.score, 100)
        self.assertEqual(progress.attempts, 2)
        self.assertTrue(progress.flag_correct)
        self.assertEqual(
            progress.completed_at,
            passed.completed_at,
        )

    def test_pass_then_fail_never_regresses_completion(self):
        passed = self.add_attempt(
            status="PASS",
            score=100,
            minute=0,
        )
        self.project(passed)

        first_completed_at = self.get_progress().completed_at

        failed = self.add_attempt(
            status="FAIL",
            score=45,
            minute=3,
        )
        self.project(failed)

        progress = self.get_progress()

        self.assertEqual(progress.status, "COMPLETED")
        self.assertEqual(progress.score, 100)
        self.assertEqual(progress.attempts, 2)
        self.assertTrue(progress.flag_correct)
        self.assertEqual(
            progress.completed_at,
            first_completed_at,
        )
        self.assertEqual(
            progress.last_submission,
            f"sysadmin_submission:{failed.id}",
        )

    def test_repeated_projection_is_idempotent(self):
        passed = self.add_attempt(
            status="PASS",
            score=100,
            minute=0,
        )

        first = self.project(passed)
        second = self.project(passed)

        self.assertTrue(first.created)
        self.assertFalse(second.created)

        self.assertEqual(
            self.db.query(UserLabProgress).count(),
            1,
        )

        progress = self.get_progress()

        self.assertEqual(progress.attempts, 1)
        self.assertEqual(progress.score, 100)
        self.assertEqual(progress.status, "COMPLETED")

    def test_assignments_are_isolated(self):
        assignment_112_pass = self.add_attempt(
            assignment_id=112,
            status="PASS",
            score=100,
            minute=0,
        )

        assignment_113_fail = self.add_attempt(
            assignment_id=113,
            status="FAIL",
            score=30,
            minute=1,
        )

        self.project(assignment_112_pass)
        self.project(assignment_113_fail)

        progress_112 = self.get_progress(
            assignment_id=112
        )
        progress_113 = self.get_progress(
            assignment_id=113
        )

        self.assertEqual(
            progress_112.status,
            "COMPLETED",
        )
        self.assertEqual(
            progress_112.score,
            100,
        )
        self.assertEqual(
            progress_112.attempts,
            1,
        )

        self.assertEqual(
            progress_113.status,
            "STARTED",
        )
        self.assertEqual(
            progress_113.score,
            30,
        )
        self.assertEqual(
            progress_113.attempts,
            1,
        )

    def test_unassigned_submission_is_not_projected(self):
        row = self.add_attempt(
            assignment_id=None,
            status="PASS",
            score=100,
            minute=0,
        )

        result = self.project(row)

        self.assertIsNone(result)
        self.assertEqual(
            self.db.query(UserLabProgress).count(),
            0,
        )


if __name__ == "__main__":
    unittest.main()
