#!/usr/bin/env python3
"""
terminal_service.py
Bridges a browser xterm.js WebSocket connection to a real PTY running
`docker exec -it <student-env> bash` as the unprivileged `student` user.

This is the one deliberate enhancement over the teammates' lab1-recon
pattern: instead of the student running `docker exec -it` themselves
from a host shell, the browser gets a live terminal directly. Session
handling, resize, and idle timeout are all managed here; everything a
student types still executes inside the same disposable student-env
container that command_checker.py logs from and progress_service.py
inspects, so grading stays server-authoritative either way.
"""

import os
import fcntl
import json
import pty
import select
import struct
import subprocess
import termios
import asyncio
import time

import websockets

STUDENT_CONTAINER = os.environ.get("STUDENT_CONTAINER", "cll-student")
WS_HOST = os.environ.get("WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("WS_PORT", "8022"))
IDLE_TIMEOUT = int(os.environ.get("IDLE_TIMEOUT_SECONDS", "1800"))


def set_winsize(fd, rows, cols):
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


def spawn_shell():
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(
            "docker",
            [
                "docker", "exec", "-it", "-u", "student",
                "-e", "TERM=xterm-256color",
                STUDENT_CONTAINER, "/bin/bash", "-l",
            ],
        )
    else:
        return pid, fd


async def pty_to_ws(fd, ws, last_activity):
    loop = asyncio.get_event_loop()
    while True:
        try:
            r, _, _ = await loop.run_in_executor(None, select.select, [fd], [], [], 1.0)
        except OSError:
            break
        if fd in r:
            try:
                data = os.read(fd, 65536)
            except OSError:
                break
            if not data:
                break
            last_activity[0] = time.time()
            await ws.send(data)
        if time.time() - last_activity[0] > IDLE_TIMEOUT:
            await ws.close(reason="idle timeout")
            break


async def ws_to_pty(fd, ws, last_activity):
    async for message in ws:
        last_activity[0] = time.time()
        if isinstance(message, bytes):
            os.write(fd, message)
            continue
        try:
            payload = json.loads(message)
        except (ValueError, TypeError):
            os.write(fd, message.encode())
            continue
        if payload.get("type") == "resize":
            set_winsize(fd, payload.get("rows", 32), payload.get("cols", 120))
        elif payload.get("type") == "input":
            os.write(fd, payload.get("data", "").encode())


async def handler(ws):
    pid, fd = spawn_shell()
    last_activity = [time.time()]
    set_winsize(fd, 32, 120)
    try:
        await asyncio.gather(
            pty_to_ws(fd, ws, last_activity),
            ws_to_pty(fd, ws, last_activity),
        )
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        try:
            os.close(fd)
        except OSError:
            pass
        try:
            subprocess.run(["kill", "-9", str(pid)])
        except Exception:
            pass


async def main():
    async with websockets.serve(handler, WS_HOST, WS_PORT, max_size=None):
        print(f"==> terminal_service listening on ws://{WS_HOST}:{WS_PORT}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
