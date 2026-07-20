from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.models.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity = Column(String(100), nullable=True)
    entity_id = Column(String(100), nullable=True)
    performed_by = Column(String(150), nullable=True)
    performed_by_role = Column(String(50), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    ip_address = Column(String(50), nullable=True)
    browser = Column(String(100), nullable=True)
    operating_system = Column(String(100), nullable=True)
    request_method = Column(String(20), nullable=True)
    endpoint = Column(String(200), nullable=True)
    status = Column(String(50), nullable=False, default="SUCCESS")
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    # Legacy / Backward compatibility fields
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    request_id = Column(String(100), nullable=True, index=True)
    resource = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    device = Column(String(100), nullable=True)

