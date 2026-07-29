from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.security import decode_access_token
from app.repository.user import user_repository
from app.models.user import User

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Dependency resolves the logged-in user from either Authorization header or cookies.
    """
    token = None
    
    # 1. Try Authorization Bearer Header (for development localStorage storage)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        
    # 2. Try HttpOnly cookie (for production secure cookie storage)
    if not token:
        token = request.cookies.get("access_token")

    # 3. Try URL Query Parameter (for embedded iframe views like /api/v1/cll/view?token=...)
    if not token:
        token = request.query_params.get("token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
        
    from app.security.token_manager import token_manager
    if token_manager.is_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked"
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired credentials"
        )
        
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identity"
        )
        
    user = user_repository.get_by_email(db, username)
    if not user:
        user = user_repository.get_by_name(db, username)
        
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
        
    return user

def get_current_user_optional(request: Request, db: Session = Depends(get_db)):
    """Optional dependency that returns User if authenticated, else None."""
    try:
        return get_current_user(request, db)
    except Exception:
        return None

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures current user is an admin or SYSTEM_ADMIN."""
    role_upper = (current_user.role or "").upper()
    if role_upper not in ["ADMIN", "SYSTEM_ADMIN", "PROFESSOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required"
        )
    return current_user

def get_current_system_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures current user has SYSTEM_ADMIN role."""
    role_upper = (current_user.role or "").upper()
    if role_upper != "SYSTEM_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. System Admin role required."
        )
    return current_user

def get_admin_org_id(user: User, db: Session) -> int:
    """Returns the organization_id associated with the admin user, creating an org if needed."""
    from app.models.admin_models import AdminProfile, Organization
    profile = db.query(AdminProfile).filter(AdminProfile.user_id == user.id).first()
    if profile and profile.organization_id:
        return profile.organization_id
    
    # Check if an organization exists with default or user's college/organization name
    org_name = user.organization or (user.college.name if user.college else "Default Enterprise Organization")
    org = db.query(Organization).filter(Organization.name == org_name).first()
    if not org:
        org = Organization(name=org_name, institution_type="Enterprise")
        db.add(org)
        db.commit()
        db.refresh(org)
    
    if profile:
        profile.organization_id = org.id
        db.commit()
    else:
        profile = AdminProfile(user_id=user.id, organization_id=org.id)
        db.add(profile)
        db.commit()
        
    return org.id

