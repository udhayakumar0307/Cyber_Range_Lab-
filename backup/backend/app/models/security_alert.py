from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.models.base import Base

class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    alert_type = Column(String(100), nullable=False)  # DDoS, RBAC_VIOLATION, BRUTE_FORCE
    severity = Column(String(50), default="MEDIUM")   # LOW, MEDIUM, HIGH, CRITICAL
    source_ip = Column(String(50), nullable=True)
    user_email = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="UNRESOLVED") # UNRESOLVED, RESOLVED
