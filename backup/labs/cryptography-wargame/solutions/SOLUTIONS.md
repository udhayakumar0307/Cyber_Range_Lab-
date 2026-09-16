# Instructor Solution Guide (v2 curriculum)

> Answer key. Kept out of the student image via `.dockerignore`.
> Runnable solvers: `solve_offline.py` (0-6,12-16), `solve_online.py` (7-11,17,18),
> `solve_web.py` (19,20), and `full_playthrough.py` (drives all 21 through the portal).

Flags are `CRYPTO{lvlNN_<hex>}`, unique per `(STUDENT_ID, LAB_SEED)`.
`docker compose exec portal cat /srv/vault/FLAGS.json` shows the live answers.

| # | Title | Attack in one line |
|---|-------|--------------------|
| 00 | Hexadecimal | `xxd -r -p data.txt` (or `bytes.fromhex`). |
| 01 | Base64 | `base64 -d data.txt`. |
| 02 | Bytes & Big Integers | `base64 -d` → un-hex → `int(decimal)` → `int.to_bytes`. |
| 03 | Single-Byte XOR | Try all 256 keys, pick the one scoring most English (Cryptopals 3). |
| 04 | Repeating-Key XOR | Keysize via Hamming distance, transpose columns, single-byte XOR each (Cryptopals 6). |
| 05 | Name That Hash | MD5 (32 hex) → crack vs `wordlist.txt` → `python3 reveal.py <pw>`. |
| 06 | The Leaky User Table | `sqlite3 users.db` → admin MD5 → crack → `python3 login.py` as admin. |
| 07 | Detect the Mode | Send 48×'A'; repeated 16-byte block ⇒ ECB else CBC; 10 correct in a row (Cryptopals 11). |
| 08 | ECB Byte-at-a-Time | Byte-at-a-time ECB decryption vs `crypto-services:6508` (Cryptopals 12). |
| 09 | ECB Cut-and-Paste | Build an isolated `admin`+padding block, paste it after `...&role=` (Cryptopals 13). |
| 10 | CBC Bit-Flipping | Flip bytes in the block before `role=user` to make `role=admin` (Cryptopals 16). |
| 11 | The Padding Oracle | Byte-by-byte padding-oracle recovery from `ciphertext.txt` vs `:6511` (Cryptopals 17). |
| 12 | Two-Time Pad | `ks = ct_crib ^ crib`; `flag = ct_flag ^ ks`. |
| 13 | RSA Fundamentals | `d = e⁻¹ mod (p-1)(q-1)`; `m = c^d mod n`. |
| 14 | Small-Exponent RSA | e=3, short msg ⇒ integer cube root of c. |
| 15 | Twin-Prime RSA | Fermat-factor n (p≈q) → d → decrypt `ciphertext.bin`. |
| 16 | Broadcast RSA | CRT over three (n,c), e=3, then exact cube root (Håstad). |
| 17 | Small-Prime Diffie-Hellman | BSGS for `a` from `A=g^a`; `s=B^a`; key `sha256(str(s))[:16]`; AES-CBC decrypt. |
| 18 | Diffie-Hellman MITM | Send both sides `pub=g` ⇒ `sa=g^a=A`; decrypt Alice's `alice_msg` (Cryptopals 34). |
| 19 | Forge the Token | Crack weak HS256 secret vs `wordlist.txt`, forge `role=admin`, `GET /admin` on `:8019`. |
| 20 | Incident Response (Final) | Fermat-factor `public_key.pem` → unwrap AES key from capture → decrypt config → JWT secret → forge admin → `GET web-crypto:8020/admin`. |
