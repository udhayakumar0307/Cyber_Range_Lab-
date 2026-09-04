from __future__ import annotations

import logging
import secrets
import socket
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from botocore.exceptions import BotoCoreError, ClientError

from app.lab.session_store import delete_session, get_session, save_session

from .config import GradingConfigurationError, SysadminGradingSettings
from .question_bank import QuestionBankRepository
from .workspace_tokens import create_workspace_submission_token


logger = logging.getLogger(__name__)

SESSION_STORE_LAB_ID = "linux-sysadmin-workspace"


class WorkspaceExecutionError(RuntimeError):
    """Raised when the student workspace cannot be provisioned safely."""


class SysadminWorkspaceService:
    """
    Provision one untrusted Linux Sysadmin workspace per CyberRange user.

    Production workspaces run on ECS Fargate, separate from the trusted grading
    cluster. The task receives only a short-lived submission-only credential;
    normal CyberRange access JWTs and AWS credentials are never injected.
    """

    def __init__(
        self,
        settings: SysadminGradingSettings | None = None,
        repository: QuestionBankRepository | None = None,
        *,
        ecs_client: Any | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
        monotonic_fn: Callable[[], float] = time.monotonic,
        tcp_probe_fn: Callable[[str, int, float], bool] | None = None,
    ) -> None:
        self.settings = settings or SysadminGradingSettings.from_env()
        self.repository = repository or QuestionBankRepository(self.settings.question_bank_root)
        self._sleep = sleep_fn
        self._monotonic = monotonic_fn
        self._tcp_probe = tcp_probe_fn or self._default_tcp_probe

        if ecs_client is not None:
            self.ecs = ecs_client
        else:
            import boto3

            self.ecs = boto3.client("ecs", region_name=self.settings.aws_region or None)

    @staticmethod
    def _default_tcp_probe(host: str, port: int, timeout: float) -> bool:
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            return False

    @staticmethod
    def student_view(session: dict[str, Any]) -> dict[str, Any]:
        return {
            "workspace_id": str(session.get("workspace_id") or ""),
            "lab_id": str(session.get("lab_id") or ""),
            "status": str(session.get("status") or "UNKNOWN"),
            "terminal_ready": bool(session.get("student_host")),
            "started_at": session.get("started_at"),
            "expires_at": session.get("expires_at"),
        }

    def _stored_session(self, user_id: int) -> dict[str, Any] | None:
        return get_session(str(user_id), SESSION_STORE_LAB_ID)

    def _delete_stored_session(self, user_id: int) -> None:
        delete_session(str(user_id), SESSION_STORE_LAB_ID)

    def _describe(self, task_arn: str) -> dict[str, Any] | None:
        try:
            response = self.ecs.describe_tasks(
                cluster=self.settings.workspace_ecs_cluster,
                tasks=[task_arn],
            )
        except (BotoCoreError, ClientError) as exc:
            raise WorkspaceExecutionError(f"Unable to inspect workspace task: {exc}") from exc

        tasks = response.get("tasks") or []
        if tasks:
            return tasks[0]
        failures = response.get("failures") or []
        if failures and all(str(item.get("reason") or "").upper() == "MISSING" for item in failures):
            return None
        reason = failures[0].get("reason") if failures else "task disappeared"
        raise WorkspaceExecutionError(f"Unable to inspect workspace task: {reason}")

    @staticmethod
    def _private_ip(task: dict[str, Any]) -> str | None:
        for attachment in task.get("attachments") or []:
            details = {
                str(item.get("name")): str(item.get("value"))
                for item in attachment.get("details") or []
                if item.get("name") and item.get("value")
            }
            value = details.get("privateIPv4Address")
            if value:
                return value

        for container in task.get("containers") or []:
            for interface in container.get("networkInterfaces") or []:
                value = interface.get("privateIpv4Address") or interface.get("privateIPv4Address")
                if value:
                    return str(value)
        return None

    def _stop_task(self, task_arn: str, reason: str) -> None:
        try:
            self.ecs.stop_task(
                cluster=self.settings.workspace_ecs_cluster,
                task=task_arn,
                reason=reason[:255],
            )
        except Exception as exc:
            logger.warning("Unable to stop Sysadmin workspace task %s: %s", task_arn, exc)

    def _task_is_active(self, task_arn: str) -> bool:
        task = self._describe(task_arn)
        if not task:
            return False
        return str(task.get("lastStatus") or "").upper() in {"PROVISIONING", "PENDING", "RUNNING"}

    def current(self, *, user_id: int) -> dict[str, Any] | None:
        session = self._stored_session(user_id)
        if not session:
            return None

        task_arn = str(session.get("task_arn") or "")
        if not task_arn:
            self._delete_stored_session(user_id)
            return None

        task = self._describe(task_arn)
        if not task:
            self._delete_stored_session(user_id)
            return None

        status = str(task.get("lastStatus") or "UNKNOWN").upper()
        if status == "STOPPED":
            self._delete_stored_session(user_id)
            return None

        session["status"] = status
        return session

    def stop(self, *, user_id: int, reason: str = "Student ended Linux Sysadmin workspace") -> bool:
        session = self._stored_session(user_id)
        if not session:
            return False
        task_arn = str(session.get("task_arn") or "")
        try:
            if task_arn:
                self._stop_task(task_arn, reason)
        finally:
            self._delete_stored_session(user_id)
        return True

    def _wait_until_ready(self, task_arn: str) -> tuple[dict[str, Any], str]:
        deadline = self._monotonic() + self.settings.workspace_start_timeout_seconds
        missing_backoff = max(1.0, self.settings.workspace_poll_interval_seconds)

        while self._monotonic() < deadline:
            task = self._describe(task_arn)
            if task is None:
                delay = min(missing_backoff, max(0.0, deadline - self._monotonic()))
                if delay > 0:
                    self._sleep(delay)
                missing_backoff = min(missing_backoff * 2.0, 15.0)
                continue

            status = str(task.get("lastStatus") or "UNKNOWN").upper()
            if status == "STOPPED":
                reason = task.get("stoppedReason") or "workspace task stopped during startup"
                raise WorkspaceExecutionError(f"Sysadmin workspace stopped before becoming ready: {reason}")

            if status == "RUNNING":
                host = self._private_ip(task)
                if host and self._tcp_probe(host, 22, 2.0):
                    return task, host

            self._sleep(self.settings.workspace_poll_interval_seconds)

        self._stop_task(task_arn, "CyberRange Sysadmin workspace startup timeout")
        raise WorkspaceExecutionError(
            f"Sysadmin workspace did not become ready within "
            f"{self.settings.workspace_start_timeout_seconds} seconds."
        )

    def start(
        self,
        *,
        user_id: int,
        lab_id: str,
        assignment_id: int | None = None,
    ) -> dict[str, Any]:
        if user_id <= 0:
            raise WorkspaceExecutionError("Workspace requires a persisted CyberRange user.")
        self.settings.assert_workspace_ready()
        self.repository.resolve_lab(lab_id)

        existing = self._stored_session(user_id)
        if existing:
            existing_task = str(existing.get("task_arn") or "")
            existing_lab = str(existing.get("lab_id") or "")
            existing_assignment_id = existing.get("assignment_id")
            try:
                if (
                    existing_task
                    and existing_lab == lab_id
                    and existing_assignment_id == assignment_id
                    and self._task_is_active(existing_task)
                ):
                    return existing
            except WorkspaceExecutionError:
                # A stale/broken session should not prevent a clean reprovision.
                pass
            self.stop(user_id=user_id, reason="Switching Linux Sysadmin workspace")

        workspace_id = f"ws-{uuid.uuid4().hex[:20]}"
        submission_token, expires_at = create_workspace_submission_token(
            user_id=user_id,
            lab_id=lab_id,
            workspace_id=workspace_id,
            ttl_minutes=self.settings.workspace_token_ttl_minutes,
            assignment_id=assignment_id,
        )
        ssh_password = secrets.token_urlsafe(24)
        ttl_seconds = self.settings.workspace_token_ttl_minutes * 60

        environment = [
            {"name": "TERM", "value": "xterm-256color"},
            {"name": "RHSA_LAB_ID", "value": lab_id},
            {"name": "CYBERRANGE_API_BASE", "value": self.settings.workspace_api_base},
            {"name": "CYBERRANGE_SUBMISSION_TOKEN", "value": submission_token},
            {"name": "SYSADMIN_WORKSPACE_ID", "value": workspace_id},
            {"name": "SYSADMIN_WORKSPACE_SSH_PASSWORD", "value": ssh_password},
            {"name": "SYSADMIN_WORKSPACE_TTL_SECONDS", "value": str(ttl_seconds)},
        ]

        try:
            response = self.ecs.run_task(
                cluster=self.settings.workspace_ecs_cluster,
                taskDefinition=self.settings.workspace_task_definition,
                launchType="FARGATE",
                platformVersion="LATEST",
                count=1,
                enableExecuteCommand=False,
                networkConfiguration={
                    "awsvpcConfiguration": {
                        "subnets": list(self.settings.workspace_subnet_ids),
                        "securityGroups": list(self.settings.workspace_security_group_ids),
                        "assignPublicIp": (
                            "ENABLED" if self.settings.workspace_assign_public_ip else "DISABLED"
                        ),
                    }
                },
                overrides={
                    "containerOverrides": [
                        {
                            "name": self.settings.workspace_container_name,
                            "environment": environment,
                        }
                    ]
                },
                tags=[
                    {"key": "managed_by", "value": "cyberrange"},
                    {"key": "purpose", "value": "sysadmin-workspace"},
                    {"key": "user_id", "value": str(user_id)},
                    {"key": "lab_id", "value": lab_id},
                    {"key": "workspace_id", "value": workspace_id},
                ],
            )
        except (BotoCoreError, ClientError) as exc:
            raise WorkspaceExecutionError(f"Unable to start Sysadmin workspace: {exc}") from exc

        failures = response.get("failures") or []
        tasks = response.get("tasks") or []
        if failures or len(tasks) != 1:
            detail = failures[0].get("reason") if failures else "ECS returned no workspace task"
            raise WorkspaceExecutionError(f"ECS rejected the Sysadmin workspace: {detail}")

        task_arn = str(tasks[0].get("taskArn") or "")
        if not task_arn:
            raise WorkspaceExecutionError("ECS did not return a Sysadmin workspace task ARN.")

        try:
            _, student_host = self._wait_until_ready(task_arn)
            now = datetime.now(timezone.utc)
            session = {
                "workspace_id": workspace_id,
                "task_arn": task_arn,
                "lab_id": lab_id,
                "assignment_id": assignment_id,
                "status": "RUNNING",
                "student_host": student_host,
                "student_port": 22,
                "ssh_username": "student",
                "ssh_password": ssh_password,
                "started_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
            }
            save_session(
                str(user_id),
                SESSION_STORE_LAB_ID,
                session,
                ttl_seconds=ttl_seconds,
            )
            if not self._stored_session(user_id):
                raise WorkspaceExecutionError("Unable to persist Sysadmin workspace session routing.")
            return session
        except Exception:
            self._stop_task(task_arn, "CyberRange Sysadmin workspace provisioning failed")
            self._delete_stored_session(user_id)
            raise
