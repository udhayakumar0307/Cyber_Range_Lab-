from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime
from app.models.base import Base

class Certificate(Base):
    __tablename__ = "certificates"
    
    uuid = Column(String(100), primary_key=True, index=True)
    display_certificate_id = Column(String(100), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lab_id = Column(String(100), ForeignKey("labs.id", ondelete="CASCADE"), nullable=False, index=True)
    pdf_path = Column(String(500), nullable=True)
    png_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
