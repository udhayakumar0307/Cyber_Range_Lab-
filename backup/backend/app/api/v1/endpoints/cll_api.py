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

import shutil
DOCKER_BIN = shutil.which("docker") or "/usr/bin/docker"

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

def get_cll_username(user: Optional[User]) -> str:
    if not user:
        return "student"
    email = user.email or ""
    if "@" in email:
        raw_user = email.split("@")[0]
        clean = "".join(c for c in raw_user if c.isalpha())
        return clean.lower() if clean else raw_user.lower()
    return user.name.lower() if user.name else "student"

def generate_flag(student_id: str, track_id: str, module_id: str, lab_seed: str = "") -> List[str]:
    # Always read from environment so it matches the Docker entrypoint.sh LAB_SEED
    if not lab_seed:
        lab_seed = os.environ.get("LAB_SEED", "defaultseed")

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


_cached_cll_checked = 0.0

def ensure_cll_containers_running():
    global _cached_cll_checked
    import time
    now = time.time()
    if (now - _cached_cll_checked) < 30:
        return

    # In production AWS ECS mode, container provisioning is handled dynamically by ECSOrchestrator
    orchestrator_mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if orchestrator_mode == "ecs":
        _cached_cll_checked = now
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

    # Attempt starting command-line-lab containers if stopped in local dev mode
    try:
        import subprocess
        cll_path = LABS_DIR / "command-line-lab"
        if not cll_path.exists():
            cll_path = ROOT_DIR / "command-line-lab"
        subprocess.run([DOCKER_BIN, "compose", "up", "-d"], cwd=str(cll_path), capture_output=True, text=True, timeout=10)
        _cached_cll_checked = now
    except Exception as err:
        logger.warning(f"Auto-startup of command-line-lab containers error: {err}")

def get_cll_runtime_session(user_id: str):
    if os.getenv("ORCHESTRATOR", "docker").lower() != "ecs":
        return None

    try:
        from app.lab.session_store import get_session

        return get_session(
            str(user_id),
            "command-line-lab",
        )
    except Exception as exc:
        logger.warning(
            f"[CLL] Could not get ECS session "
            f"for user {user_id}: {exc}"
        )
        return None


def get_cll_services_url(user_id: str) -> str:
    session = get_cll_runtime_session(user_id)

    if session:
        host = session.get("student_host")
        port = session.get("progress_port")

        if host and port:
            return f"http://{host}:{port}"

    return SERVICES_URL


@router.get("/view", response_class=HTMLResponse)
@router.get("/session/view", response_class=HTMLResponse)
def get_standalone_html_view(
    request: Request,
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Renders the standalone Jinja2 template index.html from command-line-lab."""
    ensure_cll_containers_running()
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "command-line-lab",
        assignment_id,
    )

    # Automatically provision ECS task if running under ORCHESTRATOR=ecs
    orchestrator_mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if orchestrator_mode == "ecs" and current_user:
        try:
            from app.lab.orchestrator import get_orchestrator
            from app.lab.session_store import get_session, save_session, delete_session
            orch = get_orchestrator()
            if not orch.is_running(user_id_str, "command-line-lab"):
                logger.info(f"[CLL] Auto-provisioning ECS task for user {user_id_str}...")
                try:
                    res = orch.provision(user_id_str, "command-line-lab", f"cll_{user_id_str}")
                    save_session(user_id_str, "command-line-lab", res)
                except Exception as exc:
                    delete_session(user_id_str, "command-line-lab")
                    logger.error(f"[CLL] Auto-provisioning ECS task failed for user {user_id_str}: {exc}")
        except Exception as outer_exc:
            logger.error(f"[CLL] Orchestrator error for user {user_id_str}: {outer_exc}")

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
            UserLabProgress.lab_id == "command-line-lab",
        )
        lab_progress_rows = _scope_assignment(
            lab_progress_query,
            UserLabProgress,
            resolved_assignment_id,
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

    ws_protocol = "wss" if request.url.scheme == "https" else "ws"
    token_param = request.query_params.get("token") or ""
    ws_url = f"{ws_protocol}://{request.url.netloc}/api/v1/cll/ws?token={token_param}"

    html_content = html_content.replace("{{ total_points }}", str(total_score))
    html_content = html_content.replace("{{ student_id }}", user_id_str)
    html_content = html_content.replace("{{ tracks_json | tojson }}", json.dumps(tracks))
    html_content = html_content.replace("{{ terminal_ws_host }}", request.url.hostname or "localhost")
    html_content = html_content.replace("{{ terminal_ws_port }}", str(request.url.port or 8000))
    html_content = html_content.replace("{{ terminal_ws_url }}", ws_url)

    return HTMLResponse(content=html_content)



@router.get("/config")
@router.get("/status")
def get_cll_config(
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "command-line-lab",
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
            UserLabProgress.lab_id == "command-line-lab",
        )
        lab_progress_rows = _scope_assignment(
            lab_progress_query,
            UserLabProgress,
            resolved_assignment_id,
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
        "assignment_id": resolved_assignment_id,
        "total_points": total_points,
        "tracks": tracks,
    }


@router.post("/exit")
def exit_cll_session(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Save progress and terminate the student's active lab infrastructure."""

    user_id_str = str(current_user.id) if current_user else "student"

    # Persist/reconcile score before destroying disposable infrastructure.
    total_score = (
        reconcile_user_score(db, user_id_str)
        if current_user
        else 0
    )

    if (
        os.getenv("ORCHESTRATOR", "docker").lower() == "ecs"
        and current_user
    ):
        try:
            from app.lab.orchestrator import get_orchestrator
            from app.lab.session_store import delete_session

            orch = get_orchestrator()

            logger.info(
                f"[CLL] Tearing down ECS session for user {user_id_str}"
            )

            orch.teardown(
                user_id_str,
                "command-line-lab",
            )

            delete_session(
                user_id_str,
                "command-line-lab",
            )

            logger.info(
                f"[CLL] ECS session torn down for user {user_id_str}"
            )

        except Exception as exc:
            logger.exception(
                f"[CLL] Failed to teardown ECS session "
                f"for user {user_id_str}: {exc}"
            )

            raise HTTPException(
                status_code=500,
                detail="Failed to terminate lab infrastructure.",
            )

    return {
        "success": True,
        "message": "Session exited successfully. Progress saved.",
        "total_points": total_score,
    }


@router.get("/progress/{module_id}")
@router.get("/progress/{track_id}/{module_id}")
def get_cll_progress(
    module_id: str,
    track_id: str = "linux",
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "command-line-lab",
        assignment_id,
    )

    services_url = get_cll_services_url(user_id_str)

    try:
        resp = requests.get(
            f"{services_url}/progress/{user_id_str}/{track_id}/{module_id}",
            timeout=3,
        )
        resp.raise_for_status()
        data = resp.json()
        data["assignment_id"] = resolved_assignment_id

        logger.info(
            f"[CLL] Progress | "
            f"user={user_id_str} "
            f"assignment={resolved_assignment_id} "
            f"track={track_id} "
            f"module={module_id} "
            f"url={services_url} "
            f"complete={data.get('module_complete')}"
        )
        return data

    except Exception as exc:
        logger.error(
            f"[CLL] Progress service unavailable | "
            f"user={user_id_str} | "
            f"assignment={resolved_assignment_id} | "
            f"url={services_url} | "
            f"error={exc}"
        )
        return {
            "module": module_id,
            "track": track_id,
            "assignment_id": resolved_assignment_id,
            "objectives": [],
            "module_complete": False,
            "error": "Progress service unavailable",
        }

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
        "command-line-lab",
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
def submit_cll_flag(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "command-line-lab",
        payload.get("assignment_id"),
    )

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

    if record and record.completed:
        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total_score,
            "next_module": next_module_id,
            "assignment_id": resolved_assignment_id,
        }

    services_url = get_cll_services_url(user_id_str)
    try:
        prog_resp = requests.get(
            f"{services_url}/progress/{user_id_str}/{track_id}/{module_id}",
            timeout=3,
        )
        prog_resp.raise_for_status()
        prog_data = prog_resp.json()

        if not prog_data.get("module_complete", False):
            return {
                "correct": False,
                "message": "Please complete all terminal objectives first!",
                "assignment_id": resolved_assignment_id,
            }
    except Exception as exc:
        logger.error(
            f"[CLL] Progress service check failed for user {user_id_str}: {exc}"
        )
        return {
            "correct": False,
            "message": "Progress service unavailable. Please try again later.",
            "assignment_id": resolved_assignment_id,
        }

    session = get_cll_runtime_session(user_id_str)
    if session:
        lab_seed = session.get("lab_seed", "defaultseed")
    else:
        lab_seed = os.environ.get("LAB_SEED", "defaultseed")

    valid_flags = generate_flag(user_id_str, track_id, module_id, lab_seed)

    if submitted_flag not in valid_flags:
        return {
            "correct": False,
            "message": "That's not the right key for this module.",
            "assignment_id": resolved_assignment_id,
        }

    base_points = tcfg["modules"][module_id]["points"]
    hint1_used = record.hint1_used if record else False
    hint2_used = record.hint2_used if record else False

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
        assignment_id=resolved_assignment_id,
    )
    db.commit()

    return {
        "correct": True,
        "message": "Correct! Next module unlocked.",
        "points": result.points_awarded,
        "total_points": result.new_total_score,
        "next_module": next_module_id,
        "track": track_id,
        "assignment_id": resolved_assignment_id,
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
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "command-line-lab",
        payload.get("assignment_id"),
    )

    progress_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str
    )
    _scope_assignment(
        progress_query,
        UserProgress,
        resolved_assignment_id,
    ).delete(synchronize_session=False)

    if current_user:
        lab_progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "command-line-lab",
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


import asyncio
import struct
import platform
from fastapi import WebSocket, WebSocketDisconnect
from app.core.security import decode_access_token

IS_WINDOWS = platform.system() == "Windows"
if not IS_WINDOWS:
    try:
        import pty
        import fcntl
        import termios
    except ImportError:
        pty = None
        fcntl = None
        termios = None
else:
    pty = None
    fcntl = None
    termios = None



@router.websocket("/ws")
async def cll_terminal_websocket(websocket: WebSocket):
    """
    Native FastAPI WebSocket Terminal Bridge for Command Line Lab.
    Dynamically extracts student username (e.g. keshika@cyberrange:~$)
    and provides a real interactive PTY shell session.
    """
    client_ip = websocket.client.host if websocket.client else "unknown"
    await websocket.accept()
    logger.info(f"[CLL-WS] Connected from {client_ip}")

    token = websocket.query_params.get("token") or ""
    username = "keshika"
    user_id = None
    if token:
        try:
            payload = decode_access_token(token)
            user_id = payload.get("user_id") or payload.get("sub")
            sub = payload.get("sub", "")
            if sub and "@" in sub:
                raw_user = sub.split("@")[0]
                clean = "".join(c for c in raw_user if c.isalpha())
                username = clean.lower() if clean else raw_user.lower()
        except Exception as e:
            logger.warning(f"[CLL-WS] Token decode error: {e}")

    # In production AWS ECS mode, proxy WebSocket directly to cll-services WS port (8022)
    orchestrator_mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if orchestrator_mode == "ecs" and user_id:
        from app.lab.session_store import get_session, delete_session
        from app.lab.orchestrator import get_orchestrator
        session = get_session(str(user_id), "command-line-lab")

        # Validate the session task is still RUNNING – discard stale sessions
        if session:
            task_arn = session.get("task_arn")
            if task_arn:
                try:
                    orch = get_orchestrator()
                    desc = orch._ecs.describe_tasks(cluster=orch.CLUSTER_NAME, tasks=[task_arn])
                    tasks_desc = desc.get("tasks", [])
                    if not tasks_desc or tasks_desc[0].get("lastStatus") != "RUNNING":
                        logger.warning(f"[CLL-WS Proxy] Stale session detected (task {task_arn} not RUNNING). Clearing.")
                        delete_session(str(user_id), "command-line-lab")
                        session = None
                except Exception as chk_err:
                    logger.warning(f"[CLL-WS Proxy] Could not verify task liveness: {chk_err}")

        if session:
            target_host = session["student_host"]
            target_port = int(session.get("ws_port") or session.get("student_port") or 8022)
            target_url = f"ws://{target_host}:{target_port}"
            logger.info(f"[CLL-WS Proxy] Proxying WebSocket to {target_url} for user {user_id}")
            
            import websockets

            # Wait up to 90s for terminal_service.py to bind (entrypoint setup takes time)
            MAX_WAIT = 90
            RETRY_INTERVAL = 3
            remote_ws = None
            elapsed = 0
            last_dot = 0
            await websocket.send_text(
                "\r\n\x1b[1;33m[CyberRange] Lab environment starting, please wait...\x1b[0m\r\n"
            )
            while elapsed < MAX_WAIT:
                try:
                    remote_ws = await websockets.connect(target_url, open_timeout=5)
                    logger.info(f"[CLL-WS Proxy] Connected to {target_url} after {elapsed}s")
                    break
                except (ConnectionRefusedError, OSError):
                    await asyncio.sleep(RETRY_INTERVAL)
                    elapsed += RETRY_INTERVAL
                    # Send a dot every 9 seconds so the connection stays alive
                    if elapsed - last_dot >= 9:
                        await websocket.send_text("\x1b[1;33m.\x1b[0m")
                        last_dot = elapsed
                except Exception as early_err:
                    logger.error(f"[CLL-WS Proxy] Unexpected error waiting for {target_url}: {early_err}")
                    break

            if remote_ws is None:
                logger.error(f"[CLL-WS Proxy] terminal_service not ready after {MAX_WAIT}s at {target_url}")
                delete_session(str(user_id), "command-line-lab")
                await websocket.send_text(
                    f"\r\n\x1b[1;31m[ERROR] Lab environment did not start in time. Please refresh and try again.\x1b[0m\r\n"
                )
                await websocket.close()
                return

            try:
                await websocket.send_text("\r\n\x1b[1;32m[CyberRange] Connected! Loading terminal...\x1b[0m\r\n")
                async def client_to_remote():
                    try:
                        while True:
                            data = await websocket.receive()
                            if "text" in data and data["text"]:
                                await remote_ws.send(data["text"])
                            elif "bytes" in data and data["bytes"]:
                                await remote_ws.send(data["bytes"])
                    except Exception:
                        pass

                async def remote_to_client():
                    try:
                        async for msg in remote_ws:
                            if isinstance(msg, bytes):
                                await websocket.send_bytes(msg)
                            else:
                                await websocket.send_text(msg)
                    except Exception:
                        pass

                await asyncio.gather(client_to_remote(), remote_to_client(), return_exceptions=True)
            except Exception as proxy_err:
                logger.error(f"[CLL-WS Proxy] Error during proxy for {target_url}: {proxy_err}")
                delete_session(str(user_id), "command-line-lab")
                await websocket.send_text(f"\r\n\x1b[1;31m[ERROR] Terminal connection failed: {proxy_err}\x1b[0m\r\n")
                await websocket.close()
            finally:
                try:
                    await remote_ws.close()
                except Exception:
                    pass
            return
        else:
            # No valid session – ECS task is still starting up (or ASG is scaling)
            await websocket.send_text(
                "\r\n\x1b[1;33m[CyberRange] Your lab environment is starting up. "
                "Please wait 30-60 seconds and refresh the page.\x1b[0m\r\n"
            )
            await websocket.close()
            return

    # Create workspace for student inside project root (prevents /tmp permission error)
    workspace_dir = ROOT_DIR / "workspaces" / username
    try:
        workspace_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logger.warning(f"[CLL-WS] Failed to create workspace dir {workspace_dir}: {e}")
        workspace_dir = Path.cwd()


    # ── Module 1: Linux Navigation ─ Workspace Scaffold ──────────────────────
    # Challenge structure:
    #   ~/
    #   ├── readme.txt            (orientation note)
    #   ├── documents/            (decoy folder)
    #   │   └── notes.txt
    #   ├── downloads/            (decoy folder)
    #   │   └── archive.tar.gz.bak
    #   └── records/              (student must find this)
    #       └── logs/
    #           └── archive/
    #               └── .keyfile  ← hidden file containing the FLAG
    from app.api.v1.endpoints.cll_api import generate_flag
    flags = generate_flag(username, "linux", "module1")
    flag1 = flags[0] if flags else "FLAG{cll_linux_module1_keshika_8a3f9b2d}"

    # Top-level readme
    (workspace_dir / "readme.txt").write_text(
        "Welcome to CyberRange Linux Navigation Lab!\n"
        "Your mission: Locate the onboarding key hidden inside your home directory.\n"
        "Hint: Use pwd, ls, and cd to navigate. Hidden files start with a dot (.).\n",
        encoding="utf-8"
    )

    # Decoy folders so the student actually has to explore
    decoy_docs = workspace_dir / "documents"
    decoy_docs.mkdir(exist_ok=True)
    (decoy_docs / "notes.txt").write_text("Meeting notes — Q3 review.\n", encoding="utf-8")

    decoy_dl = workspace_dir / "downloads"
    decoy_dl.mkdir(exist_ok=True)
    (decoy_dl / "archive.tar.gz.bak").write_text("# backup placeholder\n", encoding="utf-8")

    # Challenge path: records/logs/archive/.keyfile
    archive_dir = workspace_dir / "records" / "logs" / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)
    (archive_dir / ".keyfile").write_text(f"{flag1}\n", encoding="utf-8")
    # ─────────────────────────────────────────────────────────────────────────

    # Interactive PTY Shell Execution — routes into cll-student Docker container
    IS_WINDOWS = platform.system() == "Windows"
    STUDENT_CONTAINER = "cll-student"
    
    # Dynamically find actual container name (ECS prefixes like ecs-command-line-lab-3-cll-student...)
    try:
        import subprocess as sp
        out_names = sp.check_output(
            ["docker", "ps", "--format", "{{.Names}}"],
            stderr=sp.DEVNULL
        ).decode("utf-8", errors="ignore").splitlines()
        for c_name in out_names:
            if "cll-student" in c_name:
                STUDENT_CONTAINER = c_name.strip()
                break
    except Exception:
        pass

    master_fd = None
    proc = None

    try:
        if not IS_WINDOWS and pty is not None:
            import shutil
            docker_bin = shutil.which("docker") or "/usr/bin/docker"
            exec_cmd = [
                docker_bin, "exec", "-it",
                "-u", "student",
                "-e", "TERM=xterm-256color",
                "-e", f"HOME=/home/student",
                "-e", f"STUDENT_ID={username}",
                "-w", "/home/student",
                STUDENT_CONTAINER,
                "/bin/bash", "-l",
            ]
            pid, master_fd = pty.fork()
            if pid == 0:
                os.execvp(exec_cmd[0], exec_cmd)
            else:
                if fcntl and termios:
                    try:
                        winsize = struct.pack("HHHH", 32, 120, 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                    except Exception:
                        pass

                loop = asyncio.get_event_loop()

                async def read_pty():
                    while True:
                        try:
                            data = await loop.run_in_executor(None, os.read, master_fd, 4096)
                            if not data:
                                break
                            await websocket.send_bytes(data)
                        except Exception:
                            break

                async def write_pty():
                    input_buffer = ""
                    hist_file = workspace_dir / ".cmd_history"
                    while True:
                        try:
                            msg = await websocket.receive()
                            if msg.get("type") == "websocket.disconnect":
                                break
                            raw_text = msg.get("text")
                            raw_bytes = msg.get("bytes")
                            if raw_text:
                                try:
                                    payload = json.loads(raw_text)
                                    if payload.get("type") == "resize":
                                        rows = payload.get("rows", 32)
                                        cols = payload.get("cols", 120)
                                        if fcntl and termios:
                                            wsz = struct.pack("HHHH", rows, cols, 0, 0)
                                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, wsz)
                                    elif payload.get("type") == "input":
                                        data = payload.get("data", "")
                                        os.write(master_fd, data.encode("utf-8"))
                                        # Track each character; save command on Enter
                                        for ch in data:
                                            if ch in ('\r', '\n'):
                                                cmd = input_buffer.strip()
                                                if cmd:
                                                    try:
                                                        with open(hist_file, "a", encoding="utf-8") as hf:
                                                            hf.write(cmd + "\n")
                                                    except Exception:
                                                        pass
                                                input_buffer = ""
                                            elif ch in ('\x7f', '\x08'):  # backspace / DEL
                                                input_buffer = input_buffer[:-1]
                                            elif ch.isprintable():
                                                input_buffer += ch
                                except (json.JSONDecodeError, TypeError):
                                    os.write(master_fd, raw_text.encode("utf-8"))
                            elif raw_bytes:
                                os.write(master_fd, raw_bytes)
                        except WebSocketDisconnect:
                            break
                        except Exception as e:
                            logger.warning(f"[CLL-WS] write_pty error: {e}")
                            break


                # Send initial login banner & prompt
                banner = (
                    f"\r\nWelcome to CyberRange Ubuntu 22.04.5 LTS (GNU/Linux 6.6.87.2-microsoft-standard-WSL2 x86_64)\r\n\r\n"
                    f" * Documentation:  https://cyberrange.in/docs\r\n"
                    f" * Range Workstation: {workspace_dir}\r\n\r\n"
                    f"\x1b[1;32m{username}@cyberrange\x1b[0m:\x1b[1;34m~\x1b[0m$ "
                )
                await websocket.send_text(banner)

                await asyncio.gather(read_pty(), write_pty())
        else:
            # Fallback for Windows
            prompt_str = f"\x1b[1;32m{username}@cyberrange\x1b[0m:\x1b[1;34m~\x1b[0m$ "
            banner = f"\r\nWelcome to CyberRange Linux Workstation\r\n{prompt_str}"
            await websocket.send_text(banner)
            while True:
                text = await websocket.receive_text()
                await websocket.send_text(f"\r\n{prompt_str}")
    except WebSocketDisconnect:
        logger.info(f"[CLL-WS] Disconnected | {username}")
    except Exception as e:
        logger.error(f"[CLL-WS] Exception: {e}")
    finally:
        if master_fd is not None:
            try:
                os.close(master_fd)
            except Exception:
                pass

