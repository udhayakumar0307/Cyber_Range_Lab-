from sqlalchemy import Column, Integer, String, Boolean, DateTime, UniqueConstraint
from datetime import datetime
from app.models.base import Base

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, index=True)
    track_id = Column(String(100), nullable=False)
    module_id = Column(String(100), nullable=False)
    completed = Column(Boolean, default=False)
    module_score = Column(Integer, default=0)
    hint1_used = Column(Boolean, default=False)
    hint2_used = Column(Boolean, default=False)
    flag_submitted = Column(String(255), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('user_id', 'track_id', 'module_id', name='_user_track_module_uc'),
    )
