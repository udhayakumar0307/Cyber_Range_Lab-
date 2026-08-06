from sqlalchemy import Column, Integer, String, ForeignKey
from app.models.base import Base

class LabModule(Base):
    __tablename__ = "lab_modules"
    
    id = Column(String(100), primary_key=True, index=True)
    lab_id = Column(String(100), ForeignKey("labs.id", ondelete="CASCADE"), nullable=False)
    module_number = Column(Integer, nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(String(255), nullable=True)
    points = Column(Integer, default=0, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    track = Column(String(100), default="linux", nullable=False)

