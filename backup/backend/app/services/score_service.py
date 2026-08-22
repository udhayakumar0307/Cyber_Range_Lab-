"""
Production-grade ScoreService.

This is the ONLY class permitted to:
  - Award module completion points
  - Record hint penalties
  - Update users.total_score
  - Write to score_events (the immutable audit ledger)
  - Invalidate leaderboard and dashboard caches

No controller, endpoint, helper, or progress service may directly modify
`user.total_score` or insert `score_events` rows. All calls go through this service.

Architecture decision — Hybrid cached-total + event-log:
  • `users.total_score`  → fast-read cache; only written here.
  • `score_events`       → append-only ledger; used for auditing and admin rebuild.
  • Normal gameplay reads `users.total_score` directly (O(1)).
  • Admin rebuild re-derives it from `score_events` (O(n events)).

Progression deduction rule: each completed module deducts 1 pt from the
gross score so that completing all 40 modules costs 40 pts.

Hint penalty rule: each hint used costs 20 pts, applied at module-completion time.
"""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.score_event import ScoreEvent
from app.models.lab_module import LabModule
from app.core.constants import ScoreEventType
from app.core.cache import invalidate_leaderboard, invalidate_dashboard

logger = logging.getLogger(__name__)

# Each completed module deducts this many points (progression cost). Set to 0 for exact point awards.
PROGRESSION_DEDUCTION_PER_MODULE: int = 0


class ScoreService:
    """
    Single authoritative service for all score mutations.

    Usage
    -----
    from app.services.score_service import ScoreService

    awarded, new_total = ScoreService.award_module_points(
        db=db,
        user=current_user,
        lab_id="command-line-lab",
        module_id="command-line-lab_linux_module1",
        track_id="linux",
        hint1_used=False,
        hint2_used=False,
        base_points=200,          # optional — falls back to lab_modules.points
    )
    """

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def award_module_points(
        db: Session,
        user: User,
        lab_id: str,
        module_id: str,
        track_id: Optional[str] = None,
        hint1_used: bool = False,
        hint2_used: bool = False,
        base_points: Optional[int] = None,
        assignment_id: Optional[int] = None,
    ) -> tuple[int, int]:
        """
        Award points for completing a module.

        Returns
        -------
        (points_awarded, new_total_score)

        Guarantees
        ----------
        - Duplicate-safe: if a MODULE_COMPLETION event already exists for this
          (user, module_id), returns (0, current_total) without any DB writes.
        - Atomic: all writes happen inside the caller's transaction; the caller
          must commit after this call.
        - No partial updates: either all writes succeed or none do.
        """
        # 1. Duplicate guard — check score_events for an existing completion
        query = db.query(ScoreEvent).filter(
        ScoreEvent.user_id == user.id,
        ScoreEvent.module_id == module_id,
        ScoreEvent.event_type == ScoreEventType.MODULE_COMPLETION,
        )

        if assignment_id is None:
            query = query.filter(ScoreEvent.assignment_id.is_(None))
        else:
            query = query.filter(
                ScoreEvent.assignment_id == assignment_id
            )

        existing = query.first()

        if existing:
            logger.info(
                f"[ScoreService] Duplicate completion blocked: "
                f"user_id={user.id}, module_id={module_id!r} — already awarded {existing.points} pts"
            )
            return 0, (user.total_score or 0)

        # 2. Resolve module points from database if not supplied by caller
        gross = base_points
        if gross is None:
            mod = db.query(LabModule).filter(LabModule.id == module_id).first()
            if mod and mod.points:
                gross = mod.points
            else:
                logger.warning(
                    f"[ScoreService] module_id={module_id!r} not in lab_modules "
                    f"and no base_points provided; defaulting to 0"
                )
                gross = 0

        # 3. Apply hint penalties
        hint_penalty = (20 if hint1_used else 0) + (20 if hint2_used else 0)
        net_module_points = max(0, gross - hint_penalty)

        # 4. Apply progression deduction (-1 per completed module)
        net_awarded = max(0, net_module_points - PROGRESSION_DEDUCTION_PER_MODULE)

        # 5. Insert MODULE_COMPLETION event (immutable ledger)
        event = ScoreEvent(
            assignment_id=assignment_id,
            user_id=user.id,
            lab_id=lab_id,
            track_id=track_id,
            module_id=module_id,
            event_type=ScoreEventType.MODULE_COMPLETION,
            points=net_awarded,
            created_at=datetime.utcnow()
        )
        db.add(event)

        # 6. Update users.total_score cache
        old_score = user.total_score or 0
        new_score = old_score + net_awarded
        user.total_score = new_score
        db.add(user)

        logger.info(
            f"[ScoreService] Awarded: user_id={user.id}, module_id={module_id!r}, "
            f"gross={gross}, hint_penalty=-{hint_penalty}, "
            f"net_module={net_module_points}, progression_deduction=-{PROGRESSION_DEDUCTION_PER_MODULE}, "
            f"net_awarded={net_awarded}, "
            f"total: {old_score} → {new_score}"
        )

        # 7. Invalidate caches (non-fatal if cache layer is unavailable)
        try:
            invalidate_leaderboard()
            invalidate_dashboard(str(user.id))
        except Exception as cache_err:
            logger.warning(f"[ScoreService] Cache invalidation error (non-fatal): {cache_err}")

        return net_awarded, new_score

    @staticmethod
    def record_hint_penalty(
        db: Session,
        user: User,
        lab_id: str,
        module_id: str,
        track_id: Optional[str] = None,
        penalty_points: int = 20,
    ) -> int:
        """
        Records a hint penalty event.

        Note: In the current design, hint penalties are applied inline at
        module completion via `award_module_points`. This method is provided
        for future use cases where you want to deduct points immediately upon
        hint unlock (rather than at module completion time).

        Returns the new total_score.
        """
        deduction = -abs(penalty_points)
        event = ScoreEvent(
            user_id=user.id,
            lab_id=lab_id,
            track_id=track_id,
            module_id=module_id,
            event_type=ScoreEventType.HINT_PENALTY,
            points=deduction,
            created_at=datetime.utcnow(),
        )
        db.add(event)
        new_score = max(0, (user.total_score or 0) + deduction)
        user.total_score = new_score
        db.add(user)
        try:
            invalidate_leaderboard()
            invalidate_dashboard(str(user.id))
        except Exception:
            pass
        return new_score

    @staticmethod
    def get_user_total(db: Session, user: User) -> int:
        """
        Returns the user's current total_score from the cached column.
        This is a fast O(1) read — no aggregation.
        """
        return user.total_score or 0

    # ─────────────────────────────────────────────────────────────────────────
    # Admin-only rebuild tool
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def rebuild_user_score_from_events(db: Session, user: User) -> int:
        """
        ADMIN MAINTENANCE TOOL ONLY.

        Recomputes users.total_score by summing all score_events for the user.
        Call this only when suspecting cache corruption; it is not part of
        normal application flow.

        Returns the corrected total_score.
        """
        from sqlalchemy import func
        rebuilt = db.query(func.sum(ScoreEvent.points)).filter(
            ScoreEvent.user_id == user.id
        ).scalar() or 0

        rebuilt = max(0, rebuilt)
        if user.total_score != rebuilt:
            logger.warning(
                f"[ScoreService.rebuild] user_id={user.id}: "
                f"cache={user.total_score} vs events_sum={rebuilt} — correcting"
            )
            user.total_score = rebuilt
            db.add(user)
            db.commit()
            try:
                invalidate_leaderboard()
                invalidate_dashboard(str(user.id))
            except Exception:
                pass
        return rebuilt

    @staticmethod
    def is_module_completed(
        db: Session,
        user_id: int,
        module_id: str,
        assignment_id: Optional[int] = None,
    ) -> bool:

        query = db.query(ScoreEvent).filter(
            ScoreEvent.user_id == user_id,
            ScoreEvent.module_id == module_id,
            ScoreEvent.event_type == ScoreEventType.MODULE_COMPLETION,
        )

        if assignment_id is None:
            query = query.filter(
                ScoreEvent.assignment_id.is_(None)
            )
        else:
            query = query.filter(
                ScoreEvent.assignment_id == assignment_id
            )

        return query.first() is not None


# ─────────────────────────────────────────────────────────────────────────────
# Legacy shim — kept only for endpoints that haven't been migrated yet.
# Marked deprecated. Remove callers and then remove this function.
# ─────────────────────────────────────────────────────────────────────────────

def reconcile_user_score(db: Session, user_id_str: str) -> int:
    """
    DEPRECATED — admin maintenance tool, not part of normal gameplay flow.

    Kept as a shim so existing callers (reporting.py view endpoints) continue
    to return a score without crashing until they are migrated to read
    `current_user.total_score` directly.

    This function no longer re-writes total_score; it simply returns the
    cached value from users.total_score.
    """
    user_str = str(user_id_str)
    user = None
    if user_str.isdigit():
        user = db.query(User).filter(User.id == int(user_str)).first()
    if not user:
        user = db.query(User).filter(User.email == user_str).first()
    if not user:
        return 0

    logger.debug(
        f"[reconcile_user_score SHIM] user_id={user.id} returning cached total_score={user.total_score}"
    )
    return user.total_score or 0
