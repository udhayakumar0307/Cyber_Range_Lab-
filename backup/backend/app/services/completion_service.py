"""
CompletionService — validates module completion and delegates to ScoreService.

Responsibilities:
  - Guard against duplicate completions.
  - Write UserLabProgress / UserProgress status records.
  - Preserve academic assignment context on every progress write.
  - Call ScoreService.award_module_points() as the only scoring mutation path.
  - Return a structured CompletionResult.

CompletionService NEVER directly modifies users.total_score.
CompletionService NEVER writes score_events directly.
"""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.user_progress import UserProgress
from app.services.score_service import ScoreService


logger = logging.getLogger(__name__)


class CompletionResult:
    """Value object returned by CompletionService completion methods."""

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
    Canonical module-completion service.

    Academic runs are scoped by assignment_id.
    Personal/unassigned runs use assignment_id=None.

    This distinction must be preserved for:
      - duplicate guards,
      - progress lookups,
      - progress creation,
      - ScoreEvent creation through ScoreService.
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
        assignment_id: Optional[int] = None,
    ) -> CompletionResult:
        """
        Complete a lab module backed by UserLabProgress.

        The caller owns the transaction and must commit after this method
        returns successfully.
        """

        user_id = user.id

        # 1. Assignment-scoped duplicate guard.
        if ScoreService.is_module_completed(
            db,
            user_id,
            module_id,
            assignment_id=assignment_id,
        ):
            return CompletionResult(
                already_completed=True,
                points_awarded=0,
                new_total_score=user.total_score or 0,
                module_id=module_id,
                lab_id=lab_id,
            )

        now = datetime.utcnow()

        # 2. Assignment-scoped UserLabProgress upsert.
        progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user_id,
            UserLabProgress.lab_id == lab_id,
            UserLabProgress.module_id == module_id,
        )

        if assignment_id is None:
            progress_query = progress_query.filter(
                UserLabProgress.assignment_id.is_(None)
            )
        else:
            progress_query = progress_query.filter(
                UserLabProgress.assignment_id == assignment_id
            )

        progress = progress_query.first()

        if progress is None:
            progress = UserLabProgress(
                assignment_id=assignment_id,
                user_id=user_id,
                lab_id=lab_id,
                module_id=module_id,
                status="COMPLETED",
                score=0,
                attempts=1,
                started_at=now,
                completed_at=now,
                time_taken_seconds=0,
                last_submission=submitted_flag,
                flag_correct=True,
            )
            db.add(progress)
        else:
            duration = (
                int((now - progress.started_at).total_seconds())
                if progress.started_at
                else 0
            )

            # Preserve/confirm assignment identity on the row.
            progress.assignment_id = assignment_id
            progress.status = "COMPLETED"
            progress.completed_at = now
            progress.time_taken_seconds = duration
            progress.last_submission = submitted_flag
            progress.flag_correct = True

        # Ensure the progress row exists before ScoreService writes the event.
        db.flush()

        # 3. Award through the only authorized score mutation service.
        points_awarded, new_total = ScoreService.award_module_points(
            db=db,
            user=user,
            lab_id=lab_id,
            module_id=module_id,
            track_id=track_id,
            hint1_used=hint1_used,
            hint2_used=hint2_used,
            base_points=base_points,
            assignment_id=assignment_id,
        )

        # 4. Keep the stored progress score synchronized with the ledger award.
        progress.score = points_awarded
        db.add(progress)

        logger.info(
            "[CompletionService] Completed lab module: "
            "user_id=%s, assignment_id=%s, lab_id=%r, module_id=%r, "
            "points_awarded=%s, new_total=%s",
            user_id,
            assignment_id,
            lab_id,
            module_id,
            points_awarded,
            new_total,
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
        module_id: str,
        *,
        base_points: Optional[int] = None,
        hint1_used: bool = False,
        hint2_used: bool = False,
        submitted_flag: Optional[str] = None,
        assignment_id: Optional[int] = None,
    ) -> CompletionResult:
        """
        Complete a track-based module backed by UserProgress.

        Examples:
          CLL:
            command-line-lab_{track_id}_{module_id}

          Crypto:
            cryptography-lab_{track_id}_{module_id}

        The short module_id is stored in UserProgress; the canonical long
        module ID is written to ScoreEvent through ScoreService.
        """

        canonical_module_id = f"{lab_id}_{track_id}_{module_id}"
        user_id_str = str(user.id)

        # 1. Assignment-scoped duplicate guard.
        if ScoreService.is_module_completed(
            db,
            user.id,
            canonical_module_id,
            assignment_id=assignment_id,
        ):
            return CompletionResult(
                already_completed=True,
                points_awarded=0,
                new_total_score=user.total_score or 0,
                module_id=canonical_module_id,
                lab_id=lab_id,
            )

        now = datetime.utcnow()

        # 2. Assignment-scoped UserProgress upsert.
        record_query = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == track_id,
            UserProgress.module_id == module_id,
        )

        if assignment_id is None:
            record_query = record_query.filter(
                UserProgress.assignment_id.is_(None)
            )
        else:
            record_query = record_query.filter(
                UserProgress.assignment_id == assignment_id
            )

        record = record_query.first()

        if record is None:
            record = UserProgress(
                assignment_id=assignment_id,
                user_id=user_id_str,
                track_id=track_id,
                module_id=module_id,
                completed=True,
                module_score=0,
                hint1_used=hint1_used,
                hint2_used=hint2_used,
                flag_submitted=submitted_flag,
                started_at=now,
                completed_at=now,
                updated_at=now,
            )
            db.add(record)
        else:
            # Preserve/confirm assignment identity on the row.
            record.assignment_id = assignment_id
            record.completed = True
            record.hint1_used = bool(record.hint1_used or hint1_used)
            record.hint2_used = bool(record.hint2_used or hint2_used)
            record.flag_submitted = submitted_flag
            record.completed_at = now
            record.updated_at = now

        db.flush()

        # 3. Award through ScoreService using the same assignment context.
        points_awarded, new_total = ScoreService.award_module_points(
            db=db,
            user=user,
            lab_id=lab_id,
            module_id=canonical_module_id,
            track_id=track_id,
            hint1_used=hint1_used,
            hint2_used=hint2_used,
            base_points=base_points,
            assignment_id=assignment_id,
        )

        # 4. Synchronize the track progress row with the awarded score.
        record.module_score = points_awarded
        db.add(record)

        logger.info(
            "[CompletionService] Completed track module: "
            "user_id=%s, assignment_id=%s, lab_id=%r, track_id=%r, "
            "module_id=%r, canonical=%r, points_awarded=%s, new_total=%s",
            user.id,
            assignment_id,
            lab_id,
            track_id,
            module_id,
            canonical_module_id,
            points_awarded,
            new_total,
        )

        return CompletionResult(
            already_completed=False,
            points_awarded=points_awarded,
            new_total_score=new_total,
            module_id=canonical_module_id,
            lab_id=lab_id,
        )
