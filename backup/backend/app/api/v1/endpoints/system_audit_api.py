import logging
import time
from typing import Optional, Dict
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.deps import get_db, get_current_system_admin
from app.models.user import User
from app.models.admin_models import (
    Organization, AdminProfile, Order, Payment, PurchasedLab, Subscription, Invoice
)
from app.models.group import Group
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.audit_log import AuditLog
from app.models.study_session import StudySession
from app.models.user_lab_progress import UserLabProgress
from app.services.audit_service import log_audit_event
from app.database.manager import db_manager

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
    client_ip = request.client.host if request.client else "unknown"
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
        organizations.append({
            "id": org.id,
            "name": org.name,
            "institution_type": org.institution_type,
            "city": org.city or "",
            "state": org.state or "",
            "created_at": org.created_at.strftime("%Y-%m-%d") if org.created_at else "",
            "total_users": user_count,
            "total_groups": group_count,
            "total_spent": float(spent)
        })

    return {
        "counters": {
            "total_organizations": total_organizations,
            "total_admins": total_admins,
            "total_users": total_users,
            "total_groups": total_groups,
            "total_purchases": total_purchases,
            "total_revenue": total_revenue,
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
                "status": l.status
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
