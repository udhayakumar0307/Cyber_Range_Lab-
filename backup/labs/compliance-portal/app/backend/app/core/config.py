import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CMS Privacy Analysis Engine"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv(
        "ECOMMERCE_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5440/postgres"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkeyforencryption12345")
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
