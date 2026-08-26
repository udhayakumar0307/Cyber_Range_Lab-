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

        timeout = int(os.getenv("SYSADMIN_GRADING_TIMEOUT_SECONDS", "120"))
        max_bytes = int(os.getenv("SYSADMIN_GRADING_MAX_SUBMISSION_BYTES", "65536"))
        workspace_ttl = int(os.getenv("SYSADMIN_WORKSPACE_TOKEN_TTL_MINUTES", "120"))
        healthcheck_image = os.getenv("SYSADMIN_GRADING_HEALTHCHECK_IMAGE", "cyberrange/rhsa-base:0.3").strip()
        if timeout < 10 or timeout > 600:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_TIMEOUT_SECONDS must be between 10 and 600 seconds."
            )
        if workspace_ttl < 5 or workspace_ttl > 240:
            raise GradingConfigurationError(
                "SYSADMIN_WORKSPACE_TOKEN_TTL_MINUTES must be between 5 and 240 minutes."
            )
        if not healthcheck_image:
            raise GradingConfigurationError("SYSADMIN_GRADING_HEALTHCHECK_IMAGE cannot be empty.")
        if max_bytes < 1024 or max_bytes > 1024 * 1024:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_MAX_SUBMISSION_BYTES must be between 1024 and 1048576 bytes."
            )

        return cls(
            enabled=_env_bool("SYSADMIN_GRADING_ENABLED", False),
            question_bank_root=root,
            python_bin=python_bin,
            execution_timeout_seconds=timeout,
            max_submission_bytes=max_bytes,
            workspace_token_ttl_minutes=workspace_ttl,
            allow_user_workspace_token_minting=_env_bool(
                "SYSADMIN_ALLOW_USER_WORKSPACE_TOKEN_MINTING", False
            ),
            healthcheck_image=healthcheck_image,
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
            raise GradingConfigurationError(f"Docker daemon readiness check failed: {exc}") from exc
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
            raise GradingConfigurationError(f"Docker image readiness check failed: {exc}") from exc
        if image.returncode != 0:
            raise GradingConfigurationError(
                f"Required local grading image is missing: {self.healthcheck_image}"
            )
