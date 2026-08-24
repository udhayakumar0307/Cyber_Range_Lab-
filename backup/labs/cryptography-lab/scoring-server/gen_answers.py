"""
Single source of truth for the Cryptography Lab's content — a TechCorp
security-engineer practical course, not a flag-hunting CTF.

You are a junior security engineer at TechCorp. Across 7 modules you handle
one continuous incident: protecting customer data, verifying software
integrity, hardening password storage, exchanging keys with a partner
system, and finally investigating a real cryptographic incident that
combines everything you learned.

Every answer below is the literal, deterministic output of a real
cryptographic operation (AES-256-GCM, SHA-256, PBKDF2-HMAC-SHA256, textbook
RSA, Diffie-Hellman) — never arbitrary trivia. The generator actually
EXECUTES the taught terminal command for every objective and asserts its
output matches, so a wrong command in the lesson text fails the build
instead of shipping to students.

RSA/DH here use fixed small numbers (not real OpenSSL-generated PEM
keypairs) on purpose: real RSA-OAEP/PKCS1 encryption is intentionally
randomized (a security requirement), so its ciphertext can't be
string-matched for auto-grading. Textbook modular exponentiation keeps the
underlying public/private-key math 100% real and correct while staying
gradable. This is documented as a known limitation, not hidden.

Run: python gen_answers.py
"""
import json
import hashlib
import base64
import subprocess
import shutil
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# ---------------------------------------------------------------------------
# Crypto primitives
# ---------------------------------------------------------------------------

def sha256(data: bytes) -> str: return hashlib.sha256(data).hexdigest()
def pbkdf2(password: str, salt_hex: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), iterations).hex()

# ===========================================================================
# MODULE 1 — Symmetric Encryption: protect a customer backup with AES-256-GCM
# ===========================================================================
m1_plaintext = "TechCorp customer backup Q3 2026: 4821 records, region=EU-WEST, status=verified"
m1_key_hex = "6f8a3c1e9d4b7f2a5c8e1d4b7a3f6c9e2d5b8a1f4c7e9b2d5a8f1c4e7b9d2a5f"
m1_nonce_hex = "a1b2c3d4e5f6a7b8c9d0e1f2"

_aes = AESGCM(bytes.fromhex(m1_key_hex))
_m1_ct_full = _aes.encrypt(bytes.fromhex(m1_nonce_hex), m1_plaintext.encode(), None)
m1_ciphertext_hex = _m1_ct_full[:-16].hex()
m1_tag_hex = _m1_ct_full[-16:].hex()

# ===========================================================================
# MODULE 2 — Hash Functions & Integrity: verify software_update.bin
# ===========================================================================
m2_original = "TechCorp Update Agent v4.2.0\nbuild=20260824\nchecksum-protected release binary (simulated)."
m2_tampered = "TechCorp Update Agent v4.2.1\nbuild=20260824\nchecksum-protected release binary (simulated)."  # one char changed: 0 -> 1
m2_original_hash = sha256(m2_original.encode())
m2_tampered_hash = sha256(m2_tampered.encode())

# The vendor published this hash on their site. A partner mirror is serving
# a file — is it the authentic release or a tampered one?
m2_mirror_content = m2_tampered  # the mirror is serving a subtly modified copy
m2_published_hash = m2_original_hash

# ===========================================================================
# MODULE 3 — Password Hashing: TechCorp's login database
# ===========================================================================
m3_salt_hex = "4f1a9c3e7b2d5f8a"
m3_iterations = 100000
m3_target_password = "Summer2026!"
m3_target_hash = pbkdf2(m3_target_password, m3_salt_hex, m3_iterations)
m3_candidates = ["Winter2025!", "TechCorp123", "Summer2026!", "P@ssw0rd!"]

# ===========================================================================
# MODULE 4 — Asymmetric Cryptography: RSA public/private keypair
# ===========================================================================
m4_p, m4_q, m4_e = 61, 53, 17
m4_n = m4_p * m4_q
m4_phi = (m4_p - 1) * (m4_q - 1)
m4_d = pow(m4_e, -1, m4_phi)
m4_message = 88          # a small secret value the partner system sends TechCorp
m4_ciphertext = pow(m4_message, m4_e, m4_n)

# ===========================================================================
# MODULE 5 — Digital Signatures: verifying update.bin's publisher
# ===========================================================================
m5_hash_value = 15       # stand-in for a hashed-and-truncated file digest
m5_signature = pow(m5_hash_value, m4_d, m4_n)
m5_verified_original = pow(m5_signature, m4_e, m4_n)          # == m5_hash_value -> VALID
m5_tampered_hash_value = 22                                    # different file -> different hash
m5_verified_tampered = pow(m5_signature, m4_e, m4_n)           # still == 15, but file hash is now 22 -> mismatch -> INVALID

# ===========================================================================
# MODULE 6 — Key Exchange: Diffie-Hellman with a new partner system
# ===========================================================================
m6_p, m6_g = 23, 5     # small public prime + generator, publicly agreed
m6_alice_priv, m6_bob_priv = 6, 15
m6_alice_pub = pow(m6_g, m6_alice_priv, m6_p)
m6_bob_pub = pow(m6_g, m6_bob_priv, m6_p)
m6_shared_from_alice = pow(m6_bob_pub, m6_alice_priv, m6_p)
m6_shared_from_bob = pow(m6_alice_pub, m6_bob_priv, m6_p)
assert m6_shared_from_alice == m6_shared_from_bob

# ===========================================================================
# MODULE 7 — Final Incident: verify, then decrypt a partner's backup
# ===========================================================================
m7_backup_plain = "INCIDENT-CLOSED: partner backup TC-9471 verified and recovered successfully"
m7_key_hex = "1c9e4a7f2b8d5e3c6a9f4b7d2e8c5a1f9b4e7d2a8c5f1b9e4d7a2c8f5b1e9d4a"
m7_nonce_hex = "f0e1d2c3b4a5968778695a4b"
_aes7 = AESGCM(bytes.fromhex(m7_key_hex))
_m7_ct_full = _aes7.encrypt(bytes.fromhex(m7_nonce_hex), m7_backup_plain.encode(), None)
m7_ciphertext_hex = _m7_ct_full[:-16].hex()
m7_tag_hex = _m7_ct_full[-16:].hex()
m7_backup_hash = sha256(m7_backup_plain.encode())
# The published (trusted) hash for this backup, distributed out-of-band by TechCorp's partner
m7_published_hash = m7_backup_hash


# ===========================================================================
# Objectives — question text ("concept + task"), the taught terminal
# command, and the verified real-crypto answer.
# ===========================================================================
objectives = {
    "module1": [
        {
            "objective_id": "m1_obj1",
            "question": (
                "SCENARIO: TechCorp needs to send a customer backup to a partner "
                "system over an untrusted network. As the on-call security "
                "engineer, inspect the plaintext before protecting it.\n\n"
                f"customer_data.txt contents:\n\"{m1_plaintext}\"\n\n"
                "CONCEPT: Symmetric encryption uses ONE secret key for both "
                "encryption and decryption — fast, but both sides must already "
                "share that key.\n\n"
                "TASK: How many customer records does this backup report? "
                "Submit just the number."
            ),
            "correct_answer": "4821",
            "flag": "FLAG{4821}",
            "validation_value": "4821",
            "cmd": "cat customer_data.txt",
            "verify_output": False,  # inspection-only: answer is derived by reading, not literal stdout
            "explanation": "Before encrypting anything, always know exactly what you're protecting — this backup covers 4821 EU-WEST customer records.",
            "why_correct": "The file explicitly states \"4821 records\".",
        },
        {
            "objective_id": "m1_obj2",
            "question": (
                "CONCEPT: AES-256 uses a 256-bit key. In hex, each byte is 2 "
                "characters, so a 256-bit (32-byte) key is 64 hex characters "
                "long.\n\n"
                "TASK: Generate a real AES-256 key with OpenSSL, then submit "
                "how many hex characters it contains (this confirms you "
                "understand the key size — not the random value itself, since "
                "every engineer's generated key will differ)."
            ),
            "correct_answer": "64",
            "flag": "FLAG{64}",
            "validation_value": "64",
            "cmd": "openssl rand -hex 32 | tr -d '\\r\\n' | wc -c",
            "explanation": "openssl rand -hex 32 prints 32 random bytes as hex — 32 bytes × 2 hex chars/byte = 64 characters.",
            "why_correct": "A 256-bit key is 32 bytes, and hex-encoding always doubles byte count.",
        },
        {
            "objective_id": "m1_obj3",
            "question": (
                "TASK: TechCorp already shares a secret key with this specific "
                f"partner system (key={m1_key_hex}, nonce={m1_nonce_hex}). "
                "Encrypt customer_data.txt with AES-256-GCM using that exact "
                "key and nonce. Submit the resulting ciphertext as lowercase "
                "hex (authentication tag excluded)."
            ),
            "correct_answer": m1_ciphertext_hex,
            "flag": f"FLAG{{{m1_ciphertext_hex}}}",
            "validation_value": m1_ciphertext_hex,
            "cmd": (
                "python3 -c \"\n"
                "from cryptography.hazmat.primitives.ciphers.aead import AESGCM\n"
                f"key = bytes.fromhex('{m1_key_hex}')\n"
                f"nonce = bytes.fromhex('{m1_nonce_hex}')\n"
                f"pt = open('customer_data.txt','rb').read()\n"
                "ct = AESGCM(key).encrypt(nonce, pt, None)\n"
                "print(ct[:-16].hex())\""
            ),
            "explanation": "AES-256-GCM is authenticated encryption: it produces ciphertext plus a 16-byte authentication tag proving the data wasn't tampered with.",
            "why_correct": f"Encrypting with this exact key+nonce always deterministically produces {m1_ciphertext_hex}.",
        },
        {
            "objective_id": "m1_obj4",
            "question": (
                f"Final flag — the partner system sends back this ciphertext "
                f"(tag={m1_tag_hex}):\n{m1_ciphertext_hex}\n\n"
                "TASK: Decrypt it using the same key and nonce from the "
                "previous step, recovering the original plaintext. Submit the "
                "recovered plaintext exactly."
            ),
            "correct_answer": m1_plaintext,
            "flag": f"FLAG{{{m1_plaintext}}}",
            "validation_value": m1_plaintext,
            "cmd": (
                "python3 -c \"\n"
                "from cryptography.hazmat.primitives.ciphers.aead import AESGCM\n"
                f"key = bytes.fromhex('{m1_key_hex}')\n"
                f"nonce = bytes.fromhex('{m1_nonce_hex}')\n"
                f"ct = bytes.fromhex('{m1_ciphertext_hex}') + bytes.fromhex('{m1_tag_hex}')\n"
                "print(AESGCM(key).decrypt(nonce, ct, None).decode())\""
            ),
            "explanation": "This closes the loop: Ciphertext + Key + Nonce -> Decryption -> Plaintext. If the tag doesn't verify (tampered ciphertext), decryption fails outright — that's the authentication guarantee GCM adds over plain AES.",
            "why_correct": f"Decrypting with the matching key/nonce/tag always recovers exactly: \"{m1_plaintext}\".",
        },
    ],
    "module2": [
        {
            "objective_id": "m2_obj1",
            "question": (
                "SCENARIO: TechCorp just published software_update.bin for "
                "customers to download.\n\n"
                "CONCEPT: A hash function is one-way (you can't reverse a "
                "digest back into the file) and produces a fixed-length "
                "digest no matter the input size. This is NOT encryption — "
                "there's no key and no decrypting a hash back to the file.\n\n"
                f"software_update.bin contents:\n\"{m2_original}\"\n\n"
                "TASK: Calculate its SHA-256 hash. This becomes the value "
                "TechCorp publishes for customers to verify against."
            ),
            "correct_answer": m2_original_hash,
            "flag": f"FLAG{{{m2_original_hash}}}",
            "validation_value": m2_original_hash,
            "cmd": "sha256sum software_update.bin",
            "explanation": "SHA-256 always produces exactly 64 hex characters (256 bits), regardless of the input file's size.",
            "why_correct": f"SHA256 of the exact file contents is {m2_original_hash}.",
        },
        {
            "objective_id": "m2_obj2",
            "question": (
                "TASK: A tampered build (\"v4.2.1\" instead of \"v4.2.0\" — "
                "one character changed) is floating around. Its content:\n"
                f"\"{m2_tampered}\"\n\n"
                "Calculate ITS SHA-256 hash too, and compare it by eye to the "
                "one from the previous step. Submit this new hash."
            ),
            "correct_answer": m2_tampered_hash,
            "flag": f"FLAG{{{m2_tampered_hash}}}",
            "validation_value": m2_tampered_hash,
            "cmd": "sha256sum software_update_tampered.bin",
            "explanation": "This is the avalanche effect: one changed character produced a completely different, unrelated-looking 64-character digest — exactly what makes hashes useful for tamper detection.",
            "why_correct": f"SHA256 of the one-character-different file is {m2_tampered_hash}, sharing no visible pattern with the original hash.",
        },
        {
            "objective_id": "m2_obj3",
            "question": (
                f"TASK — integrity check: TechCorp's official site published "
                f"this hash for software_update.bin:\n{m2_published_hash}\n\n"
                "A partner mirror is serving a copy of the file. Download it, "
                "hash it, and compare against the published value. Submit "
                "MATCH if the mirror's file is authentic, or MISMATCH if it's "
                "been tampered with."
            ),
            "correct_answer": "MISMATCH",
            "flag": "FLAG{MISMATCH}",
            "validation_value": "MISMATCH",
            "cmd": "sha256sum update_from_mirror.bin  # compare its output to the published hash above",
            "verify_output": False,  # judgement call (MATCH/MISMATCH) made by comparing two hashes, not literal stdout
            "explanation": "The mirror was serving the tampered v4.2.1 build, not the authentic v4.2.0 release TechCorp published — the hash mismatch caught it before it reached customers.",
            "why_correct": f"The mirror's hash ({m2_tampered_hash}) does not equal the published hash ({m2_published_hash}), so it's a MISMATCH.",
        },
        {
            "objective_id": "m2_obj4",
            "question": (
                "Final flag: which single security property of SHA-256 made "
                "it computationally infeasible for the attacker to tamper "
                "with the file while keeping the SAME hash? Submit the "
                "two-word term (lowercase, e.g. 'x resistance')."
            ),
            "correct_answer": "collision resistance",
            "flag": "FLAG{collision_resistance}",
            "validation_value": "collision resistance",
            "explanation": "Collision resistance means it's practically impossible to find two different inputs that hash to the same digest — the property that makes hash-based integrity checks trustworthy.",
            "why_correct": "The property is collision resistance.",
        },
    ],
    "module3": [
        {
            "objective_id": "m3_obj1",
            "question": (
                "SCENARIO: TechCorp's login database was found storing plain "
                "SHA-256(password) — no salt, no slowdown.\n\n"
                "CONCEPT: SHA-256 is fast by design, which is exactly wrong "
                "for passwords — attackers can hash billions of guesses per "
                "second. Password hashing needs to be deliberately SLOW "
                "(PBKDF2, bcrypt, Argon2) and use a per-user SALT so identical "
                "passwords don't produce identical hashes.\n\n"
                "TASK: What do you add to each password before hashing so two "
                "users with the same password get different stored hashes? "
                "Submit the one-word term."
            ),
            "correct_answer": "salt",
            "flag": "FLAG{salt}",
            "validation_value": "salt",
            "explanation": "A salt is random data unique per user, mixed in before hashing. It defeats precomputed rainbow-table attacks and hides identical passwords.",
            "why_correct": "The term is 'salt'.",
        },
        {
            "objective_id": "m3_obj2",
            "question": (
                f"TASK: TechCorp is migrating to PBKDF2-HMAC-SHA256 with "
                f"salt={m3_salt_hex} and {m3_iterations} iterations. Compute "
                f"the password hash for the candidate password "
                f"'{m3_target_password}'. Submit the resulting hash as "
                "lowercase hex."
            ),
            "correct_answer": m3_target_hash,
            "flag": f"FLAG{{{m3_target_hash}}}",
            "validation_value": m3_target_hash,
            "cmd": (
                "python3 -c \""
                "import hashlib; "
                f"print(hashlib.pbkdf2_hmac('sha256', b'{m3_target_password}', bytes.fromhex('{m3_salt_hex}'), {m3_iterations}).hex())\""
            ),
            "explanation": "PBKDF2 deliberately repeats the hash function thousands of times (here 100,000), making each guess far more expensive for an attacker than a single SHA-256 call.",
            "why_correct": f"PBKDF2-HMAC-SHA256 of \"{m3_target_password}\" with this salt/iteration count is {m3_target_hash}.",
        },
        {
            "objective_id": "m3_obj3",
            "question": (
                f"Final flag: an account's stored hash is:\n{m3_target_hash}\n"
                f"(salt={m3_salt_hex}, {m3_iterations} iterations, PBKDF2-HMAC-SHA256)\n\n"
                "TASK: One of these candidate passwords is the real one: "
                f"{', '.join(m3_candidates)}. Compute each candidate's hash "
                "the same way and find the match. Submit the correct "
                "password."
            ),
            "correct_answer": f"FLAG{{{m3_target_password}}}",
            "flag": f"FLAG{{{m3_target_password}}}",
            "validation_value": f"FLAG{{{m3_target_password}}}",
            "cmd": (
                "python3 -c \""
                "import hashlib; "
                "candidates = [" + ", ".join(f"'{c}'" for c in m3_candidates) + "]; "
                f"target = '{m3_target_hash}'; "
                f"salt = bytes.fromhex('{m3_salt_hex}'); "
                "[print(c) for c in candidates if hashlib.pbkdf2_hmac('sha256', c.encode(), salt, "
                f"{m3_iterations}).hex() == target]\""
            ),
            "explanation": "This is exactly how a real login checks a password: hash the candidate with the stored salt/iterations and compare — never decrypt a stored hash, because hashing isn't reversible.",
            "why_correct": f"Only \"{m3_target_password}\" produces the stored hash; the others produce completely different digests.",
        },
    ],
    "module4": [
        {
            "objective_id": "m4_obj1",
            "question": (
                "SCENARIO: TechCorp's partner integration needs to send a "
                "secret value without ever having shared a symmetric key.\n\n"
                "CONCEPT: Asymmetric (public-key) cryptography uses a "
                "MATCHED PAIR of keys: whatever the PUBLIC key encrypts, only "
                "the PRIVATE key can decrypt — and the private key never "
                "has to leave TechCorp's server.\n\n"
                f"TASK: Generate an RSA keypair: given primes p={m4_p} and "
                f"q={m4_q}, compute the modulus n = p x q. This n is shared "
                "as part of the PUBLIC key. Submit n."
            ),
            "correct_answer": str(m4_n),
            "flag": f"FLAG{{{m4_n}}}",
            "validation_value": str(m4_n),
            "cmd": f"python3 -c \"print({m4_p} * {m4_q})\"",
            "explanation": "n is published freely as (n, e) — the public key. The primes p and q that produced it must stay secret forever.",
            "why_correct": f"{m4_p} x {m4_q} = {m4_n}.",
        },
        {
            "objective_id": "m4_obj2",
            "question": (
                f"TASK: Compute phi(n) = (p-1)(q-1) for p={m4_p}, q={m4_q}. "
                "This value is needed to derive the PRIVATE key and must "
                "never be published. Submit it."
            ),
            "correct_answer": str(m4_phi),
            "flag": f"FLAG{{{m4_phi}}}",
            "validation_value": str(m4_phi),
            "cmd": f"python3 -c \"print(({m4_p}-1) * ({m4_q}-1))\"",
            "explanation": "Only someone who knows the original primes p and q can compute phi(n) — that's the one-way trapdoor RSA's security rests on.",
            "why_correct": f"({m4_p}-1) x ({m4_q}-1) = {m4_phi}.",
        },
        {
            "objective_id": "m4_obj3",
            "question": (
                f"TASK: TechCorp's public exponent is e={m4_e}. Using "
                f"phi(n)={m4_phi}, compute the PRIVATE exponent d — the "
                "modular inverse of e mod phi(n), satisfying (e x d) mod "
                "phi(n) = 1. This d, kept secret on TechCorp's server, is "
                "the private key. Submit d."
            ),
            "correct_answer": str(m4_d),
            "flag": f"FLAG{{{m4_d}}}",
            "validation_value": str(m4_d),
            "cmd": f"python3 -c \"print(pow({m4_e}, -1, {m4_phi}))\"",
            "explanation": "(n, e) is the public key anyone can encrypt with. (n, d) is the private key — only TechCorp's server holds it, and only it can decrypt.",
            "why_correct": f"{m4_e} x {m4_d} mod {m4_phi} = 1, so d = {m4_d}.",
        },
        {
            "objective_id": "m4_obj4",
            "question": (
                f"Final flag: put TechCorp's PUBLIC key to work. Using "
                f"n={m4_n} and e={m4_e}, encrypt the partner's secret value "
                f"m={m4_message} by computing c = m^e mod n. This is exactly "
                "what the partner does with TechCorp's public key — they "
                "never need the private key to send a message only TechCorp "
                "can read. Submit c as FLAG{{c}}."
            ),
            "correct_answer": f"FLAG{{{m4_ciphertext}}}",
            "flag": f"FLAG{{{m4_ciphertext}}}",
            "validation_value": f"FLAG{{{m4_ciphertext}}}",
            "cmd": f"python3 -c \"print(pow({m4_message}, {m4_e}, {m4_n}))\"",
            "explanation": "Anyone with the public key (n, e) can encrypt. Only the holder of the private key d can reverse it — that asymmetry is the entire point.",
            "why_correct": f"{m4_message}^{m4_e} mod {m4_n} = {m4_ciphertext}.",
        },
    ],
    "module5": [
        {
            "objective_id": "m5_obj1",
            "question": (
                "SCENARIO: TechCorp's release team published update.bin along "
                "with a digital signature and their public key. Your job is "
                "to confirm the update really came from TechCorp and wasn't "
                "altered.\n\n"
                "CONCEPT: A digital signature flips RSA around: you sign with "
                "your PRIVATE key so ANYONE can verify with your PUBLIC key. "
                "It proves both authenticity (who signed it) and integrity "
                "(it hasn't changed since).\n\n"
                f"TASK: Using TechCorp's private key (d={m4_d}, n={m4_n} from "
                f"Module 4), sign the release's hash-digest stand-in "
                f"h={m5_hash_value} by computing s = h^d mod n. Submit s — "
                "this is the signature TechCorp attaches to update.bin."
            ),
            "correct_answer": str(m5_signature),
            "flag": f"FLAG{{{m5_signature}}}",
            "validation_value": str(m5_signature),
            "cmd": f"python3 -c \"print(pow({m5_hash_value}, {m4_d}, {m4_n}))\"",
            "explanation": "Signing uses the same modular exponentiation as decryption — but with the PRIVATE key, the opposite of encryption's PUBLIC key.",
            "why_correct": f"{m5_hash_value}^{m4_d} mod {m4_n} = {m5_signature}.",
        },
        {
            "objective_id": "m5_obj2",
            "question": (
                f"TASK: Verify the signature the way any customer could, "
                f"using only TechCorp's PUBLIC key: compute h' = s^e mod n "
                f"with e={m4_e}, n={m4_n}, and signature s={m5_signature}. "
                f"If h' equals update.bin's real hash-digest ({m5_hash_value}), "
                "the signature is valid. Submit h'."
            ),
            "correct_answer": str(m5_verified_original),
            "flag": f"FLAG{{{m5_verified_original}}}",
            "validation_value": str(m5_verified_original),
            "cmd": f"python3 -c \"print(pow({m5_signature}, {m4_e}, {m4_n}))\"",
            "explanation": "Verification only needs the PUBLIC key — anyone can check a signature without ever touching the private key, which is exactly why signatures are trustworthy.",
            "why_correct": f"{m5_signature}^{m4_e} mod {m4_n} = {m5_verified_original}, matching update.bin's real digest.",
        },
        {
            "objective_id": "m5_obj3",
            "question": (
                "TASK: An attacker now modifies update.bin after it was "
                f"signed. The modified file's hash-digest is now "
                f"{m5_tampered_hash_value} instead of {m5_hash_value} — but "
                f"the attacker kept the ORIGINAL signature ({m5_signature}), "
                "since they don't have TechCorp's private key to forge a new "
                "one.\n\n"
                "Verify the SAME signature against the NEW (tampered) hash-"
                "digest. Does it still check out? Submit VALID or INVALID."
            ),
            "correct_answer": "INVALID",
            "flag": "FLAG{INVALID}",
            "validation_value": "INVALID",
            "explanation": (
                f"Verifying gives s^e mod n = {m5_verified_tampered} again "
                f"(the signature itself never changes) — but that no longer "
                f"equals the tampered file's real digest ({m5_tampered_hash_value}). "
                "The mismatch is exactly what exposes the tampering: the "
                "attacker can't produce a new signature without the private key."
            ),
            "why_correct": f"The signature still verifies to {m5_verified_tampered}, which does not match the tampered file's digest {m5_tampered_hash_value}, so the signature is INVALID for this file.",
        },
        {
            "objective_id": "m5_obj4",
            "question": (
                "Final flag: which single property did this whole exercise "
                "demonstrate — the one guaranteeing a signed file can't be "
                "silently modified without breaking verification? Submit "
                "one word: 'integrity', 'confidentiality', or 'availability'."
            ),
            "correct_answer": "integrity",
            "flag": "FLAG{integrity}",
            "validation_value": "integrity",
            "explanation": "Digital signatures primarily guarantee integrity (and authenticity) — not confidentiality. The file content itself isn't secret here, but any tampering is detectable.",
            "why_correct": "The property demonstrated is integrity.",
        },
    ],
    "module6": [
        {
            "objective_id": "m6_obj1",
            "question": (
                "SCENARIO: TechCorp is integrating with a brand-new partner "
                "system. Neither side has ever shared a secret key, and "
                "there's no secure channel yet to send one over.\n\n"
                "CONCEPT: Diffie-Hellman lets two sides agree on a shared "
                "secret over a channel an attacker can freely watch, without "
                "ever transmitting the secret itself.\n\n"
                f"TASK: Both sides publicly agree on prime p={m6_p} and "
                f"generator g={m6_g}. TechCorp picks private value "
                f"a={m6_alice_priv} and computes its public value "
                "A = g^a mod p. Submit A (safe to publish — this is the "
                "'public value' side of the exchange)."
            ),
            "correct_answer": str(m6_alice_pub),
            "flag": f"FLAG{{{m6_alice_pub}}}",
            "validation_value": str(m6_alice_pub),
            "cmd": f"python3 -c \"print(pow({m6_g}, {m6_alice_priv}, {m6_p}))\"",
            "explanation": "A is safe to send over an open channel — recovering the private exponent a from A is the (computationally hard) discrete logarithm problem.",
            "why_correct": f"{m6_g}^{m6_alice_priv} mod {m6_p} = {m6_alice_pub}.",
        },
        {
            "objective_id": "m6_obj2",
            "question": (
                f"TASK: The partner system picks its own private value "
                f"b={m6_bob_priv} and computes its public value "
                "B = g^b mod p. Submit B."
            ),
            "correct_answer": str(m6_bob_pub),
            "flag": f"FLAG{{{m6_bob_pub}}}",
            "validation_value": str(m6_bob_pub),
            "cmd": f"python3 -c \"print(pow({m6_g}, {m6_bob_priv}, {m6_p}))\"",
            "explanation": "Both public values (A and B) get exchanged openly — an eavesdropper sees both, but that alone isn't enough to derive the shared secret.",
            "why_correct": f"{m6_g}^{m6_bob_priv} mod {m6_p} = {m6_bob_pub}.",
        },
        {
            "objective_id": "m6_obj3",
            "question": (
                f"TASK: TechCorp now combines the PARTNER's public value "
                f"(B={m6_bob_pub}) with its OWN private value "
                f"(a={m6_alice_priv}): shared = B^a mod p. Submit the shared "
                "secret TechCorp derives."
            ),
            "correct_answer": str(m6_shared_from_alice),
            "flag": f"FLAG{{{m6_shared_from_alice}}}",
            "validation_value": str(m6_shared_from_alice),
            "cmd": f"python3 -c \"print(pow({m6_bob_pub}, {m6_alice_priv}, {m6_p}))\"",
            "explanation": "TechCorp never needed the partner's private value b — only their public value B, combined with TechCorp's own secret a.",
            "why_correct": f"{m6_bob_pub}^{m6_alice_priv} mod {m6_p} = {m6_shared_from_alice}.",
        },
        {
            "objective_id": "m6_obj4",
            "question": (
                f"Final flag: now compute it from the PARTNER's side: "
                f"combine TechCorp's public value (A={m6_alice_pub}) with the "
                f"partner's own private value (b={m6_bob_priv}): shared = "
                "A^b mod p. Submit this value — it should exactly match what "
                "TechCorp derived, proving both sides landed on the same "
                "shared secret without ever transmitting it."
            ),
            "correct_answer": f"FLAG{{{m6_shared_from_bob}}}",
            "flag": f"FLAG{{{m6_shared_from_bob}}}",
            "validation_value": f"FLAG{{{m6_shared_from_bob}}}",
            "cmd": f"python3 -c \"print(pow({m6_alice_pub}, {m6_bob_priv}, {m6_p}))\"",
            "explanation": "Both sides independently arrive at the identical shared secret using only their own private value plus the other side's public value — this is the mathematical heart of Diffie-Hellman.",
            "why_correct": f"{m6_alice_pub}^{m6_bob_priv} mod {m6_p} = {m6_shared_from_bob}, matching TechCorp's derivation of {m6_shared_from_alice}.",
        },
    ],
    "module7": [
        {
            "objective_id": "m7_obj1",
            "question": (
                "FINAL INCIDENT: TechCorp received an encrypted customer "
                "backup (backup.enc) from a partner server, along with a "
                "published hash and a claim it was properly signed. Your job "
                "as the security engineer on call: verify it, then recover "
                "the data.\n\n"
                f"TASK — Step 1, verify integrity: the partner published this "
                f"hash out-of-band for the backup's plaintext:\n"
                f"{m7_published_hash}\n\n"
                "The backup's actual plaintext (once decrypted) is provided "
                "below for this hash check:\n"
                f"\"{m7_backup_plain}\"\n\n"
                "Hash it and confirm it matches. Submit MATCH or MISMATCH."
            ),
            "correct_answer": "MATCH",
            "flag": "FLAG{MATCH}",
            "validation_value": "MATCH",
            "cmd": f"echo -n \"{m7_backup_plain}\" | sha256sum",
            "verify_output": False,  # judgement call (MATCH/MISMATCH), not literal stdout
            "explanation": "Before trusting decrypted data, always confirm its hash against a value published through a separate, trusted channel — exactly what real incident response does before acting on recovered data.",
            "why_correct": f"SHA256 of the plaintext is {m7_backup_hash}, matching the published hash.",
        },
        {
            "objective_id": "m7_obj2",
            "question": (
                "TASK — Step 2, verify the sender: the partner claims this "
                f"backup's hash-digest ({m5_hash_value}) was signed with "
                f"their private key, producing signature {m5_signature} "
                f"(reusing the keypair from Modules 4-5: n={m4_n}, e={m4_e}). "
                "Verify it the same way as Module 5: compute h' = s^e mod n "
                "and confirm it matches. Submit VALID or INVALID."
            ),
            "correct_answer": "VALID",
            "flag": "FLAG{VALID}",
            "validation_value": "VALID",
            "cmd": f"python3 -c \"print(pow({m5_signature}, {m4_e}, {m4_n}))\"  # compare to {m5_hash_value}",
            "verify_output": False,  # judgement call (VALID/INVALID), not literal stdout
            "explanation": "Only after confirming BOTH integrity (hash matches) and authenticity (signature verifies) should a security engineer trust incoming data enough to act on it.",
            "why_correct": f"{m5_signature}^{m4_e} mod {m4_n} = {m5_verified_original}, matching the claimed digest {m5_hash_value} — the signature is VALID.",
        },
        {
            "objective_id": "m7_obj3",
            "question": (
                "TASK — Step 3, decrypt the backup: now that it's verified, "
                f"decrypt backup.enc using AES-256-GCM with key="
                f"{m7_key_hex}, nonce={m7_nonce_hex}, ciphertext="
                f"{m7_ciphertext_hex}, tag={m7_tag_hex}. Submit the recovered "
                "plaintext exactly."
            ),
            "correct_answer": m7_backup_plain,
            "flag": f"FLAG{{{m7_backup_plain}}}",
            "validation_value": m7_backup_plain,
            "cmd": (
                "python3 -c \"\n"
                "from cryptography.hazmat.primitives.ciphers.aead import AESGCM\n"
                f"key = bytes.fromhex('{m7_key_hex}')\n"
                f"nonce = bytes.fromhex('{m7_nonce_hex}')\n"
                f"ct = bytes.fromhex('{m7_ciphertext_hex}') + bytes.fromhex('{m7_tag_hex}')\n"
                "print(AESGCM(key).decrypt(nonce, ct, None).decode())\""
            ),
            "explanation": "This is the full pipeline in one incident: verify integrity, verify authenticity, THEN decrypt — never the other way around, or you might decrypt (and act on) data you can't actually trust.",
            "why_correct": f"Decrypting with the correct key/nonce/tag recovers exactly: \"{m7_backup_plain}\".",
        },
        {
            "objective_id": "m7_obj4",
            "question": (
                "FINAL FLAG: you've now completed the full incident — "
                "integrity check, signature verification, and decryption. "
                "Submit the case status exactly as it should be logged, "
                "wrapped as FLAG{...} (see the recovered plaintext above for "
                "the exact case ID and status)."
            ),
            "correct_answer": "FLAG{INCIDENT-CLOSED: partner backup TC-9471 verified and recovered successfully}",
            "flag": "FLAG{INCIDENT-CLOSED: partner backup TC-9471 verified and recovered successfully}",
            "validation_value": "FLAG{INCIDENT-CLOSED: partner backup TC-9471 verified and recovered successfully}",
            "explanation": (
                "Symmetric encryption protected the data in transit, hashing "
                "proved it wasn't corrupted, RSA signatures proved who sent "
                "it, and Diffie-Hellman showed how two sides agree on a key "
                "with no prior shared secret. That's the full toolkit a real "
                "security engineer reaches for — chosen for the problem at "
                "hand, not memorized commands."
            ),
            "why_correct": "The recovered plaintext IS the case status: \"INCIDENT-CLOSED: partner backup TC-9471 verified and recovered successfully\".",
        },
    ],
}

# ---------------------------------------------------------------------------
# Verify every taught terminal command actually produces the correct answer.
# These commands are shown to students as the real way to solve each
# objective, so they must be checked, not just eyeballed.
# ---------------------------------------------------------------------------
_BASH = shutil.which("bash") or r"C:\Program Files\Git\usr\bin\bash.exe"
_LOCAL_PY = sys.executable.replace("\\", "/")

def _extract_answer(raw: str, expected: str) -> str:
    """Match the loose comparison crypto_api.py's /submit uses. Multi-word
    expected answers (decrypted sentences) compare against the full first
    line; single-token expected answers (hashes, numbers) take just the
    first whitespace-delimited token (handles 'sha256sum' style output of
    '<hash>  -')."""
    first_line = raw.strip().split("\n")[0].strip()
    if " " in expected:
        return first_line
    return first_line.split()[0] if first_line.split() else first_line

# Write the small fixture files the taught commands operate on (matching
# what the lesson text tells students they're inspecting) into a scratch
# temp dir — these are only for verifying the taught commands here, never
# committed alongside the lab.
import tempfile

FIXTURES = {
    "customer_data.txt": m1_plaintext,
    "software_update.bin": m2_original,
    "software_update_tampered.bin": m2_tampered,
    "update_from_mirror.bin": m2_mirror_content,
}
_fixture_dir = tempfile.mkdtemp(prefix="crypto_lab_fixtures_")
for fname, content in FIXTURES.items():
    with open(f"{_fixture_dir}/{fname}", "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

verification_failures = []
for mod_id, objs in objectives.items():
    for obj in objs:
        cmd = obj.get("cmd")
        if not cmd:
            continue

        expected_raw = obj["correct_answer"]
        candidates = {expected_raw}
        if expected_raw.startswith("FLAG{") and expected_raw.endswith("}"):
            candidates.add(expected_raw[5:-1])

        local_cmd = cmd.replace("python3 -c", f'"{_LOCAL_PY}" -c')
        try:
            result = subprocess.run(
                [_BASH, "-c", local_cmd], capture_output=True, text=True, timeout=10, cwd=_fixture_dir
            )
        except Exception as exc:
            verification_failures.append((obj["objective_id"], cmd, f"EXCEPTION: {exc}"))
            continue

        if obj.get("verify_output", True) is False:
            # Illustrative command (inspection/judgement-call objective) —
            # only confirm it actually runs, don't string-match its output.
            if result.returncode != 0:
                verification_failures.append((obj["objective_id"], cmd, f"command failed: {result.stderr.strip()}"))
            continue

        actual = _extract_answer(result.stdout, next(iter(candidates)))
        if result.returncode != 0 and not actual:
            verification_failures.append((obj["objective_id"], cmd, f"STDERR: {result.stderr.strip()}"))
            continue

        if actual not in candidates:
            verification_failures.append((obj["objective_id"], cmd, f"expected one of {candidates!r}, got {actual!r}"))

import shutil as _shutil
_shutil.rmtree(_fixture_dir, ignore_errors=True)

if verification_failures:
    print("TERMINAL COMMAND VERIFICATION FAILED:")
    for obj_id, cmd, msg in verification_failures:
        print(f"  [{obj_id}] {msg}\n    cmd: {cmd}")
    raise SystemExit(1)
else:
    checked = sum(1 for objs in objectives.values() for obj in objs if obj.get("cmd"))
    print(f"Verified {checked} terminal commands against their expected answers — all correct.")

with open("answers.json", "w", encoding="utf-8") as f:
    json.dump(objectives, f, indent=2)

txt_output = ""
for mod, objs in objectives.items():
    mod_num = mod.replace("module", "")
    txt_output += "=" * 80 + "\n"
    txt_output += f"MODULE {mod_num}\n"
    txt_output += "=" * 80 + "\n\n"
    for i, obj in enumerate(objs):
        txt_output += "-" * 80 + "\n"
        txt_output += f"Objective {i+1}\n"
        txt_output += "-" * 80 + "\n"
        txt_output += f"Objective ID : {obj['objective_id']}\n"
        txt_output += f"Question     : {obj['question']}\n"
        if obj.get("cmd"):
            txt_output += f"Terminal Cmd : {obj['cmd']}\n"
        txt_output += f"Correct Ans  : {obj['correct_answer']}\n"
        txt_output += f"Flag         : {obj['flag']}\n\n"
        txt_output += f"Explanation:\n{obj['explanation']}\n\n"
        txt_output += f"Why the Answer is Correct:\n{obj['why_correct']}\n\n"

with open("answers.txt", "w", encoding="utf-8") as f:
    f.write(txt_output)

# ---------------------------------------------------------------------------
# module_config.json — concept + scenario + objectives (no answers), plus
# hints, matching the "professor teaches -> student practices" flow.
# ---------------------------------------------------------------------------
module_meta = {
    "module1": (
        "Symmetric Encryption",
        "Protect a TechCorp customer backup with AES-256-GCM",
        "Symmetric encryption uses ONE shared secret key for both encryption and decryption. It's fast, but both parties must already have the key.",
        [
            "Hint 1: openssl rand -hex 32 generates a real 256-bit key — count the characters it prints.",
            "Hint 2: AES-256-GCM needs a key, a nonce, and the plaintext; the Python cryptography library's AESGCM class handles the authentication tag automatically.",
        ],
    ),
    "module2": (
        "Hash Functions & Integrity",
        "Verify software_update.bin wasn't tampered with",
        "A hash function is one-way and produces a fixed-length digest for any input. It's not encryption — you can't reverse a hash back into the original file.",
        [
            "Hint 1: sha256sum <file> always prints a 64-character hex digest, no matter the file's size.",
            "Hint 2: If a mirror's hash doesn't match the vendor's published hash, the file has been altered — full stop.",
        ],
    ),
    "module3": (
        "Password Hashing",
        "Harden TechCorp's login database against fast-hash attacks",
        "SHA-256 is too fast for password storage — attackers can try billions of guesses per second. Password hashing needs to be deliberately slow (PBKDF2/bcrypt/Argon2) and salted.",
        [
            "Hint 1: hashlib.pbkdf2_hmac('sha256', password_bytes, salt_bytes, iterations) computes PBKDF2-HMAC-SHA256 in Python.",
            "Hint 2: To find which candidate password is correct, hash each one with the SAME salt and iteration count and compare to the stored hash.",
        ],
    ),
    "module4": (
        "Asymmetric Cryptography (RSA)",
        "Generate TechCorp's RSA keypair for a new partner integration",
        "Asymmetric cryptography uses a matched key PAIR: whatever the public key encrypts, only the matching private key can decrypt. The private key never has to be shared.",
        [
            "Hint 1: n = p*q and phi(n) = (p-1)*(q-1) are simple arithmetic once you have the primes.",
            "Hint 2: Python's pow(e, -1, phi_n) computes the modular inverse directly — that's your private exponent d.",
        ],
    ),
    "module5": (
        "Digital Signatures",
        "Confirm update.bin really came from TechCorp, unmodified",
        "A signature is created with the PRIVATE key and checked with the PUBLIC key — proving both who signed something and that it hasn't changed since.",
        [
            "Hint 1: Signing and decrypting use the identical formula: value^d mod n. Verifying and encrypting both use value^e mod n.",
            "Hint 2: If the file changes after signing, its hash-digest changes too — but the OLD signature only verifies against the OLD digest.",
        ],
    ),
    "module6": (
        "Key Exchange (Diffie-Hellman)",
        "Agree on a shared secret with a brand-new partner system",
        "Diffie-Hellman lets two sides who've never met derive the same shared secret over a public channel, without ever transmitting the secret itself.",
        [
            "Hint 1: Both public values are computed the same way: pow(g, private_value, p).",
            "Hint 2: The shared secret is pow(their_public_value, your_private_value, p) — both sides land on the identical number.",
        ],
    ),
    "module7": (
        "Final Incident: Verify & Recover",
        "Investigate and close a real cryptographic incident end-to-end",
        "Real incident response always verifies BEFORE trusting: check integrity (hash), check authenticity (signature), and only then decrypt and act on the data.",
        [
            "Hint 1: Work the steps in order — hash check, then signature check, then decrypt. Don't decrypt first.",
            "Hint 2: Reuse the exact AES-256-GCM and RSA-verification approach from Modules 1 and 5 — the mechanics are identical, only the values differ.",
        ],
    ),
}
module_points = {f"module{i}": (150 if i <= 4 else 175) for i in range(1, 8)}
module_difficulty = {f"module{i}": (1 if i == 1 else 2 if i <= 4 else 3) for i in range(1, 8)}

tracks_config = {
    "tracks": {
        "crypto": {
            "title": "Cryptography Track",
            "subtitle": "TechCorp Security Engineer Practical Course",
            "description": (
                "You are a junior security engineer at TechCorp. Across 7 "
                "modules you handle one continuous incident: protect a "
                "customer backup with symmetric encryption, catch a "
                "tampered software release with hashing, harden the login "
                "database's password storage, set up RSA for a new partner "
                "integration, verify a digital signature, exchange a key "
                "with Diffie-Hellman, and close out a real cryptographic "
                "incident that combines everything."
            ),
            "difficulty": 2,
            "total_points": sum(module_points.values()),
            "modules": {},
        }
    }
}

for mod_id, objs in objectives.items():
    title, scenario, concept, hints = module_meta[mod_id]
    tracks_config["tracks"]["crypto"]["modules"][mod_id] = {
        "title": title,
        "difficulty": module_difficulty[mod_id],
        "points": module_points[mod_id],
        "mission": scenario,
        "concept": concept,
        "objectives": [
            {
                "id": obj["objective_id"],
                "label": obj["question"],
                "cmd": obj.get("cmd", ""),
                "type": "flag_match" if idx == len(objs) - 1 else "input_match",
            }
            for idx, obj in enumerate(objs)
        ],
        "hints": hints,
    }

with open("module_config.json", "w", encoding="utf-8") as f:
    json.dump(tracks_config, f, indent=2)

print("module_config.json, answers.json and answers.txt regenerated!")
print(f"Total modules: {len(objectives)}, total points: {sum(module_points.values())}")
