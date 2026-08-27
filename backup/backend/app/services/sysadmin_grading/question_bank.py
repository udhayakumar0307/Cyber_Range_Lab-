from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


LAB_ID_RE = re.compile(r"^[A-Z][A-Z0-9-]{2,63}$")


class QuestionBankError(RuntimeError):
    pass


@dataclass(frozen=True)
class QuestionBankLab:
    lab_id: str
    path: Path


@dataclass(frozen=True)
class StudentLabView:
    lab_id: str
    title: str
    version: str
    module: str
    difficulty: str
    learning_objectives: tuple[str, ...]
    submission_filename: str
    interpreter: str
    total_points: int
    pass_score: int
    rubric: tuple[dict[str, Any], ...]
    question_markdown: str

    def summary(self) -> dict[str, Any]:
        return {
            "lab_id": self.lab_id,
            "title": self.title,
            "version": self.version,
            "module": self.module,
            "difficulty": self.difficulty,
            "learning_objectives": list(self.learning_objectives),
            "submission_filename": self.submission_filename,
            "interpreter": self.interpreter,
            "total_points": self.total_points,
            "pass_score": self.pass_score,
            "rubric": list(self.rubric),
        }

    def detail(self) -> dict[str, Any]:
        return {**self.summary(), "question_markdown": self.question_markdown}


class QuestionBankRepository:
    """Resolve a public lab ID to one trusted directory in the private question bank."""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.labs_root = (self.root / "labs").resolve()

    def resolve_lab(self, lab_id: str) -> QuestionBankLab:
        if not LAB_ID_RE.fullmatch(lab_id or ""):
            raise QuestionBankError("Invalid lab ID format.")
        if not self.labs_root.is_dir():
            raise QuestionBankError(f"Question-bank labs directory is missing: {self.labs_root}")

        matches: list[Path] = []
        for module_dir in self.labs_root.iterdir():
            if not module_dir.is_dir():
                continue
            candidate = (module_dir / lab_id).resolve()
            try:
                candidate.relative_to(self.labs_root)
            except ValueError:
                continue
            if candidate.is_dir():
                matches.append(candidate)

        if not matches:
            raise QuestionBankError(f"Unknown Sysadmin lab: {lab_id}")
        if len(matches) > 1:
            raise QuestionBankError(f"Duplicate Sysadmin lab ID in question bank: {lab_id}")

        lab_dir = matches[0]
        required = ("lab.yaml", "setup.sh", "grader.py", "question.md")
        missing = [name for name in required if not (lab_dir / name).is_file()]
        if missing:
            raise QuestionBankError(
                f"Lab {lab_id} is incomplete; missing: {', '.join(missing)}"
            )
        return QuestionBankLab(lab_id=lab_id, path=lab_dir)

    @staticmethod
    def _as_mapping(value: Any, *, field: str, lab_id: str) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise QuestionBankError(f"Lab {lab_id} has invalid {field} metadata.")
        return value

    def student_view(self, lab_id: str) -> StudentLabView:
        """
        Return only student-safe question metadata.

        Hidden setup/grader implementation, generated variables, fixture paths,
        execution details, and reference answers are deliberately not exposed.
        """
        lab = self.resolve_lab(lab_id)
        try:
            raw = yaml.safe_load((lab.path / "lab.yaml").read_text(encoding="utf-8"))
        except Exception as exc:
            raise QuestionBankError(f"Unable to read lab metadata for {lab_id}.") from exc

        meta = self._as_mapping(raw, field="lab.yaml", lab_id=lab_id)
        if str(meta.get("id") or "") != lab_id:
            raise QuestionBankError(f"Lab metadata ID mismatch for {lab_id}.")

        submission = self._as_mapping(meta.get("submission"), field="submission", lab_id=lab_id)
        grading = self._as_mapping(meta.get("grading"), field="grading", lab_id=lab_id)

        filename = str(submission.get("filename") or "").strip()
        if not filename or Path(filename).name != filename:
            raise QuestionBankError(f"Lab {lab_id} has an invalid submission filename.")

        raw_criteria = grading.get("criteria") or []
        if not isinstance(raw_criteria, list):
            raise QuestionBankError(f"Lab {lab_id} has invalid grading criteria metadata.")
        rubric: list[dict[str, Any]] = []
        for item in raw_criteria:
            if not isinstance(item, dict):
                raise QuestionBankError(f"Lab {lab_id} has invalid grading criterion metadata.")
            criterion_id = str(item.get("id") or "").strip()
            try:
                points = int(item.get("points"))
            except (TypeError, ValueError) as exc:
                raise QuestionBankError(
                    f"Lab {lab_id} criterion {criterion_id or '<unknown>'} has invalid points."
                ) from exc
            if not criterion_id or points < 0:
                raise QuestionBankError(f"Lab {lab_id} has invalid grading criterion metadata.")
            rubric.append({"id": criterion_id, "points": points})

        try:
            question_markdown = (lab.path / "question.md").read_text(encoding="utf-8").strip()
        except Exception as exc:
            raise QuestionBankError(f"Unable to read student question for {lab_id}.") from exc
        if not question_markdown:
            raise QuestionBankError(f"Lab {lab_id} has an empty question.md.")

        objectives = meta.get("learning_objectives") or []
        if not isinstance(objectives, list):
            objectives = []

        try:
            total_points = int(grading.get("total_points"))
            pass_score = int(grading.get("pass_score"))
        except (TypeError, ValueError) as exc:
            raise QuestionBankError(f"Lab {lab_id} has invalid grading totals.") from exc

        return StudentLabView(
            lab_id=lab_id,
            title=str(meta.get("title") or lab_id).strip() or lab_id,
            version=str(meta.get("version") or "").strip(),
            module=str(meta.get("module") or lab.path.parent.name).strip(),
            difficulty=str(meta.get("difficulty") or "intermediate").strip().lower(),
            learning_objectives=tuple(str(v).strip() for v in objectives if str(v).strip()),
            submission_filename=filename,
            interpreter=str(submission.get("interpreter") or "bash").strip() or "bash",
            total_points=total_points,
            pass_score=pass_score,
            rubric=tuple(rubric),
            question_markdown=question_markdown,
        )

    def student_lab_summaries(self) -> list[dict[str, Any]]:
        return [self.student_view(lab_id).summary() for lab_id in self.available_lab_ids()]

    def git_commit(self) -> str | None:
        try:
            cp = subprocess.run(
                ["git", "-C", str(self.root), "rev-parse", "HEAD"],
                text=True,
                capture_output=True,
                timeout=5,
            )
            value = cp.stdout.strip()
            return value if cp.returncode == 0 and value else None
        except Exception:
            return None

    def available_lab_ids(self) -> list[str]:
        if not self.labs_root.is_dir():
            return []
        values: list[str] = []
        locations: dict[str, list[Path]] = {}
        for module_dir in sorted(self.labs_root.iterdir()):
            if not module_dir.is_dir():
                continue
            for lab_dir in sorted(module_dir.iterdir()):
                if lab_dir.is_dir() and LAB_ID_RE.fullmatch(lab_dir.name):
                    values.append(lab_dir.name)
                    locations.setdefault(lab_dir.name, []).append(lab_dir)

        duplicates = {key: paths for key, paths in locations.items() if len(paths) > 1}
        if duplicates:
            detail = "; ".join(
                f"{lab_id}: {', '.join(str(p.relative_to(self.root)) for p in paths)}"
                for lab_id, paths in sorted(duplicates.items())
            )
            raise QuestionBankError(f"Duplicate Sysadmin lab IDs in question bank: {detail}")
        return values
