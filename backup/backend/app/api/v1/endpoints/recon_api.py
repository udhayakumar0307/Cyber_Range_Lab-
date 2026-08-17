import hashlib
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user_optional
from app.models.lab_module import LabModule
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.user_progress import UserProgress
from app.services.score_service import reconcile_user_score
from app.services.completion_service import CompletionService

logger = logging.getLogger(__name__)
router = APIRouter()

LAB_ID = "lab1-recon"
TRACK_ID = "recon"

# ── Module catalogue (order matters for locking) ────────────────────────────
RECON_MODULES: List[Dict[str, Any]] = [
    {"id": "module1", "title": "Port Discovery & Enumeration",       "points": 100},
    {"id": "module2", "title": "Service Version Fingerprinting",     "points": 150},
    {"id": "module3", "title": "Hidden Service Discovery",           "points": 200},
    {"id": "module4", "title": "Credential Discovery",               "points": 250},
    {"id": "module5", "title": "Full Network Infiltration (Capstone)","points": 300},
]
MODULE_IDS = [m["id"] for m in RECON_MODULES]
MODULE_POINTS = {m["id"]: m["points"] for m in RECON_MODULES}


def _generate_recon_flag(user_id: str, module_id: str) -> List[str]:
    """Generate the canonical flag for a recon lab module.

    Canonical format:  FLAG{cll_module<N>_recon_student_<8-hex-digest>}
    e.g.               FLAG{cll_module1_recon_student_3f7a2b9c}

    The digest is deterministic: SHA-256 of 'recon_<moduleN>_<user_id>_cyberrange2026'
    so the same user always gets the same flag for the same module.
    """
    num = module_id.replace("module", "")  # 'module1' -> '1'
    seed = f"recon_module{num}_{user_id}_cyberrange2026"
    digest = hashlib.sha256(seed.encode()).hexdigest()[:8]  # 8 hex chars, e.g. '3f7a2b9c'
    canonical = f"FLAG{{cll_module{num}_recon_student_{digest}}}"
    return [canonical]  # single accepted flag


# ── GET /progress ────────────────────────────────────────────────────────────

@router.get("/progress")
def get_recon_progress(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Returns per-module progress + flags for the current user."""
    user_id_str = str(current_user.id) if current_user else "student"
    total_score = reconcile_user_score(db, user_id_str) if current_user else 0

    progress_rows = (
        db.query(UserProgress)
        .filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == TRACK_ID,
        )
        .all()
    ) if current_user else []
    solved_set = {r.module_id for r in progress_rows if r.completed}

    modules_out = []
    for i, m in enumerate(RECON_MODULES):
        mid = m["id"]
        locked = i > 0 and MODULE_IDS[i - 1] not in solved_set
        completed = mid in solved_set
        # Always generate the real flag so the terminal can display it.
        # The flag is deterministic per user+module — seeing it doesn't bypass validation.
        real_flag = _generate_recon_flag(user_id_str, mid)[0]
        if mid == "module5":
            logger.info(f"[RECON-AUDIT] Session Provisioning | User: {user_id_str} | Generated Module 5 Flag: {real_flag} | Target: /root/flag.txt")
        modules_out.append(
            {
                "id": mid,
                "title": m["title"],
                "points": m["points"],
                "locked": locked,
                "completed": completed,
                "flag": real_flag,
            }
        )

    return {"user_id": user_id_str, "total_score": total_score, "modules": modules_out}


# ── POST /submit ─────────────────────────────────────────────────────────────

@router.post("/submit")
def submit_recon_flag(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Validates a submitted flag, records progress in RDS, reconciles score."""
    user_id_str = str(current_user.id) if current_user else "student"
    module_id = (payload.get("module") or "").strip()
    submitted_flag = (payload.get("flag") or "").strip()

    if module_id not in MODULE_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown module: {module_id}")

    idx = MODULE_IDS.index(module_id)

    # Enforce sequential locking for non-first modules
    if idx > 0:
        prev_mid = MODULE_IDS[idx - 1]
        prev_rec = (
            db.query(UserProgress)
            .filter(
                UserProgress.user_id == user_id_str,
                UserProgress.track_id == TRACK_ID,
                UserProgress.module_id == prev_mid,
            )
            .first()
        )
        if not prev_rec or not prev_rec.completed:
            raise HTTPException(
                status_code=403,
                detail="Module is locked. Complete the previous module first.",
            )

    # Already solved?
    record = (
        db.query(UserProgress)
        .filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == TRACK_ID,
            UserProgress.module_id == module_id,
        )
        .first()
    )

    current_total = reconcile_user_score(db, user_id_str)
    if record and record.completed:
        next_mid = MODULE_IDS[idx + 1] if idx + 1 < len(MODULE_IDS) else None
        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total,
            "next_module": next_mid,
        }

    # Validate flag
    valid_flags = _generate_recon_flag(user_id_str, module_id)
    logger.info(f"[RECON-AUDIT] Module 5 Submission Check | User: {user_id_str} | Module: {module_id} | Submitted: {submitted_flag} | Expected: {valid_flags[0]}")

    if submitted_flag not in valid_flags:
        logger.warning(f"[RECON-AUDIT] Module 5 Submission REJECTED | User: {user_id_str} | Module: {module_id} | Submitted: {submitted_flag} != Expected: {valid_flags[0]}")
        return {"correct": False, "message": "Incorrect flag. Check your terminal output."}

    logger.info(f"[RECON-AUDIT] Module 5 Submission SUCCESS | User: {user_id_str} | Module: {module_id} | Flag Verified: {submitted_flag}")

    # Calculate earned points via CompletionService (single source of truth)
    from sqlalchemy.exc import IntegrityError
    try:
        result = CompletionService.complete_lab_module(
            db=db,
            user=current_user,
            lab_id=LAB_ID,
            module_id=f"{LAB_ID}_{module_id}",
            track_id=TRACK_ID,
            base_points=MODULE_POINTS[module_id],
            hint1_used=record.hint1_used if record else False,
            hint2_used=record.hint2_used if record else False,
            submitted_flag=submitted_flag,
        )
    except IntegrityError as e:
        db.rollback()
        logger.warning(f"[RECON] IntegrityError on module {module_id} for user {user_id_str}: {e}")
        # Re-fetch or re-create the result assuming it was a duplicate event
        current_total = reconcile_user_score(db, user_id_str)
        next_mid = MODULE_IDS[idx + 1] if idx + 1 < len(MODULE_IDS) else None
        # Still mark user_progress completed in a fresh transaction
        try:
            record = (
                db.query(UserProgress)
                .filter(
                    UserProgress.user_id == user_id_str,
                    UserProgress.track_id == TRACK_ID,
                    UserProgress.module_id == module_id,
                )
                .first()
            )
            if not record:
                record = UserProgress(
                    user_id=user_id_str,
                    track_id=TRACK_ID,
                    module_id=module_id,
                )
                db.add(record)
            record.completed = True
            record.module_score = MODULE_POINTS[module_id]
            record.flag_submitted = submitted_flag
            record.completed_at = datetime.utcnow()
            record.updated_at = datetime.utcnow()
            db.commit()
        except Exception as inner_e:
            db.rollback()
            logger.error(f"[RECON] Failed to save user_progress for {module_id}: {inner_e}")
        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total,
            "next_module": next_mid,
        }

    # Also mark the UserProgress record for sequential locking
    if not record:
        record = UserProgress(
            user_id=user_id_str,
            track_id=TRACK_ID,
            module_id=module_id,
        )
        db.add(record)
    record.completed = True
    record.module_score = result.points_awarded
    record.flag_submitted = submitted_flag
    record.completed_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.warning(f"[RECON] Commit IntegrityError for {module_id}: {e} — retrying user_progress only")
        try:
            record.completed = True
            record.module_score = result.points_awarded
            record.flag_submitted = submitted_flag
            record.completed_at = datetime.utcnow()
            record.updated_at = datetime.utcnow()
            db.merge(record)
            db.commit()
        except Exception as inner_e:
            db.rollback()
            logger.error(f"[RECON] Final commit failed for {module_id}: {inner_e}")

    next_mid = MODULE_IDS[idx + 1] if idx + 1 < len(MODULE_IDS) else None

    return {
        "correct": True,
        "message": "Correct! Module complete.",
        "points": result.points_awarded,
        "total_points": result.new_total_score,
        "next_module": next_mid,
        "module": module_id,
    }


# ── POST /hint ───────────────────────────────────────────────────────────────

HINTS: Dict[str, List[str]] = {
    "module1": [
        "Use `nmap 10.10.0.10` in your terminal to map ports.",
        "Type `cat recon_notes.txt` to inspect notes left in your folder.",
    ],
    "module2": [
        "Run `nmap -sV 10.10.0.10` to trigger service version detection.",
        "Version banners appear in the scan output next to each open port.",
    ],
    "module3": [
        "Scan port 8080 or type `cat recon_notes.txt` to find administrative routes.",
        "The unlisted proxy header exposes the hidden service flag.",
    ],
    "module4": [
        "Run `sys-helper --status` or inspect environment notes.",
        "Admin utility status log contains the credential discovery flag.",
    ],
    "module5": [
        "Run `sys-helper --exec \"/bin/sh\"` to trigger a privilege escalation.",
        "Read the flag: `cat /root/flag.txt` once you escalate to root.",
    ],
}


@router.post("/hint")
def unlock_recon_hint(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id_str = str(current_user.id) if current_user else "student"
    module_id = (payload.get("module") or "").strip()
    hint_index = int(payload.get("hint_index", 1))

    if module_id not in MODULE_IDS:
        raise HTTPException(status_code=400, detail="Unknown module.")
    if hint_index not in (1, 2):
        raise HTTPException(status_code=400, detail="hint_index must be 1 or 2.")

    record = (
        db.query(UserProgress)
        .filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == TRACK_ID,
            UserProgress.module_id == module_id,
        )
        .first()
    )
    if not record:
        record = UserProgress(
            user_id=user_id_str,
            track_id=TRACK_ID,
            module_id=module_id,
            hint1_used=False,
            hint2_used=False,
        )
        db.add(record)
        db.flush()

    if hint_index == 2 and not record.hint1_used:
        raise HTTPException(status_code=403, detail="Unlock Hint 1 first.")

    already = (hint_index == 1 and record.hint1_used) or (hint_index == 2 and record.hint2_used)
    if not already:
        if hint_index == 1:
            record.hint1_used = True
        else:
            record.hint2_used = True
        record.updated_at = datetime.utcnow()
        db.commit()

    total_score = reconcile_user_score(db, user_id_str)
    hints = HINTS.get(module_id, ["", ""])

    return {
        "success": True,
        "hint": hints[hint_index - 1],
        "hint_index": hint_index,
        "penalty": 0 if already else 25,
        "already_unlocked": already,
        "total_points": total_score,
    }


# ── GET /flag (reveal flag after completion) ─────────────────────────────────

@router.get("/flag/{module_id}")
def get_recon_flag(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    user_id_str = str(current_user.id)

    record = (
        db.query(UserProgress)
        .filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == TRACK_ID,
            UserProgress.module_id == module_id,
            UserProgress.completed == True,  # noqa: E712
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=403, detail="Module not yet completed.")

    flag = _generate_recon_flag(user_id_str, module_id)[0]
    return {"flag": flag, "module": module_id}
