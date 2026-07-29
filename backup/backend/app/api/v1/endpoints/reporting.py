from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, case, or_, not_, text
from datetime import datetime, timedelta
from typing import Optional, List
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.college import College
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user_lab_progress import UserLabProgress
from app.models.study_session import StudySession
from app.models.achievement import Achievement
from app.models.user_achievement import UserAchievement
from app.models.audit_log import AuditLog
from app.core.cache import (
    leaderboard_cache, leaderboard_key,
    invalidate_leaderboard, invalidate_dashboard,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _non_admin_filter():
    """SQLAlchemy filter that excludes admin/system accounts from leaderboards."""
    return not_(or_(
        User.role.ilike('%admin%'),
        User.role.ilike('%sysadmin%'),
        User.name.ilike('%sysadmin%'),
        User.name.ilike('%sys admin%'),
        User.name.ilike('%admin%'),
        User.name.ilike('%security officer%'),
        User.email.ilike('%sysadmin%'),
        User.email.ilike('%admin%'),
        User.email.ilike('%securityofficer%'),
    ))


# ---------------------------------------------------------------------------
# Colleges (public — no auth required)
# ---------------------------------------------------------------------------

@router.get("/colleges")
def list_colleges(db: Session = Depends(get_db)):
    """Returns all active colleges for registration dropdown."""
    colleges = db.query(
        College.id, College.name, College.code, College.city, College.country
    ).filter(College.status == "ACTIVE").all()
    return [
        {"id": c.id, "name": c.name, "code": c.code, "city": c.city, "country": c.country}
        for c in colleges
    ]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Optimized dashboard endpoint.

    Uses DashboardService which:
    - Reads score from users.total_score column (O(1), no SUM)
    - Computes rank with a single COUNT query
    - Fetches recent activity with a single JOIN (no N+1)
    - Results are cached 120s per user
    - reconcile_user_score() is NOT called here
    """
    from app.services.dashboard_service import DashboardService
    summary = DashboardService.get_summary(db, current_user)

    # ── Skill breakdown — single GROUP BY query ────────────────────────────
    categories = (
        db.query(LabModule.track, func.count(UserLabProgress.id))
        .join(UserLabProgress, UserLabProgress.module_id == LabModule.id)
        .filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.status == "COMPLETED",
        )
        .group_by(LabModule.track)
        .all()
    )
    skills = {"linux": 0, "python": 0, "c": 0, "cpp": 0}
    for track, count in categories:
        if track in skills:
            skills[track] = count

    weekly_raw = summary.get("weekly_graph", summary.get("weeklyGraph", []))
    weekly_data = [
        {"day": item.get("name", ""), "solved": item.get("completed", 0)}
        for item in weekly_raw
    ]

    return {
        "total_training_hours": summary.get("training_hours", summary.get("trainingHours", 0.0)),
        "avg_session_duration": summary.get("average_session", summary.get("averageSession", 0.0)),
        "badges_count": summary.get("badges_count", 0),
        "completion_rate": summary.get("completion_rate", summary.get("completionPercent", 0)),
        "recent_activity": summary.get("recent_activity", []),
        "weekly_graph": weekly_data,
        "skills": skills,
        "score": summary.get("total_score", 0),
    }


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

@router.get("/progress")
def get_progress(
    lab_id: Optional[str] = Query(None, description="Filter by lab ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns completed module history.
    If lab_id is provided, returns compact structured progress for that lab.

    READ-ONLY — does not mutate the database.
    """
    from app.models.user_progress import UserProgress

    # Compact per-lab response (used by OT lab sessions)
    if lab_id:
        completed_rows = (
            db.query(
                UserLabProgress.module_id,
                UserLabProgress.score,
            )
            .filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.lab_id == lab_id,
                UserLabProgress.status == "COMPLETED",
            )
            .all()
        )
        completed_module_ids = [r.module_id for r in completed_rows]
        lab_score = sum(r.score or 0 for r in completed_rows)
        return {
            "lab_id": lab_id,
            "completed_modules": completed_module_ids,
            "total_score": current_user.total_score or 0,
            "lab_score": lab_score,
            "modules_count": len(completed_module_ids),
        }

    # Title fallback for recon modules not in DB by display name
    RECON_TITLES = {
        "lab1-recon_module1": "Module 1: Port Discovery & Enumeration",
        "lab1-recon_module2": "Module 2: Service Version Fingerprinting",
        "lab1-recon_module3": "Module 3: Hidden Service Discovery",
        "lab1-recon_module4": "Module 4: Credential Discovery",
        "lab1-recon_module5": "Module 5: Full Network Infiltration (Capstone)",
    }

    # Single JOIN query — replaces separate UserProgress + UserLabProgress queries
    rows = (
        db.query(
            UserLabProgress.id,
            UserLabProgress.module_id,
            UserLabProgress.lab_id,
            UserLabProgress.completed_at,
            UserLabProgress.score,
            UserLabProgress.attempts,
            LabModule.title.label("module_title"),
        )
        .outerjoin(LabModule, LabModule.id == UserLabProgress.module_id)
        .filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.status == "COMPLETED",
        )
        .order_by(desc(UserLabProgress.completed_at))
        .all()
    )

    seen_modules: set = set()
    result = []
    for r in rows:
        key = (r.lab_id, r.module_id)
        if key in seen_modules:
            continue
        seen_modules.add(key)
        result.append({
            "id": r.id,
            "module_id": r.module_id,
            "module_title": r.module_title or RECON_TITLES.get(r.module_id, r.module_id),
            "points": r.score,
            "attempts": r.attempts,
            "completed_at": (
                r.completed_at.strftime("%Y-%m-%d %H:%M:%S") if r.completed_at else ""
            ),
        })

    return result


# ---------------------------------------------------------------------------
# Achievements — single LEFT JOIN query (replaces 2 separate queries)
# ---------------------------------------------------------------------------

@router.get("/achievements")
def get_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all achievements with unlocked state in ONE query using LEFT JOIN.
    Cached 60s per user to guarantee sub-25ms response time.
    """
    cache_key = f"achievements:user:{current_user.id}"
    cached = dashboard_cache.get(cache_key)
    if cached is not None:
        return cached

    rows = (
        db.query(
            Achievement.id,
            Achievement.title,
            Achievement.description,
            Achievement.icon,
            Achievement.reward_points,
            UserAchievement.achievement_id.label("unlocked_id"),
        )
        .outerjoin(
            UserAchievement,
            and_(
                UserAchievement.achievement_id == Achievement.id,
                UserAchievement.user_id == current_user.id,
            ),
        )
        .all()
    )

    result = [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "icon": r.icon,
            "reward_points": r.reward_points,
            "unlocked": r.unlocked_id is not None,
        }
        for r in rows
    ]
    dashboard_cache.set(cache_key, result, ttl=60)
    return result


# ---------------------------------------------------------------------------
# Leaderboard — cached per page
# ---------------------------------------------------------------------------

@router.get("/leaderboard")
def get_leaderboard(
    type: str = Query("global", regex="^(global|college|personal)$"),
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Leaderboard endpoint with per-page caching (5 min TTL).
    Excludes admin/system accounts from all views.
    """
    non_admin = _non_admin_filter()
    offset = (page - 1) * limit

    if type == "personal":
        # User's own rank — single window function subquery
        sub = db.query(
            User.id,
            func.rank().over(order_by=desc(User.total_score)).label("rank"),
        ).filter(non_admin).subquery()

        rank_row = db.query(sub.c.rank).filter(sub.c.id == current_user.id).first()
        global_rank = rank_row[0] if rank_row else 1

        return {
            "rank": global_rank,
            "name": current_user.name,
            "score": current_user.total_score,
            "college": current_user.college.name if current_user.college else "Individual",
        }

    if type == "college":
        if current_user.account_type != "STUDENT" or not current_user.college_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="College leaderboard is only available for Student accounts.",
            )

        cache_key = leaderboard_key(current_user.college_id, "college", page, limit)
        cached = leaderboard_cache.get(cache_key)
        if cached is not None:
            logger.debug(f"[Cache HIT] leaderboard college page={page}")
            return cached

        query = (
            db.query(User)
            .filter(
                User.account_type == "STUDENT",
                User.college_id == current_user.college_id,
                non_admin,
            )
            .order_by(desc(User.total_score))
        )
        total = query.count()
        results = query.offset(offset).limit(limit).all()

        ranks = [
            {
                "rank": offset + idx + 1,
                "name": u.name,
                "score": u.total_score,
                "college": current_user.college.name if current_user.college else "",
                "is_current": u.id == current_user.id,
            }
            for idx, u in enumerate(results)
        ]
        result = {"total": total, "ranks": ranks}
        leaderboard_cache.set(cache_key, result)
        return result

    # Global leaderboard
    cache_key = leaderboard_key(None, "global", page, limit)
    cached = leaderboard_cache.get(cache_key)
    if cached is not None:
        logger.debug(f"[Cache HIT] leaderboard global page={page}")
        # Patch is_current from the user-neutral cache
        return {
            **cached,
            "ranks": [
                {**r, "is_current": r.get("_user_id") == current_user.id}
                for r in cached["ranks"]
            ],
        }

    base_query = (
        db.query(
            User.id,
            User.name,
            User.total_score,
            College.name.label("college_name"),
        )
        .outerjoin(College, User.college_id == College.id)
        .filter(non_admin)
        .order_by(desc(User.total_score))
    )

    total = db.query(func.count(User.id)).filter(non_admin).scalar() or 0
    results = base_query.offset(offset).limit(limit).all()

    cache_rows = [
        {
            "rank": offset + idx + 1,
            "name": row.name,
            "score": row.total_score,
            "college": row.college_name or "Individual",
            "is_current": False,
            "_user_id": row.id,
        }
        for idx, row in enumerate(results)
    ]
    leaderboard_cache.set(cache_key, {"total": total, "ranks": cache_rows})

    ranks = [
        {**r, "is_current": r["_user_id"] == current_user.id}
        for r in cache_rows
    ]
    for r in ranks:
        r.pop("_user_id", None)
    return {"total": total, "ranks": ranks}


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@router.get("/sessions")
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns login/study session history for the current user."""
    sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id)
        .order_by(desc(StudySession.login_time))
        .limit(20)
        .all()
    )
    return [
        {
            "login_time": s.login_time.strftime("%Y-%m-%d %H:%M:%S") if s.login_time else "",
            "logout_time": s.logout_time.strftime("%Y-%m-%d %H:%M:%S") if s.logout_time else "Active",
            "duration_minutes": round(s.duration_seconds / 60, 1) if s.duration_seconds else 0,
        }
        for s in sessions
    ]


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

@router.get("/audit-logs")
def get_audit_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns recent audit log entries for the current user."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(desc(AuditLog.timestamp))
        .limit(30)
        .all()
    )
    return [
        {
            "action": l.action,
            "resource": l.resource,
            "new_value": l.new_value,
            "status": l.status,
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for l in logs
    ]


# ---------------------------------------------------------------------------
# Flag Submission
# ---------------------------------------------------------------------------

from pydantic import BaseModel


class FlagSubmitNotify(BaseModel):
    lab_id: Optional[str] = "command-line-lab"
    module_id: str
    flag: Optional[str] = None
    correct: bool
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None


def _parse_ua(user_agent_str: Optional[str]):
    if not user_agent_str:
        return "Unknown Browser", "Unknown Device"
    ua = user_agent_str.lower()
    browser = (
        "Chrome" if "chrome" in ua else
        "Firefox" if "firefox" in ua else
        "Safari" if "safari" in ua else
        "Edge" if "edge" in ua else
        "Web Browser"
    )
    device = (
        "Windows PC" if "windows" in ua else
        "Macbook" if "macintosh" in ua or "mac os" in ua else
        "Linux Machine" if "linux" in ua else
        "iOS Device" if "iphone" in ua or "ipad" in ua else
        "Android Device" if "android" in ua else
        "Web Device"
    )
    return browser, device


@router.post("/submit-flag")
def submit_flag(
    payload: FlagSubmitNotify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Processes a flag submission from the scoring server.
    All writes happen inside a single ACID transaction.
    Score is read from users.total_score (no reconcile needed).
    """
    target_lab_id = payload.lab_id or "command-line-lab"
    logger.info(
        f"[submit_flag] user_id={current_user.id} lab='{target_lab_id}' "
        f"module='{payload.module_id}' correct={payload.correct}"
    )

    # Lab lookup
    lab = db.query(Lab).filter(Lab.id == target_lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail=f"Lab '{target_lab_id}' not found.")

    # Module lookup with fallback aliases
    mod = db.query(LabModule).filter(LabModule.id == payload.module_id).first()
    if not mod:
        scoped_id = f"{target_lab_id}_{payload.module_id}"
        mod = db.query(LabModule).filter(LabModule.id == scoped_id).first()
        if mod:
            payload.module_id = scoped_id

    if not mod:
        alt_id = (
            f"linux_{payload.module_id}"
            if not payload.module_id.startswith("linux_")
            else payload.module_id.replace("linux_", "")
        )
        mod = db.query(LabModule).filter(LabModule.id == alt_id).first()
        if mod:
            payload.module_id = alt_id

    if not mod:
        raise HTTPException(status_code=404, detail=f"Module '{payload.module_id}' not found.")

    if mod.lab_id != lab.id:
        raise HTTPException(
            status_code=400,
            detail=f"Module '{mod.id}' does not belong to lab '{lab.id}'.",
        )

    browser, device = _parse_ua(payload.user_agent)
    client_ip = payload.client_ip or "127.0.0.1"

    try:
        if not payload.correct:
            # Wrong flag — log and increment attempts only
            db.add(AuditLog(
                user_id=current_user.id, action="Wrong Flag",
                resource="LabModule", resource_id=payload.module_id,
                new_value=f"Submitted wrong flag: {payload.flag}",
                status="FAILED", ip_address=client_ip, browser=browser, device=device,
            ))
            progress = db.query(UserLabProgress).filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.module_id == payload.module_id,
            ).first()
            if progress:
                progress.attempts += 1
                progress.last_submission = payload.flag
            db.commit()
            return {"success": False, "message": "Incorrect flag logged."}

        # Correct flag
        points = mod.points
        progress = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.module_id == payload.module_id,
        ).first()

        if progress and progress.status == "COMPLETED":
            return {"success": True, "message": "Module already completed."}

        now = datetime.utcnow()

        if not progress:
            progress = UserLabProgress(
                user_id=current_user.id, lab_id=lab.id,
                module_id=payload.module_id, status="COMPLETED",
                score=points, attempts=1,
                started_at=now - timedelta(minutes=10),
                completed_at=now, time_taken_seconds=600,
                last_submission=payload.flag, flag_correct=True,
                client_ip=client_ip, browser=browser, device=device,
            )
            db.add(progress)
        else:
            duration = (
                int((now - progress.started_at).total_seconds())
                if progress.started_at
                else 600
            )
            progress.status = "COMPLETED"
            progress.score = points
            progress.attempts += 1
            progress.completed_at = now
            progress.time_taken_seconds = duration
            progress.last_submission = payload.flag
            progress.flag_correct = True
            progress.client_ip = client_ip
            progress.browser = browser
            progress.device = device

        # Award points via ScoreService (handles duplicate guard + cache invalidation)
        from app.services.score_service import ScoreService
        awarded, new_total = ScoreService.award_module_points(
            db=db, user=current_user,
            lab_id=lab.id, module_id=payload.module_id,
            track_id=mod.track,
        )

        progress.score = awarded
        db.add(progress)

        # Rank delta for notification (uses cached total_score column)
        old_rank = (
            db.query(func.count(User.id))
            .filter(_non_admin_filter(), User.total_score > (current_user.total_score or 0))
            .scalar() or 0
        ) + 1

        # Achievement evaluation — batch approach
        solved_count = (
            db.query(func.count(UserLabProgress.id))
            .filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.status == "COMPLETED",
            )
            .scalar() or 0
        )

        achievements_to_grant: list[str] = []
        if solved_count == 1:
            achievements_to_grant.extend(["first-lab", "first-module"])
        if new_total >= 100:
            achievements_to_grant.append("100-points")
        if new_total >= 500:
            achievements_to_grant.append("500-points")
        if new_total >= 1000:
            achievements_to_grant.append("1000-points")

        linux_mods = [f"linux_module{i}" for i in range(1, 6)] + [f"module{i}" for i in range(1, 6)]
        if payload.module_id in linux_mods:
            completed_linux = (
                db.query(func.count(UserLabProgress.id))
                .filter(
                    UserLabProgress.user_id == current_user.id,
                    UserLabProgress.status == "COMPLETED",
                    UserLabProgress.module_id.in_(linux_mods),
                    UserLabProgress.module_id != payload.module_id,
                )
                .scalar() or 0
            )
            if completed_linux >= 4:
                achievements_to_grant.append("linux-track")

        total_db_mods = db.query(func.count(LabModule.id)).scalar() or 20
        if solved_count >= total_db_mods:
            achievements_to_grant.append("complete-every-module")

        if progress.attempts == 1:
            has_imperfect = (
                db.query(UserLabProgress)
                .filter(
                    UserLabProgress.user_id == current_user.id,
                    UserLabProgress.attempts > 1,
                    UserLabProgress.module_id != payload.module_id,
                )
                .first()
            )
            if not has_imperfect:
                achievements_to_grant.append("perfect-run")

        if progress.time_taken_seconds and progress.time_taken_seconds <= 30:
            achievements_to_grant.append("fast-solver")

        # Fetch which achievements already exist in one query
        existing_ach_ids = {
            row[0]
            for row in db.query(UserAchievement.achievement_id).filter(
                UserAchievement.user_id == current_user.id,
                UserAchievement.achievement_id.in_(achievements_to_grant),
            ).all()
        }

        newly_earned: list[str] = []
        for ach_id in achievements_to_grant:
            if ach_id not in existing_ach_ids:
                db.add(UserAchievement(user_id=current_user.id, achievement_id=ach_id, earned_at=now))
                db.add(AuditLog(
                    user_id=current_user.id, action="Achievement Earned",
                    resource="Achievement", resource_id=ach_id,
                    new_value=f"Unlocked achievement: {ach_id}", status="SUCCESS",
                ))
                newly_earned.append(ach_id)

        # Audit logs
        db.add(AuditLog(
            user_id=current_user.id, action="Correct Flag", resource="LabModule",
            resource_id=payload.module_id, status="SUCCESS",
            ip_address=client_ip, browser=browser, device=device,
        ))
        db.add(AuditLog(
            user_id=current_user.id, action="Module Completed", resource="LabModule",
            resource_id=payload.module_id, status="SUCCESS",
            ip_address=client_ip, browser=browser, device=device,
        ))

        if solved_count >= total_db_mods:
            db.add(AuditLog(
                user_id=current_user.id, action="Lab Completed", resource="Lab",
                resource_id=lab.id, status="SUCCESS",
                ip_address=client_ip, browser=browser, device=device,
            ))

        db.commit()

        # Post-commit notifications (non-fatal)
        try:
            new_rank = (
                db.query(func.count(User.id))
                .filter(_non_admin_filter(), User.total_score > new_total)
                .scalar() or 0
            ) + 1

            from app.services.notification_service import notification_service
            if solved_count >= total_db_mods:
                notification_service.create_and_send(
                    db, current_user.id, "Lab Completion",
                    f"You completed {lab.name}.", "LAB_COMPLETION", current_user.phone,
                )
            for ach_id in newly_earned:
                notification_service.create_and_send(
                    db, current_user.id, "Achievement Unlocked",
                    f"You unlocked {ach_id}.", "ACHIEVEMENT", current_user.phone,
                )
            if new_rank < old_rank:
                notification_service.create_and_send(
                    db, current_user.id, "Rank Improvement",
                    f"Your leaderboard position improved from #{old_rank} to #{new_rank}.",
                    "RANK_IMPROVEMENT", current_user.phone,
                )
        except Exception as notify_err:
            logger.warning(f"[submit_flag] Notification error (non-fatal): {notify_err}")

        return {
            "success": True,
            "message": "Flag submission completed successfully.",
            "points_awarded": awarded,
            "total_score": new_total,
        }

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(
            f"[submit_flag] Transaction failed for module='{payload.module_id}': {exc}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=f"Database transaction error: {str(exc)}")
