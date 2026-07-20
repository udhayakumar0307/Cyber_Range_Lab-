import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.auth import (
    UserLogin, UserResponse, UserRegister, ForgotPasswordRequest,
    ResetPasswordRequest, OTPVerifyRequest
)
from app.services.user import user_service
from app.core.security import create_access_token, get_password_hash
from app.core.exceptions import AuthenticationError, AppError
from app.core.config import settings
from app.models.user import User
from app.models.otp import OTPVerification
from app.models.password_reset import PasswordReset
from app.models.audit_log import AuditLog
from app.services.ses_service import ses_service
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login")
def login(response: Response, login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Handles authentication. Delivers tokens via HTTP response (dev LocalStorage)
    or sets HttpOnly Secure Cookies (prod).
    """
    user = user_service.authenticate_user(db, login_data.email, login_data.password)
    if not user:
        # Log failed login attempt
        existing_user = db.query(User).filter(User.email == login_data.email).first()
        log_entry = AuditLog(
            user_id=existing_user.id if existing_user else None,
            action="Login",
            resource="User",
            status="FAILED",
            new_value=f"Failed login attempt for email: {login_data.email}"
        )
        db.add(log_entry)
        db.commit()
        raise AuthenticationError("Invalid Email or Password")
        
    logger.info("User authenticated")
    role_name = user.role.lower() if user.role else "user"
    token = create_access_token(data={
        "sub": user.email,
        "user_id": user.id,
        "role": role_name,
        "organization_id": user.organization or ""
    })
    
    # Log successful login
    log_entry = AuditLog(
        user_id=user.id,
        action="Login",
        resource="User",
        resource_id=str(user.id),
        status="SUCCESS"
    )
    db.add(log_entry)
    db.commit()
    
    is_prod = settings.ENV == "production"
    
    if is_prod:
        # Secure Cookie response for Production environments
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=1440 * 60  # 24 Hours
        )
        
    return {
        "success": True,
        "token": token,
        "role": role_name,
        "user": {
            "id": user.id,
            "name": user.name or "User",
            "email": user.email,
            "role": role_name
        }
    }

@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Handles logging out by clearing cookies in production and writing audit log.
    """
    log_entry = AuditLog(
        user_id=current_user.id,
        action="Logout",
        resource="User",
        resource_id=str(current_user.id),
        status="SUCCESS"
    )
    db.add(log_entry)
    db.commit()
    
    is_prod = settings.ENV == "production"
    if is_prod:
        response.delete_cookie(
            key="access_token",
            httponly=True,
            secure=True,
            samesite="lax"
        )
    return {
        "status": "ok",
        "message": "Logged out successfully"
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns information on currently authenticated identity.
    """
    role_name = current_user.role or "user"
    return UserResponse(
        id=current_user.id,
        name=current_user.name or "User",
        email=current_user.email,
        role=role_name,
        account_type=current_user.account_type,
        college_id=current_user.college_id,
        department=current_user.department,
        year=current_user.year,
        roll_number=current_user.roll_number,
        total_score=current_user.total_score
    )

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
def register(register_data: UserRegister, db: Session = Depends(get_db)):
    """
    Registers a new user on AWS RDS, generates OTP, stores in DB, and sends via SES.
    """
    existing_user = db.query(User).filter(User.email == register_data.email).first()
    if existing_user:
        raise AppError("Email already registered", status_code=status.HTTP_400_BAD_REQUEST)
        
    # Generate OTP
    otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
    logger.info("OTP generated")

    # Add User to session
    hashed_pw = get_password_hash(register_data.password)
    user = User(
        name=register_data.name,
        email=register_data.email,
        password_hash=hashed_pw,
        role="user",
        is_active=True,  # Active by default to support backward compatible login tests
        account_type=register_data.account_type,
        college_id=register_data.college_id if register_data.account_type == "STUDENT" else None,
        department=register_data.department if register_data.account_type == "STUDENT" else None,
        year=register_data.year if register_data.account_type == "STUDENT" else None,
        roll_number=register_data.roll_number if register_data.account_type == "STUDENT" else None
    )
    db.add(user)

    # Store OTP in database
    otp_record = OTPVerification(
        email=register_data.email,
        otp_code=otp_code,
        expires_at=datetime.utcnow() + timedelta(minutes=5)
    )
    db.add(otp_record)

    try:
        # Flush to check database constraints before attempting email send
        db.flush()
        
        # Write registration audit log
        log_entry = AuditLog(
            user_id=user.id,
            action="Registration",
            resource="User",
            resource_id=str(user.id),
            status="SUCCESS"
        )
        db.add(log_entry)
    except Exception as e:
        db.rollback()
        # Log Database Rollback
        rollback_log = AuditLog(
            action="Database Rollback",
            resource="User",
            status="FAILED",
            new_value=f"Registration database rollback: {str(e)}"
        )
        db.add(rollback_log)
        db.commit()
        logger.error(f"Database error during registration flush: {e}")
        raise AppError("Database error during registration.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Send OTP using Amazon SES
    logger.info("OTP email sending started")
    try:
        ses_service.send_otp_email(register_data.email, otp_code)
        logger.info("OTP sent successfully")
    except Exception as e:
        db.rollback()
        # Log Database Rollback
        rollback_log = AuditLog(
            action="Database Rollback",
            resource="User",
            status="FAILED",
            new_value=f"Registration rolled back due to SES failure: {str(e)}"
        )
        db.add(rollback_log)
        db.commit()
        logger.error(f"SES error: {e}")
        logger.info("Registration rollback")
        raise AppError(f"Registration failed: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    db.commit()
    db.refresh(user)
    # Notify platform administrators of a real registration event. SNS failures are
    # persisted as failed delivery audits and never fabricate a success response.
    admins = db.query(User).filter(User.is_active.is_(True), User.role.in_(["admin", "SYSTEM_ADMIN"])).all()
    notification_service.notify_users(db, admins, "New Student Registration",
                                      f"A new student account was registered: {user.email}", "STUDENT_REGISTRATION")
    db.commit()
    
    logger.info("Registration successful")
    return user

@router.post("/verify-otp")
def verify_otp(request_data: OTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Verifies the 6-digit OTP code, activates user, and delivers JWT token.
    """
    otp_rec = db.query(OTPVerification).filter(
        OTPVerification.email == request_data.email,
        OTPVerification.otp_code == request_data.otp_code
    ).first()
    
    if not otp_rec:
        log_entry = AuditLog(
            action="OTP Verification",
            resource="User",
            status="FAILED",
            new_value=f"Invalid OTP entered for email: {request_data.email}"
        )
        db.add(log_entry)
        db.commit()
        raise AppError("Invalid verification code.", status_code=status.HTTP_400_BAD_REQUEST)
        
    if otp_rec.expires_at < datetime.utcnow():
        db.delete(otp_rec)
        log_entry = AuditLog(
            action="OTP Verification",
            resource="User",
            status="FAILED",
            new_value=f"Expired OTP entered for email: {request_data.email}"
        )
        db.add(log_entry)
        db.commit()
        raise AppError("Verification code has expired. Please register again.", status_code=status.HTTP_400_BAD_REQUEST)
        
    user = db.query(User).filter(User.email == request_data.email).first()
    if user:
        user.is_active = True
        
    db.delete(otp_rec)
    
    # Write audit log
    log_entry = AuditLog(
        user_id=user.id if user else None,
        action="OTP Verification",
        resource="User",
        resource_id=str(user.id) if user else None,
        status="SUCCESS"
    )
    db.add(log_entry)
    db.commit()
    
    role_name = user.role if user else "user"
    token = create_access_token(data={"sub": user.email, "role": role_name})
    
    return {
        "success": True,
        "token": token,
        "role": role_name,
        "user": {
            "id": user.id if user else None,
            "name": user.name if user else "User",
            "email": user.email if user else "",
            "role": role_name
        }
    }

@router.post("/forgot-password")
def forgot_password(request_data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Initiates password recovery by generating a reset token and sending an email via Amazon SES.
    """
    logger.info(f"Forgot password requested: {request_data.email}")
    
    # 1. Verify user exists
    user = db.query(User).filter(User.email == request_data.email).first()
    if not user:
        log_entry = AuditLog(
            action="Forgot Password",
            resource="User",
            status="FAILED",
            new_value=f"Forgot password requested for non-existent email: {request_data.email}"
        )
        db.add(log_entry)
        db.commit()
        logger.error(f"User not found for forgot password email: {request_data.email}")
        raise AppError("No user registered with this email address.", status_code=status.HTTP_404_NOT_FOUND)

    # Log successful forgot password trigger
    log_entry = AuditLog(
        user_id=user.id,
        action="Forgot Password",
        resource="User",
        resource_id=str(user.id),
        status="SUCCESS",
        new_value=f"Recovery token generated for email {request_data.email}"
    )
    db.add(log_entry)

    # 2. Generate secure token
    token = secrets.token_urlsafe(32)
    logger.info("Reset token generated")
    
    # 3. Hash the token for storage (SHA-256)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # 4. Expiry is 15 minutes
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    
    # 5. Store in database
    reset_record = PasswordReset(
        email=request_data.email,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(reset_record)
    
    try:
        db.flush()
        logger.info("Token stored")
    except Exception as e:
        db.rollback()
        # Log database rollback
        rollback_log = AuditLog(
            action="Database Rollback",
            resource="User",
            status="FAILED",
            new_value=f"Forgot password database rollback: {str(e)}"
        )
        db.add(rollback_log)
        db.commit()
        logger.error(f"Database error storing reset token: {e}")
        logger.info("Rollback")
        raise AppError("A database error occurred. Please try again.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 6. Call SES service
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    logger.info("Calling SES")
    try:
        message_id = ses_service.send_reset_email(request_data.email, reset_url)
    except Exception as e:
        db.rollback()
        # Log database rollback
        rollback_log = AuditLog(
            action="Database Rollback",
            resource="User",
            status="FAILED",
            new_value=f"Forgot password rolled back due to SES failure: {str(e)}"
        )
        db.add(rollback_log)
        db.commit()
        logger.error(f"SES error: {e}")
        logger.info("Rollback")
        raise AppError(f"Email dispatch failed: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 7. Commit database transaction only after successful email send
    db.commit()
    logger.info("Email successfully sent")
    return {"success": True, "message": "Recovery email dispatched successfully."}

@router.post("/reset-password")
def reset_password(request_data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Resets the user's password using a valid reset token.
    """
    logger.info("Password reset requested")
    
    # 1. Compute SHA-256 hash of the input token
    token_hash = hashlib.sha256(request_data.token.encode()).hexdigest()
    
    # 2. Find matching reset record in database
    reset_record = db.query(PasswordReset).filter(PasswordReset.token_hash == token_hash).first()
    if not reset_record:
        log_entry = AuditLog(
            action="Password Reset",
            resource="User",
            status="FAILED",
            new_value=f"Reset attempt with invalid token: {request_data.token}"
        )
        db.add(log_entry)
        db.commit()
        logger.error("Invalid reset token provided")
        raise AppError("Invalid or expired reset token.", status_code=status.HTTP_400_BAD_REQUEST)
        
    # 3. Check expiry
    if reset_record.expires_at < datetime.utcnow():
        db.delete(reset_record)
        log_entry = AuditLog(
            action="Password Reset",
            resource="User",
            status="FAILED",
            new_value=f"Reset attempt with expired token: {request_data.token}"
        )
        db.add(log_entry)
        db.commit()
        logger.error(f"Reset token has expired at {reset_record.expires_at}")
        raise AppError("This reset link has expired. Please request a new one.", status_code=status.HTTP_400_BAD_REQUEST)
        
    # 4. Find user and update password
    user = db.query(User).filter(User.email == reset_record.email).first()
    if not user:
        db.delete(reset_record)
        log_entry = AuditLog(
            action="Password Reset",
            resource="User",
            status="FAILED",
            new_value=f"Reset token email '{reset_record.email}' has no matching user account"
        )
        db.add(log_entry)
        db.commit()
        logger.error(f"No user associated with reset token email: {reset_record.email}")
        raise AppError("User not found.", status_code=status.HTTP_404_NOT_FOUND)
        
    # 5. Hash new password and update user
    hashed_pw = get_password_hash(request_data.new_password)
    user.password_hash = hashed_pw
    
    # Log password changed
    log_entry = AuditLog(
        user_id=user.id,
        action="Password Changed",
        resource="User",
        resource_id=str(user.id),
        status="SUCCESS"
    )
    db.add(log_entry)
    
    # 6. Delete consumed token
    db.delete(reset_record)
    
    db.commit()
    logger.info(f"Password reset successful for user: {user.email}")
    return {"success": True, "message": "Password reset successfully."}
