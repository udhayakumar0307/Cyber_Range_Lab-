"""Professor academic metadata. Authentication identity is always User."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import Base


class ProfessorProfile(Base):
    __tablename__ = "professor_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    department = Column(String(100), nullable=True)
    academic_title = Column(String(100), nullable=True)
    employee_id = Column(String(100), nullable=True)
    office = Column(String(150), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


# Compatibility import only. New runtime code should use ProfessorProfile.
Professor = ProfessorProfile
