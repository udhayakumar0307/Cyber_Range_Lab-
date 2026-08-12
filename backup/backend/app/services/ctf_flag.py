"""
CTF flag hashing utilities.

Flags are stored as  SHA-256(flag + salt) so that the plain-text flag is
never persisted anywhere in the database.
"""

import hashlib
import secrets


def generate_salt(length: int = 32) -> str:
    """Return a cryptographically-random hex salt string."""
    return secrets.token_hex(length)


def hash_flag(flag: str, salt: str) -> str:
    """Return the hex SHA-256 digest of (flag + salt)."""
    combined = (flag + salt).encode("utf-8")
    return hashlib.sha256(combined).hexdigest()


def verify_flag(submitted: str, salt: str, stored_hash: str) -> bool:
    """Return True if submitted flag matches the stored hash."""
    return hash_flag(submitted.strip(), salt) == stored_hash
