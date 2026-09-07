from fastapi import APIRouter
from app.cache.cache_manager import cache_manager
from app.privacy_engine.engine import privacy_engine

router = APIRouter()

@router.get("/dpdp")
async def get_dpdp():
    data = cache_manager.get("dpdp")
    if not data:
        await privacy_engine.run_analysis()
        data = cache_manager.get("dpdp")
    return data or {}
