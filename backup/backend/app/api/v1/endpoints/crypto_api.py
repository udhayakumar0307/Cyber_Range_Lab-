import os
import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.user import User
from app.models.user_progress import UserProgress
from app.models.user_lab_progress import UserLabProgress
from app.models.lab import Lab
from app.services.assignment_context_service import resolve_assignment

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

ROOT_DIR = Path(settings.root_dir)
LABS_DIR = Path(settings.LABS_DIRECTORY)

CONFIG_PATH = LABS_DIR / "cryptography-lab" / "scoring-server" / "module_config.json"
if not CONFIG_PATH.exists():
    CONFIG_PATH = ROOT_DIR / "cryptography-lab" / "scoring-server" / "module_config.json"

CONFIG_DATA = {}
if CONFIG_PATH.exists():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        CONFIG_DATA = json.load(f)

TRACKS_CONFIG = CONFIG_DATA.get("tracks", {})
TRACK_ORDER = list(TRACKS_CONFIG.keys())

SERVICES_URL = os.environ.get("SERVICES_URL", "http://127.0.0.1:9500")


def generate_flag(student_id: str, track_id: str, module_id: str, lab_seed: str = "defaultseed") -> List[str]:
    raw1 = f"crypto_{track_id}_{module_id}_{student_id}_{lab_seed}"
    digest1 = hashlib.sha256(raw1.encode()).hexdigest()[:8]
    flag1 = f"FLAG{{crypto_{track_id}_{module_id}_{student_id}_{digest1}}}"

    raw2 = f"crypto_{module_id}_{student_id}_{lab_seed}"
    digest2 = hashlib.sha256(raw2.encode()).hexdigest()[:8]
    flag2 = f"FLAG{{crypto_{module_id}_{student_id}_{digest2}}}"

    raw3 = f"crypto_{track_id}_{module_id}_student_{lab_seed}"
    digest3 = hashlib.sha256(raw3.encode()).hexdigest()[:8]
    flag3 = f"FLAG{{crypto_{track_id}_{module_id}_student_{digest3}}}"

    raw4 = f"crypto_{module_id}_student_{lab_seed}"
    digest4 = hashlib.sha256(raw4.encode()).hexdigest()[:8]
    flag4 = f"FLAG{{crypto_{module_id}_student_{digest4}}}"

    return [flag1, flag2, flag3, flag4]


from app.services.score_service import reconcile_user_score
from app.services.completion_service import CompletionService

def _resolve_assignment_id(
    db: Session,
    current_user: Optional[User],
    lab_id: str,
    requested_assignment_id: Optional[int] = None,
) -> Optional[int]:
    """Resolve the canonical assignment context for an authenticated lab request."""
    if not current_user:
        return None

    assignment = resolve_assignment(
        db=db,
        user=current_user,
        lab_id=lab_id,
        requested_assignment_id=requested_assignment_id,
    )
    return assignment.id if assignment else None


def _scope_assignment(query, model, assignment_id: Optional[int]):
    """Apply NULL-safe assignment scoping to a SQLAlchemy query."""
    if assignment_id is None:
        return query.filter(model.assignment_id.is_(None))
    return query.filter(model.assignment_id == assignment_id)


@router.get("/view", response_class=HTMLResponse)
@router.get("/session/view", response_class=HTMLResponse)
def get_standalone_html_view(
    request: Request,
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Renders the standalone Jinja2 template index.html from cryptography-lab."""
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cryptography-lab",
        assignment_id,
    )

    # Automatically provision ECS task if running under ORCHESTRATOR=ecs
    orchestrator_mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if orchestrator_mode == "ecs" and current_user:
        try:
            from app.lab.orchestrator import get_orchestrator
            from app.lab.session_store import get_session, save_session, delete_session
            orch = get_orchestrator()
            if not orch.is_running(user_id_str, "cryptography-lab"):
                logger.info(f"[CRYPTO] Auto-provisioning ECS task for user {user_id_str}...")
                try:
                    res = orch.provision(user_id_str, "cryptography-lab", f"crypto_{user_id_str}")
                    save_session(user_id_str, "cryptography-lab", res)
                except Exception as exc:
                    delete_session(user_id_str, "cryptography-lab")
                    logger.error(f"[CRYPTO] Auto-provisioning ECS task failed for user {user_id_str}: {exc}")
        except Exception as outer_exc:
            logger.error(f"[CRYPTO] Orchestrator error for user {user_id_str}: {outer_exc}")

    total_score = reconcile_user_score(db, user_id_str) if current_user else 0

    progress_rows = []
    if current_user:
        progress_query = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str
        )
        progress_rows = _scope_assignment(
            progress_query,
            UserProgress,
            resolved_assignment_id,
        ).all()

    progress_by_key = {
        (r.track_id, r.module_id): r
        for r in progress_rows
    }

    user_solved = {}
    user_hints = {}
    for r in progress_rows:
        full_key = f"{r.track_id}_{r.module_id}"
        if r.completed:
            user_solved[full_key] = True
        if r.hint1_used:
            user_hints[f"{r.track_id}_{r.module_id}_hint1"] = True
        if r.hint2_used:
            user_hints[f"{r.track_id}_{r.module_id}_hint2"] = True

    if current_user:
        lab_progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "cryptography-lab",
        )
        lab_progress_rows = _scope_assignment(
            lab_progress_query,
            UserLabProgress,
            resolved_assignment_id,
        ).all()

        for lp in lab_progress_rows:
            if lp.status == "COMPLETED" or lp.flag_correct:
                mod_key = lp.module_id.replace("cryptography-lab_", "")
                user_solved[mod_key] = True

    tracks = []
    for tid in TRACK_ORDER:
        tcfg = TRACKS_CONFIG[tid]
        mod_dict = tcfg.get("modules", {})
        mod_keys = list(mod_dict.keys())

        modules = []
        unlocked = True
        solved_count = 0

        for mid in mod_keys:
            mcfg = mod_dict[mid]
            full_key = f"{tid}_{mid}"
            is_solved = bool(user_solved.get(full_key))
            if is_solved:
                solved_count += 1

            up_rec = progress_by_key.get((tid, mid))
            completed_obj_ids = []
            if up_rec and up_rec.flag_submitted:
                try:
                    completed_obj_ids = json.loads(up_rec.flag_submitted)
                    if not isinstance(completed_obj_ids, list):
                        completed_obj_ids = []
                except Exception:
                    completed_obj_ids = []

            raw_objectives = mcfg.get("objectives", [])
            objectives_with_status = []
            for obj in raw_objectives:
                obj_copy = dict(obj)
                obj_id = obj_copy.get("id") or obj_copy.get("objective_id")
                obj_copy["complete"] = bool(
                    obj_id and obj_id in completed_obj_ids
                )
                objectives_with_status.append(obj_copy)

            modules.append({
                "id": mid,
                "track": tid,
                "full_id": full_key,
                "title": mcfg["title"],
                "difficulty": mcfg["difficulty"],
                "points": mcfg["points"],
                "story": mcfg.get("story", ""),
                "mission": mcfg.get("mission", ""),
                "objectives": objectives_with_status,
                "hints": mcfg.get("hints", []),
                "solved": is_solved,
                "unlocked": unlocked,
            })
            unlocked = is_solved

        tracks.append({
            "id": tid,
            "title": tcfg["title"],
            "subtitle": tcfg.get("subtitle", ""),
            "description": tcfg.get("description", ""),
            "difficulty": tcfg.get("difficulty", 1),
            "total_points": tcfg.get("total_points", 1000),
            "solved_count": solved_count,
            "total_modules": len(mod_keys),
            "modules": modules,
        })

    template_path = LABS_DIR / "cryptography-lab" / "scoring-server" / "templates" / "index.html"
    if not template_path.exists():
        template_path = ROOT_DIR / "cryptography-lab" / "scoring-server" / "templates" / "index.html"

    html_content = template_path.read_text(encoding="utf-8")
    html_content = html_content.replace("{{ total_points }}", str(total_score))
    html_content = html_content.replace("{{ student_id }}", user_id_str)
    html_content = html_content.replace("{{ tracks_json | tojson }}", json.dumps(tracks))
    html_content = html_content.replace("{{ terminal_ws_host }}", request.url.hostname or "localhost")
    html_content = html_content.replace("{{ terminal_ws_port }}", "8022")

    return HTMLResponse(content=html_content)


@router.get("/config")
@router.get("/status")
def get_crypto_config(
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cryptography-lab",
        assignment_id,
    )
    total_points = reconcile_user_score(db, user_id_str) if current_user else 0

    progress_rows = []
    if current_user:
        progress_query = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str
        )
        progress_rows = _scope_assignment(
            progress_query,
            UserProgress,
            resolved_assignment_id,
        ).all()

    user_solved = {}
    user_hints = {}
    for r in progress_rows:
        full_key = f"{r.track_id}_{r.module_id}"
        if r.completed:
            user_solved[full_key] = True
        if r.hint1_used:
            user_hints[f"{r.track_id}_{r.module_id}_hint1"] = True
        if r.hint2_used:
            user_hints[f"{r.track_id}_{r.module_id}_hint2"] = True

    if current_user:
        lab_progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "cryptography-lab",
        )
        lab_progress_rows = _scope_assignment(
            lab_progress_query,
            UserLabProgress,
            resolved_assignment_id,
        ).all()

        for lp in lab_progress_rows:
            if lp.status == "COMPLETED" or lp.flag_correct:
                mod_key = lp.module_id.replace("cryptography-lab_", "")
                user_solved[mod_key] = True

    tracks = []
    for tid in TRACK_ORDER:
        tcfg = TRACKS_CONFIG[tid]
        mod_dict = tcfg.get("modules", {})
        mod_keys = list(mod_dict.keys())

        modules = []
        unlocked = True
        solved_count = 0

        for mid in mod_keys:
            mcfg = mod_dict[mid]
            full_key = f"{tid}_{mid}"
            is_solved = bool(user_solved.get(full_key))
            if is_solved:
                solved_count += 1

            modules.append({
                "id": mid,
                "track": tid,
                "full_id": full_key,
                "title": mcfg["title"],
                "difficulty": mcfg["difficulty"],
                "points": mcfg["points"],
                "story": mcfg.get("story", ""),
                "mission": mcfg.get("mission", ""),
                "objectives": mcfg.get("objectives", []),
                "hints": mcfg.get("hints", []),
                "solved": is_solved,
                "unlocked": unlocked,
            })
            unlocked = is_solved

        tracks.append({
            "id": tid,
            "title": tcfg["title"],
            "subtitle": tcfg.get("subtitle", ""),
            "description": tcfg.get("description", ""),
            "difficulty": tcfg.get("difficulty", 1),
            "total_points": tcfg.get("total_points", 1000),
            "solved_count": solved_count,
            "total_modules": len(mod_keys),
            "modules": modules,
        })

    return {
        "student_id": user_id_str,
        "assignment_id": resolved_assignment_id,
        "total_points": total_points,
        "tracks": tracks,
    }


@router.post("/exit")
@router.post("/teardown")
def exit_crypto_session(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Saves progress, reconciles total user score, and tears down active container environment."""
    user_id_str = str(current_user.id) if current_user else "student"
    total_score = reconcile_user_score(db, user_id_str) if current_user else 0

    if current_user:
        try:
            from app.lab.orchestrator import get_orchestrator
            from app.lab.session_store import delete_session
            orch = get_orchestrator()
            logger.info(f"[CRYPTO] Tearing down container session for user {user_id_str}...")
            orch.teardown(user_id_str, "cryptography-lab")
            delete_session(user_id_str, "cryptography-lab")
        except Exception as exc:
            logger.error(f"[CRYPTO] Teardown failed for user {user_id_str}: {exc}")

    return {
        "success": True,
        "message": "Session exited successfully. Progress saved and environment torn down.",
        "total_points": total_score
    }


@router.get("/progress/{track_id}/{module_id}")
@router.get("/progress/{module_id}")
def get_crypto_progress(
    module_id: str,
    track_id: str = "crypto",
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cryptography-lab",
        assignment_id,
    )

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg.get("modules", {}):
        raise HTTPException(status_code=404, detail="Unknown track or module.")

    objectives = [
        dict(o)
        for o in tcfg["modules"][module_id].get("objectives", [])
    ]

    record_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == track_id,
        UserProgress.module_id == module_id,
    )
    record = _scope_assignment(
        record_query,
        UserProgress,
        resolved_assignment_id,
    ).first()

    completed_ids = []
    if record and record.flag_submitted:
        try:
            completed_ids = json.loads(record.flag_submitted)
            if not isinstance(completed_ids, list):
                completed_ids = []
        except Exception:
            completed_ids = []

    for obj in objectives:
        obj_id = obj.get("id") or obj.get("objective_id")
        obj["complete"] = bool(obj_id and obj_id in completed_ids)

    return {
        "objectives": objectives,
        "module_complete": record.completed if record else False,
        "assignment_id": resolved_assignment_id,
    }


@router.post("/hint")
def request_cll_hint(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    track_id = payload.get("track", "crypto")
    module_id = payload.get("module", "module1")
    hint_index = int(payload.get("hint_index", 1))

    if hint_index not in (1, 2):
        raise HTTPException(
            status_code=400,
            detail="Invalid hint index. Must be 1 or 2."
        )

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg.get("modules", {}):
        raise HTTPException(
            status_code=400,
            detail="Unknown track or module."
        )

    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cryptography-lab",
        payload.get("assignment_id"),
    )

    mcfg = tcfg["modules"][module_id]
    hints = mcfg.get("hints", [])
    if len(hints) < hint_index:
        raise HTTPException(
            status_code=404,
            detail="Hint not available."
        )

    progress_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == track_id,
        UserProgress.module_id == module_id,
    )
    progress_query = _scope_assignment(
        progress_query,
        UserProgress,
        resolved_assignment_id,
    )
    record = progress_query.first()

    if not record:
        record = UserProgress(
            assignment_id=resolved_assignment_id,
            user_id=user_id_str,
            track_id=track_id,
            module_id=module_id,
            completed=False,
            module_score=0,
            hint1_used=False,
            hint2_used=False,
            flag_submitted="[]",
        )
        db.add(record)
        db.flush()

    if hint_index == 2 and not record.hint1_used:
        raise HTTPException(
            status_code=403,
            detail="Unlock Hint 1 first before unlocking Hint 2."
        )

    already_unlocked = (
        (hint_index == 1 and record.hint1_used)
        or
        (hint_index == 2 and record.hint2_used)
    )

    if not already_unlocked:
        if hint_index == 1:
            record.hint1_used = True
        else:
            record.hint2_used = True

        record.updated_at = datetime.utcnow()
        db.commit()

    total_score = reconcile_user_score(db, user_id_str)

    return {
        "success": True,
        "hint": hints[hint_index - 1],
        "hint_index": hint_index,
        "penalty": 0 if already_unlocked else 20,
        "already_unlocked": bool(already_unlocked),
        "total_points": total_score,
        "assignment_id": resolved_assignment_id,
    }


@router.post("/submit")
def submit_crypto_flag(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cryptography-lab",
        payload.get("assignment_id"),
    )

    user_id_str = str(current_user.id) if current_user else "student"
    track_id = payload.get("track", "crypto")
    module_id = payload.get("module")
    submitted_flag = (payload.get("flag") or "").strip()

    if not module_id or not track_id:
        raise HTTPException(status_code=400, detail="Missing track or module.")

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg.get("modules", {}):
        raise HTTPException(status_code=400, detail="Unknown track or module.")

    mod_keys = list(tcfg["modules"].keys())
    idx = mod_keys.index(module_id)
    next_module_id = mod_keys[idx + 1] if (idx + 1) < len(mod_keys) else None

    if idx > 0:
        prev_mid = mod_keys[idx - 1]
        prev_query = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == track_id,
            UserProgress.module_id == prev_mid,
        )
        prev_rec = _scope_assignment(
            prev_query,
            UserProgress,
            resolved_assignment_id,
        ).first()

        if not prev_rec or not prev_rec.completed:
            raise HTTPException(
                status_code=403,
                detail="Module is locked. Complete previous module first.",
            )

    record_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == track_id,
        UserProgress.module_id == module_id,
    )
    record = _scope_assignment(
        record_query,
        UserProgress,
        resolved_assignment_id,
    ).first()

    current_total_score = reconcile_user_score(db, user_id_str)
    valid_flags = generate_flag(user_id_str, track_id, module_id)

    matched_objective_id = None
    total_objectives = len(
        tcfg["modules"][module_id].get("objectives", [])
    )

    try:
        answers_path = (
            LABS_DIR
            / "cryptography-lab"
            / "scoring-server"
            / "answers.json"
        )
        if not answers_path.exists():
            answers_path = (
                ROOT_DIR
                / "cryptography-lab"
                / "scoring-server"
                / "answers.json"
            )

        if answers_path.exists():
            with open(answers_path, "r", encoding="utf-8") as f:
                ans_data = json.load(f)

            if module_id in ans_data:
                clean_submitted = submitted_flag.strip()
                clean_submitted_lower = clean_submitted.lower()

                for idx_obj, obj in enumerate(ans_data[module_id]):
                    possible_vals = [
                        obj.get("flag"),
                        obj.get("validation_value"),
                        obj.get("correct_answer"),
                        (
                            f"FLAG{{{obj.get('correct_answer')}}}"
                            if obj.get("correct_answer")
                            else None
                        ),
                    ]
                    possible_vals = [
                        v for v in possible_vals if v is not None
                    ]

                    match_found = False
                    for val in possible_vals:
                        val_clean = str(val).strip()
                        if (
                            clean_submitted == val_clean
                            or clean_submitted_lower == val_clean.lower()
                        ):
                            match_found = True
                            break

                    if match_found:
                        m_num = module_id.replace("module", "")
                        matched_objective_id = (
                            obj.get("objective_id")
                            or obj.get("id")
                            or f"m{m_num}_obj{idx_obj + 1}"
                        )
                        break
    except Exception as exc:
        logger.error(f"Failed to parse answers.json: {exc}")

    if not matched_objective_id and submitted_flag in valid_flags:
        matched_objective_id = f"{module_id}_obj1"

    if not matched_objective_id:
        return {
            "correct": False,
            "message": "That's not the right key for this module.",
            "assignment_id": resolved_assignment_id,
        }

    if not record:
        record = UserProgress(
            assignment_id=resolved_assignment_id,
            user_id=user_id_str,
            track_id=track_id,
            module_id=module_id,
            completed=False,
            module_score=0,
            hint1_used=False,
            hint2_used=False,
            flag_submitted="[]",
        )
        db.add(record)
        db.flush()

    completed_objectives = []
    if record.flag_submitted:
        try:
            completed_objectives = json.loads(record.flag_submitted)
            if not isinstance(completed_objectives, list):
                completed_objectives = []
        except Exception:
            completed_objectives = []

    if matched_objective_id in completed_objectives:
        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total_score,
            "next_module": next_module_id if record.completed else None,
            "track": track_id,
            "module_completed": record.completed,
            "objective_id": matched_objective_id,
            "assignment_id": resolved_assignment_id,
        }

    completed_objectives.append(matched_objective_id)
    record.flag_submitted = json.dumps(completed_objectives)
    record.updated_at = datetime.utcnow()

    if len(completed_objectives) >= total_objectives and total_objectives > 0:
        base_points = tcfg["modules"][module_id].get("points", 200)
        hint1_used = record.hint1_used
        hint2_used = record.hint2_used

        result = CompletionService.complete_track_module(
            db=db,
            user=current_user,
            lab_id="cryptography-lab",
            track_id=track_id,
            module_id=module_id,
            base_points=base_points,
            hint1_used=hint1_used,
            hint2_used=hint2_used,
            submitted_flag=submitted_flag,
            assignment_id=resolved_assignment_id,
        )

        # CompletionService may store the final submitted flag. Crypto needs the
        # JSON objective list for objective-level UI state, so restore it here.
        record.completed = True
        record.completed_at = datetime.utcnow()
        record.module_score = result.points_awarded
        record.flag_submitted = json.dumps(completed_objectives)

        message = "Module complete!"
        module_done = True
        earned_module_score = result.points_awarded
        new_total_score = result.new_total_score
    else:
        message = (
            f"Objective complete! "
            f"({len(completed_objectives)}/{total_objectives})"
        )
        module_done = False
        next_module_id = None
        earned_module_score = 0
        new_total_score = current_user.total_score or 0 if current_user else 0

    db.commit()

    return {
        "correct": True,
        "message": message,
        "points": earned_module_score,
        "total_points": new_total_score,
        "next_module": next_module_id if module_done else None,
        "track": track_id,
        "module_completed": module_done,
        "objective_id": matched_objective_id,
        "assignment_id": resolved_assignment_id,
    }


@router.get("/leaderboard")
def get_crypto_leaderboard(db: Session = Depends(get_db)):
    from sqlalchemy import or_, not_
    admin_filter = not_(or_(
        User.role.ilike('%admin%'),
        User.role.ilike('%sysadmin%'),
        User.name.ilike('%sysadmin%'),
        User.name.ilike('%sys admin%'),
        User.name.ilike('%admin%'),
        User.name.ilike('%security officer%'),
        User.email.ilike('%sysadmin%'),
        User.email.ilike('%admin%'),
        User.email.ilike('%securityofficer%')
    ))
    users = db.query(User).filter(admin_filter).order_by(User.total_score.desc()).all()
    return [
        {
            "user_id": str(u.id),
            "username": u.name or u.email.split("@")[0],
            "email": u.email,
            "total_score": u.total_score or 0
        }
        for u in users
    ]


@router.post("/reset")
def reset_crypto_progress(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cryptography-lab",
        payload.get("assignment_id"),
    )

    progress_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == "crypto",
    )
    _scope_assignment(
        progress_query,
        UserProgress,
        resolved_assignment_id,
    ).delete(synchronize_session=False)

    if current_user:
        lab_progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "cryptography-lab",
        )
        _scope_assignment(
            lab_progress_query,
            UserLabProgress,
            resolved_assignment_id,
        ).delete(synchronize_session=False)

    db.commit()
    reconcile_user_score(db, user_id_str)

    return {
        "reset": True,
        "user_id": user_id_str,
        "assignment_id": resolved_assignment_id,
    }
