"""Assignment scheduling time contract.

Database contract
-----------------
The existing Assignment DateTime columns remain timezone-naive. From Point #10
forward, every value written to those columns represents UTC.

API contract
------------
Client scheduling timestamps MUST carry an explicit UTC offset (``Z`` or
``+/-HH:MM``). Values are normalized to naive UTC before persistence.
Assignment timestamps sent back to clients are serialized with ``Z`` so browser
Date parsing is unambiguous.

Historical rows are intentionally not rewritten because older clients stored a
mixture of local-naive and UTC-naive values.
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc


def utc_now_naive() -> datetime:
    """Current UTC instant represented in the database's naive-UTC convention."""
    return datetime.now(UTC).replace(tzinfo=None)


def parse_client_datetime(value: str, *, field_name: str = "datetime") -> datetime:
    """
    Parse an ISO-8601 client timestamp and normalize it to naive UTC.

    Naive inputs are rejected instead of being guessed as server-local time.
    """
    raw = (value or "").strip()
    if not raw:
        raise ValueError(f"{field_name} is required.")

    normalized = raw[:-1] + "+00:00" if raw.endswith(("Z", "z")) else raw

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(
            f"{field_name} must be a valid ISO-8601 datetime with a timezone offset."
        ) from exc

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(
            f"{field_name} must include a timezone offset, for example "
            f"'2026-08-23T10:00:00+05:30' or '2026-08-23T04:30:00Z'."
        )

    return parsed.astimezone(UTC).replace(tzinfo=None)


def utc_iso(value: datetime | None) -> str | None:
    """Serialize a database UTC datetime as explicit ISO-8601 UTC."""
    if value is None:
        return None

    if value.tzinfo is None or value.utcoffset() is None:
        aware = value.replace(tzinfo=UTC)
    else:
        aware = value.astimezone(UTC)

    return aware.isoformat(timespec="seconds").replace("+00:00", "Z")


def localize_utc(value: datetime, timezone_name: str | None) -> datetime:
    """Convert a database UTC datetime to an IANA timezone; invalid zones use UTC."""
    if value.tzinfo is None or value.utcoffset() is None:
        aware = value.replace(tzinfo=UTC)
    else:
        aware = value.astimezone(UTC)

    try:
        target = ZoneInfo(timezone_name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        target = ZoneInfo("UTC")

    return aware.astimezone(target)


def format_utc_for_zone(
    value: datetime,
    timezone_name: str | None,
) -> tuple[str, str, str]:
    """Return date, clock time, and zone label for user-facing notifications."""
    local = localize_utc(value, timezone_name)
    zone_label = local.tzname() or (timezone_name or "UTC")
    return (
        local.strftime("%Y-%m-%d"),
        local.strftime("%I:%M %p"),
        zone_label,
    )
