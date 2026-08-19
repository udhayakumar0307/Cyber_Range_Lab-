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
        self.LABS_DIRECTORY = os.getenv("LABS_DIRECTORY", os.path.join(self.root_dir, "labs"))
        self.CTF_DIRECTORY = os.getenv("CTF_DIRECTORY", os.path.join(self.root_dir, "ctf"))
        self.ENABLE_GST = os.getenv("ENABLE_GST", "true").lower() in ("true", "1", "yes")
        
        # Default region configuration
        self.AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

        if self.ENV == "production":
            logger.info("Initializing configuration in PRODUCTION mode using AWS Secrets Manager.")
            from app.core.aws_secrets import get_secret
            from urllib.parse import quote_plus

            # 1. JWT Configuration
            jwt_data = get_secret("cyberrange/production/jwt")
            self.SECRET_KEY = jwt_data.get("SECRET_KEY")
            if not self.SECRET_KEY:
                raise RuntimeError("Unable to load production secret: cyberrange/production/jwt is missing 'SECRET_KEY'")
            self.ALGORITHM = jwt_data.get("ALGORITHM", "HS256")
            self.ACCESS_TOKEN_EXPIRE_MINUTES = int(jwt_data.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

            # 2. Admin Configuration
            admin_data = get_secret("cyberrange/production/admin")
            self.ADMIN_USERNAME = admin_data.get("ADMIN_USERNAME", "admin")
            self.ADMIN_EMAIL = admin_data.get("ADMIN_EMAIL", "admin@cyberrange.in")
            self.ADMIN_PASSWORD = admin_data.get("ADMIN_PASSWORD", "")
            self.ADMIN_REGISTRATION_KEY = admin_data.get("ADMIN_REGISTRATION_KEY", "CYBERRANGE-ADMIN-2026")
            self.SYSTEM_ADMIN_SECURITY_KEY = admin_data.get("SYSTEM_ADMIN_SECURITY_KEY", "CYBERRANGE-SYSTEM-KEY-2026-X99")
            self.SYSTEM_ADMIN_NAME = admin_data.get("SYSTEM_ADMIN_NAME", "System Admin")
            self.SYSTEM_ADMIN_EMAIL = admin_data.get("SYSTEM_ADMIN_EMAIL", "sysadmin@cyberrange.in")
            self.SYSTEM_ADMIN_PASSWORD = admin_data.get("SYSTEM_ADMIN_PASSWORD", "sysadmin_password_2026")
            self.FEEDBACK_WEBHOOK_SECRET = admin_data.get("FEEDBACK_WEBHOOK_SECRET", self.SYSTEM_ADMIN_SECURITY_KEY)
            self.FEEDBACK_NOTIFY_EMAIL = admin_data.get("FEEDBACK_NOTIFY_EMAIL", "cyberrangelabsupport@gmail.com")
            
            # Allow fallback to ALLOWED_ADMIN_DOMAINS or ADMIN_ALLOWED_DOMAINS
            raw_allowed_domains = admin_data.get("ADMIN_ALLOWED_DOMAINS", admin_data.get("ALLOWED_ADMIN_DOMAINS", "cyberrange.in"))
            self.ALLOWED_ADMIN_DOMAINS = [d.strip().lower() for d in raw_allowed_domains.split(",") if d.strip()]
            self.ADMIN_ALLOWED_DOMAINS = self.ALLOWED_ADMIN_DOMAINS
            
            raw_student_domains = admin_data.get("STUDENT_ALLOWED_DOMAINS", "gmail.com,*.edu,*.ac.in,college.edu,example.ac.in")
            self.STUDENT_ALLOWED_DOMAINS = [d.strip().lower() for d in raw_student_domains.split(",") if d.strip()]

            # 3. Google OAuth Configuration
            oauth_data = get_secret("cyberrange/production/google-oauth")
            self.GOOGLE_CLIENT_ID = oauth_data.get("GOOGLE_CLIENT_ID", "")
            self.GOOGLE_CLIENT_SECRET = oauth_data.get("GOOGLE_CLIENT_SECRET", "")
            self.VITE_GOOGLE_CLIENT_ID = oauth_data.get("VITE_GOOGLE_CLIENT_ID", self.GOOGLE_CLIENT_ID)

            # 4. Razorpay Configuration
            razorpay_data = get_secret("cyberrange/production/razorpay")
            self.RAZORPAY_KEY_ID = razorpay_data.get("RAZORPAY_KEY_ID", "")
            self.RAZORPAY_KEY_SECRET = razorpay_data.get("RAZORPAY_KEY_SECRET", "")
            self.RAZORPAY_WEBHOOK_SECRET = razorpay_data.get("RAZORPAY_WEBHOOK_SECRET", "")

            # 5. RDS Configuration
            rds_data = get_secret("rds!db-ac1f3198-b1d8-4fb6-9595-c605f011867c")
            db_user_raw = rds_data.get("username")
            db_pass_raw = rds_data.get("password")
            if not db_user_raw or not db_pass_raw:
                raise RuntimeError("Unable to load production secret: rds managed secret is missing 'username' or 'password'")
            
            db_user = quote_plus(db_user_raw)
            db_pass = quote_plus(db_pass_raw)
            db_host = os.getenv("DATABASE_HOST", "cyberrange-database.cl4682usm5nr.ap-south-1.rds.amazonaws.com")
            db_port = os.getenv("DATABASE_PORT", "5432")
            db_name = os.getenv("DATABASE_NAME", "postgres")
            self.DATABASE_URL = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
            logger.info(f"Database URL built from RDS secret: {db_host}:{db_port}/{db_name}")

            # 6. Optional Notification Configs
            notif_data = get_secret("cyberrange/production/notifications", is_optional=True)
            self.SES_FROM_EMAIL = notif_data.get("SES_FROM_EMAIL", os.getenv("SES_FROM_EMAIL"))
            self.SNS_TOPIC_ARN = notif_data.get("SNS_TOPIC_ARN", os.getenv("SNS_TOPIC_ARN"))
            
            # Credentials should NOT be configured in production (use EC2 IAM profile)
            self.AWS_ACCESS_KEY_ID = None
            self.AWS_SECRET_ACCESS_KEY = None
        else:
            # Load local development configurations
            self.SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-me-in-production")
            self.ALGORITHM = os.getenv("ALGORITHM", "HS256")
            self.ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
            
            self.ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
            self.ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@cyberrange.in")
            self.ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
            self.ADMIN_REGISTRATION_KEY = os.getenv("ADMIN_REGISTRATION_KEY", "CYBERRANGE-ADMIN-2026")
            self.SYSTEM_ADMIN_SECURITY_KEY = os.getenv("SYSTEM_ADMIN_SECURITY_KEY", "CYBERRANGE-SYSTEM-KEY-2026-X99")
            self.SYSTEM_ADMIN_NAME = os.getenv("SYSTEM_ADMIN_NAME", "System Admin")
            self.SYSTEM_ADMIN_EMAIL = os.getenv("SYSTEM_ADMIN_EMAIL", "sysadmin@cyberrange.in")
            self.SYSTEM_ADMIN_PASSWORD = os.getenv("SYSTEM_ADMIN_PASSWORD", "sysadmin_password_2026")
            self.FEEDBACK_WEBHOOK_SECRET = os.getenv("FEEDBACK_WEBHOOK_SECRET", self.SYSTEM_ADMIN_SECURITY_KEY)
            self.FEEDBACK_NOTIFY_EMAIL = os.getenv("FEEDBACK_NOTIFY_EMAIL", "cyberrangelabsupport@gmail.com")
            self.ALLOWED_ADMIN_DOMAINS = [d.strip().lower() for d in os.getenv("ADMIN_ALLOWED_DOMAINS", os.getenv("ALLOWED_ADMIN_DOMAINS", "cyberrange.in")).split(",") if d.strip()]
            self.ADMIN_ALLOWED_DOMAINS = self.ALLOWED_ADMIN_DOMAINS
            self.STUDENT_ALLOWED_DOMAINS = [d.strip().lower() for d in os.getenv("STUDENT_ALLOWED_DOMAINS", "gmail.com,*.edu,*.ac.in,college.edu,example.ac.in").split(",") if d.strip()]
            
            self.GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
            self.GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
            
            self.RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
            self.RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
            self.RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

            self.AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
            self.AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
            self.SES_FROM_EMAIL = os.getenv("SES_FROM_EMAIL")
            self.SNS_TOPIC_ARN = os.getenv("SNS_TOPIC_ARN")

            self.DATABASE_URL = os.getenv("DATABASE_URL")
            if not self.DATABASE_URL:
                db_host = os.getenv("DATABASE_HOST")
                db_port = os.getenv("DATABASE_PORT", "5432")
                db_name = os.getenv("DATABASE_NAME")
                db_user = os.getenv("DATABASE_USER")
                db_password = os.getenv("DATABASE_PASSWORD")

                if db_host and db_name and db_user:
                    self.DATABASE_URL = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
                    logger.info(f"Database URL built from AWS RDS / DATABASE_* variables: {db_host}:{db_port}/{db_name}")
            
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
                    if self.ENV == "development" and os.getenv("ALLOW_SQLITE_DEV", "false").lower() in ("true", "1"):
                        self.DATABASE_URL = "sqlite:///./cyberrange.db"
                        logger.warning("Explicit development mode: using SQLite database fallback.")
                    else:
                        logger.critical("PostgreSQL configuration missing. Set DATABASE_URL or DATABASE_HOST/DATABASE_USER/DATABASE_NAME in .env!")
                        raise RuntimeError("PostgreSQL configuration missing.")

    def get_database_url(self) -> str:
        return self.DATABASE_URL

settings = Settings()
