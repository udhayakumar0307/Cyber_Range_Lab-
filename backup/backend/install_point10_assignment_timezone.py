#!/usr/bin/env python3
# Point #10 — canonical assignment timezone handling.
# Run from ~/Cyber_Range_Lab-/backup/backend
# No Alembic migration: the existing Assignment DateTime columns remain naive UTC.

from pathlib import Path
import datetime
import py_compile
import sys
import tempfile

ROOT = Path.cwd().resolve()
FRONTEND = (ROOT / "..").resolve()

FILES = {
    "admin": ROOT / "app/api/v1/endpoints/admin_api.py",
    "reporting": ROOT / "app/api/v1/endpoints/reporting.py",
    "user_profile": ROOT / "app/api/v1/endpoints/user_profile.py",
    "gradebook": ROOT / "app/services/gradebook_service.py",
    "lab": FRONTEND / "src/pages/admin/LabAllocation.tsx",
    "monitoring": FRONTEND / "src/pages/admin/MonitoringAnalytics.tsx",
}

missing = [str(p) for p in FILES.values() if not p.exists()]
if missing:
    print("ERROR: run from ~/Cyber_Range_Lab-/backup/backend")
    for p in missing:
        print(" -", p)
    sys.exit(1)

stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

def backup(path):
    dst = path.with_name(path.name + f".before_point10_{stamp}")
    dst.write_bytes(path.read_bytes())
    print("Backup:", dst)

def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        backup(path)
    path.write_text(content)
    print("Wrote:", path)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(old, new, 1)

CORE = '"""Assignment scheduling time contract.\n\nDatabase contract\n-----------------\nThe existing Assignment DateTime columns remain timezone-naive. From Point #10\nforward, every value written to those columns represents UTC.\n\nAPI contract\n------------\nClient scheduling timestamps MUST carry an explicit UTC offset (``Z`` or\n``+/-HH:MM``). Values are normalized to naive UTC before persistence.\nAssignment timestamps sent back to clients are serialized with ``Z`` so browser\nDate parsing is unambiguous.\n\nHistorical rows are intentionally not rewritten because older clients stored a\nmixture of local-naive and UTC-naive values.\n"""\n\nfrom __future__ import annotations\n\nfrom datetime import datetime, timezone\nfrom zoneinfo import ZoneInfo, ZoneInfoNotFoundError\n\nUTC = timezone.utc\n\n\ndef utc_now_naive() -> datetime:\n    """Current UTC instant represented in the database\'s naive-UTC convention."""\n    return datetime.now(UTC).replace(tzinfo=None)\n\n\ndef parse_client_datetime(value: str, *, field_name: str = "datetime") -> datetime:\n    """\n    Parse an ISO-8601 client timestamp and normalize it to naive UTC.\n\n    Naive inputs are rejected instead of being guessed as server-local time.\n    """\n    raw = (value or "").strip()\n    if not raw:\n        raise ValueError(f"{field_name} is required.")\n\n    normalized = raw[:-1] + "+00:00" if raw.endswith(("Z", "z")) else raw\n\n    try:\n        parsed = datetime.fromisoformat(normalized)\n    except ValueError as exc:\n        raise ValueError(\n            f"{field_name} must be a valid ISO-8601 datetime with a timezone offset."\n        ) from exc\n\n    if parsed.tzinfo is None or parsed.utcoffset() is None:\n        raise ValueError(\n            f"{field_name} must include a timezone offset, for example "\n            f"\'2026-08-23T10:00:00+05:30\' or \'2026-08-23T04:30:00Z\'."\n        )\n\n    return parsed.astimezone(UTC).replace(tzinfo=None)\n\n\ndef utc_iso(value: datetime | None) -> str | None:\n    """Serialize a database UTC datetime as explicit ISO-8601 UTC."""\n    if value is None:\n        return None\n\n    if value.tzinfo is None or value.utcoffset() is None:\n        aware = value.replace(tzinfo=UTC)\n    else:\n        aware = value.astimezone(UTC)\n\n    return aware.isoformat(timespec="seconds").replace("+00:00", "Z")\n\n\ndef localize_utc(value: datetime, timezone_name: str | None) -> datetime:\n    """Convert a database UTC datetime to an IANA timezone; invalid zones use UTC."""\n    if value.tzinfo is None or value.utcoffset() is None:\n        aware = value.replace(tzinfo=UTC)\n    else:\n        aware = value.astimezone(UTC)\n\n    try:\n        target = ZoneInfo(timezone_name or "UTC")\n    except (ZoneInfoNotFoundError, ValueError):\n        target = ZoneInfo("UTC")\n\n    return aware.astimezone(target)\n\n\ndef format_utc_for_zone(\n    value: datetime,\n    timezone_name: str | None,\n) -> tuple[str, str, str]:\n    """Return date, clock time, and zone label for user-facing notifications."""\n    local = localize_utc(value, timezone_name)\n    zone_label = local.tzname() or (timezone_name or "UTC")\n    return (\n        local.strftime("%Y-%m-%d"),\n        local.strftime("%I:%M %p"),\n        zone_label,\n    )\n'
FRONT_UTILS = "/**\n * Point #10 assignment scheduling contract.\n *\n * datetime-local controls represent the user's browser-local wall clock.\n * Convert that wall clock to an explicit UTC ISO string before sending it.\n */\n\nconst pad2 = (value: number) => value.toString().padStart(2, '0');\n\nexport const getBrowserTimeZone = (): string =>\n  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';\n\nexport const localDateTimeToUtcIso = (\n  date: string,\n  time: string\n): string => {\n  const local = new Date(`${date}T${time}:00`);\n  if (Number.isNaN(local.getTime())) {\n    throw new Error('Invalid local date/time.');\n  }\n  return local.toISOString();\n};\n\nexport const addMinutesUtcIso = (\n  utcIso: string,\n  minutes: number\n): string => {\n  const start = new Date(utcIso);\n  if (Number.isNaN(start.getTime())) {\n    throw new Error('Invalid UTC datetime.');\n  }\n  if (!Number.isFinite(minutes) || minutes <= 0) {\n    throw new Error('Duration must be greater than zero.');\n  }\n  return new Date(start.getTime() + minutes * 60_000).toISOString();\n};\n\nexport const utcIsoToLocalInput = (\n  utcIso: string\n): { date: string; time: string } => {\n  const value = new Date(utcIso);\n  if (Number.isNaN(value.getTime())) {\n    throw new Error('Invalid UTC datetime.');\n  }\n\n  return {\n    date: `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`,\n    time: `${pad2(value.getHours())}:${pad2(value.getMinutes())}`,\n  };\n};\n\nexport const formatUtcIsoLocal = (utcIso?: string | null): string => {\n  if (!utcIso) return 'N/A';\n  const value = new Date(utcIso);\n  return Number.isNaN(value.getTime())\n    ? utcIso\n    : value.toLocaleString();\n};\n"
TEST_TIME = '"""Point #10 assignment-time contract acceptance test."""\n\nfrom datetime import datetime\n\nfrom app.core.assignment_time import (\n    format_utc_for_zone,\n    parse_client_datetime,\n    utc_iso,\n)\n\n\nprint("=" * 80)\nprint("POINT #10 ASSIGNMENT TIMEZONE ACCEPTANCE TEST")\nprint("=" * 80)\n\nindia = parse_client_datetime(\n    "2026-08-23T10:00:00+05:30",\n    field_name="start_datetime",\n)\nassert india == datetime(2026, 8, 23, 4, 30, 0)\nassert india.tzinfo is None\nprint("✅ CASE A: +05:30 client time normalizes to naive UTC")\n\nchicago = parse_client_datetime(\n    "2026-08-23T10:00:00-05:00",\n    field_name="start_datetime",\n)\nassert chicago == datetime(2026, 8, 23, 15, 0, 0)\nprint("✅ CASE B: negative UTC offset normalizes correctly")\n\nzulu = parse_client_datetime(\n    "2026-08-23T04:30:00Z",\n    field_name="start_datetime",\n)\nassert zulu == datetime(2026, 8, 23, 4, 30, 0)\nprint("✅ CASE C: explicit Z input remains the same UTC instant")\n\ntry:\n    parse_client_datetime(\n        "2026-08-23T10:00:00",\n        field_name="start_datetime",\n    )\nexcept ValueError as exc:\n    assert "timezone offset" in str(exc)\nelse:\n    raise AssertionError("Naive client datetime was incorrectly accepted.")\nprint("✅ CASE D: naive client datetimes fail closed")\n\nassert utc_iso(datetime(2026, 8, 23, 4, 30, 0)) == "2026-08-23T04:30:00Z"\nprint("✅ CASE E: database UTC serializes with an explicit Z")\n\ndate_str, time_str, zone = format_utc_for_zone(\n    datetime(2026, 8, 23, 4, 30, 0),\n    "Asia/Kolkata",\n)\nassert date_str == "2026-08-23"\nassert time_str == "10:00 AM"\nassert zone == "IST"\nprint("✅ CASE F: notification time converts back to the professor\'s IANA timezone")\n\nprint("=" * 80)\nprint("✅ ALL POINT #10 ASSIGNMENT TIMEZONE TESTS PASSED")\nprint("=" * 80)\n'
TEST_STATIC = '"""Static Point #10 contract checks against the installed source tree."""\n\nfrom pathlib import Path\n\nROOT = Path(__file__).resolve().parents[1]\nFRONTEND = ROOT.parent\n\nadmin = (ROOT / "app/api/v1/endpoints/admin_api.py").read_text()\nreporting = (ROOT / "app/api/v1/endpoints/reporting.py").read_text()\nuser_profile = (ROOT / "app/api/v1/endpoints/user_profile.py").read_text()\ngradebook = (ROOT / "app/services/gradebook_service.py").read_text()\nlab = (FRONTEND / "src/pages/admin/LabAllocation.tsx").read_text()\nmonitoring = (FRONTEND / "src/pages/admin/MonitoringAnalytics.tsx").read_text()\nutils = (FRONTEND / "src/utils/assignmentTime.ts").read_text()\n\nprint("=" * 80)\nprint("POINT #10 STATIC ASSIGNMENT TIME CONTRACT")\nprint("=" * 80)\n\nassert ".replace(\'Z\', \'\')" not in admin\nassert \'parse_client_datetime(\' in admin\nprint("✅ CASE G: backend no longer strips timezone offsets from assignment writes")\n\nassert \'utc_now_naive()\' in admin\nassert \'now_ist()\' not in admin\nprint("✅ CASE H: professor assignment status/control uses UTC clock")\n\nassert \'now_ist()\' not in reporting\nassert \'now_ist()\' not in user_profile\nprint("✅ CASE I: reporting and student assignment status use UTC clock")\n\nassert \'utc_iso(a.start_datetime)\' in admin\nassert \'utc_iso(a.end_datetime)\' in admin\nassert \'"start_datetime": utc_iso(\' in user_profile\nassert \'"end_datetime": utc_iso(\' in user_profile\nassert \'utc_iso(assignment.start_datetime)\' in gradebook\nassert \'utc_iso(assignment.end_datetime)\' in gradebook\nprint("✅ CASE J: assignment APIs serialize explicit UTC instead of naive ISO")\n\nassert \'localDateTimeToUtcIso\' in lab\nassert \'addMinutesUtcIso\' in lab\nassert \'utcIsoToLocalInput\' in lab\nassert \'getBrowserTimeZone\' in lab\nassert "toISOString().split(\'.\')[0]" not in lab\nprint("✅ CASE K: browser-local assignment form converts both ends to explicit UTC")\n\nassert \'formatUtcIsoLocal\' in monitoring\nprint("✅ CASE L: monitoring renders assignment timestamps in browser local time")\n\nassert "return local.toISOString();" in utils\nprint("✅ CASE M: shared frontend helper preserves explicit UTC Z")\n\ncontext_path = ROOT / "app/services/assignment_context_service.py"\nif context_path.exists():\n    context = context_path.read_text()\n    assert \'now_ist()\' not in context\n    assert \'datetime.utcnow()\' not in context\n    print("✅ CASE N: assignment-context resolution uses canonical UTC clock")\nelse:\n    print("ℹ️  CASE N: assignment_context_service.py not present in this checkout")\n\nprint("=" * 80)\nprint("✅ ALL POINT #10 STATIC CONTRACT TESTS PASSED")\nprint("=" * 80)\n'
P = {'admin_status_old': '        # Calculate derived status\n        from app.core.timezone_utils import now_ist\n        now = now_ist()\n', 'admin_status_new': '        # Point #10: Assignment DateTime columns are UTC-naive.\n        from app.core.assignment_time import utc_now_naive, utc_iso\n        now = utc_now_naive()\n', 'create_old': "    from app.models.assignment import Assignment\n    from app.models.admin_models import PurchasedLab\n    from datetime import datetime, timedelta\n\n    start_dt = datetime.fromisoformat(data.start_datetime.replace('Z', ''))\n    duration = data.duration_minutes or 60\n    end_dt = start_dt + timedelta(minutes=duration)\n", 'create_new': '    from app.models.assignment import Assignment\n    from app.models.admin_models import PurchasedLab\n    from app.core.assignment_time import parse_client_datetime\n    from datetime import timedelta\n\n    try:\n        start_dt = parse_client_datetime(\n            data.start_datetime,\n            field_name="start_datetime",\n        )\n    except ValueError as exc:\n        raise HTTPException(status_code=422, detail=str(exc))\n\n    duration = int(data.duration_minutes or 60)\n    if duration <= 0:\n        raise HTTPException(\n            status_code=422,\n            detail="duration_minutes must be greater than zero.",\n        )\n\n    end_dt = start_dt + timedelta(minutes=duration)\n\n    if data.end_datetime:\n        try:\n            supplied_end = parse_client_datetime(\n                data.end_datetime,\n                field_name="end_datetime",\n            )\n        except ValueError as exc:\n            raise HTTPException(status_code=422, detail=str(exc))\n\n        if abs((supplied_end - end_dt).total_seconds()) > 1:\n            raise HTTPException(\n                status_code=422,\n                detail="end_datetime must match start_datetime + duration_minutes.",\n            )\n', 'notify_old': '                date_str = start_dt.strftime("%Y-%m-%d")\n                time_str = start_dt.strftime("%I:%M %p") + " (IST)"\n                dur_str = f"{duration} mins"\n', 'notify_new': '                from app.core.assignment_time import format_utc_for_zone\n                date_str, local_time, zone_label = format_utc_for_zone(\n                    start_dt,\n                    data.timezone,\n                )\n                time_str = f"{local_time} ({zone_label})"\n                dur_str = f"{duration} mins"\n', 'update_old': "    a.lab_id = data.lab_id\n    a.start_datetime = datetime.fromisoformat(data.start_datetime.replace('Z', ''))\n    a.end_datetime = datetime.fromisoformat(data.end_datetime.replace('Z', ''))\n    db.commit()\n", 'update_new': '    from app.core.assignment_time import parse_client_datetime\n\n    try:\n        start_dt = parse_client_datetime(\n            data.start_datetime,\n            field_name="start_datetime",\n        )\n        if data.end_datetime:\n            end_dt = parse_client_datetime(\n                data.end_datetime,\n                field_name="end_datetime",\n            )\n        else:\n            end_dt = start_dt + timedelta(\n                minutes=int(data.duration_minutes or 60)\n            )\n    except ValueError as exc:\n        raise HTTPException(status_code=422, detail=str(exc))\n\n    if end_dt <= start_dt:\n        raise HTTPException(\n            status_code=422,\n            detail="end_datetime must be after start_datetime.",\n        )\n\n    a.lab_id = data.lab_id\n    a.start_datetime = start_dt\n    a.end_datetime = end_dt\n    db.commit()\n', 'extend_old': '    if not a:\n        raise HTTPException(status_code=404, detail="Assignment not found")\n    a.end_datetime = datetime.fromisoformat(data.end_datetime.replace(\'Z\', \'\'))\n    db.commit()\n    return {"status": "success"}\n', 'extend_new': '    if not a:\n        raise HTTPException(status_code=404, detail="Assignment not found")\n\n    from app.core.assignment_time import parse_client_datetime\n    try:\n        new_end = parse_client_datetime(\n            data.end_datetime,\n            field_name="end_datetime",\n        )\n    except ValueError as exc:\n        raise HTTPException(status_code=422, detail=str(exc))\n\n    if new_end <= a.end_datetime:\n        raise HTTPException(\n            status_code=422,\n            detail="New end_datetime must be after the current end_datetime.",\n        )\n\n    a.end_datetime = new_end\n    db.commit()\n    return {"status": "success"}\n', 'analytics_old': '        "assignment_date": (\n            a.start_datetime.strftime("%Y-%m-%d %H:%M:%S")\n            if a.start_datetime\n            else "N/A"\n        ),\n        "due_date": (\n            a.end_datetime.strftime("%Y-%m-%d %H:%M:%S")\n            if a.end_datetime\n            else "N/A"\n        ),\n', 'analytics_new': '        "assignment_date": utc_iso(a.start_datetime),\n        "due_date": utc_iso(a.end_datetime),\n', 'gb_old': '                "start_datetime": (\n                    assignment.start_datetime.isoformat()\n                    if assignment.start_datetime\n                    else None\n                ),\n                "end_datetime": (\n                    assignment.end_datetime.isoformat()\n                    if assignment.end_datetime\n                    else None\n                ),\n', 'gb_new': '                "start_datetime": utc_iso(assignment.start_datetime),\n                "end_datetime": utc_iso(assignment.end_datetime),\n', 'lab_create_old': "    const startISO = `${formStartDate}T${formStartTime}:00`;\n    // Compute fallback endISO on frontend\n    const startDateObj = new Date(`${formStartDate}T${formStartTime}`);\n    startDateObj.setMinutes(startDateObj.getMinutes() + Number(formDuration));\n    const endISO = startDateObj.toISOString().split('.')[0]; // remove ms/Z\n", 'lab_create_new': "    let startISO: string;\n    let endISO: string;\n    try {\n      startISO = localDateTimeToUtcIso(formStartDate, formStartTime);\n      endISO = addMinutesUtcIso(startISO, Number(formDuration));\n    } catch (err: any) {\n      alert(err?.message || 'Invalid assignment date/time.');\n      return;\n    }\n", 'lab_payload_old': '          end_datetime: endISO,\n          duration_minutes: formDuration\n', 'lab_payload_new': '          end_datetime: endISO,\n          duration_minutes: formDuration,\n          timezone: getBrowserTimeZone()\n', 'lab_extend_open_old': "    setExtendEndDate(assign.end_datetime.split('T')[0]);\n    setExtendEndTime(new Date(assign.end_datetime).toTimeString().slice(0, 5));\n", 'lab_extend_open_new': "    try {\n      const localEnd = utcIsoToLocalInput(assign.end_datetime);\n      setExtendEndDate(localEnd.date);\n      setExtendEndTime(localEnd.time);\n    } catch {\n      setExtendEndDate('');\n      setExtendEndTime('');\n    }\n", 'lab_extend_submit_old': '    const newEndISO = `${extendEndDate}T${extendEndTime}:00`;\n    const currentEnd = new Date(activeAssignment.end_datetime);\n    const proposedEnd = new Date(newEndISO);\n', 'lab_extend_submit_new': "    let newEndISO: string;\n    try {\n      newEndISO = localDateTimeToUtcIso(extendEndDate, extendEndTime);\n    } catch (err: any) {\n      alert(err?.message || 'Invalid end date/time.');\n      return;\n    }\n\n    const currentEnd = new Date(activeAssignment.end_datetime);\n    const proposedEnd = new Date(newEndISO);\n", 'monitor_old': '                      Assigned: {labAnalytics.assignment_date} ➔ Due: {labAnalytics.due_date}\n', 'monitor_new': '                      Assigned: {formatUtcIsoLocal(labAnalytics.assignment_date)} ➔ Due: {formatUtcIsoLocal(labAnalytics.due_date)}\n'}

write(ROOT / "app/core/assignment_time.py", CORE)
write(FRONTEND / "src/utils/assignmentTime.ts", FRONT_UTILS)
write(ROOT / "scratch/test_assignment_time.py", TEST_TIME)
write(ROOT / "scratch/test_assignment_time_static.py", TEST_STATIC)

# ---- admin_api.py ---------------------------------------------------------
path = FILES["admin"]
text = path.read_text()
original = text

if "    timezone: Optional[str] = None\n" not in text:
    text = replace_once(
        text,
        "    duration_minutes: Optional[int] = 60\n",
        "    duration_minutes: Optional[int] = 60\n    timezone: Optional[str] = None\n",
        "AssignLabRequest timezone field",
    )

if P["admin_status_old"] in text:
    text = replace_once(text, P["admin_status_old"], P["admin_status_new"], "admin UTC status")
elif "from app.core.assignment_time import utc_now_naive, utc_iso" not in text:
    raise RuntimeError("admin assignment-status anchor not found")

text = text.replace('"start_datetime": a.start_datetime.isoformat(),', '"start_datetime": utc_iso(a.start_datetime),')
text = text.replace('"end_datetime": a.end_datetime.isoformat(),', '"end_datetime": utc_iso(a.end_datetime),')
text = text.replace('"created_at": a.created_at.isoformat() if a.created_at else None', '"created_at": utc_iso(a.created_at)')

if P["create_old"] in text:
    text = replace_once(text, P["create_old"], P["create_new"], "assignment create parser")
elif "supplied_end = parse_client_datetime" not in text:
    raise RuntimeError("assignment create parser anchor not found")

if P["notify_old"] in text:
    text = replace_once(text, P["notify_old"], P["notify_new"], "notification timezone")
elif "format_utc_for_zone(" not in text:
    raise RuntimeError("notification timezone anchor not found")

if P["update_old"] in text:
    text = replace_once(text, P["update_old"], P["update_new"], "assignment update parser")
elif "a.start_datetime = start_dt" not in text:
    raise RuntimeError("assignment update parser anchor not found")

if P["extend_old"] in text:
    text = replace_once(text, P["extend_old"], P["extend_new"], "assignment extension parser")
elif "New end_datetime must be after the current end_datetime." not in text:
    raise RuntimeError("assignment extension parser anchor not found")

text = text.replace(
    "    a.paused_at = datetime.utcnow()\n",
    "    from app.core.assignment_time import utc_now_naive\n    a.paused_at = utc_now_naive()\n",
)
text = text.replace(
    "    a.resumed_at = datetime.utcnow()\n",
    "    from app.core.assignment_time import utc_now_naive\n    a.resumed_at = utc_now_naive()\n",
)
text = text.replace(
    '    a.end_datetime = datetime.utcnow()\n    a.status = "Completed"\n',
    '    from app.core.assignment_time import utc_now_naive\n    a.end_datetime = utc_now_naive()\n    a.status = "Completed"\n',
)

if P["analytics_old"] in text:
    text = replace_once(text, P["analytics_old"], P["analytics_new"], "analytics UTC timestamps")
elif '"assignment_date": utc_iso(a.start_datetime)' not in text:
    raise RuntimeError("analytics timestamp anchor not found")

# get_assignment_analytics needs utc_iso in its own function scope.
analytics_import = "    from app.services.gradebook_service import GradebookService\n"
analytics_import_new = analytics_import + "    from app.core.assignment_time import utc_iso\n"
if analytics_import_new not in text:
    text = replace_once(text, analytics_import, analytics_import_new, "analytics utc_iso import")

if ".replace('Z', '')" in text:
    raise RuntimeError("admin_api.py still strips Z from assignment datetime input")

if text != original:
    backup(path)
    path.write_text(text)
    print("Patched:", path)

# ---- user_profile.py ------------------------------------------------------
path = FILES["user_profile"]
text = path.read_text()
original = text
text = text.replace(
    "from app.core.timezone_utils import now_ist\n",
    "from app.core.assignment_time import utc_now_naive, utc_iso\n",
)
text = text.replace("now_ist()", "utc_now_naive()")
text = text.replace("assignment.start_datetime.isoformat()", "utc_iso(assignment.start_datetime)")
text = text.replace("assignment.end_datetime.isoformat()", "utc_iso(assignment.end_datetime)")
text = text.replace("assoc.start_datetime.isoformat() if assoc.start_datetime else None", "utc_iso(assoc.start_datetime)")
text = text.replace("assoc.end_datetime.isoformat() if assoc.end_datetime else None", "utc_iso(assoc.end_datetime)")
if "now_ist()" in text:
    raise RuntimeError("user_profile.py still uses now_ist for assignment state")
if text != original:
    backup(path)
    path.write_text(text)
    print("Patched:", path)

# ---- reporting.py ---------------------------------------------------------
path = FILES["reporting"]
text = path.read_text()
original = text
text = text.replace(
    "from app.core.timezone_utils import now_ist",
    "from app.core.assignment_time import utc_now_naive",
)
text = text.replace("now_ist()", "utc_now_naive()")
if "now_ist()" in text:
    raise RuntimeError("reporting.py still uses now_ist for assignment state")
if text != original:
    backup(path)
    path.write_text(text)
    print("Patched:", path)

# ---- gradebook_service.py -------------------------------------------------
path = FILES["gradebook"]
text = path.read_text()
original = text
gb_import = "from app.services.score_contract_service import ScoreContractService\n"
if "from app.core.assignment_time import utc_iso\n" not in text:
    text = replace_once(
        text, gb_import,
        "from app.core.assignment_time import utc_iso\n" + gb_import,
        "gradebook utc_iso import",
    )
if P["gb_old"] in text:
    text = replace_once(text, P["gb_old"], P["gb_new"], "gradebook UTC serialization")
elif '"start_datetime": utc_iso(assignment.start_datetime)' not in text:
    raise RuntimeError("gradebook timestamp anchor not found")
if text != original:
    backup(path)
    path.write_text(text)
    print("Patched:", path)

# ---- assignment_context_service.py ---------------------------------------
path = ROOT / "app/services/assignment_context_service.py"
if path.exists():
    text = path.read_text()
    original = text
    if "datetime.utcnow()" in text:
        if "from app.core.assignment_time import utc_now_naive\n" not in text:
            marker = "from sqlalchemy.orm import Session\n"
            if marker not in text:
                raise RuntimeError("assignment_context_service import anchor missing")
            text = text.replace(marker, marker + "from app.core.assignment_time import utc_now_naive\n", 1)
        text = text.replace("datetime.utcnow()", "utc_now_naive()")
    if "now_ist()" in text:
        text = text.replace("from app.core.timezone_utils import now_ist\n", "from app.core.assignment_time import utc_now_naive\n")
        text = text.replace("now_ist()", "utc_now_naive()")
    if text != original:
        backup(path)
        path.write_text(text)
        print("Patched:", path)

# ---- LabAllocation.tsx ----------------------------------------------------
path = FILES["lab"]
text = path.read_text()
original = text

nav_import = "import { useNavigate } from 'react-router-dom';\n"
time_import = (
    "import {\n"
    "  addMinutesUtcIso,\n"
    "  getBrowserTimeZone,\n"
    "  localDateTimeToUtcIso,\n"
    "  utcIsoToLocalInput,\n"
    "} from '../../utils/assignmentTime';\n"
)
if time_import not in text:
    text = replace_once(text, nav_import, nav_import + time_import, "LabAllocation time import")

if P["lab_create_old"] in text:
    text = replace_once(text, P["lab_create_old"], P["lab_create_new"], "LabAllocation create UTC")
elif "startISO = localDateTimeToUtcIso" not in text:
    raise RuntimeError("LabAllocation create datetime anchor not found")

if P["lab_payload_old"] in text:
    text = replace_once(text, P["lab_payload_old"], P["lab_payload_new"], "LabAllocation timezone payload")
elif "timezone: getBrowserTimeZone()" not in text:
    raise RuntimeError("LabAllocation timezone payload anchor not found")

if P["lab_extend_open_old"] in text:
    text = replace_once(text, P["lab_extend_open_old"], P["lab_extend_open_new"], "LabAllocation extension local input")
elif "const localEnd = utcIsoToLocalInput" not in text:
    raise RuntimeError("LabAllocation extension local-input anchor not found")

if P["lab_extend_submit_old"] in text:
    text = replace_once(text, P["lab_extend_submit_old"], P["lab_extend_submit_new"], "LabAllocation extension UTC")
elif "newEndISO = localDateTimeToUtcIso" not in text:
    raise RuntimeError("LabAllocation extension UTC anchor not found")

if "toISOString().split('.')[0]" in text:
    raise RuntimeError("LabAllocation still removes the UTC designator")

if text != original:
    backup(path)
    path.write_text(text)
    print("Patched:", path)

# ---- MonitoringAnalytics.tsx ---------------------------------------------
path = FILES["monitoring"]
text = path.read_text()
original = text
download_import = "import { downloadAuthenticatedFile } from '../../utils/exportUtils';\n"
time_import = "import { formatUtcIsoLocal } from '../../utils/assignmentTime';\n"
if time_import not in text:
    text = replace_once(text, download_import, download_import + time_import, "Monitoring time import")
if P["monitor_old"] in text:
    text = replace_once(text, P["monitor_old"], P["monitor_new"], "Monitoring local time rendering")
elif "formatUtcIsoLocal(labAnalytics.assignment_date)" not in text:
    raise RuntimeError("Monitoring assignment timestamp anchor not found")
if text != original:
    backup(path)
    path.write_text(text)
    print("Patched:", path)

# ---- compile --------------------------------------------------------------
python_files = [
    ROOT / "app/core/assignment_time.py",
    ROOT / "app/api/v1/endpoints/admin_api.py",
    ROOT / "app/api/v1/endpoints/reporting.py",
    ROOT / "app/api/v1/endpoints/user_profile.py",
    ROOT / "app/services/gradebook_service.py",
    ROOT / "scratch/test_assignment_time.py",
    ROOT / "scratch/test_assignment_time_static.py",
]
context = ROOT / "app/services/assignment_context_service.py"
if context.exists():
    python_files.append(context)

for p in python_files:
    py_compile.compile(
        str(p),
        cfile=str(Path(tempfile.gettempdir()) / f"point10_{p.stem}.pyc"),
        doraise=True,
    )

print()
print("=" * 72)
print("POINT #10 SOURCE INSTALL COMPLETE")
print("=" * 72)
print("No Alembic migration required.")
print("DB storage: existing naive DateTime columns now mean UTC.")
print("Client writes: explicit ISO-8601 timezone offset required.")
print("API reads: explicit UTC Z.")
print("UI: browser-local input/output.")
print("=" * 72)
