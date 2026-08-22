"""Formal grading-rubric business logic."""

from __future__ import annotations

import copy
import re
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.assignment_grade import AssignmentGrade
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.rubric import (
    AssignmentCriterionGrade,
    AssignmentRubric,
    LabRubric,
)
from app.models.score_event import ScoreEvent
from app.models.user import User


DEFAULT_LEVELS = [
    {
        "label": "Excellent",
        "min_percent": 90,
        "description": "Demonstrates complete and accurate mastery of the criterion.",
    },
    {
        "label": "Proficient",
        "min_percent": 75,
        "description": "Demonstrates solid mastery with only minor gaps.",
    },
    {
        "label": "Developing",
        "min_percent": 60,
        "description": "Demonstrates partial mastery but important gaps remain.",
    },
    {
        "label": "Insufficient",
        "min_percent": 0,
        "description": "Does not yet demonstrate sufficient mastery.",
    },
]


class RubricService:
    SCHEMA_VERSION = 1
    VALID_MODES = {"AUTO", "MANUAL"}

    @staticmethod
    def _clamp(value: float) -> float:
        return round(max(0.0, min(100.0, float(value))), 2)

    @staticmethod
    def _slug(value: str) -> str:
        value = re.sub(r"[^a-zA-Z0-9_-]+", "-", (value or "").strip().lower())
        return value.strip("-")[:100]

    @staticmethod
    def _module_map(db: Session, lab_id: str) -> Dict[str, LabModule]:
        modules = (
            db.query(LabModule)
            .filter(LabModule.lab_id == lab_id)
            .all()
        )
        return {m.id: m for m in modules}

    @staticmethod
    def validate_rubric(db: Session, lab_id: str, payload: Dict) -> Dict:
        lab = db.query(Lab).filter(Lab.id == lab_id).first()
        if lab is None:
            raise HTTPException(status_code=404, detail="Lab not found.")

        raw_criteria = payload.get("criteria") or []
        if not raw_criteria:
            raise HTTPException(
                status_code=422,
                detail="Rubric must contain at least one criterion.",
            )

        module_map = RubricService._module_map(db, lab_id)
        keys = set()
        criteria = []
        weight_sum = Decimal("0")

        for index, raw in enumerate(raw_criteria, start=1):
            title = str(raw.get("title") or "").strip()
            if not title:
                raise HTTPException(
                    status_code=422,
                    detail=f"Criterion {index} requires a title.",
                )

            key = RubricService._slug(str(raw.get("key") or title))
            if not key:
                raise HTTPException(
                    status_code=422,
                    detail=f"Criterion {index} has an invalid key.",
                )
            if key in keys:
                raise HTTPException(
                    status_code=422,
                    detail=f"Duplicate criterion key: {key}",
                )
            keys.add(key)

            try:
                weight = Decimal(str(raw.get("weight_percent")))
            except Exception:
                raise HTTPException(
                    status_code=422,
                    detail=f"Criterion '{title}' has an invalid weight.",
                )
            if weight <= 0 or weight > 100:
                raise HTTPException(
                    status_code=422,
                    detail=f"Criterion '{title}' weight must be > 0 and <= 100.",
                )
            weight_sum += weight

            mode = str(raw.get("grading_mode") or "AUTO").upper()
            if mode not in RubricService.VALID_MODES:
                raise HTTPException(
                    status_code=422,
                    detail=f"Criterion '{title}' has invalid grading_mode.",
                )

            evidence = copy.deepcopy(raw.get("evidence") or {})
            if mode == "AUTO":
                evidence_type = str(evidence.get("type") or "MODULES").upper()
                event_types = list(
                    dict.fromkeys(
                        evidence.get("event_types")
                        or ["MODULE_COMPLETION", "HINT_PENALTY"]
                    )
                )

                if evidence_type == "MODULES":
                    module_ids = list(
                        dict.fromkeys(evidence.get("module_ids") or [])
                    )
                    if not module_ids:
                        raise HTTPException(
                            status_code=422,
                            detail=(
                                f"AUTO criterion '{title}' must map to one or "
                                "more LabModule IDs."
                            ),
                        )

                    missing = [
                        mid for mid in module_ids if mid not in module_map
                    ]
                    if missing:
                        raise HTTPException(
                            status_code=422,
                            detail=(
                                f"Criterion '{title}' references module(s) "
                                f"outside lab '{lab_id}': {', '.join(missing)}"
                            ),
                        )

                    evidence = {
                        "type": "MODULES",
                        "module_ids": module_ids,
                        "event_types": event_types,
                    }
                elif evidence_type == "ASSIGNMENT_EVENTS":
                    evidence = {
                        "type": "ASSIGNMENT_EVENTS",
                        "event_types": event_types,
                    }
                else:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            f"AUTO criterion '{title}' has unsupported "
                            f"evidence type '{evidence_type}'."
                        ),
                    )
            else:
                evidence = {"type": "MANUAL"}

            levels = copy.deepcopy(
                raw.get("performance_levels") or DEFAULT_LEVELS
            )
            if not levels:
                levels = copy.deepcopy(DEFAULT_LEVELS)

            normalized_levels = []
            for level in levels:
                label = str(level.get("label") or "").strip()
                if not label:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Criterion '{title}' has a level without a label.",
                    )
                minimum = float(level.get("min_percent", 0))
                if minimum < 0 or minimum > 100:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            f"Criterion '{title}' performance level threshold "
                            "must be between 0 and 100."
                        ),
                    )
                normalized_levels.append(
                    {
                        "label": label,
                        "min_percent": round(minimum, 2),
                        "description": str(level.get("description") or "").strip(),
                    }
                )

            normalized_levels.sort(
                key=lambda level: level["min_percent"],
                reverse=True,
            )

            criteria.append(
                {
                    "key": key,
                    "title": title,
                    "description": str(raw.get("description") or "").strip(),
                    "weight_percent": float(weight),
                    "grading_mode": mode,
                    "evidence": evidence,
                    "performance_levels": normalized_levels,
                }
            )

        if abs(weight_sum - Decimal("100")) > Decimal("0.01"):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Rubric criterion weights must total exactly 100%. "
                    f"Current total: {weight_sum}%."
                ),
            )

        return {
            "schema_version": RubricService.SCHEMA_VERSION,
            "name": str(payload.get("name") or f"{lab.name} Rubric").strip(),
            "description": str(payload.get("description") or "").strip(),
            "criteria": criteria,
        }

    @staticmethod
    def generate_default_payload(db: Session, lab_id: str) -> Dict:
        lab = db.query(Lab).filter(Lab.id == lab_id).first()
        if lab is None:
            raise HTTPException(status_code=404, detail="Lab not found.")

        modules = (
            db.query(LabModule)
            .filter(LabModule.lab_id == lab_id)
            .order_by(
                LabModule.display_order.asc(),
                LabModule.module_number.asc(),
                LabModule.id.asc(),
            )
            .all()
        )
        if not modules:
            return {
                "name": f"{lab.name} Default Rubric",
                "description": (
                    "Auto-generated from assignment-scoped ScoreEvent evidence "
                    "because this lab does not define LabModule rows."
                ),
                "criteria": [
                    {
                        "key": "assignment-performance",
                        "title": "Lab Performance",
                        "description": (
                            "Automatic score from assignment-scoped completion "
                            "and hint-penalty events."
                        ),
                        "weight_percent": 100.0,
                        "grading_mode": "AUTO",
                        "evidence": {
                            "type": "ASSIGNMENT_EVENTS",
                            "event_types": [
                                "MODULE_COMPLETION",
                                "HINT_PENALTY",
                            ],
                        },
                        "performance_levels": copy.deepcopy(DEFAULT_LEVELS),
                    }
                ],
            }

        point_total = sum(max(0, int(module.points or 0)) for module in modules)
        raw_weights = []
        if point_total > 0:
            raw_weights = [
                (max(0, int(module.points or 0)) / point_total) * 100.0
                for module in modules
            ]
        else:
            raw_weights = [100.0 / len(modules) for _ in modules]

        rounded = [round(weight, 2) for weight in raw_weights]
        rounded[-1] = round(rounded[-1] + (100.0 - sum(rounded)), 2)

        criteria = []
        for module, weight in zip(modules, rounded):
            criteria.append(
                {
                    "key": RubricService._slug(module.id),
                    "title": module.title or module.id,
                    "description": module.description or "",
                    "weight_percent": weight,
                    "grading_mode": "AUTO",
                    "evidence": {
                        "type": "MODULES",
                        "module_ids": [module.id],
                        "event_types": [
                            "MODULE_COMPLETION",
                            "HINT_PENALTY",
                        ],
                    },
                    "performance_levels": copy.deepcopy(DEFAULT_LEVELS),
                }
            )

        return {
            "name": f"{lab.name} Default Rubric",
            "description": (
                "Auto-generated from the lab's canonical module point values. "
                "Saving a custom rubric creates a new immutable version."
            ),
            "criteria": criteria,
        }

    @staticmethod
    def create_version(
        db: Session,
        lab_id: str,
        payload: Dict,
        created_by: Optional[int],
    ) -> LabRubric:
        normalized = RubricService.validate_rubric(db, lab_id, payload)

        current_max = (
            db.query(func.max(LabRubric.version))
            .filter(LabRubric.lab_id == lab_id)
            .scalar()
            or 0
        )

        (
            db.query(LabRubric)
            .filter(
                LabRubric.lab_id == lab_id,
                LabRubric.status == "ACTIVE",
            )
            .update({"status": "ARCHIVED"}, synchronize_session=False)
        )

        rubric = LabRubric(
            lab_id=lab_id,
            version=int(current_max) + 1,
            name=normalized["name"],
            description=normalized["description"] or None,
            status="ACTIVE",
            rubric_json=normalized,
            created_by=created_by,
        )
        db.add(rubric)
        db.flush()
        return rubric

    @staticmethod
    def ensure_active_template(
        db: Session,
        lab_id: str,
        created_by: Optional[int] = None,
    ) -> LabRubric:
        existing = (
            db.query(LabRubric)
            .filter(
                LabRubric.lab_id == lab_id,
                LabRubric.status == "ACTIVE",
            )
            .order_by(LabRubric.version.desc())
            .first()
        )
        if existing is not None:
            return existing

        default_payload = RubricService.generate_default_payload(db, lab_id)
        return RubricService.create_version(
            db,
            lab_id,
            default_payload,
            created_by=created_by,
        )

    @staticmethod
    def snapshot_assignment(
        db: Session,
        assignment_id: int,
        created_by: Optional[int] = None,
    ) -> AssignmentRubric:
        existing = (
            db.query(AssignmentRubric)
            .filter(AssignmentRubric.assignment_id == assignment_id)
            .first()
        )
        if existing is not None:
            return existing

        assignment = (
            db.query(Assignment)
            .filter(
                Assignment.id == assignment_id,
                Assignment.deleted_at.is_(None),
            )
            .first()
        )
        if assignment is None:
            raise HTTPException(status_code=404, detail="Assignment not found.")

        template = RubricService.ensure_active_template(
            db,
            assignment.lab_id,
            created_by=created_by,
        )
        snapshot = AssignmentRubric(
            assignment_id=assignment.id,
            lab_rubric_id=template.id,
            rubric_version=template.version,
            rubric_json=copy.deepcopy(template.rubric_json),
        )
        db.add(snapshot)
        db.flush()
        return snapshot

    @staticmethod
    def resnapshot_assignment_for_lab_change(
        db: Session,
        assignment_id: int,
        created_by: Optional[int] = None,
    ) -> AssignmentRubric:
        evidence_count = (
            db.query(ScoreEvent)
            .filter(ScoreEvent.assignment_id == assignment_id)
            .count()
        )
        grade_count = (
            db.query(AssignmentGrade)
            .filter(AssignmentGrade.assignment_id == assignment_id)
            .count()
        )
        criterion_count = (
            db.query(AssignmentCriterionGrade)
            .filter(AssignmentCriterionGrade.assignment_id == assignment_id)
            .count()
        )
        if evidence_count or grade_count or criterion_count:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Cannot change an assignment's lab/rubric after scoring or "
                    "grading evidence exists."
                ),
            )

        (
            db.query(AssignmentRubric)
            .filter(AssignmentRubric.assignment_id == assignment_id)
            .delete(synchronize_session=False)
        )
        db.flush()
        return RubricService.snapshot_assignment(
            db,
            assignment_id,
            created_by=created_by,
        )

    @staticmethod
    def get_assignment_snapshot(
        db: Session,
        assignment_id: int,
    ) -> AssignmentRubric:
        snapshot = (
            db.query(AssignmentRubric)
            .filter(AssignmentRubric.assignment_id == assignment_id)
            .first()
        )
        if snapshot is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Assignment rubric has not been snapshotted yet. Run the "
                    "Point #6 backfill or create the assignment again."
                ),
            )
        return snapshot

    @staticmethod
    def _performance_level(criterion: Dict, percent: float) -> Optional[Dict]:
        levels = criterion.get("performance_levels") or []
        for level in sorted(
            levels,
            key=lambda item: float(item.get("min_percent", 0)),
            reverse=True,
        ):
            if percent >= float(level.get("min_percent", 0)):
                return level
        return None

    @staticmethod
    def _auto_criterion_percent(
        db: Session,
        assignment_id: int,
        student_id: int,
        criterion: Dict,
    ) -> Dict:
        evidence = criterion.get("evidence") or {}
        evidence_type = str(evidence.get("type") or "MODULES").upper()
        module_ids = evidence.get("module_ids") or []
        event_types = evidence.get("event_types") or [
            "MODULE_COMPLETION",
            "HINT_PENALTY",
        ]

        if evidence_type == "ASSIGNMENT_EVENTS":
            assignment = (
                db.query(Assignment)
                .filter(Assignment.id == assignment_id)
                .first()
            )
            lab = (
                db.query(Lab)
                .filter(Lab.id == assignment.lab_id)
                .first()
                if assignment
                else None
            )
            possible = float(lab.max_points or 0) if lab else 0.0
            events = (
                db.query(ScoreEvent)
                .filter(
                    ScoreEvent.assignment_id == assignment_id,
                    ScoreEvent.user_id == student_id,
                    ScoreEvent.event_type.in_(event_types),
                )
                .all()
            )
            earned = sum(float(event.points or 0) for event in events)

            if possible > 0:
                percent = RubricService._clamp(
                    (earned / possible) * 100.0
                )
            else:
                completion_events = [
                    event
                    for event in events
                    if event.event_type == "MODULE_COMPLETION"
                ]
                percent = 100.0 if completion_events else 0.0

            return {
                "score_percent": percent,
                "raw_earned": round(earned, 2),
                "raw_possible": round(possible, 2),
                "module_ids": [],
                "event_types": event_types,
            }

        modules = (
            db.query(LabModule)
            .filter(LabModule.id.in_(module_ids))
            .all()
            if module_ids
            else []
        )
        module_map = {module.id: module for module in modules}

        possible = sum(
            max(0, float(module_map[mid].points or 0))
            for mid in module_ids
            if mid in module_map
        )

        events = (
            db.query(ScoreEvent)
            .filter(
                ScoreEvent.assignment_id == assignment_id,
                ScoreEvent.user_id == student_id,
                ScoreEvent.module_id.in_(module_ids),
                ScoreEvent.event_type.in_(event_types),
            )
            .all()
            if module_ids
            else []
        )

        earned = sum(float(event.points or 0) for event in events)

        if possible > 0:
            percent = RubricService._clamp((earned / possible) * 100.0)
        else:
            completed_ids = {
                event.module_id
                for event in events
                if event.event_type == "MODULE_COMPLETION"
            }
            percent = (
                RubricService._clamp(
                    (len(completed_ids) / len(module_ids)) * 100.0
                )
                if module_ids
                else 0.0
            )

        return {
            "score_percent": percent,
            "raw_earned": round(earned, 2),
            "raw_possible": round(possible, 2),
            "module_ids": module_ids,
            "event_types": event_types,
        }

    @staticmethod
    def calculate_student_rubric(
        db: Session,
        assignment_id: int,
        student_id: int,
    ) -> Dict:
        assignment = (
            db.query(Assignment)
            .filter(Assignment.id == assignment_id)
            .first()
        )
        if assignment is None:
            raise HTTPException(status_code=404, detail="Assignment not found.")

        student = db.query(User).filter(User.id == student_id).first()
        if student is None:
            raise HTTPException(status_code=404, detail="Student not found.")

        snapshot = RubricService.get_assignment_snapshot(db, assignment_id)
        rubric = snapshot.rubric_json or {}
        criteria = rubric.get("criteria") or []

        manual_rows = (
            db.query(AssignmentCriterionGrade)
            .filter(
                AssignmentCriterionGrade.assignment_id == assignment_id,
                AssignmentCriterionGrade.student_id == student_id,
            )
            .all()
        )
        manual_map = {row.criterion_key: row for row in manual_rows}

        result_criteria = []
        weighted_total = 0.0
        pending_manual = 0

        for criterion in criteria:
            weight = float(criterion.get("weight_percent") or 0)
            mode = str(criterion.get("grading_mode") or "AUTO").upper()

            if mode == "AUTO":
                auto = RubricService._auto_criterion_percent(
                    db,
                    assignment_id,
                    student_id,
                    criterion,
                )
                percent = float(auto["score_percent"])
                criterion_feedback = ""
                graded_by = None
                raw_earned = auto["raw_earned"]
                raw_possible = auto["raw_possible"]
            else:
                row = manual_map.get(criterion["key"])
                if row is None:
                    percent = 0.0
                    pending_manual += 1
                    criterion_feedback = ""
                    graded_by = None
                else:
                    percent = float(row.score_percent or 0)
                    criterion_feedback = row.feedback or ""
                    graded_by = row.graded_by
                raw_earned = None
                raw_possible = None

            contribution = round((percent * weight) / 100.0, 2)
            weighted_total += contribution

            level = RubricService._performance_level(criterion, percent)

            result_criteria.append(
                {
                    **criterion,
                    "score_percent": round(percent, 2),
                    "weighted_contribution": contribution,
                    "performance_level": level,
                    "feedback": criterion_feedback,
                    "graded_by": graded_by,
                    "raw_earned": raw_earned,
                    "raw_possible": raw_possible,
                    "pending": mode == "MANUAL"
                    and criterion["key"] not in manual_map,
                }
            )

        return {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "student_name": student.name or student.email.split("@")[0],
            "rubric_snapshot_id": snapshot.id,
            "rubric_version": snapshot.rubric_version,
            "rubric_name": rubric.get("name") or "Assignment Rubric",
            "rubric_description": rubric.get("description") or "",
            "rubric_percent": RubricService._clamp(weighted_total),
            "pending_manual_criteria": pending_manual,
            "criteria": result_criteria,
        }

    @staticmethod
    def save_manual_criteria(
        db: Session,
        assignment_id: int,
        student_id: int,
        criteria_updates: List[Dict],
        graded_by: int,
    ) -> int:
        snapshot = RubricService.get_assignment_snapshot(db, assignment_id)
        rubric_criteria = {
            criterion["key"]: criterion
            for criterion in (snapshot.rubric_json or {}).get("criteria", [])
        }

        published = (
            db.query(AssignmentGrade)
            .filter(
                AssignmentGrade.assignment_id == assignment_id,
                AssignmentGrade.student_id == student_id,
                AssignmentGrade.status == "PUBLISHED",
            )
            .first()
        )
        if published is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Published grades are locked. Reopen the gradebook before "
                    "editing criterion grades."
                ),
            )

        updated = 0
        for item in criteria_updates:
            key = str(item.get("criterion_key") or "")
            criterion = rubric_criteria.get(key)
            if criterion is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Rubric criterion not found: {key}",
                )
            if str(criterion.get("grading_mode")).upper() != "MANUAL":
                raise HTTPException(
                    status_code=422,
                    detail=f"Criterion '{key}' is automatic and cannot be manually scored.",
                )

            score = float(item.get("score_percent"))
            if score < 0 or score > 100:
                raise HTTPException(
                    status_code=422,
                    detail="Criterion score_percent must be between 0 and 100.",
                )

            row = (
                db.query(AssignmentCriterionGrade)
                .filter(
                    AssignmentCriterionGrade.assignment_id == assignment_id,
                    AssignmentCriterionGrade.student_id == student_id,
                    AssignmentCriterionGrade.criterion_key == key,
                )
                .first()
            )
            if row is None:
                row = AssignmentCriterionGrade(
                    assignment_id=assignment_id,
                    student_id=student_id,
                    criterion_key=key,
                    score_percent=Decimal(str(score)),
                )
                db.add(row)

            row.score_percent = Decimal(str(score))
            row.feedback = str(item.get("feedback") or "").strip() or None
            row.graded_by = graded_by
            row.updated_at = datetime.utcnow()
            updated += 1

        db.flush()
        return updated
