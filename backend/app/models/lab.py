from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from datetime import datetime
from app.models.base import Base

class Lab(Base):
    __tablename__ = "labs"
    
    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)
    difficulty = Column(String(50), nullable=False)
    max_points = Column(Integer, default=0, nullable=False)
    estimated_time = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False)
    description = Column(Text, nullable=True)
    price_inr = Column(Float, default=14999.0, nullable=True)
    rating = Column(Float, default=4.9, nullable=True)
    review_count = Column(Integer, default=120, nullable=True)
    docker_image = Column(String(500), nullable=True)
    registry_path = Column(String(500), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
