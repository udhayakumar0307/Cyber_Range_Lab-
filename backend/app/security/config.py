import os

class SecuritySettings:
    # Password Policy
    MIN_PASSWORD_LENGTH: int = int(os.getenv("SECURITY_MIN_PASSWORD_LENGTH", "12"))
    REQUIRE_UPPERCASE: bool = os.getenv("SECURITY_REQUIRE_UPPERCASE", "True").lower() in ("true", "1")
    REQUIRE_LOWERCASE: bool = os.getenv("SECURITY_REQUIRE_LOWERCASE", "True").lower() in ("true", "1")
    REQUIRE_NUMBERS: bool = os.getenv("SECURITY_REQUIRE_NUMBERS", "True").lower() in ("true", "1")
    REQUIRE_SPECIAL_CHARACTERS: bool = os.getenv("SECURITY_REQUIRE_SPECIAL_CHARACTERS", "True").lower() in ("true", "1")

    # Lockout Settings
    MAX_FAILED_LOGIN_ATTEMPTS: int = int(os.getenv("SECURITY_MAX_FAILED_LOGIN_ATTEMPTS", "5"))
    LOCKOUT_DURATION_MINUTES: int = int(os.getenv("SECURITY_LOCKOUT_DURATION_MINUTES", "15"))

    # JWT Lifetimes
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    REMEMBER_ME_REFRESH_EXPIRE_DAYS: int = int(os.getenv("REMEMBER_ME_REFRESH_EXPIRE_DAYS", "30"))

    # OAuth Settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5173/oauth/callback/google")

    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:5173/oauth/callback/github")

security_settings = SecuritySettings()
