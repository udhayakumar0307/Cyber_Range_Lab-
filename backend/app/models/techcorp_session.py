from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from datetime import datetime
from app.models.base import Base

class TechCorpSession(Base):
    __tablename__ = "techcorp_sessions"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    container_id = Column(String(100), nullable=True)
    container_name = Column(String(100), nullable=True)
    ssh_host = Column(String(100), default="127.0.0.1", nullable=False)
    ssh_port = Column(Integer, unique=True, nullable=False)
    current_level = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_active_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
