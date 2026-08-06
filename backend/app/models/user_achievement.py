from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime
from app.models.base import Base

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    achievement_id = Column(String(100), ForeignKey("achievements.id", ondelete="CASCADE"), primary_key=True, index=True)
    earned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
