from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.core.database import Base

class CMSIntegrationConfig(Base):
    __tablename__ = "cms_integration_config"

    id = Column(Integer, primary_key=True, index=True)
    store_name = Column(String(255), nullable=True)
    store_url = Column(String(255), nullable=True)
    platform = Column(String(50), nullable=True)
    encrypted_api_key = Column(Text, nullable=True)
    encrypted_secret = Column(Text, nullable=True)
    connection_status = Column(String(50), default="Disconnected")
    api_version = Column(String(50), nullable=True)
    webhook_url = Column(String(255), nullable=True)
    last_sync = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class CMSSyncHistory(Base):
    __tablename__ = "cms_sync_history"

    id = Column(Integer, primary_key=True, index=True)
    event = Column(String(255), nullable=True)
    status = Column(String(50), nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

class CMSOverrideRule(Base):
    __tablename__ = "cms_override_rules"

    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(255), unique=True, index=True)
    action = Column(String(50))  # "include" or "exclude"
    technique = Column(String(100), nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

class CMSGeneratedReport(Base):
    __tablename__ = "cms_generated_reports"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    category = Column(String(100))
    format = Column(String(50))
    size = Column(String(50))
    status = Column(String(50), default="Ready")
    timestamp = Column(DateTime, server_default=func.now())

class CMSConsentRecord(Base):
    __tablename__ = "cms_consent_records"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String(255), unique=True, index=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    consent_purpose = Column(String(255), nullable=True)
    consent_status = Column(String(50), nullable=True)
    is_minor = Column(Integer, nullable=True)
    age_category = Column(String(50), nullable=True)
    data_principal_type = Column(String(50), nullable=True)
    guardian_consent = Column(String(50), nullable=True)
    parent_contact = Column(String(255), nullable=True)
    raw_data = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
