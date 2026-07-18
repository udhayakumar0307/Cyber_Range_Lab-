from app.models.base import Base
from app.models.role import Role
from app.models.college import College
from app.models.group import Group
from app.models.user import User
from app.models.otp import OTPVerification
from app.models.password_reset import PasswordReset
from app.models.professor import Professor
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user_lab_progress import UserLabProgress
from app.models.study_session import StudySession
from app.models.achievement import Achievement
from app.models.user_achievement import UserAchievement
from app.models.professor_assignment import ProfessorAssignment
from app.models.student_assignment import StudentAssignment
from app.models.audit_log import AuditLog

__all__ = [
    "Base",
    "Role",
    "College",
    "Group",
    "User",
    "OTPVerification",
    "PasswordReset",
    "Professor",
    "Lab",
    "LabModule",
    "UserLabProgress",
    "StudySession",
    "Achievement",
    "UserAchievement",
    "ProfessorAssignment",
    "StudentAssignment",
    "AuditLog"
]

