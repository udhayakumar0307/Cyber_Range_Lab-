#!/usr/bin/env python3
"""
Interactive challenge servers for the Cryptography Wargame (v2).

One process, several TCP ports. Each handler derives its AES key/flag from
STUDENT_ID/LAB_SEED exactly like the generator.

  6507 mode detection (ECB/CBC)     6508 ECB byte-at-a-time
  6509 ECB cut-and-paste            6510 CBC bit-flip
  6511 CBC padding oracle           6517 small-prime DH
  6518 DH man-in-the-middle
"""
import hashlib, json, os, secrets, socketserver, sys, threading
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "common"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "common"))
import labcrypto as LC
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

SID = os.environ.get("STUDENT_ID", "student")
SEED = os.environ.get("LAB_SEED", "defaultseed")
def flag(n):   return LC.flag_for(n, SID, SEED)
def aeskey(n): return LC.det_bytes(16, SID, SEED, f"l{n}_cbckey")
def aesiv(n):  return LC.det_bytes(16, SID, SEED, f"l{n}_iv")

def readline(conn):
    """Next stripped line, or None on EOF (empty line -> b'')."""
    buf = b""
    while b"\n" not in buf:
        try: chunk = conn.recv(4096)
        except OSError: return None
        if not chunk: return None if not buf else buf.strip()
        buf += chunk
        if len(buf) > 1 << 20: break
    return buf.split(b"\n", 1)[0].strip()

def sendline(conn, s):
    if isinstance(s, str): s = s.encode()
    try: conn.sendall(s + b"\n")
    except OSError: pass

BS = 16
def blocks(b): return [b[i:i+BS] for i in range(0, len(b), BS)]

# ── 6507 mode detection ────────────────────────────────────────────────────
class ModeDetectHandler(socketserver.BaseRequestHandler):
    def handle(self):
        c = self.request; streak = 0; pending = None
        while True:
            line = readline(c)
            if line is None: break
            if line.upper().startswith(b"GUESS"):
                if pending is None:
                    sendline(c, "ERR: send hex(plaintext) first"); continue
                guess = line.split()[1].decode(errors="ignore").upper() if len(line.split()) > 1 else ""
                if guess == pending:
                    streak += 1
                    if streak >= 10:
                        sendline(c, f"CORRECT {streak}/10"); sendline(c, f"FLAG={flag(7)}"); streak = 0
                    else:
                        sendline(c, f"CORRECT {streak}/10")
                else:
                    streak = 0; sendline(c, "WRONG — streak reset 0/10")
                pending = None
            else:
                try: pt = bytes.fromhex(line.decode())
                except Exception:
                    sendline(c, "ERR: send hex(plaintext) or GUESS ECB|CBC"); continue
                key = secrets.token_bytes(16)
                if secrets.randbits(1):
                    ct = AES.new(key, AES.MODE_ECB).encrypt(pad(pt, 16)); pending = "ECB"
                else:
                    iv = secrets.token_bytes(16)
                    ct = AES.new(key, AES.MODE_CBC, iv).encrypt(pad(pt, 16)); pending = "CBC"
                sendline(c, "CT=" + ct.hex())

# ── 6508 ECB byte-at-a-time ────────────────────────────────────────────────
class ECBHandler(socketserver.BaseRequestHandler):
    def handle(self):
        key, secret = aeskey(8), flag(8).encode(); c = self.request
        while True:
            line = readline(c)
            if line is None: break
            try: prefix = bytes.fromhex(line.decode())
            except Exception: sendline(c, "ERR: send hex"); continue
            sendline(c, AES.new(key, AES.MODE_ECB).encrypt(pad(prefix + secret, 16)).hex())

# ── 6509 ECB cut-and-paste ─────────────────────────────────────────────────
class CutPasteHandler(socketserver.BaseRequestHandler):
    def profile_for(self, email: bytes) -> bytes:
        email = email.replace(b"&", b"").replace(b"=", b"")
        return b"email=" + email + b"&uid=10&role=user"
    def handle(self):
        key = aeskey(9); c = self.request
        while True:
            line = readline(c)
            if line is None: break
            parts = line.split(b" ", 1)
            cmd = parts[0].upper()
            arg = parts[1] if len(parts) > 1 else b""
            if cmd == b"PROFILE":
                try: email = bytes.fromhex(arg.decode())
                except Exception: sendline(c, "ERR: PROFILE <hex(email)>"); continue
                pt = self.profile_for(email)
                sendline(c, AES.new(key, AES.MODE_ECB).encrypt(pad(pt, 16)).hex())
            elif cmd == b"LOGIN":
                try: ct = bytes.fromhex(arg.decode())
                except Exception: sendline(c, "ERR: LOGIN <hex(ct)>"); continue
                try: pt = unpad(AES.new(key, AES.MODE_ECB).decrypt(ct), 16)
                except Exception: sendline(c, "ERR: bad padding"); continue
                fields = dict(kv.split(b"=", 1) for kv in pt.split(b"&") if b"=" in kv)
                if fields.get(b"role") == b"admin":
                    sendline(c, f"ADMIN OK. FLAG={flag(9)}")
                else:
                    sendline(c, f"role={fields.get(b'role', b'?').decode(errors='ignore')}, no flag")
            else:
                sendline(c, "ERR: use PROFILE <hex(email)> or LOGIN <hex(ct)>")

# ── 6510 CBC bit-flip ──────────────────────────────────────────────────────
L10_PT = b"session=00000000id=42;role=user;lang=en;pad=0000"
class BitFlipHandler(socketserver.BaseRequestHandler):
    def handle(self):
        key, iv = aeskey(10), aesiv(10); c = self.request
        token = iv + AES.new(key, AES.MODE_CBC, iv).encrypt(pad(L10_PT, 16))
        sendline(c, f"TOKEN={token.hex()}")
        while True:
            line = readline(c)
            if line is None: break
            try: blob = bytes.fromhex(line.decode())
            except Exception: sendline(c, "ERR: send hex"); continue
            if len(blob) < 32 or len(blob) % 16: sendline(c, "ERR: bad length"); continue
            pt = AES.new(key, AES.MODE_CBC, blob[:16]).decrypt(blob[16:])
            try: pt = unpad(pt, 16)
            except ValueError: sendline(c, "ERR: bad padding"); continue
            sendline(c, f"ADMIN OK. FLAG={flag(10)}" if b"role=admin" in pt else "role is not admin, no flag")

# ── 6511 CBC padding oracle ────────────────────────────────────────────────
class PaddingOracleHandler(socketserver.BaseRequestHandler):
    def handle(self):
        key = aeskey(11); c = self.request
        while True:
            line = readline(c)
            if line is None: break
            try: blob = bytes.fromhex(line.decode())
            except Exception: sendline(c, "INVALID"); continue
            if len(blob) < 32 or len(blob) % 16: sendline(c, "INVALID"); continue
            pt = AES.new(key, AES.MODE_CBC, blob[:16]).decrypt(blob[16:])
            try: unpad(pt, 16); sendline(c, "VALID")
            except ValueError: sendline(c, "INVALID")

# ── DH shared ──────────────────────────────────────────────────────────────
from sympy import nextprime
DH_P = int(nextprime(2 ** 36)); DH_G = 5
def dh_key(s): return hashlib.sha256(str(s).encode()).digest()[:16]

# ── 6517 small-prime DH ────────────────────────────────────────────────────
class DHHandler(socketserver.BaseRequestHandler):
    def handle(self):
        c = self.request
        a = secrets.randbelow(DH_P - 3) + 2; b = secrets.randbelow(DH_P - 3) + 2
        A = pow(DH_G, a, DH_P); B = pow(DH_G, b, DH_P); s = pow(A, b, DH_P)
        iv = secrets.token_bytes(16)
        ct = AES.new(dh_key(s), AES.MODE_CBC, iv).encrypt(pad(flag(17).encode(), 16))
        for ln in (f"p={DH_P}", f"g={DH_G}", f"A={A}", f"B={B}", f"IV={iv.hex()}", f"FLAG_CT={ct.hex()}"):
            sendline(c, ln)

# ── 6518 DH MITM ───────────────────────────────────────────────────────────
class DHMitmHandler(socketserver.BaseRequestHandler):
    def handle(self):
        c = self.request
        a = secrets.randbelow(DH_P - 3) + 2; b = secrets.randbelow(DH_P - 3) + 2
        A = pow(DH_G, a, DH_P)
        sendline(c, json.dumps({"step": "alice_hello", "p": DH_P, "g": DH_G, "A": A}))
        m = readline(c)
        if m is None: return
        pub_to_bob = int(json.loads(m.decode())["pub"])  # noqa: F841 (Bob would use it)
        B = pow(DH_G, b, DH_P)
        sendline(c, json.dumps({"step": "bob_hello", "B": B}))
        m = readline(c)
        if m is None: return
        pub_to_alice = int(json.loads(m.decode())["pub"])
        sa = pow(pub_to_alice, a, DH_P)
        iv = secrets.token_bytes(16)
        ct = AES.new(dh_key(sa), AES.MODE_CBC, iv).encrypt(
            pad(f"Bob, the admin secret is {flag(18)}".encode(), 16))
        sendline(c, json.dumps({"step": "alice_msg", "iv": iv.hex(), "ct": ct.hex()}))

class Threaded(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True; daemon_threads = True

PORTS = {6507: ModeDetectHandler, 6508: ECBHandler, 6509: CutPasteHandler,
         6510: BitFlipHandler, 6511: PaddingOracleHandler,
         6517: DHHandler, 6518: DHMitmHandler}

def main():
    print(f"[*] student={SID} seed={SEED} DH_P={DH_P}", flush=True)
    for port, handler in PORTS.items():
        srv = Threaded(("0.0.0.0", port), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        print(f"[+] listening on :{port} ({handler.__name__})", flush=True)
    threading.Event().wait()

if __name__ == "__main__":
    main()
