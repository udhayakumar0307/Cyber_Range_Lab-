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
    except Exception as exc:
        logger.critical(f"Database connection failed: {exc}", exc_info=True)
        raise

    # Start background notification worker (lightweight, async)
    try:
        from app.services.daily_notification_worker import daily_notification_loop
        app.state.daily_notification_task = asyncio.create_task(daily_notification_loop())
    except Exception as exc:
        logger.warning(f"Daily notification worker failed to start: {exc}")

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

# CORS — allow the Vite dev server and any configured frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    app.mount("/static", StaticFiles(directory=cll_static_dir), name="cll_static")


# Backward-compatible health endpoint (supports both /api/v1/health and /api/health)
@app.get("/api/health", include_in_schema=False)
def global_health():
    from app.api.v1.endpoints.health import health_check
    return health_check()
