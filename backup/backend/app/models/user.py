from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.models.base import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    group = relationship("Group", back_populates="users")
    
    college_id = Column(Integer, ForeignKey("colleges.id", ondelete="SET NULL"), nullable=True)
    college = relationship("College", back_populates="users")

    affiliations = relationship("UserAffiliation", back_populates="user", cascade="all, delete-orphan")

    phone_verified = Column(Boolean, default=False, nullable=False)
    designation = Column(String(100), nullable=True)

    account_type = Column(String(50), default="student", nullable=False)
    account_status = Column(String(50), default="active", nullable=False)
    email_verified = Column(Boolean, default=True, nullable=False)
    tenant_id = Column(String(100), default="default", nullable=True)
    is_internal = Column(Boolean, default=False, nullable=False)
    google_id = Column(String(255), nullable=True, index=True)
    provider = Column(String(50), default="local", nullable=False)
    department = Column(String(100), nullable=True)
    year = Column(Integer, nullable=True)
    roll_number = Column(String(100), nullable=True)
    total_score = Column(Integer, default=0, nullable=False)

    # Extended Profile & Settings Fields
    profile_completed = Column(Boolean, default=False, nullable=False)
    profile_photo = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    dob = Column(String(50), nullable=True)
    gender = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    profession = Column(String(100), nullable=True)
    organization = Column(String(255), nullable=True)
    experience = Column(String(100), nullable=True)
    highest_qualification = Column(String(100), nullable=True)
    course = Column(String(100), nullable=True)
    year = Column(Integer, nullable=True)
    semester = Column(Integer, nullable=True)
    section = Column(String(50), nullable=True)
    professor = Column(String(100), nullable=True)
    batch = Column(String(100), nullable=True)
    student_id_num = Column(String(100), nullable=True)
    theme = Column(String(20), default="dark", nullable=False)
    language = Column(String(20), default="en", nullable=False)
    timezone = Column(String(50), default="UTC", nullable=False)
    notification_settings = Column(String(1000), nullable=True)
    security_settings = Column(String(1000), nullable=True)
    appearance_settings = Column(String(1000), nullable=True)
    last_login = Column(DateTime, nullable=True)
    auth_type = Column(String(50), default="INDIVIDUAL", nullable=False)

    @property
    def full_name(self) -> str:
        return self.name or ""

    @full_name.setter
    def full_name(self, value: str):
        self.name = value

    @property
    def profile_picture(self) -> str:
        return self.profile_photo or ""

    @profile_picture.setter
    def profile_picture(self, value: str):
        self.profile_photo = value
