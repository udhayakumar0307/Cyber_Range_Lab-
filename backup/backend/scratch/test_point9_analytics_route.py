"""Point #9 analytics navigation/deep-link acceptance test."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT.parent

lab = (FRONTEND / "src/pages/admin/LabAllocation.tsx").read_text()
monitoring = (FRONTEND / "src/pages/admin/MonitoringAnalytics.tsx").read_text()
app = (FRONTEND / "src/App.tsx").read_text()
admin = (ROOT / "app/api/v1/endpoints/admin_api.py").read_text()

BACKEND_CONTEXT = '    return {\n        "assignment_id": a.id,\n        "group_id": a.group_id,\n        "student_id": a.student_id,\n        "lab_id": a.lab_id,\n'

print("=" * 80)
print("POINT #9 ANALYTICS ROUTE ACCEPTANCE TEST")
print("=" * 80)

assert "navigate('/admin/analytics')" not in lab
assert "navigate(`/admin/monitoring?assignment=${activeAssignment.id}`)" in lab
print("✅ CASE A: assignment drawer no longer navigates to broken /admin/analytics")

assert 'path="/admin/monitoring"' in app
print("✅ CASE B: navigation target matches the real /admin/monitoring route")

assert "useSearchParams" in monitoring
assert "searchParams.get('assignment')" in monitoring
assert "/api/v1/admin/assignments/${assignmentId}/analytics" in monitoring
print("✅ CASE C: MonitoringAnalytics consumes assignment deep links")

assert BACKEND_CONTEXT in admin
print("✅ CASE D: assignment analytics exposes target context for deep links")

assert "setSelectedAssignmentId(data.assignment_id)" in monitoring
assert "setSelectedLabId(data.lab_id)" in monitoring
assert "setSelectedGroupId(data.group_id ?? null)" in monitoring
print("✅ CASE E: deep link hydrates assignment/lab/group context")

print("=" * 80)
print("✅ ALL POINT #9 ANALYTICS ROUTE TESTS PASSED")
print("=" * 80)
