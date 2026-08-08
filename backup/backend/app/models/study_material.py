from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime
from app.models.base import Base

class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    read_time = Column(String(50), default="15 min read")
    difficulty = Column(String(50), default="Intermediate")
    last_updated = Column(String(50), nullable=True)
    pdf_url = Column(String(500), nullable=True)
    content_json = Column(Text, nullable=True)  # JSON array string of bulletins
    is_published = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
