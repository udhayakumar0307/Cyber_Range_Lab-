from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.core.timezone_utils import now_ist

class Group(Base):
    __tablename__ = "groups"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_groups_organization_id_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(String(250), nullable=True)
    max_size = Column(Integer, nullable=False, default=40)
    created_at = Column(DateTime, default=now_ist)

    users = relationship("User", back_populates="group", foreign_keys="User.group_id")

