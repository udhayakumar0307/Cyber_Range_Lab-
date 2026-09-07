from fastapi import APIRouter
from app.cache.cache_manager import cache_manager
from app.privacy_engine.engine import privacy_engine

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard():
    data = cache_manager.get("dashboard")
    if not data:
        data = await privacy_engine.run_analysis()
    return data
