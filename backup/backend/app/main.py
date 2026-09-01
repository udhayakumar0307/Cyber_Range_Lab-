"""
Cyber Range — FastAPI Application Entry Point
=============================================
Production startup is intentionally minimal:

  1. Load configuration
  2. Initialize logging
  3. Initialize database connection pool
  4. Verify database connectivity
  5. Register routes
  6. Start FastAPI

Schema creation, seeding, admin bootstrapping, lab scanning, and index
creation are NOT performed at runtime. Run the dedicated scripts once:

  python scripts/migrate.py        # create tables + apply indexes
  python scripts/seed.py           # seed static data
  python scripts/bootstrap_admin.py  # create/update admin users
  python scripts/scan_labs.py      # sync lab filesystem metadata
"""

import os
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging_config import setup_logging
from app.database.manager import db_manager
from app.core.exceptions import AppError, app_exception_handler, global_exception_handler
from app.api.v1.router import api_router
from app.middleware.timing import TimingMiddleware
import app.middleware.timing as _timing_mod

# --- Initialize logging first (before any other imports that log) ---
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Production lifespan: only initializes the DB connection pool.
    No schema work, no seeding, no filesystem scanning.
    """
    logger.info("Starting Cyber Range API server...")
    try:
        db_manager.init_db()
        logger.info("Database connection pool ready.")

        # Ensure reportlab is installed (required for invoice PDF generation)
        try:
            import reportlab  # noqa: F401
        except ImportError:
            logger.warning("reportlab not found — installing now...")
            import subprocess, sys
            subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab>=4.0.0", "-q"])
            logger.info("reportlab installed successfully.")


        try:
            logger.info("Auto-running schema migrations on application startup...")
            from scripts.migrate import run_postgres_column_migrations, run_sqlite_column_migrations, apply_indexes
            engine = db_manager.engine
            dialect = engine.dialect.name
            if dialect == "sqlite":
                run_sqlite_column_migrations(engine)
            else:
                run_postgres_column_migrations(engine)
            apply_indexes(engine)
            logger.info("Auto-migration complete.")
        except Exception as exc:
            logger.error(f"Failed to auto-run database migrations: {exc}", exc_info=True)
        
        # Seed initial study materials if database table is empty
        try:
            from app.models.study_material import StudyMaterial
            import json
            db_session = db_manager.get_session()
            if db_session.query(StudyMaterial).count() == 0:
                initial_materials = [
                    {
                        "title": "Command Line & Linux Administration Study Guide",
                        "category": "System Security",
                        "description": "Comprehensive study guide covering Linux command line navigation, file permissions, shell scripting, process management, and admin utilities.",
                        "read_time": "20 min read",
                        "difficulty": "Beginner",
                        "pdf_url": "/study-materials/command-line-study-guide.pdf",
                        "content_json": json.dumps([
                            "Linux Shell Essentials: Master navigation (cd, ls, pwd), file creation (touch, mkdir), and file manipulation (cp, mv, rm).",
                            "Permissions & Ownership: Understand chmod (755, 644), chown, and special SUID/SGID executable flags.",
                            "Process & Network Monitoring: Monitor active processes using ps, top, htop, and network sockets using netstat / ss.",
                            "Text Processing: Master grep, sed, awk, cut, and piping constructs for log analysis.",
                            "Shell Automation: Writing bash scripts for automated system maintenance and log rotation."
                        ])
                    },
                    {
                        "title": "Cryptography & Network Security Study Guide",
                        "category": "Cryptography",
                        "description": "Essential guide on symmetric/asymmetric encryption, hashing algorithms (SHA-256, MD5), RSA key pairs, and TLS/SSL handshake mechanisms.",
                        "read_time": "25 min read",
                        "difficulty": "Intermediate",
                        "pdf_url": "/study-materials/cryptography-study-guide.pdf",
                        "content_json": json.dumps([
                            "Symmetric Encryption: Fundamentals of AES (Advanced Encryption Standard) and DES block ciphers using shared secret keys.",
                            "Asymmetric Encryption: Public-key cryptography (RSA, ECC) for digital signatures and key exchange protocols.",
                            "Cryptographic Hashing: One-way functions (SHA-256, SHA-3) for data integrity verification and password hashing (bcrypt, Argon2).",
                            "Public Key Infrastructure (PKI): X.509 digital certificates, Certificate Authorities (CAs), and SSL/TLS secure communication channels.",
                            "Cryptanalysis & Common Flaws: Weak key detection, replay attacks, and side-channel vulnerability mitigations."
                        ])
                    },
                    {
                        "title": "OT & Railroad Industrial Control Systems Security Study Guide",
                        "category": "Industrial Systems",
                        "description": "Specialized study guide on Operational Technology (OT), SCADA networks, railway signaling protocols, Modbus/DNP3, and industrial cybersecurity.",
                        "read_time": "30 min read",
                        "difficulty": "Advanced",
                        "pdf_url": "/study-materials/ot-railroad-study-guide.pdf",
                        "content_json": json.dumps([
                            "Operational Technology (OT) & ICS: Infrastructure overview of PLCs, RTUs, HMIs, and SCADA control loops in transport networks.",
                            "Railroad Signaling Protocols: Analysis of track circuit telemetry, interlocking control logic, and automatic train control (ATC) security.",
                            "Industrial Protocol Security: Vulnerability assessment of Modbus TCP, DNP3, and Ethernet/IP protocols lacking native authentication.",
                            "Network Segmentation: Purdue Model partitioning, industrial firewall zones, and unidirectional data diodes for safety-critical systems.",
                            "ICS Incident Response: Forensic analysis of PLC ladder logic tamper attempts and anomaly detection in OT network traffic."
                        ])
                    }
                ]
                for mat in initial_materials:
                    db_session.add(StudyMaterial(**mat, is_published=True))
                db_session.commit()
                logger.info("Seeded initial study materials into database.")
            db_session.close()
        except Exception as seed_err:
            logger.warning(f"Skipped study materials seeding: {seed_err}")
    except Exception as exc:
        logger.critical(f"Database connection failed: {exc}", exc_info=True)
        raise

    # Start background notification workers (lightweight, async)
    try:
        from app.services.daily_notification_worker import daily_notification_loop, assignment_reminder_loop
        app.state.daily_notification_task = asyncio.create_task(daily_notification_loop())
        app.state.assignment_reminder_task = asyncio.create_task(assignment_reminder_loop())
    except Exception as exc:
        logger.warning(f"Notification workers failed to start: {exc}")

    # Start CTF background scheduler loop
    try:
        from app.jobs.ctf_jobs import ctf_scheduler_loop
        app.state.ctf_scheduler_task = asyncio.create_task(ctf_scheduler_loop())
    except Exception as exc:
        logger.warning(f"CTF scheduler failed to start: {exc}")

    # Start CTF folder auto-sync loop (mirrors labs/ registry but fully automatic -
    # no manual "Sync Now" trigger needed; new ctf/*/event.json folders appear
    # on the SysAdmin CTF tab within one sync interval)
    try:
        from app.services.ctf_scanner import ctf_directory_sync_loop
        app.state.ctf_sync_task = asyncio.create_task(ctf_directory_sync_loop())
    except Exception as exc:
        logger.warning(f"CTF directory auto-sync failed to start: {exc}")

    # Start ECS & Cloud stale/idle task garbage collector loop (sweeps every 5 minutes)
    try:
        from app.jobs.ecs_cleanup import cleanup_stale_ecs_tasks, cleanup_stale_cloud_stacks
        async def ecs_gc_loop():
            while True:
                await asyncio.sleep(300)  # Sweep every 5 minutes
                try:
                    await asyncio.to_thread(cleanup_stale_ecs_tasks)
                    await asyncio.to_thread(cleanup_stale_cloud_stacks)
                except Exception as gc_err:
                    logger.warning(f"ECS/Cloud garbage collection loop error: {gc_err}")

        app.state.ecs_gc_task = asyncio.create_task(ecs_gc_loop())
    except Exception as exc:
        logger.warning(f"ECS garbage collector failed to start: {exc}")

    # Lazy-validate SES credentials without blocking startup
    try:
        from app.services.ses_service import ses_service  # noqa: F401
    except Exception as exc:
        logger.warning(f"SES service unavailable (email sending disabled): {exc}")

    logger.info("Server startup complete.")
    yield

    # --- Shutdown ---
    logger.info("Shutting down server...")
    task = getattr(app.state, "daily_notification_task", None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    ctf_task = getattr(app.state, "ctf_scheduler_task", None)
    if ctf_task:
        ctf_task.cancel()
        try:
            await ctf_task
        except asyncio.CancelledError:
            pass

    db_manager.shutdown()
    logger.info("Server shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Cyber Range Platform API",
    version="1.0.0",
    description="Production-grade cybersecurity learning platform API.",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server plus any configured production frontend origins.
# CORS_ORIGINS env var accepts a comma-separated list, e.g.
#   CORS_ORIGINS=https://cyberrange.dev,https://www.cyberrange.dev
_default_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Response Compression middleware for production optimization
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request timing middleware — adds X-Response-Time header, logs slow requests
_timing_instance = TimingMiddleware(app)
app.add_middleware(TimingMiddleware)
_timing_mod.timing_middleware_instance = _timing_instance

# Centralized exception handlers
app.add_exception_handler(AppError, app_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

import os
from fastapi.staticfiles import StaticFiles

app.include_router(api_router, prefix="/api/v1")

# Metrics endpoint (SYSTEM_ADMIN protected)
from app.api.v1.endpoints.metrics import router as metrics_router
app.include_router(metrics_router, prefix="/api/v1")

# Lab-specific routers & backward compatible aliases
from app.api.v1.endpoints import cll_api, crypto_api, auth
app.include_router(cll_api.router, prefix="/api")
app.include_router(crypto_api.router, prefix="/api")
app.post("/api/auth/google", include_in_schema=False)(auth.google_auth)


# Static file mounts
uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(os.path.join(uploads_dir, "profile_photos"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

cll_static_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "labs", "command-line-lab", "scoring-server", "static")
)
if os.path.exists(cll_static_dir):
    app.mount("/api/v1/cll/static", StaticFiles(directory=cll_static_dir), name="cll_static")

crypto_static_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "labs", "cryptography-lab", "scoring-server", "static")
)
if os.path.exists(crypto_static_dir):
    app.mount("/api/v1/crypto/static", StaticFiles(directory=crypto_static_dir), name="crypto_static")


# Backward-compatible health endpoint (supports both /api/v1/health and /api/health)
@app.get("/api/health", include_in_schema=False)
def global_health():
    from app.api.v1.endpoints.health import health_check
    return health_check()
