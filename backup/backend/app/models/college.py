from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship, synonym
from datetime import datetime
from app.models.base import Base

class College(Base):
    __tablename__ = "colleges"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), unique=True, nullable=False, index=True)
    address = Column(String(1000), nullable=True)
    code = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    contact_number = Column(String(250), nullable=True)
    email = Column(String(250), nullable=True)
    website = Column(String(200), nullable=True)
    logo_url = Column(String(500), nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    users = relationship("User", back_populates="college")

    college_name = synonym("name")
    college_code = synonym("code")
