from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def to_ist(dt: datetime) -> datetime:
    """
    Converts a naive UTC datetime (the app-wide convention - see datetime.utcnow()
    usage throughout the codebase) to naive IST wall-clock time, for display
    purposes such as the completion date printed on a certificate.
    """
    return dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(IST).replace(tzinfo=None)


def now_ist() -> datetime:
    """
    Naive current IST wall-clock time.

    Admin-submitted schedule fields (Assignment.start_datetime/end_datetime) are stored
    as naive datetimes taken directly from the browser's local input with no timezone
    conversion applied - i.e. they represent IST wall-clock values. The server itself
    runs in UTC, so datetime.now() returns naive UTC and is ~5.5 hours behind those
    stored values. Use this helper instead wherever "now" needs to be compared against
    an admin-entered schedule datetime.
    """
    return datetime.now(IST).replace(tzinfo=None)
