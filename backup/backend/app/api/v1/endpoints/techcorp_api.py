import logging
import asyncio
import json
import re
import socket
from datetime import datetime
from typing import List, Dict, Any
import docker
import asyncssh

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_admin_user
from app.models.user import User
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user_lab_progress import UserLabProgress
from app.models.techcorp_session import TechCorpSession

logger = logging.getLogger(__name__)
router = APIRouter()

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
    # Query all active ports from db
    active_ports = {p[0] for p in db.query(TechCorpSession.ssh_port).all()}
    while port in active_ports:
        port += 1
        
    # Double check if port is in use on the host
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                if port not in active_ports:
                    break
            port += 1
    return port

@router.post("/provision")
def provision_container(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lab = db.query(Lab).filter(Lab.id.in_(["puzzle-lab", "techcorp-sysadmin-labs"]), Lab.status == "ACTIVE").first()
    if not lab:
        raise HTTPException(status_code=404, detail="Puzzle Lab is not enabled on this platform")

    from app.lab.orchestrator import get_orchestrator
    from app.lab.session_store import save_session

    user_id = str(current_user.id)
    lab_id = "puzzle-lab"
    orchestrator = get_orchestrator()

    try:
        result = orchestrator.provision(user_id, lab_id, f"sysadmin_{user_id}")
        save_session(user_id, lab_id, result)
        return {"status": "provisioned", **result}
    except Exception as exc:
        logger.error(f"[Puzzle] Provision failed for user {current_user.id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Provisioning failed: {exc}")
    container_name = f"student-{current_user.id}-techcorp"
    
    # Determine highest completed level to sync session level
    completed_levels = db.query(UserLabProgress.module_id).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.lab_id == "puzzle-lab",
        UserLabProgress.status == "COMPLETED"
    ).all()
    completed_nums = []
    for c in completed_levels:
        m_id = c[0]
        if m_id.startswith("puzzle-lab_module"):
            try:
                completed_nums.append(int(m_id.replace("puzzle-lab_module", "")) - 1)
            except ValueError:
                pass
        elif m_id.startswith("techcorp_level"):
            try:
                completed_nums.append(int(m_id.replace("techcorp_level", "")))
            except ValueError:
                pass
    highest_completed = max(completed_nums) if completed_nums else -1
    required_level = highest_completed + 1

    sess = db.query(TechCorpSession).filter(
        TechCorpSession.user_id == current_user.id
    ).first()

    if sess:
        if sess.current_level < required_level:
            logger.info(f"provision_container: Auto-healing session level from {sess.current_level} to {required_level}")
            sess.current_level = required_level
            db.commit()
        try:
            container = client.containers.get(container_name)
            if container.status != "running":
                container.start()
            sess.is_active = True
            sess.last_active_at = datetime.utcnow()
            db.commit()
            db.refresh(sess)
        except docker.errors.NotFound:
            # Recreate container on same port
            try:
                container = client.containers.run(
                    image="techcorp-sysadmin-labs:latest",
                    name=container_name,
                    hostname="techcorp-server",
                    ports={"2222/tcp": sess.ssh_port},
                    cap_add=["SYS_ADMIN"],
                    environment={"STUDENT_ID": str(current_user.id)},
                    restart_policy={"Name": "unless-stopped"},
                    detach=True
                )
                sess.container_id = container.id
                sess.is_active = True
                sess.last_active_at = datetime.utcnow()
                db.commit()
                db.refresh(sess)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to start container: {str(e)}")
    else:
        ssh_port = find_free_port(db)
        try:
            container = client.containers.run(
                image="techcorp-sysadmin-labs:latest",
                name=container_name,
                hostname="techcorp-server",
                ports={"2222/tcp": ssh_port},
                cap_add=["SYS_ADMIN"],
                environment={"STUDENT_ID": str(current_user.id)},
                restart_policy={"Name": "unless-stopped"},
                detach=True
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to provision container: {str(e)}")
            
        sess = TechCorpSession(
            user_id=current_user.id,
            container_id=container.id,
            container_name=container_name,
            ssh_host="127.0.0.1",
            ssh_port=ssh_port,
            current_level=required_level,
            started_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
            is_active=True
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

    # Read password
    logger.info(f"provision_container: Reading password for user {current_user.id}, level {sess.current_level}")
    password = "starthere"
    if sess.current_level > 0:
        try:
            client = docker.from_env()
            container = client.containers.get(container_name)
            exit_code, output = container.exec_run(f"cat /opt/validation/level{sess.current_level}.key")
            if exit_code == 0:
                password = output.decode().strip()
        except Exception as e:
            logger.error(f"provision_container: Error reading level key: {str(e)}")
            pass

    elapsed = (datetime.utcnow() - sess.started_at).total_seconds()
    expires_in = max(0, 10800 - int(elapsed))

    logger.info(f"provision_container: Successfully provisioned for user {current_user.id} on port {sess.ssh_port}")
    return {
        "container_id": sess.container_id,
        "ssh_host": "127.0.0.1",
        "ssh_port": sess.ssh_port,
        "current_level": sess.current_level,
        "username": f"level{sess.current_level}",
        "password": password,
        "expires_in": expires_in
    }

@router.get("/session")
def get_session(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logger.info(f"get_session: Request received for user {current_user.id} ({current_user.email})")
    sess = db.query(TechCorpSession).filter(
        TechCorpSession.user_id == current_user.id
    ).first()
    if not sess:
        logger.info(f"get_session: No session exists for user {current_user.id}")
        return {"session_exists": False}

    # Verify if container is actually running on the host
    if sess.is_active:
        try:
            client = docker.from_env()
            container = client.containers.get(sess.container_name)
            if container.status != "running":
                logger.info(f"get_session: Container {sess.container_name} is status '{container.status}'. Syncing status to inactive.")
                sess.is_active = False
                db.commit()
        except Exception as e:
            logger.info(f"get_session: Container {sess.container_name} not found or error. Syncing status to inactive: {str(e)}")
            sess.is_active = False
            db.commit()
        
    completed_levels = db.query(UserLabProgress.module_id).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.lab_id == "puzzle-lab",
        UserLabProgress.status == "COMPLETED"
    ).all()
    
    # Auto-heal / sync session current_level to highest completed level + 1
    completed_nums = []
    completed_level_ids = []
    for c in completed_levels:
        m_id = c[0]
        if m_id.startswith("puzzle-lab_module"):
            try:
                mod_num = int(m_id.replace("puzzle-lab_module", ""))
                completed_nums.append(mod_num - 1)
                completed_level_ids.append(f"techcorp_level{mod_num - 1}")
            except ValueError:
                pass
        elif m_id.startswith("techcorp_level"):
            try:
                completed_nums.append(int(m_id.replace("techcorp_level", "")))
                completed_level_ids.append(m_id)
            except ValueError:
                pass
    highest_completed = max(completed_nums) if completed_nums else -1
    required_level = highest_completed + 1
    
    if sess.current_level < required_level:
        logger.info(f"get_session: Auto-healing session level from {sess.current_level} to {required_level}")
        sess.current_level = required_level
        db.commit()
    
    password = "starthere"
    if sess.current_level > 0:
        try:
            logger.info(f"get_session: Reading password key for user {current_user.id}, level {sess.current_level}")
            client = docker.from_env()
            container = client.containers.get(sess.container_name)
            exit_code, output = container.exec_run(f"cat /opt/validation/level{sess.current_level}.key")
            if exit_code == 0:
                password = output.decode().strip()
        except Exception as e:
            logger.error(f"get_session: Error reading level key: {str(e)}")
            pass
            
    # Calculate remaining session time based on 3-hour (10800 seconds) limit
    elapsed = (datetime.utcnow() - sess.started_at).total_seconds()
    expires_in = max(0, 10800 - int(elapsed))

    logger.info(f"get_session: Session found for user {current_user.id}. is_active={sess.is_active}, level={sess.current_level}, port={sess.ssh_port}")
    return {
        "session_exists": True,
        "is_active": sess.is_active,
        "current_level": sess.current_level,
        "ssh_port": sess.ssh_port,
        "username": f"level{sess.current_level}",
        "password": password,
        "completed_levels": completed_level_ids,
        "expires_in": expires_in
    }

@router.delete("/provision")
def deprovision_container(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sess = db.query(TechCorpSession).filter(
        TechCorpSession.user_id == current_user.id
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

@router.post("/advance")
def advance_level(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sess = db.query(TechCorpSession).filter(
        TechCorpSession.user_id == current_user.id
    ).first()
    if not sess:
        raise HTTPException(status_code=400, detail="No active session found")
        
    current_lvl = sess.current_level
    
    if current_lvl >= 33:
        mod_id = "puzzle-lab_module34"
        progress = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == "puzzle-lab",
            UserLabProgress.module_id == mod_id
        ).first()
        pts = get_points_for_level(33)
        if not progress:
            progress = UserLabProgress(
                user_id=current_user.id,
                lab_id="puzzle-lab",
                module_id=mod_id,
                status="COMPLETED",
                score=pts,
                attempts=1,
                started_at=sess.started_at,
                completed_at=datetime.utcnow(),
                flag_correct=True
            )
            db.add(progress)
            current_user.total_score += pts
        elif progress.status != "COMPLETED":
            progress.status = "COMPLETED"
            progress.score = pts
            progress.completed_at = datetime.utcnow()
            progress.flag_correct = True
            current_user.total_score += pts
        db.commit()
        
        return {
            "status": "completed",
            "next_level": 33,
            "username": "level33",
            "password": ""
        }
        
    next_lvl = current_lvl + 1
    
    client = docker.from_env()
    container_name = f"student-{current_user.id}-techcorp"
    try:
        container = client.containers.get(container_name)
        if container.status != "running":
            container.start()
        exit_code, output = container.exec_run(f"cat /opt/validation/level{next_lvl}.key")
        if exit_code != 0:
            raise HTTPException(status_code=400, detail="Next level key not available. Make sure you solved the current level.")
        next_password = output.decode().strip()
    except docker.errors.NotFound:
        raise HTTPException(status_code=500, detail="Docker container not found. Restart the lab.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read next level key: {str(e)}")
        
    mod_id = f"puzzle-lab_module{current_lvl + 1}"
    progress = db.query(UserLabProgress).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.lab_id == "puzzle-lab",
        UserLabProgress.module_id == mod_id
    ).first()
    
    pts = get_points_for_level(current_lvl)
    if not progress:
        progress = UserLabProgress(
            user_id=current_user.id,
            lab_id="puzzle-lab",
            module_id=mod_id,
            status="COMPLETED",
            score=pts,
            attempts=1,
            started_at=sess.started_at,
            completed_at=datetime.utcnow(),
            flag_correct=True
        )
        db.add(progress)
        current_user.total_score += pts
    elif progress.status != "COMPLETED":
        progress.status = "COMPLETED"
        progress.score = pts
        progress.completed_at = datetime.utcnow()
        progress.flag_correct = True
        current_user.total_score += pts
        
    sess.current_level = next_lvl
    sess.last_active_at = datetime.utcnow()
    sess.is_active = True
    
    db.commit()
    
    return {
        "status": "success",
        "next_level": next_lvl,
        "username": f"level{next_lvl}",
        "password": next_password
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
