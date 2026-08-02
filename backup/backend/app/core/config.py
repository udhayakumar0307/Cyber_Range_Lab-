import os
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

class Settings:
    def __init__(self):
        self.app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.backend_dir = os.path.dirname(self.app_dir)
        self.root_dir = os.path.dirname(self.backend_dir)
        self.reload()

    def reload(self):
        backend_env = os.path.join(self.backend_dir, ".env")
        root_env = os.path.join(self.root_dir, ".env")
        
        # Load backend .env first
        if os.path.exists(backend_env):
            load_dotenv(backend_env)
            logger.info(f"Loaded configuration from {backend_env}")

        # Load root .env (root workspace .env provides primary credentials)
        if os.path.exists(root_env):
            load_dotenv(root_env, override=True)
            logger.info(f"Loaded configuration from root {root_env}")
            
        self.ENV = os.getenv("ENV", "development")
        self.FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
        self.SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me-in-production")
        self.ALGORITHM = os.getenv("ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # Default 24 hrs for dev ease
        
        # Admin credentials & Security Key
        self.ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
        self.ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@cyberrange.in")
        self.ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "") # If empty, it'll generate one
        self.ADMIN_REGISTRATION_KEY = os.getenv("ADMIN_REGISTRATION_KEY", "CYBERRANGE-ADMIN-2026")
        self.SYSTEM_ADMIN_SECURITY_KEY = os.getenv("SYSTEM_ADMIN_SECURITY_KEY", "CYBERRANGE-SYSTEM-KEY-2026-X99")
        self.SYSTEM_ADMIN_NAME = os.getenv("SYSTEM_ADMIN_NAME", "System Admin")
        self.SYSTEM_ADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "sysadmin@cyberrange.in")
        self.SYSTEM_ADMIN_PASSWORD = os.getenv("SYSTEM_ADMIN_PASSWORD", "sysadmin_password_2026")
        self.ALLOWED_ADMIN_DOMAINS = [d.strip().lower() for d in os.getenv("ADMIN_ALLOWED_DOMAINS", os.getenv("ALLOWED_ADMIN_DOMAINS", "cyberrange.in")).split(",") if d.strip()]
        self.ADMIN_ALLOWED_DOMAINS = self.ALLOWED_ADMIN_DOMAINS
        self.STUDENT_ALLOWED_DOMAINS = [d.strip().lower() for d in os.getenv("STUDENT_ALLOWED_DOMAINS", "gmail.com,*.edu,*.ac.in,college.edu,example.ac.in").split(",") if d.strip()]
        
        # Google OAuth Credentials
        self.GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
        self.GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
        
        # Razorpay Production Credentials
        self.RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
        self.RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
        self.RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
        self.ENABLE_GST = os.getenv("ENABLE_GST", "true").lower() in ("true", "1", "yes")

        if not self.RAZORPAY_KEY_ID or not self.RAZORPAY_KEY_SECRET:
            logger.warning("[Startup Warning] Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing in .env! Production checkout initialization will require valid credentials.")
        
        # AWS / Amazon SES Configurations
        self.AWS_REGION = os.getenv("AWS_REGION")
        self.AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
        self.AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.SNS_TOPIC_ARN = os.getenv("SNS_TOPIC_ARN")
        # Absolute path is deliberately configurable for container deployments.
        self.LABS_DIRECTORY = os.getenv("LABS_DIRECTORY", os.path.join(self.root_dir, "labs"))
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
                # Prevent silent fallback to local SQLite database in production mode
                if self.ENV == "development" and os.getenv("ALLOW_SQLITE_DEV", "false").lower() in ("true", "1"):
                    self.DATABASE_URL = "sqlite:///./cyberrange.db"
                    logger.warning("Explicit development mode: using SQLite database fallback.")
                else:
                    logger.critical("PostgreSQL configuration missing. Set DATABASE_URL or DATABASE_HOST/DATABASE_USER/DATABASE_NAME in .env!")
                    raise RuntimeError("PostgreSQL configuration missing.")

    def get_database_url(self) -> str:
        return self.DATABASE_URL

settings = Settings()
