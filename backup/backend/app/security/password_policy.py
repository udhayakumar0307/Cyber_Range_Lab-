import re
from typing import List, Dict, Tuple
from app.security.config import security_settings

COMMON_PASSWORDS = {
    "password", "123456", "12345678", "123456789", "qwerty", "password123",
    "admin123", "cyberrange", "admin2024", "letmein123", "welcome123",
    "password123!", "admin123456", "iloveyou123"
}

class PasswordPolicy:
    @staticmethod
    def evaluate(password: str, email: str = "", username: str = "") -> Tuple[bool, List[str], Dict[str, bool], str]:
        """
        Evaluates a password against platform security requirements: minimum
        length plus upper/lowercase, matching PasswordStrengthMeter.tsx on the
        frontend. email/username are accepted for call-site compatibility but
        no longer factor into validity.
        Returns:
            (is_valid, list_of_errors, check_map, strength_level)
        """
        errors = []
        checks = {
            "min_length": len(password) >= security_settings.MIN_PASSWORD_LENGTH,
            "uppercase": bool(re.search(r'[A-Z]', password)),
            "lowercase": bool(re.search(r'[a-z]', password)),
            "not_common": True,
            "not_repeated": True
        }

        if not checks["min_length"]:
            errors.append(f"Password must be at least {security_settings.MIN_PASSWORD_LENGTH} characters long.")
        if not checks["uppercase"]:
            errors.append("Password must contain at least one uppercase letter.")
        if not checks["lowercase"]:
            errors.append("Password must contain at least one lowercase letter.")

        lower_pw = password.lower()

        # Common passwords check
        if lower_pw in COMMON_PASSWORDS or any(c in lower_pw for c in ["password", "123456", "qwerty", "admin123"]):
            checks["not_common"] = False
            errors.append("Password is too common or weak.")

        # Repeated characters check (e.g., 4 or more identical characters in a row)
        if re.search(r'(.)\1{3,}', password):
            checks["not_repeated"] = False
            errors.append("Password contains too many repeated characters.")

        valid_rules_count = sum([
            checks["min_length"],
            checks["uppercase"],
            checks["lowercase"],
            checks["not_common"],
            checks["not_repeated"]
        ])

        strength = "Good" if valid_rules_count == 5 else "Weak"

        is_valid = len(errors) == 0
        return is_valid, errors, checks, strength

password_policy = PasswordPolicy()
