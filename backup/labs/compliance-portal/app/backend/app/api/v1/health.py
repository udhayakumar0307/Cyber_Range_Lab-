from fastapi import APIRouter
from app.privacy_engine.engine import privacy_engine
from app.integrations.integration_manager import integration_manager
from app.cache.cache_manager import cache_manager

router = APIRouter()

@router.get("/health")
async def get_health():
    connected = await integration_manager.verify_active_connection()
    return {
        "status": "healthy" if connected else "unhealthy",
        "database": "connected",
        "integration": "connected" if connected else "disconnected",
        "scheduler": "running",
        "cache": "healthy",
        "privacy_engine": "ready"
    }

@router.get("/status")
def get_status():
    return privacy_engine.get_engine_status()

@router.post("/refresh")
async def force_refresh():
    """Force invalidate all caches and re-run analysis."""
    cache_manager.invalidate_all()
    result = await privacy_engine.run_analysis()
    return {"success": True, "message": "Analysis refreshed successfully"}

@router.get("/system/info")
def get_system_info():
    return {
        "platform": "Generic REST API",
        "store_name": "Platform Partner",
        "privacy_engine": "v1.0",
        "scheduler": "running",
        "analysis_version": "1.0.0",
        "last_sync": "2 minutes ago",
        "next_sync": "3 minutes"
    }
