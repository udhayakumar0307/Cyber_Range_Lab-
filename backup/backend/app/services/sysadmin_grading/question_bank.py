from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


LAB_ID_RE = re.compile(r"^[A-Z][A-Z0-9-]{2,63}$")


class QuestionBankError(RuntimeError):
    pass


@dataclass(frozen=True)
class QuestionBankLab:
    lab_id: str
    path: Path


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
        for module_dir in sorted(self.labs_root.iterdir()):
            if not module_dir.is_dir():
                continue
            for lab_dir in sorted(module_dir.iterdir()):
                if lab_dir.is_dir() and LAB_ID_RE.fullmatch(lab_dir.name):
                    values.append(lab_dir.name)
        return values
