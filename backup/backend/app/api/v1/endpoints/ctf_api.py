"""
CTF API — all endpoints for the CTF competition module.

Endpoints
---------
  POST   /ctf                                    create CTF
  PUT    /ctf/{ctf_id}                           edit CTF
  GET    /ctf                                    list CTFs (admin: all; student: active/public)
  GET    /ctf/{ctf_id}                           get single CTF
  POST   /ctf/{ctf_id}/start                     manually start
  POST   /ctf/{ctf_id}/stop                      manually stop
  POST   /ctf/{ctf_id}/challenge                 create challenge (multipart + file upload)
  PUT    /ctf/{ctf_id}/challenge/{cid}            edit challenge
  DELETE /ctf/{ctf_id}/challenge/{cid}            delete challenge
  PATCH  /ctf/{ctf_id}/challenge/{cid}/visibility toggle hidden
  GET    /ctf/{ctf_id}/challenges                 list challenges for a CTF
  POST   /ctf/{ctf_id}/challenge/{cid}/submission submit flag
  POST   /ctf/{ctf_id}/challenge/{cid}/hint/{hid}/unlock  unlock hint
  GET    /ctf/{ctf_id}/challenge/{cid}/files/{filename}   download attachment
  GET    /ctf/{ctf_id}/leaderboard               leaderboard snapshot
  GET    /ctf/{ctf_id}/submissions               admin audit log
"""

from __future__ import annotations

import json
import logging
import math
import os
import shutil
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.ws.ctf_ws import ctf_ws_manager


from app.api.deps import get_current_admin_user, get_current_user, get_db
from app.models.ctf import (
    CTF,
    CTFChallenge,
    CTFChallengeFile,
    CTFHint,
    CTFHintUnlock,
    CTFParticipation,
    CTFSubmission,
)
from app.models.user import User
from app.schemas.ctf import (
    CTFCreate,
    CTFOut,
    CTFUpdate,
    ChallengeCreate,
    ChallengeOut,
    ChallengeUpdate,
    FlagSubmitRequest,
    FlagSubmitResponse,
    HintCreate,
    HintUnlockResponse,
    LeaderboardEntry,
    LeaderboardResponse,
    SubmissionLogResponse,
    SubmissionLogEntry,
)
from app.services.ctf_flag import generate_salt, hash_flag, verify_flag
from app.services.ctf_scoring import (
    get_hint_penalty_pct,
    score_correct_submission,
    recalculate_dynamic_scores,
    recompute_participation_total,
    compute_dynamic_value,
    apply_hint_penalty,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# File storage config
# ---------------------------------------------------------------------------
_UPLOAD_ROOT = Path(
    os.environ.get("CTF_UPLOAD_DIR", "/home/cyberrange/Desktop/sysadmin/Cyber_Range_Lab-/backup/backend/uploads/ctf")
)
_MAX_FILE_BYTES = 50 * 1024 * 1024        # 50 MB per file
_MAX_CHALLENGE_BYTES = 200 * 1024 * 1024  # 200 MB per challenge total

# ---------------------------------------------------------------------------
# Rate limiting (in-memory; replace with Redis in production)
# ---------------------------------------------------------------------------
_submission_rate: dict[str, list[datetime]] = defaultdict(list)
_RATE_WINDOW = timedelta(minutes=1)
_RATE_LIMIT = 5  # max 5 submissions per participant per CTF per minute


def _check_rate_limit(participant_id: int, ctf_id: int) -> None:
    key = f"{participant_id}:{ctf_id}"
    now = datetime.utcnow()
    window_start = now - _RATE_WINDOW
    _submission_rate[key] = [t for t in _submission_rate[key] if t > window_start]
    if len(_submission_rate[key]) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Flag submission rate limit exceeded. Maximum 5 submissions per minute.",
        )
    _submission_rate[key].append(now)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_ctf_or_404(db: Session, ctf_id: int) -> CTF:
    ctf = db.query(CTF).filter(CTF.id == ctf_id).first()
    if not ctf:
        raise HTTPException(status_code=404, detail="CTF not found")
    return ctf


def _get_challenge_or_404(db: Session, ctf_id: int, challenge_id: int) -> CTFChallenge:
    ch = (
        db.query(CTFChallenge)
        .filter(CTFChallenge.ctf_id == ctf_id, CTFChallenge.id == challenge_id)
        .first()
    )
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return ch


def _enroll_students(db: Session, ctf: CTF) -> None:
    """Auto-enroll all active students into a CTF when it starts."""
    students = db.query(User).filter(
        User.is_active == True,
        User.role.in_(["student", "user"]),
    ).all()
    for student in students:
        existing = (
            db.query(CTFParticipation)
            .filter(
                CTFParticipation.ctf_id == ctf.id,
                CTFParticipation.participant_id == student.id,
            )
            .first()
        )
        if not existing:
            db.add(
                CTFParticipation(
                    ctf_id=ctf.id,
                    participant_id=student.id,
                    joined_at=datetime.utcnow(),
                )
            )
    db.commit()


def _current_challenge_points(challenge: CTFChallenge) -> Optional[int]:
    """Compute the current displayed point value of a challenge."""
    if challenge.scoring_mode == "static":
        return challenge.static_points
    # Dynamic: value for the next solver (n = solve_count + 1 would be next,
    # but for display we show the current state based on solve_count)
    n = max(1, challenge.solve_count)
    return compute_dynamic_value(
        challenge.dynamic_ceiling,
        challenge.dynamic_floor,
        challenge.decay_constant,
        n,
    )


def _challenge_to_out(ch: CTFChallenge, include_hints_text: bool = False) -> dict:
    out = ChallengeOut.model_validate(ch).model_dump()
    out["current_points"] = _current_challenge_points(ch)
    # Hints: only include text when explicitly requested (admin view)
    if not include_hints_text:
        for h in out.get("hints", []):
            h.pop("text", None)
    return out


def _get_leaderboard_data(db: Session, ctf_id: int) -> dict:
    """Helper to build leaderboard JSON payload for API and WebSocket broadcasts."""
    ctf = db.query(CTF).filter(CTF.id == ctf_id).first()
    if not ctf:
        return {}

    participations = (
        db.query(CTFParticipation)
        .filter(CTFParticipation.ctf_id == ctf_id)
        .order_by(
            CTFParticipation.total_points.desc(),
            CTFParticipation.last_submission_at.asc(),
        )
        .all()
    )

    # Build first-blood map: {participant_id: [challenge_ids]}
    first_blood_subs = (
        db.query(CTFSubmission)
        .join(CTFChallenge, CTFSubmission.challenge_id == CTFChallenge.id)
        .filter(
            CTFChallenge.ctf_id == ctf_id,
            CTFSubmission.is_first_blood == True,
        )
        .all()
    )
    first_blood_map = defaultdict(list)
    for sub in first_blood_subs:
        first_blood_map[sub.participant_id].append(sub.challenge_id)

    # Fetch user names
    participant_ids = [p.participant_id for p in participations]
    users = db.query(User).filter(User.id.in_(participant_ids)).all()
    user_map = {u.id: (u.name or u.email) for u in users}

    entries = [
        {
            "rank": rank + 1,
            "participant_id": p.participant_id,
            "participant_name": user_map.get(p.participant_id, "Unknown"),
            "total_points": p.total_points,
            "solve_count": p.solve_count,
            "last_submission_at": p.last_submission_at.isoformat() if p.last_submission_at else None,
            "first_blood_challenges": first_blood_map.get(p.participant_id, []),
        }
        for rank, p in enumerate(participations)
    ]

    return {
        "ctf_id": ctf_id,
        "is_frozen": ctf.is_frozen,
        "entries": entries
    }


def _broadcast_leaderboard_sync(db: Session, ctf_id: int):
    """Synchronous wrapper to broadcast leaderboard update via running event loop."""
    import asyncio
    data = _get_leaderboard_data(db, ctf_id)
    payload = {
        "type": "score_update",
        "leaderboard": data
    }
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(ctf_ws_manager.broadcast(ctf_id, payload))
    except Exception as exc:
        logger.error(f"Failed to broadcast leaderboard: {exc}")


def _broadcast_ctf_event(ctf_id: int, payload: dict):
    """Synchronous wrapper to broadcast generic CTF event via running event loop."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(ctf_ws_manager.broadcast(ctf_id, payload))
    except Exception as exc:
        logger.error(f"Failed to broadcast ctf event: {exc}")


# ---------------------------------------------------------------------------

# CTF CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=List[CTFOut])
@router.get("/", response_model=List[CTFOut])
def list_ctfs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List CTFs. Admins see all; students see active/public only."""
    role = (current_user.role or "").upper()
    is_admin = role in ("ADMIN", "SYSTEM_ADMIN", "PROFESSOR", "SUPER_ADMIN")
    q = db.query(CTF)
    if not is_admin:
        q = q.filter(CTF.status == "active", CTF.is_public == True)
    return q.order_by(CTF.start_time.desc()).all()


@router.post("", response_model=CTFOut, status_code=status.HTTP_201_CREATED)
def create_ctf(
    payload: CTFCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Create a new CTF event."""
    ctf = CTF(
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_public=payload.is_public,
        status="scheduled",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ctf)
    db.commit()
    db.refresh(ctf)
    return ctf


@router.get("/{ctf_id}", response_model=CTFOut)
def get_ctf(
    ctf_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_ctf_or_404(db, ctf_id)


@router.put("/{ctf_id}", response_model=CTFOut)
def update_ctf(
    ctf_id: int,
    payload: CTFUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Edit CTF metadata / schedule."""
    ctf = _get_ctf_or_404(db, ctf_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ctf, field, value)
    ctf.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ctf)
    return ctf


@router.delete("/{ctf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ctf(
    ctf_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Delete a CTF event."""
    ctf = _get_ctf_or_404(db, ctf_id)
    db.delete(ctf)
    db.commit()
    return None


@router.post("/{ctf_id}/start", response_model=CTFOut)
def start_ctf(
    ctf_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Manually start a CTF and auto-enroll students."""
    ctf = _get_ctf_or_404(db, ctf_id)
    ctf.status = "active"
    ctf.updated_at = datetime.utcnow()
    db.commit()
    _enroll_students(db, ctf)
    db.refresh(ctf)
    logger.info("CTF %d manually started by admin %d", ctf_id, admin.id)
    _broadcast_ctf_event(ctf_id, {"type": "ctf_started"})
    return ctf


@router.post("/{ctf_id}/stop", response_model=CTFOut)
def stop_ctf(
    ctf_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Manually stop/conclude a CTF and disable all challenge URLs."""
    ctf = _get_ctf_or_404(db, ctf_id)
    ctf.status = "completed"
    ctf.updated_at = datetime.utcnow()
    # Disable all challenge URLs
    db.query(CTFChallenge).filter(CTFChallenge.ctf_id == ctf_id).update(
        {"url_active": False}, synchronize_session=False
    )
    db.commit()
    db.refresh(ctf)
    logger.info("CTF %d manually stopped by admin %d", ctf_id, admin.id)
    _broadcast_ctf_event(ctf_id, {"type": "ctf_ended"})
    return ctf



# ---------------------------------------------------------------------------
# Challenge management
# ---------------------------------------------------------------------------

@router.get("/{ctf_id}/challenges", response_model=List[dict])
def list_challenges(
    ctf_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List challenges for a CTF.
    Admins see all (including hidden). Students see only visible challenges.
    """
    _get_ctf_or_404(db, ctf_id)
    role = (current_user.role or "").upper()
    is_admin = role in ("ADMIN", "SYSTEM_ADMIN", "PROFESSOR", "SUPER_ADMIN")
    q = db.query(CTFChallenge).filter(CTFChallenge.ctf_id == ctf_id)
    if not is_admin:
        q = q.filter(CTFChallenge.is_hidden == False, CTFChallenge.url_active == True)
    challenges = q.order_by(CTFChallenge.category, CTFChallenge.title).all()
    return [_challenge_to_out(ch, include_hints_text=is_admin) for ch in challenges]


@router.post(
    "/{ctf_id}/challenge",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_challenge(
    ctf_id: int,
    # JSON fields passed as form data alongside files
    title: str = Form(...),
    flag: str = Form(...),
    scoring_mode: str = Form(default="static"),
    description: Optional[str] = Form(default=None),
    category: Optional[str] = Form(default=None),
    connection_string: Optional[str] = Form(default=None),
    challenge_url: Optional[str] = Form(default=None),
    static_points: Optional[int] = Form(default=None),
    dynamic_ceiling: Optional[int] = Form(default=None),
    dynamic_floor: Optional[int] = Form(default=None),
    decay_constant: Optional[float] = Form(default=None),
    hints_json: Optional[str] = Form(default=None),  # JSON list of HintCreate
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """
    Create a challenge with optional file attachments.
    Enforces 50 MB per file and 200 MB total per challenge.
    """
    _get_ctf_or_404(db, ctf_id)

    # Validate scoring fields
    ch_create = ChallengeCreate(
        title=title,
        flag=flag,
        scoring_mode=scoring_mode,
        description=description,
        category=category,
        connection_string=connection_string,
        challenge_url=challenge_url,
        static_points=static_points,
        dynamic_ceiling=dynamic_ceiling,
        dynamic_floor=dynamic_floor,
        decay_constant=decay_constant,
        hints=[],
    )

    # Validate files
    total_size = 0
    for f in files:
        content = await f.read()
        if len(content) > _MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File '{f.filename}' exceeds the 50 MB per-file limit.",
            )
        total_size += len(content)
        if total_size > _MAX_CHALLENGE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Total file size for this challenge exceeds the 200 MB limit.",
            )
        await f.seek(0)

    # Hash the flag
    salt = generate_salt()
    flag_hash = hash_flag(flag, salt)

    challenge = CTFChallenge(
        ctf_id=ctf_id,
        title=ch_create.title,
        description=ch_create.description,
        category=ch_create.category,
        connection_string=ch_create.connection_string,
        challenge_url=ch_create.challenge_url,
        scoring_mode=ch_create.scoring_mode,
        static_points=ch_create.static_points,
        dynamic_ceiling=ch_create.dynamic_ceiling,
        dynamic_floor=ch_create.dynamic_floor,
        decay_constant=ch_create.decay_constant,
        flag_hash=flag_hash,
        flag_salt=salt,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(challenge)
    db.flush()  # get challenge.id before saving files

    # Save files
    challenge_dir = _UPLOAD_ROOT / str(challenge.id)
    challenge_dir.mkdir(parents=True, exist_ok=True)
    for f in files:
        content = await f.read()
        safe_name = Path(f.filename).name
        dest = challenge_dir / safe_name
        dest.write_bytes(content)
        db.add(
            CTFChallengeFile(
                challenge_id=challenge.id,
                filename=safe_name,
                storage_path=str(dest),
                mime_type=f.content_type,
                file_size_bytes=len(content),
                uploaded_at=datetime.utcnow(),
            )
        )

    # Save hints
    if hints_json:
        try:
            hints_data = json.loads(hints_json)
            for h in hints_data:
                hint = HintCreate(**h)
                db.add(
                    CTFHint(
                        challenge_id=challenge.id,
                        order_index=hint.order_index,
                        text=hint.text,
                        cost_percent=hint.cost_percent,
                    )
                )
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Invalid hints_json: {exc}")

    db.commit()
    db.refresh(challenge)
    return _challenge_to_out(challenge, include_hints_text=True)


@router.put("/{ctf_id}/challenge/{challenge_id}", response_model=dict)
async def update_challenge(
    ctf_id: int,
    challenge_id: int,
    title: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    category: Optional[str] = Form(default=None),
    connection_string: Optional[str] = Form(default=None),
    challenge_url: Optional[str] = Form(default=None),
    flag: Optional[str] = Form(default=None),
    scoring_mode: Optional[str] = Form(default=None),
    static_points: Optional[int] = Form(default=None),
    dynamic_ceiling: Optional[int] = Form(default=None),
    dynamic_floor: Optional[int] = Form(default=None),
    decay_constant: Optional[float] = Form(default=None),
    hints_json: Optional[str] = Form(default=None),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Edit an existing challenge. Replaces hints and appends new files if provided."""
    ch = _get_challenge_or_404(db, ctf_id, challenge_id)

    if title is not None:
        ch.title = title
    if description is not None:
        ch.description = description
    if category is not None:
        ch.category = category
    if connection_string is not None:
        ch.connection_string = connection_string
    if challenge_url is not None:
        ch.challenge_url = challenge_url
    if scoring_mode is not None:
        ch.scoring_mode = scoring_mode
    if static_points is not None:
        ch.static_points = static_points
    if dynamic_ceiling is not None:
        ch.dynamic_ceiling = dynamic_ceiling
    if dynamic_floor is not None:
        ch.dynamic_floor = dynamic_floor
    if decay_constant is not None:
        ch.decay_constant = decay_constant

    # Re-hash flag if changed
    if flag is not None:
        salt = generate_salt()
        ch.flag_hash = hash_flag(flag, salt)
        ch.flag_salt = salt

    # Replace hints if provided
    if hints_json is not None:
        db.query(CTFHint).filter(CTFHint.challenge_id == challenge_id).delete()
        try:
            hints_data = json.loads(hints_json)
            for h in hints_data:
                hint = HintCreate(**h)
                db.add(
                    CTFHint(
                        challenge_id=challenge_id,
                        order_index=hint.order_index,
                        text=hint.text,
                        cost_percent=hint.cost_percent,
                    )
                )
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Invalid hints_json: {exc}")

    # Append new files (validate sizes)
    if files:
        existing_size = sum(
            f.file_size_bytes
            for f in db.query(CTFChallengeFile)
            .filter(CTFChallengeFile.challenge_id == challenge_id)
            .all()
        )
        for f in files:
            content = await f.read()
            if len(content) > _MAX_FILE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File '{f.filename}' exceeds 50 MB limit.",
                )
            existing_size += len(content)
            if existing_size > _MAX_CHALLENGE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Total files for this challenge would exceed 200 MB limit.",
                )
            challenge_dir = _UPLOAD_ROOT / str(challenge_id)
            challenge_dir.mkdir(parents=True, exist_ok=True)
            safe_name = Path(f.filename).name
            dest = challenge_dir / safe_name
            dest.write_bytes(content)
            db.add(
                CTFChallengeFile(
                    challenge_id=challenge_id,
                    filename=safe_name,
                    storage_path=str(dest),
                    mime_type=f.content_type,
                    file_size_bytes=len(content),
                    uploaded_at=datetime.utcnow(),
                )
            )

    ch.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ch)
    return _challenge_to_out(ch, include_hints_text=True)


@router.delete("/{ctf_id}/challenge/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_challenge(
    ctf_id: int,
    challenge_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Delete a challenge and all its files from disk."""
    ch = _get_challenge_or_404(db, ctf_id, challenge_id)
    # Remove files from disk
    challenge_dir = _UPLOAD_ROOT / str(challenge_id)
    if challenge_dir.exists():
        shutil.rmtree(challenge_dir)
    db.delete(ch)
    db.commit()


@router.patch("/{ctf_id}/challenge/{challenge_id}/visibility", response_model=dict)
def toggle_visibility(
    ctf_id: int,
    challenge_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Toggle is_hidden for a challenge."""
    ch = _get_challenge_or_404(db, ctf_id, challenge_id)
    ch.is_hidden = not ch.is_hidden
    ch.updated_at = datetime.utcnow()
    db.commit()
    return {"id": ch.id, "is_hidden": ch.is_hidden}


# ---------------------------------------------------------------------------
# Flag submission
# ---------------------------------------------------------------------------

@router.post("/{ctf_id}/challenge/{challenge_id}/submission", response_model=FlagSubmitResponse)
def submit_flag(
    ctf_id: int,
    challenge_id: int,
    payload: FlagSubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a flag for a challenge.
    - Rate limited to 5 submissions per minute per participant per CTF.
    - Correct first-blood submissions lock points at ceiling for dynamic challenges.
    - Subsequent correct solves on dynamic challenges trigger background recalculation.
    """
    _check_rate_limit(current_user.id, ctf_id)

    ctf = _get_ctf_or_404(db, ctf_id)
    if ctf.status != "active":
        raise HTTPException(status_code=400, detail="This CTF is not currently active.")

    ch = _get_challenge_or_404(db, ctf_id, challenge_id)
    if ch.is_hidden or not ch.url_active:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Check if already solved correctly
    already_solved = (
        db.query(CTFSubmission)
        .filter(
            CTFSubmission.challenge_id == challenge_id,
            CTFSubmission.participant_id == current_user.id,
            CTFSubmission.is_correct == True,
        )
        .first()
    )
    if already_solved:
        return FlagSubmitResponse(
            correct=True,
            message="You have already solved this challenge.",
            points_credited=already_solved.points_credited,
            is_first_blood=already_solved.is_first_blood,
        )

    # Verify flag
    is_correct = verify_flag(payload.flag, ch.flag_salt, ch.flag_hash)

    # Hash the submitted flag for the audit log (never store plain-text)
    from app.services.ctf_flag import hash_flag as _hash
    submitted_hash = _hash(payload.flag, ch.flag_salt)

    points_credited = 0
    is_first_blood = False

    if is_correct:
        points_credited, is_first_blood = score_correct_submission(db, ch, current_user.id)

        # Increment solve count
        ch.solve_count += 1
        ch.updated_at = datetime.utcnow()

        # Record hint penalty used
        hint_pct = get_hint_penalty_pct(db, current_user.id, challenge_id)

    submission = CTFSubmission(
        challenge_id=challenge_id,
        participant_id=current_user.id,
        submitted_flag_hash=submitted_hash,
        is_correct=is_correct,
        is_first_blood=is_first_blood,
        submitted_at=datetime.utcnow(),
        points_credited=points_credited,
        hint_penalty_percent=hint_pct if is_correct else 0.0,
    )
    db.add(submission)

    if is_correct:
        # Update or create participation record
        participation = (
            db.query(CTFParticipation)
            .filter(
                CTFParticipation.ctf_id == ctf_id,
                CTFParticipation.participant_id == current_user.id,
            )
            .first()
        )
        if not participation:
            participation = CTFParticipation(
                ctf_id=ctf_id,
                participant_id=current_user.id,
                joined_at=datetime.utcnow(),
            )
            db.add(participation)
            db.flush()

        participation.solve_count += 1
        participation.last_submission_at = datetime.utcnow()
        db.flush()

        # Recompute total (handles deduplication correctly)
        recompute_participation_total(db, current_user.id, ctf_id)

    db.commit()

    if is_correct:
        _broadcast_leaderboard_sync(db, ctf_id)

    # For dynamic non-first-blood solves: retroactively update all other solvers in background
    if is_correct and not is_first_blood and ch.scoring_mode == "dynamic":
        background_tasks.add_task(_bg_recalculate, challenge_id)

    msg = "🩸 First blood! Correct flag!" if is_first_blood else (
        "✅ Correct flag!" if is_correct else "❌ Incorrect flag. Try again."
    )
    return FlagSubmitResponse(
        correct=is_correct,
        message=msg,
        points_credited=points_credited,
        is_first_blood=is_first_blood,
    )


def _bg_recalculate(challenge_id: int) -> None:
    """Background task wrapper — gets its own DB session."""
    from app.jobs.ctf_jobs import recalculate_dynamic_scores_task
    recalculate_dynamic_scores_task(challenge_id)



# ---------------------------------------------------------------------------
# Hint unlock
# ---------------------------------------------------------------------------

@router.post(
    "/{ctf_id}/challenge/{challenge_id}/hint/{hint_id}/unlock",
    response_model=HintUnlockResponse,
)
def unlock_hint(
    ctf_id: int,
    challenge_id: int,
    hint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Unlock a hint for the requesting participant.
    Irreversible. Cost is applied to future correct submissions on this challenge.
    """
    ctf = _get_ctf_or_404(db, ctf_id)
    if ctf.status != "active":
        raise HTTPException(status_code=400, detail="CTF is not active.")

    ch = _get_challenge_or_404(db, ctf_id, challenge_id)

    hint = db.query(CTFHint).filter(CTFHint.id == hint_id, CTFHint.challenge_id == challenge_id).first()
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")

    # Check already unlocked
    already = (
        db.query(CTFHintUnlock)
        .filter(
            CTFHintUnlock.hint_id == hint_id,
            CTFHintUnlock.participant_id == current_user.id,
        )
        .first()
    )
    if already:
        raise HTTPException(status_code=400, detail="Hint already unlocked.")

    db.add(
        CTFHintUnlock(
            hint_id=hint_id,
            participant_id=current_user.id,
            unlocked_at=datetime.utcnow(),
        )
    )
    db.commit()

    # Compute points after this unlock (for display only)
    current_pts = _current_challenge_points(ch) or 0
    total_penalty = get_hint_penalty_pct(db, current_user.id, challenge_id)
    points_after = max(1, math.floor(current_pts * (1.0 - total_penalty / 100.0)))

    return HintUnlockResponse(
        hint_id=hint_id,
        text=hint.text,
        cost_percent=hint.cost_percent,
        points_after_penalty=points_after,
    )


# ---------------------------------------------------------------------------
# File download
# ---------------------------------------------------------------------------

@router.get("/{ctf_id}/challenge/{challenge_id}/files/{filename}")
def download_file(
    ctf_id: int,
    challenge_id: int,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a challenge attachment."""
    _get_challenge_or_404(db, ctf_id, challenge_id)

    file_record = (
        db.query(CTFChallengeFile)
        .filter(
            CTFChallengeFile.challenge_id == challenge_id,
            CTFChallengeFile.filename == filename,
        )
        .first()
    )
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    path = Path(file_record.storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(path),
        filename=filename,
        media_type=file_record.mime_type or "application/octet-stream",
    )


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

@router.get("/{ctf_id}/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    ctf_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the current leaderboard for a CTF.
    If the CTF is frozen, shows the snapshot at freeze time (same data,
    UI should indicate frozen state).
    """
    _get_ctf_or_404(db, ctf_id)
    data = _get_leaderboard_data(db, ctf_id)
    return data



# ---------------------------------------------------------------------------
# Admin: submission audit log
# ---------------------------------------------------------------------------

@router.get("/{ctf_id}/submissions", response_model=SubmissionLogResponse)
def get_submission_log(
    ctf_id: int,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """
    Admin-only paginated audit log of all flag submissions for a CTF.
    """
    _get_ctf_or_404(db, ctf_id)

    base_q = (
        db.query(CTFSubmission)
        .join(CTFChallenge, CTFSubmission.challenge_id == CTFChallenge.id)
        .filter(CTFChallenge.ctf_id == ctf_id)
        .order_by(CTFSubmission.submitted_at.desc())
    )

    total = base_q.count()
    subs = base_q.offset((page - 1) * limit).limit(limit).all()

    # Bulk-fetch challenge and user names
    chal_ids = list({s.challenge_id for s in subs})
    chals = db.query(CTFChallenge).filter(CTFChallenge.id.in_(chal_ids)).all()
    chal_map = {c.id: c.title for c in chals}

    user_ids = list({s.participant_id for s in subs})
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: (u.name or u.email) for u in users}

    entries = [
        SubmissionLogEntry(
            id=s.id,
            challenge_id=s.challenge_id,
            challenge_title=chal_map.get(s.challenge_id, "Unknown"),
            participant_id=s.participant_id,
            participant_name=user_map.get(s.participant_id, "Unknown"),
            is_correct=s.is_correct,
            is_first_blood=s.is_first_blood,
            submitted_at=s.submitted_at,
            points_credited=s.points_credited,
            hint_penalty_percent=s.hint_penalty_percent,
        )
        for s in subs
    ]

    return SubmissionLogResponse(total=total, page=page, limit=limit, entries=entries)


# ---------------------------------------------------------------------------
# WebSocket live updates
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def ctf_websocket_endpoint(
    websocket: WebSocket,
    ctf_id: int = Query(...),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for CTF real-time updates (leaderboard / score notifications).
    GET /api/v1/ctf/ws?ctf_id=X&token=Y
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token required")
        return
    try:
        from app.core.security import decode_access_token
        payload = decode_access_token(token)
        user_id = payload.get("user_id") or payload.get("sub")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token verification failed")
        return

    # Verify CTF exists
    ctf = db.query(CTF).filter(CTF.id == ctf_id).first()
    if not ctf:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="CTF not found")
        return

    await ctf_ws_manager.connect(ctf_id, websocket)
    try:
        while True:
            # Listen for ping / keepalive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ctf_ws_manager.disconnect(ctf_id, websocket)
    except Exception:
        ctf_ws_manager.disconnect(ctf_id, websocket)

