from __future__ import annotations

import hashlib
import json
import secrets
from pathlib import PurePath
from typing import Any

from sqlalchemy.orm import Session

from app.models.sysadmin_submission import SysadminSubmission

from .config import GradingConfigurationError, SysadminGradingSettings
from .executor import GradingExecutionError, LocalDockerExecutor
from .question_bank import QuestionBankError, QuestionBankRepository


class SubmissionValidationError(ValueError):
    pass


class SysadminGradingService:
    def __init__(self, settings: SysadminGradingSettings | None = None) -> None:
        self.settings = settings or SysadminGradingSettings.from_env()
        self.repository = QuestionBankRepository(self.settings.question_bank_root)
        self.executor = LocalDockerExecutor(self.settings, self.repository)

    def validate_submission(self, *, lab_id: str, filename: str, content: str) -> None:
        encoded = content.encode("utf-8")
        if not content.strip():
            raise SubmissionValidationError("Submission is empty.")
        if len(encoded) > self.settings.max_submission_bytes:
            raise SubmissionValidationError(
                f"Submission exceeds {self.settings.max_submission_bytes} bytes."
            )
        if "\x00" in content:
            raise SubmissionValidationError("Submission contains a NUL byte.")

        # The client sends only the basename. Never allow a caller to choose a
        # host-side path used by the grading subprocess.
        if not filename or PurePath(filename).name != filename:
            raise SubmissionValidationError("filename must be a basename, not a path.")
        if filename in {".", ".."} or len(filename) > 128:
            raise SubmissionValidationError("Invalid submission filename.")
        if not filename.endswith(".sh"):
            raise SubmissionValidationError("Sysadmin submissions must use a .sh filename.")

        try:
            self.repository.resolve_lab(lab_id)
        except QuestionBankError as exc:
            raise SubmissionValidationError(str(exc)) from exc

    @staticmethod
    def student_view(row: SysadminSubmission) -> dict[str, Any]:
        tests: list[dict[str, Any]] = []
        if row.result_json:
            try:
                raw = json.loads(row.result_json)
                tests = raw.get("tests", []) if isinstance(raw, dict) else []
            except Exception:
                tests = []

        return {
            "submission_id": row.id,
            "lab_id": row.lab_id,
            "filename": row.filename,
            "status": row.status,
            "score": row.score,
            "max_score": row.max_score,
            "pass_score": row.pass_score,
            "passed": row.passed,
            "tests": tests,
            "submitted_at": row.submitted_at,
            "graded_at": row.graded_at,
            "error": (
                "Grading infrastructure error. Contact your instructor with this submission ID."
                if row.status == "ERROR"
                else None
            ),
        }

    def grade_submission(
        self,
        db: Session,
        *,
        student_id: int,
        lab_id: str,
        filename: str,
        content: str,
    ) -> SysadminSubmission:
        self.settings.assert_ready()
        self.validate_submission(lab_id=lab_id, filename=filename, content=content)
        lab = self.repository.resolve_lab(lab_id)

        seed = secrets.randbelow(2**31 - 1)
        submission_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

        row = SysadminSubmission(
            student_id=student_id,
            lab_id=lab_id,
            filename=filename,
            submission_content=content,
            submission_sha256=submission_hash,
            seed=seed,
            status="PENDING",
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        try:
            row.status = "RUNNING"
            db.commit()

            execution = self.executor.grade(
                lab=lab,
                filename=filename,
                content=content,
                seed=seed,
            )
            result = execution.result
            metadata = result.get("metadata", {})

            row.status = "COMPLETED"
            row.runner_version = str(result.get("runner_version", "")) or None
            row.lab_version = str(result.get("lab_version", "")) or None
            row.question_bank_commit = execution.question_bank_commit
            row.lab_package_sha256 = metadata.get("lab_package_sha256")
            row.grader_image = metadata.get("image")
            row.grader_image_id = metadata.get("image_id")
            row.score = int(result["score"])
            row.max_score = int(result["max_score"])
            row.pass_score = int(result["pass_score"])
            row.passed = bool(result["passed"])
            row.result_json = json.dumps(result, separators=(",", ":"))
            row.runner_stdout = execution.runner_stdout
            row.runner_stderr = execution.runner_stderr
            row.mark_graded()
            db.commit()
            db.refresh(row)
            return row

        except (GradingExecutionError, QuestionBankError, GradingConfigurationError) as exc:
            row.status = "ERROR"
            row.error_message = str(exc)[:8000]
            row.mark_graded()
            db.commit()
            db.refresh(row)
            return row
        except Exception as exc:
            row.status = "ERROR"
            row.error_message = f"Unexpected grading failure: {exc}"[:8000]
            row.mark_graded()
            db.commit()
            db.refresh(row)
            return row
