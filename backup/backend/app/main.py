import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.logging_config import setup_logging
from app.startup.database_init import initialize_database
from app.database.manager import db_manager
from app.core.exceptions import AppError, app_exception_handler, global_exception_handler
from app.api.v1.router import api_router

# 1. Initialize centralized logging configuration
setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Application startup logic
    logger.info("Initializing application startup...")
    try:
        initialize_database()
        logger.info("Database initialization completed successfully during startup.")
    except Exception as e:
        logger.critical(f"Database initialization failed during startup: {e}", exc_info=True)
        
    try:
        # Triggers SES service startup validation (checks credentials)
        from app.services.ses_service import ses_service
    except Exception as e:
        logger.error(f"Failed to load SES service: {e}")
        
    yield
    # Application shutdown logic
    logger.info("Initializing application shutdown...")
    db_manager.shutdown()
    logger.info("Application shutdown completed successfully.")

app = FastAPI(
    title="Cyber Range Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# 2. Configure CORS middleware (allow_credentials must be True to accept cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Mount centralized exception handlers
app.add_exception_handler(AppError, app_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

import os
from fastapi.staticfiles import StaticFiles

# 4. Mount versioned API routes & static uploads
app.include_router(api_router, prefix="/api/v1")

uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(os.path.join(uploads_dir, "profile_photos"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Support both GET /api/v1/health and GET /api/health for backward compatibility
# Temporary comment to verify hot reload - updated

@app.get("/api/health", include_in_schema=False)
def global_health():
    from app.api.v1.endpoints.health import health_check
    return health_check()
