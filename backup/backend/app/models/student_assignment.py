from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.models.base import Base

class StudentAssignment(Base):
    __tablename__ = "student_assignments"
    
    assignment_id = Column(Integer, ForeignKey("professor_assignments.id", ondelete="CASCADE"), primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    status = Column(String(50), default="PENDING", nullable=False)
    score = Column(Integer, default=0, nullable=False)
    completed_at = Column(DateTime, nullable=True)
