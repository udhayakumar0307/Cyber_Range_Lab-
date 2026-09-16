#!/usr/bin/env python3
"""
Shared helpers for the Cryptography Wargame.

Everything a level needs to compute its own flag deterministically lives here.
Both the generator (which builds challenge files) and the network services
(which validate/serve flags) import from this module, so a given
(STUDENT_ID, LAB_SEED) always yields the same 21 flags.
"""
import hashlib
import hmac
import os

FLAG_PREFIX = "CRYPTO"

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
def flag_for(level: int, student_id: str, lab_seed: str) -> str:
    """Deterministic per-student flag for a level: CRYPTO{lvlNN_xxxxxxxxxxxx}."""
    raw = f"cryptowargame|lvl{level:02d}|{student_id}|{lab_seed}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:12]
    return f"{FLAG_PREFIX}{{lvl{level:02d}_{digest}}}"


def secret_word(level: int, student_id: str, lab_seed: str, salt: str = "") -> str:
    """A deterministic pseudo-random lowercase token, handy for passwords/keys."""
    raw = f"word|{level}|{student_id}|{lab_seed}|{salt}"
    return hashlib.sha256(raw.encode()).hexdigest()[:10]


def det_bytes(n: int, *parts) -> bytes:
    """Deterministic n bytes derived from the given parts (for keys/IVs/primes)."""
    seed = "|".join(str(p) for p in parts).encode()
    out = b""
    counter = 0
    while len(out) < n:
        out += hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:n]


def det_int(bits: int, *parts) -> int:
    """Deterministic integer with the requested bit length."""
    nbytes = (bits + 7) // 8
    val = int.from_bytes(det_bytes(nbytes, *parts), "big")
    val |= 1 << (bits - 1)          # force top bit -> exact bit length
    return val


# ---------------------------------------------------------------------------
# Weak, guessable secrets (shared by the generator and the web-crypto app).
# All of these appear in common cracking wordlists (rockyou etc.), so the JWT
# levels are solvable with standard tools or the bundled wordlist.
# ---------------------------------------------------------------------------
WEAK_WORDS = [
    "secret", "password", "dragon", "letmein", "sunshine", "monkey",
    "shadow", "master", "superman", "trustno1", "welcome", "ninja",
    "football", "iloveyou", "starwars", "computer", "hunter", "batman",
    "freedom", "whatever", "cheese", "matrix", "flower", "chocolate",
]

def weak_secret(tag: str, student_id: str, lab_seed: str) -> str:
    idx = int.from_bytes(det_bytes(2, tag, student_id, lab_seed), "big") % len(WEAK_WORDS)
    return WEAK_WORDS[idx]
