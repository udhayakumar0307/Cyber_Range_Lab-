from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, WebSocket, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.sysadmin_submission import SysadminSubmission
from app.models.user import User
from app.schemas.sysadmin_grading import (
    SysadminGradingStatusResponse,
    SysadminLabDetail,
    SysadminLabSummary,
    SysadminSubmissionRequest,
    SysadminSubmissionResponse,
    SysadminWorkspaceResponse,
    SysadminWorkspaceStartRequest,
    SysadminWorkspaceStopResponse,
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
    IdempotencyConflictError,
    SubmissionValidationError,
    SysadminGradingService,
)
from app.services.sysadmin_grading.workspace import (
    SysadminWorkspaceService,
    WorkspaceExecutionError,
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


def _assert_marketplace_access(
    settings: SysadminGradingSettings,
    current_user: User,
    db: Session,
) -> None:
    """Mirror the current Available Labs purchase/free-lab access contract."""
    if not settings.workspace_require_marketplace_access:
        return

    role = str(getattr(current_user, "role", "") or "").lower()
    if role in {"admin", "system_admin", "sysadmin", "super_admin"}:
        return

    # Import lazily to avoid coupling the Sysadmin grading module to marketplace
    # initialization at application import time.
    from app.api.v1.endpoints.labs_api import _get_purchased_lab, _get_sysadmin_assignments

    assignment = next(
        (
            item
            for item in _get_sysadmin_assignments(db)
            if item.get("lab_id") == settings.marketplace_lab_id
        ),
        None,
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Linux System Administration is not currently assigned to this portal.",
        )

    if float(assignment.get("fixed_rate") or 0.0) == 0.0:
        return

    purchased = _get_purchased_lab(db, int(current_user.id), settings.marketplace_lab_id)
    if not purchased:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Purchase or assignment access is required for Linux System Administration.",
        )


@router.get("/status", response_model=SysadminGradingStatusResponse)
def grading_status(current_user: User = Depends(get_current_user)):
    try:
        settings = SysadminGradingSettings.from_env()
        repository = QuestionBankRepository(settings.question_bank_root)
        settings.assert_ready()
        detail = (
            "Local Docker grading executor is ready."
            if settings.executor == "local"
            else "Dedicated ECS grading executor is configured."
        )
        return SysadminGradingStatusResponse(
            enabled=settings.enabled,
            configured=True,
            available_labs=repository.available_lab_ids(),
            detail=detail,
        )
    except (GradingConfigurationError, QuestionBankError) as exc:
        enabled = locals().get("settings").enabled if "settings" in locals() else False
        return SysadminGradingStatusResponse(
            enabled=enabled,
            configured=False,
            available_labs=[],
            detail=str(exc),
        )


@router.get("/labs", response_model=list[SysadminLabSummary])
def list_sysadmin_labs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_real_active_user(current_user)
    settings = SysadminGradingSettings.from_env()
    _assert_marketplace_access(settings, current_user, db)
    try:
        settings.assert_ready()
        return QuestionBankRepository(settings.question_bank_root).student_lab_summaries()
    except GradingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except QuestionBankError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/labs/{lab_id}", response_model=SysadminLabDetail)
def get_sysadmin_lab(
    lab_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_real_active_user(current_user)
    settings = SysadminGradingSettings.from_env()
    _assert_marketplace_access(settings, current_user, db)
    try:
        settings.assert_ready()
        return QuestionBankRepository(settings.question_bank_root).student_view(lab_id).detail()
    except GradingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except QuestionBankError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/submissions", response_model=list[SysadminSubmissionResponse])
def list_submissions(
    lab_id: str | None = Query(default=None, min_length=3, max_length=64),
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_real_active_user(current_user)
    query = db.query(SysadminSubmission).filter(
        SysadminSubmission.student_id == int(current_user.id)
    )
    if lab_id:
        query = query.filter(SysadminSubmission.lab_id == lab_id.strip())
    rows = query.order_by(SysadminSubmission.id.desc()).limit(limit).all()
    service = SysadminGradingService()
    return [service.student_view(row) for row in rows]


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
        # This endpoint remains synchronous for v0.5. FastAPI runs sync route
        # handlers in its worker threadpool, keeping blocking ECS/S3 work off the
        # event loop while preserving the established CLI contract.
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
    if row.status in {"ERROR", "TIMED_OUT"}:
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


@router.post(
    "/workspaces/start",
    response_model=SysadminWorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)
def start_workspace(
    payload: SysadminWorkspaceStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_real_active_user(current_user)
    settings = SysadminGradingSettings.from_env()
    _assert_marketplace_access(settings, current_user, db)
    try:
        service = SysadminWorkspaceService(settings)
        session = service.start(user_id=int(current_user.id), lab_id=payload.lab_id)
        return service.student_view(session)
    except QuestionBankError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GradingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (WorkspaceExecutionError, WorkspaceTokenError) as exc:
        logger.warning("Sysadmin workspace start failed user=%s: %s", current_user.id, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/workspaces/session", response_model=SysadminWorkspaceResponse | None)
def get_workspace_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_real_active_user(current_user)
    settings = SysadminGradingSettings.from_env()
    _assert_marketplace_access(settings, current_user, db)
    try:
        service = SysadminWorkspaceService(settings)
        session = service.current(user_id=int(current_user.id))
        return service.student_view(session) if session else None
    except WorkspaceExecutionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.delete("/workspaces/session", response_model=SysadminWorkspaceStopResponse)
def stop_workspace_session(
    current_user: User = Depends(get_current_user),
):
    _assert_real_active_user(current_user)
    try:
        stopped = SysadminWorkspaceService().stop(user_id=int(current_user.id))
        return SysadminWorkspaceStopResponse(stopped=stopped)
    except WorkspaceExecutionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.websocket("/workspaces/terminal")
async def workspace_terminal(
    websocket: WebSocket,
    lab_id: str = Query(..., min_length=3, max_length=64),
    token: str | None = Query(default=None),
):
    await websocket.accept()
    if not token:
        await websocket.send_text("\r\n[ERROR] Authentication token required.\r\n")
        await websocket.close(code=1008, reason="Token required")
        return

    try:
        from app.core.security import decode_access_token

        payload = decode_access_token(token)
        if not payload:
            raise ValueError("Invalid token payload")
        user_id = int(payload.get("user_id") or payload.get("sub"))
        if user_id <= 0:
            raise ValueError("Workspace requires a persisted user")
    except Exception as exc:
        logger.warning("Sysadmin terminal authentication failed: %s", exc)
        await websocket.send_text("\r\n[ERROR] Invalid or expired CyberRange session.\r\n")
        await websocket.close(code=1008, reason="Invalid token")
        return

    try:
        service = SysadminWorkspaceService()
        session = await asyncio.to_thread(service.current, user_id=user_id)
    except Exception as exc:
        logger.warning("Unable to resolve Sysadmin workspace for user=%s: %s", user_id, exc)
        await websocket.send_text("\r\n[ERROR] Unable to resolve your workspace.\r\n")
        await websocket.close(code=1011, reason="Workspace lookup failed")
        return

    if not session or session.get("lab_id") != lab_id:
        await websocket.send_text(
            "\r\n[ERROR] No active workspace exists for this question. "
            "Click Start Workspace first.\r\n"
        )
        await websocket.close(code=1008, reason="Workspace not running")
        return

    from app.api.v1.endpoints.terminal_api import _bridge_ssh_to_websocket

    await _bridge_ssh_to_websocket(
        websocket=websocket,
        host=str(session["student_host"]),
        port=int(session.get("student_port") or 22),
        username=str(session.get("ssh_username") or "student"),
        password=str(session.get("ssh_password") or ""),
        user_id=str(user_id),
        lab_id="linux-sysadmin-workspace",
    )


@router.post("/workspace-token", response_model=WorkspaceTokenResponse)
def create_workspace_token(
    payload: WorkspaceTokenRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Development bridge for provisioning a terminal-only workspace credential.

    Production workspace provisioning calls the token service internally after
    access validation. User self-minting remains disabled by default.
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
    status_code=status.HTTP_202_ACCEPTED,
)
def workspace_submit_script(
    payload: WorkspaceSubmissionRequest,
    request: Request,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=36, max_length=64),
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
        row = service.accept_submission(
            db,
            student_id=claims.user_id,
            lab_id=claims.lab_id,
            filename=payload.filename,
            content=payload.content,
            idempotency_key=idempotency_key,
        )
    except SubmissionValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IdempotencyConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except GradingConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception(
            "Unexpected workspace submission failure workspace_id=%s user_id=%s lab_id=%s",
            claims.workspace_id,
            claims.user_id,
            claims.lab_id,
        )
        raise HTTPException(status_code=500, detail="Unable to accept submission.") from exc

    # v0.6: return immediately after durable DB acceptance. The separate SQS
    # dispatcher owns ECS orchestration and final PASS/FAIL persistence.
    return service.student_view(row)
