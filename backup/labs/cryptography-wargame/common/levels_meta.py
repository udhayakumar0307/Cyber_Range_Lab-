#!/usr/bin/env python3
"""
Level metadata for the Cryptography Wargame (v2 curriculum).

Every level is a genuine cryptography task, ordered like the Cryptopals sets and
the CryptoHack tracks so students can find matching writeups. Each task reads as
GIVEN -> RECOVER. Hints escalate: nudge -> concrete -> exact tool/technique.

kind: "file"  = challenge files generated into the level dir
      "svc"   = interactive server on crypto-services:<port>
      "web"   = web app on web-crypto:<port>
"""

SVC = "crypto-services"
WEB = "web-crypto"

LEVELS = [
    {
        "n": 0, "title": "Hexadecimal", "concept": "Encoding: hex ↔ bytes", "kind": "file",
        "task": "data.txt holds a message written as hexadecimal bytes. Decode it back to text and read the flag.",
        "files": ["data.txt"],
        "hints": [
            "Only the characters 0-9 and a-f appear. Every two of them are one byte.",
            "48 65 6c 6c 6f decodes to 'Hello'. This is hexadecimal.",
            "Try: xxd -r -p data.txt   (or in Python: bytes.fromhex(open('data.txt').read().strip()))",
        ],
    },
    {
        "n": 1, "title": "Base64", "concept": "Encoding: Base64", "kind": "file",
        "task": "data.txt is Base64-encoded. Decode it and recover the flag.",
        "files": ["data.txt"],
        "hints": [
            "The alphabet is A-Z, a-z, 0-9, + and /, often padded with '='.",
            "Base64 is an encoding, not encryption — no key, fully reversible.",
            "Try: base64 -d data.txt",
        ],
    },
    {
        "n": 2, "title": "Bytes & Big Integers", "concept": "Data representations", "kind": "file",
        "task": "The secret was wrapped in several representation layers (a big integer, hex, and Base64). Peel every layer to recover the flag.",
        "files": ["data.txt"],
        "hints": [
            "Decode one layer, look at the result, and ask 'what representation is this now?'",
            "The layers alternate Base64 → hex → a decimal big-integer whose bytes are the message.",
            "For the integer layer: n.to_bytes((n.bit_length()+7)//8, 'big'). Keep going until you see CRYPTO{.",
        ],
    },
    {
        "n": 3, "title": "Single-Byte XOR", "concept": "XOR + frequency analysis", "kind": "file",
        "task": "ciphertext.hex was XORed against a single secret byte. Find the byte and recover the flag.",
        "files": ["ciphertext.hex"],
        "hints": [
            "There are only 256 possible key bytes. Try them all.",
            "The right key produces readable English/text — score candidates by how many letters and spaces appear.",
            "Cryptopals Challenge 3. plaintext = bytes(c ^ k for c in ct) for the best k in range(256).",
        ],
    },
    {
        "n": 4, "title": "Repeating-Key XOR", "concept": "Break Vigenère-style XOR", "kind": "file",
        "task": "ciphertext.hex was XORed with a short repeating key — and the key is NOT given. Recover the key and the flag.",
        "files": ["ciphertext.hex"],
        "hints": [
            "First find the key LENGTH, then solve each key position as its own single-byte XOR.",
            "Normalised Hamming distance between blocks is smallest at the true key size; then transpose columns and frequency-attack each.",
            "This is Cryptopals Challenge 6. The plaintext is ordinary English with the flag inside it.",
        ],
    },
    {
        "n": 5, "title": "Name That Hash", "concept": "Hash identification + cracking", "kind": "file",
        "task": "hash.txt contains one password hash. Identify the algorithm, crack it against wordlist.txt, then run: python3 reveal.py <password> to unlock the flag.",
        "files": ["hash.txt", "wordlist.txt", "reveal.py"],
        "hints": [
            "Hash length in hex characters tells the algorithm: 32=MD5, 40=SHA-1, 64=SHA-256.",
            "It's a fast, unsalted hash of a weak password that IS in wordlist.txt.",
            "hashcat -m 0 hash.txt wordlist.txt, or a 4-line Python loop hashing each word; then reveal.py.",
        ],
    },
    {
        "n": 6, "title": "The Leaky User Table", "concept": "Insecure password storage", "kind": "file",
        "task": "users.db is a stolen SQLite database that stored passwords badly. Crack the admin's password, log in with login.py, and read the flag.",
        "files": ["users.db", "login.py", "wordlist.txt"],
        "hints": [
            "sqlite3 users.db '.dump' — passwords are stored as fast, unsalted hashes.",
            "Crack the 'admin' row's hash against wordlist.txt like the previous level.",
            "python3 login.py, log in as admin with the cracked password — it prints the flag.",
        ],
    },
    {
        "n": 7, "title": "Detect the Mode", "concept": "ECB vs CBC detection", "kind": "svc", "port": 6507,
        "task": f"A service ({SVC}:6507) encrypts your chosen plaintext under AES in ECB or CBC, chosen at random each round. Correctly label 10 rounds in a row and it returns the flag. Details in notes.txt.",
        "files": ["notes.txt"],
        "hints": [
            "ECB encrypts identical plaintext blocks to identical ciphertext blocks; CBC does not.",
            "Send a plaintext of many repeated bytes (e.g. 48 of 'A'). If the ciphertext has a repeated 16-byte block it was ECB.",
            "This is Cryptopals Challenge 11. Loop: send plaintext, read CT, reply 'GUESS ECB' or 'GUESS CBC'.",
        ],
    },
    {
        "n": 8, "title": "ECB Byte-at-a-Time", "concept": "AES-ECB decryption", "kind": "svc", "port": 6508,
        "task": f"A service ({SVC}:6508) encrypts (your input ‖ the secret flag) under AES-ECB with a fixed key. Recover the secret one byte at a time. Source + helper: challenge.py, oracle_client.py.",
        "files": ["challenge.py", "oracle_client.py"],
        "hints": [
            "Prove it's ECB first: feed repeats and watch identical ciphertext blocks appear.",
            "Align the secret so exactly one unknown byte sits at the end of a block, then brute-force that byte by matching ciphertext blocks.",
            "This is Cryptopals Challenge 12. oracle_client.py wraps the network round-trip.",
        ],
    },
    {
        "n": 9, "title": "ECB Cut-and-Paste", "concept": "AES-ECB block splicing", "kind": "svc", "port": 6509,
        "task": f"A service ({SVC}:6509) makes an encrypted profile 'email=<you>&uid=10&role=user'. Rearrange ciphertext blocks so it decrypts to role=admin, submit it, and get the flag. Source: challenge.py.",
        "files": ["challenge.py"],
        "hints": [
            "You control the email, and ECB encrypts each 16-byte block independently.",
            "Craft one profile whose blocks isolate the word 'admin' (plus padding), and another whose 'role=' lands on a block boundary; then paste the admin block on the end.",
            "This is Cryptopals Challenge 13. Use PROFILE <email> to get ciphertext, LOGIN <hex> to submit.",
        ],
    },
    {
        "n": 10, "title": "CBC Bit-Flipping", "concept": "AES-CBC malleability", "kind": "svc", "port": 6510,
        "task": f"A service ({SVC}:6510) gives you an encrypted session token for role=user. Tamper with the ciphertext to become role=admin and it returns the flag. Source: challenge.py.",
        "files": ["challenge.py"],
        "hints": [
            "Flipping byte j of ciphertext block i flips byte j of plaintext block i+1 (and scrambles block i).",
            "Put a sacrificial block before the block holding 'role=user' and flip its bytes to spell 'role=admin'.",
            "This is Cryptopals Challenge 16.",
        ],
    },
    {
        "n": 11, "title": "The Padding Oracle", "concept": "CBC padding oracle", "kind": "svc", "port": 6511,
        "task": f"A service ({SVC}:6511) decrypts your ciphertext and tells you only whether the PKCS#7 padding was valid. That one bit recovers the flag in ciphertext.txt without the key.",
        "files": ["ciphertext.txt"],
        "hints": [
            "Valid-vs-invalid padding leaks one plaintext byte at a time, from the last byte backward.",
            "For each byte, vary the previous block 0..255 until padding is valid, then P = tampered ^ intermediate.",
            "This is Cryptopals Challenge 17.",
        ],
    },
    {
        "n": 12, "title": "Two-Time Pad", "concept": "Stream-cipher nonce reuse", "kind": "file",
        "task": "Two messages were encrypted with the SAME keystream (AES-CTR, reused nonce). You are given both ciphertexts and the plaintext of one of them (the crib). Recover the other message — the flag.",
        "files": ["ciphertext_flag.hex", "ciphertext_crib.hex", "crib.txt"],
        "hints": [
            "Reusing a keystream is a two-time pad. C1 ^ C2 = P1 ^ P2 — the key cancels out.",
            "You know one plaintext (crib.txt), so keystream = ciphertext_crib ^ crib.",
            "Then flag = ciphertext_flag ^ keystream.",
        ],
    },
    {
        "n": 13, "title": "RSA Fundamentals", "concept": "RSA key math", "kind": "file",
        "task": "params.txt gives you p, q, e and a ciphertext c. Build the private key and decrypt c to recover the flag.",
        "files": ["params.txt"],
        "hints": [
            "n = p*q and φ(n) = (p-1)(q-1).",
            "The private exponent is d = e⁻¹ mod φ(n) (modular inverse).",
            "m = pow(c, d, n); then m.to_bytes((m.bit_length()+7)//8, 'big').",
        ],
    },
    {
        "n": 14, "title": "Small-Exponent RSA", "concept": "RSA e=3 cube root", "kind": "file",
        "task": "params.txt gives n, e=3 and c for a short, unpadded message. Recover the plaintext flag.",
        "files": ["params.txt"],
        "hints": [
            "With e=3 and no padding, c = m³ mod n. The message is short, so m³ < n.",
            "That means no modular reduction happened — m is just the integer cube root of c.",
            "sympy.integer_nthroot(c, 3) or gmpy2.iroot(c, 3).",
        ],
    },
    {
        "n": 15, "title": "Twin-Prime RSA", "concept": "Fermat factorization", "kind": "file",
        "task": "public_key.pem plus ciphertext.bin. The two primes were generated too close together. Factor n, rebuild the private key, and decrypt the flag.",
        "files": ["public_key.pem", "ciphertext.bin"],
        "hints": [
            "Read n and e: openssl rsa -pubin -in public_key.pem -text -noout.",
            "n is barely above a perfect square, so p and q are near √n — that's Fermat's factorization.",
            "With p and q: d = e⁻¹ mod (p-1)(q-1), then m = c^d mod n.",
        ],
    },
    {
        "n": 16, "title": "Broadcast RSA", "concept": "Håstad broadcast attack", "kind": "file",
        "task": "The same message was sent to three people, each with e=3 and a different modulus (broadcast.json). Recover the message.",
        "files": ["broadcast.json"],
        "hints": [
            "Each recipient has e=3 and you have three (n_i, c_i) for the SAME plaintext m.",
            "Combine them with the Chinese Remainder Theorem to get m³ mod (n1·n2·n3) = m³ exactly.",
            "Then take the exact integer cube root. This is Håstad's broadcast attack.",
        ],
    },
    {
        "n": 17, "title": "Small-Prime Diffie-Hellman", "concept": "Discrete logarithm", "kind": "svc", "port": 6517,
        "task": f"A service ({SVC}:6517) sends DH parameters p, g, A, B and the flag encrypted under the shared secret. The prime is too small — solve the discrete log and decrypt. Details in notes.txt.",
        "files": ["notes.txt"],
        "hints": [
            "Security rests on the discrete log being hard; here p is small enough to solve it directly.",
            "Recover a from A = g^a mod p (baby-step giant-step), then s = B^a mod p.",
            "key = sha256(str(s).encode()).digest()[:16]; AES-CBC decrypt the flag with the given IV.",
        ],
    },
    {
        "n": 18, "title": "Diffie-Hellman MITM", "concept": "Parameter injection", "kind": "svc", "port": 6518,
        "task": f"A service ({SVC}:6518) relays Diffie-Hellman between Alice and Bob through YOU, and nothing authenticates the keys. Sit in the middle and read the flag Alice sends Bob. Protocol in notes.txt.",
        "files": ["notes.txt"],
        "hints": [
            "Plain DH authenticates nobody — you can substitute the public values in transit.",
            "Send each side pub = g so the shared secret collapses to a value you already know (g^a = A).",
            "Derive key = sha256(str(sa)).digest()[:16] and decrypt Alice's message. Cryptopals Challenge 34.",
        ],
    },
    {
        "n": 19, "title": "Forge the Token", "concept": "JWT / weak HS256", "kind": "web", "port": 8019,
        "task": f"A web app ({WEB}:8019) issues you a JWT as a normal user. The signing secret is weak. Forge an admin token and read the flag at /admin. Details in notes.txt.",
        "files": ["notes.txt", "wordlist.txt"],
        "hints": [
            "Decode the token (base64 its three parts) and look at the header alg and the claims.",
            "The HS256 secret is a guessable word in wordlist.txt — crack it.",
            "Re-sign a token with 'role':'admin' using the recovered secret and call /admin.",
        ],
    },
    {
        "n": 20, "title": "Incident Response — Final", "concept": "Full chain", "kind": "web", "port": 8020,
        "task": "An auth server was breached. The recovered artifacts in incident/ are all you get. Work out how the crypto was built, break it, and recover the administrator secret — the final flag.",
        "files": ["incident/encrypted_config.bin", "incident/public_key.pem",
                  "incident/auth_token.txt", "incident/network_capture.txt",
                  "incident/application/"],
        "hints": [
            "Start with what you can read: the capture and the app source. The capture carries an RSA-wrapped AES key.",
            "public_key.pem reuses the twin-prime weakness — factor it, unwrap the AES key, decrypt encrypted_config.bin.",
            "The config gives up the JWT signing secret. Forge an admin token for web-crypto:8020/admin.",
        ],
    },
]

# category + difficulty for the UI (grouped navigation, difficulty pills)
_GROUP = {
    0:"Encodings",1:"Encodings",2:"Encodings",
    3:"XOR",4:"XOR",
    5:"Hashing",6:"Hashing",
    7:"Block Ciphers · AES",8:"Block Ciphers · AES",9:"Block Ciphers · AES",
    10:"Block Ciphers · AES",11:"Block Ciphers · AES",
    12:"Stream Ciphers",
    13:"RSA",14:"RSA",15:"RSA",16:"RSA",
    17:"Diffie–Hellman",18:"Diffie–Hellman",
    19:"Applied · Web",20:"Applied · Web",
}
_DIFF = {
    0:"intro",1:"intro",2:"intro",
    3:"easy",4:"easy",5:"easy",
    6:"medium",7:"medium",8:"medium",9:"medium",
    10:"hard",11:"hard",12:"hard",
    13:"medium",14:"hard",15:"hard",16:"expert",
    17:"hard",18:"expert",19:"expert",20:"expert",
}
for _lv in LEVELS:
    _lv["group"] = _GROUP[_lv["n"]]
    _lv["diff"] = _DIFF[_lv["n"]]

LEVELS_BY_N = {lv["n"]: lv for lv in LEVELS}
MAX_LEVEL = max(lv["n"] for lv in LEVELS)
