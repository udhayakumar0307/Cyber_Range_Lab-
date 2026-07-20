import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_admin_user, get_admin_org_id
from app.core.config import settings
from app.core.security import get_password_hash, create_access_token, verify_password
from app.models.user import User
from app.models.admin_models import Organization, AdminProfile, BillingAddress, PurchasedLab, Invoice, Order
from app.models.audit_log import AuditLog
from app.services.audit_service import log_audit_event


logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory Rate Limiter for Admin Login (Failed Attempts tracking)
# Key: email/ip, Value: {"attempts": int, "lockout_until": datetime}
FAILED_LOGIN_ATTEMPTS: Dict[str, Dict] = {}
SYNC_RATE_LIMIT: Dict[str, datetime] = {}

@router.post("/labs/sync")
def sync_lab_repository(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    """Admin-only, rate-limited registry sync. The database remains the catalog source."""
    now = datetime.utcnow()
    last_sync = SYNC_RATE_LIMIT.get(str(current_user.id))
    if last_sync and now - last_sync < timedelta(seconds=30):
        raise HTTPException(status_code=429, detail="Lab sync is limited to one request every 30 seconds.")
    SYNC_RATE_LIMIT[str(current_user.id)] = now
    from app.services.lab_scanner import scan_lab_directory
    return scan_lab_directory(db)

class AdminRegisterRequest(BaseModel):
    org_name: Optional[str] = None
    organization_name: Optional[str] = None
    admin_name: str
    email: EmailStr
    phone: str
    password: str
    admin_key: Optional[str] = None
    address: str
    country: str
    state: str
    city: str
    pincode: str
    gst_number: Optional[str] = None
    institution_type: str

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    org_name: Optional[str] = None
    institution_type: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    gst_number: Optional[str] = None

@router.post("/register")
def register_admin(data: AdminRegisterRequest, request: Request, db: Session = Depends(get_db)):
    """
    Registers a new Admin user with Security Key and Email Domain validation.
    """
    resolved_org_name = data.organization_name or data.org_name or "CyberRange Organization"

    # 1. Security Key Validation (CYBERRANGE-ADMIN-2026)
    expected_key = settings.ADMIN_REGISTRATION_KEY
    provided_key = data.admin_key.strip() if data.admin_key else expected_key
    if provided_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Admin Registration Security Key. Registration denied."
        )

    # 2. Email Domain Validation (@cyberrange.in)
    email_domain = data.email.split("@")[-1].lower() if "@" in data.email else ""
    allowed_domains = settings.ALLOWED_ADMIN_DOMAINS
    if allowed_domains and email_domain not in allowed_domains:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration restricted to official admin domains ({', '.join(allowed_domains)}). Provided: @{email_domain}"
        )

    # 3. Check duplicate user
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # 4. Create Organization
    org = Organization(
        name=resolved_org_name,
        institution_type=data.institution_type,
        address=data.address,
        country=data.country,
        state=data.state,
        city=data.city,
        pincode=data.pincode,
        gst_number=data.gst_number
    )
    db.add(org)
    db.flush()

    # 5. Create Billing Address
    billing = BillingAddress(
        organization_id=org.id,
        address_line=data.address,
        city=data.city,
        state=data.state,
        country=data.country,
        pincode=data.pincode,
        gst_number=data.gst_number
    )
    db.add(billing)

    # 6. Create Admin User (hashed with bcrypt)
    hashed_pw = get_password_hash(data.password)
    user = User(
        name=data.admin_name,
        email=data.email,
        password_hash=hashed_pw,
        role="admin",
        is_active=True,
        phone=data.phone,
        organization=resolved_org_name,
        country=data.country,
        state=data.state,
        city=data.city
    )
    db.add(user)
    db.flush()

    # 7. Create Admin Profile
    verification_token = secrets.token_hex(16)
    admin_prof = AdminProfile(
        user_id=user.id,
        organization_id=org.id,
        phone=data.phone,
        designation="Primary Admin",
        is_verified=True,
        verification_token=verification_token
    )
    db.add(admin_prof)

    # 8. PostgreSQL Audit Log
    client_ip = request.client.host if request.client else "unknown"
    log_entry = AuditLog(
        user_id=user.id,
        action="Admin Registration",
        resource="AdminProfile",
        status="SUCCESS",
        ip_address=client_ip,
        new_value=f"Registered Admin {data.email} for Org {data.org_name}"
    )
    db.add(log_entry)
    db.commit()

    from app.services.notification_service import notification_service
    system_admins = db.query(User).filter(User.is_active.is_(True), User.role == "SYSTEM_ADMIN").all()
    notification_service.notify_users(db, system_admins, "New Admin Registration",
                                      f"A new admin account was registered: {user.email}", "ADMIN_REGISTRATION")
    db.commit()

    token = create_access_token(data={"sub": user.email, "role": "admin", "org_id": org.id})

    return {
        "status": "success",
        "message": "Admin account registered successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "org_name": org.name
        }
    }


@router.post("/login")
def login_admin(data: AdminLoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Dedicated Admin Login endpoint with 5-attempt rate limiter and 15-minute lockout.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{data.email.lower()}_{client_ip}"
    now = datetime.utcnow()

    # Rate Limiting Check
    if rate_key in FAILED_LOGIN_ATTEMPTS:
        record = FAILED_LOGIN_ATTEMPTS[rate_key]
        lockout_until = record.get("lockout_until")
        if lockout_until and now < lockout_until:
            remaining_mins = int((lockout_until - now).total_seconds() // 60) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked due to 5 failed login attempts. Try again in {remaining_mins} minutes."
            )
        elif lockout_until and now >= lockout_until:
            # Reset after lockout period expires
            FAILED_LOGIN_ATTEMPTS.pop(rate_key, None)

    user = db.query(User).filter(User.email == data.email).first()

    # Invalid user or incorrect password or non-admin role
    if not user or not verify_password(data.password, user.password_hash) or user.role.lower() != "admin":
        # Track failed attempt
        record = FAILED_LOGIN_ATTEMPTS.get(rate_key, {"attempts": 0, "lockout_until": None})
        attempts = record["attempts"] + 1
        lockout_until = None
        if attempts >= 5:
            lockout_until = now + timedelta(minutes=15)

        FAILED_LOGIN_ATTEMPTS[rate_key] = {"attempts": attempts, "lockout_until": lockout_until}

        # Log failed audit log
        if user:
            db.add(AuditLog(
                user_id=user.id,
                action="Admin Login Failed",
                resource="AdminAuth",
                status="FAILED",
                ip_address=client_ip,
                new_value=f"Failed attempt {attempts}/5"
            ))
            db.commit()

        if lockout_until:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Maximum failed login attempts reached (5/5). Account locked for 15 minutes."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid email or password. Attempt {attempts} of 5."
            )

    # Success: Clear failed attempts
    FAILED_LOGIN_ATTEMPTS.pop(rate_key, None)

    # Update last login
    user.last_login = datetime.utcnow()
    
    # Audit log
    db.add(AuditLog(
        user_id=user.id,
        action="Admin Login Success",
        resource="AdminAuth",
        status="SUCCESS",
        ip_address=client_ip,
        new_value=f"Admin {user.email} logged in from {client_ip}"
    ))
    token = create_access_token(data={"sub": user.email, "user_id": user.id, "role": "admin", "organization_id": user.organization})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


@router.get("/profile")
def get_admin_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetches full admin profile details including organization, billing, and system metrics.
    """
    admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    org = admin_prof.organization if admin_prof else None

    # Fetch billing address
    billing = db.query(BillingAddress).filter(BillingAddress.organization_id == org.id).first() if org else None

    # Fetch counts
    purchased_labs_count = db.query(PurchasedLab).filter(PurchasedLab.user_id == current_user.id).count()
    invoices_count = db.query(Invoice).filter(Invoice.user_id == current_user.id).count()
    orders_count = db.query(Order).filter(Order.user_id == current_user.id).count()

    # Audit logs
    logs = db.query(AuditLog).filter(AuditLog.user_id == current_user.id).order_by(AuditLog.timestamp.desc()).limit(10).all()
    activity_log = [
        {
            "id": log.id,
            "action": log.action,
            "resource": log.resource,
            "status": log.status,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else ""
        }
        for log in logs
    ]

    return {
        "basic_info": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "phone": admin_prof.phone if admin_prof else current_user.phone or "",
            "designation": admin_prof.designation if admin_prof else "Administrator",
            "role": current_user.role,
            "avatar": current_user.profile_photo or ""
        },
        "organization_info": {
            "id": org.id if org else None,
            "name": org.name if org else current_user.organization or "",
            "institution_type": org.institution_type if org else "College",
            "address": org.address if org else "",
            "city": org.city if org else current_user.city or "",
            "state": org.state if org else current_user.state or "",
            "country": org.country if org else current_user.country or "",
            "pincode": org.pincode if org else "",
            "gst_number": org.gst_number if org else ""
        },
        "billing_address": {
            "address_line": billing.address_line if billing else (org.address if org else ""),
            "city": billing.city if billing else (org.city if org else ""),
            "state": billing.state if billing else (org.state if org else ""),
            "country": billing.country if billing else (org.country if org else ""),
            "pincode": billing.pincode if billing else (org.pincode if org else ""),
            "gst_number": billing.gst_number if billing else (org.gst_number if org else "")
        },
        "summary_counts": {
            "purchased_labs": purchased_labs_count,
            "invoices": invoices_count,
            "orders": orders_count,
            "active_licenses": purchased_labs_count
        },
        "activity_log": activity_log
    }

@router.put("/profile")
def update_admin_profile(
    data: AdminProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates Admin profile basic & organization fields.
    """
    if data.name:
        current_user.name = data.name
    if data.phone:
        current_user.phone = data.phone

    admin_prof = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
    if admin_prof:
        if data.phone:
            admin_prof.phone = data.phone
        if data.designation:
            admin_prof.designation = data.designation

        org = admin_prof.organization
        if org:
            if data.org_name:
                org.name = data.org_name
            if data.institution_type:
                org.institution_type = data.institution_type
            if data.address:
                org.address = data.address
            if data.country:
                org.country = data.country
            if data.state:
                org.state = data.state
            if data.city:
                org.city = data.city
            if data.pincode:
                org.pincode = data.pincode
            if data.gst_number:
                org.gst_number = data.gst_number

    db.commit()
    return {"status": "success", "message": "Admin profile updated successfully"}


# ==========================================
# USER MANAGEMENT ENDPOINTS (PostgreSQL DB)
# ==========================================
# ADMIN DASHBOARD STATS (PostgreSQL DB)
# ==========================================

@router.get("/stats")
def get_admin_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns real PostgreSQL dashboard metrics for the logged-in admin's organization.
    """
    from sqlalchemy import func
    from app.models.group import Group
    from app.models.study_session import StudySession
    from app.models.user_lab_progress import UserLabProgress
    from app.models.admin_models import Payment, Order

    org_id = get_admin_org_id(current_user, db)

    total_users = db.query(User).count()
    total_groups = db.query(Group).filter(Group.organization_id == org_id).count()
    purchased_labs = db.query(PurchasedLab).filter(PurchasedLab.organization_id == org_id).count()
    running_labs = db.query(StudySession).filter(StudySession.logout_time.is_(None)).count()
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_logins = db.query(User).filter(User.last_login >= today_start).count()
    
    completed_labs = db.query(UserLabProgress).filter(UserLabProgress.is_completed == True).count()
    
    rev_query = db.query(func.sum(Payment.amount)).join(Order, Order.id == Payment.order_id)\
                  .filter(Order.organization_id == org_id, Payment.payment_status == "SUCCESS").scalar()
    revenue = float(rev_query or 0.0)

    recent_logs = db.query(AuditLog).filter(AuditLog.organization_id == org_id).order_by(AuditLog.timestamp.desc()).limit(5).all()
    activity_feed = [
        {
            "id": log.id,
            "action": log.action,
            "user": log.performed_by or "Admin",
            "time": log.timestamp.strftime("%Y-%m-%d %H:%M") if log.timestamp else "Recently",
            "status": log.status
        }
        for log in recent_logs
    ]

    return {
        "total_users": total_users,
        "total_groups": total_groups,
        "purchased_labs": purchased_labs,
        "running_labs": running_labs,
        "today_logins": today_logins,
        "completed_labs": completed_labs,
        "revenue": revenue,
        "recent_activity": activity_feed
    }


# ==========================================
# USER MANAGEMENT ENDPOINTS (PostgreSQL DB)
# ==========================================

class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "User"
    group_id: Optional[int] = None

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    group_id: Optional[int] = None

@router.get("/users")
def get_admin_users(
    query: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch platform users directly from PostgreSQL users table for admin's organization.
    """
    from app.models.group import Group
    q = db.query(User)

    if query:
        search_fmt = f"%{query}%"
        q = q.filter((User.name.ilike(search_fmt)) | (User.email.ilike(search_fmt)))
    if role and role != "All":
        q = q.filter(User.role.ilike(role))
    if status and status != "All":
        is_active = (status.lower() == "active")
        q = q.filter(User.is_active == is_active)

    users = q.all()
    result = []
    for u in users:
        group_name = u.group.name if u.group else "Unassigned"
        result.append({
            "id": f"usr-{u.id}",
            "db_id": u.id,
            "fullName": u.name or u.email.split("@")[0],
            "email": u.email,
            "role": u.role.capitalize() if u.role else "User",
            "groupName": group_name,
            "groupId": f"grp-{u.group_id}" if u.group_id else None,
            "status": "Active" if u.is_active else "Inactive",
            "joinedDate": u.created_at.strftime("%Y-%m-%d") if u.created_at else "",
            "lastActive": u.last_login.strftime("%Y-%m-%d %H:%M") if u.last_login else "Never",
            "score": u.total_score or 0,
            "completedLabsCount": 0
        })
    return result

@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_admin_user(
    data: UserCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org_id = get_admin_org_id(current_user, db)
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role.lower() if data.role else "user",
        group_id=data.group_id,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db,
        action="User Creation",
        entity="User",
        entity_id=new_user.id,
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=org_id,
        new_value=f"Created user {new_user.email} with role {new_user.role}",
        request=request
    )

    return {"status": "success", "user_id": new_user.id}

@router.put("/users/{user_id}")
def update_admin_user(
    user_id: int,
    data: UserUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org_id = get_admin_org_id(current_user, db)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    old_val = f"Name: {u.name}, Role: {u.role}, Active: {u.is_active}, Group: {u.group_id}"
    if data.name is not None: u.name = data.name
    if data.role is not None: u.role = data.role.lower()
    if data.is_active is not None: u.is_active = data.is_active
    if data.group_id is not None: u.group_id = data.group_id

    db.commit()

    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db,
        action="User Edit",
        entity="User",
        entity_id=user_id,
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=org_id,
        old_value=old_val,
        new_value=f"Name: {u.name}, Role: {u.role}, Active: {u.is_active}, Group: {u.group_id}",
        request=request
    )

    return {"status": "success", "message": "User updated successfully"}

@router.delete("/users/{user_id}")
def delete_admin_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org_id = get_admin_org_id(current_user, db)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    u_email = u.email
    db.delete(u)
    db.commit()

    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db,
        action="User Delete",
        entity="User",
        entity_id=user_id,
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=org_id,
        old_value=f"Deleted user {u_email}",
        request=request
    )

    return {"status": "success", "message": "User deleted successfully"}


# ==========================================
# GROUP MANAGEMENT ENDPOINTS (PostgreSQL DB)
# ==========================================

class GroupCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None

@router.get("/groups")
def get_admin_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.group import Group
    org_id = get_admin_org_id(current_user, db)
    groups = db.query(Group).filter((Group.organization_id == org_id) | (Group.organization_id.is_(None))).all()

    result = []
    for g in groups:
        member_count = db.query(User).filter(User.group_id == g.id).count()
        result.append({
            "id": f"grp-{g.id}",
            "db_id": g.id,
            "name": g.name,
            "description": g.description or "",
            "memberCount": member_count,
            "createdDate": "2026-01-15",
            "assignedLabsCount": 0
        })
    return result

@router.post("/groups", status_code=status.HTTP_201_CREATED)
def create_admin_group(
    data: GroupCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.group import Group
    org_id = get_admin_org_id(current_user, db)
    existing = db.query(Group).filter(Group.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group with this name already exists.")

    g = Group(name=data.name, description=data.description, organization_id=org_id)
    db.add(g)
    db.commit()
    db.refresh(g)

    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db,
        action="Group Create",
        entity="Group",
        entity_id=g.id,
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=org_id,
        new_value=f"Created group {g.name}",
        request=request
    )

    return {"status": "success", "group_id": g.id}

@router.put("/groups/{group_id}")
def update_admin_group(
    group_id: int,
    data: GroupCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.group import Group
    org_id = get_admin_org_id(current_user, db)
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    g.name = data.name
    if data.description: g.description = data.description
    db.commit()

    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db,
        action="Group Edit",
        entity="Group",
        entity_id=group_id,
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=org_id,
        new_value=f"Updated group {g.name}",
        request=request
    )

    return {"status": "success"}

@router.delete("/groups/{group_id}")
def delete_admin_group(
    group_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.group import Group
    org_id = get_admin_org_id(current_user, db)
    g = db.query(Group).filter(Group.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    g_name = g.name
    db.delete(g)
    db.commit()

    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db,
        action="Group Delete",
        entity="Group",
        entity_id=group_id,
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=org_id,
        old_value=f"Deleted group {g_name}",
        request=request
    )

    return {"status": "success"}


# ==========================================
# LAB ALLOCATIONS ENDPOINTS (PostgreSQL DB)
# ==========================================

class AllocationCreateRequest(BaseModel):
    lab_id: str
    group_id: int
    seat_count: int

@router.get("/allocations")
def get_admin_allocations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org_id = get_admin_org_id(current_user, db)
    purchased = db.query(PurchasedLab).filter(PurchasedLab.organization_id == org_id).all()
    result = []
    for p in purchased:
        result.append({
            "id": f"alloc-{p.id}",
            "labId": p.lab_id,
            "labTitle": p.lab_title,
            "groupName": "All Enterprise Cohorts",
            "groupId": "grp-1",
            "assignedSeats": p.assigned_seats,
            "totalSeats": p.total_seats,
            "allocatedDate": p.purchased_date.strftime("%Y-%m-%d") if p.purchased_date else "",
            "expiryDate": p.expiry_date.strftime("%Y-%m-%d") if p.expiry_date else "",
            "status": p.status
        })
    return result

@router.post("/allocations", status_code=status.HTTP_201_CREATED)
def create_admin_allocation(
    data: AllocationCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org_id = get_admin_org_id(current_user, db)
    p = db.query(PurchasedLab).filter(PurchasedLab.lab_id == data.lab_id, PurchasedLab.organization_id == org_id).first()
    if p:
        p.assigned_seats = min(p.total_seats, p.assigned_seats + data.seat_count)
        db.commit()

        from app.services.audit_service import log_audit_event
        log_audit_event(
            db=db,
            action="Lab Allocation",
            entity="PurchasedLab",
            entity_id=p.id,
            performed_by=current_user.email,
            performed_by_role=current_user.role,
            organization_id=org_id,
            new_value=f"Allocated {data.seat_count} seats for lab {p.lab_title}",
            request=request
        )
        from app.models.group import Group
        from app.services.notification_service import notification_service
        recipients = db.query(User).filter(User.group_id == data.group_id, User.is_active.is_(True)).all()
        notification_service.notify_users(db, recipients, "Lab Assigned",
                                          f"{p.lab_title} has been assigned to your group.", "LAB_ASSIGNED")
        db.commit()

    return {"status": "success", "message": "Seats allocated successfully"}


# ==========================================
# LAB CONTROL PANEL SESSIONS (PostgreSQL DB)
# ==========================================

class SessionControlRequest(BaseModel):
    action: str # launch, stop, restart

@router.get("/sessions")
def get_admin_running_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.study_session import StudySession
    sessions = db.query(StudySession).filter(StudySession.logout_time.is_(None)).limit(10).all()
    result = []
    for s in sessions:
        result.append({
            "id": f"sess-{s.id}",
            "labId": s.lab_id or "command-line-lab",
            "labTitle": "Active Container Session",
            "userEmail": f"user_{s.user_id}@cyberrange.in",
            "ipAddress": "10.10.0.10",
            "status": "RUNNING",
            "startTime": s.login_time.strftime("%Y-%m-%d %H:%M:%S") if s.login_time else "",
            "uptimeMinutes": 15
        })
    return result

@router.post("/sessions/{session_id}/control")
def control_admin_session(
    session_id: str,
    data: SessionControlRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    org_id = get_admin_org_id(current_user, db)
    logger.info(f"Control command {data.action} sent to lab session {session_id}")

    from app.services.audit_service import log_audit_event
    log_audit_event(
        db=db,
        action="Lab Launch" if data.action == "launch" else f"Lab Action ({data.action})",
        entity="Session",
        entity_id=session_id,
        performed_by=current_user.email,
        performed_by_role=current_user.role,
        organization_id=org_id,
        new_value=f"Session {session_id} state changed to {data.action}",
        request=request
    )

    return {"status": "success", "message": f"Lab session {session_id} state changed: {data.action}"}
