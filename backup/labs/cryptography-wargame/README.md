# 🔐 Cryptography Wargame

A Dockerized, OverTheWire **Bandit-style** cryptography lab for the CyberRange
platform. 21 sequential levels (00 → 20) take a student from basic encodings to
a full multi-stage incident-response chain. Each level is a *task*, not a
lecture: read the short brief, recover the `CRYPTO{...}` flag, submit it on the
portal, and the next level unlocks.

```
START → LVL00 → LVL01 → … → LVL20 → LAB COMPLETE
         solve → submit → unlock next
```

Future levels stay locked in a portal-only vault until the previous flag is
accepted — a student cannot skip ahead.

---

## Quick start

```bash
cd cryptography-lab

# pick a student id + seed (the seed makes every flag unique per student)
export STUDENT_ID=alice
export LAB_SEED=my-cohort-seed

docker compose up --build -d
```

Then:

| What | Where |
|------|-------|
| **Portal** — task cards, hints, flag submission, progress | http://localhost:5000 |
| **Student shell** — where you actually solve levels | `docker compose exec student-env bash` |
| Unlocked level files (read-only, inside the shell) | `/levels/NN` |
| Interactive challenge services | `crypto-services:6510-6518` |
| Web-crypto apps | `web-crypto:8019`, `web-crypto:8020` |

The portal takes a few seconds on first boot to generate the challenge set
(it factors/creates RSA keys). Wait for `GET /api/health` to return `status: ok`.

---

## How a student plays

1. Open the portal, read **Level 00**'s task card.
2. `docker compose exec student-env bash`, then explore `/levels/00`.
3. Recover the flag using the tools in the shell (`ls`, `find`, `xxd`,
   `base64`, `openssl`, `sqlite3`, `nc`, `curl`, `python3` with
   `pycryptodome`/`pyjwt`/`sympy`).
4. Paste `CRYPTO{...}` into the portal and submit. Level 01 unlocks and its
   files appear under `/levels/01`.
5. Repeat to Level 20.

Hints are optional and progressive (nudge → concrete → exact tool). They never
give away the whole answer.

---

## The 21 levels

| # | Title | Concept | Kind |
|---|-------|---------|------|
| 00 | Hexadecimal | Encoding: hex ↔ bytes | files |
| 01 | Base64 | Encoding: Base64 | files |
| 02 | Bytes & Big Integers | Data representations | files |
| 03 | Single-Byte XOR | XOR + frequency analysis | files |
| 04 | Repeating-Key XOR | Break Vigenère-style XOR (Cryptopals 6) | files |
| 05 | Name That Hash | Hash id + wordlist cracking | files |
| 06 | The Leaky User Table | Insecure password storage (SQLite) | files |
| 07 | Detect the Mode | ECB vs CBC detection (Cryptopals 11) | **service** :6507 |
| 08 | ECB Byte-at-a-Time | AES-ECB decryption (Cryptopals 12) | **service** :6508 |
| 09 | ECB Cut-and-Paste | AES-ECB block splicing (Cryptopals 13) | **service** :6509 |
| 10 | CBC Bit-Flipping | AES-CBC malleability (Cryptopals 16) | **service** :6510 |
| 11 | The Padding Oracle | CBC padding oracle (Cryptopals 17) | **service** :6511 |
| 12 | Two-Time Pad | Stream-cipher nonce reuse | files |
| 13 | RSA Fundamentals | RSA key math | files |
| 14 | Small-Exponent RSA | RSA e=3 cube root | files |
| 15 | Twin-Prime RSA | Fermat factorization | files |
| 16 | Broadcast RSA | Håstad broadcast attack | files |
| 17 | Small-Prime Diffie-Hellman | Discrete logarithm | **service** :6517 |
| 18 | Diffie-Hellman MITM | Parameter injection (Cryptopals 34) | **service** :6518 |
| 19 | Forge the Token | JWT / weak HS256 | **web** :8019 |
| 20 | Incident Response — Final | Full chain (RSA→AES→JWT) | files + **web** :8020 |

Difficulty rises by *how much the student must figure out*: early levels tell
you the encoding; middle levels give a ciphertext; late levels give only a
scenario.

---

## Architecture

```
cryptography-lab/
├── docker-compose.yml         # 4 services on one bridge network
├── generator.py               # builds all 21 levels from (STUDENT_ID, LAB_SEED)
├── common/
│   ├── labcrypto.py           # deterministic flags / keys / weak secrets
│   └── levels_meta.py         # task text, files, hints per level
├── portal/                    # Flask: UI, hints, submit, unlock gate  (:5000)
├── net-services/              # socket servers for levels 10-13,17,18
├── web-crypto/                # Flask JWT apps for levels 19 & 20      (:8019/:8020)
├── student-env/               # the shell container the student works in
└── solutions/                 # reference solvers + automated grader (instructors)
```

- **Deterministic & per-student.** Every flag, key, and weak secret is derived
  from `SHA-256(context | STUDENT_ID | LAB_SEED)`. Same student+seed always
  rebuilds byte-identical challenges; different students get different flags, so
  answers can't be shared.
- **Unlock gate.** The portal generates the full set into a private `crypto-vault`
  volume and copies level *N* into the shared `crypto-levels` volume only after
  level *N-1*'s flag is accepted. The student mounts `crypto-levels` read-only.
- **Flag format.** `CRYPTO{lvlNN_<12 hex>}`.

### Portal API (CyberRange-compatible)

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/health` | liveness |
| GET  | `/api/progress` | current level, completed set, per-level status |
| GET  | `/api/level/<n>` | task card (403 if locked) |
| GET  | `/api/hint/<n>/<i>` | progressive hint |
| POST | `/api/submit-flag` | `{level, flag}` → correct?/unlock (rate-limited) |
| POST | `/api/reset` | reset progress, re-lock everything |

---

## Admin / operations

```bash
# per-student instance (unique flags)
STUDENT_ID=bob LAB_SEED=cohort-2026 docker compose up --build -d

# reset a student's progress (re-locks all levels)
curl -X POST http://localhost:5000/api/reset

# full teardown incl. generated volumes (fresh challenge set next boot)
docker compose down -v

# view the answer key for a running instance
docker compose exec portal cat /srv/vault/FLAGS.json
```

Each level is independently resettable: `docker compose down -v` wipes the vault,
and the next boot regenerates it from `STUDENT_ID`/`LAB_SEED`.

---

## Testing (for lab authors)

`solutions/` contains reference solvers **and** a grader that proves every level
is solvable and that progression works. With the stack up:

```bash
python3 -m venv .testvenv && . .testvenv/bin/activate
pip install pycryptodome pyjwt sympy flask

# generate a reference vault with the SAME seed the stack is running
python3 generator.py --out /tmp/vault --student alice --seed testseed

# solve everything and drive it through the live portal (21/21 expected)
HOST=localhost PORTAL=http://localhost:5000 python3 solutions/full_playthrough.py /tmp/vault
```

Individual suites: `solve_offline.py` (00-09,14-16), `solve_online.py`
(10-13,17,18), `solve_web.py` (19,20).

> ⚠️ The reference solvers are the **instructor answer key** — don't ship the
> `solutions/` directory to students. It's excluded from the Docker build via
> `.dockerignore`.

---

## Notes & caveats

- The Flask servers are development servers — fine for a lab, not for production.
- DH levels use a deliberately small prime so the discrete log is feasible; the
  RSA levels use small/badly-generated keys on purpose. This is the point.
- Always-on services (10-13, 17-19) are reachable regardless of unlock state, but
  a flag still requires the gated files and the actual attack, so sequencing holds.
