from __future__ import annotations

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services.sysadmin_grading.config import SysadminGradingSettings
from app.services.sysadmin_grading.executor import (
    ECSGradingExecutor,
    GradingExecutionError,
    build_grading_executor,
)
from app.services.sysadmin_grading.question_bank import QuestionBankRepository


class FakeS3:
    def __init__(self, result: dict):
        self.result = result
        self.puts: list[dict] = []
        self.deletes: list[str] = []

    def put_object(self, **kwargs):
        self.puts.append(kwargs)
        return {"ETag": '"fake"'}

    def get_object(self, **kwargs):
        return {"Body": io.BytesIO(json.dumps(self.result).encode("utf-8"))}

    def delete_object(self, **kwargs):
        self.deletes.append(kwargs["Key"])
        return {}


class FakePresignS3:
    def generate_presigned_url(self, operation, *, Params, ExpiresIn, HttpMethod=None):
        suffix = "get" if operation == "get_object" else "put"
        return f"https://bucket.s3.ap-south-1.amazonaws.com/{Params['Key']}?signed={suffix}"


class FakeECS:
    def __init__(self, exit_code: int = 0):
        self.exit_code = exit_code
        self.run_calls: list[dict] = []

    def run_task(self, **kwargs):
        self.run_calls.append(kwargs)
        return {
            "tasks": [{"taskArn": "arn:aws:ecs:ap-south-1:123:task/cluster/task-1"}],
            "failures": [],
        }

    def describe_tasks(self, **kwargs):
        return {
            "tasks": [
                {
                    "taskArn": kwargs["tasks"][0],
                    "lastStatus": "STOPPED",
                    "stoppedReason": "Essential container in task exited",
                    "containers": [
                        {
                            "name": "rhsa-grading-worker",
                            "exitCode": self.exit_code,
                        }
                    ],
                }
            ],
            "failures": [],
        }

    def stop_task(self, **kwargs):
        return {}


class EventuallyConsistentECS(FakeECS):
    def __init__(self, exit_code: int = 0):
        super().__init__(exit_code=exit_code)
        self.describe_calls = 0

    def describe_tasks(self, **kwargs):
        self.describe_calls += 1

        if self.describe_calls == 1:
            return {
                "tasks": [],
                "failures": [
                    {
                        "arn": kwargs["tasks"][0],
                        "reason": "MISSING",
                    }
                ],
            }

        return super().describe_tasks(**kwargs)


class SysadminECSExecutorTests(unittest.TestCase):
    def _bank(self, root: Path) -> None:
        lab = root / "labs" / "03-users-groups" / "RHSA-USERS-001"
        lab.mkdir(parents=True)
        for name in ("lab.yaml", "setup.sh", "grader.py", "question.md"):
            (lab / name).write_text("test\n", encoding="utf-8")

    def _settings(self, root: Path) -> SysadminGradingSettings:
        return SysadminGradingSettings(
            enabled=True,
            question_bank_root=root,
            python_bin="python3",
            execution_timeout_seconds=120,
            max_submission_bytes=65536,
            executor="ecs",
            aws_region="ap-south-1",
            ecs_cluster="cyberrange-sysadmin-grading",
            ecs_task_definition="cyberrange-sysadmin-grader:1",
            ecs_capacity_provider="sysadmin-grader-capacity",
            ecs_container_name="rhsa-grading-worker",
            ecs_task_timeout_seconds=600,
            s3_bucket="cyberrange-test-bucket",
            s3_url_ttl_seconds=900,
        )

    def _result(self, *, passed: bool, score: int) -> dict:
        return {
            "contract_version": 1,
            "runner_version": "0.4.0",
            "lab_id": "RHSA-USERS-001",
            "title": "User and Group Provisioning",
            "lab_version": 1,
            "score": score,
            "max_score": 100,
            "pass_score": 70,
            "passed": passed,
            "tests": [],
            "metadata": {
                "worker": {
                    "question_bank_revision": "f29e9ae93202",
                }
            },
        }

    def test_factory_selects_ecs_executor(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            settings = self._settings(root)
            repo = QuestionBankRepository(root)
            with patch("app.services.sysadmin_grading.executor.boto3.client"):
                executor = build_grading_executor(settings, repo)
            self.assertIsInstance(executor, ECSGradingExecutor)

    def test_ecs_executor_accepts_academic_fail_with_worker_exit_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            settings = self._settings(root)
            repo = QuestionBankRepository(root)
            s3 = FakeS3(self._result(passed=False, score=60))
            ecs = FakeECS(exit_code=0)
            executor = ECSGradingExecutor(
                settings,
                repo,
                s3_client=s3,
                s3_presign_client=FakePresignS3(),
                ecs_client=ecs,
                sleep_fn=lambda _: None,
            )

            with patch.object(SysadminGradingSettings, "assert_ready", return_value=None):
                execution = executor.grade(
                    lab=repo.resolve_lab("RHSA-USERS-001"),
                    filename="answer.sh",
                    content="#!/bin/bash\nexit 0\n",
                    seed=424242,
                )

            self.assertFalse(execution.result["passed"])
            self.assertEqual(execution.result["score"], 60)
            self.assertEqual(execution.question_bank_commit, "f29e9ae93202")
            self.assertEqual(len(s3.puts), 1)
            self.assertEqual(len(s3.deletes), 2)

            overrides = ecs.run_calls[0]["overrides"]["containerOverrides"][0]
            env = {item["name"]: item["value"] for item in overrides["environment"]}
            self.assertEqual(env["RHSA_LAB_ID"], "RHSA-USERS-001")
            self.assertEqual(env["RHSA_SEED"], "424242")
            self.assertTrue(env["RHSA_SUBMISSION_URL"].startswith("https://"))
            self.assertTrue(env["RHSA_RESULT_URL"].startswith("https://"))


    def test_ecs_executor_retries_initial_missing_from_eventual_consistency(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)

            settings = self._settings(root)
            repo = QuestionBankRepository(root)

            s3 = FakeS3(
                self._result(
                    passed=True,
                    score=100,
                )
            )
            ecs = EventuallyConsistentECS(exit_code=0)

            executor = ECSGradingExecutor(
                settings,
                repo,
                s3_client=s3,
                s3_presign_client=FakePresignS3(),
                ecs_client=ecs,
                sleep_fn=lambda _: None,
            )

            with patch.object(
                SysadminGradingSettings,
                "assert_ready",
                return_value=None,
            ):
                execution = executor.grade(
                    lab=repo.resolve_lab("RHSA-USERS-001"),
                    filename="answer.sh",
                    content="#!/bin/bash\\nexit 0\\n",
                    seed=424242,
                )

            self.assertTrue(execution.result["passed"])
            self.assertEqual(execution.result["score"], 100)
            self.assertEqual(ecs.describe_calls, 2)

    def test_ecs_executor_treats_nonzero_worker_exit_as_infrastructure_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            settings = self._settings(root)
            repo = QuestionBankRepository(root)
            s3 = FakeS3({
                "status": "ERROR",
                "error": "Unable to download submission",
            })
            executor = ECSGradingExecutor(
                settings,
                repo,
                s3_client=s3,
                s3_presign_client=FakePresignS3(),
                ecs_client=FakeECS(exit_code=1),
                sleep_fn=lambda _: None,
            )

            with (
                patch.object(SysadminGradingSettings, "assert_ready", return_value=None),
                self.assertRaises(GradingExecutionError) as ctx,
            ):
                executor.grade(
                    lab=repo.resolve_lab("RHSA-USERS-001"),
                    filename="answer.sh",
                    content="#!/bin/bash\nexit 0\n",
                    seed=1,
                )

            self.assertIn("exit_code=1", str(ctx.exception))
            self.assertIn("Unable to download submission", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
