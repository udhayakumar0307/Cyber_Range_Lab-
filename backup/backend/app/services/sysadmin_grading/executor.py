from __future__ import annotations

import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

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


class LocalDockerExecutor:
    """
    Development/MVP executor.

    The CyberRange backend invokes the *private question-bank runner*, which in
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

    @staticmethod
    def _validate_result(result: Any, expected_lab_id: str) -> dict[str, Any]:
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
                result=self._validate_result(result, lab.lab_id),
                runner_stdout=stdout,
                runner_stderr=stderr,
                question_bank_commit=self.repository.git_commit(),
            )
