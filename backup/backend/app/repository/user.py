from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.repository.base import BaseRepository

class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)

    def get_by_name(self, db: Session, name: str) -> Optional[User]:
        return db.query(User).filter(User.name == name).first()

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        if not email:
            return None
        return db.query(User).filter(User.email == str(email)).first()


user_repository = UserRepository()
