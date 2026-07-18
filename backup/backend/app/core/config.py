import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

class Settings:
    def __init__(self):
        # Locate the backend folder's .env file
        self.backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.env_path = os.path.join(self.backend_dir, ".env")
        self.reload()

    def reload(self):
        # Reload the environment variables from disk
        if os.path.exists(self.env_path):
            load_dotenv(self.env_path, override=True)
            logger.info("Configuration reloaded from .env file.")
        else:
            load_dotenv(override=True)
            logger.warning(".env file not found. Reading from current process environment.")
            
        self.ENV = os.getenv("ENV", "development")
        self.FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
        self.SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me-in-production")
        self.ALGORITHM = os.getenv("ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # Default 24 hrs for dev ease
        
        # Admin credentials
        self.ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
        self.ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
        self.ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "") # If empty, it'll generate one
        
        # AWS / Amazon SES Configurations
        self.AWS_REGION = os.getenv("AWS_REGION")
        self.AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
        self.AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.SES_FROM_EMAIL = os.getenv("SES_FROM_EMAIL")
        
        # Database Configuration
        self.DATABASE_URL = os.getenv("DATABASE_URL")

        # Fallback 1: Build URL if DATABASE_URL is not set but individual variables are
        if not self.DATABASE_URL:
            db_host = os.getenv("DATABASE_HOST")
            db_port = os.getenv("DATABASE_PORT", "5432")
            db_name = os.getenv("DATABASE_NAME")
            db_user = os.getenv("DATABASE_USER")
            db_password = os.getenv("DATABASE_PASSWORD")

            if db_host and db_name and db_user:
                self.DATABASE_URL = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
                logger.info(f"Database URL built from AWS RDS / DATABASE_* variables: {db_host}:{db_port}/{db_name}")
        
        # Fallback 2: Build URL from DB_* if still not set
        if not self.DATABASE_URL:
            db_user_fb = os.getenv("DB_USER")
            db_password_fb = os.getenv("DB_PASSWORD")
            db_host_fb = os.getenv("DB_HOST", "localhost")
            db_port_fb = os.getenv("DB_PORT", "5432")
            db_name_fb = os.getenv("DB_NAME")
            
            if db_user_fb and db_password_fb and db_name_fb:
                self.DATABASE_URL = f"postgresql://{db_user_fb}:{db_password_fb}@{db_host_fb}:{db_port_fb}/{db_name_fb}"
                logger.info(f"Database URL built from DB_* components: {db_host_fb}:{db_port_fb}/{db_name_fb}")
            else:
                # Default SQLite database fallback for development
                self.DATABASE_URL = "sqlite:///./cyberrange.db"
                logger.warning("No database URL or components specified. Falling back to default SQLite database.")

    def get_database_url(self) -> str:
        return self.DATABASE_URL

settings = Settings()
