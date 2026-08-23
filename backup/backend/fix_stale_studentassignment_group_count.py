#!/usr/bin/env python3
# Hotfix: remove stale StudentAssignment reference left in get_admin_groups().
# Run from ~/Cyber_Range_Lab-/backup/backend

from pathlib import Path
import datetime
import py_compile
import sys
import tempfile

ROOT = Path.cwd().resolve()
ADMIN = ROOT / "app/api/v1/endpoints/admin_api.py"
TEST = ROOT / "scratch/test_group_assignment_count.py"

if not ADMIN.exists():
    print("ERROR: run from ~/Cyber_Range_Lab-/backup/backend")
    sys.exit(1)

stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

def backup(path: Path):
    dst = path.with_name(path.name + f".before_studentassignment_hotfix_{stamp}")
    dst.write_bytes(path.read_bytes())
    print("Backup:", dst)

legacy = '        if group_user_ids:\n            assigned_labs = db.query(StudentAssignment).filter(StudentAssignment.student_id.in_(group_user_ids)).count()\n'
test_source = 'from pathlib import Path\n\nROOT = Path(__file__).resolve().parents[1]\nadmin = (ROOT / "app/api/v1/endpoints/admin_api.py").read_text()\n\nprint("=" * 80)\nprint("GROUP ASSIGNMENT COUNT / POINT #3 REGRESSION")\nprint("=" * 80)\n\nassert "StudentAssignment" not in admin\nprint("✅ CASE A: admin_api has no legacy StudentAssignment references")\n\ncanonical = \'        assigned_labs = (\\n            db.query(Assignment)\\n            .filter(\\n                Assignment.deleted_at.is_(None),\\n                or_(\\n                    Assignment.group_id == g.id,\\n                    Assignment.student_id.in_(group_user_ids),\\n                ),\\n            )\\n            .count()\\n        )\\n\'\nassert canonical in admin\nprint("✅ CASE B: group assigned-lab count uses canonical Assignment")\n\nprint("=" * 80)\nprint("✅ GROUP ASSIGNMENT COUNT REGRESSION PASSED")\nprint("=" * 80)\n'

text = ADMIN.read_text()

if legacy in text:
    backup(ADMIN)
    text = text.replace(legacy, "", 1)
    ADMIN.write_text(text)
    print("Patched:", ADMIN)
elif "StudentAssignment" not in text:
    print("Already clean:", ADMIN)
else:
    raise RuntimeError(
        "StudentAssignment is still referenced, but the expected stale block "
        "was not found. Refusing to guess."
    )

TEST.parent.mkdir(parents=True, exist_ok=True)
TEST.write_text(test_source)
print("Wrote:", TEST)

py_compile.compile(
    str(ADMIN),
    cfile=str(Path(tempfile.gettempdir()) / "studentassignment_hotfix_admin.pyc"),
    doraise=True,
)
py_compile.compile(
    str(TEST),
    cfile=str(Path(tempfile.gettempdir()) / "studentassignment_hotfix_test.pyc"),
    doraise=True,
)

print()
print("=" * 72)
print("STALE STUDENTASSIGNMENT HOTFIX INSTALLED")
print("=" * 72)
print("No Alembic migration required.")
print("=" * 72)
