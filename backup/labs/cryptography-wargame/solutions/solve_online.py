#!/usr/bin/env python3
"""
Reference solvers + self-test for the interactive levels: 7,8,9,10,11,17,18.
    HOST=localhost python3 solve_online.py /tmp/vault2
"""
import hashlib, json, os, re, socket, sys
from pathlib import Path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "common"))
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad, pad

HOST = os.environ.get("HOST", "localhost")
FLAG_RE = re.compile(r"CRYPTO\{[^}]+\}")
def grab(t):
    m = FLAG_RE.search(t); return m.group(0) if m else None
BS = 16
def blocks(b): return [b[i:i+BS] for i in range(0, len(b), BS)]

class Conn:
    def __init__(self, port):
        self.s = socket.create_connection((HOST, port), timeout=15); self.buf = b""
    def line(self):
        while b"\n" not in self.buf:
            d = self.s.recv(4096)
            if not d: break
            self.buf += d
        ln, _, self.buf = self.buf.partition(b"\n"); return ln.decode(errors="ignore")
    def send(self, s): self.s.sendall((s + "\n").encode())
    def close(self): self.s.close()

# ── 7: mode detection ──
def s07(vault):
    c = Conn(6507)
    for _ in range(60):
        c.send((b"A" * 48).hex())
        ct = bytes.fromhex(c.line().split("=", 1)[1])
        bl = blocks(ct)
        guess = "ECB" if len(bl) != len(set(bl)) else "CBC"
        c.send("GUESS " + guess)
        resp = c.line()
        if resp.startswith("CORRECT") and "10/10" in resp:
            nxt = c.line(); c.close(); return grab(nxt)
    c.close(); return None

# ── 8: byte-at-a-time ECB ──
def s08(vault):
    conn = Conn(6508)
    def oracle(p): conn.send(p.hex()); return bytes.fromhex(conn.line())
    base = len(oracle(b"")); known = b""
    for _ in range(base):
        padn = (BS - 1 - len(known)) % BS
        pre = b"A" * padn; blk = (len(pre) + len(known)) // BS
        target = oracle(pre)[blk*BS:(blk+1)*BS]
        hit = None
        for g in range(256):
            if oracle(pre + known + bytes([g]))[blk*BS:(blk+1)*BS] == target:
                hit = g; break
        if hit is None: break
        known += bytes([hit])
        if b"}" in known and grab(known.decode(errors="ignore")): break
    conn.close(); return grab(known.decode(errors="ignore"))

# ── 9: ECB cut-and-paste ──
def s09(vault):
    c = Conn(6509)
    def profile(email_bytes):
        c.send("PROFILE " + email_bytes.hex()); return bytes.fromhex(c.line())
    # block with "admin"+PKCS7 padding, isolated after "email="+10*A (=16 bytes)
    admin_block_email = b"A"*10 + b"admin" + bytes([11])*11
    ct1 = profile(admin_block_email)
    admin_block = blocks(ct1)[1]
    # email length so that "email="+email+"&uid=10&role=" ends on a block boundary
    ct2 = profile(b"A"*13)
    forged = b"".join(blocks(ct2)[:2]) + admin_block
    c.send("LOGIN " + forged.hex()); resp = c.line(); c.close()
    return grab(resp)

# ── 10: CBC bit-flip ──
def s10(vault):
    c = Conn(6510)
    token = bytes.fromhex(c.line().split("=", 1)[1])
    iv, ct = token[:16], token[16:]
    bl = blocks(ct)
    cur, want = b"id=42;role=user;", b"id=42;role=admin"
    b0 = bytearray(bl[0])
    for i in range(BS): b0[i] ^= cur[i] ^ want[i]
    c.send((iv + bytes(b0) + b"".join(bl[1:])).hex())
    resp = c.line(); c.close(); return grab(resp)

# ── 11: padding oracle ──
def s11(vault):
    blob = bytes.fromhex((Path(vault)/"11"/"ciphertext.txt").read_text().strip())
    iv, ct = blob[:16], blob[16:]
    def oracle(iv_b, ct_b):
        c = Conn(6511); c.send((iv_b + ct_b).hex()); r = c.line(); c.close()
        return r.strip() == "VALID"
    cblocks = [iv] + blocks(ct); recovered = b""
    for bi in range(1, len(cblocks)):
        prev, cur = cblocks[bi-1], cblocks[bi]
        inter = bytearray(BS); plain = bytearray(BS)
        for pv in range(1, BS+1):
            pos = BS - pv
            forged = bytearray(BS)
            for k in range(pos+1, BS): forged[k] = inter[k] ^ pv
            found = False
            for g in range(256):
                forged[pos] = g
                if oracle(bytes(forged), cur):
                    if pv == 1:
                        f2 = bytearray(forged); f2[pos-1] ^= 0xFF
                        if not oracle(bytes(f2), cur): continue
                    inter[pos] = g ^ pv; plain[pos] = inter[pos] ^ prev[pos]; found = True; break
            if not found: return None
        recovered += bytes(plain)
    try: recovered = unpad(recovered, 16)
    except Exception: pass
    return grab(recovered.decode(errors="ignore"))

# ── 17: small-prime DH (BSGS) ──
def bsgs(g, h, p):
    import math
    m = int(math.isqrt(p)) + 1; table = {}; e = 1
    for j in range(m): table.setdefault(e, j); e = (e * g) % p
    factor = pow(g, (p-2)*m, p); gamma = h
    for i in range(m):
        if gamma in table: return i*m + table[gamma]
        gamma = (gamma * factor) % p
    return None

def s17(vault):
    c = Conn(6517); vals = {}
    for _ in range(6):
        ln = c.line()
        if not ln: break
        k, _, v = ln.partition("="); vals[k] = v
    c.close()
    p, g, A, B = int(vals["p"]), int(vals["g"]), int(vals["A"]), int(vals["B"])
    iv = bytes.fromhex(vals["IV"]); ct = bytes.fromhex(vals["FLAG_CT"])
    a = bsgs(g, A, p); s = pow(B, a, p)
    key = hashlib.sha256(str(s).encode()).digest()[:16]
    return grab(unpad(AES.new(key, AES.MODE_CBC, iv).decrypt(ct), 16).decode(errors="ignore"))

# ── 18: DH MITM (g-injection) ──
def s18(vault):
    c = Conn(6518)
    hello = json.loads(c.line()); A = hello["A"]
    c.send(json.dumps({"to": "bob", "pub": hello["g"]}))
    json.loads(c.line())
    c.send(json.dumps({"to": "alice", "pub": hello["g"]}))
    msg = json.loads(c.line()); c.close()
    iv = bytes.fromhex(msg["iv"]); ct = bytes.fromhex(msg["ct"])
    key = hashlib.sha256(str(A).encode()).digest()[:16]  # sa = g^a = A
    return grab(unpad(AES.new(key, AES.MODE_CBC, iv).decrypt(ct), 16).decode(errors="ignore"))

SOLVERS = {7:s07, 8:s08, 9:s09, 10:s10, 11:s11, 17:s17, 18:s18}

def main():
    vault = sys.argv[1]
    key = json.loads((Path(vault)/"FLAGS.json").read_text()); ok = 0
    for n, fn in SOLVERS.items():
        try: got = fn(vault)
        except Exception as e: got = f"ERROR: {e}"
        want = key[str(n)]; st = "OK " if got == want else "FAIL"
        if got == want: ok += 1
        print(f"[{st}] level {n:02d}  got={got}  want={want}")
    print(f"\n{ok}/{len(SOLVERS)} online levels solved correctly.")
    sys.exit(0 if ok == len(SOLVERS) else 1)

if __name__ == "__main__":
    main()
