import logging
import asyncio
import json
import re
import socket
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

import docker
import asyncssh

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
    Query,
)
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_admin_user
from app.models.assignment import Assignment
from app.models.user import User
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user_lab_progress import UserLabProgress
from app.models.techcorp_session import TechCorpSession
from app.services.assignment_context_service import resolve_assignment
from app.services.completion_service import CompletionService


logger = logging.getLogger(__name__)
router = APIRouter()


# Runtime infrastructure still uses "puzzle-lab", while the registered/purchased
# catalog lab may be "techcorp-sysadmin-labs". Academic progress must use the
# actual Assignment.lab_id so professor-side assignment analytics can find it.
RUNTIME_LAB_ID = "puzzle-lab"
TECHCORP_LAB_IDS = ("techcorp-sysadmin-labs", "puzzle-lab")


def get_points_for_level(level: int) -> int:
    if 0 <= level <= 6:
        return 50
    elif 7 <= level <= 13:
        return 75
    elif 14 <= level <= 20:
        return 100
    elif 21 <= level <= 27:
        return 100
    elif 28 <= level <= 33:
        return 125
    return 0


def find_free_port(db: Session) -> int:
    port = 2220
    active_ports = {p[0] for p in db.query(TechCorpSession.ssh_port).all()}

    while port in active_ports:
        port += 1

    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(("127.0.0.1", port)) != 0 and port not in active_ports:
                break
            port += 1

    return port


def _resolve_techcorp_assignment(
    db: Session,
    user: User,
    requested_assignment_id: Optional[int] = None,
) -> Optional[Assignment]:
    """
    Resolve academic context for the Puzzle/TechCorp lab.

    The platform historically uses two IDs for the same experience:
      - techcorp-sysadmin-labs: registered/catalog lab
      - puzzle-lab: runtime route/orchestrator lab

    Explicit assignment IDs are validated through AssignmentContextService.
    Without an explicit ID, both aliases are checked. If more than one active
    assignment applies, the request is rejected rather than silently attributing
    work to the wrong assignment.
    """

    if requested_assignment_id is not None:
        assignment = (
            db.query(Assignment)
            .filter(
                Assignment.id == requested_assignment_id,
                Assignment.deleted_at.is_(None),
            )
            .first()
        )

        if assignment is None:
            # Reuse the canonical resolver for the standard 404 behavior.
            return resolve_assignment(
                db=db,
                user=user,
                lab_id=RUNTIME_LAB_ID,
                requested_assignment_id=requested_assignment_id,
            )

        if assignment.lab_id not in TECHCORP_LAB_IDS:
            raise HTTPException(
                status_code=400,
                detail="Assignment does not belong to the Puzzle/TechCorp lab.",
            )

        return resolve_assignment(
            db=db,
            user=user,
            lab_id=assignment.lab_id,
            requested_assignment_id=requested_assignment_id,
        )

    matches = []

    for lab_id in TECHCORP_LAB_IDS:
        assignment = resolve_assignment(
            db=db,
            user=user,
            lab_id=lab_id,
            requested_assignment_id=None,
        )
        if assignment is not None:
            matches.append(assignment)

    # Deduplicate defensively by canonical assignment PK.
    matches = list({assignment.id: assignment for assignment in matches}.values())

    if len(matches) > 1:
        raise HTTPException(
            status_code=409,
            detail=(
                "Multiple active Puzzle/TechCorp assignments exist. "
                "An explicit assignment_id is required."
            ),
        )

    return matches[0] if matches else None


def _progress_lab_id(assignment: Optional[Assignment]) -> str:
    """
    Assigned progress uses Assignment.lab_id so professor analytics line up with
    the assignment. Personal/unassigned play retains the historical runtime ID.
    """
    return assignment.lab_id if assignment is not None else RUNTIME_LAB_ID


def _assignment_scoped_progress_query(
    db: Session,
    user_id: int,
    lab_id: str,
    assignment_id: Optional[int],
):
    query = db.query(UserLabProgress).filter(
        UserLabProgress.user_id == user_id,
        UserLabProgress.lab_id == lab_id,
    )

    if assignment_id is None:
        query = query.filter(UserLabProgress.assignment_id.is_(None))
    else:
        query = query.filter(UserLabProgress.assignment_id == assignment_id)

    return query


def _completed_level_numbers(
    db: Session,
    user_id: int,
    lab_id: str,
    assignment_id: Optional[int],
) -> tuple[List[int], List[str]]:
    """
    Return zero-based solved level numbers and the legacy UI level IDs for one
    assignment/personal context only.
    """

    completed_rows = (
        _assignment_scoped_progress_query(
            db=db,
            user_id=user_id,
            lab_id=lab_id,
            assignment_id=assignment_id,
        )
        .filter(UserLabProgress.status == "COMPLETED")
        .with_entities(UserLabProgress.module_id)
        .all()
    )

    completed_nums: List[int] = []
    completed_level_ids: List[str] = []

    for row in completed_rows:
        module_id = row[0] or ""

        if module_id.startswith("puzzle-lab_module"):
            try:
                module_num = int(module_id.replace("puzzle-lab_module", ""))
                level_num = module_num - 1
                completed_nums.append(level_num)
                completed_level_ids.append(f"techcorp_level{level_num}")
            except ValueError:
                pass

        elif module_id.startswith("techcorp_level"):
            try:
                level_num = int(module_id.replace("techcorp_level", ""))
                completed_nums.append(level_num)
                completed_level_ids.append(module_id)
            except ValueError:
                pass

    return completed_nums, completed_level_ids


def _required_level(
    db: Session,
    user_id: int,
    lab_id: str,
    assignment_id: Optional[int],
) -> tuple[int, List[str]]:
    completed_nums, completed_level_ids = _completed_level_numbers(
        db=db,
        user_id=user_id,
        lab_id=lab_id,
        assignment_id=assignment_id,
    )

    highest_completed = max(completed_nums) if completed_nums else -1

    # Puzzle Lab exposes playable levels 0..33. After module34 is completed,
    # the UI/session should remain at level33 rather than inventing level34.
    next_level = min(highest_completed + 1, 33)

    return next_level, completed_level_ids


@router.post("/provision")
def provision_container(
    assignment_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Provision/re-provision the Puzzle Lab runtime and bind it to the current
    academic assignment when one exists.
    """

    enabled_lab = (
        db.query(Lab)
        .filter(
            Lab.id.in_(TECHCORP_LAB_IDS),
            Lab.status == "ACTIVE",
        )
        .first()
    )
    if not enabled_lab:
        raise HTTPException(
            status_code=404,
            detail="Puzzle Lab is not enabled on this platform",
        )

    assignment = _resolve_techcorp_assignment(
        db=db,
        user=current_user,
        requested_assignment_id=assignment_id,
    )
    resolved_assignment_id = assignment.id if assignment else None
    progress_lab_id = _progress_lab_id(assignment)

    required_level, _ = _required_level(
        db=db,
        user_id=current_user.id,
        lab_id=progress_lab_id,
        assignment_id=resolved_assignment_id,
    )

    from app.lab.orchestrator import get_orchestrator
    from app.lab.session_store import save_session

    user_id = str(current_user.id)
    orchestrator = get_orchestrator()

    try:
        result = orchestrator.provision(
            user_id,
            RUNTIME_LAB_ID,
            f"sysadmin_{user_id}",
        )

        ssh_port = result.get("student_port") or result.get("ssh_port")
        if ssh_port is None:
            raise RuntimeError(
                "Puzzle Lab provisioning did not return a student SSH port."
            )

        # Store assignment context with the disposable runtime session as well.
        save_session(
            user_id,
            RUNTIME_LAB_ID,
            {
                **result,
                "last_solved_level": -1,
                "assignment_id": resolved_assignment_id,
            },
        )

        now = datetime.utcnow()

        sess = (
            db.query(TechCorpSession)
            .filter(TechCorpSession.user_id == current_user.id)
            .first()
        )

        container_ref = str(
            result.get("student_container_ref")
            or result.get("container_id")
            or f"student-{current_user.id}-techcorp"
        )
        container_name = str(
            result.get("student_container")
            or result.get("container_name")
            or f"student-{current_user.id}-techcorp"
        )

        if sess is None:
            sess = TechCorpSession(
                user_id=current_user.id,
                container_id=container_ref[:100],
                container_name=container_name[:100],
                ssh_host=str(result.get("student_host") or "127.0.0.1")[:100],
                ssh_port=int(ssh_port),
                current_level=required_level,
                started_at=now,
                last_active_at=now,
                is_active=True,
            )
            db.add(sess)
        else:
            sess.container_id = container_ref[:100]
            sess.container_name = container_name[:100]
            sess.ssh_host = str(result.get("student_host") or sess.ssh_host or "127.0.0.1")[:100]
            sess.ssh_port = int(ssh_port)
            sess.current_level = required_level
            sess.started_at = now
            sess.last_active_at = now
            sess.is_active = True

        db.commit()
        db.refresh(sess)

        return {
            **result,
            "status": "provisioned",
            "ssh_port": int(ssh_port),
            "current_level": sess.current_level,
            "assignment_id": resolved_assignment_id,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error(
            f"[Puzzle] Provision failed for user {current_user.id}: {exc}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Provisioning failed: {exc}",
        )


@router.post("/teardown")
def teardown_container(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop and remove the student's Puzzle Lab runtime."""

    from app.lab.orchestrator import get_orchestrator
    from app.lab.session_store import delete_session

    user_id = str(current_user.id)
    orchestrator = get_orchestrator()

    try:
        orchestrator.teardown(user_id, RUNTIME_LAB_ID)
        delete_session(user_id, RUNTIME_LAB_ID)

        sess = (
            db.query(TechCorpSession)
            .filter(TechCorpSession.user_id == current_user.id)
            .first()
        )
        if sess is not None:
            sess.is_active = False
            sess.last_active_at = datetime.utcnow()
            db.commit()

        return {"status": "torn_down"}

    except Exception as exc:
        db.rollback()
        logger.error(
            f"[Puzzle] Teardown failed for user {current_user.id}: {exc}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Teardown failed: {exc}",
        )


@router.get("/session")
def get_session(
    assignment_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return runtime state plus progress for exactly one assignment/personal scope.
    """

    logger.info(
        f"get_session: Request received for user "
        f"{current_user.id} ({current_user.email})"
    )

    assignment = _resolve_techcorp_assignment(
        db=db,
        user=current_user,
        requested_assignment_id=assignment_id,
    )
    resolved_assignment_id = assignment.id if assignment else None
    progress_lab_id = _progress_lab_id(assignment)

    sess = (
        db.query(TechCorpSession)
        .filter(TechCorpSession.user_id == current_user.id)
        .first()
    )

    if not sess:
        logger.info(
            f"get_session: No session exists for user {current_user.id}"
        )
        return {
            "session_exists": False,
            "assignment_id": resolved_assignment_id,
        }

    # Verify whether the runtime is actually alive.
    mode = os.getenv("ORCHESTRATOR", "docker").lower()

    if sess.is_active:
        if mode == "ecs":
            from app.lab.session_store import get_session as get_redis_session

            redis_sess = get_redis_session(
                str(current_user.id),
                RUNTIME_LAB_ID,
            )
            if not redis_sess:
                sess.is_active = False
                db.commit()
        else:
            try:
                client = docker.from_env()
                container = client.containers.get(sess.container_name)
                if container.status != "running":
                    logger.info(
                        f"get_session: Container {sess.container_name} "
                        f"is status '{container.status}'. Marking inactive."
                    )
                    sess.is_active = False
                    db.commit()
            except Exception as exc:
                logger.info(
                    f"get_session: Container {sess.container_name} unavailable. "
                    f"Marking inactive: {exc}"
                )
                sess.is_active = False
                db.commit()

    required_level, completed_level_ids = _required_level(
        db=db,
        user_id=current_user.id,
        lab_id=progress_lab_id,
        assignment_id=resolved_assignment_id,
    )

    # Exact sync is intentional: when the user moves to a different assignment,
    # an old session level must not leak progress from the previous assignment.
    if sess.current_level != required_level:
        logger.info(
            f"get_session: Syncing session level from "
            f"{sess.current_level} to {required_level} "
            f"for assignment_id={resolved_assignment_id}"
        )
        sess.current_level = required_level
        db.commit()

    password = "starthere"

    if mode != "ecs" and sess.current_level > 0:
        try:
            logger.info(
                f"get_session: Reading password for user "
                f"{current_user.id}, level {sess.current_level}"
            )
            client = docker.from_env()
            container = client.containers.get(sess.container_name)
            exit_code, output = container.exec_run(
                f"cat /opt/validation/level{sess.current_level}.key"
            )
            if exit_code == 0:
                password = output.decode().strip()
        except Exception as exc:
            logger.error(
                f"get_session: Error reading level key: {exc}"
            )

    elapsed = (
        (datetime.utcnow() - sess.started_at).total_seconds()
        if sess.started_at
        else 0
    )
    expires_in = max(0, 10800 - int(elapsed))

    ssh_port = sess.ssh_port

    if mode == "ecs":
        from app.lab.session_store import get_session as get_redis_session

        redis_sess = get_redis_session(
            str(current_user.id),
            RUNTIME_LAB_ID,
        )
        if redis_sess and redis_sess.get("student_port"):
            ssh_port = int(redis_sess["student_port"])

    logger.info(
        f"get_session: user={current_user.id}, active={sess.is_active}, "
        f"level={sess.current_level}, assignment={resolved_assignment_id}, "
        f"port={ssh_port}"
    )

    return {
        "session_exists": True,
        "is_active": sess.is_active,
        "current_level": sess.current_level,
        "ssh_port": ssh_port,
        "username": f"level{sess.current_level}",
        "password": password,
        "completed_levels": completed_level_ids,
        "expires_in": expires_in,
        "assignment_id": resolved_assignment_id,
    }


@router.delete("/provision")
def deprovision_container(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sess = (
        db.query(TechCorpSession)
        .filter(TechCorpSession.user_id == current_user.id)
        .first()
    )

    if sess:
        # Keep legacy local-Docker cleanup behavior, but do not fail if this is
        # an ECS-backed session or the local container is already gone.
        try:
            client = docker.from_env()
            container = client.containers.get(sess.container_name)
            container.stop()
            container.remove()
        except Exception:
            pass

        db.delete(sess)
        db.commit()

    return {"status": "success"}


@router.post("/advance")
def advance_level(
    assignment_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record one solved Puzzle Lab level.

    All progress writes and score awards go through CompletionService, which in
    turn delegates score mutation to ScoreService. No endpoint writes
    users.total_score directly.
    """

    assignment = _resolve_techcorp_assignment(
        db=db,
        user=current_user,
        requested_assignment_id=assignment_id,
    )
    resolved_assignment_id = assignment.id if assignment else None
    progress_lab_id = _progress_lab_id(assignment)

    sess = (
        db.query(TechCorpSession)
        .filter(TechCorpSession.user_id == current_user.id)
        .first()
    )
    if not sess:
        raise HTTPException(
            status_code=400,
            detail="No active session found",
        )

    # Rebuild the expected current level from this assignment only. This prevents
    # a completed Assignment A from advancing Assignment B.
    required_level, _ = _required_level(
        db=db,
        user_id=current_user.id,
        lab_id=progress_lab_id,
        assignment_id=resolved_assignment_id,
    )

    if sess.current_level != required_level:
        logger.info(
            f"[Advance] Syncing session level {sess.current_level} -> "
            f"{required_level} for assignment_id={resolved_assignment_id}"
        )
        sess.current_level = required_level
        db.flush()

    current_lvl = sess.current_level

    # Level 33 is the final playable level; module34 records its completion.
    if current_lvl >= 33:
        mod_id = "puzzle-lab_module34"
        pts = get_points_for_level(33)

        result = CompletionService.complete_lab_module(
            db=db,
            user=current_user,
            lab_id=progress_lab_id,
            module_id=mod_id,
            track_id="techcorp",
            base_points=pts,
            submitted_flag=None,
            assignment_id=resolved_assignment_id,
        )

        sess.current_level = 33
        sess.last_active_at = datetime.utcnow()
        sess.is_active = True
        db.commit()

        return {
            "status": "completed",
            "next_level": 33,
            "username": "level33",
            "password": "",
            "points_awarded": result.points_awarded,
            "total_points": result.new_total_score,
            "assignment_id": resolved_assignment_id,
        }

    next_lvl = current_lvl + 1

    # Validate that the current level was actually solved and obtain the next
    # level credential from the runtime.
    ecs_mode = os.getenv("ORCHESTRATOR", "docker").lower() == "ecs"

    if ecs_mode:
        from app.lab.session_store import get_session as get_redis_session

        redis_sess = get_redis_session(
            str(current_user.id),
            RUNTIME_LAB_ID,
        )
        if not redis_sess or not redis_sess.get("student_host"):
            raise HTTPException(
                status_code=400,
                detail=(
                    "No active ECS session found. Please restart the lab."
                ),
            )

        # New sessions created by this file store assignment_id. A mismatch means
        # the disposable runtime belongs to another academic attempt.
        stored_assignment_id = redis_sess.get("assignment_id")
        if stored_assignment_id is not None:
            stored_assignment_id = int(stored_assignment_id)

        if stored_assignment_id != resolved_assignment_id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This runtime belongs to a different assignment. "
                    "Restart the Puzzle Lab for the current assignment."
                ),
            )

        host = redis_sess["student_host"]
        port = int(redis_sess["student_port"])

        last_solved = int(redis_sess.get("last_solved_level", -1))
        if last_solved < 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No solved level detected yet. Run check_level in your "
                    "terminal first."
                ),
            )

        # The current assignment's DB progress is authoritative. Refuse a stale
        # or out-of-order solved-level marker instead of skipping levels.
        if last_solved != current_lvl:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Runtime solved level {last_solved}, but assignment "
                    f"progress expects level {current_lvl}. Restart the lab "
                    "or reload the session."
                ),
            )

        try:
            import subprocess as _sp

            # Do NOT read /opt/validation/level{N}.key directly here. Those key
            # files are intentionally root:systemd-journal 0640, so the student
            # account cannot cat them over SSH. The old implementation always
            # attempted the read as level0:starthere, which makes ECS advancement
            # fail immediately after the browser has already observed
            # "Level 0 solved!".
            #
            # Each level user is granted password-less sudo for exactly its own
            # validation script. Re-run that trusted validator server-side: it
            # both proves the current level is solved and returns the next-level
            # credential without exposing arbitrary validation keys to students.
            ssh_user = str(redis_sess.get("ssh_user") or f"level{current_lvl}")
            ssh_pass = str(
                redis_sess.get("ssh_pass")
                or ("starthere" if current_lvl == 0 else "")
            )

            if not ssh_pass:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Current level SSH credential is missing from the runtime. "
                        "Restart the Puzzle Lab and try again."
                    ),
                )

            validation_cmd = (
                f"sudo /opt/validation/validate_level_{current_lvl}.sh"
            )
            ssh_result = _sp.run(
                [
                    "sshpass",
                    "-p",
                    ssh_pass,
                    "ssh",
                    "-o",
                    "StrictHostKeyChecking=no",
                    "-o",
                    "UserKnownHostsFile=/dev/null",
                    "-o",
                    "ConnectTimeout=5",
                    "-p",
                    str(port),
                    f"{ssh_user}@{host}",
                    validation_cmd,
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            validator_output = ssh_result.stdout.strip()

            logger.info(
                f"[Advance] ECS validation for user {current_user.id}, "
                f"level={current_lvl}, assignment={resolved_assignment_id}, "
                f"returncode={ssh_result.returncode}, "
                f"stderr='{ssh_result.stderr.strip()}'"
            )

            if ssh_result.returncode != 0 or not validator_output:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Level validation failed. Run check_level in your terminal "
                        "first, then click Advance."
                    ),
                )

            # Validators 0-32 emit the next password as their final non-empty
            # stdout line. Taking only that line avoids carrying incidental
            # command output into the SSH credential.
            next_password = validator_output.splitlines()[-1].strip()

        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to read level key via SSH: {exc}",
            )

    else:
        client = docker.from_env()
        container_name = sess.container_name or f"student-{current_user.id}-techcorp"

        try:
            container = client.containers.get(container_name)
            if container.status != "running":
                container.start()

            exit_code, output = container.exec_run(
                f"cat /opt/validation/level{next_lvl}.key"
            )
            if exit_code != 0:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Next level key not available. Make sure you solved "
                        "the current level."
                    ),
                )

            next_password = output.decode().strip()

        except HTTPException:
            raise
        except docker.errors.NotFound:
            raise HTTPException(
                status_code=500,
                detail="Docker container not found. Restart the lab.",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to read next level key: {exc}",
            )

    # Record completion of the level the student just solved.
    mod_id = f"puzzle-lab_module{current_lvl + 1}"
    pts = get_points_for_level(current_lvl)

    result = CompletionService.complete_lab_module(
        db=db,
        user=current_user,
        lab_id=progress_lab_id,
        module_id=mod_id,
        track_id="techcorp",
        base_points=pts,
        submitted_flag=None,
        assignment_id=resolved_assignment_id,
    )

    sess.current_level = next_lvl
    sess.last_active_at = datetime.utcnow()
    sess.is_active = True

    db.commit()

    # In ECS mode, persist the new SSH credentials so the WebSocket reconnects
    # as the correct level user.
    if ecs_mode:
        try:
            from app.lab.session_store import (
                get_session as get_redis_session,
                save_session as save_redis_session,
            )

            redis_sess = get_redis_session(
                str(current_user.id),
                RUNTIME_LAB_ID,
            )
            if redis_sess:
                redis_sess["ssh_user"] = f"level{next_lvl}"
                redis_sess["ssh_pass"] = next_password
                redis_sess["last_solved_level"] = -1
                redis_sess["assignment_id"] = resolved_assignment_id

                save_redis_session(
                    str(current_user.id),
                    RUNTIME_LAB_ID,
                    redis_sess,
                )

                logger.info(
                    f"[Advance] Updated Redis ssh_user=level{next_lvl} "
                    f"for user {current_user.id}, "
                    f"assignment={resolved_assignment_id}"
                )

        except Exception as exc:
            logger.warning(
                f"[Advance] Failed to update Redis SSH credentials: {exc}"
            )

    return {
        "status": "success",
        "next_level": next_lvl,
        "username": f"level{next_lvl}",
        "password": next_password,
        "points_awarded": result.points_awarded,
        "total_points": result.new_total_score,
        "assignment_id": resolved_assignment_id,
    }


@router.get("/containers")
def list_containers(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    sessions = db.query(TechCorpSession).filter(TechCorpSession.is_active == True).all()
    client = docker.from_env()
    results = []
    for s in sessions:
        user = db.query(User).filter(User.id == s.user_id).first()
        username = user.name if user else f"User {s.user_id}"
        email = user.email if user else ""
        
        cpu_pct = 0.1
        mem_usage = 12.5
        uptime = "Stopped"
        try:
            container = client.containers.get(s.container_name)
            state = container.attrs.get("State", {})
            started_at_str = state.get("StartedAt", "")[:19]
            if started_at_str:
                started_dt = datetime.fromisoformat(started_at_str)
                delta = datetime.utcnow() - started_dt
                hours, remainder = divmod(int(delta.total_seconds()), 3600)
                minutes, _ = divmod(remainder, 60)
                uptime = f"{hours}h {minutes}m"
            else:
                uptime = "Stopped"
        except Exception:
            uptime = "Disconnected"
            
        results.append({
            "student_id": s.user_id,
            "student_name": username,
            "student_email": email,
            "current_level": s.current_level,
            "ssh_port": s.ssh_port,
            "uptime": uptime,
            "cpu": f"{cpu_pct}%",
            "memory": f"{mem_usage} MB",
            "status": "RUNNING" if s.is_active else "IDLE"
        })
    return results

@router.delete("/containers/{student_id}")
def admin_stop_container(student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    sess = db.query(TechCorpSession).filter(
        TechCorpSession.user_id == student_id
    ).first()
    if sess:
        client = docker.from_env()
        try:
            container = client.containers.get(sess.container_name)
            container.stop()
            container.remove()
        except Exception:
            pass
        db.delete(sess)
        db.commit()
    return {"status": "success"}

@router.websocket("/terminal")
async def techcorp_terminal(websocket: WebSocket, token: str = None, db: Session = Depends(get_db)):
    await websocket.accept()
    
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token required")
        return
        
    from app.core.security import decode_access_token
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return
        
    username = payload.get("sub")
    from app.repository.user import user_repository
    user = user_repository.get_by_email(db, username)
    if not user:
        user = user_repository.get_by_name(db, username)
    if not user or not user.is_active:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User not found")
        return
        
    sess = db.query(TechCorpSession).filter(
        TechCorpSession.user_id == user.id,
        TechCorpSession.is_active == True
    ).first()
    
    from app.api.v1.endpoints.terminal_api import _bridge_ssh_to_websocket

    if os.getenv("ORCHESTRATOR", "docker").lower() == "ecs":
        from app.lab.session_store import get_session as get_redis_session
        redis_sess = get_redis_session(str(user.id), "puzzle-lab")
        host = redis_sess.get("student_host") if redis_sess else None
        port = int(redis_sess.get("student_port")) if (redis_sess and redis_sess.get("student_port")) else (sess.ssh_port if sess else 2225)

        # Use stored credentials from Redis (updated by /advance), defaulting to level0:starthere
        ssh_user = redis_sess.get("ssh_user", "level0") if redis_sess else "level0"
        ssh_pass = redis_sess.get("ssh_pass", "starthere") if redis_sess else "starthere"

        if host and port:
            logger.info(f"[TechCorp WS] Connecting to ECS SSH {ssh_user}@{host}:{port}")
            await _bridge_ssh_to_websocket(
                websocket=websocket,
                host=host,
                port=port,
                username=ssh_user,
                password=ssh_pass,
                user_id=str(user.id),
                lab_id="puzzle-lab",
            )
            return

    if not sess:
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="No active session found")
        return
        
    container_port = sess.ssh_port
    ssh_user = f"level{sess.current_level}"
    
    ssh_password = "starthere"
    if sess.current_level > 0:
        try:
            client = docker.from_env()
            container = client.containers.get(sess.container_name)
            exit_code, output = container.exec_run(f"cat /opt/validation/level{sess.current_level}.key")
            if exit_code == 0:
                ssh_password = output.decode().strip()
        except Exception:
            pass
            
    # Connect via SSH, retrying up to 6 times with 1.5s delay to allow container service initialization
    conn = None
    for attempt in range(6):
        try:
            logger.info(f"SSH connect attempt {attempt + 1} to port {container_port}...")
            conn = await asyncssh.connect(
                '127.0.0.1',
                port=container_port,
                username=ssh_user,
                password=ssh_password,
                known_hosts=None,
                encoding=None
            )
            logger.info("SSH connection established successfully!")
            break
        except Exception as e:
            if attempt == 5:
                logger.error(f"SSH connection failed after max retries: {str(e)}")
                raise e
            logger.info(f"SSH connect attempt {attempt + 1} failed: {str(e)}. Retrying in 1.5s...")
            await asyncio.sleep(1.5)

    try:
        async with conn:
            async with conn.create_process(
                term_type='xterm-256color',
                term_size=(80, 24)
            ) as process:
                
                async def read_from_ssh(proc, ws):
                    buffer = ""
                    try:
                        while True:
                            data = await proc.stdout.read(4096)
                            if not data:
                                break
                            text = data.decode('utf-8', errors='ignore')
                            await ws.send_text(text)
                            
                            buffer += text
                            if len(buffer) > 10000:
                                buffer = buffer[-5000:]
                            
                            match = re.search(r"✓\s*Level\s+(\d+)\s+solved!", buffer)
                            if match:
                                solved_level = int(match.group(1))
                                await ws.send_json({
                                    "type": "level_complete",
                                    "level": solved_level
                                })
                                buffer = ""
                    except Exception:
                        pass
                        
                last_active_update_ts = 0.0

                async def read_from_websocket(proc, ws, db_sess, user_id):
                    nonlocal last_active_update_ts
                    try:
                        async for message in ws.iter_text():
                            if message.startswith('{'):
                                try:
                                    payload = json.loads(message)
                                    if payload.get("type") == "resize":
                                        cols = payload.get("cols", 80)
                                        rows = payload.get("rows", 24)
                                        proc.change_terminal_size(cols, rows)
                                        continue
                                except Exception:
                                    pass
                            
                            proc.stdin.write(message.encode('utf-8'))
                            
                            # Throttle DB activity update to once per 30 seconds to prevent keystroke latency
                            now_ts = datetime.utcnow().timestamp()
                            if now_ts - last_active_update_ts > 30.0:
                                last_active_update_ts = now_ts
                                try:
                                    db_sess.query(TechCorpSession).filter(
                                        TechCorpSession.user_id == user_id,
                                        TechCorpSession.is_active == True
                                    ).update({TechCorpSession.last_active_at: datetime.utcnow()})
                                    db_sess.commit()
                                except Exception:
                                    pass
                    except Exception:
                        pass
                        
                await asyncio.gather(
                    read_from_ssh(process, websocket),
                    read_from_websocket(process, websocket, db, user.id),
                    return_exceptions=True
                )
    except Exception as e:
        await websocket.send_text(f"\r\n[Error: Connection failed: {str(e)}]\r\n")
        await websocket.close()
