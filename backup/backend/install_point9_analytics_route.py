#!/usr/bin/env python3
# Point #9 — broken analytics route + assignment-aware deep link.
# Run from ~/Cyber_Range_Lab-/backup/backend
# No Alembic migration is required.

from pathlib import Path
import datetime
import py_compile
import sys
import tempfile

ROOT = Path.cwd().resolve()
FRONTEND = (ROOT / "..").resolve()

admin_path = ROOT / "app/api/v1/endpoints/admin_api.py"
lab_path = FRONTEND / "src/pages/admin/LabAllocation.tsx"
monitoring_path = FRONTEND / "src/pages/admin/MonitoringAnalytics.tsx"
app_path = FRONTEND / "src/App.tsx"
test_path = ROOT / "scratch/test_point9_analytics_route.py"

required = [admin_path, lab_path, monitoring_path, app_path]
missing = [str(path) for path in required if not path.exists()]
if missing:
    print("ERROR: run this from ~/Cyber_Range_Lab-/backup/backend")
    for path in missing:
        print(" -", path)
    sys.exit(1)

stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

def backup(path: Path):
    dst = path.with_name(path.name + f".before_point9_{stamp}")
    dst.write_bytes(path.read_bytes())
    print("Backup:", dst)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 patch anchor, found {count}")
    return text.replace(old, new, 1)

BACKEND_OLD = '    return {\n        "assignment_id": a.id,\n        "lab_id": a.lab_id,\n'
BACKEND_NEW = '    return {\n        "assignment_id": a.id,\n        "group_id": a.group_id,\n        "student_id": a.student_id,\n        "lab_id": a.lab_id,\n'
COMPONENT_ANCHOR = "export const MonitoringAnalytics: React.FC = () => {\n  const [analyticsTab, setAnalyticsTab] = useState<'group' | 'individual'>('group');\n"
COMPONENT_REPLACEMENT = "export const MonitoringAnalytics: React.FC = () => {\n  const [searchParams] = useSearchParams();\n  const assignmentQuery = searchParams.get('assignment');\n\n  const [analyticsTab, setAnalyticsTab] = useState<'group' | 'individual'>('group');\n"
DEEP_LINK_BLOCK = "\n  // Point #9: assignment-aware deep link from the Assignments page.\n  useEffect(() => {\n    if (!assignmentQuery) return;\n\n    const assignmentId = Number(assignmentQuery);\n    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {\n      setErrorMsg('Invalid assignment analytics link.');\n      return;\n    }\n\n    let cancelled = false;\n\n    const loadDeepLinkedAssignment = async () => {\n      setLoading(true);\n      setErrorMsg('');\n\n      try {\n        const res = await fetch(\n          `/api/v1/admin/assignments/${assignmentId}/analytics`,\n          { headers }\n        );\n\n        if (!res.ok) {\n          let detail = 'No analytics available for this assignment.';\n          try {\n            const body = await res.json();\n            if (body?.detail) detail = String(body.detail);\n          } catch {\n            // Keep the stable fallback message.\n          }\n\n          if (!cancelled) setErrorMsg(detail);\n          return;\n        }\n\n        const data = await res.json();\n        if (cancelled) return;\n\n        setAnalyticsTab(data.student_id ? 'individual' : 'group');\n        setSelectedGroupId(data.group_id ?? null);\n        setSelectedStudentId(null);\n        setStudentBreakdown(null);\n        setGroupDetails(null);\n\n        setLabAnalytics(data);\n        setSelectedLabId(data.lab_id);\n        setSelectedAssignmentId(data.assignment_id);\n      } catch {\n        if (!cancelled) {\n          setErrorMsg('Failed to load assignment analytics.');\n        }\n      } finally {\n        if (!cancelled) setLoading(false);\n      }\n    };\n\n    void loadDeepLinkedAssignment();\n\n    return () => {\n      cancelled = true;\n    };\n  }, [assignmentQuery]);\n\n"
TEST_SOURCE = '"""Point #9 analytics navigation/deep-link acceptance test."""\n\nfrom pathlib import Path\n\nROOT = Path(__file__).resolve().parents[1]\nFRONTEND = ROOT.parent\n\nlab = (FRONTEND / "src/pages/admin/LabAllocation.tsx").read_text()\nmonitoring = (FRONTEND / "src/pages/admin/MonitoringAnalytics.tsx").read_text()\napp = (FRONTEND / "src/App.tsx").read_text()\nadmin = (ROOT / "app/api/v1/endpoints/admin_api.py").read_text()\n\nBACKEND_CONTEXT = \'    return {\\n        "assignment_id": a.id,\\n        "group_id": a.group_id,\\n        "student_id": a.student_id,\\n        "lab_id": a.lab_id,\\n\'\n\nprint("=" * 80)\nprint("POINT #9 ANALYTICS ROUTE ACCEPTANCE TEST")\nprint("=" * 80)\n\nassert "navigate(\'/admin/analytics\')" not in lab\nassert "navigate(`/admin/monitoring?assignment=${activeAssignment.id}`)" in lab\nprint("✅ CASE A: assignment drawer no longer navigates to broken /admin/analytics")\n\nassert \'path="/admin/monitoring"\' in app\nprint("✅ CASE B: navigation target matches the real /admin/monitoring route")\n\nassert "useSearchParams" in monitoring\nassert "searchParams.get(\'assignment\')" in monitoring\nassert "/api/v1/admin/assignments/${assignmentId}/analytics" in monitoring\nprint("✅ CASE C: MonitoringAnalytics consumes assignment deep links")\n\nassert BACKEND_CONTEXT in admin\nprint("✅ CASE D: assignment analytics exposes target context for deep links")\n\nassert "setSelectedAssignmentId(data.assignment_id)" in monitoring\nassert "setSelectedLabId(data.lab_id)" in monitoring\nassert "setSelectedGroupId(data.group_id ?? null)" in monitoring\nprint("✅ CASE E: deep link hydrates assignment/lab/group context")\n\nprint("=" * 80)\nprint("✅ ALL POINT #9 ANALYTICS ROUTE TESTS PASSED")\nprint("=" * 80)\n'

admin = admin_path.read_text()
if BACKEND_NEW in admin:
    print("Already patched:", admin_path)
elif BACKEND_OLD in admin:
    admin = replace_once(admin, BACKEND_OLD, BACKEND_NEW, "admin analytics context")
    backup(admin_path)
    admin_path.write_text(admin)
    print("Patched:", admin_path)
else:
    raise RuntimeError(
        "Assignment analytics return block not found; refusing to guess against a different live backend file."
    )

lab = lab_path.read_text()
broken_nav = "navigate('/admin/analytics');"
fixed_nav = "navigate(`/admin/monitoring?assignment=${activeAssignment.id}`);"

if broken_nav in lab:
    lab = replace_once(lab, broken_nav, fixed_nav, "LabAllocation View Analytics route")
    backup(lab_path)
    lab_path.write_text(lab)
    print("Patched:", lab_path)
elif fixed_nav in lab:
    print("Already patched:", lab_path)
else:
    raise RuntimeError(
        "LabAllocation navigation anchor not found; refusing to guess against a different live file."
    )

monitoring = monitoring_path.read_text()
changed = False

router_import = "import { useSearchParams } from 'react-router-dom';\n"
if router_import not in monitoring:
    monitoring = replace_once(
        monitoring,
        "import React, { useState, useEffect } from 'react';\n",
        "import React, { useState, useEffect } from 'react';\n" + router_import,
        "MonitoringAnalytics router import",
    )
    changed = True

if "const assignmentQuery = searchParams.get('assignment');" not in monitoring:
    monitoring = replace_once(
        monitoring,
        COMPONENT_ANCHOR,
        COMPONENT_REPLACEMENT,
        "MonitoringAnalytics assignment query state",
    )
    changed = True

if "Point #9: assignment-aware deep link from the Assignments page." not in monitoring:
    csv_anchor = "  // CSV Group Export helper\n"
    if csv_anchor not in monitoring:
        raise RuntimeError(
            "MonitoringAnalytics CSV helper anchor not found; refusing to guess against a different live file."
        )
    monitoring = monitoring.replace(csv_anchor, DEEP_LINK_BLOCK + csv_anchor, 1)
    changed = True

if changed:
    backup(monitoring_path)
    monitoring_path.write_text(monitoring)
    print("Patched:", monitoring_path)
else:
    print("Already patched:", monitoring_path)

test_path.parent.mkdir(parents=True, exist_ok=True)
if test_path.exists():
    backup(test_path)
test_path.write_text(TEST_SOURCE)
print("Wrote:", test_path)

py_compile.compile(
    str(admin_path),
    cfile=str(Path(tempfile.gettempdir()) / "point9_admin_api.pyc"),
    doraise=True,
)
py_compile.compile(
    str(test_path),
    cfile=str(Path(tempfile.gettempdir()) / "point9_test.pyc"),
    doraise=True,
)

final_lab = lab_path.read_text()
final_monitoring = monitoring_path.read_text()
final_admin = admin_path.read_text()

assert broken_nav not in final_lab
assert fixed_nav in final_lab
assert "searchParams.get('assignment')" in final_monitoring
assert "/api/v1/admin/assignments/${assignmentId}/analytics" in final_monitoring
assert BACKEND_NEW in final_admin

print()
print("=" * 72)
print("POINT #9 SOURCE INSTALL COMPLETE")
print("=" * 72)
print("No Alembic migration required.")
print("Canonical link: /admin/monitoring?assignment=<assignment_id>")
print("Assignment deep-link hydration installed.")
print()
print("NEXT:")
print('  PYTHONPATH="$PWD" python scratch/test_point9_analytics_route.py')
print("  cd ..")
print("  npm run build")
print("  cd backend")
print("  sudo systemctl restart cyberrange-backend.service")
print("=" * 72)
