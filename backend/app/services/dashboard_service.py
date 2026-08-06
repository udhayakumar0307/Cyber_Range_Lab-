"""
DashboardService — Optimized Dashboard Data Aggregator
=======================================================
Provides a single, cache-aware service method that returns everything the
dashboard needs in the fewest possible database round-trips.

Key design decisions:
  - Score read: O(1) — reads `users.total_score` column directly; no SUM.
  - Rank: single COUNT subquery against indexed total_score column.
  - Progress stats: delegates to get_user_lab_statistics() which has its
    own 60s TTL cache; a second request within 60s costs 0 DB queries.
  - Recent activity: single JOIN query (UserLabProgress ← LabModule) —
    eliminates the N+1 query pattern from the original endpoint.
  - Achievements: single COUNT query.
  - Result cached per user at the DashboardService level (120s TTL).

Cache invalidation:
  - Score update (ScoreService) → invalidate_dashboard(user_id)
  - Profile update (user_profile endpoint) → invalidate_dashboard(user_id)
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, not_

from app.core.cache import dashboard_cache, dashboard_key, invalidate_dashboard

logger = logging.getLogger(__name__)

# DashboardService-level TTL (seconds). progress_service has its own 60s cache.
_DASHBOARD_TTL = 120

# Exclude admin/system accounts from rank calculations
_NON_ADMIN_FILTER_EXPRS = [
    "User.role.ilike('%admin%')",
    "User.role.ilike('%sysadmin%')",
    "User.name.ilike('%admin%')",
    "User.name.ilike('%sysadmin%')",
    "User.name.ilike('%sys admin%')",
    "User.name.ilike('%security officer%')",
    "User.email.ilike('%admin%')",
    "User.email.ilike('%sysadmin%')",
    "User.email.ilike('%securityofficer%')",
]


def _get_non_admin_filter():
    from app.models.user import User
    return not_(or_(
        User.role.ilike('%admin%'),
        User.role.ilike('%sysadmin%'),
        User.name.ilike('%admin%'),
        User.name.ilike('%sysadmin%'),
        User.name.ilike('%sys admin%'),
        User.name.ilike('%security officer%'),
        User.email.ilike('%admin%'),
        User.email.ilike('%sysadmin%'),
        User.email.ilike('%securityofficer%'),
    ))


class DashboardService:
    """
    Single authoritative source of dashboard data.

    Usage::

        summary = DashboardService.get_summary(db, current_user)
        # Returns a dict ready to be returned from the endpoint.
    """

    @staticmethod
    def get_summary(db: Session, user, use_cache: bool = True) -> dict:
        """
        Return the full dashboard summary for *user*.

        On cache hit:  returns in <1ms (pure dict lookup).
        On cache miss: executes 4–5 optimized queries.
        """
        cache_k = dashboard_key(user.id)

        if use_cache:
            cached = dashboard_cache.get(cache_k)
            if cached is not None:
                logger.debug(f"[DashboardService] Cache HIT for user_id={user.id}")
                return cached

        logger.debug(f"[DashboardService] Cache MISS for user_id={user.id} — querying DB")
        result = DashboardService._build(db, user)

        dashboard_cache.set(cache_k, result, ttl=_DASHBOARD_TTL)
        return result

    @staticmethod
    def _build(db: Session, user) -> dict:
        from app.models.user import User
        from app.models.user_lab_progress import UserLabProgress
        from app.models.lab_module import LabModule
        from app.models.user_achievement import UserAchievement
        from app.services.progress_service import get_user_lab_statistics

        # ── 1. Score — O(1), read from cached column ──────────────────────────
        total_score = user.total_score or 0

        # ── 2. Rank — single COUNT query (indexed on total_score) ─────────────
        non_admin = _get_non_admin_filter()
        rank = (
            db.query(func.count(User.id))
            .filter(non_admin, User.total_score > total_score)
            .scalar() or 0
        ) + 1
        total_users = (
            db.query(func.count(User.id))
            .filter(non_admin)
            .scalar() or 0
        )

        # ── 3. Progress stats (cached 60s in progress_service) ────────────────
        stats = get_user_lab_statistics(db, str(user.id))

        # ── 4. Recent activity — single JOIN, eliminates N+1 ─────────────────
        recent_rows = (
            db.query(
                UserLabProgress.id,
                UserLabProgress.module_id,
                UserLabProgress.completed_at,
                UserLabProgress.score,
                LabModule.title.label("module_title"),
            )
            .outerjoin(LabModule, LabModule.id == UserLabProgress.module_id)
            .filter(
                UserLabProgress.user_id == user.id,
                UserLabProgress.status == "COMPLETED",
            )
            .order_by(desc(UserLabProgress.completed_at))
            .limit(5)
            .all()
        )

        recent_activity = [
            {
                "module_title": row.module_title or row.module_id,
                "completed_at": (
                    row.completed_at.strftime("%Y-%m-%d %H:%M:%S")
                    if row.completed_at
                    else ""
                ),
                "score": row.score,
            }
            for row in recent_rows
        ]

        # ── 5. Achievement count — single COUNT ───────────────────────────────
        badges_count = (
            db.query(func.count(UserAchievement.achievement_id))
            .filter(UserAchievement.user_id == user.id)
            .scalar() or 0
        )

        comp_labs = stats.get("completedLabs", 0)
        tot_labs = stats.get("totalLabs", 0)
        comp_mods = stats.get("completedModules", 0)
        tot_mods = stats.get("totalModules", 0)
        comp_rate = stats.get("completionPercent", 0)
        train_hrs = stats.get("trainingHours", 0.0)
        avg_sess = stats.get("averageSession", 0.0)
        weekly_g = stats.get("weeklyGraph", [])
        lab_tot_m = stats.get("lab_total_modules", {})
        lab_comp_m = stats.get("lab_completed_modules", {})
        act_labs = stats.get("active_labs", [])

        return {
            # Standard snake_case fields
            "total_score": total_score,
            "rank": rank,
            "total_users": total_users,
            "badges_count": badges_count,
            "completion_rate": comp_rate,
            "completed_modules": comp_mods,
            "total_modules": tot_mods,
            "completed_labs": comp_labs,
            "total_labs": tot_labs,
            "training_hours": train_hrs,
            "average_session": avg_sess,
            "weekly_graph": weekly_g,
            "recent_activity": recent_activity,
            "lab_total_modules": lab_tot_m,
            "lab_completed_modules": lab_comp_m,
            "active_labs": act_labs,
            # Aliases for backward compatibility
            "completedLabs": comp_labs,
            "totalLabs": tot_labs,
            "completedModules": comp_mods,
            "totalModules": tot_mods,
            "completionPercent": comp_rate,
            "weeklyGraph": weekly_g,
            "trainingHours": train_hrs,
            "averageSession": avg_sess,
        }

    @staticmethod
    def invalidate(user_id) -> None:
        """Invalidate the dashboard cache for a specific user."""
        invalidate_dashboard(str(user_id))
