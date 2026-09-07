from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.core.database import Base

class CMSHashAudit(Base):
    __tablename__ = "cms_hash_audit"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String(255), nullable=True)
    sha256_hash = Column(String(255), nullable=True)
    destination = Column(String(255), nullable=True)
    purpose = Column(String(255), nullable=True)
    sharing_medium = Column(String(100), nullable=True)
    verification_status = Column(String(50), default="Passed")
    timestamp = Column(DateTime, server_default=func.now())

class CMSAuditLog(Base):
    __tablename__ = "cms_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
