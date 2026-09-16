#!/usr/bin/env python3
"""
End-to-end grader: reset the portal, then for every level 0..20 recover the flag
with the reference solver, submit it to the portal, and assert the next level
unlocks. Proves the whole lab is solvable AND the progression gate works.

    PORTAL=http://localhost:5000 HOST=localhost python3 full_playthrough.py /path/to/vault
"""
import json, os, sys, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import solve_offline as off
import solve_online as on
import solve_web as web

PORTAL = os.environ.get("PORTAL", "http://localhost:5000")
VAULT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/vault_test"

def post(path, obj):
    req = urllib.request.Request(PORTAL + path, method="POST",
        data=json.dumps(obj).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def get(path):
    with urllib.request.urlopen(PORTAL + path, timeout=15) as r:
        return json.loads(r.read())

# map each level to the reference solver that recovers its flag
def solver(n):
    d = Path(VAULT) / f"{n:02d}"
    if n in off.SOLVERS:  return lambda: off.SOLVERS[n](d)
    if n in on.SOLVERS:   return lambda: on.SOLVERS[n](VAULT)
    if n in web.SOLVERS:  return lambda: web.SOLVERS[n](VAULT)
    raise KeyError(n)

def main():
    print(f"[*] portal={PORTAL} vault={VAULT}")
    post("/api/reset", {})
    passed = 0
    for n in range(0, 21):
        st = get("/api/progress")
        assert st["current"] >= n, f"level {n} not unlocked (current={st['current']})"
        flag = solver(n)()
        if not flag:
            print(f"[FAIL] level {n:02d}: solver returned nothing"); break
        res = post("/api/submit-flag", {"level": n, "flag": flag})
        if not res.get("correct"):
            print(f"[FAIL] level {n:02d}: portal rejected {flag} -> {res}"); break
        tag = "LAB COMPLETE" if res.get("lab_complete") else f"unlocked {res.get('unlocked')}"
        print(f"[OK ] level {n:02d}  {flag}  ({tag})")
        passed += 1
    print(f"\n{passed}/21 levels played through the portal.")
    final = get("/api/progress")
    print(f"final: current={final['current']} completed={len(final['completed'])}/21")
    sys.exit(0 if passed == 21 else 1)

if __name__ == "__main__":
    main()
