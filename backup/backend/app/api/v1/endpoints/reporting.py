from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from datetime import datetime, timedelta
from typing import Optional, List
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.college import College
from app.models.professor import Professor
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user_lab_progress import UserLabProgress
from app.models.study_session import StudySession
from app.models.achievement import Achievement
from app.models.user_achievement import UserAchievement
from app.models.audit_log import AuditLog
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/colleges")
def list_colleges(db: Session = Depends(get_db)):
    """
    Returns a list of all active colleges to populate the frontend registration list.
    """
    colleges = db.query(College).filter(College.status == "ACTIVE").all()
    return [{
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "city": c.city,
        "country": c.country
    } for c in colleges]

@router.get("/dashboard")
def get_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Calculates dynamic aggregate analytics from database for the current user dashboard.
    """
    # 1. SUM(duration) for Training Hours
    total_seconds = db.query(func.sum(StudySession.duration_seconds)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 0
    total_hours = round(total_seconds / 3600, 1)

    # 2. AVG(duration) for Session Average
    avg_seconds = db.query(func.avg(StudySession.duration_seconds)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 0
    avg_minutes = round(avg_seconds / 60, 1)

    # 3. Badges (COUNT of achievements earned)
    earned_badges_count = db.query(func.count(UserAchievement.achievement_id)).filter(
        UserAchievement.user_id == current_user.id
    ).scalar() or 0

    # 4. Completed Modules COUNT
    completed_modules = db.query(func.count(UserLabProgress.id)).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.status == "COMPLETED"
    ).scalar() or 0

    # 5. Total Modules in Database
    total_modules = db.query(func.count(LabModule.id)).scalar() or 20 # Fallback default

    # 6. Completion rate percentage
    completion_rate = round((completed_modules / total_modules) * 100) if total_modules > 0 else 0

    # 7. Recent completed module activities
    recent_activities = db.query(UserLabProgress, LabModule).join(
        LabModule, UserLabProgress.module_id == LabModule.id
    ).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.status == "COMPLETED"
    ).order_index = desc(UserLabProgress.completed_at)
    
    # We order them explicitly
    recent = db.query(UserLabProgress).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.status == "COMPLETED"
    ).order_by(desc(UserLabProgress.completed_at)).limit(5).all()

    activity_logs = []
    for p in recent:
        mod = db.query(LabModule).filter(LabModule.id == p.module_id).first()
        activity_logs.append({
            "module_title": mod.title if mod else p.module_id,
            "completed_at": p.completed_at.strftime("%Y-%m-%d %H:%M:%S") if p.completed_at else "",
            "score": p.score
        })

    # 8. Weekly graph data (grouped by date)
    weekly_data = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = datetime.combine(target_date, datetime.max.time())
        count = db.query(func.count(UserLabProgress.id)).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.status == "COMPLETED",
            UserLabProgress.completed_at >= start_dt,
            UserLabProgress.completed_at <= end_dt
        ).scalar() or 0
        weekly_data.append({
            "day": target_date.strftime("%a"),
            "solved": count
        })

    # Group by category for skill ratings
    categories = db.query(LabModule.track, func.count(UserLabProgress.id)).join(
        UserLabProgress, UserLabProgress.module_id == LabModule.id
    ).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.status == "COMPLETED"
    ).group_by(LabModule.track).all()
    
    skills = {"linux": 0, "python": 0, "c": 0, "cpp": 0}
    for cat, count in categories:
        if cat in skills:
            skills[cat] = count

    return {
        "total_training_hours": total_hours,
        "avg_session_duration": avg_minutes,
        "badges_count": earned_badges_count,
        "completion_rate": completion_rate,
        "recent_activity": activity_logs,
        "weekly_graph": weekly_data,
        "skills": skills,
        "score": current_user.total_score
    }

@router.get("/progress")
def get_progress(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns list of all completed modules for the progress history page.
    """
    records = db.query(UserLabProgress).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.status == "COMPLETED"
    ).all()
    
    progress_list = []
    for r in records:
        mod = db.query(LabModule).filter(LabModule.id == r.module_id).first()
        progress_list.append({
            "id": r.id,
            "module_id": r.module_id,
            "module_title": mod.title if mod else r.module_id,
            "points": r.score,
            "attempts": r.attempts,
            "completed_at": r.completed_at.strftime("%Y-%m-%d %H:%M:%S") if r.completed_at else ""
        })
    return progress_list

@router.get("/achievements")
def get_achievements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns all achievements in system indicating whether the current user has unlocked them.
    """
    all_ach = db.query(Achievement).all()
    unlocked_ids = [ua.achievement_id for ua in db.query(UserAchievement).filter(
        UserAchievement.user_id == current_user.id
    ).all()]

    return [{
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "icon": a.icon,
        "reward_points": a.reward_points,
        "unlocked": a.id in unlocked_ids
    } for a in all_ach]

@router.get("/leaderboard")
def get_leaderboard(
    type: str = Query("global", regex="^(global|college|personal)$"),
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dynamic leaderboard endpoint. Ranks users globally or within their own college.
    """
    offset = (page - 1) * limit
    
    if type == "personal":
        # Returns only the user's score/rank
        # First calculate user's global rank
        sub_query = db.query(
            User.id, 
            func.rank().over(order_by=desc(User.total_score)).label("rank")
        ).subquery()
        rank_data = db.query(sub_query.c.rank).filter(sub_query.c.id == current_user.id).first()
        global_rank = rank_data[0] if rank_data else 1

        return {
            "rank": global_rank,
            "name": current_user.name,
            "score": current_user.total_score,
            "college": current_user.college.name if current_user.college else "Individual"
        }
        
    elif type == "college":
        if current_user.account_type != "STUDENT" or not current_user.college_id:
            raise AppError("College leaderboard is only available for registered Student accounts.", status_code=status.HTTP_400_BAD_REQUEST)
            
        # Rank students from same college
        query = db.query(User).filter(
            User.account_type == "STUDENT",
            User.college_id == current_user.college_id
        ).order_by(desc(User.total_score))
        
        total = query.count()
        results = query.offset(offset).limit(limit).all()
        
        ranks = []
        for idx, u in enumerate(results):
            ranks.append({
                "rank": offset + idx + 1,
                "name": u.name,
                "score": u.total_score,
                "college": current_user.college.name if current_user.college else "",
                "is_current": u.id == current_user.id
            })
        return {"total": total, "ranks": ranks}
        
    else: # global
        query = db.query(User).order_by(desc(User.total_score))
        total = query.count()
        results = query.offset(offset).limit(limit).all()
        
        ranks = []
        for idx, u in enumerate(results):
            col_name = db.query(College.name).filter(College.id == u.college_id).scalar() if u.college_id else "Individual"
            ranks.append({
                "rank": offset + idx + 1,
                "name": u.name,
                "score": u.total_score,
                "college": col_name,
                "is_current": u.id == current_user.id
            })
        return {"total": total, "ranks": ranks}

@router.get("/sessions")
def get_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns history of login study sessions for the user.
    """
    sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id
    ).order_by(desc(StudySession.login_time)).limit(20).all()

    return [{
        "login_time": s.login_time.strftime("%Y-%m-%d %H:%M:%S") if s.login_time else "",
        "logout_time": s.logout_time.strftime("%Y-%m-%d %H:%M:%S") if s.logout_time else "Active",
        "duration_minutes": round(s.duration_seconds / 60, 1) if s.duration_seconds else 0
    } for s in sessions]

@router.get("/audit-logs")
def get_audit_logs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns user action audit timeline logs.
    """
    logs = db.query(AuditLog).filter(
        AuditLog.user_id == current_user.id
    ).order_by(desc(AuditLog.timestamp)).limit(30).all()

    return [{
        "action": l.action,
        "resource": l.resource,
        "new_value": l.new_value,
        "status": l.status,
        "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S")
    } for l in logs]

from pydantic import BaseModel

class FlagSubmitNotify(BaseModel):
    lab_id: Optional[str] = "command-line-lab"
    module_id: str
    flag: str
    correct: bool
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None

def parse_ua(user_agent_str: Optional[str]):
    if not user_agent_str:
        return "Unknown Browser", "Unknown Device"
    ua = user_agent_str.lower()
    if "chrome" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua:
        browser = "Safari"
    elif "edge" in ua:
        browser = "Edge"
    else:
        browser = "Web Browser"
        
    if "windows" in ua:
        device = "Windows PC"
    elif "macintosh" in ua or "mac os" in ua:
        device = "Macbook"
    elif "linux" in ua:
        device = "Linux Machine"
    elif "iphone" in ua or "ipad" in ua:
        device = "iOS Device"
    elif "android" in ua:
        device = "Android Device"
    else:
        device = "Web Device"
    return browser, device

@router.post("/submit-flag")
def submit_flag(
    payload: FlagSubmitNotify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits a flag from the scoring server to the core backend.
    Runs inside a single ACID database transaction.
    """
    target_lab_id = payload.lab_id or "command-line-lab"
    logger.info(f"[submit_flag] Entering submit_flag() with target_lab_id='{target_lab_id}', module_id='{payload.module_id}', correct={payload.correct}")

    # Step 1: JWT decoded & User lookup
    logger.info(f"[submit_flag] JWT decoded & User found: id={current_user.id}, email='{current_user.email}'")

    # Step 2: Lab lookup
    lab = db.query(Lab).filter(Lab.id == target_lab_id).first()
    if not lab:
        logger.error(f"[submit_flag] Lab lookup failed: Lab '{target_lab_id}' not found in database.")
        raise HTTPException(status_code=404, detail=f"Lab '{target_lab_id}' not found.")
    logger.info(f"[submit_flag] Lab found: id='{lab.id}', name='{lab.name}'")

    # Step 3: Module lookup with fallback resolution
    mod = db.query(LabModule).filter(LabModule.id == payload.module_id).first()
    if not mod:
        alt_id = f"linux_{payload.module_id}" if not payload.module_id.startswith("linux_") else payload.module_id.replace("linux_", "")
        mod = db.query(LabModule).filter(LabModule.id == alt_id).first()
        if mod:
            logger.info(f"[submit_flag] Module resolved via fallback alias from '{payload.module_id}' to '{alt_id}'")
            payload.module_id = alt_id

    if not mod:
        logger.error(f"[submit_flag] Module lookup failed: Module '{payload.module_id}' not found in lab modules catalog.")
        raise HTTPException(status_code=404, detail=f"Module '{payload.module_id}' not found.")

    logger.info(f"[submit_flag] Module found: id='{mod.id}', title='{mod.title}', points={mod.points}")

    # Step 4: Verify module belongs to lab
    if mod.lab_id != lab.id:
        logger.error(f"[submit_flag] Module lab mismatch: Module '{mod.id}' belongs to lab '{mod.lab_id}', not '{lab.id}'")
        raise HTTPException(status_code=400, detail=f"Module '{mod.id}' does not belong to lab '{lab.id}'.")

    browser, device = parse_ua(payload.user_agent)
    client_ip = payload.client_ip or "127.0.0.1"

    # Transaction Block
    try:
        # If the flag submission is INCORRECT
        if not payload.correct:
            logger.info(f"[submit_flag] Flag is INCORRECT. Logging wrong flag submission for user_id={current_user.id}")
            log_entry = AuditLog(
                user_id=current_user.id,
                action="Wrong Flag",
                resource="LabModule",
                resource_id=payload.module_id,
                new_value=f"Submitted wrong flag: {payload.flag}",
                status="FAILED",
                ip_address=client_ip,
                browser=browser,
                device=device
            )
            db.add(log_entry)
            
            progress = db.query(UserLabProgress).filter(
                UserLabProgress.user_id == current_user.id,
                UserLabProgress.module_id == payload.module_id
            ).first()
            if progress:
                progress.attempts += 1
                progress.last_submission = payload.flag
                
            logger.info(f"[submit_flag] Committing wrong flag audit transaction...")
            db.commit()
            logger.info(f"[submit_flag] Commit successful for wrong flag submission.")
            return {"success": False, "message": "Incorrect flag logged."}

        # If CORRECT
        logger.info(f"[submit_flag] Flag is CORRECT. Processing points award ({mod.points} pts)...")
        points = mod.points

        progress = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.module_id == payload.module_id
        ).first()
        
        if progress and progress.status == "COMPLETED":
            logger.info(f"[submit_flag] Module '{payload.module_id}' already completed by user_id={current_user.id}. Skipping point re-award.")
            return {"success": True, "message": "Module already completed."}

        now = datetime.utcnow()
        
        if not progress:
            logger.info(f"[submit_flag] Creating new UserLabProgress record for module_id='{payload.module_id}'")
            progress = UserLabProgress(
                user_id=current_user.id,
                lab_id=lab.id,
                module_id=payload.module_id,
                status="COMPLETED",
                score=points,
                attempts=1,
                started_at=now - timedelta(minutes=10),
                completed_at=now,
                time_taken_seconds=600,
                last_submission=payload.flag,
                flag_correct=True,
                client_ip=client_ip,
                browser=browser,
                device=device
            )
            db.add(progress)
        else:
            logger.info(f"[submit_flag] Updating existing UserLabProgress record for module_id='{payload.module_id}'")
            duration = int((now - progress.started_at).total_seconds()) if progress.started_at else 600
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

        logger.info(f"[submit_flag] Updating total_score for user_id={current_user.id}: previous={current_user.total_score}, added={points}")
        current_user.total_score += points

        # Achievement evaluation
        achievements_earned = []
        solved_count = db.query(func.count(UserLabProgress.id)).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.status == "COMPLETED"
        ).scalar() + (0 if progress.id else 1)
        
        if solved_count == 1:
            achievements_earned.extend(["first-lab", "first-module"])

        if current_user.total_score >= 100:
            achievements_earned.append("100-points")
        if current_user.total_score >= 500:
            achievements_earned.append("500-points")
        if current_user.total_score >= 1000:
            achievements_earned.append("1000-points")

        linux_mods = [f"linux_module{i}" for i in range(1, 6)] + [f"module{i}" for i in range(1, 6)]
        completed_linux = db.query(func.count(UserLabProgress.id)).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.status == "COMPLETED",
            UserLabProgress.module_id.in_(linux_mods),
            UserLabProgress.module_id != payload.module_id
        ).scalar()
        if completed_linux >= 4 and payload.module_id in linux_mods:
            achievements_earned.append("linux-track")

        total_db_mods = db.query(func.count(LabModule.id)).scalar() or 20
        if solved_count == total_db_mods:
            achievements_earned.append("complete-every-module")

        not_perfect = db.query(UserLabProgress).filter(
            UserLabProgress.user_id == current_user.id,
            UserLabProgress.attempts > 1,
            UserLabProgress.module_id != payload.module_id
        ).first()
        if not not_perfect and progress.attempts == 1:
            achievements_earned.append("perfect-run")

        if progress.time_taken_seconds and progress.time_taken_seconds <= 30:
            achievements_earned.append("fast-solver")

        for ach_id in achievements_earned:
            existing = db.query(UserAchievement).filter(
                UserAchievement.user_id == current_user.id,
                UserAchievement.achievement_id == ach_id
            ).first()
            
            if not existing:
                logger.info(f"[submit_flag] Creating achievement record for ach_id='{ach_id}'")
                ua = UserAchievement(user_id=current_user.id, achievement_id=ach_id, earned_at=now)
                db.add(ua)
                ach_rec = db.query(Achievement).filter(Achievement.id == ach_id).first()
                if ach_rec:
                    current_user.total_score += ach_rec.reward_points
                    
                log_ach = AuditLog(
                    user_id=current_user.id,
                    action="Achievement Earned",
                    resource="Achievement",
                    resource_id=ach_id,
                    new_value=f"Unlocked achievement: {ach_id}",
                    status="SUCCESS"
                )
                db.add(log_ach)

        # Audit logs for correct flag & module completion
        logger.info(f"[submit_flag] Creating AuditLogs for Correct Flag and Module Completed...")
        log_correct = AuditLog(
            user_id=current_user.id,
            action="Correct Flag",
            resource="LabModule",
            resource_id=payload.module_id,
            status="SUCCESS",
            ip_address=client_ip,
            browser=browser,
            device=device
        )
        db.add(log_correct)

        log_completed = AuditLog(
            user_id=current_user.id,
            action="Module Completed",
            resource="LabModule",
            resource_id=payload.module_id,
            status="SUCCESS",
            ip_address=client_ip,
            browser=browser,
            device=device
        )
        db.add(log_completed)

        if solved_count == total_db_mods:
            log_lab = AuditLog(
                user_id=current_user.id,
                action="Lab Completed",
                resource="Lab",
                resource_id=lab.id,
                status="SUCCESS",
                ip_address=client_ip,
                browser=browser,
                device=device
            )
            db.add(log_lab)

        logger.info(f"[submit_flag] Committing single ACID transaction for user_id={current_user.id}...")
        db.commit()
        logger.info(f"[submit_flag] Commit successful! Returning success response to client.")
        return {
            "success": True, 
            "message": "Flag submission completed successfully.", 
            "points_awarded": points, 
            "total_score": current_user.total_score
        }

    except Exception as e:
        db.rollback()
        logger.error(f"[submit_flag] Transaction failed for module_id='{payload.module_id}'. Rolled back! Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database transaction error: {str(e)}")


