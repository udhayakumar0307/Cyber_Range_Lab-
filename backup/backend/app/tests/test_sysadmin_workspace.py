from __future__ import annotations

import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from app.services.sysadmin_grading.config import (
    GradingConfigurationError,
    SysadminGradingSettings,
)
from app.services.sysadmin_grading.question_bank import QuestionBankRepository
from app.services.sysadmin_grading.workspace import SysadminWorkspaceService


class FakeWorkspaceECS:
    def __init__(self):
        self.run_kwargs = None
        self.describe_calls = 0
        self.stopped = []
        self.task_arn = (
            "arn:aws:ecs:ap-south-1:766363046973:task/"
            "cyberrange-sysadmin-workspaces/abc123"
        )

    def run_task(self, **kwargs):
        self.run_kwargs = kwargs
        return {"tasks": [{"taskArn": self.task_arn}], "failures": []}

    def describe_tasks(self, **kwargs):
        self.describe_calls += 1
        if self.describe_calls == 1:
            return {
                "tasks": [],
                "failures": [{"arn": self.task_arn, "reason": "MISSING"}],
            }
        return {
            "tasks": [
                {
                    "taskArn": self.task_arn,
                    "lastStatus": "RUNNING",
                    "attachments": [
                        {
                            "type": "ElasticNetworkInterface",
                            "details": [
                                {"name": "privateIPv4Address", "value": "172.31.10.55"}
                            ],
                        }
                    ],
                    "containers": [{"name": "rhsa-workspace"}],
                }
            ],
            "failures": [],
        }

    def stop_task(self, **kwargs):
        self.stopped.append(kwargs)
        return {}


class SysadminWorkspaceTests(unittest.TestCase):
    def _bank(self, root: Path) -> None:
        lab = root / "labs" / "03-users-groups" / "RHSA-USERS-001"
        lab.mkdir(parents=True)
        (lab / "lab.yaml").write_text("id: RHSA-USERS-001\n", encoding="utf-8")
        (lab / "setup.sh").write_text("#!/bin/bash\n", encoding="utf-8")
        (lab / "grader.py").write_text("# hidden\n", encoding="utf-8")
        (lab / "question.md").write_text("# Question\n", encoding="utf-8")

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
            ecs_poll_interval_seconds=2,
            s3_bucket="grading-bucket",
            s3_url_ttl_seconds=900,
            workspace_enabled=True,
            workspace_ecs_cluster="cyberrange-sysadmin-workspaces",
            workspace_task_definition="cyberrange-sysadmin-workspace:1",
            workspace_container_name="rhsa-workspace",
            workspace_subnet_ids=("subnet-a", "subnet-b"),
            workspace_security_group_ids=("sg-workspace",),
            workspace_assign_public_ip=True,
            workspace_api_base="http://cyberrange.test",
            workspace_start_timeout_seconds=60,
            workspace_poll_interval_seconds=1,
        )

    def test_production_allows_rfc1918_http_workspace_api_base(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)

            settings = replace(
                self._settings(root),
                workspace_api_base="http://172.31.37.185:8081",
            )

            with patch.dict("os.environ", {"ENV": "production"}, clear=False):
                settings.assert_workspace_ready()

    def test_production_rejects_public_http_workspace_api_base(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)

            settings = replace(
                self._settings(root),
                workspace_api_base="http://8.8.8.8:8081",
            )

            with (
                patch.dict("os.environ", {"ENV": "production"}, clear=False),
                self.assertRaisesRegex(
                    GradingConfigurationError,
                    "literal RFC1918 private IPv4 origin",
                ),
            ):
                settings.assert_workspace_ready()

    def test_start_uses_separate_fargate_task_and_stores_only_narrow_session(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._bank(root)
            settings = self._settings(root)
            ecs = FakeWorkspaceECS()
            store = {}

            def fake_save(user_id, lab_id, data, *, ttl_seconds=None):
                store[(user_id, lab_id)] = dict(data)

            def fake_get(user_id, lab_id):
                value = store.get((user_id, lab_id))
                return dict(value) if value else None

            def fake_delete(user_id, lab_id):
                store.pop((user_id, lab_id), None)

            expires = datetime.now(timezone.utc) + timedelta(hours=2)
            with (
                patch("app.services.sysadmin_grading.workspace.save_session", side_effect=fake_save),
                patch("app.services.sysadmin_grading.workspace.get_session", side_effect=fake_get),
                patch("app.services.sysadmin_grading.workspace.delete_session", side_effect=fake_delete),
                patch(
                    "app.services.sysadmin_grading.workspace.create_workspace_submission_token",
                    return_value=("narrow-submit-token", expires),
                ),
                patch.dict("os.environ", {"ENV": "development"}, clear=False),
            ):
                service = SysadminWorkspaceService(
                    settings,
                    QuestionBankRepository(root),
                    ecs_client=ecs,
                    sleep_fn=lambda _: None,
                    tcp_probe_fn=lambda host, port, timeout: host == "172.31.10.55" and port == 22,
                )
                session = service.start(user_id=9, lab_id="RHSA-USERS-001")

            self.assertEqual(session["student_host"], "172.31.10.55")
            self.assertEqual(session["lab_id"], "RHSA-USERS-001")
            self.assertGreaterEqual(ecs.describe_calls, 2)
            self.assertEqual(ecs.run_kwargs["launchType"], "FARGATE")
            self.assertEqual(
                ecs.run_kwargs["cluster"],
                "cyberrange-sysadmin-workspaces",
            )
            self.assertNotEqual(
                ecs.run_kwargs["cluster"],
                settings.ecs_cluster,
            )
            self.assertEqual(
                ecs.run_kwargs["networkConfiguration"]["awsvpcConfiguration"]["assignPublicIp"],
                "ENABLED",
            )

            env = {
                item["name"]: item["value"]
                for item in ecs.run_kwargs["overrides"]["containerOverrides"][0]["environment"]
            }
            self.assertEqual(env["CYBERRANGE_SUBMISSION_TOKEN"], "narrow-submit-token")
            self.assertEqual(env["RHSA_LAB_ID"], "RHSA-USERS-001")
            self.assertNotIn("AWS_ACCESS_KEY_ID", env)
            self.assertNotIn("CYBERRANGE_ACCESS_TOKEN", env)

            public = service.student_view(session)
            self.assertNotIn("ssh_password", public)
            self.assertNotIn("task_arn", public)
            self.assertTrue(public["terminal_ready"])


class QuestionBankStudentViewTests(unittest.TestCase):
    def test_student_view_exposes_public_metadata_but_not_hidden_execution_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            lab = root / "labs" / "03-users-groups" / "RHSA-USERS-001"
            lab.mkdir(parents=True)
            (lab / "lab.yaml").write_text(
                """contract_version: 1
id: RHSA-USERS-001
title: User and Group Provisioning
version: 1
module: users-groups
difficulty: beginner
learning_objectives:
  - Create local users and groups.
submission:
  filename: provision_user.sh
  interpreter: bash
environment:
  image: secret-image
variables:
  TEST_USERNAME:
    type: random_username
execution:
  command: [bash, /submission/provision_user.sh]
grading:
  total_points: 100
  pass_score: 70
  criteria:
    - id: syntax
      points: 5
    - id: user_created
      points: 15
""",
                encoding="utf-8",
            )
            (lab / "question.md").write_text(
                "# RHSA-USERS-001 — User and Group Provisioning\n\nWrite the script.\n",
                encoding="utf-8",
            )
            (lab / "setup.sh").write_text("SECRET_FIXTURE=1\n", encoding="utf-8")
            (lab / "grader.py").write_text("SECRET_GRADER=1\n", encoding="utf-8")

            view = QuestionBankRepository(root).student_view("RHSA-USERS-001").detail()

            self.assertEqual(view["submission_filename"], "provision_user.sh")
            self.assertEqual(view["pass_score"], 70)
            self.assertEqual(view["rubric"][1], {"id": "user_created", "points": 15})
            serialized = repr(view)
            self.assertNotIn("secret-image", serialized)
            self.assertNotIn("TEST_USERNAME", serialized)
            self.assertNotIn("SECRET_FIXTURE", serialized)
            self.assertNotIn("SECRET_GRADER", serialized)


if __name__ == "__main__":
    unittest.main()
