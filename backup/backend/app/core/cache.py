"""
OPTIMIZATION 6: In-Process TTL Cache
=====================================
Thread-safe in-process TTL cache for read-heavy, rarely-changing endpoints.

Security Rules (enforced):
- NEVER cache: JWT tokens, passwords, payment data, audit logs, security events,
  user permissions, per-user sensitive data.
- ONLY cache: dashboard aggregates, leaderboard pages, lab metadata,
  organization metadata, public catalog data.

Cache key naming convention (as specified in performance rules):
  dashboard:{organization_id} or dashboard:user:{user_id}
  leaderboard:{organization_id}:{type}:page:{n}
  lab:{lab_id}
  organization:{organization_id}

TTL values:
  Dashboard stats   → 120 seconds (2 min)
  Leaderboard pages → 300 seconds (5 min)
  Lab metadata      → 600 seconds (10 min)
  Organization data → 300 seconds (5 min)
"""

import threading
import time
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TTLCache:
    """
    Simple thread-safe in-memory TTL cache.
    No external dependencies — pure Python.

    Keys map to (value, expiry_timestamp) tuples.
    Expired entries are lazily evicted on get() or explicitly via invalidate().
    """

    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = threading.RLock()
        self.default_ttl = default_ttl
        self.max_size = max_size
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        """Return cached value if key exists and has not expired. None otherwise."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            value, expiry = entry
            if time.monotonic() > expiry:
                del self._store[key]
                self._misses += 1
                return None
            self._hits += 1
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Store a value with a TTL (seconds). Evicts oldest entry if at max_size."""
        effective_ttl = ttl if ttl is not None else self.default_ttl
        expiry = time.monotonic() + effective_ttl
        with self._lock:
            # Evict one expired entry if at capacity
            if len(self._store) >= self.max_size:
                self._evict_one()
            self._store[key] = (value, expiry)

    def invalidate(self, key: str) -> bool:
        """Remove a specific key. Returns True if it existed."""
        with self._lock:
            existed = key in self._store
            self._store.pop(key, None)
            return existed

    def invalidate_pattern(self, prefix: str) -> int:
        """Remove all keys that start with the given prefix. Returns count removed."""
        with self._lock:
            keys_to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._store[k]
            if keys_to_delete:
                logger.debug(f"[Cache] Invalidated {len(keys_to_delete)} keys with prefix '{prefix}'")
            return len(keys_to_delete)

    def _evict_one(self) -> None:
        """Evict the entry nearest to expiry. Called under lock."""
        now = time.monotonic()
        # First, try to remove any already-expired entry
        for k, (_, expiry) in list(self._store.items()):
            if now > expiry:
                del self._store[k]
                return
        # If none expired, remove the one expiring soonest
        if self._store:
            oldest_key = min(self._store, key=lambda k: self._store[k][1])
            del self._store[oldest_key]

    def stats(self) -> dict:
        """Return cache statistics for the metrics endpoint."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = round(self._hits / total * 100, 1) if total > 0 else 0.0
            return {
                "size": len(self._store),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_pct": hit_rate,
            }

    def flush(self) -> None:
        """Clear all entries (useful for testing)."""
        with self._lock:
            self._store.clear()


# ─── Module-level singleton instances ─────────────────────────────────────────

# Dashboard stats cache — 2 min TTL
dashboard_cache = TTLCache(default_ttl=120, max_size=500)

# Leaderboard pages cache — 5 min TTL
leaderboard_cache = TTLCache(default_ttl=300, max_size=200)

# Lab metadata cache — 10 min TTL
lab_cache = TTLCache(default_ttl=600, max_size=300)

# Organization metadata cache — 5 min TTL
org_cache = TTLCache(default_ttl=300, max_size=100)


# ─── Key builders (versioned, namespaced) ─────────────────────────────────────

def dashboard_key(user_id: int) -> str:
    """Cache key for user dashboard aggregates."""
    return f"dashboard:user:{user_id}"

def progress_stats_key(user_id: int) -> str:
    """Cache key for user progress statistics (progress_service)."""
    return f"progress_stats:user:{user_id}"

def leaderboard_key(org_id: Optional[int], lb_type: str, page: int, limit: int) -> str:
    """Cache key for leaderboard pages."""
    org_part = str(org_id) if org_id else "global"
    return f"leaderboard:{org_part}:{lb_type}:page:{page}:limit:{limit}"

def lab_key(lab_id: str) -> str:
    """Cache key for lab metadata."""
    return f"lab:{lab_id}"

def org_key(org_id: int) -> str:
    """Cache key for organization metadata."""
    return f"organization:{org_id}"


# ─── Convenience functions ────────────────────────────────────────────────────

def invalidate_dashboard(user_id: int) -> None:
    """Call after flag submit or profile update to purge stale dashboard stats."""
    dashboard_cache.invalidate(dashboard_key(user_id))
    dashboard_cache.invalidate(progress_stats_key(user_id))
    dashboard_cache.invalidate(f"achievements:user:{user_id}")
    logger.debug(f"[Cache] Invalidated dashboard, progress stats & achievements cache for user_id={user_id}")

def invalidate_leaderboard() -> None:
    """Call after score update to purge leaderboard pages."""
    leaderboard_cache.invalidate_pattern("leaderboard:")
    logger.debug("[Cache] Invalidated all leaderboard cache entries")

def invalidate_lab(lab_id: str) -> None:
    """Call after lab update/delete to purge lab metadata cache."""
    lab_cache.invalidate(lab_key(lab_id))

def invalidate_org(org_id: int) -> None:
    """Call after org profile update to purge org cache."""
    org_cache.invalidate(org_key(org_id))

def get_all_cache_stats() -> dict:
    """Return stats from all caches — used by the metrics endpoint."""
    return {
        "dashboard": dashboard_cache.stats(),
        "leaderboard": leaderboard_cache.stats(),
        "lab": lab_cache.stats(),
        "organization": org_cache.stats(),
    }
