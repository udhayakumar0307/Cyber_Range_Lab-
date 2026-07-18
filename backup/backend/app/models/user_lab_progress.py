from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from datetime import datetime
from app.models.base import Base

class UserLabProgress(Base):
    __tablename__ = "user_lab_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lab_id = Column(String(100), ForeignKey("labs.id", ondelete="CASCADE"), nullable=False, index=True)
    module_id = Column(String(100), ForeignKey("lab_modules.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="STARTED", nullable=False)
    score = Column(Integer, default=0, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)
    last_submission = Column(String(255), nullable=True)
    flag_correct = Column(Boolean, default=False, nullable=False)
    client_ip = Column(String(50), nullable=True)
    browser = Column(String(100), nullable=True)
    device = Column(String(100), nullable=True)
