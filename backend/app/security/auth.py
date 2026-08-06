"""
Centralized Security Auth Helper
Facilitates password verification, hashing, token creation/verification, and login protection integration.
"""
from app.core.security import get_password_hash, verify_password
from app.security.jwt_security import create_access_token, create_refresh_token, decode_token, decode_access_token
from app.security.password_policy import password_policy
from app.security.password_validator import password_validator
from app.security.login_protection import login_protection
from app.security.token_manager import token_manager
from app.security.oauth import oauth_manager

__all__ = [
    "get_password_hash",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "decode_access_token",
    "password_policy",
    "password_validator",
    "login_protection",
    "token_manager",
    "oauth_manager",
]
