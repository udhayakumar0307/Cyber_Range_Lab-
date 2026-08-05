import asyncio
import logging
from app.database.session import SessionLocal
from app.database.manager import db_manager

logger = logging.getLogger("DatabaseAuditor")

async def run_database_health_audit():
    logger.info("[+] PostgreSQL Database health telemetry auditor started.")
    while True:
        try:
            # Check connection pools health
            healthy = db_manager.check_health()
            dialect = db_manager.engine.dialect.name if db_manager.engine else "unknown"
            
            if healthy:
                logger.debug(f"AWS RDS Database ({dialect}) connection pool is healthy and verified.")
            else:
                logger.error("AWS RDS Database connection verification failed. Re-initiating health check...")
        except Exception as e:
            logger.error(f"Error checking DB pool health: {e}")
            
        await asyncio.sleep(60) # Runs pool audits every 60 seconds
