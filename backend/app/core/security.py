import os
import logging
from datetime import datetime, timedelta
import bcrypt
from app.core.config import settings
from app.security.jwt_security import (
    create_access_token as sec_create_access_token,
    decode_access_token as sec_decode_access_token
)

logger = logging.getLogger(__name__)

def get_password_hash(password: str) -> str:
    """
    Hashes a password using bcrypt.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against its bcrypt hash.
    """
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception as e:
        logger.error(f"Password verification failed: {e}")
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Generates a JWT access token via centralized security module.
    """
    return sec_create_access_token(data, expires_delta=expires_delta)

def decode_access_token(token: str) -> dict:
    """
    Decodes and validates a JWT access token via centralized security module.
    """
    return sec_decode_access_token(token)

