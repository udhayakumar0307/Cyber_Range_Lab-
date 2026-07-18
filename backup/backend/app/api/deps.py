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
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
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
