from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import Base

class UserAffiliation(Base):
    __tablename__ = "user_affiliations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    affiliation_type = Column(String(50), nullable=False)  # 'college' or 'organization'
    college_id = Column(Integer, ForeignKey("colleges.id", ondelete="SET NULL"), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="affiliations")
    college = relationship("College")
    organization = relationship("Organization")
