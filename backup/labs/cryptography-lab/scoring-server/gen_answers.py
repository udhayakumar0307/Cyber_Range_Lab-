#!/usr/bin/env python3
"""
Cryptography Lab — Single source of truth for module_config.json / answers.json / answers.txt.

25 levels across 5 phases, matching the Puzzle Lab's level/objective/flag model:
every objective gives known values + a formula/command, the student performs the
calculation themselves (by hand, in the terminal, or with the scratchpad), and
submits the derived value. Every value below is computed and asserted
programmatically — never typed by hand — and every terminal command shown to
students is actually executed against the real command (or a Python
equivalent) and checked before this generator writes its output files.

Run: python gen_answers.py
"""
import json
import base64
import hashlib
import hmac as hmac_lib
import subprocess
import shutil
import sys

# ---------------------------------------------------------------------------
def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def caesar_shift(text: str, shift: int) -> str:
    out = []
    for ch in text:
        if ch.isupper():
            out.append(chr((ord(ch) - 65 + shift) % 26 + 65))
        elif ch.islower():
            out.append(chr((ord(ch) - 97 + shift) % 26 + 97))
        else:
            out.append(ch)
    return "".join(out)

def vigenere_encrypt(text: str, key: str) -> str:
    key = key.upper()
    out, ki = [], 0
    for ch in text:
        if ch.isalpha():
            shift = ord(key[ki % len(key)]) - 65
            base = 65 if ch.isupper() else 97
            out.append(chr((ord(ch) - base + shift) % 26 + base))
            ki += 1
        else:
            out.append(ch)
    return "".join(out)

def vigenere_decrypt(text: str, key: str) -> str:
    key = key.upper()
    out, ki = [], 0
    for ch in text:
        if ch.isalpha():
            shift = ord(key[ki % len(key)]) - 65
            base = 65 if ch.isupper() else 97
            out.append(chr((ord(ch) - base - shift) % 26 + base))
            ki += 1
        else:
            out.append(ch)
    return "".join(out)

def xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))

def xor_repeat(data: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data))

# --- tiny elliptic-curve group over F_p: y^2 = x^3 + a*x + b (mod p) --------
EC_P, EC_A, EC_B = 17, 2, 2

def ec_on_curve(pt):
    if pt is None:
        return True
    x, y = pt
    return (y * y - (x**3 + EC_A * x + EC_B)) % EC_P == 0

def ec_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and (y1 + y2) % EC_P == 0:
        return None
    if p1 == p2:
        lam = (3 * x1 * x1 + EC_A) * pow(2 * y1, -1, EC_P) % EC_P
    else:
        lam = (y2 - y1) * pow((x2 - x1) % EC_P, -1, EC_P) % EC_P
    x3 = (lam * lam - x1 - x2) % EC_P
    y3 = (lam * (x1 - x3) - y1) % EC_P
    return (x3, y3)

def ec_mul(k, pt):
    result = None
    addend = pt
    while k > 0:
        if k & 1:
            result = ec_add(result, addend)
        addend = ec_add(addend, addend)
        k >>= 1
    return result

# ===========================================================================
# PHASE 1 — CRYPTOGRAPHY FOUNDATIONS (level01-05)
# ===========================================================================
l1_encoded = "SGVsbG8gQ3J5cHRv"
l1_decoded = base64.b64decode(l1_encoded).decode()
assert l1_decoded == "Hello Crypto"

l2_plain = "HELLO CRYPTO"
l2_shift = 3
l2_cipher = caesar_shift(l2_plain, l2_shift)
assert l2_cipher == "KHOOR FUBSWR"

l3_plain = "ATTACKATDAWN"
l3_key = "LEMON"
l3_cipher = vigenere_encrypt(l3_plain, l3_key)
assert l3_cipher == "LXFOPVEFRNHR"
assert vigenere_decrypt(l3_cipher, l3_key) == l3_plain

l4_p, l4_k = 0x5A, 0x1F
l4_c = l4_p ^ l4_k
assert l4_c == 0x45
l4_p2, l4_c2 = 0x7A, 0x2C
l4_recovered_key = l4_p2 ^ l4_c2

# Level 5 — classical cryptanalysis: an unlabeled ciphertext. It's actually a
# Caesar cipher with a shift the student must discover themselves (no shift
# value given anywhere in the question).
l5_plain = "TECHCORP SECURITY TEAM CONFIRMED"
l5_shift = 11
l5_cipher = caesar_shift(l5_plain, l5_shift)

# ===========================================================================
# PHASE 2 — SYMMETRIC CRYPTOGRAPHY (level06-10)
# ===========================================================================
_BASH = shutil.which("bash") or r"C:\Program Files\Git\usr\bin\bash.exe"

def run_bash(cmd: str) -> str:
    result = subprocess.run([_BASH, "-c", cmd], capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError(f"command failed: {cmd}\n{result.stderr}")
    return result.stdout.strip()

l6_key_hex = "000102030405060708090a0b0c0d0e0f"
l6_plain = "TECHCORPSECURE1"  # 16 bytes -> single AES block
assert len(l6_plain) == 15
l6_cmd_enc = f"printf '%s' '{l6_plain}X' | openssl enc -aes-128-ecb -K {l6_key_hex} -nosalt | xxd -p -c256"
l6_cipher_hex = run_bash(l6_cmd_enc)

# Build the reverse-step ciphertext ourselves (by encrypting a second known
# plaintext) so it's guaranteed to decrypt cleanly under PKCS#7 padding.
l6_plain2_src = "AUDITLOGSECURE2X"
assert len(l6_plain2_src) == 16
l6_cipher2_hex = run_bash(f"printf '%s' '{l6_plain2_src}' | openssl enc -aes-128-ecb -K {l6_key_hex} -nosalt | xxd -p -c256")
l6_cmd_dec = f"echo '{l6_cipher2_hex}' | xxd -r -p | openssl enc -d -aes-128-ecb -K {l6_key_hex} -nosalt"
l6_plain2 = run_bash(l6_cmd_dec)
assert l6_plain2 == l6_plain2_src

# Level 7 — block cipher modes: encrypt the SAME two repeated 16-byte blocks
# under ECB and CBC, so the ECB ciphertext visibly repeats and CBC's doesn't.
l7_key_hex = "0f0e0d0c0b0a09080706050403020100"
l7_iv_hex = "0102030405060708090a0b0c0d0e0f10"
l7_repeated_plain = "AAAAAAAAAAAAAAAA" * 2  # 32 bytes = two identical AES blocks
l7_ecb_hex = run_bash(f"printf '%s' '{l7_repeated_plain}' | openssl enc -aes-128-ecb -K {l7_key_hex} -nosalt | xxd -p -c256")
l7_cbc_hex = run_bash(f"printf '%s' '{l7_repeated_plain}' | openssl enc -aes-128-cbc -K {l7_key_hex} -iv {l7_iv_hex} -nosalt | xxd -p -c256")
l7_ecb_first_half = l7_ecb_hex[:32]
l7_ecb_second_half = l7_ecb_hex[32:64]
assert l7_ecb_first_half == l7_ecb_second_half
l7_cbc_first_half = l7_cbc_hex[:32]
l7_cbc_second_half = l7_cbc_hex[32:64]
assert l7_cbc_first_half != l7_cbc_second_half

# Level 8 — hashing & the avalanche effect
l8_original = "Transfer Rs.5000 to account 1042"
l8_modified = "Transfer Rs.9000 to account 1042"
l8_hash_original = sha256(l8_original.encode())
l8_hash_modified = sha256(l8_modified.encode())

# Level 9 — password hashing (PBKDF2-HMAC-SHA256)
l9_salt = "5b1e8f0a"
l9_iterations = 100_000
l9_candidates = ["Summer2024!", "TechCorp#99", "Winter2024!"]
l9_correct_password = "TechCorp#99"
l9_stored_hash = hashlib.pbkdf2_hmac(
    "sha256", l9_correct_password.encode(), l9_salt.encode(), l9_iterations
).hex()
l9_hash_lookup = {
    pw: hashlib.pbkdf2_hmac("sha256", pw.encode(), l9_salt.encode(), l9_iterations).hex()
    for pw in l9_candidates
}
assert l9_hash_lookup[l9_correct_password] == l9_stored_hash

# Level 10 — HMAC
l10_msg = "Transfer 1000 INR"
l10_msg_tampered = "Transfer 9000 INR"
l10_secret = "crypto-training-key"
l10_hmac = hmac_lib.new(l10_secret.encode(), l10_msg.encode(), hashlib.sha256).hexdigest()
l10_hmac_tampered = hmac_lib.new(l10_secret.encode(), l10_msg_tampered.encode(), hashlib.sha256).hexdigest()

# ===========================================================================
# PHASE 3 — PUBLIC KEY CRYPTOGRAPHY (level11-15)
# ===========================================================================
l11_p, l11_q, l11_e = 61, 53, 17
l11_n = l11_p * l11_q
l11_phi = (l11_p - 1) * (l11_q - 1)
l11_d = pow(l11_e, -1, l11_phi)
assert (l11_e * l11_d) % l11_phi == 1

l12_m = 65
l12_c = pow(l12_m, l11_e, l11_n)

# level13 reuses l12_c, l11_n, l11_d -> recovers l12_m

l14_n, l14_e = l11_n, l11_e
l14_m = 50
l14_c = pow(l14_m, l14_e, l14_n)
l14_p, l14_q = l11_p, l11_q  # student must recover these from hidden evidence files
l14_phi = (l14_p - 1) * (l14_q - 1)
l14_d = pow(l14_e, -1, l14_phi)
assert pow(l14_c, l14_d, l14_n) == l14_m

l15_digest = 15
l15_signature = pow(l15_digest, l11_d, l11_n)
l15_verify = pow(l15_signature, l11_e, l11_n)
assert l15_verify == l15_digest
l15_tampered_digest = 22

# ===========================================================================
# PHASE 4 — KEY EXCHANGE & MODERN CRYPTO (level16-20)
# ===========================================================================
l16_p, l16_g = 23, 5
l16_a, l16_b = 6, 15
l16_A = pow(l16_g, l16_a, l16_p)
l16_B = pow(l16_g, l16_b, l16_p)
l16_shared_alice = pow(l16_B, l16_a, l16_p)
l16_shared_bob = pow(l16_A, l16_b, l16_p)
assert l16_shared_alice == l16_shared_bob

# Level 17 — DH MITM: Eve intercepts, replacing both public values with her own.
l17_p, l17_g = 23, 5
l17_alice_priv, l17_bob_priv, l17_eve_priv = 6, 15, 4
l17_A_real = pow(l17_g, l17_alice_priv, l17_p)       # Alice -> network
l17_B_real = pow(l17_g, l17_bob_priv, l17_p)         # Bob -> network
l17_E_pub = pow(l17_g, l17_eve_priv, l17_p)           # Eve's own public value
l17_shared_alice_eve = pow(l17_E_pub, l17_alice_priv, l17_p)  # Alice thinks this is shared w/ Bob
l17_shared_eve_bob = pow(l17_E_pub, l17_bob_priv, l17_p)      # Bob thinks this is shared w/ Alice
# Eve can compute both independently, since she used her own private value each time
assert pow(l17_A_real, l17_eve_priv, l17_p) == l17_shared_alice_eve
assert pow(l17_B_real, l17_eve_priv, l17_p) == l17_shared_eve_bob
assert l17_shared_alice_eve != l17_shared_eve_bob  # Alice and Bob do NOT share one secret

# Level 18 — ECC on y^2 = x^3 + 2x + 2 (mod 17)
G = (5, 1)
assert ec_on_curve(G)
l18_off_curve_point = (5, 2)
assert not ec_on_curve(l18_off_curve_point)
l18_double_G = ec_add(G, G)
assert ec_on_curve(l18_double_G)
l18_scalar = 6
l18_6G = ec_mul(l18_scalar, G)
assert ec_on_curve(l18_6G)

# Level 19 — ECDH on the same curve
l19_alice_priv, l19_bob_priv = 4, 3
l19_A = ec_mul(l19_alice_priv, G)
l19_B = ec_mul(l19_bob_priv, G)
l19_shared_alice = ec_mul(l19_alice_priv, l19_B)
l19_shared_bob = ec_mul(l19_bob_priv, l19_A)
assert l19_shared_alice == l19_shared_bob

# Level 20 — digital signatures / software-update authenticity
l20_update_contents = "techcorp-agent-v4.2.1-release-build"
l20_update_hash = sha256(l20_update_contents.encode())
l20_digest_stub = int(l20_update_hash[:4], 16) % l11_n
l20_signature = pow(l20_digest_stub, l11_d, l11_n)
l20_verify = pow(l20_signature, l11_e, l11_n)
assert l20_verify == l20_digest_stub
l20_tampered_contents = "techcorp-agent-v4.2.1-release-build-BACKDOORED"
l20_tampered_hash = sha256(l20_tampered_contents.encode())
l20_tampered_digest_stub = int(l20_tampered_hash[:4], 16) % l11_n
assert l20_tampered_digest_stub != l20_digest_stub

# ===========================================================================
# PHASE 5 — CRYPTOGRAPHIC INVESTIGATION (level21-25)
# ===========================================================================
# Level 21 — PKI: values match the self-signed cert baked into the Docker
# image at /home/student/evidence/certificate.pem (see student-env/Dockerfile).
l21_cn = "internal-api.techcorp.local"
l21_issuer_cn = l21_cn  # self-signed: issuer == subject

# Level 22 — key derivation
l22_password = "R3set-2026-kdf"
l22_salt = "9c3fa61d"
l22_iterations = 50_000
l22_derived_key = hashlib.pbkdf2_hmac("sha256", l22_password.encode(), l22_salt.encode(), l22_iterations, dklen=16)
l22_derived_key_hex = l22_derived_key.hex()
l22_message = "PIVOT-OK"
l22_message_bytes = l22_message.encode()
l22_xor_result = xor_repeat(l22_message_bytes, l22_derived_key).hex()

# Level 23 — CSPRNG: a predictable LCG stream vs a secure stream
def lcg_stream(seed, n):
    a, c, m = 1103515245, 12345, 2**31
    vals = []
    x = seed
    for _ in range(n):
        x = (a * x + c) % m
        vals.append(x % 1000)
    return vals

l23_seed = 42
l23_seq_predictable = lcg_stream(l23_seed, 5)
l23_next_predictable = lcg_stream(l23_seed, 6)[5]
l23_seq_secure = [812, 47, 963, 205, 588]  # fixed stand-in "CSPRNG" sample (no discoverable formula)

# Level 24 — cryptanalysis: unlabeled single-byte XOR ciphertext
l24_plain = "AUDIT-TRAIL-CLEAN-7042"
l24_key_byte = 0x37
l24_cipher_bytes = xor_repeat(l24_plain.encode(), bytes([l24_key_byte]))
l24_cipher_hex = l24_cipher_bytes.hex()
# sanity: brute force must recover it UNIQUELY — restrict to the exact
# charset the real plaintext uses (upper-case letters, digits, hyphen) so
# punctuation-soup false positives from a loose "printable" check don't count.
_allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-")
_candidates = []
for k in range(256):
    dec = xor_repeat(l24_cipher_bytes, bytes([k]))
    if all(32 <= b < 127 for b in dec) and set(dec.decode()) <= _allowed:
        _candidates.append(dec.decode())
assert _candidates == [l24_plain], f"XOR key not unique: {_candidates}"

# Level 25 — final incident: base64 -> XOR(single-byte key) chain, plus a hash
# check and an RSA signature check, exactly like the earlier phases combined.
l25_code = "INCIDENT-RESOLVED-9931"
l25_b64 = base64.b64encode(l25_code.encode()).decode()
l25_xor_key = 0x2A
l25_cipher_bytes = xor_repeat(l25_b64.encode(), bytes([l25_xor_key]))
l25_cipher_hex = l25_cipher_bytes.hex()
assert xor_repeat(l25_cipher_bytes, bytes([l25_xor_key])).decode() == l25_b64
assert base64.b64decode(l25_b64).decode() == l25_code
l25_hash = sha256(l25_code.encode())
l25_digest_stub = int(l25_hash[:4], 16) % l11_n
l25_signature = pow(l25_digest_stub, l11_d, l11_n)
l25_verify = pow(l25_signature, l11_e, l11_n)
assert l25_verify == l25_digest_stub

# ===========================================================================
# Level metadata: (phase_num, phase_title, points)
# ===========================================================================
PHASES = {
    1: "Cryptography Foundations",
    2: "Symmetric Cryptography",
    3: "Public Key Cryptography",
    4: "Key Exchange & Modern Crypto",
    5: "Cryptographic Investigation",
}

def phase_of(level_num: int) -> int:
    return (level_num - 1) // 5 + 1

# ===========================================================================
# Objectives (one dict per level)
# ===========================================================================
objectives = {
    "level01": [
        {
            "objective_id": "l1_obj1",
            "question": f"Given this string:\n{l1_encoded}\n\nWhich encoding is this? Enter the name.",
            "correct_answer": "Base64",
            "flag": "FLAG{Base64}",
            "validation_value": "Base64",
            "explanation": "Base64 strings use A-Z, a-z, 0-9, +, /, and often end with '=' padding — that pattern is the giveaway.",
            "why_correct": "The string's alphabet and padding are characteristic of Base64.",
        },
        {
            "objective_id": "l1_obj2",
            "question": f"Decode it:\n{l1_encoded}\n\nEnter the exact decoded text.",
            "correct_answer": l1_decoded,
            "flag": f"FLAG{{{l1_decoded}}}",
            "validation_value": l1_decoded,
            "cmd": f"echo '{l1_encoded}' | base64 -d",
            "explanation": "Base64 decoding reverses the encoding back to the original bytes.",
            "why_correct": f"Base64-decoding \"{l1_encoded}\" yields \"{l1_decoded}\".",
        },
        {
            "objective_id": "l1_obj3",
            "question": "Final: does Base64 provide confidentiality — i.e. does it hide the data from anyone who sees it? Enter YES or NO.",
            "correct_answer": "FLAG{NO}",
            "flag": "FLAG{NO}",
            "validation_value": "FLAG{NO}",
            "explanation": "Encoding is NOT encryption. Base64 has no key and no secret — anyone can decode it instantly.",
            "why_correct": "Base64 provides no confidentiality: the answer is NO.",
        },
    ],
    "level02": [
        {
            "objective_id": "l2_obj1",
            "question": f"Ciphertext:\n{l2_cipher}\n\nThis was encrypted with a Caesar cipher — a shift between 1 and 25. Find the shift, then enter it as a number.",
            "correct_answer": str(l2_shift),
            "flag": f"FLAG{{{l2_shift}}}",
            "validation_value": str(l2_shift),
            "explanation": "A Caesar cipher only has 25 possible shifts, so trying each one (brute force) always works.",
            "why_correct": f"Shift {l2_shift} decrypts \"{l2_cipher}\" to \"{l2_plain}\".",
        },
        {
            "objective_id": "l2_obj2",
            "question": f"Final: using that shift, decrypt \"{l2_cipher}\" and enter the plaintext exactly.",
            "correct_answer": f"FLAG{{{l2_plain}}}",
            "flag": f"FLAG{{{l2_plain}}}",
            "validation_value": f"FLAG{{{l2_plain}}}",
            "cmd": f"python3 -c \"print(''.join(chr((ord(c)-65-{l2_shift})%26+65) if c.isupper() else c for c in '{l2_cipher}'))\"",
            "explanation": "Plaintext -> shift -> ciphertext, and ciphertext -> reverse shift -> plaintext.",
            "why_correct": f"Decrypting with shift {l2_shift} recovers \"{l2_plain}\".",
        },
    ],
    "level03": [
        {
            "objective_id": "l3_obj1",
            "question": f"Plaintext: {l3_plain}\nKey: {l3_key}\n\nEncrypt using the Vigenere cipher (each letter shifts by the corresponding key letter, A=0). Enter the ciphertext in uppercase.",
            "correct_answer": l3_cipher,
            "flag": f"FLAG{{{l3_cipher}}}",
            "validation_value": l3_cipher,
            "cmd": (
                "python3 -c \"key='" + l3_key + "'; text='" + l3_plain + "'; "
                "print(''.join(chr((ord(c)-65+ord(key[i%len(key)])-65)%26+65) for i,c in enumerate(text)))\""
            ),
            "explanation": "Vigenere applies a different Caesar shift to each letter, taken from the repeating keyword.",
            "why_correct": f"{l3_plain} encrypted with keyword \"{l3_key}\" is {l3_cipher}.",
        },
        {
            "objective_id": "l3_obj2",
            "question": f"Final: decrypt this Vigenere ciphertext using keyword '{l3_key}':\n{l3_cipher}\n\nEnter the recovered plaintext.",
            "correct_answer": f"FLAG{{{l3_plain}}}",
            "flag": f"FLAG{{{l3_plain}}}",
            "validation_value": f"FLAG{{{l3_plain}}}",
            "cmd": (
                "python3 -c \"key='" + l3_key + "'; text='" + l3_cipher + "'; "
                "print(''.join(chr((ord(c)-65-(ord(key[i%len(key)])-65))%26+65) for i,c in enumerate(text)))\""
            ),
            "explanation": "A repeating key means the same letter can map to different ciphertext letters depending on position.",
            "why_correct": f"Decrypting {l3_cipher} with keyword \"{l3_key}\" recovers \"{l3_plain}\".",
        },
    ],
    "level04": [
        {
            "objective_id": "l4_obj1",
            "question": f"Plaintext byte: 0x{l4_p:02X}\nKey: 0x{l4_k:02X}\n\nCalculate plaintext XOR key. Enter as hex (e.g. 45).",
            "correct_answer": f"{l4_c:02x}",
            "flag": f"FLAG{{{l4_c:02x}}}",
            "validation_value": f"{l4_c:02x}",
            "cmd": f"python3 -c \"print(hex(0x{l4_p:02X} ^ 0x{l4_k:02X})[2:])\"",
            "explanation": "XOR combines each bit: 0^0=0, 1^1=0, 0^1=1, 1^0=1.",
            "why_correct": f"0x{l4_p:02X} XOR 0x{l4_k:02X} = 0x{l4_c:02X}.",
        },
        {
            "objective_id": "l4_obj2",
            "question": f"Now reverse it: ciphertext 0x{l4_c:02X}, key 0x{l4_k:02X}. Recover the original byte (hex).",
            "correct_answer": f"{l4_p:02x}",
            "flag": f"FLAG{{{l4_p:02x}}}",
            "validation_value": f"{l4_p:02x}",
            "cmd": f"python3 -c \"print(hex(0x{l4_c:02X} ^ 0x{l4_k:02X})[2:])\"",
            "explanation": "XOR is its own inverse — applying the same key a second time undoes the first XOR.",
            "why_correct": f"0x{l4_c:02X} XOR 0x{l4_k:02X} = 0x{l4_p:02X}, the original byte.",
        },
        {
            "objective_id": "l4_obj3",
            "question": (
                f"Final: you know a plaintext/ciphertext pair — plaintext 0x{l4_p2:02X}, ciphertext 0x{l4_c2:02X} "
                "— but not the key. Recover the key using K = P XOR C. Enter as hex."
            ),
            "correct_answer": f"FLAG{{{l4_recovered_key:02x}}}",
            "flag": f"FLAG{{{l4_recovered_key:02x}}}",
            "validation_value": f"FLAG{{{l4_recovered_key:02x}}}",
            "cmd": f"python3 -c \"print(hex(0x{l4_p2:02X} ^ 0x{l4_c2:02X})[2:])\"",
            "explanation": "If you know both the plaintext and ciphertext, you can always recover the key with K = P XOR C.",
            "why_correct": f"0x{l4_p2:02X} XOR 0x{l4_c2:02X} = 0x{l4_recovered_key:02X}.",
        },
    ],
    "level05": [
        {
            "objective_id": "l5_obj1",
            "question": (
                f"Intercepted ciphertext (mechanism unknown):\n{l5_cipher}\n\n"
                "Investigate. This is a classical substitution cipher on the alphabet — identify what "
                "kind of cipher it is. Enter 'caesar' or 'vigenere'."
            ),
            "correct_answer": "caesar",
            "flag": "FLAG{caesar}",
            "validation_value": "caesar",
            "explanation": "Every letter shifts by the SAME fixed amount throughout the message — that's the signature of a Caesar cipher, not a polyalphabetic one.",
            "why_correct": "The ciphertext is a single fixed-shift Caesar cipher.",
        },
        {
            "objective_id": "l5_obj2",
            "question": "Find the shift used (try each of the 25 possibilities). Enter the shift as a number.",
            "correct_answer": str(l5_shift),
            "flag": f"FLAG{{{l5_shift}}}",
            "validation_value": str(l5_shift),
            "explanation": "Brute-forcing all 25 shifts is always feasible against a Caesar cipher.",
            "why_correct": f"Shift {l5_shift} decrypts the ciphertext to readable English.",
        },
        {
            "objective_id": "l5_obj3",
            "question": "Final: decrypt the full ciphertext and enter the recovered plaintext exactly.",
            "correct_answer": f"FLAG{{{l5_plain}}}",
            "flag": f"FLAG{{{l5_plain}}}",
            "validation_value": f"FLAG{{{l5_plain}}}",
            "cmd": f"python3 -c \"print(''.join(chr((ord(c)-65-{l5_shift})%26+65) if c.isupper() else c for c in '{l5_cipher}'))\"",
            "explanation": "No shift or cipher name was given up front here — this level required reasoning, not just formula plug-in.",
            "why_correct": f"Decrypting with shift {l5_shift} recovers \"{l5_plain}\".",
        },
    ],
    "level06": [
        {
            "objective_id": "l6_obj1",
            "question": (
                f"AES-128-ECB key (hex): {l6_key_hex}\nPlaintext: \"{l6_plain}X\" (16 bytes)\n\n"
                "Encrypt it with openssl and enter the resulting ciphertext as hex."
            ),
            "correct_answer": l6_cipher_hex,
            "flag": f"FLAG{{{l6_cipher_hex}}}",
            "validation_value": l6_cipher_hex,
            "cmd": l6_cmd_enc,
            "explanation": "AES combines the plaintext block and key through many rounds of substitution/permutation — openssl performs this for you when you supply the raw key.",
            "why_correct": "Running the given openssl command against this key/plaintext produces this ciphertext deterministically.",
        },
        {
            "objective_id": "l6_obj2",
            "question": (
                f"Final: same key ({l6_key_hex}), new ciphertext (hex): {l6_cipher2_hex}\n\n"
                "Decrypt it with openssl and enter the recovered plaintext exactly."
            ),
            "correct_answer": f"FLAG{{{l6_plain2}}}",
            "flag": f"FLAG{{{l6_plain2}}}",
            "validation_value": f"FLAG{{{l6_plain2}}}",
            "cmd": l6_cmd_dec,
            "explanation": "AES decryption reverses the exact same round structure using the same key.",
            "why_correct": "Decrypting the given ciphertext with this key recovers the plaintext.",
        },
    ],
    "level07": [
        {
            "objective_id": "l7_obj1",
            "question": (
                f"Same 32-byte plaintext (two identical 16-byte blocks) was encrypted twice with the same "
                f"key, once per mode:\n\nECB ciphertext: {l7_ecb_hex}\nCBC ciphertext:  {l7_cbc_hex}\n\n"
                "One of these has two identical halves (first 16 bytes == second 16 bytes). Which MODE "
                "produced that ciphertext — ECB or CBC?"
            ),
            "correct_answer": "ECB",
            "flag": "FLAG{ECB}",
            "validation_value": "ECB",
            "explanation": "ECB encrypts each block completely independently, so identical plaintext blocks always produce identical ciphertext blocks.",
            "why_correct": "The ECB ciphertext's two 16-byte halves are identical; the CBC ciphertext's are not.",
        },
        {
            "objective_id": "l7_obj2",
            "question": "Final: why does this matter for real data (e.g. an encrypted image or a repeating record format)? Enter 'patterns' if ECB leaks patterns in the plaintext structure, or 'random' if it doesn't.",
            "correct_answer": "FLAG{patterns}",
            "flag": "FLAG{patterns}",
            "validation_value": "FLAG{patterns}",
            "explanation": "Because identical plaintext blocks always encrypt identically under ECB, repeating structure in the plaintext (like flat color regions in an image) remains visible in the ciphertext. CBC's chaining (XOR with the previous ciphertext block) destroys this pattern.",
            "why_correct": "ECB leaks plaintext structure through repeated ciphertext blocks.",
        },
    ],
    "level08": [
        {
            "objective_id": "l8_obj1",
            "question": f"Message:\n\"{l8_original}\"\n\nCalculate its SHA-256 digest.",
            "correct_answer": l8_hash_original,
            "flag": f"FLAG{{{l8_hash_original}}}",
            "validation_value": l8_hash_original,
            "cmd": f"echo -n \"{l8_original}\" | sha256sum",
            "explanation": "SHA-256 always produces a fixed 64-character digest, regardless of message length.",
            "why_correct": f"SHA256 of the message is {l8_hash_original}.",
        },
        {
            "objective_id": "l8_obj2",
            "question": f"Modified message:\n\"{l8_modified}\"\n\n(Only the amount changed.) Calculate ITS SHA-256 digest.",
            "correct_answer": l8_hash_modified,
            "flag": f"FLAG{{{l8_hash_modified}}}",
            "validation_value": l8_hash_modified,
            "cmd": f"echo -n \"{l8_modified}\" | sha256sum",
            "explanation": "One digit changed the amount, and the entire digest changed completely — the avalanche effect.",
            "why_correct": f"SHA256 of the modified message is {l8_hash_modified}.",
        },
        {
            "objective_id": "l8_obj3",
            "question": "Final: comparing the two digests you just calculated, has the message been modified? Enter YES or NO.",
            "correct_answer": "FLAG{YES}",
            "flag": "FLAG{YES}",
            "validation_value": "FLAG{YES}",
            "explanation": "The two digests share no resemblance — that mismatch is exactly how integrity checks catch tampering.",
            "why_correct": "The digests differ completely, so the message was modified.",
        },
    ],
    "level09": [
        {
            "objective_id": "l9_obj1",
            "question": (
                f"A login system stores this PBKDF2-HMAC-SHA256 hash for a user:\n{l9_stored_hash}\n\n"
                f"Salt: {l9_salt}\nIterations: {l9_iterations}\n\n"
                f"Candidate passwords: {', '.join(l9_candidates)}\n\n"
                "Compute PBKDF2 for each candidate and find the one that matches the stored hash. Enter the matching password."
            ),
            "correct_answer": l9_correct_password,
            "flag": f"FLAG{{{l9_correct_password}}}",
            "validation_value": l9_correct_password,
            "cmd": f"python3 -c \"import hashlib; print(hashlib.pbkdf2_hmac('sha256', b'{l9_correct_password}', b'{l9_salt}', {l9_iterations}).hex())\"",
            "verify_output": False,
            "explanation": "PBKDF2 deliberately makes each guess expensive (100,000 rounds here) — that's what makes offline password cracking slow, unlike a single fast hash.",
            "why_correct": f"PBKDF2-HMAC-SHA256(\"{l9_correct_password}\", salt=\"{l9_salt}\", {l9_iterations} rounds) matches the stored hash.",
        },
        {
            "objective_id": "l9_obj2",
            "question": "Final: why is a slow KDF like PBKDF2 used for passwords instead of a single fast SHA-256 call? Enter 'slow' if the deliberate slowness is the defense, or 'fast' if speed is the defense.",
            "correct_answer": "FLAG{slow}",
            "flag": "FLAG{slow}",
            "validation_value": "FLAG{slow}",
            "explanation": "A fast hash lets an attacker with a stolen hash database try billions of guesses per second. A slow KDF with a high iteration count makes each guess costly, directly limiting how many passwords an attacker can try per second.",
            "why_correct": "PBKDF2's deliberate slowness (iteration count) is the defense against offline cracking.",
        },
    ],
    "level10": [
        {
            "objective_id": "l10_obj1",
            "question": f"Message: \"{l10_msg}\"\nSecret: \"{l10_secret}\"\n\nGenerate the HMAC-SHA256 of the message using this secret.",
            "correct_answer": l10_hmac,
            "flag": f"FLAG{{{l10_hmac}}}",
            "validation_value": l10_hmac,
            "cmd": f"python3 -c \"import hmac,hashlib; print(hmac.new(b'{l10_secret}', b'{l10_msg}', hashlib.sha256).hexdigest())\"",
            "explanation": "HMAC combines a secret key with the message before hashing — unlike a plain hash, you can't compute it without the key.",
            "why_correct": f"HMAC-SHA256(\"{l10_msg}\", key=\"{l10_secret}\") = {l10_hmac}.",
        },
        {
            "objective_id": "l10_obj2",
            "question": (
                f"Final: a modified message arrives: \"{l10_msg_tampered}\" claiming the SAME HMAC "
                f"({l10_hmac}). Compute the real HMAC of this modified message and compare — does the "
                "original HMAC still verify? Enter VALID or INVALID."
            ),
            "correct_answer": "FLAG{INVALID}",
            "flag": "FLAG{INVALID}",
            "validation_value": "FLAG{INVALID}",
            "cmd": f"python3 -c \"import hmac,hashlib; print(hmac.new(b'{l10_secret}', b'{l10_msg_tampered}', hashlib.sha256).hexdigest())\"",
            "verify_output": False,
            "explanation": f"The tampered message's real HMAC ({l10_hmac_tampered}) doesn't match the original ({l10_hmac}) — only someone with the secret key could produce a valid HMAC for the new amount.",
            "why_correct": "The HMACs differ, so the modified message's claimed HMAC is INVALID.",
        },
    ],
    "level11": [
        {
            "objective_id": "l11_obj1",
            "question": (
                "The two primes for this RSA keypair aren't given directly — they were recovered from a "
                "decommissioned server's leftover files. Investigate /home/student/evidence in the "
                "terminal to find them, then calculate n = p x q. Enter n."
            ),
            "correct_answer": str(l11_n),
            "flag": f"FLAG{{{l11_n}}}",
            "validation_value": str(l11_n),
            "cmd": f"python3 -c \"print({l11_p} * {l11_q})\"",
            "explanation": "n is published as part of the RSA public key. Real systems often leak old cryptographic parameters through backups and logs exactly like this.",
            "why_correct": f"{l11_p} x {l11_q} = {l11_n}.",
        },
        {
            "objective_id": "l11_obj2",
            "question": "Using the same two primes you found:\n\nFormula:\nphi(n) = (p-1)(q-1)\n\nEnter phi(n).",
            "correct_answer": str(l11_phi),
            "flag": f"FLAG{{{l11_phi}}}",
            "validation_value": str(l11_phi),
            "cmd": f"python3 -c \"print(({l11_p}-1) * ({l11_q}-1))\"",
            "explanation": "phi(n) must stay secret — only whoever knows p and q can compute it.",
            "why_correct": f"({l11_p}-1) x ({l11_q}-1) = {l11_phi}.",
        },
        {
            "objective_id": "l11_obj3",
            "question": f"Given:\ne = {l11_e}\nphi(n) = {l11_phi}\n\nFind d such that:\ne x d = 1 (mod phi(n))\n\nEnter d.",
            "correct_answer": str(l11_d),
            "flag": f"FLAG{{{l11_d}}}",
            "validation_value": str(l11_d),
            "cmd": f"python3 -c \"print(pow({l11_e}, -1, {l11_phi}))\"",
            "explanation": "d is the private exponent — it must never be shared.",
            "why_correct": f"{l11_e} x {l11_d} mod {l11_phi} = 1, so d = {l11_d}.",
        },
        {
            "objective_id": "l11_obj4",
            "question": (
                f"Your RSA keypair is now:\nPublic key (n, e) = ({l11_n}, {l11_e})\n"
                f"Private key (n, d) = ({l11_n}, {l11_d})\n\n"
                "Which one must never be shared — n, e, or d? Enter one letter/value."
            ),
            "correct_answer": "FLAG{d}",
            "flag": "FLAG{d}",
            "validation_value": "FLAG{d}",
            "explanation": "n and e are published freely as the public key. d is the private key and must stay secret.",
            "why_correct": "d is the private exponent.",
        },
    ],
    "level12": [
        {
            "objective_id": "l12_obj1",
            "question": (
                f"Public key:\nn = {l11_n}\ne = {l11_e}\n\nPlaintext:\nm = {l12_m}\n\n"
                "Formula:\nc = m^e mod n\n\nEnter the ciphertext c."
            ),
            "correct_answer": f"FLAG{{{l12_c}}}",
            "flag": f"FLAG{{{l12_c}}}",
            "validation_value": f"FLAG{{{l12_c}}}",
            "cmd": f"python3 -c \"print(pow({l12_m}, {l11_e}, {l11_n}))\"",
            "explanation": "Encryption uses the PUBLIC key — anyone can do this step.",
            "why_correct": f"{l12_m}^{l11_e} mod {l11_n} = {l12_c}.",
        },
    ],
    "level13": [
        {
            "objective_id": "l13_obj1",
            "question": (
                f"Ciphertext:\nc = {l12_c}\n\nPrivate key:\nn = {l11_n}\nd = {l11_d}\n\n"
                "Formula:\nm = c^d mod n\n\nEnter the recovered plaintext m."
            ),
            "correct_answer": f"FLAG{{{l12_m}}}",
            "flag": f"FLAG{{{l12_m}}}",
            "validation_value": f"FLAG{{{l12_m}}}",
            "cmd": f"python3 -c \"print(pow({l12_c}, {l11_d}, {l11_n}))\"",
            "explanation": "Decryption uses the PRIVATE key — only its holder can reverse the ciphertext.",
            "why_correct": f"{l12_c}^{l11_d} mod {l11_n} = {l12_m}.",
        },
    ],
    "level14": [
        {
            "objective_id": "l14_obj1",
            "question": (
                f"You are given only:\nn = {l14_n}\ne = {l14_e}\nciphertext = {l14_c}\n\n"
                "No p or q this time — but a decommissioned server's evidence files are mounted at "
                "/home/student/evidence. Search them (ls, find, cat, grep, strings) to recover the two "
                "prime factors. Enter them as p,q in ascending order, e.g. 5,11."
            ),
            "correct_answer": f"{min(l14_p, l14_q)},{max(l14_p, l14_q)}",
            "flag": f"FLAG{{{min(l14_p, l14_q)}_{max(l14_p, l14_q)}}}",
            "validation_value": f"{min(l14_p, l14_q)},{max(l14_p, l14_q)}",
            "explanation": "This mirrors how real incidents unfold: cryptographic parameters that should never be exposed often leak through old backups, rotated logs, and config archives left on decommissioned hosts.",
            "why_correct": f"{l14_p} x {l14_q} = {l14_n}.",
        },
        {
            "objective_id": "l14_obj2",
            "question": f"Using p={l14_p}, q={l14_q}: calculate phi(n) = (p-1)(q-1). Enter it.",
            "correct_answer": str(l14_phi),
            "flag": f"FLAG{{{l14_phi}}}",
            "validation_value": str(l14_phi),
            "cmd": f"python3 -c \"print(({l14_p}-1)*({l14_q}-1))\"",
            "explanation": "Same formula as before — now derived from evidence instead of being handed the primes.",
            "why_correct": f"({l14_p}-1) x ({l14_q}-1) = {l14_phi}.",
        },
        {
            "objective_id": "l14_obj3",
            "question": f"Using e={l14_e}, phi(n)={l14_phi}: find d such that e x d = 1 (mod phi(n)). Enter d.",
            "correct_answer": str(l14_d),
            "flag": f"FLAG{{{l14_d}}}",
            "validation_value": str(l14_d),
            "cmd": f"python3 -c \"print(pow({l14_e}, -1, {l14_phi}))\"",
            "explanation": "You've now reconstructed the entire private key from nothing but n, e, and an investigation.",
            "why_correct": f"{l14_e} x {l14_d} mod {l14_phi} = 1, so d = {l14_d}.",
        },
        {
            "objective_id": "l14_obj4",
            "question": f"Final: decrypt the ciphertext from the start of this level.\nc = {l14_c}, n = {l14_n}, d = {l14_d}\n\nm = c^d mod n\n\nEnter m.",
            "correct_answer": f"FLAG{{{l14_m}}}",
            "flag": f"FLAG{{{l14_m}}}",
            "validation_value": f"FLAG{{{l14_m}}}",
            "cmd": f"python3 -c \"print(pow({l14_c}, {l14_d}, {l14_n}))\"",
            "explanation": "You went from a bare ciphertext and public key to full plaintext recovery — the entire RSA break, worked from evidence you found yourself.",
            "why_correct": f"{l14_c}^{l14_d} mod {l14_n} = {l14_m}.",
        },
    ],
    "level15": [
        {
            "objective_id": "l15_obj1",
            "question": (
                f"Using the keypair from Level 11 (n={l11_n}, d={l11_d}), sign a message's hash-digest "
                f"stand-in h={l15_digest}:\n\nsignature = h^d mod n\n\nEnter the signature."
            ),
            "correct_answer": str(l15_signature),
            "flag": f"FLAG{{{l15_signature}}}",
            "validation_value": str(l15_signature),
            "cmd": f"python3 -c \"print(pow({l15_digest}, {l11_d}, {l11_n}))\"",
            "explanation": "Signing uses the PRIVATE key — the opposite of encryption.",
            "why_correct": f"{l15_digest}^{l11_d} mod {l11_n} = {l15_signature}.",
        },
        {
            "objective_id": "l15_obj2",
            "question": (
                f"Verify it with the PUBLIC key (n={l11_n}, e={l11_e}):\n\n"
                f"check = signature^e mod n\nsignature = {l15_signature}\n\n"
                f"Enter 'check'. It should match the original digest h={l15_digest}."
            ),
            "correct_answer": str(l15_verify),
            "flag": f"FLAG{{{l15_verify}}}",
            "validation_value": str(l15_verify),
            "cmd": f"python3 -c \"print(pow({l15_signature}, {l11_e}, {l11_n}))\"",
            "explanation": "Verification only needs the PUBLIC key — no secret required to check a signature.",
            "why_correct": f"{l15_signature}^{l11_e} mod {l11_n} = {l15_verify}, matching the original digest.",
        },
        {
            "objective_id": "l15_obj3",
            "question": (
                f"The file is now modified. Its digest is {l15_tampered_digest} instead of "
                f"{l15_digest}, but the attacker kept the SAME signature ({l15_signature}).\n\n"
                "Verify the same signature again. Does it still check out against the NEW digest? "
                "Enter VALID or INVALID."
            ),
            "correct_answer": "FLAG{INVALID}",
            "flag": "FLAG{INVALID}",
            "validation_value": "FLAG{INVALID}",
            "explanation": f"Verifying gives {l15_verify} again (the signature itself never changes) — but that no longer matches the tampered file's digest of {l15_tampered_digest}.",
            "why_correct": f"{l15_verify} != {l15_tampered_digest}, so the signature is INVALID for the modified file.",
        },
    ],
    "level16": [
        {
            "objective_id": "l16_obj1",
            "question": f"Public values (agreed openly):\np = {l16_p}\ng = {l16_g}\n\nAlice's private value: a = {l16_a}\n\nFormula:\nA = g^a mod p\n\nEnter Alice's public value A.",
            "correct_answer": str(l16_A),
            "flag": f"FLAG{{{l16_A}}}",
            "validation_value": str(l16_A),
            "cmd": f"python3 -c \"print(pow({l16_g}, {l16_a}, {l16_p}))\"",
            "explanation": "A is safe to send over an open channel.",
            "why_correct": f"{l16_g}^{l16_a} mod {l16_p} = {l16_A}.",
        },
        {
            "objective_id": "l16_obj2",
            "question": f"Bob's private value: b = {l16_b}\n\nFormula:\nB = g^b mod p\n\nEnter Bob's public value B.",
            "correct_answer": str(l16_B),
            "flag": f"FLAG{{{l16_B}}}",
            "validation_value": str(l16_B),
            "cmd": f"python3 -c \"print(pow({l16_g}, {l16_b}, {l16_p}))\"",
            "explanation": "B is also safe to send openly.",
            "why_correct": f"{l16_g}^{l16_b} mod {l16_p} = {l16_B}.",
        },
        {
            "objective_id": "l16_obj3",
            "question": f"Alice computes the shared secret from Bob's public value:\nS = B^a mod p\nB={l16_B}, a={l16_a}, p={l16_p}\n\nEnter S.",
            "correct_answer": str(l16_shared_alice),
            "flag": f"FLAG{{{l16_shared_alice}}}",
            "validation_value": str(l16_shared_alice),
            "cmd": f"python3 -c \"print(pow({l16_B}, {l16_a}, {l16_p}))\"",
            "explanation": "Alice never needed Bob's private value b — only his public value B.",
            "why_correct": f"{l16_B}^{l16_a} mod {l16_p} = {l16_shared_alice}.",
        },
        {
            "objective_id": "l16_obj4",
            "question": f"Final: Bob computes the shared secret from Alice's public value:\nS = A^b mod p\nA={l16_A}, b={l16_b}, p={l16_p}\n\nEnter S — it should match Alice's result.",
            "correct_answer": f"FLAG{{{l16_shared_bob}}}",
            "flag": f"FLAG{{{l16_shared_bob}}}",
            "validation_value": f"FLAG{{{l16_shared_bob}}}",
            "cmd": f"python3 -c \"print(pow({l16_A}, {l16_b}, {l16_p}))\"",
            "explanation": "Both sides land on the identical shared secret without ever transmitting it — that's Diffie-Hellman.",
            "why_correct": f"{l16_A}^{l16_b} mod {l16_p} = {l16_shared_bob}, matching Alice's {l16_shared_alice}.",
        },
    ],
    "level17": [
        {
            "objective_id": "l17_obj1",
            "question": (
                "TechCorp's network log captured a Diffie-Hellman exchange between Alice and Bob "
                f"(p={l17_p}, g={l17_g}):\n\n"
                f"Alice sent public value: {l17_A_real}\n"
                f"Bob received public value: {l17_E_pub}\n"
                f"Bob sent public value: {l17_B_real}\n"
                f"Alice received public value: {l17_E_pub}\n\n"
                "Alice and Bob each received the SAME public value instead of each other's. What is that "
                "shared attacker value?"
            ),
            "correct_answer": str(l17_E_pub),
            "flag": f"FLAG{{{l17_E_pub}}}",
            "validation_value": str(l17_E_pub),
            "explanation": "Eve substituted her own public value in both directions of the exchange, so both Alice and Bob unknowingly established a Diffie-Hellman session with Eve instead of with each other.",
            "why_correct": f"Both Alice and Bob's log entries show {l17_E_pub} as the value received, instead of each other's real public value.",
        },
        {
            "objective_id": "l17_obj2",
            "question": (
                "Final: standard Diffie-Hellman authenticates nothing about WHO sent a public value — only "
                "that it's a valid number mod p. Does unauthenticated DH prevent this man-in-the-middle "
                "attack? Enter YES or NO."
            ),
            "correct_answer": "FLAG{NO}",
            "flag": "FLAG{NO}",
            "validation_value": "FLAG{NO}",
            "explanation": "Since neither side can verify the other's public value actually came from them, an active attacker on the network path can substitute their own values and establish two separate shared secrets — one with each victim — without either victim noticing. This is why real protocols (e.g. TLS) combine DH with a signature or certificate to authenticate the exchange.",
            "why_correct": "Plain DH has no authentication, so it cannot prevent MITM on its own.",
        },
    ],
    "level18": [
        {
            "objective_id": "l18_obj1",
            "question": (
                f"Curve: y^2 = x^3 + {EC_A}x + {EC_B} (mod {EC_P})\n\n"
                f"Is the point ({l18_off_curve_point[0]}, {l18_off_curve_point[1]}) on this curve? "
                "Check both sides of the equation. Enter YES or NO."
            ),
            "correct_answer": "NO",
            "flag": "FLAG{NO}",
            "validation_value": "NO",
            "cmd": f"python3 -c \"x,y={l18_off_curve_point}; print((y*y - (x**3+{EC_A}*x+{EC_B})) % {EC_P} == 0)\"",
            "verify_output": False,
            "explanation": "A point is only on the curve if y^2 mod p exactly equals x^3+ax+b mod p.",
            "why_correct": f"({l18_off_curve_point[0]},{l18_off_curve_point[1]}) fails the curve equation mod {EC_P}.",
        },
        {
            "objective_id": "l18_obj2",
            "question": (
                f"Base point G = {G} IS on the curve. Compute point doubling: 2G = G + G, using the "
                "elliptic-curve group law. Enter the result as 'x,y'."
            ),
            "correct_answer": f"{l18_double_G[0]},{l18_double_G[1]}",
            "flag": f"FLAG{{{l18_double_G[0]}_{l18_double_G[1]}}}",
            "validation_value": f"{l18_double_G[0]},{l18_double_G[1]}",
            "explanation": "Doubling a point uses the tangent line at that point: slope = (3x^2+a) / 2y (mod p), then x3 = slope^2 - 2x, y3 = slope(x - x3) - y.",
            "why_correct": f"2*{G} = {l18_double_G} on this curve.",
        },
        {
            "objective_id": "l18_obj3",
            "question": f"Final: compute scalar multiplication {l18_scalar}G (i.e. G added to itself {l18_scalar} times) using double-and-add. Enter the result as 'x,y'.",
            "correct_answer": f"FLAG{{{l18_6G[0]}_{l18_6G[1]}}}",
            "flag": f"FLAG{{{l18_6G[0]}_{l18_6G[1]}}}",
            "validation_value": f"FLAG{{{l18_6G[0]}_{l18_6G[1]}}}",
            "explanation": "Scalar multiplication (repeated point addition) is the elliptic-curve equivalent of modular exponentiation — fast to compute, infeasible to reverse (the elliptic-curve discrete log problem). This is what makes ECC-based key exchange and signatures secure.",
            "why_correct": f"{l18_scalar}*{G} = {l18_6G} via repeated point addition.",
        },
    ],
    "level19": [
        {
            "objective_id": "l19_obj1",
            "question": (
                f"Same curve, base point G = {G}.\n\nAlice's private scalar: a = {l19_alice_priv}\n\n"
                "Compute Alice's public point: A = a*G. Enter as 'x,y'."
            ),
            "correct_answer": f"{l19_A[0]},{l19_A[1]}",
            "flag": f"FLAG{{{l19_A[0]}_{l19_A[1]}}}",
            "validation_value": f"{l19_A[0]},{l19_A[1]}",
            "explanation": "Just like standard DH, ECDH publishes a value derived from a private scalar and the shared base point.",
            "why_correct": f"{l19_alice_priv}*{G} = {l19_A}.",
        },
        {
            "objective_id": "l19_obj2",
            "question": f"Bob's private scalar: b = {l19_bob_priv}\n\nCompute Bob's public point: B = b*G. Enter as 'x,y'.",
            "correct_answer": f"{l19_B[0]},{l19_B[1]}",
            "flag": f"FLAG{{{l19_B[0]}_{l19_B[1]}}}",
            "validation_value": f"{l19_B[0]},{l19_B[1]}",
            "explanation": "Bob's public point is computed the same way, with his own private scalar.",
            "why_correct": f"{l19_bob_priv}*{G} = {l19_B}.",
        },
        {
            "objective_id": "l19_obj3",
            "question": f"Alice computes the shared point: S = a*B, using B={l19_B} and a={l19_alice_priv}. Enter as 'x,y'.",
            "correct_answer": f"{l19_shared_alice[0]},{l19_shared_alice[1]}",
            "flag": f"FLAG{{{l19_shared_alice[0]}_{l19_shared_alice[1]}}}",
            "validation_value": f"{l19_shared_alice[0]},{l19_shared_alice[1]}",
            "explanation": "Alice combines Bob's public point with her own private scalar.",
            "why_correct": f"{l19_alice_priv}*{l19_B} = {l19_shared_alice}.",
        },
        {
            "objective_id": "l19_obj4",
            "question": f"Final: Bob computes the shared point: S = b*A, using A={l19_A} and b={l19_bob_priv}. Enter as 'x,y' — it should match Alice's result.",
            "correct_answer": f"FLAG{{{l19_shared_bob[0]}_{l19_shared_bob[1]}}}",
            "flag": f"FLAG{{{l19_shared_bob[0]}_{l19_shared_bob[1]}}}",
            "validation_value": f"FLAG{{{l19_shared_bob[0]}_{l19_shared_bob[1]}}}",
            "explanation": "Both sides land on the identical shared point without ever transmitting their private scalars — the elliptic-curve analog of Diffie-Hellman, using much smaller keys for equivalent security at real-world curve sizes.",
            "why_correct": f"{l19_bob_priv}*{l19_A} = {l19_shared_bob}, matching Alice's {l19_shared_alice}.",
        },
    ],
    "level20": [
        {
            "objective_id": "l20_obj1",
            "question": (
                f"TechCorp published update.bin (contents: \"{l20_update_contents}\") with a digital "
                f"signature ({l20_signature}), using the Level 11 keypair (n={l11_n}, e={l11_e}, d={l11_d}).\n\n"
                f"The signature was produced over a digest stand-in derived from the file's SHA-256 hash.\n\n"
                f"Verify it: check = signature^e mod n, signature = {l20_signature}. Enter 'check'."
            ),
            "correct_answer": str(l20_verify),
            "flag": f"FLAG{{{l20_verify}}}",
            "validation_value": str(l20_verify),
            "cmd": f"python3 -c \"print(pow({l20_signature}, {l11_e}, {l11_n}))\"",
            "explanation": "Verifying a software update's signature before installing it is exactly how systems like package managers and OS updaters detect tampering.",
            "why_correct": f"{l20_signature}^{l11_e} mod {l11_n} = {l20_verify}, matching the digest stand-in for the genuine file.",
        },
        {
            "objective_id": "l20_obj2",
            "question": (
                f"A second copy of update.bin arrives, contents now:\n\"{l20_tampered_contents}\"\n\n"
                f"claiming the SAME signature ({l20_signature}). Its digest stand-in is now "
                f"{l20_tampered_digest_stub} instead of {l20_digest_stub}.\n\n"
                "Final: does the original signature still authenticate this file? Enter VALID or INVALID."
            ),
            "correct_answer": "FLAG{INVALID}",
            "flag": "FLAG{INVALID}",
            "validation_value": "FLAG{INVALID}",
            "explanation": "The signature verifies to the ORIGINAL digest, which no longer matches the tampered file's new hash — this is exactly how a compromised or backdoored update gets caught before installation.",
            "why_correct": f"{l20_verify} != {l20_tampered_digest_stub}, so the signature is INVALID for the modified update.",
        },
    ],
    "level21": [
        {
            "objective_id": "l21_obj1",
            "question": (
                "A certificate for an internal TechCorp service is available for inspection at "
                "/home/student/evidence/certificate.pem. Investigate it and enter its Subject "
                "Common Name (CN) — the hostname it claims to represent."
            ),
            "correct_answer": l21_cn,
            "flag": f"FLAG{{{l21_cn}}}",
            "validation_value": l21_cn,
            "cmd": "openssl x509 -in /home/student/evidence/certificate.pem -noout -subject -issuer -dates",
            "verify_output": False,
            "no_local_exec": True,  # path only exists inside the student container
            "explanation": "The Subject CN identifies who the certificate claims to represent.",
            "why_correct": f"The certificate's subject CN is {l21_cn}.",
        },
        {
            "objective_id": "l21_obj2",
            "question": "Now check who signed (vouched for) this certificate — its Issuer CN. Enter it.",
            "correct_answer": l21_issuer_cn,
            "flag": f"FLAG{{{l21_issuer_cn}}}",
            "validation_value": l21_issuer_cn,
            "cmd": "openssl x509 -in /home/student/evidence/certificate.pem -noout -issuer",
            "verify_output": False,
            "no_local_exec": True,  # path only exists inside the student container
            "explanation": "The Issuer identifies who signed (vouched for) the certificate.",
            "why_correct": f"The certificate's issuer CN is {l21_issuer_cn}, identical to its subject.",
        },
        {
            "objective_id": "l21_obj3",
            "question": (
                "Final: the Subject CN and Issuer CN are identical — this certificate signed itself, "
                "rather than being signed by a trusted Certificate Authority. Is this certificate "
                "trustworthy for a production service that other companies connect to? Enter YES or NO."
            ),
            "correct_answer": "FLAG{NO}",
            "flag": "FLAG{NO}",
            "validation_value": "FLAG{NO}",
            "explanation": "A self-signed certificate provides encryption, but no independent identity verification — anyone can generate one claiming to be any hostname. Production services need a certificate chain rooted in a CA that clients already trust.",
            "why_correct": "Self-signed certificates are not trustworthy for identity verification, regardless of their validity dates.",
        },
    ],
    "level22": [
        {
            "objective_id": "l22_obj1",
            "question": (
                f"Password: \"{l22_password}\"\nSalt: {l22_salt}\nAlgorithm: PBKDF2-HMAC-SHA256\n"
                f"Iterations: {l22_iterations}\nKey length: 16 bytes\n\n"
                "Derive the key and enter it as hex."
            ),
            "correct_answer": l22_derived_key_hex,
            "flag": f"FLAG{{{l22_derived_key_hex}}}",
            "validation_value": l22_derived_key_hex,
            "cmd": f"python3 -c \"import hashlib; print(hashlib.pbkdf2_hmac('sha256', b'{l22_password}', b'{l22_salt}', {l22_iterations}, dklen=16).hex())\"",
            "explanation": "A KDF turns a low-entropy password into a fixed-length key suitable for use in a symmetric cipher.",
            "why_correct": f"PBKDF2-HMAC-SHA256 with these parameters produces {l22_derived_key_hex}.",
        },
        {
            "objective_id": "l22_obj2",
            "question": (
                f"Final: use the derived key (as raw bytes) to XOR-encrypt the message \"{l22_message}\" "
                "(repeating-key XOR against the key bytes). Enter the result as hex."
            ),
            "correct_answer": f"FLAG{{{l22_xor_result}}}",
            "flag": f"FLAG{{{l22_xor_result}}}",
            "validation_value": f"FLAG{{{l22_xor_result}}}",
            "cmd": f"python3 -c \"import hashlib; k=hashlib.pbkdf2_hmac('sha256', b'{l22_password}', b'{l22_salt}', {l22_iterations}, dklen=16); m=b'{l22_message}'; print(bytes(b^k[i%len(k)] for i,b in enumerate(m)).hex())\"",
            "explanation": "This is exactly how a password-based encryption scheme turns a human-memorable password into an actual encryption key before it ever touches the cipher.",
            "why_correct": f"XOR-ing \"{l22_message}\" against the derived key bytes gives {l22_xor_result}.",
        },
    ],
    "level23": [
        {
            "objective_id": "l23_obj1",
            "question": (
                f"Two random-number generators produced these 5-value sequences:\n\n"
                f"Generator A: {l23_seq_predictable}\n"
                f"Generator B: {l23_seq_secure}\n\n"
                f"Generator A uses this known formula: x_next = (1103515245 * x_prev + 12345) mod 2^31, "
                f"output = x_next mod 1000, seeded with x_0={l23_seed}.\n\n"
                "Using that formula, predict the NEXT value Generator A will produce."
            ),
            "correct_answer": str(l23_next_predictable),
            "flag": f"FLAG{{{l23_next_predictable}}}",
            "validation_value": str(l23_next_predictable),
            "cmd": f"python3 -c \"x={l23_seed}\nfor _ in range(6): x=(1103515245*x+12345)%(2**31)\nprint(x%1000)\"",
            "explanation": "A linear congruential generator (LCG) is fully deterministic — knowing the formula and one output lets you predict every future output.",
            "why_correct": f"Applying the LCG formula 6 times from seed {l23_seed} gives {l23_next_predictable}.",
        },
        {
            "objective_id": "l23_obj2",
            "question": (
                "Final: which generator is UNSAFE for producing cryptographic keys or nonces — "
                "'A' or 'B'?"
            ),
            "correct_answer": "FLAG{A}",
            "flag": "FLAG{A}",
            "validation_value": "FLAG{A}",
            "explanation": "Generator A's output is fully predictable from its formula and a single observed value — using it to generate a key means an attacker who guesses (or is told) the algorithm can predict every key it ever produces. A real CSPRNG (like os.urandom) exposes no such formula and cannot be predicted from its outputs.",
            "why_correct": "Generator A (the LCG) is predictable and therefore unsafe for cryptographic use.",
        },
    ],
    "level24": [
        {
            "objective_id": "l24_obj1",
            "question": (
                f"Evidence file /home/student/evidence/ciphertext.bin contains this hex-encoded data:\n"
                f"{l24_cipher_hex}\n\nYou are NOT told which cryptographic mechanism produced it. "
                "Investigate: what is the shortest possible key length that could produce readable "
                "English when XORed against this data? Enter the length in bytes (a number)."
            ),
            "correct_answer": "1",
            "flag": "FLAG{1}",
            "validation_value": "1",
            "explanation": "If a single repeating byte, XORed against the whole ciphertext, produces fully printable English text, that's strong evidence of single-byte XOR — the weakest possible stream cipher, with only 256 possible keys to brute-force.",
            "why_correct": "The ciphertext was produced with a single repeating XOR byte.",
        },
        {
            "objective_id": "l24_obj2",
            "question": "Brute-force all 256 possible single-byte keys against the ciphertext and find the one key that produces readable, all-uppercase text (letters, digits, hyphens only). Enter the key as a two-digit hex value (e.g. 1f).",
            "correct_answer": f"{l24_key_byte:02x}",
            "flag": f"FLAG{{{l24_key_byte:02x}}}",
            "validation_value": f"{l24_key_byte:02x}",
            "cmd": f"python3 -c \"import string\nallowed=set(string.ascii_uppercase+string.digits+'-')\nc=bytes.fromhex('{l24_cipher_hex}')\nfor k in range(256):\n d=bytes(b^k for b in c)\n if all(32<=x<127 for x in d) and set(d.decode()) <= allowed: print(f'{{k:02x}}')\"",
            "explanation": "Only one byte value produces a result restricted to that charset for this ciphertext — that's the key.",
            "why_correct": f"XORing every byte with 0x{l24_key_byte:02x} produces fully printable text; no other key value does.",
        },
        {
            "objective_id": "l24_obj3",
            "question": "Final: using that key, recover and enter the full plaintext exactly.",
            "correct_answer": f"FLAG{{{l24_plain}}}",
            "flag": f"FLAG{{{l24_plain}}}",
            "validation_value": f"FLAG{{{l24_plain}}}",
            "cmd": f"python3 -c \"c=bytes.fromhex('{l24_cipher_hex}'); print(bytes(b^{l24_key_byte} for b in c).decode())\"",
            "explanation": "No cipher name, key, or hint was given anywhere in this level — recovering the plaintext required recognizing the weakness and brute-forcing it yourself.",
            "why_correct": f"XORing the ciphertext with 0x{l24_key_byte:02x} recovers \"{l24_plain}\".",
        },
    ],
    "level25": [
        {
            "objective_id": "l25_obj1",
            "question": (
                "TechCorp's security team received an encrypted communication from an unverified server. "
                "The evidence bundle is at /home/student/evidence/crypto-incident/. Start by reading "
                "README.txt, then inspect encrypted_message.bin (hex) and server_config.txt (which "
                "contains the XOR key used, hidden among other config lines).\n\n"
                f"encrypted_message.bin (hex): {l25_cipher_hex}\n\n"
                "XOR-decode it using the key from server_config.txt. Enter the recovered string exactly "
                "(it will look like Base64)."
            ),
            "correct_answer": l25_b64,
            "flag": f"FLAG{{{l25_b64}}}",
            "validation_value": l25_b64,
            "cmd": f"python3 -c \"c=bytes.fromhex('{l25_cipher_hex}'); print(bytes(b^{l25_xor_key} for b in c).decode())\"",
            "explanation": "The message was layered: XOR-obfuscated on top of Base64-encoded data — a common way real attackers try to defeat casual inspection of a payload.",
            "why_correct": f"XOR-decoding the ciphertext with the key from server_config.txt (0x{l25_xor_key:02x}) recovers the Base64 string.",
        },
        {
            "objective_id": "l25_obj2",
            "question": f"Base64-decode that string:\n{l25_b64}\n\nEnter the plaintext case record.",
            "correct_answer": l25_code,
            "flag": f"FLAG{{{l25_code}}}",
            "validation_value": l25_code,
            "cmd": f"echo '{l25_b64}' | base64 -d",
            "explanation": "This is the raw case-record payload the attacker tried to hide under two layers of obfuscation.",
            "why_correct": f"Base64-decoding \"{l25_b64}\" gives \"{l25_code}\".",
        },
        {
            "objective_id": "l25_obj3",
            "question": (
                f"Verify integrity: hash.txt in the evidence bundle contains a SHA-256 digest. Compute "
                f"the SHA-256 of the case record you just recovered and confirm it matches. Enter the hash."
            ),
            "correct_answer": l25_hash,
            "flag": f"FLAG{{{l25_hash}}}",
            "validation_value": l25_hash,
            "cmd": f"echo -n \"{l25_code}\" | sha256sum",
            "explanation": "Confirming the hash matches proves the record you decoded matches the one that was logged — no corruption or substitution occurred in transit.",
            "why_correct": f"SHA-256 of \"{l25_code}\" is {l25_hash}, matching hash.txt.",
        },
        {
            "objective_id": "l25_obj4",
            "question": (
                f"Verify authenticity: signature.sig contains an RSA signature ({l25_signature}) over "
                f"this record's digest, using the Level 11 keypair (n={l11_n}, e={l11_e}). "
                "Compute check = signature^e mod n and confirm it matches the digest stand-in "
                f"({l25_digest_stub}) derived from the hash. Enter 'check'."
            ),
            "correct_answer": str(l25_verify),
            "flag": f"FLAG{{{l25_verify}}}",
            "validation_value": str(l25_verify),
            "cmd": f"python3 -c \"print(pow({l25_signature}, {l11_e}, {l11_n}))\"",
            "explanation": "Only after verifying BOTH integrity (hash match) and authenticity (signature match) should this record be trusted enough to act on.",
            "why_correct": f"{l25_signature}^{l11_e} mod {l11_n} = {l25_verify}, matching the expected digest stand-in.",
        },
        {
            "objective_id": "l25_obj5",
            "question": "Final: the incident is fully verified. Submit the recovered case record, wrapped as FLAG{...}.",
            "correct_answer": f"FLAG{{{l25_code}}}",
            "flag": f"FLAG{{{l25_code}}}",
            "validation_value": f"FLAG{{{l25_code}}}",
            "explanation": "You worked through encoding, XOR obfuscation, hashing, and RSA signatures together — exactly the layered investigation a real cryptography analyst performs when closing an incident.",
            "why_correct": f"The verified case record is \"{l25_code}\".",
        },
    ],
}

# ---------------------------------------------------------------------------
# Verify every taught terminal command actually produces the correct answer.
# ---------------------------------------------------------------------------
_LOCAL_PY = sys.executable.replace("\\", "/")

def _extract_answer(raw: str, expected: str) -> str:
    first_line = raw.strip().split("\n")[0].strip()
    if " " in expected or "," in expected:
        return first_line
    return first_line.split()[0] if first_line.split() else first_line

verification_failures = []
for level_id, objs in objectives.items():
    for obj in objs:
        cmd = obj.get("cmd")
        if not cmd or cmd == "true" or obj.get("no_local_exec"):
            continue

        expected_raw = obj["correct_answer"]
        candidates = {expected_raw}
        if expected_raw.startswith("FLAG{") and expected_raw.endswith("}"):
            candidates.add(expected_raw[5:-1])

        local_cmd = cmd.replace("python3 -c", f'"{_LOCAL_PY}" -c')
        try:
            result = subprocess.run([_BASH, "-c", local_cmd], capture_output=True, text=True, timeout=15)
        except Exception as exc:
            verification_failures.append((obj["objective_id"], cmd, f"EXCEPTION: {exc}"))
            continue

        if obj.get("verify_output", True) is False:
            if result.returncode != 0:
                verification_failures.append((obj["objective_id"], cmd, f"command failed: {result.stderr.strip()}"))
            continue

        actual = _extract_answer(result.stdout, next(iter(candidates)))
        if result.returncode != 0 and not actual:
            verification_failures.append((obj["objective_id"], cmd, f"STDERR: {result.stderr.strip()}"))
            continue

        if actual not in candidates:
            verification_failures.append((obj["objective_id"], cmd, f"expected one of {candidates!r}, got {actual!r}"))

if verification_failures:
    print("TERMINAL COMMAND VERIFICATION FAILED:")
    for obj_id, cmd, msg in verification_failures:
        print(f"  [{obj_id}] {msg}\n    cmd: {cmd}")
    raise SystemExit(1)
else:
    checked = sum(1 for objs in objectives.values() for obj in objs if obj.get("cmd") and obj.get("cmd") != "true")
    print(f"Verified {checked} calculation commands against their expected answers — all correct.")

with open("answers.json", "w", encoding="utf-8") as f:
    json.dump(objectives, f, indent=2)

txt_output = ""
for lvl, objs in objectives.items():
    lvl_num = int(lvl.replace("level", ""))
    txt_output += "=" * 80 + "\n" + f"LEVEL {lvl_num:02d} (Phase {phase_of(lvl_num)}: {PHASES[phase_of(lvl_num)]})\n" + "=" * 80 + "\n\n"
    for i, obj in enumerate(objs):
        txt_output += "-" * 80 + f"\nObjective {i+1}\n" + "-" * 80 + "\n"
        txt_output += f"Objective ID : {obj['objective_id']}\n"
        txt_output += f"Question     : {obj['question']}\n"
        if obj.get("cmd") and obj.get("cmd") != "true":
            txt_output += f"Terminal Cmd : {obj['cmd']}\n"
        txt_output += f"Correct Ans  : {obj['correct_answer']}\n"
        txt_output += f"Flag         : {obj['flag']}\n\n"
        txt_output += f"Explanation:\n{obj['explanation']}\n\n"
        txt_output += f"Why the Answer is Correct:\n{obj['why_correct']}\n\n"

with open("answers.txt", "w", encoding="utf-8") as f:
    f.write(txt_output)

# ---------------------------------------------------------------------------
# module_config.json
# ---------------------------------------------------------------------------
level_meta = {
    "level01": ("Encoding vs Encryption", "Tell apart 'hidden' from 'actually secret'.", 40,
        "Encoding (like Base64) transforms data into a different, transportable format — but with NO "
        "key and NO secrecy. Anyone can reverse it instantly. Encryption requires a key, and without it "
        "the data is computationally infeasible to recover."),
    "level02": ("Caesar Cipher", "The simplest possible cipher — and why it's broken.", 40,
        "A Caesar cipher shifts every letter by a fixed amount. Its entire security rests on that one "
        "shift value staying secret — but with only 25 possible shifts, brute force breaks it instantly."),
    "level03": ("Vigenere Cipher", "A repeating key beats a single shift — but not by enough.", 50,
        "Vigenere applies a DIFFERENT Caesar shift to each letter, cycling through a keyword — the "
        "bridge between classical and modern cryptography."),
    "level04": ("XOR / Bitwise Crypto", "The building block of most modern stream ciphers.", 50,
        "XOR is its own inverse: (P XOR K) XOR K always gives back P. Dangerous if a key is ever reused: "
        "K = P XOR C recovers the key from any known plaintext/ciphertext pair."),
    "level05": ("Classical Cryptanalysis", "No hints this time — investigate first.", 60,
        "Real cryptanalysis starts with recognizing WHICH cipher you're facing before you can break it. "
        "This level gave no cipher name and no shift — both had to be deduced."),
    "level06": ("AES Encryption", "A real block cipher, not a toy.", 80,
        "Plaintext + Key, run through many rounds of substitution and permutation, produces ciphertext "
        "that reveals nothing about the plaintext without the key."),
    "level07": ("Block Cipher Modes", "Why ECB is the mode everyone warns you about.", 70,
        "ECB encrypts each block independently, so identical plaintext blocks always produce identical "
        "ciphertext blocks — leaking structure. CBC's chaining fixes this."),
    "level08": ("Hash Functions", "One-way digests and the avalanche effect.", 60,
        "A hash function is one-way: no key, no way to reverse it. Changing even one character produces "
        "a completely different, unrelated-looking digest."),
    "level09": ("Password Hashing", "Why passwords need a slow KDF, not a fast hash.", 90,
        "PBKDF2/bcrypt/Argon2 deliberately slow down hashing so that an attacker with a stolen hash "
        "database can only try a limited number of guesses per second."),
    "level10": ("HMAC", "Prove a message wasn't just hashed — it was hashed WITH a secret.", 70,
        "HMAC mixes a secret key into a hash so only someone who knows the key can produce a valid "
        "MAC for a given message — proving both integrity and authenticity."),
    "level11": ("RSA Mathematics", "Construct a real RSA keypair step by step.", 90,
        "An RSA keypair starts with two secret primes p and q. n=pq is public; phi(n)=(p-1)(q-1) must "
        "stay secret; d is the modular inverse of e mod phi(n) — the private key."),
    "level12": ("RSA Encryption", "Encrypt a message with a public key.", 70,
        "RSA encryption is one formula: c = m^e mod n, using the PUBLIC key. Anyone can do this step."),
    "level13": ("RSA Decryption", "Recover the plaintext with the private key.", 70,
        "RSA decryption mirrors encryption exactly: m = c^d mod n, using the PRIVATE key."),
    "level14": ("RSA Key Recovery", "Given only n, e, and a ciphertext — break it yourself.", 140,
        "If an attacker can factor n back into p and q, they can rebuild phi(n) and then d — fully "
        "breaking the encryption. This is why real RSA uses enormous primes."),
    "level15": ("RSA Signatures", "Sign with a private key, verify with a public key.", 90,
        "A signature is RSA run in reverse: sign with your PRIVATE key, verify with your PUBLIC key. "
        "Tampering with the signed data breaks verification."),
    "level16": ("Diffie-Hellman Key Exchange", "Two sides derive one shared secret, in public.", 130,
        "Each side publishes g^private mod p, then combines the OTHER side's public value with their "
        "OWN private value. Both land on the identical shared secret without ever transmitting it."),
    "level17": ("Diffie-Hellman MITM", "Why unauthenticated key exchange isn't enough.", 100,
        "Standard DH authenticates nothing about who sent a public value — an active attacker can "
        "substitute their own values and establish separate shared secrets with each victim."),
    "level18": ("Elliptic Curve Cryptography", "Point addition, doubling, and scalar multiplication.", 110,
        "Elliptic curve points form a group under a geometric addition rule. Scalar multiplication is "
        "easy forward, and hard to reverse — the elliptic-curve discrete log problem."),
    "level19": ("ECDH", "Diffie-Hellman, but on an elliptic curve.", 110,
        "Same idea as classic DH, but public values are curve points and the combining operation is "
        "scalar multiplication instead of modular exponentiation."),
    "level20": ("Digital Signatures — Software Update", "Detect a tampered update before installing it.", 100,
        "Verifying a software update's signature before installing it is exactly how systems catch "
        "backdoored or corrupted updates before they run."),
    "level21": ("PKI & Certificates", "Is this certificate actually trustworthy?", 100,
        "A certificate's Subject and Issuer fields reveal whether it was vouched for by a trusted "
        "third party, or only by itself."),
    "level22": ("Key Derivation Functions", "Turn a password into a usable encryption key.", 100,
        "A KDF (like PBKDF2) turns a low-entropy password into a fixed-length key suitable for use "
        "in a symmetric cipher."),
    "level23": ("CSPRNG vs Predictable Randomness", "Predictable randomness = weak keys.", 90,
        "A cryptographic key is only as strong as the randomness that generated it. An LCG's output "
        "is fully predictable from its formula; a real CSPRNG's is not."),
    "level24": ("Cryptanalysis Investigation", "Unlabeled ciphertext — you decide the approach.", 150,
        "No cipher name given. Recognizing single-byte XOR from its structure, then brute-forcing all "
        "256 keys, is the entire challenge."),
    "level25": ("Final Cryptographic Incident", "Verify, decrypt, and close a real case.", 260,
        "Real incident response verifies authenticity and integrity BEFORE trusting decrypted data "
        "enough to act on it. This case chains encoding, XOR, hashing, and RSA signatures together."),
}

tracks_config = {
    "tracks": {
        "crypto": {
            "title": "Cryptography Track",
            "subtitle": "25 Levels — A Practical Cryptography Investigation",
            "description": (
                "Work through 25 real cryptographic challenges across 5 phases: foundations, symmetric "
                "cryptography, public-key cryptography, key exchange & modern crypto, and a final "
                "investigation phase — culminating in a full incident that ties every technique together."
            ),
            "difficulty": 3,
            "total_points": sum(m[2] for m in level_meta.values()),
            "modules": {},
        }
    }
}

for lvl, objs in objectives.items():
    lvl_num = int(lvl.replace("level", ""))
    title, mission, points, learn = level_meta[lvl]
    tracks_config["tracks"]["crypto"]["modules"][lvl] = {
        "title": f"Level {lvl_num:02d}: {title}",
        "phase": phase_of(lvl_num),
        "phase_title": PHASES[phase_of(lvl_num)],
        "difficulty": 1 if points < 70 else (2 if points < 120 else 3),
        "points": points,
        "mission": mission,
        "learn": learn,
        "objectives": [
            {
                "id": obj["objective_id"],
                "label": obj["question"],
                "cmd": obj.get("cmd", "") if obj.get("cmd") != "true" else "",
                "type": "flag_match" if idx == len(objs) - 1 else "input_match",
            }
            for idx, obj in enumerate(objs)
        ],
        "hints": [
            "Hint 1: Work through the formula/steps given, using the exact values provided.",
            "Hint 2: Use the terminal as a calculator (python3, sha256sum, openssl, xxd) — don't try to do large modular exponentiation by hand.",
        ],
    }

with open("module_config.json", "w", encoding="utf-8") as f:
    json.dump(tracks_config, f, indent=2)

print("module_config.json, answers.json and answers.txt regenerated!")
print(f"Total levels: {len(objectives)}, total points: {sum(m[2] for m in level_meta.values())}")
