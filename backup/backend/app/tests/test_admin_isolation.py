import unittest
from unittest.mock import patch

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.capabilities import Capability
from app.models.base import Base
from app.models.college import College
from app.models.admin_models import Organization
from app.models.admin_student_roster import AdminStudentRoster
from app.models.group import Group
from app.models.rbac import UserRoleBinding
from app.models.user import User
from app.models.user_affiliation import UserAffiliation
from app.services.authorization_service import AuthorizationService
from app.api.v1.endpoints.admin_api import (
    BulkAddGroupMembersRequest,
    UserUpdateRequest,
    bulk_add_group_members,
    update_admin_user,
)
from scripts.backfill_admin_isolation import (
    add_roster_link,
    is_manager_identity,
    is_student_like,
)


class AdminIsolationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )

        # Create only the tables required by this authorization test.
        # Loading the entire application metadata also loads unrelated legacy
        # CTF indexes, one of which currently has a duplicate index definition.
        required_tables = [
            Organization.__table__,
            College.__table__,
            Group.__table__,
            User.__table__,
            UserAffiliation.__table__,
            UserRoleBinding.__table__,
            AdminStudentRoster.__table__,
        ]
        Base.metadata.create_all(self.engine, tables=required_tables)
        Session = sessionmaker(bind=self.engine)
        self.db = Session()

        self.org = Organization(name="Isolation Test University", institution_type="University", status="ACTIVE")
        self.db.add(self.org)
        self.db.flush()
        self.admin_a = self._user("admin-a@example.edu", "admin", "admin")
        self.admin_b = self._user("admin-b@example.edu", "admin", "admin")
        self.global_admin = self._user("global@example.edu", "SYSTEM_ADMIN", "admin")
        self.student_a = self._user("student-a@example.edu", "user", "student")
        self.student_b = self._user("student-b@example.edu", "user", "student")
        self.db.flush()

        for admin in (self.admin_a, self.admin_b):
            self.db.add(UserRoleBinding(
                user_id=admin.id,
                role="ADMIN",
                scope_type="ORGANIZATION",
                scope_key=f"ORGANIZATION:{self.org.id}",
                organization_id=self.org.id,
                is_active=True,
            ))
        self.db.add(UserRoleBinding(
            user_id=self.global_admin.id,
            role="SYSTEM_ADMIN",
            scope_type="GLOBAL",
            scope_key="GLOBAL",
            is_active=True,
        ))

        self.unscoped_admin = self._user(
            "unscoped@example.edu", "admin", "admin"
        )
        self.db.flush()
        self.db.add(UserRoleBinding(
            user_id=self.unscoped_admin.id,
            role="ADMIN",
            scope_type="UNSCOPED",
            scope_key="UNSCOPED",
            organization_id=None,
            college_id=None,
            is_active=True,
        ))
        self.db.add(UserAffiliation(
            user_id=self.unscoped_admin.id,
            affiliation_type="organization",
            organization_id=self.org.id,
            is_primary=True,
        ))
        # Admins deliberately share the same tenant in these tests. Tenant
        # membership alone must not grant peer-account or roster access.
        for admin in (self.admin_a, self.admin_b):
            self.db.add(UserAffiliation(
                user_id=admin.id,
                affiliation_type="organization",
                organization_id=self.org.id,
                is_primary=True,
            ))

        for student in (self.student_a, self.student_b):
            self.db.add(UserAffiliation(
                user_id=student.id,
                affiliation_type="organization",
                organization_id=self.org.id,
                is_primary=True,
            ))
        self.db.add_all([
            AdminStudentRoster(manager_user_id=self.admin_a.id, student_user_id=self.student_a.id),
            AdminStudentRoster(manager_user_id=self.admin_b.id, student_user_id=self.student_b.id),
        ])
        self.group_a = Group(name="A Group", organization_id=self.org.id, owner_user_id=self.admin_a.id)
        self.group_b = Group(name="B Group", organization_id=self.org.id, owner_user_id=self.admin_b.id)
        self.db.add_all([self.group_a, self.group_b])
        self.db.flush()
        self.student_a.group_id = self.group_a.id
        self.student_b.group_id = self.group_b.id
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _user(self, email, role, account_type):
        row = User(email=email, name=email.split("@")[0], password_hash="test", role=role, account_type=account_type, is_active=True)
        self.db.add(row)
        return row

    def test_same_org_does_not_grant_cross_admin_student_access(self):
        self.assertTrue(AuthorizationService.can_access_user(self.db, self.admin_a, self.student_a, Capability.ROSTER_VIEW))
        self.assertFalse(AuthorizationService.can_access_user(self.db, self.admin_b, self.student_a, Capability.ROSTER_VIEW))
        with self.assertRaises(HTTPException) as ctx:
            AuthorizationService.assert_user_access(self.db, self.admin_b, self.student_a.id, Capability.ROSTER_MANAGE)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_same_org_does_not_grant_cross_admin_group_access(self):
        self.assertTrue(AuthorizationService.can_access_group(self.db, self.admin_a, self.group_a, Capability.ROSTER_VIEW))
        self.assertFalse(AuthorizationService.can_access_group(self.db, self.admin_b, self.group_a, Capability.ROSTER_VIEW))
        with self.assertRaises(HTTPException) as ctx:
            AuthorizationService.assert_group_access(self.db, self.admin_b, self.group_a.id, Capability.ROSTER_MANAGE)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_ordinary_admin_cannot_manage_own_admin_identity_as_user_resource(self):
        self.assertFalse(
            AuthorizationService.can_access_user(
                self.db,
                self.admin_a,
                self.admin_a,
                Capability.ROSTER_MANAGE,
            )
        )

    def test_owned_student_cannot_be_promoted_to_admin_by_ordinary_admin(self):
        with patch(
            "app.api.v1.endpoints.admin_api.get_admin_org_id",
            return_value=self.org.id,
        ):
            with self.assertRaises(HTTPException) as ctx:
                update_admin_user(
                    user_id=self.student_a.id,
                    data=UserUpdateRequest(role="admin"),
                    request=None,
                    current_user=self.admin_a,
                    db=self.db,
                )

        self.assertEqual(ctx.exception.status_code, 403)
        self.db.refresh(self.student_a)
        self.assertEqual(self.student_a.role, "user")

    def test_bulk_group_add_rejects_peer_managed_student(self):
        original_group_id = self.student_b.group_id

        with self.assertRaises(HTTPException) as ctx:
            bulk_add_group_members(
                group_id=self.group_a.id,
                data=BulkAddGroupMembersRequest(
                    user_ids=[self.student_b.id]
                ),
                background_tasks=BackgroundTasks(),
                current_user=self.admin_a,
                db=self.db,
            )

        self.assertEqual(ctx.exception.status_code, 403)

        self.db.expire_all()
        student_b = (
            self.db.query(User)
            .filter(User.id == self.student_b.id)
            .one()
        )
        self.assertEqual(student_b.group_id, original_group_id)

    def test_backfill_manager_identity_is_fail_closed(self):
        self.assertTrue(
            is_manager_identity(self.admin_a, "admin")
        )
        self.assertFalse(
            is_manager_identity(self.student_a, "student")
        )
        self.assertFalse(
            is_manager_identity(self.admin_a, "student")
        )

    def test_backfill_student_target_filter(self):
        self.assertTrue(is_student_like(self.student_a))
        self.assertFalse(is_student_like(self.admin_a))

    def test_backfill_deduplicates_manual_and_group_roster_evidence(self):
        # Reproduce production SessionLocal behavior where pending inserts are
        # not visible to the next database query before the final flush.
        original_autoflush = self.db.autoflush
        self.db.autoflush = False
        try:
            seen_links = set()

            # First evidence path: historical User Creation audit.
            self.assertTrue(
                add_roster_link(
                    self.db,
                    self.admin_a.id,
                    self.student_b.id,
                    seen_links,
                )
            )

            # Second evidence path: the same student belongs to a group owned
            # by the same manager. This must reinforce, not duplicate, the row.
            self.assertFalse(
                add_roster_link(
                    self.db,
                    self.admin_a.id,
                    self.student_b.id,
                    seen_links,
                )
            )

            self.db.flush()

            rows = (
                self.db.query(AdminStudentRoster)
                .filter(
                    AdminStudentRoster.manager_user_id == self.admin_a.id,
                    AdminStudentRoster.student_user_id == self.student_b.id,
                )
                .all()
            )
            self.assertEqual(len(rows), 1)
        finally:
            self.db.autoflush = original_autoflush

    def test_peer_admin_is_not_user_resource_accessible(self):
        self.assertFalse(
            AuthorizationService.can_access_user(
                self.db,
                self.admin_a,
                self.admin_b,
                Capability.ROSTER_MANAGE,
            )
        )

        with self.assertRaises(HTTPException) as ctx:
            AuthorizationService.assert_user_access(
                self.db,
                self.admin_a,
                self.admin_b.id,
                Capability.ROSTER_MANAGE,
            )

        self.assertEqual(ctx.exception.status_code, 403)

    def test_managed_student_cannot_be_claimed_by_peer_admin(self):
        self.assertTrue(
            AuthorizationService.can_claim_student_roster(
                self.db,
                self.admin_a,
                self.student_a.id,
            )
        )
        self.assertFalse(
            AuthorizationService.can_claim_student_roster(
                self.db,
                self.admin_b,
                self.student_a.id,
            )
        )

    def test_unscoped_binding_does_not_bypass_resource_ownership(self):
        self.assertFalse(
            AuthorizationService.can_access_user(
                self.db,
                self.unscoped_admin,
                self.student_a,
                Capability.ROSTER_VIEW,
            )
        )
        self.assertFalse(
            AuthorizationService.can_access_group(
                self.db,
                self.unscoped_admin,
                self.group_a,
                Capability.ROSTER_VIEW,
            )
        )

    def test_global_admin_retains_platform_access(self):
        self.assertTrue(
            AuthorizationService.can_access_user(
                self.db,
                self.global_admin,
                self.student_a,
                Capability.ROSTER_VIEW,
            )
        )
        self.assertTrue(
            AuthorizationService.can_access_group(
                self.db,
                self.global_admin,
                self.group_b,
                Capability.ROSTER_VIEW,
            )
        )
        self.assertTrue(
            AuthorizationService.can_claim_student_roster(
                self.db,
                self.global_admin,
                self.student_a.id,
            )
        )

    def test_explicit_shared_student_is_supported(self):
        self.db.add(AdminStudentRoster(manager_user_id=self.admin_b.id, student_user_id=self.student_a.id))
        self.db.commit()
        self.assertTrue(AuthorizationService.can_access_user(self.db, self.admin_b, self.student_a, Capability.ROSTER_VIEW))

    def test_unowned_group_fails_closed(self):
        group = Group(name="Legacy Unowned", organization_id=self.org.id, owner_user_id=None)
        self.db.add(group)
        self.db.commit()
        self.assertFalse(AuthorizationService.can_access_group(self.db, self.admin_a, group, Capability.ROSTER_VIEW))


if __name__ == "__main__":
    unittest.main()
