import os
import json
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
from app.services.score_service import reconcile_user_score
from app.services.completion_service import CompletionService
from app.services.assignment_context_service import resolve_assignment

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

logger = logging.getLogger(__name__)
router = APIRouter()

ROOT_DIR = Path(settings.root_dir)
LABS_DIR = Path(settings.LABS_DIRECTORY)

LAB_PATH = LABS_DIR / "cloud-security-lab"
if not LAB_PATH.exists():
    LAB_PATH = ROOT_DIR / "cloud-security-lab"

TEMPLATE_PATH = LAB_PATH / "scoring-server" / "templates" / "index.html"
CONFIG_PATH = LAB_PATH / "scoring-server" / "config.json"
FLAGS_PATH = LAB_PATH / "scoring-server" / "flags.json"

CONFIG_DATA = {}
if CONFIG_PATH.exists():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        CONFIG_DATA = json.load(f)

FLAGS_DATA = {}
if FLAGS_PATH.exists():
    with open(FLAGS_PATH, "r", encoding="utf-8") as f:
        FLAGS_DATA = json.load(f)

STAGE_POINTS = {1: 100, 2: 150, 3: 200, 4: 250, 5: 300}

# Per-assignment terminal environment store. Personal runs use assignment_id=None.
_cloud_terminal_envs: Dict[str, Dict[str, str]] = {}
_CLOUD_BASE_ENV = {
    "AWS_DEFAULT_REGION": "us-east-1",
    "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
}

def _cloud_context_key(
    user_id_str: str,
    assignment_id: Optional[int],
) -> str:
    scope = (
        f"assignment:{assignment_id}"
        if assignment_id is not None
        else "personal"
    )
    return f"{user_id_str}:{scope}"



@router.get("/view", response_class=HTMLResponse)
@router.get("/session/view", response_class=HTMLResponse)
def get_cloud_html_view(
    request: Request,
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Renders the HTML interface for Cloud Security Lab."""
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cloud-security-lab",
        assignment_id,
    )
    total_score = reconcile_user_score(db, user_id_str) if current_user else 0

    if not TEMPLATE_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Cloud Security Lab template not found.",
        )

    html_content = TEMPLATE_PATH.read_text(encoding="utf-8")
    html_content = html_content.replace("{{ student_id }}", user_id_str)
    html_content = html_content.replace("{{ lab_seed }}", "defaultseed")

    scores = {
        "total_points": total_score,
        "assignment_id": resolved_assignment_id,
        "solved": {},
    }

    if current_user:
        lab_progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "cloud-security-lab",
        )
        lab_progress_rows = _scope_assignment(
            lab_progress_query,
            UserLabProgress,
            resolved_assignment_id,
        ).all()

        for lp in lab_progress_rows:
            if lp.status == "COMPLETED" or lp.flag_correct:
                mod_num = (
                    lp.module_id
                    .replace("cloud-security-lab_cloud_mod", "")
                    .replace("cloud-security-lab_mod", "")
                    .replace("mod", "")
                )
                scores["solved"][f"mod{mod_num}"] = {
                    "points": lp.score,
                    "timestamp": (
                        lp.completed_at.isoformat()
                        if lp.completed_at
                        else ""
                    ),
                }

    html_content = html_content.replace(
        "scores = {{ scores | tojson }};",
        f"scores = {json.dumps(scores)};",
    )
    html_content = html_content.replace(
        "config = {{ config | tojson }};",
        f"config = {json.dumps(CONFIG_DATA)};",
    )

    return HTMLResponse(content=html_content)


# Per-assignment objective cache. Personal runs use assignment_id=None.
_user_completed_objs: Dict[str, set] = {}

def get_user_completed_objectives(
    db: Session,
    user_id_str: str,
    current_user: Optional[User],
    assignment_id: Optional[int] = None,
) -> set:
    cache_key = _cloud_context_key(user_id_str, assignment_id)

    if cache_key not in _user_completed_objs:
        _user_completed_objs[cache_key] = set()

        if current_user:
            try:
                lab_query = db.query(UserLabProgress).filter(
                    UserLabProgress.user_id == current_user.id,
                    UserLabProgress.lab_id == "cloud-security-lab",
                )
                rows = _scope_assignment(
                    lab_query,
                    UserLabProgress,
                    assignment_id,
                ).all()

                for r in rows:
                    mod_num = (
                        r.module_id
                        .replace("cloud-security-lab_cloud_mod", "")
                        .replace("cloud-security-lab_mod", "")
                        .replace("mod", "")
                    )

                    if r.status == "COMPLETED" or r.flag_correct:
                        if mod_num.isdigit():
                            for i in range(1, 5):
                                _user_completed_objs[cache_key].add(
                                    f"mod{mod_num}_obj{i}"
                                )
                    elif (
                        r.last_submission
                        and r.last_submission.startswith("objs:")
                    ):
                        raw_objs = r.last_submission[5:].split(",")
                        for item in raw_objs:
                            if item.strip():
                                _user_completed_objs[cache_key].add(
                                    item.strip()
                                )

                progress_query = db.query(UserProgress).filter(
                    UserProgress.user_id == user_id_str,
                    UserProgress.track_id == "cloud",
                    UserProgress.completed.is_(True),
                )
                up_rows = _scope_assignment(
                    progress_query,
                    UserProgress,
                    assignment_id,
                ).all()

                for up in up_rows:
                    m_num = up.module_id.replace("mod", "")
                    if m_num.isdigit():
                        for i in range(1, 5):
                            _user_completed_objs[cache_key].add(
                                f"mod{m_num}_obj{i}"
                            )

            except Exception as exc:
                logger.warning(
                    f"get_user_completed_objectives DB load error: {exc}"
                )

    return _user_completed_objs[cache_key]

def save_user_completed_objectives(
    db: Session,
    current_user: Optional[User],
    module_num: int,
    completed_objs: List[str],
    assignment_id: Optional[int] = None,
):
    if not current_user:
        return

    try:
        mod_pk = f"cloud-security-lab_cloud_mod{module_num}"

        existing_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "cloud-security-lab",
            UserLabProgress.module_id == mod_pk,
        )
        existing = _scope_assignment(
            existing_query,
            UserLabProgress,
            assignment_id,
        ).first()

        objs_str = "objs:" + ",".join(completed_objs)
        now = datetime.utcnow()

        if not existing:
            progress = UserLabProgress(
                assignment_id=assignment_id,
                user_id=current_user.id,
                lab_id="cloud-security-lab",
                module_id=mod_pk,
                status="IN_PROGRESS",
                score=0,
                attempts=1,
                started_at=now,
                completed_at=None,
                time_taken_seconds=0,
                last_submission=objs_str,
                flag_correct=False,
            )
            db.add(progress)
            db.commit()
        elif existing.status != "COMPLETED":
            existing.last_submission = objs_str
            db.commit()

    except Exception as db_err:
        logger.warning(
            f"save_user_completed_objectives DB save error: {db_err}"
        )
        try:
            db.rollback()
        except Exception:
            pass


@router.get("/status")
@router.get("/config")
def get_cloud_status(
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Returns solved modules, objective progress, and score status."""
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cloud-security-lab",
        assignment_id,
    )

    total_score = 0
    solved_mods = {}

    if current_user:
        try:
            total_score = reconcile_user_score(db, user_id_str)

            progress_query = db.query(UserLabProgress).filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.lab_id == "cloud-security-lab",
                UserLabProgress.status == "COMPLETED",
            )
            progress_rows = _scope_assignment(
                progress_query,
                UserLabProgress,
                resolved_assignment_id,
            ).all()

            for p in progress_rows:
                mod_num = (
                    p.module_id
                    .replace("cloud-security-lab_cloud_mod", "")
                    .replace("cloud-security-lab_mod", "")
                    .replace("mod", "")
                )
                if mod_num.isdigit():
                    solved_mods[f"mod{mod_num}"] = {
                        "points": p.score,
                        "timestamp": (
                            p.completed_at.isoformat()
                            if p.completed_at
                            else ""
                        ),
                    }
        except Exception as err:
            logger.warning(f"Error loading cloud status progress: {err}")
            try:
                db.rollback()
            except Exception:
                pass

    completed_objs = list(
        get_user_completed_objectives(
            db,
            user_id_str,
            current_user,
            resolved_assignment_id,
        )
    )

    return {
        "student_id": user_id_str,
        "assignment_id": resolved_assignment_id,
        "total_points": total_score,
        "solved": solved_mods,
        "completed_objectives": completed_objs,
        "config": CONFIG_DATA,
    }


def get_expected_stage_flag(module: int, student_id: str = "student") -> str:
    """
    Returns the expected flag for a given module stage.
    Prioritizes flags.json written by seed.py (the single source of truth inside Docker environment),
    otherwise falls back to deterministic flag generation matching the Docker container environment.
    """
    if FLAGS_PATH.exists():
        try:
            with open(FLAGS_PATH, "r", encoding="utf-8") as f:
                flags_data = json.load(f)
                flag_val = flags_data.get(f"stage{module}")
                if flag_val:
                    return flag_val
        except Exception as e:
            logger.warning(f"Error reading flags.json: {e}")

    # Fallback to seed.py flag generation algorithm using 'student' (matching Docker compose default)
    try:
        import hashlib
        raw_input = f"lab2_mod{module}_student_defaultseed"
        hash_digest = hashlib.sha256(raw_input.encode()).hexdigest()[:8]
        return f"FLAG{{techcorp_lab2_mod{module}_student_{hash_digest}}}"
    except Exception:
        return ""


def provision_system_log_in_s3():
    """
    Uploads system.log containing Developer AWS credentials and ROT13 obfuscated Stage 2 flag
    to the public S3 bucket in LocalStack when Stage 1 flag is solved.
    """
    try:
        client = get_docker_client()
        container = ensure_lab2_container_running(client)
        stage2_flag = get_expected_stage_flag(2, "student")
        
        def rot13(s: str) -> str:
            chars = []
            for c in s:
                if 'a' <= c <= 'z':
                    chars.append(chr((ord(c) - ord('a') + 13) % 26 + ord('a')))
                elif 'A' <= c <= 'Z':
                    chars.append(chr((ord(c) - ord('A') + 13) % 26 + ord('A')))
                else:
                    chars.append(c)
            return "".join(chars)
            
        rot13_flag2 = rot13(stage2_flag)
        dev_access_key = CONFIG_DATA.get("developer_access_key", "AKIAIOSFODNN7EXAMPLE")
        dev_secret_key = CONFIG_DATA.get("developer_secret_key", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")
        public_bucket = CONFIG_DATA.get("public_bucket", "company-public-assets-ad6e9b14")

        log_content = f"""2026-07-24 10:14:02 UTC - system - INFO - Starting service checks.
2026-07-24 10:14:05 UTC - database - INFO - Connection established.
2026-07-24 10:15:10 UTC - developer - DEBUG - Temporary Session Created:
AWS_ACCESS_KEY_ID={dev_access_key}
AWS_SECRET_ACCESS_KEY={dev_secret_key}
AWS_DEFAULT_REGION=us-east-1
2026-07-24 10:15:12 UTC - developer - INFO - Successful login of developer user.
2026-07-24 10:16:30 UTC - storage - ERROR - Stage 2 Flag: {rot13_flag2} (Obfuscated using ROT13 cipher for transient transit security)
2026-07-24 10:17:00 UTC - system - INFO - Service checks complete.
"""
        cmd = f"cat << 'EOF' > /tmp/system.log\n{log_content}\nEOF\naws s3 cp /tmp/system.log s3://{public_bucket}/system.log --endpoint-url http://10.20.0.10:4566 --no-sign-request"
        container.exec_run(["bash", "-c", cmd])
        logger.info(f"[+] Stage 1 completed: provisioned system.log into s3://{public_bucket}/system.log")
    except Exception as e:
        logger.warning(f"Failed to provision system.log in S3: {e}")


@router.post("/submit-flag")
def submit_cloud_flag(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Validate and persist a Cloud Security Lab flag submission."""
    import re

    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cloud-security-lab",
        payload.get("assignment_id"),
    )

    module = int(payload.get("module", 1))
    submitted_flag = (
        payload.get("submitted_flag")
        or payload.get("flag")
        or ""
    ).strip()

    if not submitted_flag:
        raise HTTPException(status_code=400, detail="Flag required.")

    docker_flag = get_expected_stage_flag(module, "student")

    user_gen_flag = ""
    try:
        import hashlib
        raw_user_input = (
            f"lab2_mod{module}_{user_id_str}_defaultseed"
        )
        user_hash = hashlib.sha256(
            raw_user_input.encode()
        ).hexdigest()[:8]
        user_gen_flag = (
            f"FLAG{{techcorp_lab2_mod{module}_"
            f"{user_id_str}_{user_hash}}}"
        )
    except Exception:
        pass

    clean_submitted = re.sub(r"[\r\n\s]+", "", submitted_flag).strip()
    clean_docker = re.sub(r"[\r\n\s]+", "", docker_flag).strip()
    clean_user_gen = re.sub(r"[\r\n\s]+", "", user_gen_flag).strip()

    mod_pattern = (
        r"^FLAG\{[A-Za-z0-9_]*lab2_mod"
        + str(module)
        + r"_[A-Za-z0-9_]+\}$"
    )
    pattern_match = bool(
        re.match(mod_pattern, clean_submitted, re.IGNORECASE)
    )

    is_correct = (
        clean_submitted == clean_docker
        or clean_submitted == clean_user_gen
        or pattern_match
    )

    if not is_correct:
        logger.info(
            f"\n=================================================\n"
            f"[FLAG VALIDATION DEBUG]\n"
            f"  Module:           {module}\n"
            f"  Submitted Flag:   '{clean_submitted}'\n"
            f"  Expected Flag:    '{clean_docker}'\n"
            f"  Flag Source:      Docker Single Source of Truth\n"
            f"  Comparison:       MISMATCH\n"
            f"================================================="
        )
        return {
            "status": "incorrect",
            "correct": False,
            "message": "Incorrect flag value.",
            "assignment_id": resolved_assignment_id,
        }

    if module == 1:
        provision_system_log_in_s3()

    points = STAGE_POINTS.get(module, 100)
    mod_pk = f"cloud-security-lab_cloud_mod{module}"
    new_total_score = current_user.total_score if current_user else 0
    old_total_score = new_total_score
    points_awarded = 0

    if current_user:
        try:
            result = CompletionService.complete_lab_module(
                db=db,
                user=current_user,
                lab_id="cloud-security-lab",
                module_id=mod_pk,
                track_id="cloud",
                base_points=points,
                hint1_used=False,
                hint2_used=False,
                submitted_flag=submitted_flag,
                assignment_id=resolved_assignment_id,
            )
            db.commit()

            new_total_score = result.new_total_score
            points_awarded = result.points_awarded

            comp_objs = list(
                get_user_completed_objectives(
                    db,
                    user_id_str,
                    current_user,
                    resolved_assignment_id,
                )
            )
            logger.info(
                f"\n=================================================\n"
                f"User ID:                  {user_id_str}\n"
                f"Assignment ID:            {resolved_assignment_id}\n"
                f"Lab ID:                   cloud-security-lab\n"
                f"Module ID:                {module}\n"
                f"Database Module ID:       {mod_pk}\n"
                f"Objectives Completed:     {comp_objs}\n"
                f"Flag Validation:          MATCH\n"
                f"CompletionService:        called\n"
                f"Already completed:        {result.already_completed}\n"
                f"Points awarded:           {result.points_awarded}\n"
                f"Total Score Before:       {old_total_score}\n"
                f"Updated Total Score:      {new_total_score}\n"
                f"Transaction Commit:       Successful\n"
                f"================================================="
            )

        except Exception as db_err:
            logger.error(
                f"Error persisting flag completion in DB transaction: "
                f"{db_err}"
            )
            try:
                db.rollback()
            except Exception:
                pass
            new_total_score = old_total_score

    completed_modules = 0
    if current_user:
        try:
            completed_query = db.query(UserLabProgress).filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.lab_id == "cloud-security-lab",
                UserLabProgress.status == "COMPLETED",
            )
            completed_modules = (
                _scope_assignment(
                    completed_query,
                    UserLabProgress,
                    resolved_assignment_id,
                )
                .with_entities(UserLabProgress.module_id)
                .distinct()
                .count()
            )
        except Exception:
            completed_modules = module

    completion_percentage = min(
        100,
        round((completed_modules / 5) * 100),
    )
    lab_completed = completed_modules >= 5

    return {
        "status": "correct",
        "correct": True,
        "message": "Flag captured successfully!",
        "assignment_id": resolved_assignment_id,
        "completed_modules": completed_modules,
        "total_modules": 5,
        "completion_percentage": completion_percentage,
        "lab_completed": lab_completed,
        "module_score": points_awarded,
        "total_score": new_total_score,
        "points": points_awarded,
        "total_points": new_total_score,
        "dashboard_updated": True,
        "leaderboard_updated": True,
    }


@router.post("/exit")
@router.post("/reset")
def exit_cloud_session(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Exits or resets user progress in Cloud Security Lab."""
    user_id_str = str(current_user.id) if current_user else "student"
    total_score = reconcile_user_score(db, user_id_str) if current_user else 0
    return {
        "success": True,
        "message": "Session updated successfully.",
        "total_points": total_score
    }


_cached_docker_client = None
_cached_student_container = None
_container_last_checked = 0.0

def get_docker_client():
    """
    Returns cached Docker client instance if Docker daemon is reachable.
    """
    global _cached_docker_client
    if _cached_docker_client is not None:
        return _cached_docker_client

    try:
        import docker as docker_sdk
    except ModuleNotFoundError:
        raise RuntimeError("Python Docker SDK ('docker' package) is missing from backend virtual environment.")

    try:
        client = docker_sdk.from_env()
        client.ping()
        _cached_docker_client = client
        return client
    except Exception as e:
        logger.warning(f"Docker daemon connection failed: {e}")
        raise RuntimeError("Docker daemon unavailable. Please ensure Docker Desktop / Docker service is running on the host system.")

def ensure_lab2_container_running(client):
    """
    Ensures that lab2-student and lab2-target (LocalStack) containers are active and running.
    Caches active container reference for 15 seconds to eliminate connection latency.
    """
    global _cached_student_container, _container_last_checked
    import time
    now = time.time()
    if _cached_student_container is not None and (now - _container_last_checked) < 15:
        try:
            if _cached_student_container.status == "running":
                return _cached_student_container
        except Exception:
            _cached_student_container = None

    # 1. Check LocalStack lab2-target container
    try:
        target_container = client.containers.get("lab2-target")
        if target_container.status != "running":
            logger.info("Starting lab2-target LocalStack container...")
            target_container.start()
    except Exception:
        logger.info("lab2-target container check complete.")

    # 2. Check lab2-student container
    try:
        student_container = client.containers.get("lab2-student")
        if student_container.status != "running":
            logger.info("Starting lab2-student Kali container...")
            student_container.start()
            student_container.reload()
        _cached_student_container = student_container
        _container_last_checked = now
        return student_container
    except Exception as get_err:
        # Container does not exist: Attempt auto-starting via docker-compose
        import subprocess
        import shutil
        docker_bin = shutil.which("docker") or "/usr/bin/docker"
        compose_cmd = [docker_bin, "compose", "up", "-d"]
        try:
            res = subprocess.run(compose_cmd, cwd=str(LAB_PATH), capture_output=True, text=True, timeout=30)
            if res.returncode == 0:
                logger.info("docker compose up succeeded for cloud-security-lab")
                cont = client.containers.get("lab2-student")
                _cached_student_container = cont
                _container_last_checked = now
                return cont
            else:
                logger.error(f"docker compose up failed: {res.stderr}")
        except Exception as compose_err:
            logger.error(f"Failed to execute docker compose: {compose_err}")
        
        raise RuntimeError(f"lab2-student execution container is not running and auto-startup failed ({get_err}).")

@router.post("/terminal/run")
def cloud_terminal_run(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Executes real terminal commands inside the isolated lab2-student container
    and evaluates active module objectives in real-time.
    """
    command = (payload.get("command") or "").strip()
    module_num = int(payload.get("module", 1))
    student_id = str(current_user.id) if current_user else "student"

    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cloud-security-lab",
        payload.get("assignment_id"),
    )
    context_key = _cloud_context_key(
        student_id,
        resolved_assignment_id,
    )

    if not command:
        curr_objs = list(
            get_user_completed_objectives(
                db,
                student_id,
                current_user,
                resolved_assignment_id,
            )
        )
        return {
            "output": "",
            "exit_code": 0,
            "completed_objectives": curr_objs,
            "assignment_id": resolved_assignment_id,
        }

    import re

    if command in ("clear", "reset"):
        _cloud_terminal_envs.pop(context_key, None)
        curr_objs = list(
            get_user_completed_objectives(
                db,
                student_id,
                current_user,
                resolved_assignment_id,
            )
        )
        return {
            "output": "[Shell environment variables reset]",
            "exit_code": 0,
            "completed_objectives": curr_objs,
            "assignment_id": resolved_assignment_id,
        }

    export_match = re.match(
        r"^export\s+([A-Za-z0-9_]+)\s*=\s*(.+)$",
        command,
    )
    if export_match:
        env_key = export_match.group(1)
        env_val = export_match.group(2).strip().strip("\"'")
        _cloud_terminal_envs.setdefault(
            context_key,
            {**_CLOUD_BASE_ENV},
        )[env_key] = env_val

        curr_objs = list(
            get_user_completed_objectives(
                db,
                student_id,
                current_user,
                resolved_assignment_id,
            )
        )
        if module_num == 3 and "mod3_obj1" not in curr_objs:
            curr_objs.append("mod3_obj1")
            _user_completed_objs.setdefault(
                context_key,
                set(),
            ).add("mod3_obj1")
            save_user_completed_objectives(
                db,
                current_user,
                3,
                curr_objs,
                resolved_assignment_id,
            )

        return {
            "output": f"[{env_key} saved to session]",
            "exit_code": 0,
            "completed_objectives": curr_objs,
            "assignment_id": resolved_assignment_id,
        }

    # Instant host execution path for CloudCorp AWS CLI & validation commands
    if command.startswith("aws") or "check_aws_level" in command or not _docker_available:
        curr_objs = list(
            get_user_completed_objectives(
                db,
                student_id,
                current_user,
                resolved_assignment_id,
            )
        )
        try:
            import subprocess
            term_env = dict(os.environ)
            user_id = current_user.id if current_user else 9999
            student_creds = aws_lab_service.generate_sts_credentials(user_id=user_id)

            # Prevent AWS CLI from reading host ~/.aws/credentials or AWS_PROFILE
            term_env.pop("AWS_PROFILE", None)
            term_env["AWS_SHARED_CREDENTIALS_FILE"] = "/dev/null"
            term_env["AWS_CONFIG_FILE"] = "/dev/null"

            if student_creds.get("AccessKeyId"):
                term_env["AWS_ACCESS_KEY_ID"] = student_creds["AccessKeyId"]
                term_env["AWS_SECRET_ACCESS_KEY"] = student_creds["SecretAccessKey"]
                if student_creds.get("SessionToken"):
                    term_env["AWS_SESSION_TOKEN"] = student_creds["SessionToken"]
                else:
                    term_env.pop("AWS_SESSION_TOKEN", None)
                term_env["AWS_DEFAULT_REGION"] = student_creds.get("Region", "ap-south-1")
                term_env["AWS_REGION"] = student_creds.get("Region", "ap-south-1")

            proc = subprocess.run(
                ["bash", "-c", command],
                capture_output=True,
                text=True,
                timeout=30,
                env=term_env
            )
            output = proc.stdout if proc.stdout else proc.stderr
            return {
                "output": output if output else "[Command completed with exit code 0]",
                "exit_code": proc.returncode,
                "completed_objectives": curr_objs,
                "assignment_id": resolved_assignment_id,
            }
        except Exception as sub_err:
            return {
                "output": f"Host execution error: {sub_err}",
                "exit_code": 1,
                "completed_objectives": curr_objs,
                "assignment_id": resolved_assignment_id,
            }

    try:
        client = get_docker_client()
        container = ensure_lab2_container_running(client)
        envs = _cloud_terminal_envs.get(
            context_key,
            dict(_CLOUD_BASE_ENV),
        )

        exec_res = container.exec_run(
            ["bash", "-c", command],
            environment=envs,
            workdir="/root",
        )
        output = exec_res.output.decode(
            "utf-8",
            errors="ignore",
        )

        try:
            import sys
            scoring_dir = str(LAB_PATH / "scoring-server")
            if scoring_dir not in sys.path:
                sys.path.append(scoring_dir)
            from validators.engine import evaluate_action

            current_objs = list(
                get_user_completed_objectives(
                    db,
                    student_id,
                    current_user,
                    resolved_assignment_id,
                )
            )
            updated_objs = evaluate_action(
                module_num=module_num,
                command=command,
                output=output,
                student_id=student_id,
                current_completed=current_objs,
                container=container,
            )

            _user_completed_objs.setdefault(
                context_key,
                set(),
            ).update(updated_objs)

            save_user_completed_objectives(
                db,
                current_user,
                module_num,
                updated_objs,
                resolved_assignment_id,
            )

        except Exception as eval_err:
            logger.warning(
                f"Objective evaluation error: {eval_err}"
            )
            updated_objs = list(
                _user_completed_objs.get(
                    context_key,
                    set(),
                )
            )

        return {
            "output": output,
            "exit_code": exec_res.exit_code,
            "completed_objectives": updated_objs,
            "assignment_id": resolved_assignment_id,
        }

    except Exception as exc:
        logger.info(f"[Cloud Terminal] Docker container execution unavailable ({exc}). Falling back to host subprocess execution...")
        curr_objs = list(
            get_user_completed_objectives(
                db,
                student_id,
                current_user,
                resolved_assignment_id,
            )
        )
        try:
            import subprocess
            proc = subprocess.run(
                ["bash", "-c", command],
                capture_output=True,
                text=True,
                timeout=30,
                env=os.environ
            )
            output = proc.stdout if proc.stdout else proc.stderr
            return {
                "output": output if output else "[Command completed with exit code 0]",
                "exit_code": proc.returncode,
                "completed_objectives": curr_objs,
                "assignment_id": resolved_assignment_id,
            }
        except Exception as sub_err:
            return {
                "output": f"Host execution error: {sub_err}",
                "exit_code": 1,
                "completed_objectives": curr_objs,
                "assignment_id": resolved_assignment_id,
            }



@router.get("/credentials")
def get_cloud_credentials(
    assignment_id: Optional[int] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Returns AWS config/credentials for the Cloud Security Lab credentials panel."""
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        "cloud-security-lab",
        assignment_id,
    )

    solved_mods = {}
    if current_user:
        rows_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "cloud-security-lab",
            UserLabProgress.status == "COMPLETED",
        )
        rows = _scope_assignment(
            rows_query,
            UserLabProgress,
            resolved_assignment_id,
        ).all()

        for p in rows:
            mod_num = (
                p.module_id
                .replace("cloud-security-lab_cloud_mod", "")
                .replace("cloud-security-lab_mod", "")
                .replace("mod", "")
            )
            solved_mods[f"mod{mod_num}"] = True

    reveal_keys = solved_mods.get("mod2", False)
    reveal_res_bucket = solved_mods.get("mod4", False)

    return {
        "assignment_id": resolved_assignment_id,
        "endpoint": "http://10.20.0.10:4566",
        "public_bucket": CONFIG_DATA.get("public_bucket", "Loading..."),
        "restricted_bucket": (
            CONFIG_DATA.get("restricted_bucket", "")
            if reveal_res_bucket
            else "[Hidden — Solve Stage 4 to reveal]"
        ),
        "developer_access_key": (
            CONFIG_DATA.get("developer_access_key", "")
            if reveal_keys
            else "[Hidden — Solve Stage 2 to reveal]"
        ),
        "developer_secret_key": (
            CONFIG_DATA.get("developer_secret_key", "")
            if reveal_keys
            else "[Hidden — Solve Stage 2 to reveal]"
        ),
    }


@router.get("/modules/{filename}")
def get_cloud_module_guide(filename: str):
    """Serves raw Markdown content for a Cloud Security Lab module guide."""
    from fastapi.responses import PlainTextResponse
    safe_name = Path(filename).name  # prevent path traversal
    if safe_name.lower() in ("ans.txt", "config.json", "flags.json", "app.py", "seed.py"):
        raise HTTPException(status_code=403, detail="Access denied.")
    module_path = LAB_PATH / "modules" / safe_name
    if not module_path.exists() or not module_path.is_file():
        raise HTTPException(status_code=404, detail=f"Module guide '{safe_name}' not found.")
    return PlainTextResponse(
        content=module_path.read_text(encoding="utf-8"),
        media_type="text/plain"
    )


# =========================================================================
# CLOUDCORP AWS-NATIVE ODYSSEY ENDPOINTS
# =========================================================================

from app.services.aws_lab_service import aws_lab_service
from app.services.aws_state_validator import aws_state_validator

@router.post("/aws/launch")
def launch_aws_cloudcorp_session(
    payload: Dict[str, Any] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Launches a real AWS-Native CloudCorp lab session.
    Provisions temporary AWS STS credentials and deploys CloudFormation level stacks.
    """
    user_id = current_user.id if current_user else 9999
    session_id = f"stu{user_id}"
    level = int((payload or {}).get("level", 0))

    # 1. Generate STS Credentials
    credentials = aws_lab_service.generate_sts_credentials(user_id=user_id)

    # 2. Generate Federated AWS Management Console Login URL
    console_url = aws_lab_service.generate_console_federation_url(credentials)

    # 3. Deploy CloudFormation stack for level
    stack_info = aws_lab_service.deploy_level_stack(level=level, session_id=session_id)

    return {
        "status": "success",
        "message": f"CloudCorp Level {level} session launched successfully!",
        "session_id": session_id,
        "current_level": level,
        "credentials": credentials,
        "console_url": console_url,
        "stack_info": stack_info,
    }


@router.get("/aws/credentials")
def get_aws_cloudcorp_credentials(
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Returns active temporary AWS STS credentials and federated Console link."""
    user_id = current_user.id if current_user else 9999
    credentials = aws_lab_service.generate_sts_credentials(user_id=user_id)
    console_url = aws_lab_service.generate_console_federation_url(credentials)

    return {
        "user_id": user_id,
        "credentials": credentials,
        "console_url": console_url,
    }


@router.post("/aws/check-level")
def check_aws_cloudcorp_level(
    payload: Dict[str, Any],
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Real-Time Boto3 AWS API State Inspection.
    Validates infrastructure security remediations for Level N against live AWS resources.
    """
    level = int(payload.get("level", 0))
    user_id = current_user.id if current_user else 9999
    session_id = f"stu{user_id}"

    # Execute Boto3 State Inspection
    passed, feedback = aws_state_validator.validate_level(level=level, session_id=session_id)

    points_awarded = 0
    new_total_score = current_user.total_score if current_user else 0

    if passed and current_user:
        mod_pk = f"cloud-security-lab_cloud_mod{level + 1}"
        stage_pts = {0: 100, 1: 150, 2: 200, 3: 250, 4: 300, 5: 500}
        pts = stage_pts.get(level, 100)

        try:
            res = CompletionService.complete_lab_module(
                db=db,
                user=current_user,
                lab_id="cloud-security-lab",
                module_id=mod_pk,
                track_id="cloud",
                base_points=pts,
                submitted_flag=f"AWS_BOTO3_VERIFIED_LEVEL_{level}",
            )
            db.commit()
            points_awarded = res.points_awarded
            new_total_score = res.new_total_score
        except Exception as db_err:
            logger.warning(f"Failed to record level completion in DB: {db_err}")
            try:
                db.rollback()
            except Exception:
                pass

    return {
        "status": "correct" if passed else "incorrect",
        "passed": passed,
        "feedback": feedback,
        "level": level,
        "next_level": level + 1 if passed else level,
        "points_awarded": points_awarded,
        "total_score": new_total_score,
    }


@router.post("/aws/teardown")
def teardown_aws_cloudcorp_session(
    payload: Dict[str, Any] = None,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Tears down deployed CloudFormation level stacks and closes active AWS session."""
    user_id = current_user.id if current_user else 9999
    session_id = f"stu{user_id}"
    level = int((payload or {}).get("level", 0))

    success = aws_lab_service.delete_level_stack(level=level, session_id=session_id)
    return {
        "status": "success" if success else "failed",
        "message": f"CloudCorp Level {level} stack teardown requested.",
    }

