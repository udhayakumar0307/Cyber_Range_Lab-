import os
import re
import sys
import json
import struct
import asyncio
import logging
import platform
import subprocess
import threading
import time
import shlex
import signal
import select
import uuid
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status

logger = logging.getLogger(__name__)

router = APIRouter()

IS_WINDOWS = platform.system() == "Windows"

import shutil
DOCKER_BIN = shutil.which("docker") or "/usr/bin/docker"

# Platform-specific conditional imports for Linux / Unix / macOS
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


# ---------------------------------------------------------------------------
# Puzzle container constants
# ---------------------------------------------------------------------------
PUZZLE_IMAGE = "techcorp-sysadmin-labs:latest"
PUZZLE_NETWORK = "techcorp-labs"

# ---------------------------------------------------------------------------
# Recon lab import (lazy to avoid circular imports at module load time)
# ---------------------------------------------------------------------------
def _get_recon_student_container(user_id: str) -> str:
    from app.api.v1.endpoints.recon_api import get_student_container_name
    return get_student_container_name(user_id)


async def _bridge_ssh_to_websocket(
    websocket: WebSocket,
    host: str,
    port: int,
    username: str = "root",
    password: str = "root",
    user_id: str = None,
    lab_id: str = None,
):
    """
    Bridge a WebSocket connection to a real SSH PTY session.

    The local ssh client runs inside a pseudo-terminal so browser resize
    events can be applied with TIOCSWINSZ. OpenSSH then propagates the
    resulting window change to the remote PTY.
    """
    import asyncio
    import fcntl
    import pty
    import signal
    import struct
    import termios

    logger.info(f"[SSH WS Bridge] Connecting to SSH {username}@{host}:{port}")

    # Wait for sshd to be ready (entrypoint.sh may still be initializing).
    for attempt in range(15):
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=3.0
            )
            writer.close()
            await writer.wait_closed()
            logger.info(
                f"[SSH WS Bridge] Port {port} is ready "
                f"(attempt {attempt + 1})"
            )
            break
        except Exception:
            if attempt == 14:
                logger.error(
                    f"[SSH WS Bridge] Port {port} never became ready "
                    "after 15 attempts"
                )
                await websocket.close()
                return

            logger.info(
                f"[SSH WS Bridge] Port {port} not ready, "
                f"retry {attempt + 1}/15 in 2s..."
            )
            await asyncio.sleep(2)

    pid = None
    master_fd = None

    try:
        cmd = [
            "sshpass", "-p", password,
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "SetEnv=TERM=xterm-256color",
            "-tt",
            "-p", str(port),
            f"{username}@{host}",
        ]

        # ssh must itself have a real local PTY. Merely connecting its
        # stdin/stdout to asyncio pipes cannot propagate terminal window
        # changes to the remote SSH PTY.
        pid, master_fd = pty.fork()

        if pid == 0:
            env = {
                **os.environ,
                "TERM": "xterm-256color",
            }
            os.execvpe(cmd[0], cmd, env)

        # Give the local ssh PTY a sane initial geometry. The frontend sends
        # the actual fitted dimensions immediately after its WebSocket opens.
        winsize = struct.pack("HHHH", 24, 80, 0, 0)
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

        loop = asyncio.get_running_loop()
        output_buffer = ""

        # Preserve the existing remote shell environment setup.
        os.write(
            master_fd,
            b"export TERM=xterm-256color; export FORCE_COLOR=1\n",
        )

        async def ssh_to_ws():
            nonlocal output_buffer

            try:
                while True:
                    data = await loop.run_in_executor(
                        None,
                        os.read,
                        master_fd,
                        4096,
                    )

                    if not data:
                        break

                    await websocket.send_bytes(data)

                    # Preserve the existing level-completion detector used by
                    # the other SSH-backed terminal flows.
                    text = data.decode("utf-8", errors="ignore")
                    output_buffer += text

                    if len(output_buffer) > 10000:
                        output_buffer = output_buffer[-5000:]

                    match = re.search(
                        r"✓\s*Level\s+(\d+)\s+solved!",
                        output_buffer,
                    )

                    if match:
                        solved_level = int(match.group(1))
                        logger.info(
                            "[SSH WS Bridge] Detected level %s solved!",
                            solved_level,
                        )

                        await websocket.send_text(
                            json.dumps({
                                "type": "level_complete",
                                "level": solved_level,
                            })
                        )

                        if user_id and lab_id:
                            try:
                                from app.lab.session_store import (
                                    get_session,
                                    save_session,
                                )

                                redis_sess = get_session(user_id, lab_id)

                                if redis_sess:
                                    redis_sess["last_solved_level"] = solved_level
                                    save_session(
                                        user_id,
                                        lab_id,
                                        redis_sess,
                                    )
                                    logger.info(
                                        "[SSH WS Bridge] Saved "
                                        "last_solved_level=%s to Redis "
                                        "for user=%s",
                                        solved_level,
                                        user_id,
                                    )
                            except Exception as ex:
                                logger.warning(
                                    "[SSH WS Bridge] Failed to save "
                                    "last_solved_level: %s",
                                    ex,
                                )

                        output_buffer = ""

            except Exception as exc:
                logger.debug(
                    "[SSH WS Bridge] PTY read ended: %s",
                    exc,
                )

        async def ws_to_ssh():
            try:
                while True:
                    raw = await websocket.receive_text()

                    # Resize messages are control-plane messages. Apply the
                    # geometry to the LOCAL ssh PTY; OpenSSH translates the
                    # resulting SIGWINCH/window-size change into an SSH
                    # window-change request for the remote PTY.
                    try:
                        payload = json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        payload = None

                    if isinstance(payload, dict):
                        if payload.get("type") == "resize":
                            try:
                                rows = int(payload.get("rows", 24))
                                cols = int(payload.get("cols", 80))
                            except (TypeError, ValueError):
                                rows, cols = 24, 80

                            # Avoid invalid or pathological ioctl dimensions.
                            rows = max(2, min(rows, 1000))
                            cols = max(2, min(cols, 1000))

                            winsize = struct.pack(
                                "HHHH",
                                rows,
                                cols,
                                0,
                                0,
                            )
                            fcntl.ioctl(
                                master_fd,
                                termios.TIOCSWINSZ,
                                winsize,
                            )

                            logger.debug(
                                "[SSH WS Bridge] PTY resized to "
                                "%sx%s",
                                rows,
                                cols,
                            )
                            continue

                        # Support clients that wrap terminal input in a JSON
                        # input event while preserving raw-string clients.
                        if payload.get("type") == "input":
                            data = str(payload.get("data", ""))
                            if data:
                                os.write(
                                    master_fd,
                                    data.encode("utf-8"),
                                )
                            continue

                    os.write(
                        master_fd,
                        raw.encode("utf-8"),
                    )

            except WebSocketDisconnect:
                pass
            except Exception as exc:
                logger.debug(
                    "[SSH WS Bridge] PTY write ended: %s",
                    exc,
                )

        read_task = asyncio.create_task(ssh_to_ws())
        write_task = asyncio.create_task(ws_to_ssh())

        done, pending = await asyncio.wait(
            {read_task, write_task},
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

        await asyncio.gather(
            *pending,
            return_exceptions=True,
        )

    except Exception as exc:
        logger.error(f"[SSH WS Bridge] Failed to bridge SSH: {exc}")

        try:
            await websocket.send_text(
                "\r\n\x1b[1;31m[ERROR] Failed to connect to SSH "
                f"session: {exc}\x1b[0m\r\n"
            )
        except Exception:
            pass

    finally:
        if master_fd is not None:
            try:
                os.close(master_fd)
            except OSError:
                pass

        if pid:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            except OSError:
                pass

            try:
                await asyncio.to_thread(os.waitpid, pid, 0)
            except (ChildProcessError, OSError):
                pass



def _get_running_containers() -> list:
    """Return list of running container names."""
    try:
        cmd = [DOCKER_BIN, "ps", "--format", "{{.Names}}"]
        output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8", errors="ignore")
        return [c.strip() for c in output.splitlines() if c.strip()]
    except Exception as e:
        logger.debug(f"Docker ps error: {e}")
        return []


def _get_all_containers() -> list:
    """Return list of ALL container names (including stopped)."""
    try:
        cmd = [DOCKER_BIN, "ps", "-a", "--format", "{{.Names}}"]
        output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8", errors="ignore")
        return [c.strip() for c in output.splitlines() if c.strip()]
    except Exception as e:
        logger.debug(f"Docker ps -a error: {e}")
        return []


def _image_exists(image: str) -> bool:
    """Check if a Docker image exists locally."""
    try:
        subprocess.check_output(
            [DOCKER_BIN, "image", "inspect", image],
            stderr=subprocess.DEVNULL
        )
        return True
    except Exception:
        return False


def _ensure_puzzle_container(level: int = 0) -> Optional[str]:
    """
    Ensure the puzzle container for the given level is running.

    Logic:
      1. If student<level> is already running -> return it.
      2. If student<level> exists but is stopped -> start it -> return it.
      3. If student<level> does not exist -> create & start it from PUZZLE_IMAGE.
      4. If PUZZLE_IMAGE does not exist -> return None (cannot auto-build).

    NEVER falls back to cll-student, lab2-student, or any other lab container.
    """
    # Try both naming formats: standard student-{level}-techcorp and fallback student{level}
    container_name = f"student-{level}-techcorp"
    alt_container_name = f"student{level}"

    # 1. Already running?
    running = _get_running_containers()
    if container_name in running:
        logger.info(f"[Puzzle] Container '{container_name}' is running.")
        return container_name
    if alt_container_name in running:
        logger.info(f"[Puzzle] Container '{alt_container_name}' is running.")
        return alt_container_name

    # 2. Exists but stopped?
    all_containers = _get_all_containers()
    if container_name in all_containers:
        logger.info(f"[Puzzle] Container '{container_name}' exists but stopped. Starting...")
        try:
            subprocess.check_call(
                [DOCKER_BIN, "start", container_name],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            logger.info(f"[Puzzle] Container '{container_name}' started successfully.")
            return container_name
        except subprocess.CalledProcessError as e:
            logger.error(f"[Puzzle] Failed to start '{container_name}': {e}")
            return None

    if alt_container_name in all_containers:
        logger.info(f"[Puzzle] Container '{alt_container_name}' exists but stopped. Starting...")
        try:
            subprocess.check_call(
                [DOCKER_BIN, "start", alt_container_name],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            logger.info(f"[Puzzle] Container '{alt_container_name}' started successfully.")
            return alt_container_name
        except subprocess.CalledProcessError as e:
            logger.error(f"[Puzzle] Failed to start '{alt_container_name}': {e}")
            return None

    # 3. Does not exist -> create from image
    if not _image_exists(PUZZLE_IMAGE):
        logger.error(f"[Puzzle] Image '{PUZZLE_IMAGE}' not found. Cannot create container.")
        return None

    logger.info(f"[Puzzle] Container '{container_name}' not found. Creating from '{PUZZLE_IMAGE}'...")
    try:
        create_cmd = [
            DOCKER_BIN, "run", "-d",
            "--name", container_name,
            "--hostname", "techcorp-server",
            "-e", f"STUDENT_ID={level}",
            "-e", "TERM=xterm-256color",
            "--restart", "unless-stopped",
            PUZZLE_IMAGE,
            "bash", "-c", "/usr/sbin/sshd; exec tail -f /dev/null"
        ]
        subprocess.check_call(create_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        logger.info(f"[Puzzle] Container '{container_name}' created and started.")
        return container_name
    except subprocess.CalledProcessError as e:
        logger.error(f"[Puzzle] Failed to create '{container_name}': {e}")
        return None


@router.websocket("/ws/{lab_id}")
@router.websocket("/ws")
async def terminal_websocket(
    websocket: WebSocket,
    lab_id: str = "puzzle-lab",
    level: int = 0,
    token: Optional[str] = Query(default=None),
):
    """
    Real Interactive Terminal WebSocket Endpoint.
    Bridges browser xterm.js to a real Linux PTY / bash session inside Docker container or sandbox.
    Supports real-time bidirectional streaming, stdin forwarding, and terminal resize events.

    Routes:
      - lab1-recon  → per-user ephemeral student container (JWT auth required)
      - puzzle-lab  → shared puzzle container (level-based, no auth)
    """
    client_ip = websocket.client.host if websocket.client else "unknown"
    logger.info(f"[WS] WebSocket request received | client_ip={client_ip} | lab_id={lab_id} | level={level}")
    await websocket.accept()
    logger.info(f"[WS] WebSocket Accepted | client_ip={client_ip}")

    # =========================================================================
    # Task 2: lab1-recon & command-line-lab branch — JWT auth + per-user container bridge
    # =========================================================================
    if lab_id in ("lab1-recon", "command-line-lab", "cryptography-lab"):
        # Authenticate via JWT token passed as query param
        if not token:
            await websocket.send_text(
                f"\r\n\x1b[1;31m[ERROR] Authentication token required for {lab_id}.\x1b[0m\r\n"
                "\x1b[33mPlease reload the lab page to obtain a fresh session token.\x1b[0m\r\n\r\n"
            )
            await websocket.close(code=1008, reason="Token required")
            return

        try:
            from app.core.security import decode_access_token
            payload = decode_access_token(token)
            if not payload:
                raise ValueError("Invalid token payload")
            user_id = payload.get("user_id") or payload.get("sub")
            if not user_id:
                raise ValueError("Token missing user_id")
        except Exception as auth_err:
            logger.warning(f"[{lab_id} WS] Auth failed from {client_ip}: {auth_err}")
            await websocket.send_text(
                "\r\n\x1b[1;31m[ERROR] Invalid or expired session token.\x1b[0m\r\n"
                "\x1b[33mPlease log in again and reload the lab.\x1b[0m\r\n\r\n"
            )
            await websocket.close(code=1008, reason="Invalid token")
            return

        # Check orchestrator mode
        orchestrator_mode = os.getenv("ORCHESTRATOR", "docker").lower()
        if orchestrator_mode == "ecs":
            from app.lab.session_store import get_session
            session = get_session(str(user_id), lab_id)
            if not session:
                await websocket.send_text(
                    f"\r\n\x1b[1;31m[ERROR] Your {lab_id} environment is not running.\x1b[0m\r\n"
                    "\x1b[33mClick \"Start Lab\" on the lab page to provision your environment first.\x1b[0m\r\n\r\n"
                )
                await websocket.close(code=1011, reason=f"{lab_id} container not provisioned")
                return

            await _bridge_ssh_to_websocket(
                websocket=websocket,
                host=session["student_host"],
                port=int(session.get("ws_port") or session.get("student_port") or 2222),
                username="student",
                password="student",
                user_id=str(user_id),
                lab_id=lab_id,
            )
            return

        # 2.2 Resolve the user-specific student container (Task 2.2 - Local Docker Mode)
        container_name = _get_recon_student_container(str(user_id))
        logger.info(f"[Recon WS] user_id={user_id} | container={container_name}")

        running = _get_running_containers()
        if container_name not in running:
            await websocket.send_text(
                "\r\n\x1b[1;31m[ERROR] Your Recon Lab environment is not running.\x1b[0m\r\n"
                "\x1b[33mClick \"Start Lab\" on the lab page to provision your environment first.\x1b[0m\r\n\r\n"
            )
            await websocket.close(code=1011, reason="Recon container not provisioned")
            return

        # 2.3 Bridge WebSocket to real PTY inside the student container (Task 2.3)
        proc = None
        master_fd = None
        try:
            if not IS_WINDOWS and pty is not None:
                exec_cmd = [
                    DOCKER_BIN, "exec", "-it",
                    "-e", "TERM=xterm-256color",
                    container_name, "/bin/bash", "-l",
                ]
                pid, master_fd = pty.fork()
                if pid == 0:
                    os.execvp(exec_cmd[0], exec_cmd)  # child: become docker exec
                else:
                    # Parent: set initial terminal window size
                    if fcntl and termios:
                        try:
                            winsize = struct.pack("HHHH", 32, 120, 0, 0)
                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                        except Exception:
                            pass

                    loop = asyncio.get_event_loop()

                    async def recon_read_pty():
                        while True:
                            try:
                                data = await loop.run_in_executor(None, os.read, master_fd, 4096)
                                if not data:
                                    break
                                await websocket.send_bytes(data)
                            except Exception:
                                break

                    async def recon_write_pty():
                        while True:
                            try:
                                raw = await websocket.receive_text()
                                try:
                                    msg = json.loads(raw)
                                    if isinstance(msg, dict):
                                        if msg.get("type") == "resize":
                                            rows = msg.get("rows", 32)
                                            cols = msg.get("cols", 120)
                                            if fcntl and termios:
                                                wsz = struct.pack("HHHH", rows, cols, 0, 0)
                                                fcntl.ioctl(master_fd, termios.TIOCSWINSZ, wsz)
                                        elif msg.get("type") == "input":
                                            os.write(master_fd, msg.get("data", "").encode("utf-8"))
                                    else:
                                        os.write(master_fd, raw.encode("utf-8"))
                                except (json.JSONDecodeError, TypeError, AttributeError):
                                    os.write(master_fd, raw.encode("utf-8"))
                            except WebSocketDisconnect:
                                break
                            except Exception as e:
                                logger.debug(f"[Recon WS] Write error: {e}")
                                break

                    await asyncio.gather(recon_read_pty(), recon_write_pty())
            else:
                # Windows / no-PTY fallback: subprocess pipe (no resize support)
                exec_cmd = [
                    DOCKER_BIN, "exec", "-i",
                    "-e", "TERM=xterm-256color",
                    container_name, "/bin/bash", "-l",
                ]
                proc = await asyncio.create_subprocess_exec(
                    *exec_cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                )

                async def recon_read_proc():
                    while True:
                        try:
                            data = await proc.stdout.read(4096)
                            if not data:
                                break
                            await websocket.send_bytes(data)
                        except Exception:
                            break

                async def recon_write_proc():
                    while True:
                        try:
                            raw = await websocket.receive_text()
                            try:
                                msg = json.loads(raw)
                                if isinstance(msg, dict) and msg.get("type") == "input" and proc.stdin:
                                    proc.stdin.write(msg.get("data", "").encode("utf-8"))
                                else:
                                    if proc.stdin:
                                        proc.stdin.write(raw.encode("utf-8"))
                            except (json.JSONDecodeError, TypeError, AttributeError):
                                if proc.stdin:
                                    proc.stdin.write(raw.encode("utf-8"))
                        except WebSocketDisconnect:
                            break
                        except Exception as e:
                            logger.debug(f"[Recon WS] Win write error: {e}")
                            break

                await asyncio.gather(recon_read_proc(), recon_write_proc())

        except WebSocketDisconnect:
            logger.info(f"[Recon WS] Disconnected | user_id={user_id}")
        except Exception as exc:
            logger.error(f"[Recon WS] Exception | user_id={user_id}: {exc}")
        finally:
            if proc:
                try:
                    proc.terminate()
                    await asyncio.wait_for(proc.wait(), timeout=1.0)
                except Exception:
                    pass
            if master_fd is not None:
                try:
                    os.close(master_fd)
                except Exception:
                    pass
        return  # done — do not fall through to puzzle logic

    # =========================================================================
    # Puzzle-lab / TechCorp SysAdmin Labs path
    # =========================================================================

    orchestrator_mode = os.getenv("ORCHESTRATOR", "docker").lower()
    if orchestrator_mode == "ecs":
        from app.lab.session_store import get_session
        user_id_str = "default"
        if token:
            try:
                from app.core.security import decode_access_token
                payload = decode_access_token(token)
                if payload:
                    user_id_str = str(payload.get("user_id") or payload.get("sub") or "default")
            except Exception:
                pass

        session = get_session(user_id_str, "puzzle-lab")
        if session:
            puzzle_user = f"level{level}" if level is not None else "level0"
            logger.info(f"[Puzzle WS] Connecting to SSH {puzzle_user}@{session['student_host']}:{session['student_port']}")
            await _bridge_ssh_to_websocket(
                websocket=websocket,
                host=session["student_host"],
                port=int(session["student_port"]),
                username=puzzle_user,
                password="starthere",
            )
            return

    container_name = _ensure_puzzle_container(level)
    logger.info(f"[WS] Terminal WS Session Active | lab_id={lab_id} | level={level} | container={container_name}")

    if not container_name:
        error_msg = (
            "\r\n\x1b[1;31m[ERROR] Puzzle container could not be started.\x1b[0m\r\n"
            f"\x1b[33mContainer 'student{level}' is not available.\x1b[0m\r\n"
            f"\x1b[33mEnsure the Docker image '{PUZZLE_IMAGE}' is built:\x1b[0m\r\n"
            "\x1b[36m  cd labs/techcorp-labs && docker build -t techcorp-sysadmin-labs .\x1b[0m\r\n\r\n"
        )
        await websocket.send_text(error_msg)
        await websocket.close(code=1011, reason="Puzzle container unavailable")
        return

    proc = None
    master_fd = None

    try:
        if not IS_WINDOWS and pty is not None:
            # Linux / macOS / Docker Native PTY Execution
            exec_cmd = [
                DOCKER_BIN, "exec", "-it",
                "-e", "TERM=xterm-256color",
                container_name, "/bin/bash", "-l"
            ]

            pid, master_fd = pty.fork()
            if pid == 0:
                # Child process
                os.execvp(exec_cmd[0], exec_cmd)
            else:
                # Parent process
                # Set initial window size
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
                    while True:
                        try:
                            raw_text = await websocket.receive_text()
                            try:
                                payload = json.loads(raw_text)
                                if isinstance(payload, dict):
                                    if payload.get("type") == "resize":
                                        rows = payload.get("rows", 32)
                                        cols = payload.get("cols", 120)
                                        if fcntl and termios:
                                            wsz = struct.pack("HHHH", rows, cols, 0, 0)
                                            fcntl.ioctl(master_fd, termios.TIOCSWINSZ, wsz)
                                    elif payload.get("type") == "input":
                                        os.write(master_fd, payload.get("data", "").encode("utf-8"))
                                else:
                                    os.write(master_fd, raw_text.encode("utf-8"))
                            except (json.JSONDecodeError, TypeError, AttributeError):
                                os.write(master_fd, raw_text.encode("utf-8"))
                        except WebSocketDisconnect:
                            break
                        except Exception as e:
                            logger.debug(f"Write error: {e}")
                            break

                await asyncio.gather(read_pty(), write_pty())

            user_name = f"level{level}"
            cmd = [DOCKER_BIN, "exec", "-i", "-u", user_name, "-e", "TERM=xterm-256color", container_name, "bash", "-l"]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )

            async def read_windows_proc():
                while True:
                    try:
                        data = await proc.stdout.read(4096)
                        if not data:
                            break
                        await websocket.send_bytes(data)
                    except Exception as e:
                        logger.debug(f"Windows proc read error: {e}")
                        break

            async def write_windows_proc():
                while True:
                    try:
                        raw_text = await websocket.receive_text()
                        data_to_write = None
                        try:
                            payload = json.loads(raw_text)
                            if isinstance(payload, dict):
                                if payload.get("type") == "input":
                                    data_to_write = payload.get("data", "")
                                elif payload.get("type") == "resize":
                                    pass
                            else:
                                data_to_write = raw_text
                        except (json.JSONDecodeError, TypeError, AttributeError):
                            data_to_write = raw_text

                        if data_to_write and proc.stdin:
                            proc.stdin.write(data_to_write.encode("utf-8"))
                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        logger.debug(f"Windows proc write error: {e}")
                        break

            # Send authentic TechCorp Ubuntu 22.04 LTS login banner & prompt
            banner = (
                f"\r\nWelcome to Ubuntu 22.04.5 LTS (GNU/Linux 6.6.87.2-microsoft-standard-WSL2 x86_64)\r\n\r\n"
                f" * Documentation:  https://help.ubuntu.com\r\n"
                f" * Management:     https://landscape.canonical.com\r\n"
                f" * Support:        https://ubuntu.com/pro\r\n\r\n"
                f"This system has been minimized by removing packages and content that are\r\n"
                f"not required on a system that users do not log into.\r\n\r\n"
                f"To restore this content, you can run the 'unminimize' command.\r\n\r\n"
                f"\x1b[1;32m{user_name}@techcorp-server\x1b[0m:\x1b[1;34m~\x1b[0m$ "
            )
            await websocket.send_text(banner)

            await asyncio.gather(read_windows_proc(), write_windows_proc())

    except WebSocketDisconnect:
        logger.info(f"Terminal WS Disconnected | lab_id={lab_id}")
    except Exception as e:
        logger.error(f"Terminal WS Exception: {e}")
    finally:
        if proc:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=1.0)
            except Exception:
                pass
        if master_fd is not None:
            try:
                os.close(master_fd)
            except Exception:
                pass
