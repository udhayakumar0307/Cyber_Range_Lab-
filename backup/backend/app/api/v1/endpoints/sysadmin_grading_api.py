from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.sysadmin_submission import SysadminSubmission
from app.models.user import User
from app.schemas.sysadmin_grading import (
    SysadminGradingStatusResponse,
    SysadminSubmissionRequest,
    SysadminSubmissionResponse,
)
from app.services.sysadmin_grading.config import (
    GradingConfigurationError,
    SysadminGradingSettings,
)
from app.services.sysadmin_grading.question_bank import QuestionBankRepository
from app.services.sysadmin_grading.service import (
    SubmissionValidationError,
    SysadminGradingService,
)


logger = logging.getLogger(__name__)
router = APIRouter()


def _assert_real_active_user(user: User) -> None:
    # The development fallback user (-999) is not persisted and therefore
    # cannot own a foreign-key-backed academic submission record.
    if not getattr(user, "id", None) or int(user.id) <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use a persisted CyberRange user account for submission testing.",
        )
    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Inactive users cannot submit work.")


@router.get("/status", response_model=SysadminGradingStatusResponse)
def grading_status(current_user: User = Depends(get_current_user)):
    settings = SysadminGradingSettings.from_env()
    repository = QuestionBankRepository(settings.question_bank_root)
    try:
        settings.assert_ready()
        return SysadminGradingStatusResponse(
            enabled=settings.enabled,
            configured=True,
            available_labs=repository.available_lab_ids(),
            detail="Local Docker grading executor is ready.",
        )
    except GradingConfigurationError as exc:
        return SysadminGradingStatusResponse(
            enabled=settings.enabled,
            configured=False,
            available_labs=[],
            detail=str(exc),
        )


@router.post(
    "/submissions",
    response_model=SysadminSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_script(
    payload: SysadminSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_real_active_user(current_user)

    try:
        service = SysadminGradingService()
        # This endpoint is intentionally synchronous for the MVP. FastAPI runs
        # sync route handlers in its worker threadpool, so the SQLAlchemy Session
        # and blocking Docker subprocess stay in the same worker thread.
        row = service.grade_submission(
            db,
            student_id=int(current_user.id),
            lab_id=payload.lab_id,
            filename=payload.filename,
            content=payload.content,
        )
    except SubmissionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GradingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected Sysadmin submission failure")
        raise HTTPException(status_code=500, detail="Unable to grade submission.") from exc

    response = service.student_view(row)
    if row.status == "ERROR":
        # Persist the failed attempt, but make the operational failure explicit
        # to the CLI/API caller rather than presenting it as an academic FAIL.
        raise HTTPException(
            status_code=502,
            detail={
                "submission_id": row.id,
                "message": (
                    "Grading infrastructure error. "
                    "Contact your instructor with this submission ID."
                ),
            },
        )
    return response


@router.get(
    "/submissions/{submission_id}",
    response_model=SysadminSubmissionResponse,
)
def get_submission(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_real_active_user(current_user)
    row = (
        db.query(SysadminSubmission)
        .filter(
            SysadminSubmission.id == submission_id,
            SysadminSubmission.student_id == int(current_user.id),
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return SysadminGradingService().student_view(row)
