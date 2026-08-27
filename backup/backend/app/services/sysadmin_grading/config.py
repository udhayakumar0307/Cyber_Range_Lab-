from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


class GradingConfigurationError(RuntimeError):
    """Raised when the Sysadmin grading integration is not configured safely."""


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class SysadminGradingSettings:
    enabled: bool
    question_bank_root: Path
    python_bin: str
    execution_timeout_seconds: int
    max_submission_bytes: int
    workspace_token_ttl_minutes: int = 120
    allow_user_workspace_token_minting: bool = False
    healthcheck_image: str = "cyberrange/rhsa-base:0.3"

    # Executor selection. Local Docker is development-only; ECS is the
    # production isolation boundary for untrusted student Bash.
    executor: str = "local"

    # ECS/S3 remote-worker configuration.
    aws_region: str = ""
    ecs_cluster: str = ""
    ecs_task_definition: str = ""
    ecs_capacity_provider: str = ""
    ecs_container_name: str = "rhsa-grading-worker"
    ecs_task_timeout_seconds: int = 600
    ecs_poll_interval_seconds: float = 2.0
    s3_bucket: str = ""
    s3_prefix: str = "sysadmin-grading"
    s3_url_ttl_seconds: int = 900
    s3_cleanup: bool = True

    @classmethod
    def from_env(cls) -> "SysadminGradingSettings":
        root_raw = os.getenv("SYSADMIN_QUESTION_BANK_ROOT", "").strip()
        root = Path(root_raw).expanduser().resolve() if root_raw else Path("/")

        configured_python = os.getenv("SYSADMIN_GRADER_PYTHON", "").strip()
        if configured_python:
            python_bin = str(Path(configured_python).expanduser())
        elif root_raw and (root / ".venv" / "bin" / "python").exists():
            python_bin = str(root / ".venv" / "bin" / "python")
        else:
            python_bin = "python3"

        enabled = _env_bool("SYSADMIN_GRADING_ENABLED", False)
        timeout = int(os.getenv("SYSADMIN_GRADING_TIMEOUT_SECONDS", "120"))
        max_bytes = int(os.getenv("SYSADMIN_GRADING_MAX_SUBMISSION_BYTES", "65536"))
        workspace_ttl = int(os.getenv("SYSADMIN_WORKSPACE_TOKEN_TTL_MINUTES", "120"))
        healthcheck_image = os.getenv(
            "SYSADMIN_GRADING_HEALTHCHECK_IMAGE", "cyberrange/rhsa-base:0.3"
        ).strip()

        executor = os.getenv("SYSADMIN_GRADING_EXECUTOR", "local").strip().lower()
        aws_region = os.getenv("SYSADMIN_GRADING_AWS_REGION", "").strip()
        ecs_cluster = os.getenv("SYSADMIN_GRADING_ECS_CLUSTER", "").strip()
        ecs_task_definition = os.getenv(
            "SYSADMIN_GRADING_ECS_TASK_DEFINITION", ""
        ).strip()
        ecs_capacity_provider = os.getenv(
            "SYSADMIN_GRADING_ECS_CAPACITY_PROVIDER", ""
        ).strip()
        ecs_container_name = os.getenv(
            "SYSADMIN_GRADING_ECS_CONTAINER_NAME", "rhsa-grading-worker"
        ).strip()
        ecs_task_timeout = int(
            os.getenv("SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS", "600")
        )
        ecs_poll_interval = float(
            os.getenv("SYSADMIN_GRADING_ECS_POLL_INTERVAL_SECONDS", "2")
        )
        s3_bucket = os.getenv("SYSADMIN_GRADING_S3_BUCKET", "").strip()
        s3_prefix = os.getenv("SYSADMIN_GRADING_S3_PREFIX", "sysadmin-grading").strip("/")
        s3_url_ttl = int(os.getenv("SYSADMIN_GRADING_S3_URL_TTL_SECONDS", "900"))

        if timeout < 10 or timeout > 600:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_TIMEOUT_SECONDS must be between 10 and 600 seconds."
            )
        if workspace_ttl < 5 or workspace_ttl > 240:
            raise GradingConfigurationError(
                "SYSADMIN_WORKSPACE_TOKEN_TTL_MINUTES must be between 5 and 240 minutes."
            )
        if not healthcheck_image:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_HEALTHCHECK_IMAGE cannot be empty."
            )
        if max_bytes < 1024 or max_bytes > 1024 * 1024:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_MAX_SUBMISSION_BYTES must be between 1024 and 1048576 bytes."
            )
        if executor not in {"local", "ecs"}:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_EXECUTOR must be either 'local' or 'ecs'."
            )
        if ecs_task_timeout < 60 or ecs_task_timeout > 1800:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS must be between 60 and 1800 seconds."
            )
        if ecs_poll_interval < 0.5 or ecs_poll_interval > 30:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_ECS_POLL_INTERVAL_SECONDS must be between 0.5 and 30 seconds."
            )
        if s3_url_ttl < 300 or s3_url_ttl > 3600:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_S3_URL_TTL_SECONDS must be between 300 and 3600 seconds."
            )

        return cls(
            enabled=enabled,
            question_bank_root=root,
            python_bin=python_bin,
            execution_timeout_seconds=timeout,
            max_submission_bytes=max_bytes,
            workspace_token_ttl_minutes=workspace_ttl,
            allow_user_workspace_token_minting=_env_bool(
                "SYSADMIN_ALLOW_USER_WORKSPACE_TOKEN_MINTING", False
            ),
            healthcheck_image=healthcheck_image,
            executor=executor,
            aws_region=aws_region,
            ecs_cluster=ecs_cluster,
            ecs_task_definition=ecs_task_definition,
            ecs_capacity_provider=ecs_capacity_provider,
            ecs_container_name=ecs_container_name,
            ecs_task_timeout_seconds=ecs_task_timeout,
            ecs_poll_interval_seconds=ecs_poll_interval,
            s3_bucket=s3_bucket,
            s3_prefix=s3_prefix or "sysadmin-grading",
            s3_url_ttl_seconds=s3_url_ttl,
            s3_cleanup=_env_bool("SYSADMIN_GRADING_S3_CLEANUP", True),
        )

    def assert_ready(self) -> None:
        if not self.enabled:
            raise GradingConfigurationError(
                "Linux Sysadmin grading is disabled. Set SYSADMIN_GRADING_ENABLED=true."
            )

        if str(self.question_bank_root) == "/":
            raise GradingConfigurationError("SYSADMIN_QUESTION_BANK_ROOT is not configured.")
        if not self.question_bank_root.is_dir():
            raise GradingConfigurationError(
                f"Question-bank directory does not exist: {self.question_bank_root}"
            )
        if not (self.question_bank_root / "labs").is_dir():
            raise GradingConfigurationError(
                f"Question-bank labs directory does not exist: {self.question_bank_root / 'labs'}"
            )

        environment = os.getenv("ENV", "development").strip().lower()
        if environment == "production" and self.executor != "ecs":
            raise GradingConfigurationError(
                "Production Sysadmin grading must use SYSADMIN_GRADING_EXECUTOR=ecs; "
                "LocalDockerExecutor is development-only."
            )

        if self.executor == "local":
            self._assert_local_ready()
        elif self.executor == "ecs":
            self._assert_ecs_configured()
        else:  # defensive for manually constructed settings objects
            raise GradingConfigurationError(
                f"Unsupported Sysadmin grading executor: {self.executor!r}"
            )

    def _assert_local_ready(self) -> None:
        runner = self.question_bank_root / "grader" / "runner.py"
        if not runner.is_file():
            raise GradingConfigurationError(f"Question-bank runner was not found: {runner}")

        if os.path.sep in self.python_bin:
            python_path = Path(self.python_bin).expanduser()
            if not python_path.is_file():
                raise GradingConfigurationError(
                    f"Configured grader Python does not exist: {python_path}"
                )
            if not os.access(python_path, os.X_OK):
                raise GradingConfigurationError(
                    f"Configured grader Python is not executable: {python_path}"
                )
        elif not shutil.which(self.python_bin):
            raise GradingConfigurationError(
                f"Configured grader Python is not on PATH: {self.python_bin}"
            )

        docker = shutil.which("docker")
        if not docker:
            raise GradingConfigurationError("Docker CLI is not available to the backend process.")
        try:
            info = subprocess.run(
                [docker, "info"],
                text=True,
                capture_output=True,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise GradingConfigurationError(
                f"Docker daemon readiness check failed: {exc}"
            ) from exc
        if info.returncode != 0:
            detail = (info.stderr or info.stdout or "unknown Docker error").strip()[-1000:]
            raise GradingConfigurationError(f"Docker daemon is not ready: {detail}")

        try:
            image = subprocess.run(
                [docker, "image", "inspect", self.healthcheck_image],
                text=True,
                capture_output=True,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise GradingConfigurationError(
                f"Docker image readiness check failed: {exc}"
            ) from exc
        if image.returncode != 0:
            raise GradingConfigurationError(
                f"Required local grading image is missing: {self.healthcheck_image}"
            )

    def _assert_ecs_configured(self) -> None:
        required = {
            "SYSADMIN_GRADING_AWS_REGION": self.aws_region,
            "SYSADMIN_GRADING_ECS_CLUSTER": self.ecs_cluster,
            "SYSADMIN_GRADING_ECS_TASK_DEFINITION": self.ecs_task_definition,
            "SYSADMIN_GRADING_ECS_CAPACITY_PROVIDER": self.ecs_capacity_provider,
            "SYSADMIN_GRADING_ECS_CONTAINER_NAME": self.ecs_container_name,
            "SYSADMIN_GRADING_S3_BUCKET": self.s3_bucket,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise GradingConfigurationError(
                "ECS grading configuration is incomplete; missing: " + ", ".join(missing)
            )
        if self.s3_url_ttl_seconds < self.ecs_task_timeout_seconds + 60:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_S3_URL_TTL_SECONDS must be at least 60 seconds longer than "
                "SYSADMIN_GRADING_ECS_TASK_TIMEOUT_SECONDS."
            )
