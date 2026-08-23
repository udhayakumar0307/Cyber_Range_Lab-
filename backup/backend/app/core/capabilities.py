"""Canonical CyberRange RBAC capabilities and role policy."""

from enum import Enum
from typing import Dict, FrozenSet


class Capability(str, Enum):
    DASHBOARD_VIEW = "DASHBOARD_VIEW"
    COURSE_VIEW = "COURSE_VIEW"
    COURSE_MANAGE = "COURSE_MANAGE"
    ROSTER_VIEW = "ROSTER_VIEW"
    ROSTER_MANAGE = "ROSTER_MANAGE"
    LAB_PURCHASE = "LAB_PURCHASE"
    LAB_ASSIGN = "LAB_ASSIGN"
    PROGRESS_VIEW = "PROGRESS_VIEW"
    GRADE_VIEW = "GRADE_VIEW"
    GRADE_EDIT = "GRADE_EDIT"
    GRADE_PUBLISH = "GRADE_PUBLISH"
    RUBRIC_VIEW = "RUBRIC_VIEW"
    RUBRIC_MANAGE = "RUBRIC_MANAGE"
    REPORT_VIEW = "REPORT_VIEW"
    REPORT_EXPORT = "REPORT_EXPORT"
    CONTENT_MANAGE = "CONTENT_MANAGE"
    CTF_MANAGE = "CTF_MANAGE"
    SYSTEM_ADMIN = "SYSTEM_ADMIN"


CANONICAL_ROLES = {"SYSTEM_ADMIN", "ADMIN", "PROFESSOR", "TA", "STUDENT"}

ROLE_ALIASES = {
    "SUPER_ADMIN": "SYSTEM_ADMIN",
    "SYSADMIN": "SYSTEM_ADMIN",
    "ORGANIZATION_ADMIN": "ADMIN",
    "ORG_ADMIN": "ADMIN",
    "INSTRUCTOR": "PROFESSOR",
    "USER": "STUDENT",
}


def normalize_role(role: str | None) -> str:
    value = (role or "STUDENT").strip().upper()
    value = ROLE_ALIASES.get(value, value)
    return value if value in CANONICAL_ROLES else "STUDENT"


_ACADEMIC_COMMON = frozenset({
    Capability.DASHBOARD_VIEW,
    Capability.COURSE_VIEW,
    Capability.ROSTER_VIEW,
    Capability.LAB_ASSIGN,
    Capability.PROGRESS_VIEW,
    Capability.GRADE_VIEW,
    Capability.REPORT_VIEW,
    Capability.REPORT_EXPORT,
    Capability.RUBRIC_VIEW,
})

ROLE_CAPABILITIES: Dict[str, FrozenSet[Capability]] = {
    "SYSTEM_ADMIN": frozenset(Capability),
    "ADMIN": _ACADEMIC_COMMON | frozenset({
        Capability.COURSE_MANAGE,
        Capability.ROSTER_MANAGE,
        Capability.LAB_PURCHASE,
        Capability.GRADE_EDIT,
        Capability.GRADE_PUBLISH,
        Capability.CONTENT_MANAGE,
        Capability.CTF_MANAGE,
    }),
    "PROFESSOR": _ACADEMIC_COMMON | frozenset({
        Capability.COURSE_MANAGE,
        Capability.ROSTER_MANAGE,
        Capability.LAB_PURCHASE,
        Capability.GRADE_EDIT,
        Capability.GRADE_PUBLISH,
    }),
    "TA": frozenset({
        Capability.DASHBOARD_VIEW,
        Capability.COURSE_VIEW,
        Capability.ROSTER_VIEW,
        Capability.PROGRESS_VIEW,
        Capability.GRADE_VIEW,
        Capability.GRADE_EDIT,
        Capability.REPORT_VIEW,
    }),
    "STUDENT": frozenset(),
}


def capabilities_for_role(role: str | None) -> FrozenSet[Capability]:
    return ROLE_CAPABILITIES.get(normalize_role(role), frozenset())
