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

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

ROOT_DIR = Path(settings.root_dir)
LABS_DIR = Path(settings.LABS_DIRECTORY)

CONFIG_PATH = LABS_DIR / "command-line-lab" / "scoring-server" / "module_config.json"
if not CONFIG_PATH.exists():
    CONFIG_PATH = ROOT_DIR / "command-line-lab" / "scoring-server" / "module_config.json"

CONFIG_DATA = {}
if CONFIG_PATH.exists():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        CONFIG_DATA = json.load(f)

TRACKS_CONFIG = CONFIG_DATA.get("tracks", {})
TRACK_ORDER = list(TRACKS_CONFIG.keys())

SERVICES_URL = os.environ.get("SERVICES_URL", "http://127.0.0.1:9500")

def generate_flag(student_id: str, track_id: str, module_id: str, lab_seed: str = "defaultseed") -> List[str]:
    raw1 = f"cll_{track_id}_{module_id}_{student_id}_{lab_seed}"
    digest1 = hashlib.sha256(raw1.encode()).hexdigest()[:8]
    flag1 = f"FLAG{{cll_{track_id}_{module_id}_{student_id}_{digest1}}}"

    raw2 = f"cll_{module_id}_{student_id}_{lab_seed}"
    digest2 = hashlib.sha256(raw2.encode()).hexdigest()[:8]
    flag2 = f"FLAG{{cll_{module_id}_{student_id}_{digest2}}}"

    raw3 = f"cll_{track_id}_{module_id}_student_{lab_seed}"
    digest3 = hashlib.sha256(raw3.encode()).hexdigest()[:8]
    flag3 = f"FLAG{{cll_{track_id}_{module_id}_student_{digest3}}}"

    raw4 = f"cll_{module_id}_student_{lab_seed}"
    digest4 = hashlib.sha256(raw4.encode()).hexdigest()[:8]
    flag4 = f"FLAG{{cll_{module_id}_student_{digest4}}}"

    return [flag1, flag2, flag3, flag4]


from app.services.score_service import reconcile_user_score
from app.services.completion_service import CompletionService


_cached_cll_checked = 0.0

def ensure_cll_containers_running():
    global _cached_cll_checked
    import time
    now = time.time()
    if (now - _cached_cll_checked) < 30:
        return

    try:
        import docker as docker_sdk
        client = docker_sdk.from_env()
        cll_cont = client.containers.get("cll-services")
        if cll_cont.status == "running":
            _cached_cll_checked = now
            return
    except Exception:
        pass

    # Attempt starting command-line-lab containers if stopped
    try:
        import subprocess
        cll_path = LABS_DIR / "command-line-lab"
        if not cll_path.exists():
            cll_path = ROOT_DIR / "command-line-lab"
        subprocess.run(["docker", "compose", "up", "-d"], cwd=str(cll_path), capture_output=True, text=True, timeout=30)
        _cached_cll_checked = now
    except Exception as err:
        logger.warning(f"Auto-startup of command-line-lab containers error: {err}")


@router.get("/view", response_class=HTMLResponse)
@router.get("/session/view", response_class=HTMLResponse)
def get_standalone_html_view(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Renders the standalone Jinja2 template index.html from command-line-lab."""
    ensure_cll_containers_running()
    user_id_str = str(current_user.id) if current_user else "student"
    total_score = reconcile_user_score(db, user_id_str) if current_user else 0

    progress_rows = db.query(UserProgress).filter(UserProgress.user_id == user_id_str).all() if current_user else []
    
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
        lab_progress_rows = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "command-line-lab"
        ).all()
        for lp in lab_progress_rows:
            if lp.status == "COMPLETED" or lp.flag_correct:
                mod_key = lp.module_id.replace("command-line-lab_", "")
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

    template_path = LABS_DIR / "command-line-lab" / "scoring-server" / "templates" / "index.html"
    if not template_path.exists():
        template_path = ROOT_DIR / "command-line-lab" / "scoring-server" / "templates" / "index.html"

    html_content = template_path.read_text(encoding="utf-8")

    html_content = html_content.replace("{{ total_points }}", str(total_score))
    html_content = html_content.replace("{{ student_id }}", user_id_str)
    html_content = html_content.replace("{{ tracks_json | tojson }}", json.dumps(tracks))
    html_content = html_content.replace("{{ terminal_ws_host }}", request.url.hostname or "localhost")
    html_content = html_content.replace("{{ terminal_ws_port }}", "8022")

    return HTMLResponse(content=html_content)


@router.get("/config")
@router.get("/status")
def get_cll_config(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    total_points = reconcile_user_score(db, user_id_str) if current_user else 0

    progress_rows = db.query(UserProgress).filter(UserProgress.user_id == user_id_str).all() if current_user else []
    
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
        lab_progress_rows = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "command-line-lab"
        ).all()
        for lp in lab_progress_rows:
            if lp.status == "COMPLETED" or lp.flag_correct:
                mod_key = lp.module_id.replace("command-line-lab_", "")
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
        "total_points": total_points,
        "tracks": tracks
    }


@router.post("/exit")
def exit_cll_session(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Saves progress, reconciles total user score, and ends the active lab session."""
    user_id_str = str(current_user.id) if current_user else "student"
    total_score = reconcile_user_score(db, user_id_str) if current_user else 0
    return {
        "success": True,
        "message": "Session exited successfully. Progress saved.",
        "total_points": total_score
    }


@router.get("/progress/{track_id}/{module_id}")
@router.get("/progress/{module_id}")
def get_cll_progress(
    module_id: str,
    track_id: str = "linux",
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg.get("modules", {}):
        raise HTTPException(status_code=404, detail="Unknown track or module.")

    try:
        resp = requests.get(f"{SERVICES_URL}/progress/{user_id_str}/{track_id}/{module_id}", timeout=2)
        if resp.ok:
            return resp.json()
    except Exception:
        pass

    return {"objectives": tcfg["modules"][module_id].get("objectives", [])}


@router.post("/hint")
def request_cll_hint(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    track_id = payload.get("track", "linux")
    module_id = payload.get("module", "module1")
    hint_index = int(payload.get("hint_index", 1))

    if hint_index not in (1, 2):
        raise HTTPException(status_code=400, detail="Invalid hint index. Must be 1 or 2.")

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg.get("modules", {}):
        raise HTTPException(status_code=400, detail="Unknown track or module.")

    mcfg = tcfg["modules"][module_id]
    hints = mcfg.get("hints", [])
    if len(hints) < hint_index:
        raise HTTPException(status_code=404, detail="Hint not available.")

    record = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == track_id,
        UserProgress.module_id == module_id
    ).first()

    if not record:
        record = UserProgress(
            user_id=user_id_str,
            track_id=track_id,
            module_id=module_id,
            completed=False,
            module_score=0,
            hint1_used=False,
            hint2_used=False
        )
        db.add(record)
        db.flush()

    if hint_index == 2 and not record.hint1_used:
        raise HTTPException(status_code=403, detail="Unlock Hint 1 first before unlocking Hint 2.")

    already_unlocked = (hint_index == 1 and record.hint1_used) or (hint_index == 2 and record.hint2_used)

    if not already_unlocked:
        if hint_index == 1:
            record.hint1_used = True
        elif hint_index == 2:
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
    }


@router.post("/submit")
def submit_cll_flag(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    track_id = payload.get("track", "linux")
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
        prev_rec = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == track_id,
            UserProgress.module_id == prev_mid
        ).first()
        if not prev_rec or not prev_rec.completed:
            raise HTTPException(status_code=403, detail="Module is locked. Complete previous module first.")

    record = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == track_id,
        UserProgress.module_id == module_id
    ).first()

    current_total_score = reconcile_user_score(db, user_id_str)

    if record and record.completed:
        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total_score,
            "next_module": next_module_id,
        }

    try:
        prog_resp = requests.get(f"{SERVICES_URL}/progress/{user_id_str}/{track_id}/{module_id}", timeout=2)
        if prog_resp.ok:
            prog_data = prog_resp.json()
            if not prog_data.get("module_complete", True):
                pass
    except Exception as e:
        logger.warning(f"Progress service check warning: {e}")

    valid_flags = generate_flag(user_id_str, track_id, module_id)
    if submitted_flag not in valid_flags:
        return {"correct": False, "message": "That's not the right key for this module."}

    base_points = tcfg["modules"][module_id]["points"]
    hint1_used = record.hint1_used if record else False
    hint2_used = record.hint2_used if record else False

    # --- CompletionService is the ONLY entry point for awarding points ---
    result = CompletionService.complete_track_module(
        db=db,
        user=current_user,
        lab_id="command-line-lab",
        track_id=track_id,
        module_id=module_id,
        base_points=base_points,
        hint1_used=hint1_used,
        hint2_used=hint2_used,
        submitted_flag=submitted_flag,
    )
    db.commit()

    new_total_score = result.new_total_score

    return {
        "correct": True,
        "message": "Correct! Next module unlocked.",
        "points": earned_module_score,
        "total_points": new_total_score,
        "next_module": next_module_id,
        "track": track_id,
    }


@router.get("/leaderboard")
def get_cll_leaderboard(db: Session = Depends(get_db)):
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
def reset_cll_progress(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    db.query(UserProgress).filter(UserProgress.user_id == user_id_str).delete()
    if current_user:
        db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "command-line-lab"
        ).delete()
    db.commit()

    reconcile_user_score(db, user_id_str)
    return {"reset": True, "user_id": user_id_str}
