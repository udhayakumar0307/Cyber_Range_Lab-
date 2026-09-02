"""Point #10 assignment-time contract acceptance test."""

from datetime import datetime

from app.core.assignment_time import (
    format_utc_for_zone,
    parse_client_datetime,
    utc_iso,
)


print("=" * 80)
print("POINT #10 ASSIGNMENT TIMEZONE ACCEPTANCE TEST")
print("=" * 80)

india = parse_client_datetime(
    "2026-08-23T10:00:00+05:30",
    field_name="start_datetime",
)
assert india == datetime(2026, 8, 23, 4, 30, 0)
assert india.tzinfo is None
print("✅ CASE A: +05:30 client time normalizes to naive UTC")

chicago = parse_client_datetime(
    "2026-08-23T10:00:00-05:00",
    field_name="start_datetime",
)
assert chicago == datetime(2026, 8, 23, 15, 0, 0)
print("✅ CASE B: negative UTC offset normalizes correctly")

zulu = parse_client_datetime(
    "2026-08-23T04:30:00Z",
    field_name="start_datetime",
)
assert zulu == datetime(2026, 8, 23, 4, 30, 0)
print("✅ CASE C: explicit Z input remains the same UTC instant")

try:
    parse_client_datetime(
        "2026-08-23T10:00:00",
        field_name="start_datetime",
    )
except ValueError as exc:
    assert "timezone offset" in str(exc)
else:
    raise AssertionError("Naive client datetime was incorrectly accepted.")
print("✅ CASE D: naive client datetimes fail closed")

assert utc_iso(datetime(2026, 8, 23, 4, 30, 0)) == "2026-08-23T04:30:00Z"
print("✅ CASE E: database UTC serializes with an explicit Z")

date_str, time_str, zone = format_utc_for_zone(
    datetime(2026, 8, 23, 4, 30, 0),
    "Asia/Kolkata",
)
assert date_str == "2026-08-23"
assert time_str == "10:00 AM"
assert zone == "IST"
print("✅ CASE F: notification time converts back to the professor's IANA timezone")

print("=" * 80)
print("✅ ALL POINT #10 ASSIGNMENT TIMEZONE TESTS PASSED")
print("=" * 80)
