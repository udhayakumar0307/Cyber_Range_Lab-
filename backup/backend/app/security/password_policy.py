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
        Evaluates a password against platform security requirements.
        Returns:
            (is_valid, list_of_errors, check_map, strength_level)
        """
        errors = []
        checks = {
            "min_length": len(password) >= security_settings.MIN_PASSWORD_LENGTH,
            "uppercase": bool(re.search(r'[A-Z]', password)),
            "lowercase": bool(re.search(r'[a-z]', password)),
            "number": bool(re.search(r'\d', password)),
            "special": bool(re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>/?~`]', password)),
            "not_user_info": True,
            "not_common": True,
            "not_repeated": True
        }

        if not checks["min_length"]:
            errors.append(f"Password must be at least {security_settings.MIN_PASSWORD_LENGTH} characters long.")
        if not checks["uppercase"]:
            errors.append("Password must contain at least one uppercase letter.")
        if not checks["lowercase"]:
            errors.append("Password must contain at least one lowercase letter.")
        if not checks["number"]:
            errors.append("Password must contain at least one number.")
        if not checks["special"]:
            errors.append("Password must contain at least one special character.")

        # Check identity comparison
        lower_pw = password.lower()
        if email:
            email_user = email.split('@')[0].lower()
            if email.lower() in lower_pw or (len(email_user) >= 3 and email_user in lower_pw):
                checks["not_user_info"] = False
                errors.append("Password must not contain your email address or username.")

        if username and len(username) >= 3:
            if username.lower() in lower_pw:
                checks["not_user_info"] = False
                errors.append("Password must not contain your username.")

        # Common passwords check
        if lower_pw in COMMON_PASSWORDS or any(c in lower_pw for c in ["password", "123456", "qwerty", "admin123"]):
            checks["not_common"] = False
            errors.append("Password is too common or weak.")

        # Repeated characters check (e.g., 4 or more identical characters in a row)
        if re.search(r'(.)\1{3,}', password):
            checks["not_repeated"] = False
            errors.append("Password contains too many repeated characters.")

        # Compute Strength Level
        valid_rules_count = sum([
            checks["min_length"],
            checks["uppercase"],
            checks["lowercase"],
            checks["number"],
            checks["special"],
            checks["not_user_info"],
            checks["not_common"],
            checks["not_repeated"]
        ])

        if len(password) >= 14 and valid_rules_count == 8:
            strength = "Very Strong"
        elif len(password) >= 12 and valid_rules_count >= 7:
            strength = "Strong"
        elif len(password) >= 8 and valid_rules_count >= 4:
            strength = "Fair"
        else:
            strength = "Weak"

        is_valid = len(errors) == 0
        return is_valid, errors, checks, strength

password_policy = PasswordPolicy()
