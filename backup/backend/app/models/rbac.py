"""Scoped user-role bindings. User is the canonical login identity."""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class UserRoleBinding(Base):
    __tablename__ = "user_role_bindings"
    __table_args__ = (
        UniqueConstraint("user_id", "role", "scope_key", name="uq_user_role_binding_scope"),
        CheckConstraint(
            "role IN ('SYSTEM_ADMIN','ADMIN','PROFESSOR','TA','STUDENT')",
            name="ck_user_role_binding_role",
        ),
        CheckConstraint(
            "scope_type IN ('GLOBAL','ORGANIZATION','COLLEGE','UNSCOPED')",
            name="ck_user_role_binding_scope_type",
        ),
        CheckConstraint(
            "((scope_type = 'GLOBAL' AND organization_id IS NULL AND college_id IS NULL) OR "
            "(scope_type = 'UNSCOPED' AND organization_id IS NULL AND college_id IS NULL) OR "
            "(scope_type = 'ORGANIZATION' AND organization_id IS NOT NULL AND college_id IS NULL) OR "
            "(scope_type = 'COLLEGE' AND college_id IS NOT NULL AND organization_id IS NULL))",
            name="ck_user_role_binding_scope_columns",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(40), nullable=False, index=True)
    scope_type = Column(String(30), nullable=False, index=True)
    scope_key = Column(String(100), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    college_id = Column(Integer, ForeignKey("colleges.id", ondelete="CASCADE"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    grantor = relationship("User", foreign_keys=[granted_by])
