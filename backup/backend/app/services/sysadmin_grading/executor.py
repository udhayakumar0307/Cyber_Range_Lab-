from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from .config import SysadminGradingSettings
from .question_bank import QuestionBankLab, QuestionBankRepository


class GradingExecutionError(RuntimeError):
    pass


@dataclass(frozen=True)
class GradingExecution:
    result: dict[str, Any]
    runner_stdout: str
    runner_stderr: str
    question_bank_commit: str | None


class GradingExecutor(Protocol):
    def grade(
        self,
        *,
        lab: QuestionBankLab,
        filename: str,
        content: str,
        seed: int,
    ) -> GradingExecution: ...


def validate_grading_result(result: Any, expected_lab_id: str) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise GradingExecutionError("Grader result is not a JSON object.")
    required = {
        "contract_version",
        "runner_version",
        "lab_id",
        "title",
        "lab_version",
        "score",
        "max_score",
        "pass_score",
        "passed",
        "tests",
        "metadata",
    }
    missing = sorted(required.difference(result))
    if missing:
        raise GradingExecutionError(
            f"Grader result is missing required keys: {', '.join(missing)}"
        )
    if result.get("contract_version") != 1:
        raise GradingExecutionError(
            f"Unsupported grader contract version: {result.get('contract_version')}"
        )
    if result.get("lab_id") != expected_lab_id:
        raise GradingExecutionError("Grader returned a different lab ID than requested.")
    if not isinstance(result.get("tests"), list):
        raise GradingExecutionError("Grader tests field is invalid.")
    if not isinstance(result.get("metadata"), dict):
        raise GradingExecutionError("Grader metadata field is invalid.")
    return result


class LocalDockerExecutor:
    """
    Development executor.

    The CyberRange backend invokes the private question-bank runner, which in
    turn creates the disposable Docker sandbox. Student code is never executed
    directly by the FastAPI process.
    """

    def __init__(
        self,
        settings: SysadminGradingSettings,
        repository: QuestionBankRepository,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self.runner = self.settings.question_bank_root / "grader" / "runner.py"

    def grade(
        self,
        *,
        lab: QuestionBankLab,
        filename: str,
        content: str,
        seed: int,
    ) -> GradingExecution:
        self.settings.assert_ready()
        self.repository.resolve_lab(lab.lab_id)  # re-validate at execution boundary

        with tempfile.TemporaryDirectory(prefix="cyberrange-submit-") as tmp:
            tmp_path = Path(tmp)
            submission = tmp_path / filename
            result_path = tmp_path / "result.json"
            submission.write_text(content, encoding="utf-8")
            os.chmod(submission, 0o600)

            cmd = [
                self.settings.python_bin,
                str(self.runner),
                "--lab",
                str(lab.path),
                "--submission",
                str(submission),
                "--seed",
                str(seed),
                "--json-out",
                str(result_path),
            ]

            try:
                cp = subprocess.run(
                    cmd,
                    text=True,
                    capture_output=True,
                    timeout=self.settings.execution_timeout_seconds,
                    env={**os.environ},
                )
            except subprocess.TimeoutExpired as exc:
                raise GradingExecutionError(
                    f"Grading process exceeded {self.settings.execution_timeout_seconds} seconds."
                ) from exc
            except OSError as exc:
                raise GradingExecutionError(f"Unable to start grader: {exc}") from exc

            stdout = (cp.stdout or "")[-32000:]
            stderr = (cp.stderr or "")[-32000:]

            # runner.py returns 0 for PASS and 2 for an academically valid FAIL.
            if cp.returncode not in (0, 2):
                raise GradingExecutionError(
                    "Question-bank runner failed before producing a grade. "
                    f"exit_code={cp.returncode}; stderr={stderr[-4000:]}"
                )
            if not result_path.is_file():
                raise GradingExecutionError("Question-bank runner did not write result.json.")

            try:
                result = json.loads(result_path.read_text(encoding="utf-8"))
            except Exception as exc:
                raise GradingExecutionError("Question-bank runner produced invalid JSON.") from exc

            return GradingExecution(
                result=validate_grading_result(result, lab.lab_id),
                runner_stdout=stdout,
                runner_stderr=stderr,
                question_bank_commit=self.repository.git_commit(),
            )


class ECSGradingExecutor:
    """
    Production executor for the trusted RHSA grading worker on dedicated ECS/EC2.

    The backend transports the immutable submission/result through private S3
    objects and gives the worker only short-lived presigned object URLs. The ECS
    worker owns the Docker-socket boundary on the dedicated grading host; the
    CyberRange backend never runs student Bash or mounts the Docker socket.
    """

    def __init__(
        self,
        settings: SysadminGradingSettings,
        repository: QuestionBankRepository,
        *,
        s3_client: Any | None = None,
        s3_presign_client: Any | None = None,
        ecs_client: Any | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
        monotonic_fn: Callable[[], float] = time.monotonic,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self._sleep = sleep_fn
        self._monotonic = monotonic_fn

        if s3_client is None:
            s3_client = boto3.client(
                "s3",
                region_name=settings.aws_region,
                endpoint_url=f"https://s3.{settings.aws_region}.amazonaws.com",
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                    retries={"max_attempts": 10, "mode": "standard"},
                ),
            )
        if s3_presign_client is None:
            # Explicit service endpoint + virtual addressing yields the stable
            # bucket.s3.<region>.amazonaws.com host. This avoids the temporary
            # redirect observed with bucket.<region>.s3.amazonaws.com.
            s3_presign_client = boto3.client(
                "s3",
                region_name=settings.aws_region,
                endpoint_url=f"https://s3.{settings.aws_region}.amazonaws.com",
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "virtual"},
                    retries={"max_attempts": 10, "mode": "standard"},
                ),
            )
        if ecs_client is None:
            ecs_client = boto3.client(
                "ecs",
                region_name=settings.aws_region,
                config=Config(retries={"max_attempts": 10, "mode": "standard"}),
            )

        self.s3 = s3_client
        self.s3_presign = s3_presign_client
        self.ecs = ecs_client

    def _key(self, lab_id: str, job_id: str, name: str) -> str:
        prefix = self.settings.s3_prefix.strip("/") or "sysadmin-grading"
        return f"{prefix}/{lab_id}/{job_id}/{name}"

    def _presigned_urls(self, submission_key: str, result_key: str) -> tuple[str, str]:
        ttl = self.settings.s3_url_ttl_seconds
        submission_url = self.s3_presign.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.settings.s3_bucket, "Key": submission_key},
            ExpiresIn=ttl,
        )
        # Do not sign Content-Type. The worker sends application/json, but
        # keeping it out of SignedHeaders makes the transport contract less
        # brittle while the object remains protected by the signed host/path.
        result_url = self.s3_presign.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.settings.s3_bucket, "Key": result_key},
            ExpiresIn=ttl,
            HttpMethod="PUT",
        )
        return submission_url, result_url

    def _run_task(
        self,
        *,
        lab_id: str,
        seed: int,
        submission_url: str,
        result_url: str,
    ) -> str:
        try:
            response = self.ecs.run_task(
                cluster=self.settings.ecs_cluster,
                taskDefinition=self.settings.ecs_task_definition,
                capacityProviderStrategy=[
                    {
                        "capacityProvider": self.settings.ecs_capacity_provider,
                        "weight": 1,
                        "base": 0,
                    }
                ],
                overrides={
                    "containerOverrides": [
                        {
                            "name": self.settings.ecs_container_name,
                            "environment": [
                                {"name": "RHSA_LAB_ID", "value": lab_id},
                                {"name": "RHSA_SEED", "value": str(seed)},
                                {"name": "RHSA_SUBMISSION_URL", "value": submission_url},
                                {"name": "RHSA_RESULT_URL", "value": result_url},
                            ],
                        }
                    ]
                },
            )
        except (BotoCoreError, ClientError) as exc:
            raise GradingExecutionError(f"Unable to start ECS grading task: {exc}") from exc

        failures = response.get("failures") or []
        tasks = response.get("tasks") or []
        if failures:
            detail = "; ".join(
                f"{item.get('arn') or 'unknown'}: {item.get('reason') or 'unknown failure'}"
                for item in failures[:5]
            )
            raise GradingExecutionError(f"ECS rejected the grading task: {detail}")
        if len(tasks) != 1 or not tasks[0].get("taskArn"):
            raise GradingExecutionError("ECS did not return exactly one grading task ARN.")
        return str(tasks[0]["taskArn"])

    def _wait_for_task(self, task_arn: str) -> dict[str, Any]:
        deadline = self._monotonic() + self.settings.ecs_task_timeout_seconds
        last_status = "UNKNOWN"

        while True:
            try:
                response = self.ecs.describe_tasks(
                    cluster=self.settings.ecs_cluster,
                    tasks=[task_arn],
                )
            except (BotoCoreError, ClientError) as exc:
                raise GradingExecutionError(
                    f"Unable to inspect ECS grading task {task_arn}: {exc}"
                ) from exc

            failures = response.get("failures") or []
            tasks = response.get("tasks") or []
            if failures or not tasks:
                reason = failures[0].get("reason") if failures else "task disappeared"
                raise GradingExecutionError(
                    f"Unable to inspect ECS grading task {task_arn}: {reason}"
                )

            task = tasks[0]
            last_status = str(task.get("lastStatus") or "UNKNOWN")
            if last_status == "STOPPED":
                return task

            if self._monotonic() >= deadline:
                try:
                    self.ecs.stop_task(
                        cluster=self.settings.ecs_cluster,
                        task=task_arn,
                        reason="CyberRange grading timeout",
                    )
                except Exception:
                    pass
                raise GradingExecutionError(
                    f"ECS grading task exceeded {self.settings.ecs_task_timeout_seconds} seconds "
                    f"(last_status={last_status}, task={task_arn})."
                )

            self._sleep(self.settings.ecs_poll_interval_seconds)

    def _worker_container(self, task: dict[str, Any]) -> dict[str, Any]:
        containers = task.get("containers") or []
        for container in containers:
            if container.get("name") == self.settings.ecs_container_name:
                return container
        if len(containers) == 1:
            return containers[0]
        raise GradingExecutionError(
            f"ECS task does not contain expected worker container "
            f"{self.settings.ecs_container_name!r}."
        )

    def _read_result_object(self, result_key: str) -> dict[str, Any]:
        try:
            response = self.s3.get_object(
                Bucket=self.settings.s3_bucket,
                Key=result_key,
            )
            raw = response["Body"].read()
        except (BotoCoreError, ClientError, KeyError, OSError) as exc:
            raise GradingExecutionError(
                "ECS worker completed but result.json could not be read from S3."
            ) from exc

        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise GradingExecutionError("ECS worker uploaded invalid result JSON.") from exc

    def _read_error_message(self, result_key: str) -> str | None:
        try:
            payload = self._read_result_object(result_key)
        except GradingExecutionError:
            return None
        if payload.get("status") == "ERROR" and payload.get("error"):
            return str(payload["error"])[:2000]
        return None

    def _cleanup(self, *keys: str) -> None:
        if not self.settings.s3_cleanup:
            return
        for key in keys:
            try:
                self.s3.delete_object(Bucket=self.settings.s3_bucket, Key=key)
            except Exception:
                # Cleanup must never rewrite the academic/infrastructure result.
                pass

    @staticmethod
    def _remote_question_bank_commit(result: dict[str, Any]) -> str | None:
        metadata = result.get("metadata")
        if not isinstance(metadata, dict):
            return None
        worker = metadata.get("worker")
        if not isinstance(worker, dict):
            return None
        value = worker.get("question_bank_revision")
        return str(value) if value else None

    def grade(
        self,
        *,
        lab: QuestionBankLab,
        filename: str,
        content: str,
        seed: int,
    ) -> GradingExecution:
        del filename  # Remote worker intentionally normalizes the file to submission.sh.
        self.settings.assert_ready()
        self.repository.resolve_lab(lab.lab_id)  # re-validate at execution boundary

        job_id = uuid.uuid4().hex
        submission_key = self._key(lab.lab_id, job_id, "submission.sh")
        result_key = self._key(lab.lab_id, job_id, "result.json")
        task_arn: str | None = None

        try:
            self.s3.put_object(
                Bucket=self.settings.s3_bucket,
                Key=submission_key,
                Body=content.encode("utf-8"),
                ContentType="text/x-shellscript",
                ServerSideEncryption="AES256",
            )
            submission_url, result_url = self._presigned_urls(submission_key, result_key)
            task_arn = self._run_task(
                lab_id=lab.lab_id,
                seed=seed,
                submission_url=submission_url,
                result_url=result_url,
            )
            task = self._wait_for_task(task_arn)
            worker = self._worker_container(task)
            exit_code = worker.get("exitCode")

            # Worker contract: exit 0 means grading completed, regardless of
            # academic PASS/FAIL. Nonzero means infrastructure failure.
            if exit_code != 0:
                error_detail = self._read_error_message(result_key)
                reason = worker.get("reason") or task.get("stoppedReason") or "unknown"
                suffix = f"; worker_error={error_detail}" if error_detail else ""
                raise GradingExecutionError(
                    f"ECS grading worker failed: exit_code={exit_code}; reason={reason}; "
                    f"task={task_arn}{suffix}"
                )

            result = validate_grading_result(
                self._read_result_object(result_key),
                lab.lab_id,
            )
            remote_commit = self._remote_question_bank_commit(result)
            return GradingExecution(
                result=result,
                runner_stdout=f"ECS grading task completed successfully: {task_arn}",
                runner_stderr="",
                question_bank_commit=remote_commit or self.repository.git_commit(),
            )
        except GradingExecutionError:
            raise
        except (BotoCoreError, ClientError) as exc:
            detail = f" task={task_arn}" if task_arn else ""
            raise GradingExecutionError(f"AWS grading transport failed:{detail} {exc}") from exc
        except Exception as exc:
            detail = f" task={task_arn}" if task_arn else ""
            raise GradingExecutionError(f"Unexpected ECS grading failure:{detail} {exc}") from exc
        finally:
            self._cleanup(submission_key, result_key)


def build_grading_executor(
    settings: SysadminGradingSettings,
    repository: QuestionBankRepository,
) -> GradingExecutor:
    if settings.executor == "local":
        return LocalDockerExecutor(settings, repository)
    if settings.executor == "ecs":
        return ECSGradingExecutor(settings, repository)
    raise GradingExecutionError(
        f"Unsupported Sysadmin grading executor: {settings.executor!r}"
    )
