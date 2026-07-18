import os
import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.college import College
from app.models.user_lab_progress import UserLabProgress
from app.models.user_achievement import UserAchievement
from app.models.study_session import StudySession
from app.models.audit_log import AuditLog
from app.core.security import get_password_hash, verify_password

router = APIRouter()

# ------------------------------------------------------------------
# SCHEMAS
# ------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    profile_photo: Optional[str] = None
    account_type: Optional[str] = None
    
    # Professional (for INDIVIDUAL)
    profession: Optional[str] = None
    organization: Optional[str] = None
    experience: Optional[str] = None
    highest_qualification: Optional[str] = None

    # Education (for STUDENT)
    college_id: Optional[int] = None
    department: Optional[str] = None
    course: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[int] = None
    roll_number: Optional[str] = None
    section: Optional[str] = None
    professor: Optional[str] = None
    batch: Optional[str] = None
    student_id_num: Optional[str] = None


class SettingsUpdate(BaseModel):
    language: Optional[str] = None
    timezone: Optional[str] = None
    notification_settings: Optional[Dict[str, Any]] = None
    security_settings: Optional[Dict[str, Any]] = None


class AppearanceUpdate(BaseModel):
    theme: Optional[str] = "dark"
    accent_color: Optional[str] = "#0052CC"
    font_size: Optional[str] = "medium"
    compact_mode: Optional[bool] = False
    animations: Optional[bool] = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ------------------------------------------------------------------
# HELPER FUNCTIONS
# ------------------------------------------------------------------

def get_client_info(request: Request):
    user_agent = request.headers.get("User-Agent", "Web Browser")
    ip_address = request.client.host if request.client else "127.0.0.1"
    
    device = "PC / Workstation"
    if "Mobile" in user_agent: device = "Mobile Device"
    elif "Tablet" in user_agent: device = "Tablet Device"
    
    browser = "Web Browser"
    if "Chrome" in user_agent: browser = "Google Chrome"
    elif "Firefox" in user_agent: browser = "Mozilla Firefox"
    elif "Safari" in user_agent: browser = "Apple Safari"
    elif "Edg" in user_agent: browser = "Microsoft Edge"

    return ip_address, browser, device


# ------------------------------------------------------------------
# ENDPOINTS
# ------------------------------------------------------------------

@router.get("/profile")
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns full profile details and academic/professional data from PostgreSQL.
    """
    college_name = None
    if current_user.college_id:
        c = db.query(College).filter(College.id == current_user.college_id).first()
        if c:
            college_name = c.name

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "account_type": current_user.account_type,
        "profile_completed": current_user.profile_completed,
        "profile_photo": current_user.profile_photo,
        "phone": current_user.phone,
        "dob": current_user.dob,
        "gender": current_user.gender,
        "country": current_user.country,
        "state": current_user.state,
        "city": current_user.city,
        
        # Professional
        "profession": current_user.profession,
        "organization": current_user.organization,
        "experience": current_user.experience,
        "highest_qualification": current_user.highest_qualification,

        # Education
        "college_id": current_user.college_id,
        "college_name": college_name,
        "department": current_user.department,
        "course": current_user.course,
        "year": current_user.year,
        "semester": current_user.semester,
        "roll_number": current_user.roll_number,
        "section": current_user.section,
        "professor": current_user.professor,
        "batch": current_user.batch,
        "student_id_num": current_user.student_id_num,

        # System meta
        "theme": current_user.theme or "dark",
        "created_at": current_user.created_at.strftime("%Y-%m-%d %H:%M:%S") if current_user.created_at else None,
        "last_login": current_user.last_login.strftime("%Y-%m-%d %H:%M:%S") if current_user.last_login else None
    }


@router.put("/profile")
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates profile data and marks profile_completed = True inside a single transaction.
    """
    ip_address, browser, device = get_client_info(request)
    is_initial_creation = not current_user.profile_completed

    try:
        if payload.name is not None: current_user.name = payload.name
        if payload.phone is not None: current_user.phone = payload.phone
        if payload.dob is not None: current_user.dob = payload.dob
        if payload.gender is not None: current_user.gender = payload.gender
        if payload.country is not None: current_user.country = payload.country
        if payload.state is not None: current_user.state = payload.state
        if payload.city is not None: current_user.city = payload.city
        if payload.profile_photo is not None: current_user.profile_photo = payload.profile_photo
        if payload.account_type is not None: current_user.account_type = payload.account_type

        # Professional
        if payload.profession is not None: current_user.profession = payload.profession
        if payload.organization is not None: current_user.organization = payload.organization
        if payload.experience is not None: current_user.experience = payload.experience
        if payload.highest_qualification is not None: current_user.highest_qualification = payload.highest_qualification

        # Education
        if payload.college_id is not None: current_user.college_id = payload.college_id
        if payload.department is not None: current_user.department = payload.department
        if payload.course is not None: current_user.course = payload.course
        if payload.year is not None: current_user.year = payload.year
        if payload.semester is not None: current_user.semester = payload.semester
        if payload.roll_number is not None: current_user.roll_number = payload.roll_number
        if payload.section is not None: current_user.section = payload.section
        if payload.professor is not None: current_user.professor = payload.professor
        if payload.batch is not None: current_user.batch = payload.batch
        if payload.student_id_num is not None: current_user.student_id_num = payload.student_id_num

        current_user.profile_completed = True
        current_user.updated_at = datetime.utcnow()

        # Audit log creation
        action_name = "Profile Created" if is_initial_creation else "Profile Updated"
        log = AuditLog(
            user_id=current_user.id,
            action=action_name,
            resource="User",
            resource_id=str(current_user.id),
            new_value=json.dumps({"name": current_user.name, "account_type": current_user.account_type}),
            status="SUCCESS",
            ip_address=ip_address,
            browser=browser,
            device=device
        )
        db.add(log)
        db.commit()
        return {"success": True, "message": f"{action_name} successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@router.post("/profile/photo")
async def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Uploads a new profile photo (jpg, jpeg, png, webp <= 5MB) inside a transactional block.
    """
    ip_address, browser, device = get_client_info(request)

    # 1. Validate extension
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ["jpg", "jpeg", "png", "webp"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload JPG, JPEG, PNG, or WEBP images.")

    # 2. Validate max size (5 MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 5 MB limit.")

    # 3. Create file path inside backend/uploads/profile_photos/
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    upload_folder = os.path.join(backend_dir, "uploads", "profile_photos")
    os.makedirs(upload_folder, exist_ok=True)

    filename = f"user_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    saved_path = os.path.join(upload_folder, filename)
    relative_url = f"/uploads/profile_photos/{filename}"

    old_photo = current_user.profile_photo

    # Save to disk
    try:
        with open(saved_path, "wb") as f:
            f.write(contents)
    except Exception as io_err:
        raise HTTPException(status_code=500, detail=f"Failed to write image file to disk: {str(io_err)}")

    # Update Database Transaction
    try:
        current_user.profile_photo = relative_url
        current_user.updated_at = datetime.utcnow()

        log = AuditLog(
            user_id=current_user.id,
            action="Photo Uploaded",
            resource="User",
            resource_id=str(current_user.id),
            old_value=old_photo,
            new_value=relative_url,
            status="SUCCESS",
            ip_address=ip_address,
            browser=browser,
            device=device
        )
        db.add(log)
        db.commit()

        # Remove old image from disk if exists locally
        if old_photo and old_photo.startswith("/uploads/profile_photos/"):
            old_file_name = old_photo.split("/")[-1]
            old_file_path = os.path.join(upload_folder, old_file_name)
            if os.path.exists(old_file_path):
                try: os.remove(old_file_path)
                except Exception: pass

        return {
            "success": True, 
            "profile_photo": relative_url,
            "message": "Profile photo uploaded successfully."
        }
    except Exception as db_err:
        db.rollback()
        # Transaction Safety: Delete uploaded image if database commit failed
        if os.path.exists(saved_path):
            try: os.remove(saved_path)
            except Exception: pass
        raise HTTPException(status_code=500, detail=f"Database error saving profile photo: {str(db_err)}")


@router.delete("/profile/photo")
def delete_profile_photo(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes the current profile photo from disk and sets profile_photo = None in PostgreSQL.
    """
    ip_address, browser, device = get_client_info(request)
    old_photo = current_user.profile_photo

    if not old_photo:
        return {"success": True, "message": "No profile photo to remove."}

    try:
        current_user.profile_photo = None
        current_user.updated_at = datetime.utcnow()

        log = AuditLog(
            user_id=current_user.id,
            action="Photo Deleted",
            resource="User",
            resource_id=str(current_user.id),
            old_value=old_photo,
            new_value=None,
            status="SUCCESS",
            ip_address=ip_address,
            browser=browser,
            device=device
        )
        db.add(log)
        db.commit()

        # Remove file from disk
        if old_photo.startswith("/uploads/profile_photos/"):
            backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
            upload_folder = os.path.join(backend_dir, "uploads", "profile_photos")
            old_file_name = old_photo.split("/")[-1]
            old_file_path = os.path.join(upload_folder, old_file_name)
            if os.path.exists(old_file_path):
                try: os.remove(old_file_path)
                except Exception: pass

        return {"success": True, "message": "Profile photo removed successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete profile photo: {str(e)}")



@router.get("/statistics")
def get_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes and returns REAL PostgreSQL statistics for the logged-in user.
    """
    # Solved modules count
    solved_modules_count = db.query(func.count(UserLabProgress.id)).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.status == "COMPLETED"
    ).scalar() or 0

    # Solved flags / challenges count
    solved_flags_count = db.query(func.count(UserLabProgress.id)).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.flag_correct == True
    ).scalar() or 0

    # Achievements count
    achievements_count = db.query(func.count(UserAchievement.achievement_id)).filter(
        UserAchievement.user_id == current_user.id
    ).scalar() or 0

    # Training hours from progress & sessions
    seconds_from_progress = db.query(func.sum(UserLabProgress.time_taken_seconds)).filter(
        UserLabProgress.user_id == current_user.id
    ).scalar() or 0
    
    seconds_from_sessions = db.query(func.sum(StudySession.duration_seconds)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 0

    total_seconds = (seconds_from_progress or 0) + (seconds_from_sessions or 0)
    training_hours = round(total_seconds / 3600.0, 1)

    # Average session minutes
    sessions_count = db.query(func.count(StudySession.id)).filter(
        StudySession.user_id == current_user.id
    ).scalar() or 1
    avg_session_mins = round((total_seconds / 60.0) / max(1, sessions_count), 1)

    # Global rank calculation
    better_global_users = db.query(func.count(User.id)).filter(
        User.total_score > current_user.total_score
    ).scalar() or 0
    global_rank = better_global_users + 1

    # College rank calculation
    college_rank = None
    if current_user.college_id:
        better_college_users = db.query(func.count(User.id)).filter(
            User.college_id == current_user.college_id,
            User.total_score > current_user.total_score
        ).scalar() or 0
        college_rank = better_college_users + 1

    # Level and XP
    level = (current_user.total_score // 500) + 1
    xp = current_user.total_score % 500

    # Streak calculation (distinct active days)
    distinct_days = db.query(func.date(UserLabProgress.completed_at)).filter(
        UserLabProgress.user_id == current_user.id,
        UserLabProgress.status == "COMPLETED"
    ).distinct().count()

    return {
        "labs_completed": 1 if solved_modules_count > 0 else 0,
        "modules_completed": solved_modules_count,
        "challenges_solved": solved_flags_count,
        "achievements": achievements_count,
        "total_score": current_user.total_score,
        "training_hours": training_hours,
        "avg_session_mins": avg_session_mins,
        "current_level": level,
        "current_xp": xp,
        "max_xp": 500,
        "current_streak_days": max(1, distinct_days) if solved_modules_count > 0 else 0,
        "global_rank": global_rank,
        "college_rank": college_rank or "--",
        "last_login": current_user.last_login.strftime("%Y-%m-%d %H:%M:%S") if current_user.last_login else "Active",
        "created_at": current_user.created_at.strftime("%Y-%m-%d") if current_user.created_at else None
    }


@router.get("/settings")
def get_settings(
    current_user: User = Depends(get_current_user)
):
    """
    Returns general, notification, and system platform info settings.
    """
    notif_settings = json.loads(current_user.notification_settings) if current_user.notification_settings else {
        "email_notifications": True,
        "achievement_notifications": True,
        "professor_assignments": True,
        "leaderboard_updates": True,
        "system_alerts": True,
        "maintenance_alerts": True
    }

    return {
        "language": current_user.language or "en",
        "timezone": current_user.timezone or "UTC",
        "date_format": "YYYY-MM-DD",
        "notification_settings": notif_settings,
        "platform_info": {
            "version": "CyberRange v1.0.0",
            "frontend": "React 18 + TypeScript + Vite",
            "backend": "FastAPI (Python 3.11)",
            "database": "AWS RDS PostgreSQL (v15.3)",
            "environment": "Production",
            "docker": "Docker Engine Active",
            "git_commit": "main-f82a9bc"
        }
    }


@router.put("/settings")
def update_settings(
    payload: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates general and notification preference settings in PostgreSQL.
    """
    if payload.language is not None: current_user.language = payload.language
    if payload.timezone is not None: current_user.timezone = payload.timezone
    if payload.notification_settings is not None:
        current_user.notification_settings = json.dumps(payload.notification_settings)

    db.commit()
    return {"success": True, "message": "Settings updated successfully."}


@router.get("/security")
def get_security_details(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns login audit history, device metadata, and security settings.
    """
    user_agent_str = request.headers.get("User-Agent", "")
    client_ip = request.client.host if request.client else "127.0.0.1"

    # Fetch recent login/security audit logs
    recent_logs = db.query(AuditLog).filter(
        AuditLog.user_id == current_user.id
    ).order_by(desc(AuditLog.timestamp)).limit(10).all()

    logs_data = [{
        "action": l.action,
        "ip_address": l.ip_address or client_ip,
        "browser": l.browser or "Web Browser",
        "device": l.device or "PC / Workstation",
        "status": l.status,
        "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S")
    } for l in recent_logs]

    return {
        "current_ip": client_ip,
        "current_user_agent": user_agent_str,
        "last_login": current_user.last_login.strftime("%Y-%m-%d %H:%M:%S") if current_user.last_login else "Now",
        "recent_login_history": logs_data,
        "two_factor_enabled": False
    }


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Changes the user password securely.
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.updated_at = datetime.utcnow()

    log = AuditLog(
        user_id=current_user.id,
        action="Password Changed",
        resource="User",
        resource_id=str(current_user.id),
        status="SUCCESS"
    )
    db.add(log)
    db.commit()
    return {"success": True, "message": "Password changed successfully."}


@router.get("/sessions")
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns active training sessions and historical logins.
    """
    sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id
    ).order_by(desc(StudySession.login_time)).limit(10).all()

    return [{
        "id": s.id,
        "login_time": s.login_time.strftime("%Y-%m-%d %H:%M:%S"),
        "logout_time": s.logout_time.strftime("%Y-%m-%d %H:%M:%S") if s.logout_time else "Active Now",
        "duration_seconds": s.duration_seconds or 0,
        "lab_id": s.lab_id or "Command Line Lab"
    } for s in sessions]


@router.put("/appearance")
def update_appearance(
    payload: AppearanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates theme ('light', 'dark', 'system') and appearance settings in PostgreSQL.
    """
    if payload.theme is not None:
        current_user.theme = payload.theme
    
    current_user.appearance_settings = json.dumps({
        "accent_color": payload.accent_color or "#0052CC",
        "font_size": payload.font_size or "medium",
        "compact_mode": payload.compact_mode or False,
        "animations": payload.animations if payload.animations is not None else True
    })

    db.commit()
    return {
        "success": True, 
        "theme": current_user.theme,
        "message": "Appearance preferences saved in database."
    }
