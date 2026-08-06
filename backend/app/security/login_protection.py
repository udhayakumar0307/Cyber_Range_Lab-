import time
import logging
from typing import Dict, Tuple
from fastapi import HTTPException, status
from app.security.config import security_settings

logger = logging.getLogger(__name__)

class LoginProtectionManager:
    def __init__(self):
        # Key: identifier (e.g., email or IP) -> value: {"attempts": int, "lockout_until": float, "last_attempt": float}
        self.attempts: Dict[str, dict] = {}

    def _get_keys(self, email: str, ip_address: str) -> Tuple[str, str]:
        email_key = f"email:{email.lower().strip()}"
        ip_key = f"ip:{ip_address.strip()}"
        return email_key, ip_key

    def is_locked_out(self, email: str, ip_address: str = "") -> Tuple[bool, int]:
        """
        Checks if account or IP is locked out.
        Returns: (is_locked, retry_after_seconds)
        """
        now = time.time()
        email_key, ip_key = self._get_keys(email, ip_address)

        for key in (email_key, ip_key):
            if key in self.attempts:
                rec = self.attempts[key]
                if rec.get("lockout_until", 0) > now:
                    remaining = int(rec["lockout_until"] - now)
                    return True, remaining
                elif rec.get("lockout_until", 0) <= now and rec.get("attempts", 0) >= security_settings.MAX_FAILED_LOGIN_ATTEMPTS:
                    # Lockout expired, reset attempts
                    self.attempts[key] = {"attempts": 0, "lockout_until": 0, "last_attempt": now}

        return False, 0

    def record_failed_attempt(self, email: str, ip_address: str = ""):
        now = time.time()
        email_key, ip_key = self._get_keys(email, ip_address)

        for key in (email_key, ip_key):
            if not key or key == "ip:":
                continue
            if key not in self.attempts:
                self.attempts[key] = {"attempts": 1, "lockout_until": 0, "last_attempt": now}
            else:
                rec = self.attempts[key]
                rec["attempts"] += 1
                rec["last_attempt"] = now
                if rec["attempts"] >= security_settings.MAX_FAILED_LOGIN_ATTEMPTS:
                    # Exponential lockout calculation based on excess attempts
                    excess = rec["attempts"] - security_settings.MAX_FAILED_LOGIN_ATTEMPTS
                    duration = security_settings.LOCKOUT_DURATION_MINUTES * 60 * (2 ** excess)
                    rec["lockout_until"] = now + duration
                    logger.warning(f"Lockout triggered for {key} for {duration} seconds")

    def record_successful_login(self, email: str, ip_address: str = ""):
        email_key, ip_key = self._get_keys(email, ip_address)
        self.attempts.pop(email_key, None)
        self.attempts.pop(ip_key, None)

    def check_and_enforce_protection(self, email: str, ip_address: str = ""):
        locked, retry_after = self.is_locked_out(email, ip_address)
        if locked:
            minutes = max(1, retry_after // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Account is temporarily locked. Please try again in {minutes} minutes."
            )

login_protection = LoginProtectionManager()
