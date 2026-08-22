from app.models.base import Base
from app.models.role import Role
from app.models.college import College
from app.models.group import Group
from app.models.user import User
from app.models.assignment import Assignment
from app.models.otp import OTPVerification
from app.models.password_reset import PasswordReset
from app.models.professor import Professor
from app.models.lab import Lab
from app.models.lab_module import LabModule
from app.models.user_lab_progress import UserLabProgress
from app.models.user_progress import UserProgress
from app.models.study_session import StudySession
from app.models.study_material import StudyMaterial
from app.models.achievement import Achievement
from app.models.user_achievement import UserAchievement
from app.models.audit_log import AuditLog
from app.models.score_event import ScoreEvent
from app.models.notification import Notification, NotificationPreference
from app.models.certificate import Certificate
from app.models.user_affiliation import UserAffiliation
from app.models.admin_models import (
    Organization, AdminProfile, Cart, CartItem, Order, OrderItem,
    Payment, Invoice, PurchasedLab, License, BillingAddress, Subscription
)
from app.models.ctf import (
    CTF,
    CTFChallenge,
    CTFChallengeFile,
    CTFHint,
    CTFHintUnlock,
    CTFSubmission,
    CTFParticipation,
)

__all__ = [
    "Base",
    "Role",
    "College",
    "Group",
    "User",
    "UserAffiliation",
    "Assignment",
    "OTPVerification",
    "PasswordReset",
    "Professor",
    "Lab",
    "LabModule",
    "UserLabProgress",
    "UserProgress",
    "StudySession",
    "Achievement",
    "UserAchievement",
    "Certificate",
    "AuditLog",
    "ScoreEvent",
    "Notification",
    "NotificationPreference",
    "TechCorpSession",
    "Organization",
    "AdminProfile",
    "Cart",
    "CartItem",
    "Order",
    "OrderItem",
    "Payment",
    "Invoice",
    "PurchasedLab",
    "License",
    "BillingAddress",
    "Subscription",
    # CTF module
    "CTF",
    "CTFChallenge",
    "CTFChallengeFile",
    "CTFHint",
    "CTFHintUnlock",
    "CTFSubmission",
    "CTFParticipation",
]
