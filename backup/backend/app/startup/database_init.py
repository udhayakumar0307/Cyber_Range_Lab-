import os
import secrets
import string
import logging
from sqlalchemy import text
from app.core.config import settings
from app.database.manager import db_manager

logger = logging.getLogger(__name__)

def generate_secure_password(length=16) -> str:
    """
    Generates a secure random password with mixed cases, digits, and special characters.
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in password)
                and any(c.isupper() for c in password)
                and any(c.isdigit() for c in password)
                and any(c in "!@#$%^&*" for c in password)):
            return password

def create_default_admin_logic(session_factory):
    """
    Core logic to verify roles exist and provision default colleges, professors, achievements, labs, and admin/demo users.
    """
    session = session_factory()
    try:
        from app.models.role import Role
        from app.models.user import User
        from app.models.college import College
        from app.models.professor import Professor
        from app.models.achievement import Achievement
        from app.models.lab import Lab
        from app.models.lab_module import LabModule
        import os
        import json

        # Ensure default roles exist in the Role table for configuration lists
        default_roles = ["admin", "instructor", "user"]
        for role_name in default_roles:
            role = session.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, description=f"Default {role_name} role")
                session.add(role)
        session.commit()

        # Seed default colleges
        default_colleges = [
            {"id": 1, "name": "Indian Institute of Technology Madras", "code": "IITM", "city": "Chennai", "country": "India"},
            {"id": 2, "name": "Massachusetts Institute of Technology", "code": "MIT", "city": "Cambridge", "country": "USA"},
            {"id": 3, "name": "Stanford University", "code": "STANFORD", "city": "Stanford", "country": "USA"}
        ]
        for col in default_colleges:
            college = session.query(College).filter(College.id == col["id"]).first()
            if not college:
                college = College(
                    id=col["id"],
                    name=col["name"],
                    code=col["code"],
                    city=col["city"],
                    country=col["country"],
                    status="ACTIVE"
                )
                session.add(college)
        session.commit()

        # Seed default professor
        prof = session.query(Professor).filter(Professor.id == 1).first()
        if not prof:
            prof = Professor(
                id=1,
                college_id=1,
                name="Dr. Bruce Wayne",
                email="bruce@iitm.ac.in",
                department="Computer Science"
            )
            session.add(prof)
        session.commit()

        # Seed default achievements
        default_achievements = [
            {"id": "first-lab", "title": "First Lab", "description": "Started your first security lab environment!", "icon": "shield", "condition": "first_lab", "reward_points": 50},
            {"id": "first-module", "title": "First Module", "description": "Successfully completed your first lab module!", "icon": "check", "condition": "first_module", "reward_points": 100},
            {"id": "100-points", "title": "100 Points Milestone", "description": "Reached a total of 100 learning points!", "icon": "star", "condition": "points_100", "reward_points": 100},
            {"id": "500-points", "title": "500 Points Milestone", "description": "Reached a total of 500 learning points!", "icon": "award", "condition": "points_500", "reward_points": 200},
            {"id": "1000-points", "title": "1000 Points Milestone", "description": "Reached a total of 1000 learning points!", "icon": "trophy", "condition": "points_1000", "reward_points": 500},
            {"id": "linux-track", "title": "Linux Track Mastery", "description": "Completed the entire Linux Fundamentals Track!", "icon": "terminal", "condition": "linux_track", "reward_points": 300},
            {"id": "complete-every-module", "title": "Every Module Complete", "description": "Successfully completed all modules in the catalog!", "icon": "zap", "condition": "all_modules", "reward_points": 1000},
            {"id": "perfect-run", "title": "Perfect Run", "description": "Completed every module challenge on the first attempt!", "icon": "target", "condition": "perfect_run", "reward_points": 500},
            {"id": "fast-solver", "title": "Fast Solver", "description": "Solved a module in less than 30 seconds!", "icon": "clock", "condition": "fast_solver", "reward_points": 250}
        ]
        for ach in default_achievements:
            existing_ach = session.query(Achievement).filter(Achievement.id == ach["id"]).first()
            if not existing_ach:
                new_ach = Achievement(
                    id=ach["id"],
                    title=ach["title"],
                    description=ach["description"],
                    icon=ach["icon"],
                    condition=ach["condition"],
                    reward_points=ach["reward_points"]
                )
                session.add(new_ach)
        session.commit()

        # Seed command line lab & modules dynamically
        lab = session.query(Lab).filter(Lab.id == "command-line-lab").first()
        if not lab:
            lab = Lab(
                id="command-line-lab",
                name="Command Line Lab",
                category="linux",
                difficulty="beginner",
                max_points=1000,
                estimated_time=240,
                status="ACTIVE"
            )
            session.add(lab)
            session.commit()

        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        project_dir = os.path.dirname(backend_dir)
        config_path = os.path.join(project_dir, "command-line-lab", "scoring-server", "module_config.json")
        
        if os.path.exists(config_path):
            with open(config_path) as f:
                mod_data = json.load(f)["modules"]
            
            idx = 1
            for mid, mcfg in mod_data.items():
                existing_mod = session.query(LabModule).filter(LabModule.id == mid).first()
                if not existing_mod:
                    new_mod = LabModule(
                        id=mid,
                        lab_id="command-line-lab",
                        module_number=idx,
                        title=mcfg["title"],
                        description=mcfg["story"],
                        points=mcfg["points"],
                        display_order=idx,
                        track=mcfg.get("track", "linux")
                    )
                    session.add(new_mod)
                idx += 1
            session.commit()

        # Seed Recon Lab & modules dynamically
        recon_lab = session.query(Lab).filter(Lab.id == "lab1-recon").first()
        if not recon_lab:
            recon_lab = Lab(
                id="lab1-recon",
                name="Network Reconnaissance Lab",
                category="recon",
                difficulty="intermediate",
                max_points=1000,
                estimated_time=180,
                status="ACTIVE"
            )
            session.add(recon_lab)
            session.commit()

            recon_modules = [
                ("recon_mod1", 1, "Module 1: Port Discovery & Enumeration", "Perform initial network reconnaissance and discover open TCP ports.", 100, "recon"),
                ("recon_mod2", 2, "Module 2: Service Version Fingerprinting", "Fingerprint service banners and identify software versions.", 150, "recon"),
                ("recon_mod3", 3, "Module 3: Hidden Service Discovery", "Locate hidden administration endpoints and unlisted HTTP paths.", 200, "recon"),
                ("recon_mod4", 4, "Module 4: Credential Discovery", "Extract exposed credentials from configuration files and service logs.", 250, "recon"),
                ("recon_mod5", 5, "Module 5: Full Network Infiltration (Capstone)", "Synthesize recon findings, escalate privileges, and compromise target system.", 300, "recon")
            ]
            for mid, mnum, mtitle, mdesc, mpts, mtrack in recon_modules:
                existing_mod = session.query(LabModule).filter(LabModule.id == mid, LabModule.lab_id == "lab1-recon").first()
                if not existing_mod:
                    new_mod = LabModule(
                        id=mid,
                        lab_id="lab1-recon",
                        module_number=mnum,
                        title=mtitle,
                        description=mdesc,
                        points=mpts,
                        display_order=mnum,
                        track=mtrack
                    )
                    session.add(new_mod)
            session.commit()

        # Check and provision settings-configured admin
        config_admin_email = settings.ADMIN_EMAIL
        if config_admin_email and config_admin_email != "admin@cyberrange.in":
            config_admin = session.query(User).filter(User.email == config_admin_email).first()
            if not config_admin:
                admin_username = settings.ADMIN_USERNAME or "Admin"
                admin_password = settings.ADMIN_PASSWORD or "password"
                from app.core.security import get_password_hash
                hashed_pw = get_password_hash(admin_password)
                
                new_admin = User(
                    name=admin_username,
                    email=config_admin_email,
                    password_hash=hashed_pw,
                    role="admin",
                    is_active=True
                )
                session.add(new_admin)
                session.commit()
                logger.info(f"Configured admin user created with email '{config_admin_email}'")

        # Provision Default Admin (admin@cyberrange.in)
        default_admin_email = "admin@cyberrange.in"
        from app.core.security import get_password_hash
        hashed_pw = get_password_hash("password")

        default_admin = session.query(User).filter(User.email == default_admin_email).first()
        if not default_admin:
            new_default_admin = User(
                name="Admin",
                email=default_admin_email,
                password_hash=hashed_pw,
                role="admin",
                organization="CyberRange HQ",
                is_active=True
            )
            session.add(new_default_admin)
            session.commit()
            logger.info("Default admin (admin@cyberrange.in / password) created successfully.")
        else:
            default_admin.password_hash = hashed_pw
            default_admin.role = "admin"
            default_admin.is_active = True
            session.commit()
            logger.info("Default admin (admin@cyberrange.in) verified and password updated.")

        # Provision TASK 6 Demo User (Alex Operator - user@cyberrange.in)
        demo_user_email = "user@cyberrange.in"
        demo_user = session.query(User).filter(User.email == demo_user_email).first()
        if not demo_user:
            from app.core.security import get_password_hash
            hashed_pw = get_password_hash("password")
            new_demo_user = User(
                name="Alex Operator",
                email=demo_user_email,
                password_hash=hashed_pw,
                role="user",
                is_active=True
            )
            session.add(new_demo_user)
            session.commit()
            logger.info("Demo user 'Alex Operator' created successfully")

        # Provision System Admin user from settings (.env)
        sys_admin_email = settings.SYSTEM_ADMIN_EMAIL or "sysadmin@cyberrange.in"
        sys_admin_password = settings.SYSTEM_ADMIN_PASSWORD or "sysadmin_password_2026"
        sys_admin_name = settings.SYSTEM_ADMIN_NAME or "System Admin"

        existing_sys_admin = session.query(User).filter(User.email == sys_admin_email).first()
        if not existing_sys_admin:
            from app.core.security import get_password_hash
            hashed_sys_pw = get_password_hash(sys_admin_password)
            new_sys_admin = User(
                name=sys_admin_name,
                email=sys_admin_email,
                password_hash=hashed_sys_pw,
                role="SYSTEM_ADMIN",
                organization="CyberRange Platform",
                is_active=True
            )
            session.add(new_sys_admin)
            session.commit()
            logger.info(f"System Admin user '{sys_admin_email}' seeded successfully during database initialization.")
        else:
            from app.core.security import get_password_hash
            existing_sys_admin.password_hash = get_password_hash(sys_admin_password)
            existing_sys_admin.role = "SYSTEM_ADMIN"
            existing_sys_admin.is_active = True
            session.commit()
            logger.info(f"System Admin user '{sys_admin_email}' verified and updated in database.")
    except Exception as e:
        logger.error(f"Error provisioning roles or default admin user: {e}", exc_info=True)
        session.rollback()
    finally:
        session.close()

def run_alembic_migrations():
    """
    Executes pending Alembic migrations programmatically.
    """
    try:
        from alembic.config import Config
        from alembic import command
        
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        ini_path = os.path.join(backend_dir, "alembic.ini")
        alembic_cfg = Config(ini_path)
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "migrations"))
        
        logger.info("Checking and running pending database migrations...")
        command.upgrade(alembic_cfg, "head")
        logger.info("Migrations executed successfully.")
    except Exception as e:
        logger.error(f"Error executing programmatic database migrations: {e}")

def initialize_database():
    """
    Primary database initialization routine triggered on API server startup.
    """
    logger.info("Starting database initialization flow...")
    
    # 1. Initialize manager (creates pools, retries 5 times)
    db_manager.init_db()
    
    # 2. Run pending migrations in production
    if settings.ENV == "production":
        run_alembic_migrations()
        
    logger.info("Database initialized")
