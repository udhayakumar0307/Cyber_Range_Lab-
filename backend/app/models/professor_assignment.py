from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.models.base import Base

class ProfessorAssignment(Base):
    __tablename__ = "professor_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    professor_id = Column(Integer, ForeignKey("professors.id", ondelete="CASCADE"), nullable=False, index=True)
    college_id = Column(Integer, ForeignKey("colleges.id", ondelete="CASCADE"), nullable=False, index=True)
    lab_id = Column(String(100), ForeignKey("labs.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_date = Column(DateTime, nullable=False)
    due_date = Column(DateTime, nullable=False)
