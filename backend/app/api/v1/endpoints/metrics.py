"""
Performance Metrics Endpoint
==============================
Exposes runtime performance metrics for SYSTEM_ADMIN only.

Measures:
- API response time per endpoint (avg, total, slow count)
- Cache hit/miss rates (dashboard, leaderboard, lab, org)
- Database index status

Security: Protected by SYSTEM_ADMIN role. No sensitive user data exposed.
"""

import logging
from fastapi import APIRouter, Depends
from app.api.deps import get_current_system_admin
from app.models.user import User
from app.core.cache import get_all_cache_stats

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/metrics", tags=["metrics"])
def get_performance_metrics(
    current_admin: User = Depends(get_current_system_admin)
):
    """
    Returns live performance metrics.
    Protected: SYSTEM_ADMIN role required.
    
    Includes:
    - Per-endpoint request timings (avg ms, slow request count)
    - Cache hit/miss rates for each cache namespace
    """
    from app.middleware.timing import timing_middleware_instance
    from app.database.manager import db_manager

    timing_stats = []
    if timing_middleware_instance is not None:
        timing_stats = timing_middleware_instance.get_stats()

    cache_stats = get_all_cache_stats()

    db_healthy = db_manager.check_health()

    return {
        "status": "ok",
        "database": {
            "healthy": db_healthy,
            "dialect": db_manager.engine.dialect.name if db_manager.engine else "unknown",
        },
        "cache": cache_stats,
        "api_timings": timing_stats[:20],  # Top 20 slowest endpoints
        "summary": {
            "endpoints_tracked": len(timing_stats),
            "slow_endpoints": [
                e for e in timing_stats if e["avg_ms"] > 200
            ][:5],
        },
    }
