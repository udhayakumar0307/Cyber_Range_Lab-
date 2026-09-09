import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Response, Request, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.auth import (
    UserLogin, UserResponse, UserRegister, ForgotPasswordRequest,
    ResetPasswordRequest, OTPVerifyRequest, RefreshTokenRequest, OAuthCallbackRequest,
    GoogleAuthRequest
)
from app.services.google_auth_service import google_auth_service
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
from app.security import (
    login_protection, password_validator, token_manager,
    create_refresh_token, oauth_manager, get_client_ip, get_user_agent
)

from app.security.domain_validator import (
    validate_student_login_attempt,
    validate_admin_login_attempt
)

logger = logging.getLogger(__name__)

router = APIRouter()

def _execute_login(
    request: Request,
    response: Response,
    login_data: UserLogin,
    portal: str,
    db: Session
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    email_clean = login_data.email.strip().lower() if login_data.email else ""
    logger.info(f"=> ENTERING LOGIN ENDPOINT for {email_clean} on portal '{portal}' from IP {client_ip}")

    # Local Development & QA Testing Bypass for @testcyberrange.in
    is_qa_bypass = email_clean.endswith("@testcyberrange.in") and settings.ENV == "development"
    if is_qa_bypass:
        logger.info(f"[AuthLog] Bypassing auth checks for test student: {email_clean}")
        # Generate temporary JWT/session
        token_payload = {
            "sub": email_clean,
            "user_id": -999, # Dummy ID matching deps.py
            "role": "student",
            "account_type": "academic",
            "is_internal": False,
            "tenant_id": "default",
            "portal_type": portal,
            "organization_id": "CyberRange QA"
        }
        token = create_access_token(data=token_payload)
        refresh_token = create_refresh_token(data=token_payload, remember_me=login_data.remember_me)
        return {
            "success": True,
            "token": token,
            "refresh_token": refresh_token,
            "role": "student",
            "account_type": "academic",
            "is_internal": False,
            "portal_type": portal,
            "user": {
                "id": -999,
                "name": "CyberRange Test Student",
                "email": email_clean,
                "phone": "Testing",
                "role": "student",
                "account_type": "academic",
                "is_internal": False,
                "auth_type": "SSO"
            }
        }

    # Enforce brute force / login protection
    login_protection.check_and_enforce_protection(email_clean, client_ip)

    existing_user = db.query(User).filter(User.email == email_clean).first()

    if not existing_user and portal == "student":
        from app.security.domain_validator import is_student_domain_allowed
        if is_student_domain_allowed(email_clean):
            # Personal email domains must not be auto-registered on login
            domain = email_clean.split("@")[-1] if "@" in email_clean else ""
            personal_patterns = ["gmail.com", "outlook.com", "yahoo.com", "proton.me", "icloud.com"]
            from app.security.domain_validator import match_domain_pattern
            if not match_domain_pattern(domain, personal_patterns):
                hashed_pw = get_password_hash(login_data.password)
                name_prefix = email_clean.split("@")[0]
                default_name = " ".join([p.capitalize() for p in name_prefix.replace(".", " ").replace("_", " ").split()])
                
                new_student = User(
                    name=default_name,
                    email=email_clean,
                    password_hash=hashed_pw,
                    role="user",
                    is_active=True,
                    account_type="academic",
                    email_verified=True,
                    auth_type="SSO"
                )
                db.add(new_student)
                db.commit()
                db.refresh(new_student)
                existing_user = new_student
                logger.info(f"Auto-registered new student via Academic SSO: {email_clean}")


    # Domain & Role Portal Validation BEFORE Password Inspection
    is_system_admin = existing_user and getattr(existing_user, "role", "").upper() in ["SYSTEM_ADMIN", "SUPER_ADMIN"]
    is_academic_admin = existing_user and getattr(existing_user, "role", "").lower() == "admin" and getattr(existing_user, "account_type", "").lower() == "academic"
    logger.info(f"[AuthLog] Login request email: {email_clean} | env_admin_email: {settings.SYSTEM_ADMIN_EMAIL} | is_system_admin: {is_system_admin} | is_academic_admin: {is_academic_admin}")

    if is_system_admin or is_academic_admin:
        logger.info(f"[AuthLog] Bypassing portal validations for admin: {email_clean}")
    elif portal == "admin":
        validate_admin_login_attempt(email_clean, existing_user)
    else:
        validate_student_login_attempt(email_clean, existing_user)

    user = user_service.authenticate_user(db, email_clean, login_data.password)
    if not user:
        login_protection.record_failed_attempt(email_clean, client_ip)
        log_entry = AuditLog(
            user_id=existing_user.id if existing_user else None,
            action="Login",
            resource="User",
            status="FAILED",
            new_value=f"Failed login attempt for email: {email_clean} | Portal: {portal} | IP: {client_ip} | UA: {user_agent}"
        )
        db.add(log_entry)
        db.commit()
        raise AuthenticationError("Invalid Email or Password")

    # Double-check existing authenticated user record against portal requirements
    is_authenticated_sys_admin = getattr(user, "role", "").upper() in ["SYSTEM_ADMIN", "SUPER_ADMIN"]
    is_authenticated_academic_admin = getattr(user, "role", "").lower() == "admin" and getattr(user, "account_type", "").lower() == "academic"
    logger.info(f"[AuthLog] User Authenticated successfully | role: {getattr(user, 'role', 'user')} | is_system_admin: {is_authenticated_sys_admin} | is_academic_admin: {is_authenticated_academic_admin}")
    
    if is_authenticated_sys_admin or is_authenticated_academic_admin:
        logger.info(f"[AuthLog] Bypassing secondary portal validations for admin user: {email_clean}")
    elif portal == "admin":
        validate_admin_login_attempt(email_clean, user)
    else:
        validate_student_login_attempt(email_clean, user)

    # Production MFA-OTP flow: every academic admin must verify a login OTP, regardless
    # of email domain or account_type. Excludes system_admin/super_admin: those log in
    # through the separate System Admin Portal (SystemPortal.tsx), which calls this same
    # /login endpoint directly and has no OTP-entry UI of its own.
    is_academic_admin_user = getattr(user, "role", "").lower() == "admin"

    # Enforce email verification check for non-cyberrange accounts (except admins, who verify via MFA login OTP)
    is_cyberrange_domain = email_clean.endswith("@cyberrange.in")
    email_verified_status = getattr(user, "email_verified", True)

    if not is_cyberrange_domain and not email_verified_status and not is_academic_admin_user:
        logger.warning(f"[AuthLog] Login rejected for unverified academic account: {email_clean}")
        raise AuthenticationError("Please verify your institutional email before logging in.")
    # Check if this request already includes the OTP verification code
    submitted_otp = getattr(login_data, "otp_code", None) or request.query_params.get("otp_code")

    if is_academic_admin_user and not settings.ACADEMIC_ADMIN_LOGIN_MFA_ENABLED:
        logger.warning(
            "[AuthLog] Academic admin login MFA is DISABLED by configuration for: %s",
            email_clean,
        )

    if is_academic_admin_user and settings.ACADEMIC_ADMIN_LOGIN_MFA_ENABLED:
        if not submitted_otp:
            # Generate new login OTP
            otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
            # Delete previous active login OTPs for this email to invalidate them
            db.query(OTPVerification).filter(OTPVerification.email == email_clean).delete()
            
            otp_record = OTPVerification(
                email=email_clean,
                otp_code=otp_code,
                expires_at=datetime.utcnow() + timedelta(minutes=5)
            )
            db.add(otp_record)
            db.commit()
            
            try:
                ses_service.send_otp_email(email_clean, otp_code)
                logger.info(f"[AuthLog] Login OTP sent to academic admin: {email_clean}")
            except Exception as e:
                logger.error(f"[AuthLog] Failed to send login OTP email: {e}")
                raise AppError("Failed to deliver verification code. Please try again.", status_code=500)
                
            return {
                "status": "otp_required",
                "message": "A security verification code has been sent to your institutional email.",
                "email": email_clean
            }
        else:
            # Verify the submitted OTP
            otp_rec = db.query(OTPVerification).filter(
                OTPVerification.email == email_clean,
                OTPVerification.otp_code == submitted_otp
            ).first()
            
            if not otp_rec:
                raise AuthenticationError("Invalid login verification code.")
            if otp_rec.expires_at < datetime.utcnow():
                db.delete(otp_rec)
                db.commit()
                raise AuthenticationError("Verification code has expired. Please try logging in again.")
                
            # Mark email as verified and user as active upon successful verification
            user.email_verified = True
            user.is_active = True

            # Invalidate/delete the used OTP
            db.delete(otp_rec)
            db.commit()

    login_protection.record_successful_login(email_clean, client_ip)
    logger.info("User authenticated")
    
    # Resolve student auth_type: SSO if institutional domain or academic account, otherwise INDIVIDUAL
    # Institutional domains match *.edu, *.ac.in, *.edu.in, college or university domains
    from app.security.domain_validator import extract_domain, match_domain_pattern
    domain = extract_domain(email_clean)
    is_sso = False
    if domain:
        sso_patterns = ["*.edu", "*.ac.in", "*.edu.in", "*college*", "*univ*"]
        is_sso = match_domain_pattern(domain, sso_patterns) or getattr(user, "account_type", "").lower() == "academic"
    else:
        is_sso = getattr(user, "account_type", "").lower() == "academic"
    
    user.auth_type = "SSO" if is_sso else "INDIVIDUAL"
    db.commit()

    role_name = user.role.lower() if user.role else "user"
    token_payload = {
        "sub": user.email,
        "user_id": user.id,
        "role": role_name,
        "account_type": getattr(user, "account_type", "student"),
        "is_internal": getattr(user, "is_internal", False),
        "tenant_id": getattr(user, "tenant_id", "default"),
        "portal_type": portal,
        "organization_id": getattr(user, "organization", "") or ""
    }
    
    token = create_access_token(data=token_payload)
    refresh_token = create_refresh_token(data=token_payload, remember_me=login_data.remember_me)
    token_manager.register_refresh_token(user.id, refresh_token, remember_me=login_data.remember_me)

    user.last_login = datetime.utcnow()
    
    # Log successful login
    log_entry = AuditLog(
        user_id=user.id,
        action="Login",
        resource="User",
        resource_id=str(user.id),
        status="SUCCESS",
        new_value=f"Login successful | Portal: {portal} | IP: {client_ip} | UA: {user_agent}"
    )
    db.add(log_entry)
    db.commit()
    
    is_prod = settings.ENV == "production"
    
    if is_prod:
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=1440 * 60
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=(30 if login_data.remember_me else 7) * 24 * 3600
        )
        
    return {
        "success": True,
        "token": token,
        "refresh_token": refresh_token,
        "role": role_name,
        "account_type": getattr(user, "account_type", "student"),
        "is_internal": getattr(user, "is_internal", False),
        "portal_type": portal,
        "user": {
            "id": user.id,
            "name": user.name or "User",
            "email": user.email,
            "phone": getattr(user, "phone", None),
            "role": role_name,
            "account_type": getattr(user, "account_type", "student"),
            "is_internal": getattr(user, "is_internal", False),
            "profile_completed": getattr(user, "profile_completed", False),
            "auth_type": getattr(user, "auth_type", "INDIVIDUAL")
        }
    }

@router.post("/login")
def login(request: Request, response: Response, login_data: UserLogin, db: Session = Depends(get_db)):
    portal = getattr(login_data, "portal", None) or request.query_params.get("portal", "student")
    return _execute_login(request, response, login_data, portal, db)

@router.post("/student-login")
def student_login(request: Request, response: Response, login_data: UserLogin, db: Session = Depends(get_db)):
    return _execute_login(request, response, login_data, "student", db)

@router.post("/admin-login")
def admin_login(request: Request, response: Response, login_data: UserLogin, db: Session = Depends(get_db)):
    return _execute_login(request, response, login_data, "admin", db)

@router.post("/google")
def google_auth(
    request: Request,
    response: Response,
    body: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    """
    Google Identity Services OAuth Authentication Endpoint.
    Verifies ID Token via Google public keys, enforces domain & portal security rules,
    links existing accounts or auto-creates new users, and returns authenticated session tokens.
    """
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    portal_clean = (body.portal or "student").lower()

    logger.info(f"=> ENTERING GOOGLE OAUTH ENDPOINT for portal '{portal_clean}' from IP {client_ip}")

    # 1. Verify ID Token server-side
    google_info = google_auth_service.verify_google_id_token(body.credential)

    # 2. Authenticate user, link account or auto-create, enforce domain isolation
    user = google_auth_service.authenticate_or_create_google_user(db, google_info, portal=portal_clean)

    role_name = user.role.lower() if user.role else "user"
    token_payload = {
        "sub": user.email,
        "user_id": user.id,
        "role": role_name,
        "account_type": getattr(user, "account_type", "student"),
        "is_internal": getattr(user, "is_internal", False),
        "tenant_id": getattr(user, "tenant_id", "default"),
        "portal_type": portal_clean,
        "organization_id": getattr(user, "organization", "") or ""
    }

    token = create_access_token(data=token_payload)
    refresh_token = create_refresh_token(data=token_payload, remember_me=True)
    token_manager.register_refresh_token(user.id, refresh_token, remember_me=True)

    # Log successful audit entry
    log_entry = AuditLog(
        user_id=user.id,
        action="Google Login Success",
        resource="User",
        resource_id=str(user.id),
        status="SUCCESS",
        new_value=f"Google OAuth Login successful | Email: {user.email} | Portal: {portal_clean} | IP: {client_ip} | UA: {user_agent}"
    )
    db.add(log_entry)
    db.commit()

    is_prod = settings.ENV == "production"
    if is_prod:
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=1440 * 60
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=30 * 24 * 3600
        )

    return {
        "success": True,
        "token": token,
        "access_token": token,
        "refresh_token": refresh_token,
        "role": role_name,
        "account_type": getattr(user, "account_type", "student"),
        "is_internal": getattr(user, "is_internal", False),
        "portal_type": portal_clean,
        "user": {
            "id": user.id,
            "name": user.name or "User",
            "full_name": user.name or "User",
            "email": user.email,
            "phone": getattr(user, "phone", None),
            "role": role_name,
            "account_type": getattr(user, "account_type", "student"),
            "is_internal": getattr(user, "is_internal", False),
            "google_id": getattr(user, "google_id", None),
            "provider": getattr(user, "provider", "google"),
            "profile_picture": getattr(user, "profile_photo", None),
            "profile_completed": getattr(user, "profile_completed", False),
            "auth_type": getattr(user, "auth_type", "INDIVIDUAL")
        }
    }

@router.post("/refresh")
def refresh_token_endpoint(request: Request, response: Response, refresh_data: RefreshTokenRequest = None):
    ref_token = None
    if refresh_data and refresh_data.refresh_token:
        ref_token = refresh_data.refresh_token
    if not ref_token:
        ref_token = request.cookies.get("refresh_token")
    if not ref_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            ref_token = auth_header.split(" ")[1]

    if not ref_token:
        raise AuthenticationError("Refresh token missing")

    rotated = token_manager.rotate_refresh_token(ref_token)
    if not rotated:
        raise AuthenticationError("Invalid or revoked refresh token")

    if settings.ENV == "production":
        response.set_cookie(
            key="access_token",
            value=rotated["access_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=1440 * 60
        )
        response.set_cookie(
            key="refresh_token",
            value=rotated["refresh_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=7 * 24 * 3600
        )

    return {
        "success": True,
        "token": rotated["access_token"],
        "refresh_token": rotated["refresh_token"],
        "role": rotated["role"]
    }

@router.post("/logout")
def logout(request: Request, response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    # Extract token and revoke it
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token_manager.revoke_token(auth_header.split(" ")[1], user_id=current_user.id)
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        token_manager.revoke_token(cookie_token, user_id=current_user.id)

    log_entry = AuditLog(
        user_id=current_user.id,
        action="Logout",
        resource="User",
        resource_id=str(current_user.id),
        status="SUCCESS",
        new_value=f"Logout successful | IP: {client_ip} | UA: {user_agent}"
    )
    db.add(log_entry)
    db.commit()
    
    # Always clear cookies — in development the stale admin cookie would otherwise
    # persist and collide with the next user's session.
    response.delete_cookie(key="access_token", httponly=True, samesite="lax")
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax")

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
        profile_completed=getattr(current_user, "profile_completed", False),
        college_id=current_user.college_id,
        department=current_user.department,
        year=current_user.year,
        roll_number=current_user.roll_number,
        total_score=current_user.total_score,
        auth_type=getattr(current_user, "auth_type", "INDIVIDUAL")
    )

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
def register(register_data: UserRegister, db: Session = Depends(get_db)):
    """
    Registers a new user on AWS RDS, generates OTP, stores in DB, and sends via SES.
    Academic / College Student registration requires academic domain verification.
    """
    password_validator.validate_or_raise(
        register_data.password,
        email=register_data.email,
        username=register_data.name
    )

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
        phone=register_data.phone,
        role="user",
        is_active=True,  # Active by default to support backward compatible login tests
        account_type="student",
        department=register_data.department,
        year=register_data.year,
        roll_number=register_data.roll_number
    )
    db.add(user)
    db.flush()  # flush to generate user.id

    # Create primary affiliation
    from app.models.user_affiliation import UserAffiliation
    from app.models.admin_models import Organization
    from app.models.college import College

    if register_data.primary_affiliation_type == "college":
        if register_data.college_id:
            user.college_id = register_data.college_id
            aff = UserAffiliation(
                user_id=user.id,
                affiliation_type="college",
                college_id=register_data.college_id,
                is_primary=True
            )
            db.add(aff)
    elif register_data.primary_affiliation_type == "organization":
        if register_data.organization_name and register_data.organization_name.strip():
            org_name = register_data.organization_name.strip()
            org = db.query(Organization).filter(Organization.name.ilike(org_name)).first()
            if not org:
                org = Organization(name=org_name, institution_type="Company", status="PENDING")
                db.add(org)
                db.flush()
            aff = UserAffiliation(
                user_id=user.id,
                affiliation_type="organization",
                organization_id=org.id,
                is_primary=True
            )
            db.add(aff)

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
        # Log the full AWS error server-side only — it can contain account IDs,
        # IAM role ARNs, and other infra details that must never reach the client.
        logger.error(f"SES error: {e}")
        logger.info("Registration rollback")
        raise AppError(
            "We couldn't send your verification email right now. Please try again in a few minutes.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
        
    db.commit()
    db.refresh(user)
    # Notify platform administrators of a real registration event. SNS failures are
    # persisted as failed delivery audits and never fabricate a success response.
    admins = db.query(User).filter(User.is_active.is_(True), User.role.in_(["admin", "SYSTEM_ADMIN", "SUPER_ADMIN", "super_admin"])).all()
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
        user.email_verified = True
        
    db.delete(otp_rec)
    
    # Send account created success notification email
    if user:
        try:
            from app.services.ses_service import ses_service
            ses_service.send_account_created_email(
                email=user.email,
                name=user.name or user.email,
                role=user.role or "user"
            )
        except Exception as mail_err:
            logger.error(f"Account creation email failed for {user.email}: {mail_err}")
            
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
        # Log the full AWS error server-side only — never echo it to the client.
        logger.error(f"SES error: {e}")
        logger.info("Rollback")
        raise AppError(
            "We couldn't send the recovery email right now. Please try again in a few minutes.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # 7. Commit database transaction only after successful email send
    db.commit()
    logger.info("Email successfully sent")

    # 8. Generate and email a login-style OTP: reset-password now also requires MFA,
    # not just possession of the reset link, for both student and admin accounts.
    otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
    db.query(OTPVerification).filter(OTPVerification.email == request_data.email).delete()
    db.add(OTPVerification(
        email=request_data.email,
        otp_code=otp_code,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    ))
    db.commit()
    try:
        ses_service.send_otp_email(request_data.email, otp_code)
    except Exception as e:
        logger.error(f"Failed to send password-reset OTP email: {e}")

    return {"success": True, "message": "Recovery email dispatched successfully."}

@router.post("/reset-password")
def reset_password(request_data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Resets the user's password using a valid reset token.
    """
    logger.info("Password reset requested")
    password_validator.validate_or_raise(request_data.new_password)
    
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

    # 4b. MFA: require the OTP emailed alongside the reset link, not just the link itself.
    otp_rec = db.query(OTPVerification).filter(
        OTPVerification.email == reset_record.email,
        OTPVerification.otp_code == request_data.otp_code,
    ).first()
    if not otp_rec:
        log_entry = AuditLog(
            user_id=user.id,
            action="Password Reset",
            resource="User",
            resource_id=str(user.id),
            status="FAILED",
            new_value="Reset attempt with invalid MFA verification code"
        )
        db.add(log_entry)
        db.commit()
        raise AppError("Invalid verification code.", status_code=status.HTTP_400_BAD_REQUEST)
    if otp_rec.expires_at < datetime.utcnow():
        db.delete(otp_rec)
        log_entry = AuditLog(
            user_id=user.id,
            action="Password Reset",
            resource="User",
            resource_id=str(user.id),
            status="FAILED",
            new_value="Reset attempt with expired MFA verification code"
        )
        db.add(log_entry)
        db.commit()
        raise AppError("Verification code has expired. Please request a new reset link.", status_code=status.HTTP_400_BAD_REQUEST)
    db.delete(otp_rec)

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

# --------------------------
# OAuth 2.0 Endpoints
# --------------------------

@router.get("/oauth/google")
def get_google_auth_url(role: str = "student"):
    url = oauth_manager.get_google_auth_url(role=role)
    return {"url": url}

@router.get("/oauth/github")
def get_github_auth_url(role: str = "student"):
    url = oauth_manager.get_github_auth_url(role=role)
    return {"url": url}

@router.post("/oauth/callback/google")
def google_oauth_callback(
    request: Request,
    response: Response,
    payload: OAuthCallbackRequest,
    db: Session = Depends(get_db)
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    if payload.state:
        state_data = oauth_manager.verify_state(payload.state)
        if not state_data:
            raise AppError("Invalid or expired OAuth state token.", status_code=status.HTTP_400_BAD_REQUEST)
        target_role = state_data.get("role", payload.role or "student")
    else:
        target_role = payload.role or "student"

    oauth_info = oauth_manager.exchange_google_code(payload.code)
    email = oauth_info.get("email")
    if not email:
        raise AppError("Google account does not provide a valid email address.", status_code=status.HTTP_400_BAD_REQUEST)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Create user via OAuth registration
        role_str = "admin" if target_role and target_role.lower() in ("admin", "professor", "system_admin") else "user"
        random_pw = secrets.token_urlsafe(24) + "A1!"
        user = User(
            name=oauth_info.get("name", "Google User"),
            email=email,
            password_hash=get_password_hash(random_pw),
            role=role_str,
            is_active=True,
            profile_photo=oauth_info.get("picture")
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    role_name = user.role.lower() if user.role else "user"
    token_payload = {
        "sub": user.email,
        "user_id": user.id,
        "role": role_name,
        "organization_id": user.organization or ""
    }
    token = create_access_token(data=token_payload)
    refresh_token = create_refresh_token(data=token_payload)
    token_manager.register_refresh_token(user.id, refresh_token)

    log_entry = AuditLog(
        user_id=user.id,
        action="Google Login",
        resource="User",
        resource_id=str(user.id),
        status="SUCCESS",
        new_value=f"Google OAuth login successful | IP: {client_ip} | UA: {user_agent}"
    )
    db.add(log_entry)
    db.commit()

    return {
        "success": True,
        "token": token,
        "refresh_token": refresh_token,
        "role": role_name,
        "user": {
            "id": user.id,
            "name": user.name or "User",
            "email": user.email,
            "role": role_name
        }
    }

@router.post("/oauth/callback/github")
def github_oauth_callback(
    request: Request,
    response: Response,
    payload: OAuthCallbackRequest,
    db: Session = Depends(get_db)
):
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    if payload.state:
        state_data = oauth_manager.verify_state(payload.state)
        if not state_data:
            raise AppError("Invalid or expired OAuth state token.", status_code=status.HTTP_400_BAD_REQUEST)
        target_role = state_data.get("role", payload.role or "student")
    else:
        target_role = payload.role or "student"

    oauth_info = oauth_manager.exchange_github_code(payload.code)
    email = oauth_info.get("email")
    if not email:
        raise AppError("GitHub account does not provide a verified email address.", status_code=status.HTTP_400_BAD_REQUEST)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        role_str = "admin" if target_role and target_role.lower() in ("admin", "professor", "system_admin") else "user"
        random_pw = secrets.token_urlsafe(24) + "A1!"
        user = User(
            name=oauth_info.get("name", "GitHub User"),
            email=email,
            password_hash=get_password_hash(random_pw),
            role=role_str,
            is_active=True,
            profile_photo=oauth_info.get("picture")
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    role_name = user.role.lower() if user.role else "user"
    token_payload = {
        "sub": user.email,
        "user_id": user.id,
        "role": role_name,
        "organization_id": user.organization or ""
    }
    token = create_access_token(data=token_payload)
    refresh_token = create_refresh_token(data=token_payload)
    token_manager.register_refresh_token(user.id, refresh_token)

    log_entry = AuditLog(
        user_id=user.id,
        action="GitHub Login",
        resource="User",
        resource_id=str(user.id),
        status="SUCCESS",
        new_value=f"GitHub OAuth login successful | IP: {client_ip} | UA: {user_agent}"
    )
    db.add(log_entry)
    db.commit()

    return {
        "success": True,
        "token": token,
        "refresh_token": refresh_token,
        "role": role_name,
        "user": {
            "id": user.id,
            "name": user.name or "User",
            "email": user.email,
            "role": role_name
        }
    }

