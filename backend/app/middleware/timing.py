"""
OPTIMIZATION 7: Request Timing Middleware
==========================================
Adds X-Response-Time header to every API response.
Logs slow requests (> SLOW_REQUEST_THRESHOLD_MS ms) to the application logger.

This middleware is critical for measuring the before/after improvement
of all backend optimizations.

Security: Only timing metadata is captured — no request bodies, no tokens,
no user credentials are logged.
"""

import time
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

# Requests slower than this threshold are logged as warnings
SLOW_REQUEST_THRESHOLD_MS = 200


class TimingMiddleware(BaseHTTPMiddleware):
    """
    Measures wall-clock time for each request and:
    1. Adds X-Response-Time: <ms>ms header to the response.
    2. Logs slow requests (> SLOW_REQUEST_THRESHOLD_MS) as warnings.
    3. Tracks per-endpoint counters for the metrics endpoint.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        # Simple in-process counters (not persisted across restarts)
        self._counters: dict = {}  # path -> {count, total_ms, slow_count}
        self._lock = None  # Lazy init to avoid import-time issues

    def _record(self, path: str, elapsed_ms: float) -> None:
        """Thread-safely update per-path counters."""
        import threading
        if self._lock is None:
            self._lock = threading.Lock()
        with self._lock:
            if path not in self._counters:
                self._counters[path] = {"count": 0, "total_ms": 0.0, "slow_count": 0}
            c = self._counters[path]
            c["count"] += 1
            c["total_ms"] += elapsed_ms
            if elapsed_ms > SLOW_REQUEST_THRESHOLD_MS:
                c["slow_count"] += 1

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        # Add timing header
        response.headers["X-Response-Time"] = f"{elapsed_ms:.1f}ms"

        # Record metrics (only for /api/ paths to avoid noise)
        path = request.url.path
        if path.startswith("/api/"):
            self._record(path, elapsed_ms)

            if elapsed_ms > SLOW_REQUEST_THRESHOLD_MS:
                logger.warning(
                    f"[SLOW REQUEST] {request.method} {path} "
                    f"took {elapsed_ms:.1f}ms > {SLOW_REQUEST_THRESHOLD_MS}ms threshold"
                )

        return response

    def get_stats(self) -> list[dict]:
        """Return per-endpoint statistics sorted by average response time (desc)."""
        import threading
        if self._lock is None:
            return []
        with self._lock:
            rows = []
            for path, c in self._counters.items():
                avg_ms = c["total_ms"] / c["count"] if c["count"] > 0 else 0
                rows.append({
                    "path": path,
                    "count": c["count"],
                    "avg_ms": round(avg_ms, 1),
                    "total_ms": round(c["total_ms"], 1),
                    "slow_count": c["slow_count"],
                })
            rows.sort(key=lambda r: r["avg_ms"], reverse=True)
            return rows


# Module-level singleton — imported by main.py and metrics endpoint
timing_middleware_instance: TimingMiddleware | None = None
