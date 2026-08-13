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
        subprocess.run([DOCKER_BIN, "compose", "up", "-d"], cwd=str(cll_path), capture_output=True, text=True, timeout=30)
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


@router.get("/progress/{module_id}")
@router.get("/progress/{track_id}/{module_id}")
def get_cll_progress(
    request: Request,
    module_id: str,
    track_id: str = "linux"
):
    token = request.query_params.get("token") or ""
    if not token and "authorization" in request.headers:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]

    username = "keshika"
    if token:
        try:
            payload = decode_access_token(token)
            sub = payload.get("sub", "")
            if sub and "@" in sub:
                raw_user = sub.split("@")[0]
                clean = "".join(c for c in raw_user if c.isalpha())
                username = clean.lower() if clean else raw_user.lower()
        except Exception:
            pass

    tcfg = TRACKS_CONFIG.get(track_id)
    if not tcfg or module_id not in tcfg.get("modules", {}):
        return {"objectives": []}


    objectives = tcfg["modules"][module_id].get("objectives", [])
    workspace_dir = ROOT_DIR / "workspaces" / username

    import re as _re
    import subprocess as _subprocess

    STUDENT_CONTAINER = "cll-student"
    LOG_PATH_IN_CONTAINER = "/var/log/session/commands.log"

    # ── Read real command log from Docker container ─────────────────────────
    # Primary: docker exec cat of the session log (server-authoritative)
    # Fallback: local .cmd_history written by the WebSocket handler
    cmd_history_lines = []
    try:
        result = _subprocess.run(
            [DOCKER_BIN, "exec", "-u", "root", STUDENT_CONTAINER, "cat", LOG_PATH_IN_CONTAINER],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            # Parse timestamp|cwd|cmd format from Docker log and filter by directory context
            module_path_key = f"{track_id}/{module_id}".lower()
            for line in result.stdout.splitlines():
                parts = line.strip().split("|", 2)
                if len(parts) == 3:
                    ts, cwd, cmd = parts
                    if module_path_key in cwd.lower() or not cwd:
                        cmd_history_lines.append(cmd)
                else:
                    cmd_history_lines.append(line.strip())
    except Exception:
        pass

    # Fallback to local .cmd_history if docker exec failed or returned nothing
    if not cmd_history_lines:
        hist_file = workspace_dir / ".cmd_history"
        if hist_file.exists():
            try:
                cmd_history_lines = hist_file.read_text(encoding="utf-8").splitlines()
            except Exception:
                cmd_history_lines = []

    def _check_objective(obj):
        obj_type = obj.get("type", "log_regex")
        pattern = obj.get("pattern", "")
        if obj_type == "log_regex" and pattern:
            try:
                regex = _re.compile(pattern)
                for line in cmd_history_lines:
                    if regex.search(line):
                        return True
            except _re.error:
                pass
            return False
        elif obj_type == "fs_test":
            test_cmd = obj.get("test_cmd", "")
            if test_cmd:
                # Run fs_test inside the Docker container (server-authoritative)
                try:
                    result = _subprocess.run(
                        [DOCKER_BIN, "exec", "-u", "root", STUDENT_CONTAINER, "bash", "-c", test_cmd],
                        capture_output=True, timeout=5
                    )
                    return result.returncode == 0
                except Exception:
                    pass
        return False

    updated_objectives = []
    for idx, obj in enumerate(objectives):
        label = obj.get("label") or obj.get("text") or obj.get("description") or f"Objective {idx + 1}"
        is_complete = _check_objective(obj)
        updated_objectives.append({
            "text": label,
            "label": label,
            "complete": is_complete
        })

    return {"objectives": updated_objectives}



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
            if not prog_data.get("module_complete", False):
                return {"correct": False, "message": "Please complete all terminal objectives first!"}
    except Exception as e:
        logger.warning(f"Progress service check warning: {e}")

    username_str = get_cll_username(current_user)
    valid_flags = generate_flag(username_str, track_id, module_id)

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
        "points": result.points_awarded,
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
    if token:
        try:
            payload = decode_access_token(token)
            sub = payload.get("sub", "")
            if sub and "@" in sub:
                raw_user = sub.split("@")[0]
                clean = "".join(c for c in raw_user if c.isalpha())
                username = clean.lower() if clean else raw_user.lower()
        except Exception as e:
            logger.warning(f"[CLL-WS] Token decode error: {e}")

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

