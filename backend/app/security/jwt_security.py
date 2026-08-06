import logging
import uuid
from datetime import datetime, timedelta
import jwt
from app.core.config import settings
from app.security.config import security_settings

logger = logging.getLogger(__name__)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Generates a JWT access token with unique JTI, expiration, and type.
    """
    to_encode = data.copy()
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=security_settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "access"
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict, remember_me: bool = False) -> str:
    """
    Generates a JWT refresh token with unique JTI, extended expiry for remember_me.
    """
    to_encode = data.copy()
    now = datetime.utcnow()
    days = security_settings.REMEMBER_ME_REFRESH_EXPIRE_DAYS if remember_me else security_settings.REFRESH_TOKEN_EXPIRE_DAYS
    expire = now + timedelta(days=days)

    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "type": "refresh",
        "remember_me": remember_me
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str, expected_type: str = None) -> dict:
    """
    Decodes and validates a JWT token. Checks expiration and token type.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if expected_type and payload.get("type") and payload.get("type") != expected_type:
            logger.warning(f"Token type mismatch: expected {expected_type}, got {payload.get('type')}")
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired.")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None

def decode_access_token(token: str) -> dict:
    """
    Backward-compatible decode access token function.
    """
    return decode_token(token, expected_type="access") or decode_token(token)  # Fallback for legacy tokens without type
