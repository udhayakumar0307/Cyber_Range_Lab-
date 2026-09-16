#!/usr/bin/env python3
"""
Cryptography Wargame — portal / scoring server.

Responsibilities:
  * generate the per-student challenge vault on first boot (via generator.py);
  * expose exactly the unlocked levels into the shared /srv/levels volume that
    the student container mounts read-only;
  * serve the task-card UI, progressive hints, flag submission and progress;
  * gate progression: level N stays vaulted until level N-1's flag is submitted.

Env:  STUDENT_ID, LAB_SEED, VAULT_DIR, LEVELS_DIR, STATE_DIR
API-compatible with the wider CyberRange platform:
  GET  /api/health   GET /api/progress   GET /api/level/<n>
  GET  /api/hint/<n>/<i>   POST /api/submit-flag   POST /api/reset
"""
import json, os, shutil, subprocess, sys, threading, time
from pathlib import Path
from flask import Flask, request, jsonify, render_template

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "common"))
import labcrypto as LC
from levels_meta import LEVELS, LEVELS_BY_N, MAX_LEVEL

SID = os.environ.get("STUDENT_ID", "student")
SEED = os.environ.get("LAB_SEED", "defaultseed")
VAULT = Path(os.environ.get("VAULT_DIR", "/srv/vault"))
LEVELS_DIR = Path(os.environ.get("LEVELS_DIR", "/srv/levels"))
STATE_DIR = Path(os.environ.get("STATE_DIR", "/srv/state"))
PROGRESS = STATE_DIR / "progress.json"

app = Flask(__name__)
_lock = threading.Lock()
_rate = {}


# ---------------------------------------------------------------------------
# state
# ---------------------------------------------------------------------------
def load_state():
    if PROGRESS.exists():
        return json.loads(PROGRESS.read_text())
    return {"student": SID, "current": 0, "completed": []}

def save_state(st):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    PROGRESS.write_text(json.dumps(st, indent=2))

def flags_map():
    return json.loads((VAULT / "FLAGS.json").read_text())

def expose_level(n):
    src = VAULT / f"{n:02d}"
    dst = LEVELS_DIR / f"{n:02d}"
    if src.exists() and not dst.exists():
        shutil.copytree(src, dst)

def hide_all():
    if LEVELS_DIR.exists():
        for child in LEVELS_DIR.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()


# ---------------------------------------------------------------------------
# first-boot: build the vault, expose only level 0
# ---------------------------------------------------------------------------
def bootstrap():
    VAULT.mkdir(parents=True, exist_ok=True)
    LEVELS_DIR.mkdir(parents=True, exist_ok=True)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not (VAULT / "FLAGS.json").exists():
        print("[*] generating challenge vault ...", flush=True)
        subprocess.run([sys.executable, str(ROOT / "generator.py"),
                        "--out", str(VAULT), "--student", SID, "--seed", SEED],
                       check=True)
    st = load_state()
    for n in range(0, st["current"] + 1):
        expose_level(n)
    save_state(st)
    print(f"[*] portal ready: student={SID} current-level={st['current']}", flush=True)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def level_status(n, st):
    if n in st["completed"]:
        return "completed"
    if n == st["current"]:
        return "current"
    if n < st["current"]:
        return "unlocked"
    return "locked"

def rate_limited(ip):
    now = time.time()
    _rate.setdefault(ip, [])
    _rate[ip] = [t for t in _rate[ip] if now - t < 60]
    if len(_rate[ip]) >= 30:
        return True
    _rate[ip].append(now)
    return False


# ---------------------------------------------------------------------------
# routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html", student=SID, max_level=MAX_LEVEL)

@app.route("/api/health")
def health():
    return jsonify(status="ok", student=SID, levels=MAX_LEVEL + 1)

@app.route("/api/progress")
def progress():
    st = load_state()
    levels = [{"n": lv["n"], "title": lv["title"], "concept": lv["concept"],
               "group": lv["group"], "diff": lv["diff"],
               "status": level_status(lv["n"], st)} for lv in LEVELS]
    return jsonify(student=SID, current=st["current"],
                   completed=sorted(st["completed"]), max=MAX_LEVEL, levels=levels)

@app.route("/api/level/<int:n>")
def level(n):
    st = load_state()
    if n not in LEVELS_BY_N:
        return jsonify(error="no such level"), 404
    if n > st["current"]:
        return jsonify(error="locked", hint="finish the previous level first"), 403
    lv = LEVELS_BY_N[n]
    return jsonify(n=n, title=lv["title"], concept=lv["concept"], task=lv["task"],
                   files=lv["files"], hint_count=len(lv["hints"]),
                   status=level_status(n, st), group=lv["group"], diff=lv["diff"],
                   kind=lv.get("kind","file"), port=lv.get("port"),
                   path=f"/levels/{n:02d}")

@app.route("/api/hint/<int:n>/<int:i>")
def hint(n, i):
    st = load_state()
    if n not in LEVELS_BY_N:
        return jsonify(error="no such level"), 404
    if n > st["current"]:
        return jsonify(error="locked"), 403
    hints = LEVELS_BY_N[n]["hints"]
    if not (0 <= i < len(hints)):
        return jsonify(error="no such hint"), 404
    return jsonify(n=n, index=i, hint=hints[i], total=len(hints))

@app.route("/api/submit-flag", methods=["POST"])
def submit_flag():
    ip = request.remote_addr or "?"
    if rate_limited(ip):
        return jsonify(correct=False, error="too many attempts, slow down"), 429
    body = request.get_json(silent=True) or {}
    try:
        n = int(body.get("level"))
    except (TypeError, ValueError):
        return jsonify(correct=False, error="level required"), 400
    submitted = (body.get("flag") or "").strip()
    with _lock:
        st = load_state()
        if n not in LEVELS_BY_N:
            return jsonify(correct=False, error="no such level"), 404
        if n > st["current"]:
            return jsonify(correct=False, error="that level is locked"), 403
        expected = flags_map()[str(n)]
        if submitted != expected:
            return jsonify(correct=False, message="Incorrect flag. Keep trying.")
        newly = n not in st["completed"]
        if newly:
            st["completed"].append(n)
        unlocked = None
        if n == st["current"] and n < MAX_LEVEL:
            st["current"] = n + 1
            expose_level(st["current"])
            unlocked = st["current"]
        save_state(st)
        done = len(set(st["completed"])) == MAX_LEVEL + 1
        return jsonify(correct=True,
                       message="Correct!" + (" Lab complete!" if done else ""),
                       unlocked=unlocked, completed=sorted(st["completed"]),
                       current=st["current"], lab_complete=done)

@app.route("/api/reset", methods=["POST"])
def reset():
    with _lock:
        hide_all()
        st = {"student": SID, "current": 0, "completed": []}
        save_state(st)
        expose_level(0)
    return jsonify(status="reset", current=0)


bootstrap()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
