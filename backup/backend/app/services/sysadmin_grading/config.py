from __future__ import annotations

import os
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
        if timeout < 10 or timeout > 600:
            raise GradingConfigurationError(
                "SYSADMIN_GRADING_TIMEOUT_SECONDS must be between 10 and 600 seconds."
            )
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
