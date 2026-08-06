"""
Production Notification REST API Endpoints & Real-time WebSocket Gateway.
Supports pagination, search filtering, priority filtering, mark read, mark all read, clear all, soft delete, and preferences.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.notification import Notification, NotificationPreference
from app.models.user import User
from app.services.notification_service import ws_manager

router = APIRouter()
_RATE_LIMIT = {}


def _limit(user_id: int):
    now = datetime.utcnow()
    last = _RATE_LIMIT.get(user_id)
    if last and now - last < timedelta(milliseconds=500):
        raise HTTPException(status_code=429, detail="Notification requests are rate limited. Please retry shortly.")
    _RATE_LIMIT[user_id] = now


# ─── Pydantic Schemas ────────────────────────────────────────────────────────
class PreferenceUpdate(BaseModel):
    email_enabled: bool = True
    sms_enabled: bool = False
    push_enabled: bool = True
    phone_number: Optional[str] = Field(default=None, max_length=32)


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
def list_notifications(
    unread_only: bool = Query(default=False),
    category: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns user notification list with pagination, search, category, and priority filtering.
    """
    _limit(current_user.id)
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.soft_deleted.is_(False)
    )

    if unread_only:
        query = query.filter(Notification.read.is_(False))
    if category and category.upper() != "ALL":
        query = query.filter(Notification.type == category.upper())
    if priority and priority.upper() != "ALL":
        query = query.filter(Notification.priority == priority.upper())
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(Notification.title.ilike(term), Notification.message.ilike(term)))

    total_count = query.count()
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read.is_(False),
        Notification.soft_deleted.is_(False)
    ).count()

    items = query.order_by(Notification.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    formatted_items = []
    for item in items:
        formatted_items.append({
            "id": item.id,
            "title": item.title,
            "message": item.message,
            "type": item.type or "SYSTEM",
            "priority": item.priority or "MEDIUM",
            "action_url": item.action_url,
            "status": item.status,
            "read": bool(item.read or item.read_at is not None),
            "read_at": item.read_at.isoformat() if item.read_at else None,
            "created_at": item.created_at.isoformat() if item.created_at else datetime.utcnow().isoformat(),
            "email_sent": bool(item.email_sent),
            "sms_sent": bool(item.sms_sent),
            "meta_data": item.meta_data or {}
        })

    return {
        "items": formatted_items,
        "total": total_count,
        "unread_count": unread_count,
        "page": page,
        "limit": limit
    }


@router.get("/unread")
def get_unread_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns unread notifications summary and badge count."""
    _limit(current_user.id)
    unread_items = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read.is_(False),
        Notification.soft_deleted.is_(False)
    ).order_by(Notification.created_at.desc()).limit(20).all()

    return {
        "unread_count": len(unread_items),
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "priority": n.priority,
                "action_url": n.action_url,
                "created_at": n.created_at.isoformat() if n.created_at else ""
            }
            for n in unread_items
        ]
    }


@router.get("/count")
def get_notification_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fast unread notification badge counter."""
    cnt = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read.is_(False),
        Notification.soft_deleted.is_(False)
    ).count()
    return {"unread_count": cnt}


@router.post("/{notification_id}/read")
@router.post("/read/{notification_id}")
def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marks a single notification as read."""
    _limit(current_user.id)
    item = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found.")

    item.read = True
    item.read_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": f"Notification {notification_id} marked as read."}


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marks all notifications for the user as read."""
    _limit(current_user.id)
    now = datetime.utcnow()
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read.is_(False)
    ).update({"read": True, "read_at": now}, synchronize_session=False)
    db.commit()
    return {"status": "success", "message": "All notifications marked as read."}


@router.delete("/clear")
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft-deletes all notifications for the authenticated user."""
    _limit(current_user.id)
    db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).update({"soft_deleted": True}, synchronize_session=False)
    db.commit()
    return {"status": "success", "message": "All notifications cleared successfully."}


@router.delete("/{notification_id}")
def delete_single_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft-deletes a single notification."""
    _limit(current_user.id)
    item = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found.")

    item.soft_deleted = True
    db.commit()
    return {"status": "success", "message": f"Notification {notification_id} deleted."}


@router.get("/preferences")
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves user notification preferences."""
    pref = db.query(NotificationPreference).filter_by(user_id=current_user.id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id, email_enabled=True, sms_enabled=False, push_enabled=True)
        db.add(pref)
        db.commit()

    return {
        "email_enabled": bool(pref.email_enabled),
        "sms_enabled": bool(pref.sms_enabled),
        "push_enabled": bool(pref.push_enabled),
        "phone_number": pref.phone_number or getattr(current_user, "phone", "")
    }


@router.put("/preferences")
def update_preferences(
    payload: PreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates user notification preferences (In-App, Email, SMS)."""
    _limit(current_user.id)
    if payload.sms_enabled and not payload.phone_number:
        raise HTTPException(status_code=422, detail="Phone number is required when SMS alerts are enabled.")

    pref = db.query(NotificationPreference).filter_by(user_id=current_user.id).first()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    pref.email_enabled = payload.email_enabled
    pref.sms_enabled = payload.sms_enabled
    pref.push_enabled = payload.push_enabled
    pref.phone_number = payload.phone_number
    db.commit()
    return {"status": "success", "message": "Notification preferences updated successfully."}


# ─── WebSocket Endpoint for Real-time Notification Streaming ─────────────────
@router.websocket("/ws")
async def notification_websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """WebSocket endpoint for real-time notification push to frontend bell & badge."""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token required")
        return
    try:
        from app.core.security import decode_access_token
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return
        user_id = int(user_id_str)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token verification failed")
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # Keepalive ping/pong listener
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)
