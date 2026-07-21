"""
backend/config.py (updated)

Changes vs previous:
- Role constants added as single source of truth.
  Import these everywhere instead of hardcoding role strings.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

# ── Role constants ────────────────────────────────────────────────────────────
ROLE_SYS_ADMIN    = "sys_admin"
ROLE_COURSE_ADMIN = "course_admin"
ROLE_PARTICIPANT  = "participant"

ALL_ROLES = {ROLE_SYS_ADMIN, ROLE_COURSE_ADMIN, ROLE_PARTICIPANT}

# ── Guardrail defaults ────────────────────────────────────────────────────────
GUARDRAIL_DEFAULT_MAX_CONCURRENT  = 10
GUARDRAIL_DEFAULT_MAX_DURATION_HOURS = 500


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        extra="ignore",
        case_sensitive=False,
    )

    DATABASE_URL: str
    MIGRATION_DATABASE_URL: str
    JWT_SECRET: str
    GOOGLE_CLIENT_ID: str

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    JWT_ALGO: str = "HS256"
    JWT_ISSUER: str = "cyberrange"
    JWT_AUDIENCE: str = "cyberrange-users"
    ALLOWED_SSO_PROVIDERS: list[str] = ["google"]

    HEADSCALE_API_KEY: str
    HEADSCALE_API_URL: str
    AWS_REGION: str = "ap-south-1"

    CORS_ALLOWED_ORIGINS: str | list[str] = []

    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_DEPLOY: str = "5/minute"
    RATE_LIMIT_TAILNET: str = "10/minute"

    TRUSTED_PROXY_IPS: list[str] = []
    REDIS_URL: str = "redis://localhost:6379/0"
    ENABLE_DOCS: bool = False

    # ── Razorpay payment gateway ──────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def ensure_async_pg_driver(cls, v: str) -> str:
        if v:
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("MIGRATION_DATABASE_URL", mode="before")
    @classmethod
    def ensure_async_pg_driver_migration(cls, v: str) -> str:
        if v:
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_strength(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 characters. "
                "Generate one with: openssl rand -hex 32"
            )
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()