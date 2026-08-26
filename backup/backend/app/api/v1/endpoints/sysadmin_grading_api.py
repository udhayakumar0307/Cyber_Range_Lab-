from __future__ import annotations

import logging
import uuid

from fastapi import Request

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
    WorkspaceSubmissionRequest,
    WorkspaceTokenRequest,
    WorkspaceTokenResponse,
)
from app.services.sysadmin_grading.config import (
    GradingConfigurationError,
    SysadminGradingSettings,
)
from app.services.sysadmin_grading.question_bank import QuestionBankError, QuestionBankRepository
from app.services.sysadmin_grading.service import (
    SubmissionValidationError,
    SysadminGradingService,
)
from app.services.sysadmin_grading.workspace_tokens import (
    WorkspaceTokenError,
    create_workspace_submission_token,
    decode_workspace_submission_token,
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
    except (GradingConfigurationError, QuestionBankError) as exc:
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


@router.post("/workspace-token", response_model=WorkspaceTokenResponse)
def create_workspace_token(
    payload: WorkspaceTokenRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Development bridge for provisioning a terminal-only workspace credential.

    Production workspace provisioning should call the token service internally
    after validating the student's assignment. User self-minting is disabled by
    default and must be explicitly enabled for local integration testing.
    """
    _assert_real_active_user(current_user)
    settings = SysadminGradingSettings.from_env()
    if not settings.allow_user_workspace_token_minting:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Workspace-token self-minting is disabled. "
                "Production workspaces receive credentials from the orchestrator."
            ),
        )
    try:
        settings.assert_ready()
        repository = QuestionBankRepository(settings.question_bank_root)
        repository.resolve_lab(payload.lab_id)
        workspace_id = f"ws-{uuid.uuid4().hex[:20]}"
        token, expires_at = create_workspace_submission_token(
            user_id=int(current_user.id),
            lab_id=payload.lab_id,
            workspace_id=workspace_id,
            ttl_minutes=settings.workspace_token_ttl_minutes,
        )
    except (GradingConfigurationError, QuestionBankError, WorkspaceTokenError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return WorkspaceTokenResponse(
        token=token,
        lab_id=payload.lab_id,
        workspace_id=workspace_id,
        expires_at=expires_at,
    )


def _workspace_bearer_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Workspace submission token required.",
        )
    return auth.split(" ", 1)[1].strip()


@router.post(
    "/workspace-submit",
    response_model=SysadminSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def workspace_submit_script(
    payload: WorkspaceSubmissionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Submit exactly one Bash file using a narrow workspace credential.

    Unlike /submissions, this route does not accept the lab ID from the caller;
    student identity and lab scope are pinned into the separately signed token.
    A normal CyberRange access JWT is intentionally not accepted here.
    """
    try:
        claims = decode_workspace_submission_token(_workspace_bearer_token(request))
    except WorkspaceTokenError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    user = db.query(User).filter(User.id == claims.user_id).first()
    if not user or not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="Workspace owner is no longer active.")

    try:
        service = SysadminGradingService()
        row = service.grade_submission(
            db,
            student_id=claims.user_id,
            lab_id=claims.lab_id,
            filename=payload.filename,
            content=payload.content,
        )
    except SubmissionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GradingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception(
            "Unexpected workspace submission failure workspace_id=%s user_id=%s lab_id=%s",
            claims.workspace_id,
            claims.user_id,
            claims.lab_id,
        )
        raise HTTPException(status_code=500, detail="Unable to grade submission.") from exc

    response = service.student_view(row)
    if row.status == "ERROR":
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
