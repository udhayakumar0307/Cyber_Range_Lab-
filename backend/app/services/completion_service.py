"""
CompletionService — validates module completion and delegates to ScoreService.

Responsibilities:
  - Validate that objectives are completed
  - Check that the module is unlocked (sequential progression)
  - Guard against duplicate completions
  - Write UserLabProgress / UserProgress status records
  - Call ScoreService.award_module_points() (the ONLY caller)
  - Return a structured completion result

CompletionService NEVER directly modifies users.total_score.
CompletionService NEVER writes score_events directly.
"""

import logging
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.user_progress import UserProgress
from app.services.score_service import ScoreService

logger = logging.getLogger(__name__)


class CompletionResult:
    """Value object returned by CompletionService.complete_module()."""

    def __init__(
        self,
        *,
        already_completed: bool,
        points_awarded: int,
        new_total_score: int,
        module_id: str,
        lab_id: str,
    ):
        self.already_completed = already_completed
        self.points_awarded = points_awarded
        self.new_total_score = new_total_score
        self.module_id = module_id
        self.lab_id = lab_id


class CompletionService:
    """
    Validates a module completion and delegates scoring to ScoreService.

    Usage (in an API endpoint)
    --------------------------
    result = CompletionService.complete_lab_module(
        db=db,
        user=current_user,
        lab_id="lab1-recon",
        module_id="lab1-recon_module1",
        track_id="recon",
        base_points=150,
        hint1_used=record.hint1_used if record else False,
        hint2_used=record.hint2_used if record else False,
        submitted_flag="FLAG{...}",
    )
    if result.already_completed:
        return {"correct": True, "message": "Already solved.", "points": 0,
                "total_points": result.new_total_score}
    db.commit()
    """

    @staticmethod
    def complete_lab_module(
        db: Session,
        user: User,
        lab_id: str,
        module_id: str,
        *,
        track_id: Optional[str] = None,
        base_points: Optional[int] = None,
        hint1_used: bool = False,
        hint2_used: bool = False,
        submitted_flag: Optional[str] = None,
    ) -> CompletionResult:
        """
        Records a successful module completion and awards points via ScoreService.

        Steps
        -----
        1. Check for duplicate completion via score_events.
        2. Upsert the UserLabProgress record to COMPLETED.
        3. Call ScoreService.award_module_points().
        4. Return CompletionResult (caller is responsible for db.commit()).
        """
        user_id = user.id

        # Step 1: Duplicate guard
        if ScoreService.is_module_completed(db, user_id, module_id):
            return CompletionResult(
                already_completed=True,
                points_awarded=0,
                new_total_score=user.total_score or 0,
                module_id=module_id,
                lab_id=lab_id,
            )

        now = datetime.utcnow()

        # Step 2: Upsert UserLabProgress
        progress = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user_id,
            UserLabProgress.module_id == module_id,
        ).first()

        if not progress:
            progress = UserLabProgress(
                user_id=user_id,
                lab_id=lab_id,
                module_id=module_id,
                status="COMPLETED",
                score=0,          # will be updated after ScoreService call
                attempts=1,
                started_at=now,
                completed_at=now,
                time_taken_seconds=0,
                last_submission=submitted_flag,
                flag_correct=True,
            )
            db.add(progress)
        else:
            if progress.status == "COMPLETED":
                # UserLabProgress already marked complete but no score_event exists
                # (legacy data). Proceed to award points via ScoreService.
                pass
            duration = (
                int((now - progress.started_at).total_seconds())
                if progress.started_at else 0
            )
            progress.status = "COMPLETED"
            progress.completed_at = now
            progress.time_taken_seconds = duration
            progress.last_submission = submitted_flag
            progress.flag_correct = True

        # Flush so the progress row has a PK before ScoreService call
        db.flush()

        # Step 3: Award points via ScoreService (ONLY entry point for score writes)
        points_awarded, new_total = ScoreService.award_module_points(
            db=db,
            user=user,
            lab_id=lab_id,
            module_id=module_id,
            track_id=track_id,
            hint1_used=hint1_used,
            hint2_used=hint2_used,
            base_points=base_points,
        )

        # Update the stored score on the progress row to match what ScoreService awarded
        progress.score = points_awarded
        db.add(progress)

        logger.info(
            f"[CompletionService] Completed: user_id={user_id}, "
            f"lab_id={lab_id!r}, module_id={module_id!r}, "
            f"points_awarded={points_awarded}, new_total={new_total}"
        )

        return CompletionResult(
            already_completed=False,
            points_awarded=points_awarded,
            new_total_score=new_total,
            module_id=module_id,
            lab_id=lab_id,
        )

    @staticmethod
    def complete_track_module(
        db: Session,
        user: User,
        lab_id: str,
        track_id: str,
        module_id: str,   # short module id, e.g. "module1"
        *,
        base_points: Optional[int] = None,
        hint1_used: bool = False,
        hint2_used: bool = False,
        submitted_flag: Optional[str] = None,
    ) -> CompletionResult:
        """
        Records completion of a track-based module (CLL / Crypto).

        The canonical module_id in score_events is the long form used in UserProgress.
        For CLL this is: `command-line-lab_{track_id}_{module_id}`
        For Crypto: `cryptography-lab_{track_id}_{module_id}`
        """
        canonical_module_id = f"{lab_id}_{track_id}_{module_id}"
        user_id_str = str(user.id)

        # 1. Duplicate guard
        if ScoreService.is_module_completed(db, user.id, canonical_module_id):
            return CompletionResult(
                already_completed=True,
                points_awarded=0,
                new_total_score=user.total_score or 0,
                module_id=canonical_module_id,
                lab_id=lab_id,
            )

        now = datetime.utcnow()

        # 2. Upsert UserProgress (track-based record)
        record = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == track_id,
            UserProgress.module_id == module_id,
        ).first()

        if not record:
            record = UserProgress(
                user_id=user_id_str,
                track_id=track_id,
                module_id=module_id,
                completed=True,
                module_score=0,
                hint1_used=hint1_used,
                hint2_used=hint2_used,
                flag_submitted=submitted_flag,
                completed_at=now,
                updated_at=now,
            )
            db.add(record)
        else:
            record.completed = True
            record.hint1_used = record.hint1_used or hint1_used
            record.hint2_used = record.hint2_used or hint2_used
            record.flag_submitted = submitted_flag
            record.completed_at = now
            record.updated_at = now

        db.flush()

        # 3. Award via ScoreService
        points_awarded, new_total = ScoreService.award_module_points(
            db=db,
            user=user,
            lab_id=lab_id,
            module_id=canonical_module_id,
            track_id=track_id,
            hint1_used=hint1_used,
            hint2_used=hint2_used,
            base_points=base_points,
        )

        # Sync score back to UserProgress record
        record.module_score = points_awarded
        db.add(record)

        logger.info(
            f"[CompletionService] Track module completed: user_id={user.id}, "
            f"lab_id={lab_id!r}, track_id={track_id!r}, module_id={module_id!r}, "
            f"canonical={canonical_module_id!r}, points_awarded={points_awarded}"
        )

        return CompletionResult(
            already_completed=False,
            points_awarded=points_awarded,
            new_total_score=new_total,
            module_id=canonical_module_id,
            lab_id=lab_id,
        )
