"""Point #8 reporting visibility adapter backed by scoped RBAC."""

from __future__ import annotations

from typing import Iterable, Set

from sqlalchemy.orm import Session

from app.core.capabilities import Capability
from app.models.user import User
from app.services.authorization_service import AuthorizationService


class ReportingScopeService:
    @staticmethod
    def visible_user_ids(
        db: Session,
        current_user,
        candidate_user_ids: Iterable[int],
        capability: Capability | str = Capability.REPORT_VIEW,
    ) -> Set[int]:
        visible: Set[int] = set()
        for user_id in {int(value) for value in candidate_user_ids}:
            target = db.query(User).filter(User.id == user_id).first()
            if target and AuthorizationService.can_access_user(
                db, current_user, target, capability
            ):
                visible.add(user_id)
        return visible
