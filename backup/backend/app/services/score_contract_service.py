"""Canonical score-unit contract for assignment-scoped academic scoring.

Public/API semantics:
    score_earned   -> raw net points from the assignment ScoreEvent ledger
    score_possible -> raw configured point denominator
    score_percent  -> normalized automatic percentage in [0, 100], or None
                      when no denominator exists

Rubric/final semantics are intentionally separate:
    rubric_percent -> weighted academic rubric percentage
    final_percent  -> rubric percentage plus professor adjustment

Stored database column names from older migrations are not rewritten here.
This service standardizes the API/business meaning without destroying raw data.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.score_event import ScoreEvent


SCORED_EVENT_TYPES = (
    "MODULE_COMPLETION",
    "HINT_PENALTY",
    "BONUS",
    "ADMIN_ADJUSTMENT",
)


class ScoreContractService:
    @staticmethod
    def normalize_percent(
        score_earned: float,
        score_possible: Optional[float],
    ) -> Optional[float]:
        """
        Convert raw points to percentage units.

        Examples:
            700 / 1000 -> 70.0
            70 / 100   -> 70.0
            0.7 / 1    -> 70.0

        Percentages are bounded to [0, 100] because the current gradebook and
        rubric publication policy caps academic percentages at 100.
        """
        if score_possible is None or float(score_possible) <= 0:
            return None

        pct = (float(score_earned) / float(score_possible)) * 100.0
        return round(max(0.0, min(100.0, pct)), 2)

    @staticmethod
    def get_score_possible(
        db: Session,
        assignment: Assignment,
    ) -> Dict:
        module_total = (
            db.query(func.sum(LabModule.points))
            .filter(LabModule.lab_id == assignment.lab_id)
            .scalar()
        )
        module_count = (
            db.query(func.count(LabModule.id))
            .filter(LabModule.lab_id == assignment.lab_id)
            .scalar()
            or 0
        )

        if module_total is not None and float(module_total) > 0:
            return {
                "score_possible": round(float(module_total), 2),
                "total_modules": int(module_count),
                "score_source": "lab_modules.points",
                "score_units": "points",
            }

        lab = db.query(Lab).filter(Lab.id == assignment.lab_id).first()
        if lab is not None and float(lab.max_points or 0) > 0:
            return {
                "score_possible": round(float(lab.max_points), 2),
                "total_modules": int(module_count),
                "score_source": "labs.max_points",
                "score_units": "points",
            }

        return {
            "score_possible": None,
            "total_modules": int(module_count),
            "score_source": "unavailable",
            "score_units": "points",
        }

    @staticmethod
    def get_assignment_score(
        db: Session,
        assignment: Assignment,
        student_id: int,
        score_meta: Optional[Dict] = None,
    ) -> Dict:
        score_meta = score_meta or ScoreContractService.get_score_possible(
            db, assignment
        )

        events = (
            db.query(ScoreEvent)
            .filter(
                ScoreEvent.assignment_id == assignment.id,
                ScoreEvent.user_id == student_id,
                ScoreEvent.event_type.in_(SCORED_EVENT_TYPES),
            )
            .all()
        )

        ledger_total = sum(
            Decimal(str(event.points or 0))
            for event in events
        )

        # Effective earned score follows the platform's existing non-negative
        # score policy while retaining the immutable events themselves.
        score_earned = max(Decimal("0"), ledger_total)
        possible = score_meta.get("score_possible")
        score_percent = ScoreContractService.normalize_percent(
            float(score_earned),
            possible,
        )

        return {
            "score_earned": round(float(score_earned), 2),
            "score_possible": (
                round(float(possible), 2)
                if possible is not None
                else None
            ),
            "score_percent": score_percent,
            "score_source": score_meta["score_source"],
            "score_units": "points",
            "percent_units": "percent_0_100",
            "event_count": len(events),
        }
