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
    Validates module completion and delegates scoring to ScoreService.

    Usage
    -----
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
        assignment_id=assignment_id,
    )

    if result.already_completed:
        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": result.new_total_score,
        }

    db.commit()
    """

    # -------------------------------------------------------------------------
    # Standard lab-module completion
    # -------------------------------------------------------------------------

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
        Records successful completion of a standard lab module.

        Assignment behavior
        -------------------
        When assignment_id is supplied, completion is isolated to that
        assignment. Therefore the same user may legitimately complete the same
        lab/module again under another assignment.

        When assignment_id is None, legacy/personal-lab behavior is preserved.

        Steps
        -----
        1. Check for duplicate completion through ScoreService.
        2. Upsert the assignment-specific UserLabProgress row.
        3. Award points through ScoreService.
        4. Synchronize the awarded score into UserLabProgress.
        5. Return CompletionResult.

        The caller remains responsible for db.commit().
        """

        user_id = user.id

        # ------------------------------------------------------------------
        # Step 1: Assignment-aware duplicate guard
        # ------------------------------------------------------------------

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

        # ------------------------------------------------------------------
        # Step 2: Assignment-aware UserLabProgress lookup
        # ------------------------------------------------------------------

        progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == user_id,
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

        # ------------------------------------------------------------------
        # Step 2A: Create progress row if it does not exist
        # ------------------------------------------------------------------

        if not progress:
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

        # ------------------------------------------------------------------
        # Step 2B: Update existing progress row
        # ------------------------------------------------------------------

        else:
            if progress.status == "COMPLETED":
                # Legacy recovery case:
                #
                # The progress row may already say COMPLETED while the
                # corresponding ScoreEvent does not exist.
                #
                # Because ScoreService's duplicate guard already passed above,
                # continue so that the immutable score event can be created.
                pass

            duration = (
                int((now - progress.started_at).total_seconds())
                if progress.started_at
                else 0
            )

            progress.status = "COMPLETED"
            progress.completed_at = now
            progress.time_taken_seconds = duration
            progress.last_submission = submitted_flag
            progress.flag_correct = True

            # Ensure legacy/incomplete records acquire assignment context.
            progress.assignment_id = assignment_id

        # Flush before scoring so the progress record exists in the current
        # transaction.
        db.flush()

        # ------------------------------------------------------------------
        # Step 3: Award points through the authoritative ScoreService
        # ------------------------------------------------------------------

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

        # ------------------------------------------------------------------
        # Step 4: Synchronize module score into progress
        # ------------------------------------------------------------------

        progress.score = points_awarded
        db.add(progress)

        logger.info(
            "[CompletionService] Completed: "
            f"user_id={user_id}, "
            f"assignment_id={assignment_id}, "
            f"lab_id={lab_id!r}, "
            f"module_id={module_id!r}, "
            f"points_awarded={points_awarded}, "
            f"new_total={new_total}"
        )

        return CompletionResult(
            already_completed=False,
            points_awarded=points_awarded,
            new_total_score=new_total,
            module_id=module_id,
            lab_id=lab_id,
        )

    # -------------------------------------------------------------------------
    # Track-based completion
    # -------------------------------------------------------------------------

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
        Records completion of a track-based module such as Command Line Lab
        or Cryptography Lab.

        UserProgress stores the short module ID, while ScoreEvent uses the
        canonical long-form module ID.

        Examples
        --------
        Command Line Lab:
            command-line-lab_linux_module1

        Cryptography Lab:
            cryptography-lab_crypto_module1

        Assignment behavior
        -------------------
        Progress and scoring are scoped to assignment_id when provided.

        This allows:

            Assignment A:
                student -> module1 -> completed

            Assignment B:
                same student -> same module1 -> valid new completion

        while still preventing duplicate completion inside Assignment A.
        """

        canonical_module_id = f"{lab_id}_{track_id}_{module_id}"
        user_id_str = str(user.id)

        # ------------------------------------------------------------------
        # Step 1: Assignment-aware duplicate guard
        # ------------------------------------------------------------------

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

        # ------------------------------------------------------------------
        # Step 2: Assignment-aware UserProgress lookup
        # ------------------------------------------------------------------

        progress_query = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == track_id,
            UserProgress.module_id == module_id,
        )

        if assignment_id is None:
            progress_query = progress_query.filter(
                UserProgress.assignment_id.is_(None)
            )
        else:
            progress_query = progress_query.filter(
                UserProgress.assignment_id == assignment_id
            )

        record = progress_query.first()

        # ------------------------------------------------------------------
        # Step 2A: Create progress row
        # ------------------------------------------------------------------

        if not record:
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

        # ------------------------------------------------------------------
        # Step 2B: Update existing progress row
        # ------------------------------------------------------------------

        else:
            record.assignment_id = assignment_id
            record.completed = True
            record.hint1_used = record.hint1_used or hint1_used
            record.hint2_used = record.hint2_used or hint2_used
            record.flag_submitted = submitted_flag
            record.completed_at = now
            record.updated_at = now

        db.flush()

        # ------------------------------------------------------------------
        # Step 3: Award points through ScoreService
        # ------------------------------------------------------------------

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

        # ------------------------------------------------------------------
        # Step 4: Synchronize module score
        # ------------------------------------------------------------------

        record.module_score = points_awarded
        db.add(record)

        logger.info(
            "[CompletionService] Track module completed: "
            f"user_id={user.id}, "
            f"assignment_id={assignment_id}, "
            f"lab_id={lab_id!r}, "
            f"track_id={track_id!r}, "
            f"module_id={module_id!r}, "
            f"canonical={canonical_module_id!r}, "
            f"points_awarded={points_awarded}, "
            f"new_total={new_total}"
        )

        return CompletionResult(
            already_completed=False,
            points_awarded=points_awarded,
            new_total_score=new_total,
            module_id=canonical_module_id,
            lab_id=lab_id,
        )