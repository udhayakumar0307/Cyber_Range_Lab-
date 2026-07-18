from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.repository.user import user_repository
from app.core.security import verify_password

class UserService:
    def authenticate_user(self, db: Session, username_or_email: str, password: str) -> Optional[User]:
        # User can authenticate with username or email
        user = user_repository.get_by_email(db, username_or_email)
        if not user:
            user = user_repository.get_by_name(db, username_or_email)
            
        if not user:
            return None
            
        if not verify_password(password, user.password_hash):
            return None
            
        return user

user_service = UserService()
