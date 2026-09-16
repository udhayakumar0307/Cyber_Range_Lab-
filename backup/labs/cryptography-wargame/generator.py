#!/usr/bin/env python3
"""
Cryptography Wargame — challenge generator (v2 curriculum).

Builds all 21 levels' challenge files into an output dir, one subdir per level
(00..20), deterministically from (STUDENT_ID, LAB_SEED). The portal keeps these
in a vault and exposes level N only once level N-1's flag is submitted.

    python3 generator.py --out /srv/vault --student alice --seed myseed
"""
import argparse, base64, binascii, hashlib, json, os, sqlite3, sys, textwrap
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "common"))
import labcrypto as LC
from levels_meta import LEVELS_BY_N, SVC, WEB

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
from Crypto.PublicKey import RSA
from sympy import nextprime, gcd

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def wln(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "wb" if isinstance(data, (bytes, bytearray)) else "w"
    with open(path, mode) as f:
        f.write(data)

def msg(flag): return f"Well done. The password for the next level is: {flag}"
def xor(data, key): return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))

WORDS = ["sunshine","dragon","letmein","shadow","monkey","falcon","matrix","hunter",
         "ranger","phoenix","galaxy","secret","welcome","freedom","thunder","master",
         "orange","silver","wizard","ninja","rocket","cosmos","python","cipher"]
COMMON = ["password","123456","qwerty","abc123","iloveyou","admin123","sunshine1",
          "letmein2","trustno1","superman","batman7","starwars","liverpool","chocolate",
          "football9","princess","whatever","computer","corvette","hardcore","summer24",
          "autumn21","winter99","spring07"]

def pick(words, *parts):
    return words[int.from_bytes(LC.det_bytes(2, *parts), "big") % len(words)]

def streamxor(data, password):
    key = hashlib.sha256(password.encode()).digest()
    out, c = bytearray(), 0
    while len(out) < len(data):
        out.extend(hashlib.sha256(key + c.to_bytes(8, "big")).digest()); c += 1
    return bytes(a ^ b for a, b in zip(data, out))

def build_wordlist(chosen, sid, seed, salt):
    pool = list(dict.fromkeys(WORDS + COMMON + [chosen]))
    pool.sort(key=lambda w: hashlib.sha256((w + sid + seed + salt).encode()).hexdigest())
    return "\n".join(pool) + "\n"

def det_prime(bits, *parts, cong2mod3=False):
    p = nextprime(LC.det_int(bits, *parts))
    if cong2mod3:
        while p % 3 != 2:
            p = nextprime(p)
    return int(p)

def flag_int(flag): return int.from_bytes(flag.encode(), "big")

# deterministic AES material shared with net-services (same salt strings there)
def aes_key(level, sid, seed): return LC.det_bytes(16, sid, seed, f"l{level}_cbckey")
def aes_iv(level, sid, seed):  return LC.det_bytes(16, sid, seed, f"l{level}_iv")

# ===========================================================================
# ENCODING & XOR
# ===========================================================================
def lvl00(d, flag, sid, seed):
    wln(d / "data.txt", binascii.hexlify(msg(flag).encode()).decode() + "\n")

def lvl01(d, flag, sid, seed):
    wln(d / "data.txt", base64.b64encode(msg(flag).encode()).decode() + "\n")

def lvl02(d, flag, sid, seed):
    big = int.from_bytes(msg(flag).encode(), "big")   # big integer
    dec = str(big).encode()                           # its decimal string
    hexed = binascii.hexlify(dec)                     # hex of that
    b64 = base64.b64encode(hexed)                     # base64 outer layer
    wln(d / "data.txt", b64.decode() + "\n")

def lvl03(d, flag, sid, seed):
    kb = (int.from_bytes(LC.det_bytes(1, sid, seed, "l3"), "big") % 254) + 1  # 1..255
    ct = xor(msg(flag).encode(), bytes([kb]))
    wln(d / "ciphertext.hex", binascii.hexlify(ct).decode() + "\n")

L4_TEXT = (
    "The history of every major cryptographic system is, in the end, a history of its "
    "assumptions being quietly violated. A cipher is only as strong as the weakest belief "
    "its designers held about how it would be used. Engineers reach for a key and reuse it; "
    "they trust an oracle that should have stayed silent; they leak a single bit of padding "
    "and imagine no one is counting. The attacker's craft is patience: measure what the "
    "system reveals, model what it is hiding, and let the small leaks accumulate until the "
    "secret is no longer secret. Hidden here in plain sight, the operator left the password: "
)
def lvl04(d, flag, sid, seed):
    key = pick(WORDS, sid, seed, "l4key")[:7].encode()
    pt = (L4_TEXT + flag + ". Guard it well, and move to the next stage.").encode()
    wln(d / "ciphertext.hex", binascii.hexlify(xor(pt, key)).decode() + "\n")

# ===========================================================================
# HASHING
# ===========================================================================
def lvl05(d, flag, sid, seed):
    pw = COMMON[int.from_bytes(LC.det_bytes(2, sid, seed, "l5pw"), "big") % len(COMMON)]
    wln(d / "hash.txt", hashlib.md5(pw.encode()).hexdigest() + "\n")
    wln(d / "wordlist.txt", build_wordlist(pw, sid, seed, "l5"))
    ct = streamxor(flag.encode(), pw)
    wln(d / "reveal.py", textwrap.dedent(f'''\
        #!/usr/bin/env python3
        # Usage: python3 reveal.py <password-you-cracked>
        import sys, hashlib
        CT = bytes.fromhex("{ct.hex()}")
        def streamxor(data, pw):
            key = hashlib.sha256(pw.encode()).digest(); out, c = bytearray(), 0
            while len(out) < len(data):
                out.extend(hashlib.sha256(key + c.to_bytes(8,"big")).digest()); c += 1
            return bytes(a ^ b for a, b in zip(data, out))
        if len(sys.argv) != 2:
            print("usage: python3 reveal.py <password>"); sys.exit(1)
        flag = streamxor(CT, sys.argv[1]).decode("latin1")
        print("Your flag: " + flag if flag.startswith("CRYPTO{{") else "Wrong password. Keep cracking.")
        '''))

def lvl06(d, flag, sid, seed):
    admin_pw = COMMON[int.from_bytes(LC.det_bytes(2, sid, seed, "l6pw"), "big") % len(COMMON)]
    users = [("alice","sunshine"),("bob","dragon"),("carol","monkey"),
             ("admin",admin_pw),("dave","shadow")]
    dbp = d / "users.db"
    if dbp.exists(): dbp.unlink()
    con = sqlite3.connect(str(dbp))
    con.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_md5 TEXT, role TEXT)")
    for i,(u,p) in enumerate(users):
        con.execute("INSERT INTO users VALUES (?,?,?,?)",
                    (i+1, u, hashlib.md5(p.encode()).hexdigest(), "admin" if u=="admin" else "user"))
    con.commit(); con.close()
    wln(d / "wordlist.txt", build_wordlist(admin_pw, sid, seed, "l6"))
    ct = streamxor(flag.encode(), admin_pw)
    wln(d / "login.py", textwrap.dedent(f'''\
        #!/usr/bin/env python3
        import sqlite3, hashlib, getpass, os, sys
        CT = bytes.fromhex("{ct.hex()}")
        def streamxor(data, pw):
            key = hashlib.sha256(pw.encode()).digest(); out, c = bytearray(), 0
            while len(out) < len(data):
                out.extend(hashlib.sha256(key + c.to_bytes(8,"big")).digest()); c += 1
            return bytes(a ^ b for a, b in zip(data, out))
        db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db")
        con = sqlite3.connect(db)
        u = input("username: ").strip()
        try: p = getpass.getpass("password: ")
        except Exception: p = input("password: ")
        row = con.execute("SELECT password_md5, role FROM users WHERE username=?", (u,)).fetchone()
        if not row or hashlib.md5(p.encode()).hexdigest() != row[0]:
            print("Login failed."); sys.exit(1)
        print(f"Logged in as {{u}} ({{row[1]}}).")
        print("Flag: " + streamxor(CT, p).decode("latin1") if row[1]=="admin" else "Not an administrator.")
        '''))

# ===========================================================================
# SYMMETRIC / AES  (service source + notes; live servers in net-services)
# ===========================================================================
def lvl07(d, flag, sid, seed):
    wln(d / "notes.txt", textwrap.dedent(f'''\
        LEVEL 07 — Detect the Mode (ECB vs CBC)
        Connect:  nc {SVC} 6507
        Each round:
            1. you send   hex(<your plaintext>)\\n
            2. server replies  CT=<hex>   (AES-ECB or AES-CBC of your plaintext,
                                            fresh random key each round)
            3. you send   GUESS ECB   or   GUESS CBC
            4. server replies CORRECT n/10  (or WRONG, streak reset)
        Reach 10 correct in a row and it prints FLAG=CRYPTO{{...}}.
        Tip: send many identical blocks (e.g. 48 x 'A'); ECB repeats them in the ciphertext.
    '''))

def lvl08(d, flag, sid, seed):
    wln(d / "challenge.py", textwrap.dedent(f'''\
        # Reference source — LEVEL 08 live server on {SVC}:6508
        # Protocol (newline-delimited):  you send hex(prefix)\\n
        #   server replies hex( AES_ECB(key, pad(prefix + SECRET_FLAG)) )\\n
        # The 16-byte key is fixed and hidden. ECB maps equal plaintext blocks to
        # equal ciphertext blocks — recover the flag one byte at a time (Cryptopals 12).
        from Crypto.Cipher import AES
        from Crypto.Util.Padding import pad
        def oracle(prefix): return AES.new(KEY, AES.MODE_ECB).encrypt(pad(prefix + FLAG, 16))
    '''))
    wln(d / "oracle_client.py", textwrap.dedent(f'''\
        #!/usr/bin/env python3
        "Helper: oracle(prefix_bytes) -> ciphertext_bytes, via the network."
        import socket
        HOST, PORT = "{SVC}", 6508
        def oracle(prefix: bytes) -> bytes:
            s = socket.create_connection((HOST, PORT), timeout=5)
            s.sendall(prefix.hex().encode() + b"\\n")
            buf = b""
            while not buf.endswith(b"\\n"): buf += s.recv(4096)
            s.close(); return bytes.fromhex(buf.strip().decode())
        if __name__ == "__main__":
            print("len(oracle(b'')) =", len(oracle(b"")))
    '''))

def lvl09(d, flag, sid, seed):
    wln(d / "challenge.py", textwrap.dedent(f'''\
        # Reference source — LEVEL 09 live server on {SVC}:6509  (Cryptopals 13)
        # PROFILE <email>  -> hex( AES_ECB(key, pad("email=<email>&uid=10&role=user")) )
        # LOGIN   <hex>    -> decrypts, parses the k=v&... profile; if role==admin, prints the flag.
        # ECB encrypts each 16-byte block independently, so you can cut ciphertext blocks
        # from one profile and paste them into another to forge role=admin. '&' and '=' in
        # your email are rejected.
    '''))

L10_PT = b"session=00000000id=42;role=user;lang=en;pad=0000"
def lvl10(d, flag, sid, seed):
    wln(d / "challenge.py", textwrap.dedent(f'''\
        # Reference source — LEVEL 10 live server on {SVC}:6510  (Cryptopals 16)
        # On connect:  TOKEN=<hex(IV || AES_CBC(key, pad(PLAINTEXT)))>
        # PLAINTEXT is three 16-byte blocks:
        #     block0: b"session=00000000"   (throwaway — you may wreck this one)
        #     block1: b"id=42;role=user;"   (turn into  id=42;role=admin)
        #     block2: b"lang=en;pad=0000"
        # Send hex(IV||CT); if the plaintext contains role=admin you get the flag.
        # Flipping byte j of ciphertext block i flips byte j of plaintext block i+1.
    '''))

def lvl11(d, flag, sid, seed):
    key, iv = aes_key(11, sid, seed), aes_iv(11, sid, seed)
    ct = AES.new(key, AES.MODE_CBC, iv).encrypt(pad(msg(flag).encode(), 16))
    wln(d / "ciphertext.txt", (iv + ct).hex() + "\n")
    wln(d / "challenge.py", textwrap.dedent(f'''\
        # Reference source — LEVEL 11 live server on {SVC}:6511  (Cryptopals 17)
        # ciphertext.txt = hex(IV || AES_CBC(key, pad(secret_message))).
        # Send hex(IV||CT); the server decrypts, checks PKCS#7 padding, and replies
        # exactly VALID or INVALID. That one bit, queried ~256x per byte, recovers
        # the whole plaintext without the key.
    '''))

# ===========================================================================
# STREAM
# ===========================================================================
L12_CRIB = (b"MEMO: rotate the signing keys every quarter, retire the legacy CBC "
            b"endpoints, and never, ever reuse a keystream between two messages. "
            b"This paragraph exists only so you have a known plaintext to work with.")
def lvl12(d, flag, sid, seed):
    key = LC.det_bytes(16, sid, seed, "l12_ctrkey")
    nonce = LC.det_bytes(8, sid, seed, "l12_nonce")
    flagmsg = msg(flag).encode()
    n = max(len(L12_CRIB), len(flagmsg))
    ks = AES.new(key, AES.MODE_CTR, nonce=nonce).encrypt(b"\x00" * n)
    ct_crib = bytes(a ^ b for a, b in zip(L12_CRIB, ks))
    ct_flag = bytes(a ^ b for a, b in zip(flagmsg, ks))
    wln(d / "ciphertext_crib.hex", ct_crib.hex() + "\n")
    wln(d / "ciphertext_flag.hex", ct_flag.hex() + "\n")
    wln(d / "crib.txt", L12_CRIB.decode() + "\n")

# ===========================================================================
# RSA
# ===========================================================================
def lvl13(d, flag, sid, seed):
    p = det_prime(512, sid, seed, "l13p"); q = det_prime(512, sid, seed, "l13q")
    while q == p: q = int(nextprime(q))
    n, e = p * q, 65537
    assert gcd(e, (p-1)*(q-1)) == 1
    m = flag_int(flag); assert m < n
    wln(d / "params.txt",
        "# RSA. Build the private key and decrypt c.\n"
        f"p = {p}\nq = {q}\ne = {e}\nc = {pow(m,e,n)}\n")

def lvl14(d, flag, sid, seed):
    p = det_prime(1024, sid, seed, "l14p", cong2mod3=True)
    q = det_prime(1024, sid, seed, "l14q", cong2mod3=True)
    while q == p: q = int(nextprime(q))
    n, e = p * q, 3
    m = flag_int(flag); assert m ** 3 < n
    wln(d / "params.txt", "# Textbook RSA, small exponent.\n"
        f"n = {n}\ne = {e}\nc = {pow(m,e,n)}\n")

def lvl15(d, flag, sid, seed):
    p = det_prime(512, sid, seed, "l15p")
    q = int(nextprime(p + int.from_bytes(LC.det_bytes(2, sid, seed, "l15d"), "big") + 2))
    n, e = p * q, 65537
    assert gcd(e, (p-1)*(q-1)) == 1
    m = flag_int(flag); assert m < n
    wln(d / "public_key.pem", RSA.construct((n, e)).export_key())
    wln(d / "ciphertext.bin", pow(m, e, n).to_bytes((n.bit_length()+7)//8, "big"))

def lvl16(d, flag, sid, seed):
    e = 3; m = flag_int(flag); data = []; N = 1
    ns = []
    for i in range(3):
        p = det_prime(512, sid, seed, f"l16p{i}", cong2mod3=True)
        q = det_prime(512, sid, seed, f"l16q{i}", cong2mod3=True)
        while q == p: q = int(nextprime(q))
        ns.append(p * q)
    for n in ns:
        assert m < n; N *= n
        data.append({"n": n, "e": e, "c": pow(m, e, n)})
    assert m ** 3 < N
    wln(d / "broadcast.json", json.dumps(data, indent=2) + "\n")

# ===========================================================================
# DIFFIE-HELLMAN (notes; live servers in net-services)
# ===========================================================================
def lvl17(d, flag, sid, seed):
    wln(d / "notes.txt", textwrap.dedent(f'''\
        LEVEL 17 — Small-Prime Diffie-Hellman
        Connect:  nc {SVC} 6517   (server prints everything, then closes)
            p=<int>   g=<int>   A=g^a mod p   B=g^b mod p
            IV=<hex>  FLAG_CT=<hex>   ( AES-CBC(key, pad(flag)) )
        shared secret s = g^(ab) = A^b = B^a ;  key = sha256(str(s).encode()).digest()[:16]
        p is small — solve the discrete log for a (baby-step giant-step), then s=B^a, decrypt.
    '''))

def lvl18(d, flag, sid, seed):
    wln(d / "notes.txt", textwrap.dedent(f'''\
        LEVEL 18 — Diffie-Hellman MITM  (Cryptopals 34)
        Connect:  nc {SVC} 6518   (JSON, one object per line)
            1. server->you : {{"step":"alice_hello","p":P,"g":G,"A":A}}
            2. you->server : {{"to":"bob","pub":<value you forward to Bob>}}
            3. server->you : {{"step":"bob_hello","B":B}}
            4. you->server : {{"to":"alice","pub":<value you forward to Alice>}}
            5. server->you : {{"step":"alice_msg","iv":<hex>,"ct":<hex>}}
        Alice encrypts the flag with key = sha256(str(sa)).digest()[:16], sa=(pub you sent Alice)^a.
        Send Alice pub=g so sa=g^a=A (which you already know); decrypt alice_msg for the flag.
    '''))

# ===========================================================================
# WEB
# ===========================================================================
def lvl19(d, flag, sid, seed):
    secret = LC.weak_secret("l19secret", sid, seed)
    wln(d / "wordlist.txt", build_wordlist(secret, sid, seed, "l19") + "\n".join(LC.WEAK_WORDS) + "\n")
    wln(d / "notes.txt", textwrap.dedent(f'''\
        LEVEL 19 — Forge the Token
        Web app:  http://{WEB}:8019/
            POST /login  {{"user":"guest"}}   -> returns a JWT (HS256)
            GET  /admin  with header  Authorization: Bearer <token>  -> flag IF role=admin
        The signing secret is a weak, guessable word (see wordlist.txt). Crack it, forge a
        token with "role":"admin", re-sign with the secret, and call /admin.
    '''))

import jwt as pyjwt
def l20_secret(sid, seed): return LC.weak_secret("l20secret", sid, seed)
def lvl20(d, flag, sid, seed):
    inc = d / "incident"; app = inc / "application"; secret = l20_secret(sid, seed)
    p = det_prime(512, sid, seed, "l20p")
    q = int(nextprime(p + int.from_bytes(LC.det_bytes(2, sid, seed, "l20d"), "big") + 2))
    n, e = p * q, 65537
    assert gcd(e, (p-1)*(q-1)) == 1
    wln(inc / "public_key.pem", RSA.construct((n, e)).export_key())
    aeskey = LC.det_bytes(16, sid, seed, "l20_aeskey"); iv = LC.det_bytes(16, sid, seed, "l20_iv")
    wrapped = pow(int.from_bytes(aeskey, "big"), e, n); ksize = (n.bit_length()+7)//8
    config = (f"[auth-server]\nJWT_SECRET={secret}\n"
              f"ADMIN_ENDPOINT=http://{WEB}:8020/admin\nprovisioned_by=incident-response-lab\n")
    wln(inc / "encrypted_config.bin", AES.new(aeskey, AES.MODE_CBC, iv).encrypt(pad(config.encode(), 16)))
    wln(inc / "auth_token.txt", pyjwt.encode({"user":"guest","role":"user"}, secret, algorithm="HS256") + "\n")
    wln(inc / "network_capture.txt", textwrap.dedent(f'''\
        ============================================================
         RECOVERED NETWORK CAPTURE  (auth-server <-> config-service)
        ============================================================
        >>> POST /provision HTTP/1.1
        >>> X-RSA-Wrapped-AESKey: {wrapped:0{ksize*2}x}
        >>> X-AES-IV: {iv.hex()}
        <<< 200 OK   (encrypted_config.bin delivered out of band)
        <<< admins authorised at http://{WEB}:8020/admin  (Bearer JWT, HS256)

        Analyst notes:
          - wrapped key above = AES-128 key for encrypted_config.bin, RSA-encrypted to
            public_key.pem (e={e}). public_key.pem is hastily generated — factor n, get d.
          - decrypt the config (AES-CBC, IV above) to read JWT_SECRET.
          - forge an admin token and call /admin for the administrator secret.
    '''))
    wln(app / "app.py", textwrap.dedent('''\
        #!/usr/bin/env python3
        # Auth server (excerpt). Runs live at web-crypto:8020.
        import os, jwt
        from flask import Flask, request, jsonify
        app = Flask(__name__)
        JWT_SECRET = os.environ["JWT_SECRET"]   # from the encrypted config
        FINAL_FLAG = os.environ["FINAL_FLAG"]
        @app.route("/admin")
        def admin():
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "): return jsonify(error="missing bearer"), 401
            try: claims = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
            except Exception as e: return jsonify(error=f"bad token: {e}"), 401
            if claims.get("role") != "admin": return jsonify(error="not admin"), 403
            return jsonify(flag=FINAL_FLAG)
    '''))
    wln(inc / "README.txt",
        "Recovered artifacts from the breached authentication server.\n"
        "Start with network_capture.txt and application/app.py, then work the chain.\n")

# ---------------------------------------------------------------------------
BUILDERS = {0:lvl00,1:lvl01,2:lvl02,3:lvl03,4:lvl04,5:lvl05,6:lvl06,7:lvl07,8:lvl08,
            9:lvl09,10:lvl10,11:lvl11,12:lvl12,13:lvl13,14:lvl14,15:lvl15,16:lvl16,
            17:lvl17,18:lvl18,19:lvl19,20:lvl20}

def build_level(n, out_dir, sid, seed):
    flag = LC.flag_for(n, sid, seed)
    d = Path(out_dir) / f"{n:02d}"
    if d.exists():
        import shutil; shutil.rmtree(d)
    d.mkdir(parents=True, exist_ok=True)
    meta = LEVELS_BY_N[n]
    wln(d / "README.txt", "\n".join([
        f"LEVEL {n:02d} — {meta['title']}", f"Concept: {meta['concept']}", "",
        "TASK:", "  " + meta["task"], "",
        "Submit the recovered flag on the portal to unlock the next level.", ""]))
    BUILDERS[n](d, flag, sid, seed)
    return flag

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--student", default=os.environ.get("STUDENT_ID", "student"))
    ap.add_argument("--seed", default=os.environ.get("LAB_SEED", "defaultseed"))
    ap.add_argument("--only", type=int, default=None)
    args = ap.parse_args()
    levels = [args.only] if args.only is not None else list(range(0, 21))
    flags = {}
    for n in levels:
        flags[n] = build_level(n, args.out, args.student, args.seed)
        print(f"[+] level {n:02d}: {flags[n]}")
    keyfile = Path(args.out) / "FLAGS.json"
    existing = json.loads(keyfile.read_text()) if keyfile.exists() else {}
    existing.update({str(k): v for k, v in flags.items()})
    keyfile.write_text(json.dumps(existing, indent=2))
    print(f"[*] wrote answer key -> {keyfile}")

if __name__ == "__main__":
    main()
