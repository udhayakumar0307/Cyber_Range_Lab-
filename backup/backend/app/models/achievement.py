from sqlalchemy import Column, Integer, String, Text
from app.models.base import Base

class Achievement(Base):
    __tablename__ = "achievements"
    
    id = Column(String(100), primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    condition = Column(String(255), nullable=True)
    reward_points = Column(Integer, default=0, nullable=False)
