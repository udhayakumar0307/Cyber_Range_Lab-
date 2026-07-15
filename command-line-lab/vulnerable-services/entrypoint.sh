#!/bin/bash
# ============================================================
# Command Line Lab — Orchestration Entrypoint
# Generates per-student flags, plants module challenges into
# the student-env container, then starts terminal/progress/hint
# services.
# ============================================================

set -uo pipefail

STUDENT_ID="${STUDENT_ID:-student}"
LAB_SEED="${LAB_SEED:-defaultseed}"
STUDENT_CONTAINER="${STUDENT_CONTAINER:-cll-student}"

DX() { docker exec -u root "$STUDENT_CONTAINER" "$@"; }
DXS() { docker exec -u student "$STUDENT_CONTAINER" "$@"; }

# ── Deterministic flag generation (same algorithm scoring-server uses) ──
gen_flag() {
    local mod="$1"
    echo -n "cll_${mod}_${STUDENT_ID}_${LAB_SEED}" | sha256sum | awk '{print substr($1,1,8)}'
}

for m in module1 module2 module3 module4 module5; do
    hash=$(gen_flag "$m")
    printf -v "FLAG_${m}" "FLAG{cll_%s_%s_%s}" "$m" "$STUDENT_ID" "$hash"
done

mkdir -p /flags
cat > /flags/flags.json <<EOF
{
  "student_id": "${STUDENT_ID}",
  "flags": {
    "module1": "${FLAG_module1}",
    "module2": "${FLAG_module2}",
    "module3": "${FLAG_module3}",
    "module4": "${FLAG_module4}",
    "module5": "${FLAG_module5}"
  }
}
EOF

# ── Wait for student-env container to be reachable ──
echo "==> Waiting for student-env container..."
until docker exec "$STUDENT_CONTAINER" true 2>/dev/null; do
    sleep 1
done
echo "==> student-env is up."

# ── Plant shell profile + banner ──
echo "==> Installing shell profile and banner..."
DX mkdir -p /opt/configs
docker cp /opt/configs/banner.txt "${STUDENT_CONTAINER}:/opt/configs/banner.txt"
sed "s/__STUDENT_ID__/${STUDENT_ID}/g" /opt/configs/shell_profile > /tmp/shell_profile.rendered
docker cp /tmp/shell_profile.rendered "${STUDENT_CONTAINER}:/opt/configs/shell_profile"
DX bash -c "grep -qxF 'source /opt/configs/shell_profile' /home/student/.bashrc || echo 'source /opt/configs/shell_profile' >> /home/student/.bashrc"
DX chown student:student /home/student/.bashrc

# ── Module 1: Linux Navigation ──
DXS mkdir -p /home/student/module1/records/logs/archive
DXS bash -c "echo '${FLAG_module1}' > /home/student/module1/records/logs/archive/.keyfile"
DXS bash -c "echo 'Nothing to see here, keep looking.' > /home/student/module1/records/README.txt"

# ── Module 2: File Operations ──
DXS mkdir -p /home/student/module2/inbox /home/student/module2/workspace /home/student/module2/.vault
DXS bash -c "echo 'Q3 manifest — do not edit in place.' > /home/student/module2/inbox/manifest.txt"
DXS bash -c "echo 'draft notes, needs to become final.txt' > /home/student/module2/inbox/draft.txt"
DXS bash -c "echo 'temporary scratch file, safe to delete' > /home/student/module2/workspace/junk.tmp"
DXS bash -c "echo '${FLAG_module2}' > /home/student/module2/.vault/.key"

# ── Module 3: Searching & Filtering ──
DXS mkdir -p /home/student/module3/data/2024-01 /home/student/module3/data/2024-02 /home/student/module3/data/2024-03
for i in 1 2 3 4 5; do
    DXS bash -c "echo 'INFO: routine health check ok, batch '${i} >> /home/student/module3/data/2024-01/service.log"
done
DXS bash -c "echo 'WARN: retry scheduled, connection reset' >> /home/student/module3/data/2024-02/service.log"
DXS bash -c "echo 'INFO: nightly backup completed' >> /home/student/module3/data/2024-02/service.log"
DXS bash -c "echo 'ACCESS_KEY: ${FLAG_module3}' >> /home/student/module3/data/2024-03/service.log"
DXS bash -c "echo 'INFO: rotation complete' >> /home/student/module3/data/2024-03/service.log"

# ── Module 4: Permissions & Shell Scripting ──
DXS mkdir -p /home/student/module4/scripts /home/student/module4/data
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/module4/scripts/run.sh" <<SCRIPT
#!/bin/bash
echo "Deployment script running..."
touch /home/student/module4/.done
echo "Deployment complete. Key: ${FLAG_module4}"
SCRIPT
DXS chmod 644 /home/student/module4/scripts/run.sh
DXS bash -c "echo 'Quarterly report draft' > /home/student/module4/data/report.txt"
DX chown root:root /home/student/module4/data/report.txt

# ── Module 5: Advanced Linux (capstone) ──
DXS mkdir -p /home/student/module5/.final
DXS bash -c "echo '${FLAG_module5}' > /home/student/module5/.final/key.txt"
# Plant a harmless long-running "runaway" process for ps/kill practice
DXS bash -c "nohup sleep 100000 > /dev/null 2>&1 & echo \$! > /home/student/module5/.runaway_pid" || true

echo "==> Module scaffolding planted for student: ${STUDENT_ID}"

# ── Start services ──
echo "==> Starting progress_service (port 9500)..."
python3 /opt/services/progress_service.py &

echo "==> Starting hint_service (port 9600)..."
python3 /opt/services/hint_service.py &

echo "==> Starting terminal_service (port 8022)..."
python3 /opt/services/terminal_service.py &

echo ""
echo "=================================================="
echo "  Command Line Lab services ready."
echo "  Student:  ${STUDENT_ID}"
echo "  Terminal: ws://<host>:8022"
echo "  Progress: http://<host>:9500"
echo "  Hints:    http://<host>:9600"
echo "=================================================="

wait
