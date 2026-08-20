"""
Redis-backed active session registry.

Stores:   session:{user_id}:{lab_id}  ->  JSON {task_arn, student_host, student_port, lab_seed}
TTL:      8 hours (auto-expires stale sessions after a lab window)
"""
import json
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)
_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        import redis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis = redis.from_url(url, decode_responses=True)
    return _redis


SESSION_TTL = 8 * 3600  # 8 hours


def save_session(user_id: str, lab_id: str, data: Dict[str, Any]) -> None:
    """Store session routing metadata in Redis with an 8-hour TTL."""
    try:
        key = f"session:{user_id}:{lab_id}"
        _get_redis().setex(key, SESSION_TTL, json.dumps(data))
        logger.info(f"[SessionStore] Saved session for user={user_id} lab={lab_id}")
    except Exception as exc:
        logger.error(f"[SessionStore] Failed to save session for user={user_id}: {exc}")


def get_session(user_id: str, lab_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve session routing metadata from Redis."""
    try:
        key = f"session:{user_id}:{lab_id}"
        raw = _get_redis().get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.error(f"[SessionStore] Failed to get session for user={user_id}: {exc}")
    return None


def delete_session(user_id: str, lab_id: str) -> None:
    """Delete session routing metadata from Redis."""
    try:
        key = f"session:{user_id}:{lab_id}"
        _get_redis().delete(key)
        logger.info(f"[SessionStore] Deleted session for user={user_id} lab={lab_id}")
    except Exception as exc:
        logger.error(f"[SessionStore] Failed to delete session for user={user_id}: {exc}")
