from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.sysadmin_grading.config import SysadminGradingSettings
from app.services.sysadmin_grading.executor import LocalDockerExecutor
from app.services.sysadmin_grading.question_bank import QuestionBankError, QuestionBankRepository
from app.services.sysadmin_grading.service import SubmissionValidationError, SysadminGradingService
from app.services.sysadmin_grading.workspace_tokens import (
    WorkspaceTokenError,
    create_workspace_submission_token,
    decode_workspace_submission_token,
)
import jwt
from app.core.config import settings as app_settings


class SysadminGradingMVPTests(unittest.TestCase):
    def _bank(self, root: Path) -> Path:
        lab = root / "labs" / "03-users-groups" / "RHSA-USERS-001"
        lab.mkdir(parents=True)
        for name in ("lab.yaml", "setup.sh", "grader.py", "question.md"):
            (lab / name).write_text("test\n", encoding="utf-8")
        (root / "grader").mkdir()
        return lab

    def test_question_bank_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            repo = QuestionBankRepository(root)
            with self.assertRaises(Exception):
                repo.resolve_lab("../../etc")

    def test_submission_validation_rejects_paths_and_non_shell_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            settings = SysadminGradingSettings(
                enabled=True,
                question_bank_root=root,
                python_bin="python3",
                execution_timeout_seconds=120,
                max_submission_bytes=65536,
            )
            service = SysadminGradingService(settings)
            with self.assertRaises(SubmissionValidationError):
                service.validate_submission(
                    lab_id="RHSA-USERS-001", filename="../answer.sh", content="echo ok\n"
                )
            with self.assertRaises(SubmissionValidationError):
                service.validate_submission(
                    lab_id="RHSA-USERS-001", filename="answer.txt", content="echo ok\n"
                )

    def test_executor_accepts_runner_exit_2_as_academic_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lab = self._bank(root)
            runner = root / "grader" / "runner.py"
            runner.write_text("# fake runner\n", encoding="utf-8")
            settings = SysadminGradingSettings(
                enabled=True,
                question_bank_root=root,
                python_bin="python3",
                execution_timeout_seconds=120,
                max_submission_bytes=65536,
            )
            repo = QuestionBankRepository(root)
            executor = LocalDockerExecutor(settings, repo)
            fake_result = {
                "contract_version": 1,
                "runner_version": "test",
                "lab_id": "RHSA-USERS-001",
                "title": "Test",
                "lab_version": "1",
                "score": 60,
                "max_score": 100,
                "pass_score": 70,
                "passed": False,
                "tests": [],
                "metadata": {},
            }

            class CP:
                returncode = 2
                stdout = "graded"
                stderr = ""

            def fake_run(cmd, **kwargs):
                out_index = cmd.index("--json-out") + 1
                Path(cmd[out_index]).write_text(json.dumps(fake_result), encoding="utf-8")
                return CP()

            with (
                patch.object(SysadminGradingSettings, "assert_ready", return_value=None),
                patch("app.services.sysadmin_grading.executor.subprocess.run", side_effect=fake_run),
            ):
                execution = executor.grade(
                    lab=repo.resolve_lab("RHSA-USERS-001"),
                    filename="answer.sh",
                    content="#!/bin/bash\nexit 0\n",
                    seed=123,
                )
            self.assertFalse(execution.result["passed"])
            self.assertEqual(execution.result["score"], 60)


    def test_available_labs_reject_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            duplicate = root / "labs" / "legacy-users" / "RHSA-USERS-001"
            duplicate.mkdir(parents=True)
            for name in ("lab.yaml", "setup.sh", "grader.py", "question.md"):
                (duplicate / name).write_text("test\n", encoding="utf-8")
            repo = QuestionBankRepository(root)
            with self.assertRaises(QuestionBankError):
                repo.available_lab_ids()

    def test_readiness_rejects_missing_grader_python(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            (root / "grader" / "runner.py").write_text("# runner\n", encoding="utf-8")
            settings = SysadminGradingSettings(
                enabled=True,
                question_bank_root=root,
                python_bin=str(root / "missing-python"),
                execution_timeout_seconds=120,
                max_submission_bytes=65536,
            )
            with self.assertRaises(Exception) as ctx:
                settings.assert_ready()
            self.assertIn("grader Python does not exist", str(ctx.exception))

    def test_workspace_token_is_lab_scoped_and_not_an_access_token(self):
        token, _ = create_workspace_submission_token(
            user_id=42,
            lab_id="RHSA-USERS-001",
            workspace_id="ws-test",
            ttl_minutes=30,
        )
        claims = decode_workspace_submission_token(token)
        self.assertEqual(claims.user_id, 42)
        self.assertEqual(claims.lab_id, "RHSA-USERS-001")
        self.assertEqual(claims.workspace_id, "ws-test")
        # Separate signing material means the application's normal JWT signing
        # key cannot validate this workspace credential.
        with self.assertRaises(jwt.InvalidTokenError):
            jwt.decode(token, app_settings.SECRET_KEY, algorithms=[app_settings.ALGORITHM])

    def test_normal_access_token_is_not_a_workspace_token(self):
        payload = {
            "sub": "student@example.com",
            "user_id": 42,
            "type": "access",
        }
        token = jwt.encode(payload, app_settings.SECRET_KEY, algorithm=app_settings.ALGORITHM)
        with self.assertRaises(WorkspaceTokenError):
            decode_workspace_submission_token(token)


if __name__ == "__main__":
    unittest.main()
