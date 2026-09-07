from fastapi import APIRouter
from app.cache.cache_manager import cache_manager
from app.privacy_engine.engine import privacy_engine

router = APIRouter()

@router.get("/pii")
async def get_pii():
    data = cache_manager.get("pii")
    if not data:
        await privacy_engine.run_analysis()
        data = cache_manager.get("pii")
    return data or {}
