from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.lab import Lab
from app.models.lab_module import LabModule

from .config import SysadminGradingSettings
from .question_bank import QuestionBankRepository


class SysadminCatalogSyncError(RuntimeError):
    """Raised when the question-bank catalog cannot be projected safely."""


@dataclass(frozen=True)
class SysadminCatalogSyncResult:
    marketplace_lab_id: str
    module_count: int
    total_points: int
    created: int
    updated: int


def _description_for(view) -> str:
    objectives = tuple(
        str(value).strip()
        for value in getattr(view, "learning_objectives", ())
        if str(value).strip()
    )
    if objectives:
        return "; ".join(objectives)[:255]

    difficulty = str(getattr(view, "difficulty", "") or "").strip()
    if difficulty:
        return f"Question-bank exercise ({difficulty})"[:255]

    return "Question-bank Linux system administration exercise."


def sync_sysadmin_lab_modules(
    db: Session,
    *,
    settings: SysadminGradingSettings | None = None,
    repository: QuestionBankRepository | None = None,
) -> SysadminCatalogSyncResult:
    """
    Project the external Sysadmin question-bank catalog into LabModule.

    The question bank remains the source of truth for exercise metadata.
    LabModule is the reporting/gradebook projection consumed by the existing
    CyberRange academic dashboards.

    Synchronization is additive/updating only. Historical module rows are not
    deleted automatically because they may already be referenced by academic
    progress or grade evidence.
    """
    settings = settings or SysadminGradingSettings.from_env()
    repository = repository or QuestionBankRepository(
        settings.question_bank_root
    )

    marketplace_lab_id = settings.marketplace_lab_id

    marketplace_lab = (
        db.query(Lab)
        .filter(Lab.id == marketplace_lab_id)
        .first()
    )
    if marketplace_lab is None:
        raise SysadminCatalogSyncError(
            f"Marketplace lab {marketplace_lab_id!r} does not exist."
        )

    lab_ids = repository.available_lab_ids()
    if not lab_ids:
        raise SysadminCatalogSyncError(
            "Sysadmin question bank contains no available labs."
        )

    created = 0
    updated = 0
    total_points = 0

    for display_order, lab_id in enumerate(lab_ids, start=1):
        view = repository.student_view(lab_id)

        points = int(view.total_points)
        if points < 0:
            raise SysadminCatalogSyncError(
                f"Question-bank lab {lab_id} has negative total points."
            )
        total_points += points

        existing = (
            db.query(LabModule)
            .filter(LabModule.id == lab_id)
            .first()
        )

        if existing is not None and existing.lab_id != marketplace_lab_id:
            raise SysadminCatalogSyncError(
                f"LabModule ID collision: {lab_id!r} belongs to "
                f"{existing.lab_id!r}, not {marketplace_lab_id!r}."
            )

        values = {
            "lab_id": marketplace_lab_id,
            "module_number": display_order,
            "title": str(view.title)[:150],
            "description": _description_for(view),
            "points": points,
            "display_order": display_order,
            "track": (
                str(view.module or "linux").strip() or "linux"
            )[:100],
        }

        if existing is None:
            db.add(
                LabModule(
                    id=lab_id,
                    **values,
                )
            )
            created += 1
            continue

        changed = False
        for field, value in values.items():
            if getattr(existing, field) != value:
                setattr(existing, field, value)
                changed = True

        if changed:
            db.add(existing)
            updated += 1

    # Keep the marketplace-level maximum synchronized with the module catalog.
    if int(marketplace_lab.max_points or 0) != total_points:
        marketplace_lab.max_points = total_points
        db.add(marketplace_lab)

    db.flush()

    return SysadminCatalogSyncResult(
        marketplace_lab_id=marketplace_lab_id,
        module_count=len(lab_ids),
        total_points=total_points,
        created=created,
        updated=updated,
    )
