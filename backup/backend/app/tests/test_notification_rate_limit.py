import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi import HTTPException

from app.api.v1.endpoints import notifications_api


class NotificationRateLimitTests(unittest.TestCase):
    def setUp(self):
        notifications_api._RATE_LIMIT.clear()

    def _empty_db(self):
        """
        Minimal SQLAlchemy-like mock for read-only notification endpoints.
        All notification queries return no rows/counts.
        """
        db = MagicMock()

        query = MagicMock()
        query.count.return_value = 0
        query.all.return_value = []

        filtered = MagicMock()
        filtered.count.return_value = 0
        filtered.all.return_value = []

        ordered = MagicMock()
        ordered.all.return_value = []

        offset = MagicMock()
        limited = MagicMock()
        limited.all.return_value = []

        query.filter.return_value = filtered

        filtered.filter.return_value = filtered
        filtered.order_by.return_value = ordered

        ordered.offset.return_value = offset
        ordered.limit.return_value = limited

        offset.limit.return_value = limited

        db.query.return_value = query
        return db

    def test_repeated_notification_reads_are_not_rate_limited(self):
        """
        React StrictMode, retries, tabs, or ordinary refreshes may legitimately
        issue back-to-back notification GETs. Reads must not return 429.
        """
        user = SimpleNamespace(id=42)
        db = self._empty_db()

        for _ in range(2):
            result = notifications_api.list_notifications(
                unread_only=False,
                category=None,
                priority=None,
                search=None,
                page=1,
                limit=10,
                current_user=user,
                db=db,
            )
            self.assertEqual(result["items"], [])
            self.assertEqual(result["total"], 0)
            self.assertEqual(result["unread_count"], 0)

        for _ in range(2):
            result = notifications_api.get_unread_notifications(
                current_user=user,
                db=db,
            )
            self.assertEqual(result["items"], [])
            self.assertEqual(result["unread_count"], 0)

    def test_different_mutations_do_not_throttle_each_other(self):
        notifications_api._limit(42, "mark-read")

        # A different user action immediately afterward must remain valid.
        notifications_api._limit(42, "delete")

    def test_repeated_same_mutation_is_rate_limited(self):
        notifications_api._limit(42, "mark-read")

        with self.assertRaises(HTTPException) as ctx:
            notifications_api._limit(42, "mark-read")

        self.assertEqual(ctx.exception.status_code, 429)

    def test_rate_limit_is_scoped_per_user(self):
        notifications_api._limit(42, "mark-read")

        # Another user's mutation must never share the first user's bucket.
        notifications_api._limit(43, "mark-read")


if __name__ == "__main__":
    unittest.main()
