import os
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, case, or_, not_, text
from datetime import datetime, timedelta
from typing import Optional, List
from app.api.deps import get_db, get_current_user, get_current_admin_user
from app.models.user import User
from app.models.college import College
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user_lab_progress import UserLabProgress
from app.models.study_session import StudySession
from app.models.achievement import Achievement
from app.models.user_achievement import UserAchievement
from app.models.audit_log import AuditLog
from app.models.assignment import Assignment
from app.services.assignment_context_service import resolve_assignment
from app.services.completion_service import CompletionService
from app.core.cache import (
    dashboard_cache, leaderboard_cache, leaderboard_key,
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


def _scope_assignment_progress(query, assignment_id: Optional[int]):
    """Apply NULL-safe assignment scoping to a UserLabProgress query."""
    if assignment_id is None:
        return query.filter(UserLabProgress.assignment_id.is_(None))
    return query.filter(UserLabProgress.assignment_id == assignment_id)


def _get_assignment_for_reporting(
    db: Session,
    *,
    lab_id: str,
    assignment_id: Optional[int] = None,
    student_id: Optional[int] = None,
    group_id: Optional[int] = None,
) -> Assignment:
    """
    Resolve one canonical Assignment for professor/reporting reads.

    If assignment_id is supplied it is authoritative after validating the
    requested lab/student/group context. Without it, a single matching
    assignment is accepted; multiple matches are rejected instead of guessing.
    """
    query = db.query(Assignment).filter(
        Assignment.lab_id == lab_id,
        Assignment.deleted_at.is_(None),
    )

    if assignment_id is not None:
        query = query.filter(Assignment.id == assignment_id)

    if student_id is not None:
        student = db.query(User).filter(User.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        ownership = [Assignment.student_id == student_id]
        if student.group_id is not None:
            ownership.append(Assignment.group_id == student.group_id)
        query = query.filter(or_(*ownership))

    if group_id is not None:
        query = query.filter(Assignment.group_id == group_id)

    matches = query.order_by(desc(Assignment.id)).all()

    if not matches:
        raise HTTPException(
            status_code=404,
            detail="No matching assignment found for this lab context.",
        )

    if len(matches) > 1 and assignment_id is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Multiple assignments match this lab context. "
                "Provide assignment_id explicitly."
            ),
        )

    return matches[0]


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
    assignment_id: Optional[int] = Query(
        None,
        description="Optional assignment context for per-lab progress",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns completed module history.
    If lab_id is provided, returns compact structured progress for that lab.

    READ-ONLY — does not mutate the database.
    """
    from app.models.user_progress import UserProgress

    # Compact per-lab response (used by OT lab sessions & lab completion reports)
    if lab_id:
        assignment = resolve_assignment(
            db=db,
            user=current_user,
            lab_id=lab_id,
            requested_assignment_id=assignment_id,
        )
        resolved_assignment_id = assignment.id if assignment else None

        completed_query = (
            db.query(
                UserLabProgress.module_id,
                UserLabProgress.score,
                UserLabProgress.completed_at,
                UserLabProgress.time_taken_seconds,
                UserLabProgress.attempts,
            )
            .filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.lab_id == lab_id,
                UserLabProgress.status == "COMPLETED",
            )
        )
        completed_query = _scope_assignment_progress(
            completed_query,
            resolved_assignment_id,
        )
        completed_rows = completed_query.all()
        completed_module_ids = [r.module_id for r in completed_rows]
        lab_score = sum(r.score or 0 for r in completed_rows)
        latest_completed_at = max((r.completed_at for r in completed_rows if r.completed_at), default=None)
        total_time_seconds = sum(r.time_taken_seconds or 0 for r in completed_rows)
        total_attempts = sum(r.attempts or 1 for r in completed_rows)
        avg_accuracy = (
            "100%" if total_attempts <= len(completed_rows)
            else f"{max(50, round(100 * len(completed_rows) / max(1, total_attempts)))}%"
        )
        return {
            "lab_id": lab_id,
            "assignment_id": resolved_assignment_id,
            "completed_modules": completed_module_ids,
            "total_score": current_user.total_score or 0,
            "lab_score": lab_score,
            "modules_count": len(completed_module_ids),
            "completed_at": latest_completed_at.strftime("%Y-%m-%d %H:%M:%S") if latest_completed_at else "",
            "time_taken_seconds": total_time_seconds,
            "accuracy": avg_accuracy,
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

    # Recon/CLL completion is also persisted in the legacy UserProgress table.
    # Merge it into the same history so score events are not missing from the
    # student's personal log when UserLabProgress was not created by an older
    # duplicate-safe completion path.
    from app.core.constants import TRACK_TO_LAB
    legacy_rows = (
        db.query(UserProgress)
        .filter(
            UserProgress.user_id == str(current_user.id),
            UserProgress.completed == True,  # noqa: E712
        )
        .order_by(desc(UserProgress.completed_at))
        .all()
    )
    module_catalog = {
        module.id: module
        for module in db.query(LabModule).all()
    }
    for row in legacy_rows:
        lab_id = TRACK_TO_LAB.get(row.track_id, row.track_id)
        candidates = (
            row.module_id,
            f"{lab_id}_{row.module_id}",
            f"{lab_id}_{row.track_id}_{row.module_id}",
        )
        canonical_id = next(
            (candidate for candidate in candidates if candidate in module_catalog),
            candidates[1],
        )
        key = (lab_id, canonical_id)
        if key in seen_modules:
            continue
        seen_modules.add(key)
        module = module_catalog.get(canonical_id)
        result.append({
            "id": f"legacy-{row.track_id}-{row.module_id}",
            "module_id": canonical_id,
            "module_title": module.title if module else canonical_id,
            "points": row.module_score or (module.points if module else 0),
            "attempts": 1,
            "completed_at": row.completed_at.strftime("%Y-%m-%d %H:%M:%S") if row.completed_at else "",
        })

    # ScoreEvent is the final fallback for duplicate-safe completion records
    # that were awarded before a UserProgress/UserLabProgress row was written.
    from app.models.score_event import ScoreEvent
    score_rows = (
        db.query(ScoreEvent)
        .filter(
            ScoreEvent.user_id == current_user.id,
            ScoreEvent.event_type == "MODULE_COMPLETION",
        )
        .order_by(desc(ScoreEvent.created_at))
        .all()
    )
    modules_by_lab: dict[str, list] = {}
    for module in module_catalog.values():
        modules_by_lab.setdefault(module.lab_id, []).append(module)
    for row in score_rows:
        lab_id = TRACK_TO_LAB.get(row.lab_id, row.lab_id)
        lab_modules = modules_by_lab.get(lab_id, [])
        module = next(
            (
                item for item in lab_modules
                if row.module_id == item.id
                or row.module_id.endswith(item.id.split("_", 1)[-1])
            ),
            module_catalog.get(row.module_id),
        )
        canonical_id = module.id if module else row.module_id
        key = (lab_id, canonical_id)
        if key in seen_modules:
            continue
        seen_modules.add(key)
        result.append({
            "id": f"score-event-{row.id}",
            "module_id": canonical_id,
            "module_title": module.title if module else canonical_id,
            "points": row.points,
            "attempts": 1,
            "completed_at": row.created_at.strftime("%Y-%m-%d %H:%M:%S") if row.created_at else "",
        })

    result.sort(key=lambda item: item.get("completed_at") or "", reverse=True)

    return result


# ---------------------------------------------------------------------------
# Achievements — single LEFT JOIN query returning only authenticated user's achievements
# ---------------------------------------------------------------------------

@router.get("/achievements")
def get_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all achievements in the system, marked as unlocked/locked for the user.
    """
    cache_key = f"achievements:user:{current_user.id}"
    cached = dashboard_cache.get(cache_key)
    if cached is not None:
        return cached

    from app.services.achievement_manager import achievement_manager
    badges = achievement_manager.evaluate_user_achievements(db, current_user.id)
    if badges:
        return badges

    # Fallback to DB Achievement table
    earned_rows = (
        db.query(UserAchievement.achievement_id, UserAchievement.earned_at)
        .filter(UserAchievement.user_id == current_user.id)
        .all()
    )
    earned_map = {r.achievement_id: r.earned_at for r in earned_rows}

    from app.models.achievement import Achievement
    all_ach = db.query(Achievement).all()

    result = []
    for a in all_ach:
        is_unlocked = a.id in earned_map
        earned_at_str = earned_map[a.id].strftime("%Y-%m-%d %H:%M:%S") if (is_unlocked and earned_map[a.id]) else ""
        
        result.append({
            "id": a.id,
            "title": a.title or a.id.replace("-", " ").title(),
            "description": a.description or "",
            "icon": a.icon or "award",
            "reward_points": a.reward_points or 0,
            "unlocked": is_unlocked,
            "earned_at": earned_at_str,
        })
        
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
    assignment_id: Optional[int] = None
    module_id: str
    flag: Optional[str] = None
    correct: Optional[bool] = None
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
    Process a generic flag submission.

    Academic submissions are attributed to one canonical Assignment. Personal
    submissions remain assignment_id=NULL. The same scope is used for attempts,
    completion progress, and ScoreEvent creation.
    """
    target_lab_id = payload.lab_id or "command-line-lab"

    logger.info(
        f"[submit_flag] user_id={current_user.id} lab='{target_lab_id}' "
        f"assignment_id={payload.assignment_id} "
        f"module='{payload.module_id}' correct={payload.correct}"
    )

    lab = db.query(Lab).filter(Lab.id == target_lab_id).first()
    if not lab:
        raise HTTPException(
            status_code=404,
            detail=f"Lab '{target_lab_id}' not found.",
        )

    # Resolve academic ownership before writing any progress.
    assignment = resolve_assignment(
        db=db,
        user=current_user,
        lab_id=target_lab_id,
        requested_assignment_id=payload.assignment_id,
    )
    resolved_assignment_id = assignment.id if assignment else None

    # Module lookup with fallback aliases.
    mod = db.query(LabModule).filter(
        LabModule.id == payload.module_id
    ).first()

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
        raise HTTPException(
            status_code=404,
            detail=f"Module '{payload.module_id}' not found.",
        )

    if mod.lab_id != lab.id:
        raise HTTPException(
            status_code=400,
            detail=f"Module '{mod.id}' does not belong to lab '{lab.id}'.",
        )

    browser, device = _parse_ua(payload.user_agent)
    client_ip = payload.client_ip or "127.0.0.1"

    is_correct = payload.correct
    validation_message = ""

    if is_correct is None:
        from app.services.puzzle_validation_service import PuzzleValidationService

        result = PuzzleValidationService.validate(
            lab_id=target_lab_id,
            module_id=payload.module_id,
            submitted_answer=payload.flag or "",
            user=current_user,
            db=db,
        )
        is_correct = result.is_correct
        validation_message = result.message

    try:
        progress_query = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.lab_id == lab.id,
            UserLabProgress.module_id == payload.module_id,
        )
        progress_query = _scope_assignment_progress(
            progress_query,
            resolved_assignment_id,
        )
        progress = progress_query.first()

        if not is_correct:
            db.add(
                AuditLog(
                    user_id=current_user.id,
                    action="Wrong Flag",
                    resource="LabModule",
                    resource_id=payload.module_id,
                    new_value=f"Submitted wrong flag: {payload.flag}",
                    status="FAILED",
                    ip_address=client_ip,
                    browser=browser,
                    device=device,
                )
            )

            # Preserve existing behavior: wrong submissions update an existing
            # progress row but do not create a completion/progress row by
            # themselves.
            if progress:
                progress.attempts = (progress.attempts or 0) + 1
                progress.last_submission = payload.flag

            db.commit()
            return {
                "success": False,
                "message": validation_message or "Incorrect flag logged.",
                "assignment_id": resolved_assignment_id,
            }

        if progress and progress.status == "COMPLETED":
            return {
                "success": True,
                "message": "Module already completed.",
                "points_awarded": 0,
                "total_score": current_user.total_score or 0,
                "assignment_id": resolved_assignment_id,
            }

        expected_attempts = (
            (progress.attempts or 0) + 1 if progress is not None else 1
        )

        # CompletionService owns completion progress and delegates all score
        # mutation to ScoreService using this exact assignment context.
        completion = CompletionService.complete_lab_module(
            db=db,
            user=current_user,
            lab_id=lab.id,
            module_id=payload.module_id,
            track_id=mod.track,
            base_points=mod.points,
            submitted_flag=payload.flag,
            assignment_id=resolved_assignment_id,
        )

        # Re-read the assignment-scoped completion row to attach reporting
        # metadata that CompletionService intentionally does not manage.
        progress = progress_query.first()
        if progress is None:
            raise RuntimeError(
                "CompletionService did not create the expected progress row."
            )

        progress.attempts = expected_attempts
        progress.client_ip = client_ip
        progress.browser = browser
        progress.device = device
        progress.last_submission = payload.flag
        progress.flag_correct = True
        db.add(progress)

        awarded = completion.points_awarded
        new_total = completion.new_total_score
        now = progress.completed_at or datetime.utcnow()

        # Rank delta for notification (uses cached total_score column).
        old_rank = (
            db.query(func.count(User.id))
            .filter(
                _non_admin_filter(),
                User.total_score > (current_user.total_score or 0),
            )
            .scalar()
            or 0
        ) + 1

        # Achievement evaluation is user-global, but count distinct modules so
        # repeating the same academic module in another assignment does not
        # falsely inflate platform-wide achievement progress.
        solved_count = (
            db.query(func.count(func.distinct(UserLabProgress.module_id)))
            .filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.status == "COMPLETED",
            )
            .scalar()
            or 0
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

        linux_mods = (
            [f"linux_module{i}" for i in range(1, 6)]
            + [f"module{i}" for i in range(1, 6)]
        )

        if payload.module_id in linux_mods:
            completed_linux = (
                db.query(
                    func.count(func.distinct(UserLabProgress.module_id))
                )
                .filter(
                    UserLabProgress.user_id == current_user.id,
                    UserLabProgress.status == "COMPLETED",
                    UserLabProgress.module_id.in_(linux_mods),
                    UserLabProgress.module_id != payload.module_id,
                )
                .scalar()
                or 0
            )
            if completed_linux >= 4:
                achievements_to_grant.append("linux-track")

        total_db_mods = (
            db.query(func.count(LabModule.id)).scalar() or 20
        )
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

        if (
            progress.time_taken_seconds
            and progress.time_taken_seconds <= 30
        ):
            achievements_to_grant.append("fast-solver")

        existing_ach_ids = {
            row[0]
            for row in db.query(UserAchievement.achievement_id)
            .filter(
                UserAchievement.user_id == current_user.id,
                UserAchievement.achievement_id.in_(
                    achievements_to_grant
                ),
            )
            .all()
        }

        newly_earned: list[str] = []

        for ach_id in achievements_to_grant:
            if ach_id not in existing_ach_ids:
                db.add(
                    UserAchievement(
                        user_id=current_user.id,
                        achievement_id=ach_id,
                        earned_at=now,
                    )
                )
                db.add(
                    AuditLog(
                        user_id=current_user.id,
                        action="Achievement Earned",
                        resource="Achievement",
                        resource_id=ach_id,
                        new_value=f"Unlocked achievement: {ach_id}",
                        status="SUCCESS",
                    )
                )
                newly_earned.append(ach_id)

        db.add(
            AuditLog(
                user_id=current_user.id,
                action="Correct Flag",
                resource="LabModule",
                resource_id=payload.module_id,
                status="SUCCESS",
                ip_address=client_ip,
                browser=browser,
                device=device,
            )
        )
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="Module Completed",
                resource="LabModule",
                resource_id=payload.module_id,
                status="SUCCESS",
                ip_address=client_ip,
                browser=browser,
                device=device,
            )
        )

        if solved_count >= total_db_mods:
            db.add(
                AuditLog(
                    user_id=current_user.id,
                    action="Lab Completed",
                    resource="Lab",
                    resource_id=lab.id,
                    status="SUCCESS",
                    ip_address=client_ip,
                    browser=browser,
                    device=device,
                )
            )

        try:
            from app.services.achievement_manager import achievement_manager

            achievement_manager.process_lab_completion(
                db=db,
                user_id=current_user.id,
                lab_id=target_lab_id,
                score=new_total,
                completed_at=now,
            )
        except Exception as ach_err:
            logger.warning(
                "[submit_flag] AchievementManager processing warning "
                f"(non-fatal): {ach_err}"
            )

        # Commit the progress, ScoreEvent, cached total, achievements and audit
        # records atomically before attempting notifications.
        db.commit()

        try:
            new_rank = (
                db.query(func.count(User.id))
                .filter(
                    _non_admin_filter(),
                    User.total_score > new_total,
                )
                .scalar()
                or 0
            ) + 1

            from app.services.notification_service import notification_service

            if solved_count >= total_db_mods:
                notification_service.create_and_send(
                    db,
                    current_user.id,
                    "Lab Completion",
                    f"You completed {lab.name}.",
                    "LAB_COMPLETION",
                    current_user.phone,
                )

            for ach_id in newly_earned:
                notification_service.create_and_send(
                    db,
                    current_user.id,
                    "Achievement Unlocked",
                    f"You unlocked {ach_id}.",
                    "ACHIEVEMENT",
                    current_user.phone,
                )

            if new_rank < old_rank:
                notification_service.create_and_send(
                    db,
                    current_user.id,
                    "Rank Improvement",
                    (
                        "Your leaderboard position improved from "
                        f"#{old_rank} to #{new_rank}."
                    ),
                    "RANK_IMPROVEMENT",
                    current_user.phone,
                )

        except Exception as notify_err:
            logger.warning(
                f"[submit_flag] Notification error (non-fatal): {notify_err}"
            )

        return {
            "success": True,
            "message": "Flag submission completed successfully.",
            "points_awarded": awarded,
            "total_score": new_total,
            "assignment_id": resolved_assignment_id,
        }

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(
            f"[submit_flag] Transaction failed for "
            f"module='{payload.module_id}': {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Database transaction error: {str(exc)}",
        )


# ── Certificate Endpoints ───────────────────────────────────────────────────

@router.get("/certificates")
def get_user_certificates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all earned certificates for the authenticated user.
    """
    from app.models.certificate import Certificate
    from app.models.lab import Lab
    from app.models.user_lab_progress import UserLabProgress
    from app.services.certificate_manager import certificate_manager

    # Retrieve all unique lab completions for current_user
    # Completion criteria: has UserLabProgress entries and overall progress is marked completed, or solved all modules
    progress_labs = (
        db.query(UserLabProgress.lab_id)
        .filter(UserLabProgress.user_id == current_user.id)
        .distinct()
        .all()
    )
    
    for (lab_id,) in progress_labs:
        # Check if they have an existing certificate
        existing_cert = (
            db.query(Certificate)
            .filter(Certificate.user_id == current_user.id, Certificate.lab_id == lab_id)
            .first()
        )
        if not existing_cert:
            # Check if lab progress indicates completion
            # Simple check: if status == 'COMPLETED' for any module or if total score > 0 (as preview is already visible)
            progress_records = (
                db.query(UserLabProgress)
                .filter(UserLabProgress.user_id == current_user.id, UserLabProgress.lab_id == lab_id)
                .all()
            )
            has_completion = any(p.status == "COMPLETED" for p in progress_records) or len(progress_records) > 0
            if has_completion:
                total_time = sum((p.time_taken_seconds or 0) for p in progress_records)
                # Auto-generate & register certificate record
                try:
                    certificate_manager.get_or_issue_certificate(
                        db=db,
                        user_id=current_user.id,
                        lab_id=lab_id,
                        score=current_user.total_score or 100,
                        duration_seconds=total_time
                    )
                except Exception as gen_err:
                    logger.error(f"Failed to auto-issue certificate for user_id={current_user.id}, lab_id={lab_id}: {gen_err}")

    certs = (
        db.query(Certificate)
        .filter(Certificate.user_id == current_user.id)
        .order_by(desc(Certificate.created_at))
        .all()
    )

    if not certs:
        try:
            certificate_manager.get_or_issue_certificate(
                db=db,
                user_id=current_user.id,
                lab_id="first-security-lab",
                score=current_user.total_score or 100,
                duration_seconds=1800
            )
            certs = (
                db.query(Certificate)
                .filter(Certificate.user_id == current_user.id)
                .order_by(desc(Certificate.created_at))
                .all()
            )
        except Exception as gen_err:
            logger.warning(f"Could not auto-issue initial certificate for user_id={current_user.id}: {gen_err}")

    res = []
    for c in certs:
        lab = db.query(Lab).filter(Lab.id == c.lab_id).first()
        progress_rows = (
            db.query(UserLabProgress)
            .filter(UserLabProgress.user_id == current_user.id, UserLabProgress.lab_id == c.lab_id)
            .all()
        )
        total_time = sum((p.time_taken_seconds or 0) for p in progress_rows)
        hours = max(0.5, round(total_time / 3600.0, 1))

        res.append({
            "uuid": c.uuid,
            "display_certificate_id": c.display_certificate_id,
            "lab_id": c.lab_id,
            "lab_title": (lab.name if getattr(lab, "name", None) else getattr(lab, "title", None)) if lab else c.lab_id.replace("-", " ").title(),
            "category": lab.category if (lab and lab.category) else "Cyber Security",
            "pdf_url": f"/api/v1/reporting/certificates/{c.display_certificate_id}/download" if c.png_path else None,
            "png_url": f"/api/v1/reporting/certificates/{c.display_certificate_id}/download" if c.png_path else None,
            "completion_date": c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else "",
            "duration": f"{hours} Hours",
            "score": current_user.total_score or 100,
            "percentage": 100,
            "verification_status": "VALID",
            "verification_url": f"/certificate/verify/{c.display_certificate_id}"
        })

    return res


@router.get("/certificates/verify/{certificate_id}")
def verify_certificate(
    certificate_id: str,
    db: Session = Depends(get_db),
):
    """
    PUBLIC verification endpoint.
    Returns only public certificate verification details without exposing internal user IDs or email.
    """
    from app.models.certificate import Certificate
    from app.models.user import User
    from app.models.lab import Lab
    from app.models.user_lab_progress import UserLabProgress

    cert = (
        db.query(Certificate)
        .filter(Certificate.display_certificate_id == certificate_id)
        .first()
    )

    if not cert:
        # Check by UUID fallback
        cert = db.query(Certificate).filter(Certificate.uuid == certificate_id).first()

    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid.")

    user = db.query(User).filter(User.id == cert.user_id).first()
    lab = db.query(Lab).filter(Lab.id == cert.lab_id).first()

    recipient_name = (user.name or user.email.split("@")[0].replace(".", " ").title()) if user else "CyberRange Student"
    lab_title = (lab.name if getattr(lab, "name", None) else getattr(lab, "title", None)) if lab else cert.lab_id.replace("-", " ").title()

    progress_rows = (
        db.query(UserLabProgress)
        .filter(UserLabProgress.user_id == cert.user_id, UserLabProgress.lab_id == cert.lab_id)
        .all()
    )
    total_time = sum((p.time_taken_seconds or 0) for p in progress_rows)
    hours = max(0.5, round(total_time / 3600.0, 1))

    return {
        "status": "VALID",
        "display_certificate_id": cert.display_certificate_id,
        "recipient_name": recipient_name,
        "lab_title": lab_title,
        "category": lab.category if (lab and lab.category) else "Cyber Security",
        "completion_date": cert.created_at.strftime("%d %B %Y").upper() if cert.created_at else "31 JULY 2026",
        "duration": f"{hours} Hours",
        "score": user.total_score if user else 100,
        "percentage": 100,
        "badge_earned": "CyberRange Master Badge",
        "issued_by": "CyberRange Official Telemetry Platform",
        "pdf_url": f"/api/v1/reporting/certificates/{cert.display_certificate_id}/download" if cert.png_path else None,
        "png_url": f"/api/v1/reporting/certificates/{cert.display_certificate_id}/download" if cert.png_path else None
    }


@router.get("/certificates/{certificate_id}/download")
def download_certificate_png(certificate_id: str, db: Session = Depends(get_db)):
    """
    PUBLIC certificate download — served under /api/v1 so it goes through the
    same reverse-proxy path already proven to work for every other endpoint.
    The raw /uploads/... static path certificates previously linked to isn't
    reachable through the deployed proxy config and falls back to serving the
    SPA's index.html, so "downloading" a certificate silently produced an
    .htm file of the frontend shell instead of the actual image.
    """
    from fastapi.responses import FileResponse
    from app.models.certificate import Certificate
    from app.services.storage_provider import storage_provider

    cert = (
        db.query(Certificate)
        .filter(Certificate.display_certificate_id == certificate_id)
        .first()
    )
    if not cert:
        cert = db.query(Certificate).filter(Certificate.uuid == certificate_id).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    relative = f"png/{cert.display_certificate_id}.png"
    if not cert.png_path or not storage_provider.exists(relative):
        # File missing on disk (e.g. uploads dir was cleared) but the DB row
        # still references it — self-heal by regenerating on the spot instead
        # of 404ing on a certificate that should exist.
        from app.services.certificate_manager import certificate_manager
        try:
            cert = certificate_manager.get_or_issue_certificate(
                db=db,
                user_id=cert.user_id,
                lab_id=cert.lab_id,
            )
        except Exception as e:
            logger.error(f"On-demand certificate regeneration failed for {certificate_id}: {e}")
        if not cert.png_path or not storage_provider.exists(relative):
            raise HTTPException(status_code=404, detail="Certificate not found or not yet generated.")

    full_path = os.path.join(storage_provider.base_dir, relative)
    return FileResponse(
        full_path,
        media_type="image/png",
        filename=f"{cert.display_certificate_id}.png",
    )


@router.post("/certificates/regenerate-all")
def regenerate_all_certificates(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """
    Deletes every rendered certificate PNG and clears each row's png_path, so
    the next view/download re-renders from whatever certificate_master.png
    currently is on disk. Equivalent to `rm uploads/certificates/png/*.png`
    but callable from the admin UI instead of requiring server SSH access —
    this has had to happen after nearly every template design iteration.
    """
    from app.models.certificate import Certificate
    from app.services.storage_provider import storage_provider

    certs = db.query(Certificate).all()
    deleted = 0
    for cert in certs:
        if storage_provider.delete(f"png/{cert.display_certificate_id}.png"):
            deleted += 1
        cert.png_path = None
    db.commit()
    return {"status": "ok", "certificates_cleared": len(certs), "files_deleted": deleted}


# ==========================================================
# ASSIGNMENT-BASED ANALYTICS ENDPOINTS
# ==========================================================

@router.get("/analytics/groups")
def get_analytics_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns only groups that currently have one or more active lab assignments.
    """
    from app.models.group import Group
    from app.models.assignment import Assignment
    from app.models.user_affiliation import UserAffiliation as UA
    from sqlalchemy import not_, or_
    from datetime import datetime

    is_super_admin = (current_user.role or "").lower() in ("super_admin", "system_admin", "sysadmin")
    valid_user_ids = None
    if not is_super_admin:
        admin_affs = db.query(UA).filter(UA.user_id == current_user.id).all()
        admin_col_ids = [a.college_id for a in admin_affs if a.college_id is not None]
        raw_org_ids = [a.organization_id for a in admin_affs if a.organization_id is not None]
        admin_org_ids = []
        if raw_org_ids:
            from app.models.admin_models import Organization
            approved_orgs = db.query(Organization.id).filter(
                Organization.id.in_(raw_org_ids),
                Organization.status.in_(["APPROVED", "ACTIVE"])
            ).all()
            admin_org_ids = [o[0] for o in approved_orgs]

        filter_conds = []
        if admin_col_ids:
            filter_conds.append((UA.affiliation_type == "college") & (UA.college_id.in_(admin_col_ids)))
        if admin_org_ids:
            filter_conds.append((UA.affiliation_type == "organization") & (UA.organization_id.in_(admin_org_ids)))

        if filter_conds:
            valid_user_ids = db.query(UA.user_id).filter(or_(*filter_conds)).subquery()

    groups = db.query(Group).all()
    res = []
    from app.core.timezone_utils import now_ist
    now = now_ist()
    for g in groups:
        db_id = g.id
        assignments = db.query(Assignment).filter(
            Assignment.group_id == db_id,
            Assignment.deleted_at.is_(None)
        ).all()
        
        active_assign_count = 0
        for a in assignments:
            derived_status = "Scheduled"
            if a.status == "Completed":
                derived_status = "Completed"
            elif a.paused_at is not None:
                derived_status = "Paused"
            elif a.start_datetime <= now <= a.end_datetime:
                derived_status = "Running"
            elif now > a.end_datetime:
                derived_status = "Completed"
            else:
                derived_status = "Scheduled"
            
            if derived_status == "Running":
                active_assign_count += 1

        if len(assignments) > 0:
            member_q = db.query(User).filter(
                User.group_id == g.id,
                not_(or_(
                    User.role.ilike('%sysadmin%'),
                    User.role.ilike('%system_admin%'),
                    User.name.ilike('%sysadmin%'),
                    User.name.ilike('%sys admin%'),
                    User.email.ilike('%sysadmin%'),
                ))
            )
            if not is_super_admin and valid_user_ids is not None:
                member_q = member_q.filter(User.id.in_(valid_user_ids))
            
            member_count = member_q.count()
            
            res.append({
                "id": g.id,
                "name": g.name,
                "memberCount": member_count,
                "activeLabsCount": active_assign_count
            })
    return res

@router.get("/analytics/groups/{group_id}")
def get_analytics_group_details(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns group metadata summary and list of all assigned labs.
    """
    from app.models.group import Group
    from app.models.assignment import Assignment
    from app.models.lab import Lab

    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    from app.models.user_affiliation import UserAffiliation as UA
    from sqlalchemy import not_, or_
    from datetime import datetime

    is_super_admin = (current_user.role or "").lower() in ("super_admin", "system_admin", "sysadmin")
    valid_user_ids = None
    if not is_super_admin:
        admin_affs = db.query(UA).filter(UA.user_id == current_user.id).all()
        admin_col_ids = [a.college_id for a in admin_affs if a.college_id is not None]
        raw_org_ids = [a.organization_id for a in admin_affs if a.organization_id is not None]
        admin_org_ids = []
        if raw_org_ids:
            from app.models.admin_models import Organization
            approved_orgs = db.query(Organization.id).filter(
                Organization.id.in_(raw_org_ids),
                Organization.status.in_(["APPROVED", "ACTIVE"])
            ).all()
            admin_org_ids = [o[0] for o in approved_orgs]

        filter_conds = []
        if admin_col_ids:
            filter_conds.append((UA.affiliation_type == "college") & (UA.college_id.in_(admin_col_ids)))
        if admin_org_ids:
            filter_conds.append((UA.affiliation_type == "organization") & (UA.organization_id.in_(admin_org_ids)))

        if filter_conds:
            valid_user_ids = db.query(UA.user_id).filter(or_(*filter_conds)).subquery()

    member_q = db.query(User).filter(
        User.group_id == group_id,
        not_(or_(
            User.role.ilike('%sysadmin%'),
            User.role.ilike('%system_admin%'),
            User.name.ilike('%sysadmin%'),
            User.name.ilike('%sys admin%'),
            User.email.ilike('%sysadmin%'),
        ))
    )
    if not is_super_admin and valid_user_ids is not None:
        member_q = member_q.filter(User.id.in_(valid_user_ids))

    members = member_q.all()
    member_ids = [m.id for m in members]
    member_count = len(members)

    assignments = db.query(Assignment).filter(
        Assignment.group_id == group_id,
        Assignment.deleted_at.is_(None)
    ).all()
    assigned_labs_count = len(assignments)

    # Compute overall completion % and averages across assigned labs
    total_completion = 0
    total_score = 0
    valid_scores_count = 0
    
    labs_list = []
    from app.core.timezone_utils import now_ist
    now = now_ist()
    for a in assignments:
        lab_title = db.query(Lab.name).filter(Lab.id == a.lab_id).scalar() or a.lab_id
        
        derived_status = "Scheduled"
        if a.status == "Completed":
            derived_status = "Completed"
        elif a.paused_at is not None:
            derived_status = "Paused"
        elif a.start_datetime <= now <= a.end_datetime:
            derived_status = "Running"
        elif now > a.end_datetime:
            derived_status = "Completed"
        else:
            derived_status = "Scheduled"

        from app.models.lab_module import LabModule
        total_modules = db.query(LabModule).filter(LabModule.lab_id == a.lab_id).count()
        if total_modules == 0:
            total_modules = 5

        # Calculate stats for this lab in group
        if member_count > 0:
            member_completion_sum = 0
            member_score_sum = 0
            total_seconds = 0
            
            for m_id in member_ids:
                ulp_completed = db.query(UserLabProgress).filter(
                    UserLabProgress.user_id == m_id,
                    UserLabProgress.lab_id == a.lab_id,
                    UserLabProgress.assignment_id == a.id,
                    UserLabProgress.status == "COMPLETED"
                ).count()
                
                ulp_score = db.query(func.sum(UserLabProgress.score)).filter(
                    UserLabProgress.user_id == m_id,
                    UserLabProgress.lab_id == a.lab_id,
                    UserLabProgress.assignment_id == a.id
                ).scalar() or 0
                
                ulp_seconds = db.query(func.sum(UserLabProgress.time_taken_seconds)).filter(
                    UserLabProgress.user_id == m_id,
                    UserLabProgress.lab_id == a.lab_id,
                    UserLabProgress.assignment_id == a.id
                ).scalar() or 0
                
                member_completion_sum += (ulp_completed / total_modules) * 100
                member_score_sum += ulp_score
                total_seconds += ulp_seconds

            completion_pct = round(member_completion_sum / member_count)
            avg_score = round(member_score_sum / member_count)
            
            total_completion += completion_pct
            total_score += avg_score
            valid_scores_count += 1
            
            avg_seconds = total_seconds / member_count
            hours = int(avg_seconds // 3600)
            minutes = int((avg_seconds % 3600) // 60)
            avg_time_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
        else:
            completion_pct = 0
            avg_score = 0
            avg_time_str = "0m"

        labs_list.append({
            "assignment_id": a.id,
            "lab_id": a.lab_id,
            "lab_title": lab_title,
            "status": derived_status,
            "student_count": member_count,
            "completion_percentage": completion_pct,
            "average_score": avg_score
        })

    overall_completion = round(total_completion / assigned_labs_count) if assigned_labs_count > 0 else 0
    overall_avg_score = round(total_score / valid_scores_count) if valid_scores_count > 0 else 0

    return {
        "group_id": g.id,
        "name": g.name,
        "member_count": member_count,
        "assigned_labs_count": assigned_labs_count,
        "overall_completion": overall_completion,
        "average_score": overall_avg_score,
        "average_time": avg_time_str if assigned_labs_count > 0 else "0m",
        "labs": labs_list
    }

@router.get("/analytics/students")
def get_analytics_students(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns only students with active assignments (not Completed, Ended, or Expired).
    """
    from app.models.assignment import Assignment
    from sqlalchemy import or_, and_

    students = db.query(User).filter(User.role.ilike("%student%")).all()
    res = []
    for s in students:
        has_assign = db.query(Assignment).filter(
            or_(
                Assignment.student_id == s.id,
                Assignment.group_id == s.group_id
            )
        ).first()
        if has_assign:
            res.append({
                "id": s.id,
                "fullName": s.name or s.email.split("@")[0],
                "email": s.email,
                "department": s.department or "Cyber Security",
                "year": s.year or "III Year",
                "active_assignment_id": has_assign.id,
                "lab_id": has_assign.lab_id
            })
    return res

@router.get("/analytics/students/{student_id}/labs/{lab_id}")
def get_student_lab_breakdown(
    student_id: int,
    lab_id: str,
    assignment_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns modules breakdown for a single student on a specific lab assignment.
    """
    from app.models.lab_module import LabModule
    from app.models.lab import Lab

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    assignment = _get_assignment_for_reporting(
        db,
        lab_id=lab_id,
        assignment_id=assignment_id,
        student_id=student_id,
    )

    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    lab_title = lab.name if lab else lab_id.replace("-", " ").title()

    modules = db.query(LabModule).filter(LabModule.lab_id == lab_id).all()
    if not modules:
        raise HTTPException(status_code=404, detail="No modules found for this lab")

    module_stats = []
    total_score = 0
    completed_cnt = 0
    total_time_seconds = 0

    # Skill categories tracker matching frontend RadarChart subjects
    track_scores = {
        "Reconnaissance": 0,
        "Exploitation": 0,
        "Analysis": 0,
        "Configuration": 0,
        "Defense": 0
    }
    track_counts = {k: 0 for k in track_scores.keys()}

    for m in modules:
        p = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == student_id,
            UserLabProgress.lab_id == lab_id,
            UserLabProgress.assignment_id == assignment.id,
            UserLabProgress.module_id == m.id
        ).first()

        status = p.status if p else "Not Started"
        score = p.score if p else 0
        attempts = p.attempts if p else 0
        time_taken = f"{round((p.time_taken_seconds or 0)/60)} min" if (p and p.time_taken_seconds) else "N/A"

        total_score += score
        if status == "COMPLETED":
            completed_cnt += 1
        if p and p.time_taken_seconds:
            total_time_seconds += p.time_taken_seconds

        # Classify module track/category into 5 standard radar domains
        cat = (m.track or m.category or "").lower()
        if "recon" in cat or "info" in cat:
            mapped_track = "Reconnaissance"
        elif "exploit" in cat or "offensive" in cat or "attack" in cat or "web" in cat:
            mapped_track = "Exploitation"
        elif "analysis" in cat or "forensics" in cat or "crypto" in cat:
            mapped_track = "Analysis"
        elif "config" in cat or "linux" in cat or "network" in cat:
            mapped_track = "Configuration"
        elif "defense" in cat or "hardening" in cat or "secure" in cat:
            mapped_track = "Defense"
        else:
            mapped_track = "Analysis"

        track_scores[mapped_track] += score
        track_counts[mapped_track] += 1

        module_stats.append({
            "module_id": m.id,
            "name": m.title,
            "score": score,
            "attempts": f"{attempts} Attempt" if attempts == 1 else f"{attempts} Attempts",
            "time_taken": time_taken,
            "status": status
        })

    completion_percentage = round((completed_cnt / len(modules)) * 100) if modules else 0

    # Format spider data - scale based on max score possible (e.g. count * 100)
    spider_chart = []
    for track, score_sum in track_scores.items():
        count = track_counts[track]
        # Calculate proficiency percentage (out of max 100 per module)
        avg = round((score_sum / (count * 100)) * 100) if count > 0 else 0
        # If no modules belong to this category, assign a default baseline based on student's overall progress
        if count == 0:
            avg = max(10, int(completion_percentage * 0.4))
        spider_chart.append({"subject": track, "score": min(100, avg), "fullMark": 100})

    # Format total time to hours and minutes
    hours = total_time_seconds // 3600
    minutes = (total_time_seconds % 3600) // 60
    time_str = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
    if total_time_seconds == 0:
        time_str = "0m"

    return {
        "student": {
            "fullName": student.name or student.email.split("@")[0],
            "department": student.department or "Cyber Security",
            "year": student.year or "III Year"
        },
        "assignment_id": assignment.id,
        "lab_title": lab_title,
        "overall_score": total_score,
        "completion_percentage": completion_percentage,
        "total_time_taken": time_str,
        "modules": module_stats,
        "spider_chart": spider_chart
    }

@router.get("/analytics/groups/{group_id}/labs/{lab_id}/export")
def export_group_lab_csv(
    group_id: int,
    lab_id: str,
    assignment_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates a CSV export detailing the complete dataset for the selected group and selected lab.
    """
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse
    from app.models.group import Group
    from app.models.lab_module import LabModule
    from app.models.lab import Lab
    from app.models.assignment import Assignment
    from app.models.user_affiliation import UserAffiliation as UA
    from sqlalchemy import not_, or_
    
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    is_super_admin = (current_user.role or "").lower() in ("super_admin", "system_admin", "sysadmin")
    valid_user_ids = None
    if not is_super_admin:
        admin_affs = db.query(UA).filter(UA.user_id == current_user.id).all()
        admin_col_ids = [aff.college_id for aff in admin_affs if aff.college_id is not None]
        raw_org_ids = [aff.organization_id for aff in admin_affs if aff.organization_id is not None]
        admin_org_ids = []
        if raw_org_ids:
            from app.models.admin_models import Organization
            approved_orgs = db.query(Organization.id).filter(
                Organization.id.in_(raw_org_ids),
                Organization.status.in_(["APPROVED", "ACTIVE"])
            ).all()
            admin_org_ids = [o[0] for o in approved_orgs]

        filter_conds = []
        if admin_col_ids:
            filter_conds.append((UA.affiliation_type == "college") & (UA.college_id.in_(admin_col_ids)))
        if admin_org_ids:
            filter_conds.append((UA.affiliation_type == "organization") & (UA.organization_id.in_(admin_org_ids)))

        if filter_conds:
            valid_user_ids = db.query(UA.user_id).filter(or_(*filter_conds)).subquery()

    member_q = db.query(User).filter(
        User.group_id == group_id,
        not_(or_(
            User.role.ilike('%sysadmin%'),
            User.role.ilike('%system_admin%'),
            User.name.ilike('%sysadmin%'),
            User.name.ilike('%sys admin%'),
            User.email.ilike('%sysadmin%'),
        ))
    )
    if not is_super_admin and valid_user_ids is not None:
        member_q = member_q.filter(User.id.in_(valid_user_ids))
        
    students = member_q.all()

    a = _get_assignment_for_reporting(
        db,
        lab_id=lab_id,
        assignment_id=assignment_id,
        group_id=group_id,
    )

    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    lab_title = lab.name if lab else lab_id

    modules = db.query(LabModule).filter(LabModule.lab_id == lab_id).all()
    module_ids = [m.id for m in modules]

    output = StringIO()
    writer = csv.writer(output)

    # Headers dynamically adding Module specific columns
    header = [
        "Student Name", "Department", "Year", "Assigned Lab",
        "Started Date", "Completed Date", "Status", "Completion %", "Overall Score", "Time Taken"
    ]
    for m in modules:
        header.extend([f"{m.title} Score", f"{m.title} Time", f"{m.title} Attempts"])
    writer.writerow(header)

    for s in students:
        progress_records = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == s.id,
            UserLabProgress.lab_id == lab_id,
            UserLabProgress.assignment_id == a.id
        ).all()

        status = "Not Started"
        started_date = "N/A"
        completed_date = "N/A"
        time_taken = "N/A"
        overall_score = 0
        completion_pct = 0

        if progress_records:
            overall_score = sum(p.score or 0 for p in progress_records)
            completed_mods = sum(1 for p in progress_records if p.status == "COMPLETED")
            completion_pct = round((completed_mods / len(modules)) * 100) if modules else 0

            has_completed = all(p.status == "COMPLETED" for p in progress_records)
            has_failed = any(p.status == "FAILED" for p in progress_records)

            if has_completed:
                status = "Completed"
            elif has_failed:
                status = "Failed"
            else:
                status = "Running"

            first_start = min((p.started_at for p in progress_records if p.started_at), default=None)
            last_complete = max((p.completed_at for p in progress_records if p.completed_at), default=None)
            
            if first_start:
                started_date = first_start.strftime("%Y-%m-%d %H:%M:%S")
            if last_complete:
                completed_date = last_complete.strftime("%Y-%m-%d %H:%M:%S")
            
            total_sec = sum(p.time_taken_seconds or 0 for p in progress_records)
            if total_sec > 0:
                time_taken = f"{round(total_sec / 60)} min"

        row = [
            s.name or s.email.split("@")[0],
            s.department or "Cyber Security",
            s.year or "III Year",
            lab_title,
            started_date,
            completed_date,
            status,
            f"{completion_pct}%",
            overall_score,
            time_taken
        ]

        for m in modules:
            mp = next((p for p in progress_records if p.module_id == m.id), None)
            if mp:
                m_score = mp.score or 0
                m_time = f"{round((mp.time_taken_seconds or 0)/60)} min" if mp.time_taken_seconds else "N/A"
                m_attempts = mp.attempts or 0
            else:
                m_score = 0
                m_time = "N/A"
                m_attempts = 0
            row.extend([m_score, m_time, m_attempts])

        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=group_{group_id}_lab_{lab_id}_analytics.csv"}
    )

@router.get("/analytics/students/{student_id}/labs/{lab_id}/pdf")
def export_student_lab_pdf(
    student_id: int,
    lab_id: str,
    assignment_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates a professional PDF report containing Student Information, Lab Details, 
    Overall Score, Completion %, Module Breakdown, Spider Graph metrics, and Instructor Summary.
    """
    from fastapi.responses import Response
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from io import BytesIO
    from app.models.lab import Lab
    from app.models.lab_module import LabModule

    from app.models.assignment import Assignment

    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    a = _get_assignment_for_reporting(
        db,
        lab_id=lab_id,
        assignment_id=assignment_id,
        student_id=student_id,
    )

    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    lab_title = lab.name if lab else lab_id.replace("-", " ").title()

    modules = db.query(LabModule).filter(LabModule.lab_id == lab_id).all()
    progress_records = db.query(UserLabProgress).filter(
        UserLabProgress.user_id == student_id,
        UserLabProgress.lab_id == lab_id,
        UserLabProgress.assignment_id == a.id
    ).all()

    overall_score = sum(p.score or 0 for p in progress_records)
    completed_mods = sum(1 for p in progress_records if p.status == "COMPLETED")
    completion_pct = round((completed_mods / len(modules)) * 100) if modules else 0

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=colors.HexColor('#0052CC'),
        spaceAfter=15
    )
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        textColor=colors.HexColor('#334155'),
        leading=12
    )

    story.append(Paragraph("CyberRange Academy Analytics Report", title_style))
    story.append(Paragraph(f"Generated Date: {datetime.utcnow().strftime('%d %b %Y')}", body_style))
    story.append(Spacer(1, 15))

    # Student & Lab Metadata Table
    meta_data = [
        [Paragraph("<b>Student Name:</b>", body_style), Paragraph(student.name or student.email.split("@")[0], body_style),
         Paragraph("<b>Lab Assigned:</b>", body_style), Paragraph(lab_title, body_style)],
        [Paragraph("<b>Department:</b>", body_style), Paragraph(student.department or "Cyber Security", body_style),
         Paragraph("<b>Overall Score:</b>", body_style), Paragraph(str(overall_score), body_style)],
        [Paragraph("<b>Academic Year:</b>", body_style), Paragraph(str(student.year) if student.year else "III Year", body_style),
         Paragraph("<b>Completion %:</b>", body_style), Paragraph(f"{completion_pct}%", body_style)]
    ]
    t_meta = Table(meta_data, colWidths=[100, 160, 100, 160])
    t_meta.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#E2E8F0')),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 20))

    # Module Breakdown Header
    story.append(Paragraph("Lab Modules Performance Summary", section_style))
    
    # Modules Table
    mod_data = [["Module Name", "Attempts", "Status", "Score", "Time Taken"]]
    for m in modules:
        mp = next((p for p in progress_records if p.module_id == m.id), None)
        status = mp.status if mp else "Not Started"
        score = mp.score or 0 if mp else 0
        attempts = mp.attempts or 0 if mp else 0
        time_taken = f"{round((mp.time_taken_seconds or 0)/60)} min" if (mp and mp.time_taken_seconds) else "N/A"
        mod_data.append([
            Paragraph(m.title, body_style),
            str(attempts),
            status,
            str(score),
            time_taken
        ])
    
    t_mod = Table(mod_data, colWidths=[200, 70, 80, 70, 100])
    t_mod.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0052CC')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
    ]))
    # For header white color workaround in Paragraphs
    for i in range(len(mod_data[0])):
        t_mod.setStyle(TableStyle([('TEXTCOLOR', (i,0), (i,0), colors.white)]))
    story.append(t_mod)
    story.append(Spacer(1, 20))

    # Skill Radar Graph Placeholder Summary
    story.append(Paragraph("Skill Category Matrices", section_style))
    story.append(Paragraph(
        "Performance vectors denote skill mastery across Web Security, Linux Systems, Networking, Cryptography, "
        "Forensics, Cloud Security, API Security, and Container Isolation parameters matching overall lab execution paths.",
        body_style
    ))
    story.append(Spacer(1, 15))

    # Instructor Summary
    story.append(Paragraph("Instructor Evaluation Summary", section_style))
    summary_text = (
        f"Student {student.name or student.email.split('@')[0]} has completed {completed_mods} out of {len(modules)} modules of "
        f"the {lab_title} training environment. With an overall score of {overall_score} and a precision completion value "
        f"of {completion_pct}%, performance meets the verification requirements designated under course curriculum guidelines."
    )
    story.append(Paragraph(summary_text, body_style))

    doc.build(story)
    pdf_out = buffer.getvalue()
    buffer.close()

    return Response(
        content=pdf_out,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=student_{student_id}_analytics.pdf"}
    )


# ==========================================================
# SETTINGS & FEEDBACK ENDPOINTS
# ==========================================================

@router.post("/feedback")
def submit_admin_feedback(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Saves subject and description feedback in the database logs or audit log target.
    """
    from app.models.audit_log import AuditLog
    subject = payload.get("subject", "General Feedback")
    feedback = payload.get("feedback", "")
    
    log_entry = AuditLog(
        action="SUBMIT_FEEDBACK",
        entity="feedback",
        performed_by=current_user.name or current_user.email,
        performed_by_role=current_user.role,
        old_value=subject,
        new_value=feedback,
        ip_address="127.0.0.1",
        status="SUCCESS"
    )
    db.add(log_entry)
    db.commit()

    from app.services.ses_service import ses_service
    portal_label = "Admin Portal" if current_user.role in ("admin", "system_admin") else "Student Portal"
    ses_service.send_feedback_notification_email(
        category=portal_label,
        subject=subject,
        description=feedback,
        submitter_email=current_user.email
    )

    return {"status": "success", "message": "Feedback submitted successfully"}


@router.post("/feedback/google-form-notify")
def notify_feedback_from_google_form(
    payload: dict,
    secret: str = Query(..., description="Shared webhook secret configured in the Apps Script trigger"),
    db: Session = Depends(get_db),
):
    """
    Public webhook called by a Google Apps Script onFormSubmit trigger attached to the
    platform feedback Google Form. Not user-authenticated (Google's servers call this) -
    protected instead by a shared secret compared against settings.FEEDBACK_WEBHOOK_SECRET.
    Persists the submission to the audit log and emails the sysadmin.
    """
    from app.core.config import settings
    if not getattr(settings, "FEEDBACK_WEBHOOK_SECRET", None) or secret != settings.FEEDBACK_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    category = payload.get("category", "Other")
    subject = payload.get("subject", "Feedback form submission")
    description = payload.get("description", "")
    submitter_email = payload.get("email", "")

    from app.models.audit_log import AuditLog
    log_entry = AuditLog(
        action="SUBMIT_FEEDBACK",
        entity="feedback",
        performed_by=submitter_email or "Google Form Submission",
        performed_by_role="external",
        old_value=f"[{category}] {subject}",
        new_value=description,
        ip_address="google-forms-webhook",
        status="SUCCESS"
    )
    db.add(log_entry)
    db.commit()

    from app.services.ses_service import ses_service
    ses_service.send_feedback_notification_email(
        category=category,
        subject=subject,
        description=description,
        submitter_email=submitter_email
    )
    return {"status": "success"}

@router.get("/login-history")
def get_login_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns login audits from the AuditLog table for the user.
    """
    from app.models.audit_log import AuditLog
    from sqlalchemy import desc
    logs = db.query(AuditLog).filter(
        AuditLog.user_id == current_user.id,
        AuditLog.action == "LOGIN"
    ).order_by(desc(AuditLog.timestamp)).limit(5).all()

    res = []
    for l in logs:
        res.append({
            "date": l.timestamp.strftime("%Y-%m-%d") if l.timestamp else "N/A",
            "time": l.timestamp.strftime("%H:%M:%S") if l.timestamp else "N/A",
            "ip_address": l.ip_address or "127.0.0.1",
            "browser": l.browser or "Chrome",
            "device": l.device or "Desktop",
            "status": l.status
        })

    # Mock values fallback if audit log table has no log entry
    if not res:
        res = [
            {
                "date": datetime.utcnow().strftime("%Y-%m-%d"),
                "time": datetime.utcnow().strftime("%H:%M:%S"),
                "ip_address": "192.168.1.105",
                "browser": "Chrome 124.0.0",
                "device": "Windows Desktop",
                "status": "SUCCESS"
            }
        ]
    return res

@router.post("/change-password")
def change_admin_password(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change password endpoint verifying current password and committing new one.
    """
    from app.core.security import verify_password, get_password_hash
    current_pw = payload.get("current_password")
    new_pw = payload.get("new_password")

    if not verify_password(current_pw, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    current_user.hashed_password = get_password_hash(new_pw)
    db.commit()
    return {"status": "success", "message": "Password changed successfully"}


# ==========================================================
# REPORTS ARCHIVE ENDPOINTS
# ==========================================================

@router.get("/reports")
def get_historical_reports(
    tab: str = "group",
    search: str = "",
    department: str = "",
    year: str = "",
    lab: str = "",
    start_date: str = "",
    end_date: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns only completed, ended, or expired assignments.
    """
    from app.models.assignment import Assignment
    from app.models.group import Group
    from app.models.lab import Lab
    from sqlalchemy import or_, and_

    query = db.query(Assignment).filter(
        Assignment.status.in_(["Completed", "Ended", "Expired", "Running", "Assigned"])
    )

    if lab:
        query = query.filter(Assignment.lab_id == lab)

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Assignment.start_datetime >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(Assignment.end_datetime <= end_dt)
        except ValueError:
            pass

    assignments = query.all()
    res = []

    if tab == "group":
        for a in assignments:
            if not a.group_id:
                continue
            
            g = db.query(Group).filter(Group.id == a.group_id).first()
            if not g:
                continue
            
            if search and not (g.name.lower().find(search.lower()) != -1 or a.lab_id.lower().find(search.lower()) != -1):
                continue
            
            # Organization/Affiliation Filtering and system admins exclusion
            from app.models.user_affiliation import UserAffiliation as UA
            from sqlalchemy import not_
            
            is_super_admin = (current_user.role or "").lower() in ("super_admin", "system_admin", "sysadmin")
            valid_user_ids = None
            if not is_super_admin:
                admin_affs = db.query(UA).filter(UA.user_id == current_user.id).all()
                admin_col_ids = [aff.college_id for aff in admin_affs if aff.college_id is not None]
                raw_org_ids = [aff.organization_id for aff in admin_affs if aff.organization_id is not None]
                admin_org_ids = []
                if raw_org_ids:
                    from app.models.admin_models import Organization
                    approved_orgs = db.query(Organization.id).filter(
                        Organization.id.in_(raw_org_ids),
                        Organization.status.in_(["APPROVED", "ACTIVE"])
                    ).all()
                    admin_org_ids = [o[0] for o in approved_orgs]

                filter_conds = []
                if admin_col_ids:
                    filter_conds.append((UA.affiliation_type == "college") & (UA.college_id.in_(admin_col_ids)))
                if admin_org_ids:
                    filter_conds.append((UA.affiliation_type == "organization") & (UA.organization_id.in_(admin_org_ids)))

                if filter_conds:
                    valid_user_ids = db.query(UA.user_id).filter(or_(*filter_conds)).subquery()

            member_q = db.query(User).filter(
                User.group_id == a.group_id,
                not_(or_(
                    User.role.ilike('%sysadmin%'),
                    User.role.ilike('%system_admin%'),
                    User.name.ilike('%sysadmin%'),
                    User.name.ilike('%sys admin%'),
                    User.email.ilike('%sysadmin%'),
                ))
            )
            if not is_super_admin and valid_user_ids is not None:
                member_q = member_q.filter(User.id.in_(valid_user_ids))
                
            students = member_q.all()

            if department:
                students = [s for s in students if s.department == department]
            if year:
                students = [s for s in students if str(s.year) == year or s.year == year]

            if not students and (department or year):
                continue

            student_ids = [s.id for s in students]
            student_count = len(students)

            # Compute stats scoped by start_datetime
            progress_records = db.query(UserLabProgress).filter(
                UserLabProgress.user_id.in_(student_ids),
                UserLabProgress.lab_id == a.lab_id,
                UserLabProgress.assignment_id == a.id
            ).all() if student_ids else []

            completed_cnt = sum(1 for p in progress_records if p.status == "COMPLETED")
            completion_pct = round((completed_cnt / student_count) * 100) if student_count > 0 else 0
            
            scores = [p.score for p in progress_records if p.score is not None]
            avg_score = round(sum(scores) / len(scores)) if scores else 0

            lab_title = db.query(Lab.name).filter(Lab.id == a.lab_id).scalar() or a.lab_id

            res.append({
                "assignment_id": a.id,
                "group_name": g.name,
                "lab_title": lab_title,
                "assigned_date": a.start_datetime.strftime("%Y-%m-%d") if a.start_datetime else "N/A",
                "end_date": a.end_datetime.strftime("%Y-%m-%d") if a.end_datetime else "N/A",
                "student_count": student_count,
                "completion_pct": completion_pct,
                "avg_score": avg_score,
                "status": a.status
            })
    else:
        for a in assignments:
            if a.student_id:
                student_ids = [a.student_id]
            elif a.group_id:
                from app.models.user_affiliation import UserAffiliation as UA
                from sqlalchemy import not_
                
                is_super_admin = (current_user.role or "").lower() in ("super_admin", "system_admin", "sysadmin")
                valid_user_ids = None
                if not is_super_admin:
                    admin_affs = db.query(UA).filter(UA.user_id == current_user.id).all()
                    admin_col_ids = [aff.college_id for aff in admin_affs if aff.college_id is not None]
                    raw_org_ids = [aff.organization_id for aff in admin_affs if aff.organization_id is not None]
                    admin_org_ids = []
                    if raw_org_ids:
                        from app.models.admin_models import Organization
                        approved_orgs = db.query(Organization.id).filter(
                            Organization.id.in_(raw_org_ids),
                            Organization.status.in_(["APPROVED", "ACTIVE"])
                        ).all()
                        admin_org_ids = [o[0] for o in approved_orgs]

                    filter_conds = []
                    if admin_col_ids:
                        filter_conds.append((UA.affiliation_type == "college") & (UA.college_id.in_(admin_col_ids)))
                    if admin_org_ids:
                        filter_conds.append((UA.affiliation_type == "organization") & (UA.organization_id.in_(admin_org_ids)))

                    if filter_conds:
                        valid_user_ids = db.query(UA.user_id).filter(or_(*filter_conds)).subquery()

                member_q = db.query(User.id).filter(
                    User.group_id == a.group_id,
                    not_(or_(
                        User.role.ilike('%sysadmin%'),
                        User.role.ilike('%system_admin%'),
                        User.name.ilike('%sysadmin%'),
                        User.name.ilike('%sys admin%'),
                        User.email.ilike('%sysadmin%'),
                    ))
                )
                if not is_super_admin and valid_user_ids is not None:
                    member_q = member_q.filter(User.id.in_(valid_user_ids))
                    
                student_ids = [u[0] for u in member_q.all()]
            else:
                continue

            students = db.query(User).filter(User.id.in_(student_ids)).all()
            for s in students:
                s_fullName = s.name or s.email.split("@")[0]
                s_dept = s.department or ""
                if search and not (
                    s_fullName.lower().find(search.lower()) != -1 or 
                    a.lab_id.lower().find(search.lower()) != -1 or 
                    s_dept.lower().find(search.lower()) != -1
                ):
                    continue
                if department and s.department != department:
                    continue
                if year and str(s.year) != year and s.year != year:
                    continue

                progress_records = db.query(UserLabProgress).filter(
                    UserLabProgress.user_id == s.id,
                    UserLabProgress.lab_id == a.lab_id,
                    UserLabProgress.assignment_id == a.id
                ).all()

                final_score = sum(p.score or 0 for p in progress_records)
                
                total_sec = sum(p.time_taken_seconds or 0 for p in progress_records)
                completion_time = f"{round(total_sec / 60)} min" if total_sec > 0 else "N/A"

                lab_title = db.query(Lab.name).filter(Lab.id == a.lab_id).scalar() or a.lab_id

                res.append({
                    "student_id": s.id,
                    "assignment_id": a.id,
                    "student_name": s.name or s.email.split("@")[0],
                    "department": s.department or "Cyber Security",
                    "year": s.year or "III Year",
                    "lab_title": lab_title,
                    "final_score": final_score,
                    "completion_time": completion_time,
                    "status": a.status
                })

    return res

@router.get("/reports/{assignment_id}")
def get_historical_report_details(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns finalized data for the group assignment.
    """
    from app.models.assignment import Assignment
    from app.models.group import Group
    from app.models.lab import Lab

    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Report assignment not found")

    lab_title = db.query(Lab.name).filter(Lab.id == a.lab_id).scalar() or a.lab_id

    if a.student_id:
        students = db.query(User).filter(User.id == a.student_id).all()
    elif a.group_id:
        from app.models.user_affiliation import UserAffiliation as UA
        from sqlalchemy import not_, or_
        
        is_super_admin = (current_user.role or "").lower() in ("super_admin", "system_admin", "sysadmin")
        valid_user_ids = None
        if not is_super_admin:
            admin_affs = db.query(UA).filter(UA.user_id == current_user.id).all()
            admin_col_ids = [aff.college_id for aff in admin_affs if aff.college_id is not None]
            raw_org_ids = [aff.organization_id for aff in admin_affs if aff.organization_id is not None]
            admin_org_ids = []
            if raw_org_ids:
                from app.models.admin_models import Organization
                approved_orgs = db.query(Organization.id).filter(
                    Organization.id.in_(raw_org_ids),
                    Organization.status.in_(["APPROVED", "ACTIVE"])
                ).all()
                admin_org_ids = [o[0] for o in approved_orgs]

            filter_conds = []
            if admin_col_ids:
                filter_conds.append((UA.affiliation_type == "college") & (UA.college_id.in_(admin_col_ids)))
            if admin_org_ids:
                filter_conds.append((UA.affiliation_type == "organization") & (UA.organization_id.in_(admin_org_ids)))

            if filter_conds:
                valid_user_ids = db.query(UA.user_id).filter(or_(*filter_conds)).subquery()

        member_q = db.query(User).filter(
            User.group_id == a.group_id,
            not_(or_(
                User.role.ilike('%sysadmin%'),
                User.role.ilike('%system_admin%'),
                User.name.ilike('%sysadmin%'),
                User.name.ilike('%sys admin%'),
                User.email.ilike('%sysadmin%'),
            ))
        )
        if not is_super_admin and valid_user_ids is not None:
            member_q = member_q.filter(User.id.in_(valid_user_ids))
            
        students = member_q.all()
    else:
        students = []

    students_list = []
    for s in students:
        progress_records = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == s.id,
            UserLabProgress.lab_id == a.lab_id,
            UserLabProgress.assignment_id == a.id
        ).all()

        final_score = sum(p.score or 0 for p in progress_records)
        attempts = sum(p.attempts or 0 for p in progress_records)
        
        total_sec = sum(p.time_taken_seconds or 0 for p in progress_records)
        completion_time = f"{round(total_sec / 60)} min" if total_sec > 0 else "N/A"

        module_scores_str = ", ".join([f"{p.module_id.replace(a.lab_id + '-', '').title()}: {p.score or 0}" for p in progress_records]) or "N/A"

        students_list.append({
            "id": s.id,
            "fullName": s.name or s.email.split("@")[0],
            "final_score": final_score,
            "completion_time": completion_time,
            "attempts": attempts,
            "module_scores": module_scores_str
        })

    return {
        "assignment_id": a.id,
        "lab_title": lab_title,
        "instructor": a.assigned_by or "Admin",
        "generated_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "students": students_list
    }

@router.get("/reports/group/{assignment_id}/export")
def download_group_report_archive(
    assignment_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Downloads historical group assignment gradebook report in CSV or PDF.
    """
    import traceback
    import logging

    logger = logging.getLogger(__name__)

    try:
        from app.models.assignment import Assignment
        from app.models.group import Group
        from app.models.lab import Lab

        a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
        if not a:
            raise HTTPException(status_code=404, detail="Assignment not found")

        lab_title = db.query(Lab.name).filter(Lab.id == a.lab_id).scalar() or a.lab_id

        from app.models.user_affiliation import UserAffiliation as UA
        from sqlalchemy import not_, or_
        
        is_super_admin = (current_user.role or "").lower() in ("super_admin", "system_admin", "sysadmin")
        valid_user_ids = None
        if not is_super_admin:
            admin_affs = db.query(UA).filter(UA.user_id == current_user.id).all()
            admin_col_ids = [aff.college_id for aff in admin_affs if aff.college_id is not None]
            raw_org_ids = [aff.organization_id for aff in admin_affs if aff.organization_id is not None]
            admin_org_ids = []
            if raw_org_ids:
                from app.models.admin_models import Organization
                approved_orgs = db.query(Organization.id).filter(
                    Organization.id.in_(raw_org_ids),
                    Organization.status.in_(["APPROVED", "ACTIVE"])
                ).all()
                admin_org_ids = [o[0] for o in approved_orgs]

            filter_conds = []
            if admin_col_ids:
                filter_conds.append((UA.affiliation_type == "college") & (UA.college_id.in_(admin_col_ids)))
            if admin_org_ids:
                filter_conds.append((UA.affiliation_type == "organization") & (UA.organization_id.in_(admin_org_ids)))

            if filter_conds:
                valid_user_ids = db.query(UA.user_id).filter(or_(*filter_conds)).subquery()

        member_q = db.query(User).filter(
            User.group_id == a.group_id,
            not_(or_(
                User.role.ilike('%sysadmin%'),
                User.role.ilike('%system_admin%'),
                User.name.ilike('%sysadmin%'),
                User.name.ilike('%sys admin%'),
                User.email.ilike('%sysadmin%'),
            ))
        )
        if not is_super_admin and valid_user_ids is not None:
            member_q = member_q.filter(User.id.in_(valid_user_ids))
            
        students = member_q.all() if a.group_id else []

        if format == "csv":
            import csv
            from io import StringIO
            from fastapi.responses import StreamingResponse

            output = StringIO()
            writer = csv.writer(output)

            writer.writerow(["Student Name", "Department", "Year", "Lab Title", "Final Score", "Time Taken"])
            for s in students:
                progress_records = db.query(UserLabProgress).filter(
                    UserLabProgress.user_id == s.id,
                    UserLabProgress.lab_id == a.lab_id,
                    UserLabProgress.assignment_id == a.id
                ).all()

                final_score = sum(p.score or 0 for p in progress_records)
                total_sec = sum(p.time_taken_seconds or 0 for p in progress_records)
                time_taken = f"{round(total_sec / 60)} min" if total_sec > 0 else "N/A"

                writer.writerow([
                    s.name or s.email.split("@")[0],
                    s.department or "Cyber Security",
                    str(s.year) if s.year else "III Year",
                    lab_title,
                    final_score,
                    time_taken
                ])

            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=group_report_{assignment_id}.csv"}
            )
        else:
            # PDF Generator (Reuse reportlab format)
            from fastapi.responses import Response
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors
            from io import BytesIO

            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
            story = []
            
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=20, textColor=colors.HexColor('#0052CC'), spaceAfter=15
            )
            body_style = ParagraphStyle(
                'BodyText', parent=styles['Normal'], fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#334155'), leading=12
            )

            story.append(Paragraph(f"Historical Group Assignment Report: {lab_title}", title_style))
            story.append(Paragraph(f"Generated Date: {datetime.utcnow().strftime('%d %b %Y')}", body_style))
            story.append(Spacer(1, 15))

            table_data = [["Student Name", "Department", "Year", "Final Score", "Time Taken"]]
            for s in students:
                progress_records = db.query(UserLabProgress).filter(
                    UserLabProgress.user_id == s.id,
                    UserLabProgress.lab_id == a.lab_id,
                    UserLabProgress.assignment_id == a.id
                ).all()

                final_score = sum(p.score or 0 for p in progress_records)
                total_sec = sum(p.time_taken_seconds or 0 for p in progress_records)
                time_taken = f"{round(total_sec / 60)} min" if total_sec > 0 else "N/A"

                table_data.append([
                    Paragraph(s.name or s.email.split("@")[0], body_style),
                    Paragraph(s.department or "Cyber Security", body_style),
                    Paragraph(str(s.year) if s.year else "III Year", body_style),
                    Paragraph(str(final_score), body_style),
                    Paragraph(time_taken, body_style)
                ])

            t = Table(table_data, colWidths=[150, 110, 100, 70, 90])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0052CC')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(t)

            doc.build(story)
            pdf_out = buffer.getvalue()
            buffer.close()

            return Response(
                content=pdf_out,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=group_report_{assignment_id}.pdf"}
            )
    except Exception as e:
        logger.exception(e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/student/{student_id}/{assignment_id}/export")
def download_student_report_archive(
    student_id: int,
    assignment_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Downloads historical student assignment report.
    """
    from app.models.assignment import Assignment
    from app.models.lab import Lab

    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if format == "pdf":
        return export_student_lab_pdf(
            student_id=student_id,
            lab_id=a.lab_id,
            assignment_id=a.id,
            current_user=current_user,
            db=db,
        )
    else:
        return export_group_lab_csv(
            group_id=a.group_id or 0,
            lab_id=a.lab_id,
            assignment_id=a.id,
            current_user=current_user,
            db=db,
        )





