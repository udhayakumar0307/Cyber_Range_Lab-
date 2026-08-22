import hashlib
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.models.lab_module import LabModule
from app.models.user import User
from app.models.user_lab_progress import UserLabProgress
from app.models.user_progress import UserProgress
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

# ── Docker SDK (optional import — gracefully degrades if docker not installed) ─
try:
    import docker as docker_sdk
    _docker_available = True
except ImportError:
    docker_sdk = None
    _docker_available = False

# ── Recon lab Docker constants ────────────────────────────────────────────────
RECON_STUDENT_IMAGE  = "lab1-recon-student:latest"   # built from student-env/Dockerfile
RECON_TARGET_IMAGE   = "lab1-recon-target:latest"    # built from vulnerable-services/Dockerfile
RECON_SUBNET_PREFIX  = "10.10"                        # student subnets: 10.10.<uid_slot>.0/24
RECON_TARGET_IP_LAST = "10"                           # always .10 inside the student subnet

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


# ─────────────────────────────────────────────────────────────────────────────
# Task 1: Docker SDK Container & Network Provisioning Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _recon_names(user_id: str) -> Dict[str, str]:
    """Return consistent Docker resource names for a given user session."""
    uid = str(user_id)
    return {
        "network":  f"lab1-net-{uid}",
        "student":  f"lab1-student-{uid}",
        "target":   f"lab1-target-{uid}",
    }


def _derive_lab_seed(user_id: str) -> str:
    """Derive a deterministic LAB_SEED from the user_id.

    The seed must be stable across provision/teardown cycles so that the flags
    embedded in the target container always match what _generate_recon_flag()
    produces for the same user.
    """
    return hashlib.sha256(f"recon_seed_{user_id}_cyberrange2026".encode()).hexdigest()[:16]


def _ensure_recon_images_exist() -> bool:
    """Check that both lab images are present locally.

    Returns True if both images exist, False otherwise. Building is left to the
    operator — we do not auto-build here to avoid blocking the HTTP request.
    """
    if not _docker_available:
        logger.warning("[Recon] Docker SDK not available — skipping image check.")
        return False
    try:
        client = docker_sdk.from_env()
        client.images.get(RECON_STUDENT_IMAGE)
        client.images.get(RECON_TARGET_IMAGE)
        return True
    except Exception as exc:
        logger.error(f"[Recon] Required Docker image missing: {exc}")
        return False


def provision_recon_session(user_id: str) -> Dict[str, Any]:
    """Provision an isolated Docker network and ephemeral container pair for user.

    Workflow (Task 1.1 – 1.3):
      1. Create a dedicated bridge network ``lab1-net-<user_id>``.
      2. Start the vulnerable-services target container at a fixed IP.
      3. Start the student workspace container on the same network.
      4. Inject STUDENT_ID and deterministic LAB_SEED into both containers.

    Returns a dict with keys ``network``, ``student_container``, ``target_container``
    and ``lab_seed`` on success, or raises RuntimeError on failure.
    """
    if not _docker_available:
        raise RuntimeError("Docker SDK is not installed on this host.")

    names    = _recon_names(user_id)
    lab_seed = _derive_lab_seed(user_id)
    client   = docker_sdk.from_env()

    _teardown_recon_session(user_id, _client=client)
    uid_slot = int(user_id) % 250 if str(user_id).isdigit() else 9
    subnet = f"10.10.{uid_slot}.0/24"
    gateway = f"10.10.{uid_slot}.1"
    target_ip = f"10.10.{uid_slot}.10"
    student_ip = f"10.10.{uid_slot}.2"

    # ── 2. Create isolated bridge network (Task 1.1) ────────────────────────
    logger.info(f"[Recon] Creating network {names['network']} with subnet {subnet}")
    ipam_pool = docker_sdk.types.IPAMPool(
        subnet=subnet,
        gateway=gateway
    )
    ipam_config = docker_sdk.types.IPAMConfig(
        pool_configs=[ipam_pool]
    )
    network = client.networks.create(
        names["network"],
        driver="bridge",
        ipam=ipam_config,
        check_duplicate=True,
        labels={"managed_by": "cyberrange", "lab": LAB_ID, "user_id": str(user_id)},
    )

    # ── 3. Start vulnerable-services target container (Task 1.2 & 1.3) ──────
    logger.info(f"[Recon] Creating target container {names['target']}")
    target = client.containers.create(
        RECON_TARGET_IMAGE,
        name=names["target"],
        hostname="techcorp-internal",
        detach=True,
        cap_add=["NET_ADMIN"],
        environment={
            "STUDENT_ID": str(user_id),   # Task 1.3 — seed injection
            "LAB_SEED":   lab_seed,
            "TERM":       "xterm-256color",
        },
        restart_policy={"Name": "no"},
        labels={"managed_by": "cyberrange", "lab": LAB_ID, "user_id": str(user_id)},
    )
    network.connect(target, ipv4_address=target_ip)
    target.start()
    
    # Give target services (MariaDB, FTP, SSH, Apache) time to initialise
    time.sleep(3)
    # Try configuring IP alias on target eth1 using ip, with ifconfig as a fallback
    res_ip = target.exec_run("ip addr add 10.10.0.10/32 dev eth1")
    res_ifconfig = target.exec_run("ifconfig eth1:0 10.10.0.10 netmask 255.255.255.255 up")
    logger.info(
        f"[Recon] target IP config (ip): exit={res_ip.exit_code} output={res_ip.output.decode('utf-8', errors='ignore').strip()}"
    )
    logger.info(
        f"[Recon] target IP config (ifconfig): exit={res_ifconfig.exit_code} output={res_ifconfig.output.decode('utf-8', errors='ignore').strip()}"
    )

    # ── 4. Start student workspace container (Task 1.2 & 1.3) ───────────────
    logger.info(f"[Recon] Creating student container {names['student']}")
    student = client.containers.create(
        RECON_STUDENT_IMAGE,
        name=names["student"],
        hostname="secureguard-kali",
        detach=True,
        stdin_open=True,
        tty=True,
        cap_add=["NET_ADMIN"],
        environment={
            "STUDENT_ID":  str(user_id),  # Task 1.3 — seed injection
            "LAB_SEED":    lab_seed,
            "TARGET_IP":   "10.10.0.10",  # well-known address within subnet
            "TERM":        "xterm-256color",
        },
        restart_policy={"Name": "no"},
        labels={"managed_by": "cyberrange", "lab": LAB_ID, "user_id": str(user_id)},
    )
    network.connect(student, ipv4_address=student_ip)
    student.start()
    
    # Configure loopback routing - try ip route first, fallback to traditional route command
    res_route = student.exec_run(f"ip route add 10.10.0.10 via {target_ip}")
    res_route_fallback = student.exec_run(f"route add -host 10.10.0.10 gw {target_ip}")
    logger.info(
        f"[Recon] student route config (ip route): exit={res_route.exit_code} output={res_route.output.decode('utf-8', errors='ignore').strip()}"
    )
    logger.info(
        f"[Recon] student route config (route gw): exit={res_route_fallback.exit_code} output={res_route_fallback.output.decode('utf-8', errors='ignore').strip()}"
    )

    logger.info(
        f"[Recon] Session provisioned for user {user_id} | "
        f"network={names['network']} target={names['target']} student={names['student']}"
    )
    return {
        "network":           names["network"],
        "student_container": names["student"],
        "target_container":  names["target"],
        "lab_seed":          lab_seed,
    }


def _teardown_recon_session(user_id: str, _client=None) -> None:
    """Stop and remove all containers and the network for a user session (Task 1.4).

    Idempotent — safe to call even if resources don't exist.
    """
    if not _docker_available:
        return
    names  = _recon_names(user_id)
    client = _client or docker_sdk.from_env()

    for cname in (names["student"], names["target"]):
        try:
            container = client.containers.get(cname)
            container.stop(timeout=5)
            container.remove(force=True)
            logger.info(f"[Recon] Removed container {cname}")
        except docker_sdk.errors.NotFound:
            pass
        except Exception as exc:
            logger.warning(f"[Recon] Could not remove container {cname}: {exc}")

    try:
        net = client.networks.get(names["network"])
        net.remove()
        logger.info(f"[Recon] Removed network {names['network']}")
    except docker_sdk.errors.NotFound:
        pass
    except Exception as exc:
        logger.warning(f"[Recon] Could not remove network {names['network']}: {exc}")


def get_student_container_name(user_id: str) -> str:
    """Return the Docker container name for the student workspace."""
    return _recon_names(user_id)["student"]






@router.post("/provision")
def provision_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Provision a student lab environment using configured orchestrator (Docker or ECS)."""
    from app.lab.orchestrator import get_orchestrator
    from app.lab.session_store import save_session

    user_id = str(current_user.id)
    lab_seed = _derive_lab_seed(user_id)
    orchestrator = get_orchestrator()

    try:
        result = orchestrator.provision(user_id, LAB_ID, lab_seed)
        save_session(user_id, LAB_ID, result)

        # Generate flag audit log for backend scoring verification
        for mid in MODULE_IDS:
            flag = _generate_recon_flag(user_id, mid)[0]
            logger.info(
                f"[RECON-AUDIT] Session Provisioning | User: {user_id} | "
                f"Generated Module {mid} Flag: {flag}"
            )

        return {"status": "provisioned", **result}
    except Exception as exc:
        logger.error(f"[Recon] Provision failed for user {current_user.id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Provisioning failed: {exc}")


@router.post("/teardown")
def teardown_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stop and remove the student lab environment via configured orchestrator."""
    from app.lab.orchestrator import get_orchestrator
    from app.lab.session_store import delete_session

    user_id = str(current_user.id)
    orchestrator = get_orchestrator()

    try:
        orchestrator.teardown(user_id, LAB_ID)
        delete_session(user_id, LAB_ID)
        return {"status": "torn_down"}
    except Exception as exc:
        logger.error(f"[Recon] Teardown failed for user {current_user.id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Teardown failed: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Flag generation (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def _generate_recon_flag(user_id: str, module_id: str) -> List[str]:
    """Generate the canonical flag for a recon lab module.

    This MUST match the gen_flag() function in the target container's entrypoint.sh:
        echo -n "lab{lab}_mod{module}_{student_id}_{lab_seed}" | sha256sum | head -c 8

    Canonical format:  FLAG{techcorp_lab1_mod<N>_<user_id>_<8-hex-digest>}
    e.g.               FLAG{techcorp_lab1_mod1_9_3f7a2b9c}

    The digest is deterministic: SHA-256 of 'lab1_mod{N}_{user_id}_{lab_seed}'
    so the same user always gets the same flag for the same module.
    """
    num = module_id.replace("module", "")  # 'module1' -> '1'
    lab_seed = _derive_lab_seed(user_id)
    seed = f"lab1_mod{num}_{user_id}_{lab_seed}"
    digest = hashlib.sha256(seed.encode()).hexdigest()[:8]
    canonical = f"FLAG{{techcorp_lab1_mod{num}_{user_id}_{digest}}}"
    return [canonical]  # single accepted flag


# ── GET /progress ────────────────────────────────────────────────────────────

@router.get("/progress")
def get_recon_progress(
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Returns per-module progress + flags for the current user."""
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        LAB_ID,
        assignment_id,
    )
    total_score = reconcile_user_score(db, user_id_str) if current_user else 0

    progress_rows = []
    if current_user:
        progress_query = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == TRACK_ID,
        )
        progress_rows = _scope_assignment(
            progress_query,
            UserProgress,
            resolved_assignment_id,
        ).all()

    solved_set = {
        r.module_id
        for r in progress_rows
        if r.completed
    }

    modules_out = []
    for i, module in enumerate(RECON_MODULES):
        mid = module["id"]
        locked = (
            i > 0
            and MODULE_IDS[i - 1] not in solved_set
        )
        completed = mid in solved_set

        real_flag = _generate_recon_flag(
            user_id_str,
            mid,
        )[0]

        if mid == "module5":
            logger.info(
                f"[RECON-AUDIT] Session Provisioning | "
                f"User: {user_id_str} | "
                f"Assignment: {resolved_assignment_id} | "
                f"Generated Module 5 Flag: {real_flag} | "
                f"Target: /root/flag.txt"
            )

        modules_out.append({
            "id": mid,
            "title": module["title"],
            "points": module["points"],
            "locked": locked,
            "completed": completed,
            "flag": real_flag,
        })

    return {
        "user_id": user_id_str,
        "assignment_id": resolved_assignment_id,
        "total_score": total_score,
        "modules": modules_out,
    }


# ── POST /submit ─────────────────────────────────────────────────────────────

@router.post("/submit")
def submit_recon_flag(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Validates a submitted flag and records assignment-scoped progress."""
    user_id_str = str(current_user.id) if current_user else "student"
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        LAB_ID,
        payload.get("assignment_id"),
    )

    module_id = (payload.get("module") or "").strip()
    submitted_flag = (payload.get("flag") or "").strip()

    if module_id not in MODULE_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown module: {module_id}",
        )

    idx = MODULE_IDS.index(module_id)

    if idx > 0:
        prev_mid = MODULE_IDS[idx - 1]
        prev_query = db.query(UserProgress).filter(
            UserProgress.user_id == user_id_str,
            UserProgress.track_id == TRACK_ID,
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
                detail=(
                    "Module is locked. "
                    "Complete the previous module first."
                ),
            )

    record_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == TRACK_ID,
        UserProgress.module_id == module_id,
    )
    record = _scope_assignment(
        record_query,
        UserProgress,
        resolved_assignment_id,
    ).first()

    current_total = reconcile_user_score(
        db,
        user_id_str,
    )

    if record and record.completed:
        next_mid = (
            MODULE_IDS[idx + 1]
            if idx + 1 < len(MODULE_IDS)
            else None
        )
        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total,
            "next_module": next_mid,
            "assignment_id": resolved_assignment_id,
        }

    valid_flags = _generate_recon_flag(
        user_id_str,
        module_id,
    )
    logger.info(
        f"[RECON-AUDIT] Submission Check | "
        f"User: {user_id_str} | "
        f"Assignment: {resolved_assignment_id} | "
        f"Module: {module_id} | "
        f"Submitted: {submitted_flag} | "
        f"Expected: {valid_flags[0]}"
    )

    if submitted_flag not in valid_flags:
        logger.warning(
            f"[RECON-AUDIT] Submission REJECTED | "
            f"User: {user_id_str} | "
            f"Assignment: {resolved_assignment_id} | "
            f"Module: {module_id}"
        )
        return {
            "correct": False,
            "message": "Incorrect flag. Check your terminal output.",
            "assignment_id": resolved_assignment_id,
        }

    logger.info(
        f"[RECON-AUDIT] Submission SUCCESS | "
        f"User: {user_id_str} | "
        f"Assignment: {resolved_assignment_id} | "
        f"Module: {module_id}"
    )

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
            assignment_id=resolved_assignment_id,
        )

    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            f"[RECON] IntegrityError on module {module_id} "
            f"for user {user_id_str}, "
            f"assignment {resolved_assignment_id}: {exc}"
        )

        current_total = reconcile_user_score(
            db,
            user_id_str,
        )
        next_mid = (
            MODULE_IDS[idx + 1]
            if idx + 1 < len(MODULE_IDS)
            else None
        )

        try:
            retry_query = db.query(UserProgress).filter(
                UserProgress.user_id == user_id_str,
                UserProgress.track_id == TRACK_ID,
                UserProgress.module_id == module_id,
            )
            record = _scope_assignment(
                retry_query,
                UserProgress,
                resolved_assignment_id,
            ).first()

            if not record:
                record = UserProgress(
                    assignment_id=resolved_assignment_id,
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

        except Exception as inner_exc:
            db.rollback()
            logger.error(
                f"[RECON] Failed to save user_progress "
                f"for {module_id}: {inner_exc}"
            )

        return {
            "correct": True,
            "message": "Already solved.",
            "points": 0,
            "total_points": current_total,
            "next_module": next_mid,
            "assignment_id": resolved_assignment_id,
        }

    if not record:
        record = UserProgress(
            assignment_id=resolved_assignment_id,
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

    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            f"[RECON] Commit IntegrityError for {module_id}: "
            f"{exc} — retrying user_progress only"
        )

        try:
            retry_query = db.query(UserProgress).filter(
                UserProgress.user_id == user_id_str,
                UserProgress.track_id == TRACK_ID,
                UserProgress.module_id == module_id,
            )
            retry_record = _scope_assignment(
                retry_query,
                UserProgress,
                resolved_assignment_id,
            ).first()

            if not retry_record:
                retry_record = UserProgress(
                    assignment_id=resolved_assignment_id,
                    user_id=user_id_str,
                    track_id=TRACK_ID,
                    module_id=module_id,
                )
                db.add(retry_record)

            retry_record.completed = True
            retry_record.module_score = result.points_awarded
            retry_record.flag_submitted = submitted_flag
            retry_record.completed_at = datetime.utcnow()
            retry_record.updated_at = datetime.utcnow()
            db.commit()

        except Exception as inner_exc:
            db.rollback()
            logger.error(
                f"[RECON] Final commit failed "
                f"for {module_id}: {inner_exc}"
            )

    next_mid = (
        MODULE_IDS[idx + 1]
        if idx + 1 < len(MODULE_IDS)
        else None
    )

    return {
        "correct": True,
        "message": "Correct! Module complete.",
        "points": result.points_awarded,
        "total_points": result.new_total_score,
        "next_module": next_mid,
        "module": module_id,
        "assignment_id": resolved_assignment_id,
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
def request_cll_hint(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Unlock a Recon hint within the current assignment context."""
    user_id_str = str(current_user.id) if current_user else "student"
    module_id = (payload.get("module") or "module1").strip()
    hint_index = int(payload.get("hint_index", 1))

    if module_id not in MODULE_IDS:
        raise HTTPException(
            status_code=400,
            detail="Unknown module.",
        )
    if hint_index not in (1, 2):
        raise HTTPException(
            status_code=400,
            detail="Invalid hint index. Must be 1 or 2.",
        )

    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        LAB_ID,
        payload.get("assignment_id"),
    )

    hints = HINTS.get(module_id, [])
    if len(hints) < hint_index:
        raise HTTPException(
            status_code=404,
            detail="Hint not available.",
        )

    progress_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == TRACK_ID,
        UserProgress.module_id == module_id,
    )
    record = _scope_assignment(
        progress_query,
        UserProgress,
        resolved_assignment_id,
    ).first()

    if not record:
        record = UserProgress(
            assignment_id=resolved_assignment_id,
            user_id=user_id_str,
            track_id=TRACK_ID,
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
            detail="Unlock Hint 1 first before unlocking Hint 2.",
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

    total_score = reconcile_user_score(
        db,
        user_id_str,
    )

    return {
        "success": True,
        "hint": hints[hint_index - 1],
        "hint_index": hint_index,
        "penalty": 0 if already_unlocked else 20,
        "already_unlocked": bool(already_unlocked),
        "total_points": total_score,
        "assignment_id": resolved_assignment_id,
    }


# ── GET /flag (reveal flag after completion) ─────────────────────────────────

@router.get("/flag/{module_id}")
def get_recon_flag(
    module_id: str,
    assignment_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    user_id_str = str(current_user.id)
    resolved_assignment_id = _resolve_assignment_id(
        db,
        current_user,
        LAB_ID,
        assignment_id,
    )

    record_query = db.query(UserProgress).filter(
        UserProgress.user_id == user_id_str,
        UserProgress.track_id == TRACK_ID,
        UserProgress.module_id == module_id,
        UserProgress.completed.is_(True),
    )
    record = _scope_assignment(
        record_query,
        UserProgress,
        resolved_assignment_id,
    ).first()

    if not record:
        raise HTTPException(
            status_code=403,
            detail="Module not yet completed.",
        )

    flag = _generate_recon_flag(
        user_id_str,
        module_id,
    )[0]

    return {
        "flag": flag,
        "module": module_id,
        "assignment_id": resolved_assignment_id,
    }
