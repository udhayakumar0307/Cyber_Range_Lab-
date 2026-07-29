import logging
import time
from typing import Set, Dict, Optional
from app.security.jwt_security import decode_token, create_access_token, create_refresh_token

logger = logging.getLogger(__name__)

class TokenManager:
    def __init__(self):
        # In-memory store for revoked token identifiers (JTI or raw tokens)
        self.revoked_tokens: Set[str] = set()
        # Active refresh tokens per user_id: {user_id: {refresh_jti: token_data}}
        self.user_sessions: Dict[int, Dict[str, dict]] = {}

    def is_token_revoked(self, token: str) -> bool:
        payload = decode_token(token)
        if not payload:
            return True
        jti = payload.get("jti")
        if jti and jti in self.revoked_tokens:
            return True
        if token in self.revoked_tokens:
            return True
        return False

    def revoke_token(self, token: str, user_id: Optional[int] = None):
        payload = decode_token(token)
        if payload:
            jti = payload.get("jti")
            if jti:
                self.revoked_tokens.add(jti)
            self.revoked_tokens.add(token)
            
            sub_id = user_id or payload.get("user_id")
            if sub_id and sub_id in self.user_sessions and jti in self.user_sessions[sub_id]:
                del self.user_sessions[sub_id][jti]

    def revoke_all_user_sessions(self, user_id: int):
        if user_id in self.user_sessions:
            for jti in list(self.user_sessions[user_id].keys()):
                self.revoked_tokens.add(jti)
            self.user_sessions[user_id] = {}
        logger.info(f"Revoked all sessions for user_id={user_id}")

    def register_refresh_token(self, user_id: int, refresh_token: str, remember_me: bool = False):
        payload = decode_token(refresh_token, expected_type="refresh")
        if payload and "jti" in payload:
            if user_id not in self.user_sessions:
                self.user_sessions[user_id] = {}
            self.user_sessions[user_id][payload["jti"]] = {
                "token": refresh_token,
                "remember_me": remember_me,
                "created_at": time.time()
            }

    def rotate_refresh_token(self, refresh_token: str) -> Optional[dict]:
        """
        Validates refresh token, revokes it (rotation), and creates a new access token and refresh token pair.
        """
        if self.is_token_revoked(refresh_token):
            logger.warning("Attempted to use revoked refresh token")
            return None

        payload = decode_token(refresh_token, expected_type="refresh")
        if not payload:
            return None

        user_email = payload.get("sub")
        user_id = payload.get("user_id")
        role = payload.get("role", "user")
        org_id = payload.get("organization_id", "")
        remember_me = payload.get("remember_me", False)

        # Revoke used refresh token
        self.revoke_token(refresh_token, user_id=user_id)

        # Generate new pair
        token_data = {
            "sub": user_email,
            "user_id": user_id,
            "role": role,
            "organization_id": org_id
        }
        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data, remember_me=remember_me)

        if user_id:
            self.register_refresh_token(user_id, new_refresh_token, remember_me=remember_me)

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "role": role
        }

token_manager = TokenManager()
