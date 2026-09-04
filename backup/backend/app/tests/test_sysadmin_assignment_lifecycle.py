from datetime import timedelta
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.assignment_time import utc_now_naive
from app.models.assignment import Assignment
from app.models.group import Group
from app.models.lab import Lab
from app.models.user import User
from app.services.sysadmin_grading.assignment_lifecycle import (
    assert_workspace_assignment_context,
    resolve_current_sysadmin_assignment_id,
    stop_sysadmin_assignment_workspaces,
)


MARKETPLACE_LAB_ID = "linux-sysadmin-lab"


class FakeSettings:
    marketplace_lab_id = MARKETPLACE_LAB_ID


class FakeWorkspaceService:
    def __init__(self):
        self.calls = []

    def stop(self, *, user_id, reason):
        self.calls.append((user_id, reason))
        return True


class SysadminAssignmentLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")

        Group.__table__.create(self.engine)
        User.__table__.create(self.engine)
        Lab.__table__.create(self.engine)
        Assignment.__table__.create(self.engine)

        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.db.add(
            Group(
                id=29,
                name="Lifecycle Test Group",
                max_size=40,
            )
        )

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
                description="Lifecycle test lab",
                price_inr=0,
                rating=0,
                review_count=0,
                registry_path="/tmp/linux-sysadmin-lab",
                price_per_hour=0,
            )
        )

        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_assignment(
        self,
        *,
        assignment_id,
        status="Scheduled",
        start_delta=-5,
        end_delta=30,
    ):
        now = utc_now_naive()

        row = Assignment(
            id=assignment_id,
            lab_id=MARKETPLACE_LAB_ID,
            group_id=29,
            start_datetime=now + timedelta(minutes=start_delta),
            end_datetime=now + timedelta(minutes=end_delta),
            status=status,
        )

        self.db.add(row)
        self.db.commit()
        return row

    def test_active_assignment_is_resolved(self):
        self.add_assignment(
            assignment_id=113,
        )

        assignment_id = resolve_current_sysadmin_assignment_id(
            self.db,
            user=self.student,
            marketplace_lab_id=MARKETPLACE_LAB_ID,
        )

        self.assertEqual(assignment_id, 113)

    def test_completed_assignment_cannot_fall_back_to_unassigned(self):
        self.add_assignment(
            assignment_id=113,
            status="Completed",
            end_delta=-1,
        )

        with self.assertRaises(HTTPException) as ctx:
            resolve_current_sysadmin_assignment_id(
                self.db,
                user=self.student,
                marketplace_lab_id=MARKETPLACE_LAB_ID,
            )

        self.assertEqual(ctx.exception.status_code, 409)

    def test_future_assignment_cannot_fall_back_to_unassigned(self):
        self.add_assignment(
            assignment_id=114,
            status="Scheduled",
            start_delta=10,
            end_delta=60,
        )

        with self.assertRaises(HTTPException) as ctx:
            resolve_current_sysadmin_assignment_id(
                self.db,
                user=self.student,
                marketplace_lab_id=MARKETPLACE_LAB_ID,
            )

        self.assertEqual(ctx.exception.status_code, 409)

    def test_no_assignment_still_allows_true_unassigned_context(self):
        assignment_id = resolve_current_sysadmin_assignment_id(
            self.db,
            user=self.student,
            marketplace_lab_id=MARKETPLACE_LAB_ID,
        )

        self.assertIsNone(assignment_id)

    def test_stale_workspace_assignment_is_rejected(self):
        self.add_assignment(
            assignment_id=114,
        )

        with self.assertRaises(HTTPException) as ctx:
            assert_workspace_assignment_context(
                self.db,
                user=self.student,
                marketplace_lab_id=MARKETPLACE_LAB_ID,
                workspace_assignment_id=113,
            )

        self.assertEqual(ctx.exception.status_code, 409)

    def test_kill_cleanup_targets_every_group_member(self):
        assignment = self.add_assignment(
            assignment_id=113,
        )

        self.db.add(
            User(
                id=231,
                email="second@example.com",
                name="Second Student",
                password_hash="test-password-hash",
                role="student",
                group_id=29,
            )
        )

        self.db.add(
            User(
                id=999,
                email="other@example.com",
                name="Other Group",
                password_hash="test-password-hash",
                role="student",
                group_id=None,
            )
        )

        self.db.commit()

        service = FakeWorkspaceService()

        stopped = stop_sysadmin_assignment_workspaces(
            self.db,
            assignment=assignment,
            reason="test kill",
            settings=FakeSettings(),
            workspace_service=service,
        )

        self.assertEqual(stopped, 2)
        self.assertEqual(
            [user_id for user_id, _ in service.calls],
            [230, 231],
        )


if __name__ == "__main__":
    unittest.main()
