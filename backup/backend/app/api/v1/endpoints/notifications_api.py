"""Authenticated notification inbox and preference controls."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.notification import Notification, NotificationPreference
from app.models.user import User

router = APIRouter()
_RATE_LIMIT = {}


def _limit(user_id: int):
    now = datetime.utcnow()
    last = _RATE_LIMIT.get(user_id)
    if last and now - last < timedelta(seconds=2):
        raise HTTPException(status_code=429, detail="Notification requests are rate limited. Please retry shortly.")
    _RATE_LIMIT[user_id] = now


class PreferenceUpdate(BaseModel):
    email_enabled: bool = True
    sms_enabled: bool = False
    push_enabled: bool = True
    phone_number: Optional[str] = Field(default=None, max_length=32)


@router.get("")
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _limit(current_user.id)
    return [{"id": item.id, "title": item.title, "message": item.message, "type": item.type,
             "status": item.status, "created_at": item.created_at, "read_at": item.read_at}
            for item in db.query(Notification).filter(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc()).limit(100).all()]


@router.put("/preferences")
def update_preferences(payload: PreferenceUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _limit(current_user.id)
    if payload.sms_enabled and not payload.phone_number:
        raise HTTPException(status_code=422, detail="phone_number is required when SMS notifications are enabled.")
    preference = db.query(NotificationPreference).filter_by(user_id=current_user.id).first()
    if not preference:
        preference = NotificationPreference(user_id=current_user.id)
        db.add(preference)
    preference.email_enabled = payload.email_enabled
    preference.sms_enabled = payload.sms_enabled
    preference.push_enabled = payload.push_enabled
    preference.phone_number = payload.phone_number
    db.commit()
    return {"status": "success"}


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _limit(current_user.id)
    item = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found.")
    item.read_at = datetime.utcnow()
    db.commit()
    return {"status": "success"}
