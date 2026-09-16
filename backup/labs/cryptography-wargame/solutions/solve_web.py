#!/usr/bin/env python3
"""
Reference solvers / self-test for the web-crypto levels: 19 and 20.
Requires web-crypto reachable (defaults to localhost:8019 / :8020) and, for L20,
the generated incident bundle in <vault>/20/incident.

    HOST=localhost python3 solve_web.py /path/to/vault
"""
import json, os, re, sys, urllib.request
from math import isqrt
from pathlib import Path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "common"))
import jwt
from Crypto.PublicKey import RSA
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

HOST = os.environ.get("HOST", "localhost")
FLAG_RE = re.compile(r"CRYPTO\{[^}]+\}")
def grab(t): 
    m = FLAG_RE.search(t); return m.group(0) if m else None

def http(method, url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ---- 19: crack the weak HS256 secret, forge an admin token ----
def s19(vault):
    base = f"http://{HOST}:8019"
    _, body = http("POST", base + "/login",
                   data=json.dumps({"user": "guest"}).encode(),
                   headers={"Content-Type": "application/json"})
    token = json.loads(body)["token"]
    words = (Path(vault) / "19" / "wordlist.txt").read_text().split()
    secret = None
    for w in words:
        try:
            jwt.decode(token, w, algorithms=["HS256"]); secret = w; break
        except Exception:
            continue
    if not secret:
        return None
    forged = jwt.encode({"user": "guest", "role": "admin"}, secret, algorithm="HS256")
    _, body = http("GET", base + "/admin", headers={"Authorization": "Bearer " + forged})
    return grab(body)

# ---- 20: full incident chain ----
def fermat(n):
    a = isqrt(n)
    if a * a < n: a += 1
    while True:
        b2 = a * a - n
        b = isqrt(b2)
        if b * b == b2:
            return a + b, a - b
        a += 1

def s20(vault):
    inc = Path(vault) / "20" / "incident"
    # 1. read the weak RSA public key
    pub = RSA.import_key((inc / "public_key.pem").read_bytes())
    n, e = pub.n, pub.e
    # 2. pull the wrapped AES key + IV out of the capture
    cap = (inc / "network_capture.txt").read_text()
    wrapped = int(re.search(r"X-RSA-Wrapped-AESKey:\s*([0-9a-fA-F]+)", cap).group(1), 16)
    iv = bytes.fromhex(re.search(r"X-AES-IV:\s*([0-9a-fA-F]+)", cap).group(1))
    # 3. factor n (twin primes), build the private key, unwrap the AES key
    p, q = fermat(n)
    d = pow(e, -1, (p - 1) * (q - 1))
    aeskey_int = pow(wrapped, d, n)
    aeskey = aeskey_int.to_bytes(16, "big")
    # 4. decrypt the config, read the JWT secret
    ct = (inc / "encrypted_config.bin").read_bytes()
    config = unpad(AES.new(aeskey, AES.MODE_CBC, iv).decrypt(ct), 16).decode()
    secret = re.search(r"JWT_SECRET=(\S+)", config).group(1)
    # 5. forge an admin token and hit the live app
    forged = jwt.encode({"user": "attacker", "role": "admin"}, secret, algorithm="HS256")
    _, body = http("GET", f"http://{HOST}:8020/admin",
                   headers={"Authorization": "Bearer " + forged})
    return grab(body)

SOLVERS = {19: s19, 20: s20}

def main():
    vault = sys.argv[1]
    key = json.loads((Path(vault) / "FLAGS.json").read_text())
    ok = 0
    for n, fn in SOLVERS.items():
        try: got = fn(vault)
        except Exception as ex: got = f"ERROR: {ex}"
        want = key[str(n)]
        st = "OK " if got == want else "FAIL"
        if got == want: ok += 1
        print(f"[{st}] level {n:02d}  got={got}  want={want}")
    print(f"\n{ok}/{len(SOLVERS)} web levels solved correctly.")
    sys.exit(0 if ok == len(SOLVERS) else 1)

if __name__ == "__main__":
    main()
