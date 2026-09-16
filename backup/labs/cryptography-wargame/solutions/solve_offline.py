#!/usr/bin/env python3
"""
Reference solvers + self-test for the file-based levels: 0-6 and 12-16.
    python3 solve_offline.py /tmp/vault2
"""
import base64, binascii, hashlib, json, os, re, sqlite3, subprocess, sys
from pathlib import Path
from itertools import cycle
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "common"))
from Crypto.PublicKey import RSA
from sympy import integer_nthroot
from math import isqrt

FLAG_RE = re.compile(r"CRYPTO\{[^}]+\}")
def grab(t):
    m = FLAG_RE.search(t); return m.group(0) if m else None

def eng_score(bs):
    return sum(chr(b) in "ETAOIN SHRDLUetaoin shrdlu" for b in bs)

def s00(d):  # hex
    return grab(bytes.fromhex((d/"data.txt").read_text().strip()).decode(errors="ignore"))

def s01(d):  # base64
    return grab(base64.b64decode((d/"data.txt").read_text().strip()).decode(errors="ignore"))

def s02(d):  # base64 -> hex -> decimal big int -> bytes
    data = (d/"data.txt").read_text().strip().encode()
    dec = binascii.unhexlify(base64.b64decode(data))
    n = int(dec.decode())
    return grab(n.to_bytes((n.bit_length()+7)//8, "big").decode(errors="ignore"))

def s03(d):  # single-byte XOR
    ct = bytes.fromhex((d/"ciphertext.hex").read_text().strip())
    best = max(range(256), key=lambda k: eng_score(bytes(c ^ k for c in ct)))
    return grab(bytes(c ^ best for c in ct).decode(errors="ignore"))

def s04(d):  # break repeating-key XOR
    ct = bytes.fromhex((d/"ciphertext.hex").read_text().strip())
    def ham(a, b): return sum(bin(x ^ y).count("1") for x, y in zip(a, b))
    scores = []
    for ks in range(2, 16):
        blks = [ct[i:i+ks] for i in range(0, ks*8, ks)]
        dist = sum(ham(blks[i], blks[i+1])/ks for i in range(len(blks)-1)) / (len(blks)-1)
        scores.append((dist, ks))
    for _, ks in sorted(scores)[:4]:
        key = [max(range(256), key=lambda b: eng_score(bytes(c ^ b for c in ct[i::ks]))) for i in range(ks)]
        pt = bytes(c ^ key[i % ks] for i, c in enumerate(ct))
        f = grab(pt.decode(errors="ignore"))
        if f: return f

def _crack_md5(h, words):
    return next((w for w in words if hashlib.md5(w.encode()).hexdigest() == h), None)

def s05(d):
    h = (d/"hash.txt").read_text().strip()
    pw = _crack_md5(h, (d/"wordlist.txt").read_text().split())
    if not pw: return None
    out = subprocess.run([sys.executable, str(d/"reveal.py"), pw], capture_output=True, text=True)
    return grab(out.stdout)

def s06(d):
    con = sqlite3.connect(str(d/"users.db"))
    hh, = con.execute("SELECT password_md5 FROM users WHERE username='admin'").fetchone()
    pw = _crack_md5(hh, (d/"wordlist.txt").read_text().split())
    if not pw: return None
    ct = bytes.fromhex(re.search(r'CT = bytes.fromhex\("([0-9a-f]+)"\)', (d/"login.py").read_text()).group(1))
    key = hashlib.sha256(pw.encode()).digest(); out = bytearray(); c = 0
    while len(out) < len(ct):
        out.extend(hashlib.sha256(key + c.to_bytes(8,"big")).digest()); c += 1
    return grab(bytes(a ^ b for a, b in zip(ct, out)).decode("latin1"))

def s12(d):  # two-time pad
    ct_crib = bytes.fromhex((d/"ciphertext_crib.hex").read_text().strip())
    ct_flag = bytes.fromhex((d/"ciphertext_flag.hex").read_text().strip())
    crib = (d/"crib.txt").read_text()
    if crib.endswith("\n"): crib = crib[:-1]
    crib = crib.encode()
    ks = bytes(a ^ b for a, b in zip(ct_crib, crib))
    return grab(bytes(a ^ b for a, b in zip(ct_flag, ks)).decode(errors="ignore"))

def _read_ints(txt):
    return {k: int(v) for k, v in re.findall(r"(\w+)\s*=\s*(\d+)", txt)}

def s13(d):
    v = _read_ints((d/"params.txt").read_text())
    p, q, e, c = v["p"], v["q"], v["e"], v["c"]
    dexp = pow(e, -1, (p-1)*(q-1)); m = pow(c, dexp, p*q)
    return grab(m.to_bytes((m.bit_length()+7)//8, "big").decode(errors="ignore"))

def s14(d):
    v = _read_ints((d/"params.txt").read_text())
    m, _ = integer_nthroot(v["c"], 3)
    return grab(m.to_bytes((m.bit_length()+7)//8, "big").decode(errors="ignore"))

def s15(d):
    key = RSA.import_key((d/"public_key.pem").read_bytes()); n, e = key.n, key.e
    a = isqrt(n)
    if a*a < n: a += 1
    while True:
        b2 = a*a - n; b = isqrt(b2)
        if b*b == b2: break
        a += 1
    p, q = a+b, a-b
    dexp = pow(e, -1, (p-1)*(q-1))
    c = int.from_bytes((d/"ciphertext.bin").read_bytes(), "big")
    m = pow(c, dexp, n)
    return grab(m.to_bytes((m.bit_length()+7)//8, "big").decode(errors="ignore"))

def s16(d):
    data = json.loads((d/"broadcast.json").read_text())
    N = 1
    for t in data: N *= t["n"]
    x = sum(t["c"] * (N//t["n"]) * pow(N//t["n"], -1, t["n"]) for t in data) % N
    m, _ = integer_nthroot(x, 3)
    return grab(m.to_bytes((m.bit_length()+7)//8, "big").decode(errors="ignore"))

SOLVERS = {0:s00,1:s01,2:s02,3:s03,4:s04,5:s05,6:s06,12:s12,13:s13,14:s14,15:s15,16:s16}

def main():
    vault = sys.argv[1]
    key = json.loads((Path(vault)/"FLAGS.json").read_text())
    ok = 0
    for n, fn in SOLVERS.items():
        try: got = fn(Path(vault)/f"{n:02d}")
        except Exception as ex: got = f"ERROR: {ex}"
        want = key[str(n)]; st = "OK " if got == want else "FAIL"
        if got == want: ok += 1
        print(f"[{st}] level {n:02d}  got={got}  want={want}")
    print(f"\n{ok}/{len(SOLVERS)} offline levels solved correctly.")
    sys.exit(0 if ok == len(SOLVERS) else 1)

if __name__ == "__main__":
    main()
