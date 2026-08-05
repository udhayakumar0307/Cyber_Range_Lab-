import os
import sys
import asyncio
import logging

# Dynamically resolve paths to Backend module
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(os.path.dirname(current_dir), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Now we can import database and models cleanly
from app.database.session import SessionLocal
from app.database.manager import db_manager
from app.models.base import Base

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(current_dir, "worker.log"))
    ]
)
logger = logging.getLogger("WorkerManager")

# Concurrently run worker modules
async def start_worker_loops():
    logger.info("Initializing Standalone CyberRange Platform Workers...")
    
    # Dynamically create security_alerts table if it doesn't exist & add price_per_hour column
    try:
        from app.models.security_alert import SecurityAlert
        db_engine = db_manager.engine
        if db_engine:
            Base.metadata.create_all(bind=db_engine)
            logger.info("Database security_alerts tables verified successfully.")
            
            # Verify and inject price_per_hour column to labs table if missing
            from sqlalchemy import text
            with db_engine.connect() as conn:
                conn.execute(text("ALTER TABLE labs ADD COLUMN IF NOT EXISTS price_per_hour FLOAT DEFAULT 100.0"))
                conn.commit()
                logger.info("Database table 'labs' schema verified (price_per_hour column ensured).")
    except Exception as e:
        logger.error(f"Failed database migration assertions on startup: {e}")

    # Import and register workers
    from security import run_security_monitor
    from laballocator import run_lab_allocator_sync
    from puzzleallocator import run_puzzle_allocator_sync
    from labmanager import run_lab_timer_manager
    from scoremanager import run_score_evaluator
    from databasemanager import run_database_health_audit
    from docker import run_docker_container_sync

    # Create concurrent loops
    await asyncio.gather(
        run_security_monitor(),
        run_lab_allocator_sync(),
        run_puzzle_allocator_sync(),
        run_lab_timer_manager(),
        run_score_evaluator(),
        run_database_health_audit(),
        run_docker_container_sync()
    )

if __name__ == "__main__":
    try:
        asyncio.run(start_worker_loops())
    except KeyboardInterrupt:
        logger.info("Standalone Workers terminated by Platform Owner.")
