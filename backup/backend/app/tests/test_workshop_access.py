"""Workshop assignment regression tests; all database state is in-memory.

The marketplace helper is loaded in isolation to avoid application startup and
external configuration. End-to-end endpoint checks remain a staging gate.
"""
import ast
from datetime import timedelta
from pathlib import Path
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import HTTPException, status
from app.tests import test_sysadmin_assignment_lifecycle as fixtures
from app.models.assignment import Assignment
from app.models.lab import Lab
from app.core.assignment_time import utc_now_naive
from app.services.sysadmin_grading.assignment_lifecycle import (
    resolve_current_sysadmin_assignment_id, assert_workspace_assignment_context,
)
from app.services.sysadmin_grading.workshop import WORKSHOP_ID


class WorkshopAccessTests(unittest.TestCase):
    def setUp(self):
        fixtures.SysadminAssignmentLifecycleTests.setUp(self)
        self.db.add(Lab(id=WORKSHOP_ID, name='Workshop', category='Linux',
                        difficulty='Mixed', registry_path='workshop'))
        self.db.commit()
        source = Path(__file__).resolve().parents[1] / 'api/v1/endpoints/sysadmin_grading_api.py'
        function = next(n for n in ast.parse(source.read_text()).body
                        if isinstance(n, ast.FunctionDef) and n.name == '_assert_marketplace_access')
        namespace = dict(SysadminGradingSettings=object, User=object, Session=object,
                         WORKSHOP_ID=WORKSHOP_ID, HTTPException=HTTPException, status=status,
                         resolve_current_sysadmin_assignment_id=resolve_current_sysadmin_assignment_id)
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), 'exec'), namespace)
        self.access = namespace['_assert_marketplace_access']
        self.market = ModuleType('app.api.v1.endpoints.labs_api')
        self.market._get_sysadmin_assignments = lambda db: [dict(lab_id=WORKSHOP_ID, fixed_rate=0)]
        self.market._get_purchased_lab = lambda *args: object()
        mocked = patch.dict('sys.modules', {self.market.__name__: self.market})
        mocked.start()
        self.addCleanup(mocked.stop)
        self.settings = SimpleNamespace(marketplace_lab_id=WORKSHOP_ID,
                                        workspace_require_marketplace_access=True)

    tearDown = fixtures.SysadminAssignmentLifecycleTests.tearDown

    def assign(self, **changes):
        now = utc_now_naive()
        values = dict(id=901, lab_id=WORKSHOP_ID, group_id=self.student.group_id,
                      start_datetime=now-timedelta(minutes=5),
                      end_datetime=now+timedelta(minutes=30), status='Scheduled')
        values.update(changes)
        row = Assignment(**values)
        self.db.add(row)
        self.db.commit()
        return row

    def deny(self, expected=403):
        with self.assertRaises(HTTPException) as caught:
            self.access(self.settings, self.student, self.db)
        self.assertEqual(caught.exception.status_code, expected)

    def test_free_portal_does_not_allow_unassigned_student(self):
        self.deny()

    def test_purchase_does_not_replace_assignment(self):
        self.market._get_sysadmin_assignments = lambda db: [dict(lab_id=WORKSHOP_ID, fixed_rate=100)]
        self.deny()

    def test_disabled_marketplace_flag_does_not_bypass_workshop_assignment(self):
        self.settings.workspace_require_marketplace_access = False
        self.deny()

    def test_wrong_group_is_denied(self):
        self.assign()
        self.student.group_id = None
        self.db.commit()
        self.deny()

    def test_active_group_assignment_is_allowed(self):
        self.assign()
        self.access(self.settings, self.student, self.db)
        self.assertEqual(resolve_current_sysadmin_assignment_id(
            self.db, user=self.student, marketplace_lab_id=WORKSHOP_ID), 901)

    def test_direct_student_assignment_is_allowed(self):
        self.assign(group_id=None, student_id=self.student.id)
        self.access(self.settings, self.student, self.db)

    def test_expired_assignment_is_denied(self):
        self.assign(end_datetime=utc_now_naive()-timedelta(minutes=1))
        self.deny(409)

    def test_future_assignment_is_denied(self):
        self.assign(start_datetime=utc_now_naive()+timedelta(minutes=10))
        self.deny(409)

    def test_deleted_assignment_is_denied(self):
        self.assign(deleted_at=utc_now_naive())
        self.deny()

    def test_unassigned_workshop_workspace_is_denied(self):
        with self.assertRaises(HTTPException) as caught:
            assert_workspace_assignment_context(self.db, user=self.student,
                marketplace_lab_id=WORKSHOP_ID, workspace_assignment_id=None)
        self.assertEqual(caught.exception.status_code, 403)

    def test_original_linux_unassigned_context_is_preserved(self):
        self.assertIsNone(resolve_current_sysadmin_assignment_id(
            self.db, user=self.student, marketplace_lab_id='linux-sysadmin-lab'))
