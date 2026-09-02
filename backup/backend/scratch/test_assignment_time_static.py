"""Static Point #10 contract checks against the installed source tree."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT.parent

admin = (ROOT / "app/api/v1/endpoints/admin_api.py").read_text()
reporting = (ROOT / "app/api/v1/endpoints/reporting.py").read_text()
user_profile = (ROOT / "app/api/v1/endpoints/user_profile.py").read_text()
gradebook = (ROOT / "app/services/gradebook_service.py").read_text()
lab = (FRONTEND / "src/pages/admin/LabAllocation.tsx").read_text()
monitoring = (FRONTEND / "src/pages/admin/MonitoringAnalytics.tsx").read_text()
utils = (FRONTEND / "src/utils/assignmentTime.ts").read_text()

print("=" * 80)
print("POINT #10 STATIC ASSIGNMENT TIME CONTRACT")
print("=" * 80)

assert ".replace('Z', '')" not in admin
assert 'parse_client_datetime(' in admin
print("✅ CASE G: backend no longer strips timezone offsets from assignment writes")

assert 'utc_now_naive()' in admin
assert 'now_ist()' not in admin
print("✅ CASE H: professor assignment status/control uses UTC clock")

assert 'now_ist()' not in reporting
assert 'now_ist()' not in user_profile
print("✅ CASE I: reporting and student assignment status use UTC clock")

assert 'utc_iso(a.start_datetime)' in admin
assert 'utc_iso(a.end_datetime)' in admin
assert '"start_datetime": utc_iso(' in user_profile
assert '"end_datetime": utc_iso(' in user_profile
assert 'utc_iso(assignment.start_datetime)' in gradebook
assert 'utc_iso(assignment.end_datetime)' in gradebook
print("✅ CASE J: assignment APIs serialize explicit UTC instead of naive ISO")

assert 'localDateTimeToUtcIso' in lab
assert 'addMinutesUtcIso' in lab
assert 'utcIsoToLocalInput' in lab
assert 'getBrowserTimeZone' in lab
assert "toISOString().split('.')[0]" not in lab
print("✅ CASE K: browser-local assignment form converts both ends to explicit UTC")

assert 'formatUtcIsoLocal' in monitoring
print("✅ CASE L: monitoring renders assignment timestamps in browser local time")

assert "return local.toISOString();" in utils
print("✅ CASE M: shared frontend helper preserves explicit UTC Z")

context_path = ROOT / "app/services/assignment_context_service.py"
if context_path.exists():
    context = context_path.read_text()
    assert 'now_ist()' not in context
    assert 'datetime.utcnow()' not in context
    print("✅ CASE N: assignment-context resolution uses canonical UTC clock")
else:
    print("ℹ️  CASE N: assignment_context_service.py not present in this checkout")

print("=" * 80)
print("✅ ALL POINT #10 STATIC CONTRACT TESTS PASSED")
print("=" * 80)
