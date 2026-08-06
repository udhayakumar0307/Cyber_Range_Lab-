import logging
import time
from typing import Optional, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.deps import get_db, get_current_system_admin
from app.models.user import User
from app.models.admin_models import (
    Organization, AdminProfile, Order, OrderItem, Payment, PurchasedLab, Subscription, Invoice
)
from app.models.group import Group
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.audit_log import AuditLog
from app.models.study_session import StudySession
from app.models.user_lab_progress import UserLabProgress
from app.services.audit_service import log_audit_event
from app.database.manager import db_manager
from app.security.utils import get_client_ip

logger = logging.getLogger(__name__)

router = APIRouter()

# Simple in-memory rate limiter for failed security key attempts
FAILED_ATTEMPTS: Dict[str, list] = {}

class SecurityKeyPayload(BaseModel):
    security_key: str

@router.post("/verify-key")
def verify_system_security_key(payload: SecurityKeyPayload, request: Request):
    """
    Verifies System Admin Security Key before login screen is displayed.
    Performs rate limiting and returns generic error message if invalid.
    """
    client_ip = get_client_ip(request)
    now = time.time()
    
    # Clean up old attempts older than 15 mins (900s)
    if client_ip in FAILED_ATTEMPTS:
        FAILED_ATTEMPTS[client_ip] = [t for t in FAILED_ATTEMPTS[client_ip] if now - t < 900]
        if len(FAILED_ATTEMPTS[client_ip]) >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed security key attempts. Please try again in 15 minutes."
            )
            
    expected_key = settings.SYSTEM_ADMIN_SECURITY_KEY
    if not expected_key or payload.security_key != expected_key:
        if client_ip not in FAILED_ATTEMPTS:
            FAILED_ATTEMPTS[client_ip] = []
        FAILED_ATTEMPTS[client_ip].append(now)
        logger.warning(f"Failed System Security Key verification attempt from IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Security Key"
        )
        
    return {
        "verified": True,
        "message": "Security Key verified successfully."
    }

@router.get("/audit/dashboard")
@router.get("/dashboard")
def get_system_audit_dashboard(
    org_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    """
    Returns platform-wide Audit & Metrics dashboard.
    Strictly protected for SYSTEM_ADMIN role.
    """
    total_organizations = db.query(Organization).count()
    total_admins = db.query(User).filter(User.role.in_(["admin", "ADMIN", "SYSTEM_ADMIN"])).count()
    total_users = db.query(User).count()
    total_groups = db.query(Group).count()
    total_purchases = db.query(PurchasedLab).count()
    
    rev_result = db.query(func.sum(Payment.amount)).filter(Payment.payment_status == "SUCCESS").scalar()
    total_revenue = float(rev_result or 0.0)

    # Time-scoped SaaS Revenue Metrics
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    year_start = datetime(now.year, 1, 1)

    monthly_rev = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_status == "SUCCESS",
        Payment.created_at >= month_start
    ).scalar() or 0.0

    yearly_rev = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_status == "SUCCESS",
        Payment.created_at >= year_start
    ).scalar() or 0.0

    total_seats_sold = db.query(func.sum(PurchasedLab.total_seats)).scalar() or 0
    total_seats_allocated = db.query(func.sum(PurchasedLab.assigned_seats)).scalar() or 0
    total_refunded_payments = db.query(Payment).filter(Payment.payment_status == "REFUNDED").count()

    total_running_containers = db.query(StudySession).filter(StudySession.logout_time.is_(None)).count()
    total_sessions = db.query(StudySession).count()
    total_active_users = db.query(User).filter(User.is_active == True).count()

    audit_query = db.query(AuditLog)
    if org_id:
        audit_query = audit_query.filter(AuditLog.organization_id == str(org_id))
    if search:
        s = f"%{search}%"
        audit_query = audit_query.filter(
            (AuditLog.action.ilike(s)) |
            (AuditLog.performed_by.ilike(s)) |
            (AuditLog.endpoint.ilike(s)) |
            (AuditLog.ip_address.ilike(s))
        )
    if date_from:
        try:
            d_from = datetime.strptime(date_from, "%Y-%m-%d")
            audit_query = audit_query.filter(AuditLog.timestamp >= d_from)
        except ValueError:
            pass
    if date_to:
        try:
            d_to = datetime.strptime(date_to, "%Y-%m-%d")
            audit_query = audit_query.filter(AuditLog.timestamp <= d_to)
        except ValueError:
            pass

    recent_logs = audit_query.order_by(AuditLog.timestamp.desc()).limit(50).all()

    recent_activity = [
        {
            "id": log.id,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "",
            "action": log.action,
            "entity": log.entity or log.resource or "System",
            "entity_id": log.entity_id or log.resource_id or "",
            "performed_by": log.performed_by or (f"User #{log.user_id}" if log.user_id else "System"),
            "performed_by_role": log.performed_by_role or "Admin",
            "organization_id": log.organization_id,
            "ip_address": log.ip_address or "Local",
            "browser": log.browser or "Browser",
            "operating_system": log.operating_system or log.device or "OS",
            "request_method": log.request_method or "GET",
            "endpoint": log.endpoint or "/api/v1/system",
            "status": log.status,
            "old_value": log.old_value,
            "new_value": log.new_value
        }
        for log in recent_logs
    ]

    admins_query = db.query(User).filter(User.role.in_(["admin", "ADMIN", "SYSTEM_ADMIN"])).all()
    platform_admins = []
    for adm in admins_query:
        prof = db.query(AdminProfile).filter(AdminProfile.user_id == adm.id).first()
        org = prof.organization if prof else None
        platform_admins.append({
            "id": adm.id,
            "name": adm.name or adm.email.split("@")[0],
            "email": adm.email,
            "role": adm.role,
            "organization_name": org.name if org else (adm.organization or "Independent"),
            "designation": prof.designation if prof else "Admin",
            "phone": adm.phone or (prof.phone if prof else ""),
            "last_login": adm.last_login.strftime("%Y-%m-%d %H:%M:%S") if adm.last_login else "Never",
            "is_active": adm.is_active
        })

    orgs_query = db.query(Organization).all()
    organizations = []
    for org in orgs_query:
        user_count = db.query(User).join(AdminProfile, AdminProfile.user_id == User.id, isouter=True)\
                       .filter((AdminProfile.organization_id == org.id) | (User.organization == org.name)).count()
        group_count = db.query(Group).filter(Group.organization_id == str(org.id)).count()
        spent = db.query(func.sum(Order.grand_total)).filter(Order.organization_id == org.id, Order.status == "COMPLETED").scalar() or 0.0
        has_verified_admin = db.query(AdminProfile).filter(
            AdminProfile.organization_id == org.id,
            AdminProfile.is_verified == True
        ).first() is not None
        organizations.append({
            "id": org.id,
            "name": org.name,
            "institution_type": org.institution_type,
            "city": org.city or "",
            "state": org.state or "",
            "created_at": org.created_at.strftime("%Y-%m-%d") if org.created_at else "",
            "total_users": user_count,
            "total_groups": group_count,
            "total_spent": float(spent),
            "is_verified": has_verified_admin
        })

    return {
        "counters": {
            "total_organizations": total_organizations,
            "total_admins": total_admins,
            "total_users": total_users,
            "total_groups": total_groups,
            "total_purchases": total_purchases,
            "total_revenue": total_revenue,
            "monthly_revenue": float(monthly_rev),
            "yearly_revenue": float(yearly_rev),
            "total_seats_sold": int(total_seats_sold),
            "total_seats_allocated": int(total_seats_allocated),
            "total_seats_remaining": int(max(0, total_seats_sold - total_seats_allocated)),
            "total_refunded_payments": total_refunded_payments,
            "total_running_containers": total_running_containers,
            "total_sessions": total_sessions,
            "total_active_users": total_active_users
        },
        "recent_activity": recent_activity,
        "platform_admins": platform_admins,
        "organizations": organizations
    }

@router.get("/users")
def get_system_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if search:
        s = f"%{search}%"
        query = query.filter((User.name.ilike(s)) | (User.email.ilike(s)) | (User.role.ilike(s)))
    total = query.count()
    items = query.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "organization": u.organization,
                "is_active": u.is_active,
                "created_at": u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else ""
            }
            for u in items
        ]
    }

@router.get("/admins")
def get_system_admins(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.role.in_(["admin", "ADMIN", "SYSTEM_ADMIN"]))
    if search:
        s = f"%{search}%"
        query = query.filter((User.name.ilike(s)) | (User.email.ilike(s)))
    total = query.count()
    items = query.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "admins": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "organization": u.organization,
                "is_active": u.is_active,
                "created_at": u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else ""
            }
            for u in items
        ]
    }

@router.get("/organizations")
def get_system_organizations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Organization)
    if search:
        s = f"%{search}%"
        query = query.filter((Organization.name.ilike(s)) | (Organization.institution_type.ilike(s)))
    total = query.count()
    items = query.order_by(Organization.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "organizations": [
            {
                "id": o.id,
                "name": o.name,
                "institution_type": o.institution_type,
                "city": o.city or "",
                "created_at": o.created_at.strftime("%Y-%m-%d") if o.created_at else ""
            }
            for o in items
        ]
    }

class OrganizationCreateRequest(BaseModel):
    name: str
    institution_type: str = "Enterprise"
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gst_number: Optional[str] = None

@router.post("/organizations", status_code=status.HTTP_201_CREATED)
def create_system_organization(
    data: OrganizationCreateRequest,
    request: Request,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    """
    System Admin Endpoint: Create Organization.
    """
    org = Organization(
        name=data.name,
        institution_type=data.institution_type,
        address=data.address,
        city=data.city,
        state=data.state,
        gst_number=data.gst_number
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    log_audit_event(
        db=db,
        action="Organization Created",
        entity="Organization",
        entity_id=str(org.id),
        performed_by=current_admin.email,
        performed_by_role=current_admin.role,
        organization_id=org.id,
        new_value=f"Created enterprise organization {org.name}",
        request=request
    )

    return {"status": "success", "organization_id": org.id, "message": "Organization created successfully."}

@router.post("/organizations/{org_id}/suspend")
def suspend_system_organization(
    org_id: int,
    request: Request,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    """
    System Admin Endpoint: Suspend Organization.
    Deactivates all users associated with this organization.
    """
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    # Deactivate org admin users
    org_users = db.query(User).join(AdminProfile, AdminProfile.user_id == User.id)\
                  .filter(AdminProfile.organization_id == org_id).all()
    for u in org_users:
        u.is_active = False

    log_audit_event(
        db=db,
        action="Organization Suspended",
        entity="Organization",
        entity_id=str(org.id),
        performed_by=current_admin.email,
        performed_by_role=current_admin.role,
        organization_id=org.id,
        new_value=f"Suspended organization {org.name} and deactivated {len(org_users)} users.",
        request=request
    )

    db.commit()
    return {"status": "success", "message": f"Organization {org.name} suspended successfully."}

@router.post("/organizations/{org_id}/reactivate")
def reactivate_system_organization(
    org_id: int,
    request: Request,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    """
    System Admin Endpoint: Reactivate Organization.
    """
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    org_users = db.query(User).join(AdminProfile, AdminProfile.user_id == User.id)\
                  .filter(AdminProfile.organization_id == org_id).all()
    for u in org_users:
        u.is_active = True

    log_audit_event(
        db=db,
        action="Organization Reactivated",
        entity="Organization",
        entity_id=str(org.id),
        performed_by=current_admin.email,
        performed_by_role=current_admin.role,
        organization_id=org.id,
        new_value=f"Reactivated organization {org.name}.",
        request=request
    )

    db.commit()
    return {"status": "success", "message": f"Organization {org.name} reactivated successfully."}

@router.get("/groups")
def get_system_groups(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Group)
    if search:
        s = f"%{search}%"
        query = query.filter((Group.name.ilike(s)) | (Group.description.ilike(s)))
    total = query.count()
    items = query.order_by(Group.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "groups": [
            {
                "id": g.id,
                "name": g.name,
                "description": g.description,
                "organization_id": g.organization_id,
                "created_at": g.created_at.strftime("%Y-%m-%d") if g.created_at else ""
            }
            for g in items
        ]
    }

@router.get("/labs")
def get_system_labs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Lab)
    if search:
        s = f"%{search}%"
        query = query.filter((Lab.name.ilike(s)) | (Lab.category.ilike(s)))
    total = query.count()
    items = query.order_by(Lab.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "labs": [
            {
                "id": l.id,
                "name": l.name,
                "category": l.category,
                "difficulty": l.difficulty,
                "max_points": l.max_points,
                "status": l.status,
                "price_per_hour": l.price_per_hour or 100.0
            }
            for l in items
        ]
    }

@router.get("/payments")
def get_system_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Payment)
    if search:
        s = f"%{search}%"
        query = query.filter((Payment.transaction_id.ilike(s)) | (Payment.order_id.ilike(s)))
    total = query.count()
    items = query.order_by(Payment.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "payments": [
            {
                "id": p.id,
                "transaction_id": p.transaction_id,
                "order_id": p.order_id,
                "amount": p.amount,
                "gateway": p.gateway,
                "payment_status": p.payment_status,
                "created_at": p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else ""
            }
            for p in items
        ]
    }

@router.get("/orders")
def get_system_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if search:
        s = f"%{search}%"
        query = query.filter((Order.order_number.ilike(s)) | (Order.status.ilike(s)))
    total = query.count()
    items = query.order_by(Order.id.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "organization_id": o.organization_id,
                "grand_total": o.grand_total,
                "status": o.status,
                "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else ""
            }
            for o in items
        ]
    }

@router.get("/audit-logs")
def get_system_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (AuditLog.action.ilike(s)) |
            (AuditLog.performed_by.ilike(s)) |
            (AuditLog.endpoint.ilike(s))
        )
    total = query.count()
    items = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "audit_logs": [
            {
                "id": l.id,
                "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S") if l.timestamp else "",
                "action": l.action,
                "entity": l.entity or l.resource or "System",
                "entity_id": l.entity_id or l.resource_id or "",
                "performed_by": l.performed_by or (f"User #{l.user_id}" if l.user_id else "System"),
                "status": l.status,
                "ip_address": l.ip_address,
                "endpoint": l.endpoint
            }
            for l in items
        ]
    }

@router.get("/containers")
def get_system_containers(
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    active_sessions = db.query(StudySession).order_by(StudySession.login_time.desc()).limit(30).all()
    return {
        "active_containers": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "lab_id": s.lab_id,
                "status": "RUNNING" if not s.logout_time else "STOPPED",
                "login_time": s.login_time.strftime("%Y-%m-%d %H:%M:%S") if s.login_time else ""
            }
            for s in active_sessions
        ]
    }

@router.get("/server-health")
def get_system_server_health(
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    db_healthy = db_manager.check_health()
    db_dialect = db_manager.engine.dialect.name if db_manager.engine else "unknown"
    return {
        "status": "HEALTHY" if db_healthy else "UNHEALTHY",
        "database": {
            "dialect": db_dialect,
            "connected": db_healthy,
            "pool_size": 10,
            "target": "AWS RDS PostgreSQL" if db_dialect == "postgresql" else db_dialect
        },
        "server_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "version": "1.0.0-enterprise"
    }

MODEL_MAP = {
    "users": User,
    "organizations": Organization,
    "groups": Group,
    "labs": Lab,
    "lab_modules": LabModule,
    "audit_logs": AuditLog,
    "payments": Payment,
    "orders": Order,
    "purchased_labs": PurchasedLab,
    "study_sessions": StudySession,
    "user_lab_progress": UserLabProgress
}

@router.get("/database-viewer")
def read_only_database_viewer(
    table_name: str = Query(..., description="Target database table to view"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    """
    Read-Only Database Viewer API.
    Queries tables safely via SQLAlchemy ORM. Rejects unauthorized raw SQL execution.
    """
    if table_name not in MODEL_MAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid table name '{table_name}'. Allowed tables: {list(MODEL_MAP.keys())}"
        )
        
    model_cls = MODEL_MAP[table_name]
    mapper = inspect(model_cls)
    columns = [column.key for column in mapper.columns]

    query = db.query(model_cls)

    if search:
        s = f"%{search}%"
        filters = []
        for column in mapper.columns:
            try:
                if column.type.python_type == str:
                    filters.append(getattr(model_cls, column.key).ilike(s))
            except Exception:
                pass
        if filters:
            from sqlalchemy import or_
            query = query.filter(or_(*filters))

    total = query.count()
    pages = (total + limit - 1) // limit if total > 0 else 1

    records = query.offset((page - 1) * limit).limit(limit).all()

    rows = []
    for r in records:
        row_dict = {}
        for col in columns:
            val = getattr(r, col)
            if isinstance(val, datetime):
                row_dict[col] = val.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(val, (dict, list)):
                row_dict[col] = str(val)
            else:
                row_dict[col] = val
        rows.append(row_dict)

    return {
        "table": table_name,
        "columns": columns,
        "rows": rows,
        "total": total,
        "page": page,
        "pages": pages,
        "limit": limit
    }

# =========================================================================
# SYSTEM ADMIN ADDITIONS (Colleges, Manual Labs, Org Stats, Verification)
# =========================================================================

class CollegeCreateRequest(BaseModel):
    name: str
    code: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

@router.get("/colleges")
def get_system_colleges(
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    from app.models.college import College
    colleges = db.query(College).order_by(College.name.asc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "city": c.city,
            "state": c.state,
            "country": c.country,
            "email": c.email,
            "website": c.website,
            "status": c.status,
            "created_at": c.created_at.strftime("%Y-%m-%d") if c.created_at else ""
        }
        for c in colleges
    ]

@router.post("/colleges", status_code=status.HTTP_201_CREATED)
def create_system_college(
    data: CollegeCreateRequest,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    from app.models.college import College
    # Check duplicate
    existing = db.query(College).filter(func.lower(College.name) == func.lower(data.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A college with this name already exists.")

    c = College(
        name=data.name,
        code=data.code,
        city=data.city,
        district=data.district,
        state=data.state,
        country=data.country or "India",
        contact_number=data.contact_number,
        email=data.email,
        website=data.website,
        status="ACTIVE"
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"status": "success", "message": "College created successfully.", "college_id": c.id}

class VerifyOrgRequest(BaseModel):
    is_verified: bool

@router.post("/organizations/{org_id}/verify")
def verify_system_organization(
    org_id: int,
    data: VerifyOrgRequest,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    admins = db.query(AdminProfile).filter(AdminProfile.organization_id == org_id).all()
    for a in admins:
        a.is_verified = data.is_verified
    db.commit()
    status_str = "verified" if data.is_verified else "unverified"
    return {"status": "success", "message": f"Organization admin verification toggled to {status_str} successfully."}

@router.delete("/organizations/{org_id}")
def delete_system_organization(
    org_id: int,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    # Delete related profiles and clear foreign keys
    db.query(AdminProfile).filter(AdminProfile.organization_id == org_id).delete()
    db.query(Group).filter(Group.organization_id == org_id).delete()
    db.query(PurchasedLab).filter(PurchasedLab.organization_id == org_id).delete()
    db.query(Order).filter(Order.organization_id == org_id).update({Order.organization_id: None})
    db.delete(org)
    db.commit()
    return {"status": "success", "message": "Organization removed successfully."}

class ManualLabAssignRequest(BaseModel):
    lab_id: str
    lab_title: str
    hours: float
    user_id: Optional[int] = None
    price_per_hour: Optional[float] = 0.0
    total_price: Optional[float] = 0.0

@router.post("/organizations/{org_id}/assign-lab")
def assign_lab_manually(
    org_id: int,
    data: ManualLabAssignRequest,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    import secrets
    
    # 1. Determine target scopes
    targets = [] # List of tuples: (target_user_id, target_org_id)
    
    if org_id == -1 or org_id == -2: # All Organizations
        orgs = db.query(Organization).all()
        for org in orgs:
            admin = db.query(AdminProfile).filter(AdminProfile.organization_id == org.id).first()
            uid = admin.user_id if admin else current_admin.id
            targets.append((uid, org.id))
            
    if org_id == -2 or (org_id == 0 and data.user_id == -1): # All Students
        users = db.query(User).filter(User.role == 'USER').all()
        for u in users:
            targets.append((u.id, None))
            
    if not targets:
        # Fallback to single specific assignment
        target_user_id = data.user_id
        target_org_id = org_id if org_id > 0 else None
        if not target_user_id and target_org_id:
            admin = db.query(AdminProfile).filter(AdminProfile.organization_id == target_org_id).first()
            target_user_id = admin.user_id if admin else current_admin.id
        if not target_user_id:
            target_user_id = current_admin.id
        targets.append((target_user_id, target_org_id))

    # 2. Perform bulk allocations
    for target_user_id, target_org_id in targets:
        order_num = f"MANUAL-ORD-{secrets.token_hex(4).upper()}"
        new_order = Order(
            order_number=order_num,
            user_id=target_user_id,
            organization_id=target_org_id,
            institution_name=None,
            subtotal=data.total_price or 0.0,
            tax=0.0,
            discount=0.0,
            grand_total=data.total_price or 0.0,
            status="COMPLETED",
            payment_status="COMPLETED"
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)

        order_item = OrderItem(
            order_id=new_order.id,
            lab_id=data.lab_id,
            lab_title=data.lab_title,
            seats=1,
            duration_months=12,
            price=data.total_price or 0.0,
            hours_purchased=data.hours
        )
        db.add(order_item)

        payment = Payment(
            order_id=new_order.id,
            transaction_id=f"MANUAL-TXN-{secrets.token_hex(6).upper()}",
            payment_status="SUCCESS",
            gateway="mock",
            amount=data.total_price or 0.0,
            currency="INR",
            method="UPI / Card"
        )
        db.add(payment)

        lic_key = f"MANUAL-{data.lab_id.upper()}-{secrets.token_hex(4).upper()}"
        pl = PurchasedLab(
            user_id=target_user_id,
            organization_id=target_org_id,
            lab_id=data.lab_id,
            lab_title=data.lab_title,
            license_key=lic_key,
            total_seats=1,
            assigned_seats=0,
            status="ACTIVE",
            expiry_date=datetime.utcnow() + timedelta(days=365),
            hours_purchased=data.hours,
            hours_remaining=data.hours,
            hours_used=0.0
        )
        db.add(pl)
        
    db.commit()
    return {"status": "success", "message": f"Successfully completed bulk manual assignments for '{data.lab_title}'."}

@router.delete("/users/{user_id}")
def delete_system_user(
    user_id: int,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    from app.models.study_session import StudySession
    from app.models.user_lab_progress import UserLabProgress
    from app.models.admin_models import Cart

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Delete dependent child tables first
    db.query(AdminProfile).filter(AdminProfile.user_id == user_id).delete()
    db.query(Cart).filter(Cart.user_id == user_id).delete()
    db.query(Order).filter(Order.user_id == user_id).delete()
    db.query(PurchasedLab).filter(PurchasedLab.user_id == user_id).delete()
    db.query(StudySession).filter(StudySession.user_id == user_id).delete()
    db.query(UserLabProgress).filter(UserLabProgress.user_id == user_id).delete()

    db.delete(user)
    db.commit()
    return {"status": "success", "message": "User permanently deleted from the database in real-time."}

class ManualLabRevokeRequest(BaseModel):
    lab_id: str

@router.post("/organizations/{org_id}/revoke-lab")
def revoke_lab_manually(
    org_id: int,
    data: ManualLabRevokeRequest,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    if org_id == 0:
        pls = db.query(PurchasedLab).filter(
            PurchasedLab.organization_id.is_(None),
            PurchasedLab.lab_id == data.lab_id
        ).all()
        for pl in pls:
            db.delete(pl)
    else:
        pl = db.query(PurchasedLab).filter(
            PurchasedLab.organization_id == org_id,
            PurchasedLab.lab_id == data.lab_id
        ).first()
        if not pl:
            raise HTTPException(status_code=404, detail="Purchased lab assignment not found.")
        db.delete(pl)
        
    db.commit()
    return {"status": "success", "message": "Successfully revoked purchased lab manually."}

@router.get("/organizations/{org_id}/purchases")
def get_organization_purchase_history(
    org_id: int,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    orders = db.query(Order).filter(Order.organization_id == org_id).order_by(Order.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "grand_total": o.grand_total,
            "status": o.status,
            "created_at": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else ""
        }
        for o in orders
    ]

@router.get("/organizations/{org_id}/audit-logs")
def get_organization_audit_logs(
    org_id: int,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).filter(AuditLog.organization_id == org_id).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S") if l.timestamp else "",
            "action": l.action,
            "entity": l.entity or "System",
            "performed_by": l.performed_by,
            "status": l.status
        }
        for l in logs
    ]

@router.get("/students/{student_id}/analytics")
def get_student_portal_analytics(
    student_id: int,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    progress = db.query(UserLabProgress).filter(UserLabProgress.user_id == student_id).all()
    sessions = db.query(StudySession).filter(StudySession.user_id == student_id).all()

    total_active_hours = sum((s.duration_minutes or 0.0) for s in sessions) / 60.0
    completed_count = sum(1 for p in progress if p.status == "COMPLETED")
    avg_score = sum((p.score or 0.0) for p in progress) / len(progress) if progress else 0.0

    return {
        "student_id": student.id,
        "name": student.name or student.email,
        "email": student.email,
        "total_active_hours": round(total_active_hours, 2),
        "completed_labs_count": completed_count,
        "average_score": round(avg_score, 2),
        "labs": [
            {
                "lab_id": p.lab_id,
                "status": p.status,
                "score": p.score,
                "completed_at": p.completed_at.strftime("%Y-%m-%d") if p.completed_at else ""
            }
            for p in progress
        ]
    }

# =========================================================================
# STANDALONE WORKER INTERACTIVE CHANNELS (Security Alerts & Lab Approvals)
# =========================================================================

@router.get("/security-alerts")
def get_system_security_alerts(
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    from app.models.security_alert import SecurityAlert
    alerts = db.query(SecurityAlert).order_by(SecurityAlert.timestamp.desc()).limit(100).all()
    return [
        {
            "id": a.id,
            "timestamp": a.timestamp.strftime("%Y-%m-%d %H:%M:%S") if a.timestamp else "",
            "alert_type": a.alert_type,
            "severity": a.severity,
            "source_ip": a.source_ip,
            "user_email": a.user_email,
            "description": a.description,
            "status": a.status
        }
        for a in alerts
    ]

@router.post("/security-alerts/{alert_id}/resolve")
def resolve_system_security_alert(
    alert_id: int,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    from app.models.security_alert import SecurityAlert
    alert = db.query(SecurityAlert).filter(SecurityAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    alert.status = "RESOLVED"
    db.commit()
    return {"status": "success", "message": "Security alert marked as RESOLVED."}

@router.post("/labs/{lab_id}/approve")
def approve_auto_synced_lab(
    lab_id: str,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
    lab.status = "ACTIVE"
    db.commit()
    return {"status": "success", "message": f"Lab {lab_id} approved and status changed to ACTIVE."}

class UpdateLabPriceRequest(BaseModel):
    price_per_hour: float

@router.post("/labs/{lab_id}/update-price")
def update_lab_hourly_pricing(
    lab_id: str,
    data: UpdateLabPriceRequest,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
    lab.price_per_hour = data.price_per_hour
    db.commit()
    return {"status": "success", "message": f"Hourly rate for lab {lab_id} updated to ₹{data.price_per_hour} successfully."}

@router.delete("/labs/{lab_id}")
def delete_system_lab(
    lab_id: str,
    current_admin: User = Depends(get_current_system_admin),
    db: Session = Depends(get_db)
):
    lab = db.query(Lab).filter(Lab.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Lab not found.")
    db.delete(lab)
    db.commit()
    return {"status": "success", "message": f"Lab {lab_id} has been permanently deleted from database."}


