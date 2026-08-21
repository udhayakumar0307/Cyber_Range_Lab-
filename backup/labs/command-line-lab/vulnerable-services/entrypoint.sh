#!/bin/bash
# ============================================================
# Command Line Lab — Multi-Track Orchestration Entrypoint
# Secure flag storage architecture & non-repetitive learning scaffolding
# for Modules 1–5 across Linux, Python, Java, and C tracks.
# ============================================================

# NO set -e, NO set -u, NO set -o pipefail
# Docker exec calls during setup may fail silently without crashing the container.

STUDENT_ID="${STUDENT_ID:-student}"
LAB_SEED="${LAB_SEED:-defaultseed}"
STUDENT_CONTAINER="${STUDENT_CONTAINER:-cll-student}"

# ── Start the terminal & scoring services IMMEDIATELY ──────────────────────
# terminal_service.py must be reachable as fast as possible.
# Lab content setup (DX/DXS calls) runs in background afterward.
echo "==> Starting terminal_service (port 8022)..."
python3 /opt/services/terminal_service.py &

echo "==> Starting progress_service (port 9500)..."
python3 /opt/services/progress_service.py &

echo "==> Starting hint_service (port 9600)..."
python3 /opt/services/hint_service.py &

echo "==> Services launched. Running lab setup in background..."

# ── Resolve actual container name in background (handles ECS dynamic naming) ──
resolve_container() {
    local target="$1"
    local resolved=""
    local i=0
    while [ $i -lt 20 ]; do
        resolved=$(docker ps --format "{{.Names}}" 2>/dev/null | grep -m1 "$target" || true)
        if [ -n "$resolved" ]; then
            echo "$resolved"
            return 0
        fi
        sleep 3
        i=$((i + 1))
    done
    echo "$target"
}

# Run setup entirely in background — never blocks the services above
(
    STUDENT_CONTAINER=$(resolve_container "$STUDENT_CONTAINER")
    echo "==> Lab setup: resolved container as ${STUDENT_CONTAINER}"
    DX() { docker exec -u root "$STUDENT_CONTAINER" "$@" 2>/dev/null || true; }
    DXS() { docker exec -u student "$STUDENT_CONTAINER" "$@" 2>/dev/null || true; }



# ── Deterministic flag generation algorithms ──
gen_track_flag() {
    local track="$1"
    local mod="$2"
    local raw="cll_${track}_${mod}_${STUDENT_ID}_${LAB_SEED}"
    local hash=$(echo -n "$raw" | sha256sum | awk '{print substr($1,1,8)}')
    echo "FLAG{cll_${track}_${mod}_${STUDENT_ID}_${hash}}"
}

gen_container_flag() {
    local mod="$1"
    local raw="cll_${mod}_${STUDENT_ID}_${LAB_SEED}"
    local hash=$(echo -n "$raw" | sha256sum | awk '{print substr($1,1,8)}')
    echo "FLAG{cll_${mod}_${STUDENT_ID}_${hash}}"
}

# Generate flags for all 4 tracks x 5 modules
for track in linux python java c; do
    for m in module1 module2 module3 module4 module5; do
        printf -v "FLAG_${track}_${m}" "%s" "$(gen_track_flag "$track" "$m")"
    done
done

# Legacy container flags for Linux backward compatibility
for m in module1 module2 module3 module4 module5; do
    printf -v "FLAG_${m}" "%s" "$(gen_container_flag "$m")"
done

mkdir -p /flags
cat > /flags/flags.json <<EOF
{
  "student_id": "${STUDENT_ID}",
  "flags": {
    "linux_module1": "${FLAG_linux_module1}",
    "linux_module2": "${FLAG_linux_module2}",
    "linux_module3": "${FLAG_linux_module3}",
    "linux_module4": "${FLAG_linux_module4}",
    "linux_module5": "${FLAG_linux_module5}",
    "python_module1": "${FLAG_python_module1}",
    "python_module2": "${FLAG_python_module2}",
    "python_module3": "${FLAG_python_module3}",
    "python_module4": "${FLAG_python_module4}",
    "python_module5": "${FLAG_python_module5}",
    "java_module1": "${FLAG_java_module1}",
    "java_module2": "${FLAG_java_module2}",
    "java_module3": "${FLAG_java_module3}",
    "java_module4": "${FLAG_java_module4}",
    "java_module5": "${FLAG_java_module5}",
    "c_module1": "${FLAG_c_module1}",
    "c_module2": "${FLAG_c_module2}",
    "c_module3": "${FLAG_c_module3}",
    "c_module4": "${FLAG_c_module4}",
    "c_module5": "${FLAG_c_module5}"
  }
}
EOF

# ── Wait for student-env container to be reachable ──
echo "==> Waiting for student-env container..."
until docker exec "$STUDENT_CONTAINER" true 2>/dev/null; do
    sleep 1
done
echo "==> student-env is up."

# ── Install shell profile and banner ──
echo "==> Installing shell profile and banner..."
DX mkdir -p /opt/configs
docker cp /opt/configs/banner.txt "${STUDENT_CONTAINER}:/opt/configs/banner.txt"
sed "s/__STUDENT_ID__/${STUDENT_ID}/g" /opt/configs/shell_profile > /tmp/shell_profile.rendered
docker cp /tmp/shell_profile.rendered "${STUDENT_CONTAINER}:/opt/configs/shell_profile"
DX bash -c "grep -qxF 'source /opt/configs/shell_profile' /home/student/.bashrc || echo 'source /opt/configs/shell_profile' >> /home/student/.bashrc"
DX chown student:student /home/student/.bashrc

# Ensure parent track directories exist and clean legacy files containing flags
DXS rm -rf /home/student/linux /home/student/python /home/student/java /home/student/c
DXS mkdir -p /home/student/linux /home/student/python /home/student/java /home/student/c

# ============================================================
# 1. LINUX TRACK WORKSPACES (/home/student/linux/module1..5)
# ============================================================
# Linux Module 1
DXS mkdir -p /home/student/linux/module1/records/logs/archive
DXS bash -c "echo '${FLAG_linux_module1}' > /home/student/linux/module1/records/logs/archive/.keyfile"
DXS bash -c "echo 'Nothing to see here, keep looking.' > /home/student/linux/module1/records/README.txt"

# Linux Module 2
# The flag is NOT planted here.
# progress_service reveals it only after all four objectives are verified.
DXS mkdir -p /home/student/linux/module2/inbox /home/student/linux/module2/workspace
DXS bash -c "echo 'Q3 manifest — do not edit in place.' > /home/student/linux/module2/inbox/manifest.txt"
DXS bash -c "echo 'draft notes, needs to become final.txt' > /home/student/linux/module2/inbox/draft.txt"
DXS bash -c "echo 'temporary scratch file, safe to delete' > /home/student/linux/module2/workspace/junk.tmp"

# Linux Module 3 (Text Processing & Line Counting: wc, sort, uniq, cut)
DXS mkdir -p /home/student/linux/module3/data
(
  ips=("192.168.1.10" "10.0.0.55" "172.16.0.4" "192.168.2.20" "10.0.0.12" "192.168.1.15" "172.16.5.9")
  methods=("GET" "POST" "GET" "GET" "PUT" "DELETE")
  endpoints=("/api/v1/health" "/index.html" "/api/v1/login" "/static/main.js" "/dashboard" "/api/v1/users" "/static/style.css" "/favicon.ico")

  for i in $(seq 1 1000); do
    if [ "$i" -eq 542 ]; then
      echo "10.20.0.99:ACCESS_KEY:${FLAG_linux_module3}"
    else
      # Deterministic pseudo-random generation using sequence index
      ip_idx=$(( (i * 3 + 7) % 7 ))
      method_idx=$(( (i * 11 + 2) % 6 ))
      endpoint_idx=$(( (i * 13 + 5) % 8 ))
      echo "${ips[ip_idx]}:${methods[method_idx]} ${endpoints[endpoint_idx]}"
    fi
  done
) | docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/linux/module3/data/server.log"

# Linux Module 4 (Archive Extraction & Binary Inspection: tar, file, strings, base64)
DXS mkdir -p /home/student/linux/module4/extracted
b64_payload=$(echo -n "ACCESS_KEY: ${FLAG_linux_module4}" | base64)
DXS bash -c "echo 'BINARY_BLOB_HEADER_${b64_payload}_PAYLOAD_END' > /home/student/linux/module4/extracted/blob.dat"
DXS bash -c "cd /home/student/linux/module4 && tar -czf backup.tar.gz extracted"

# Linux Module 5 (System Diagnostics & Redirection: env, diff, ps, pipe |)
DXS mkdir -p /home/student/linux/module5/.final
DXS bash -c "echo 'setting: default' > /home/student/linux/module5/config.old"
DXS bash -c "echo 'setting: production_v2' > /home/student/linux/module5/config.new"
DXS bash -c "echo '${FLAG_linux_module5}' > /home/student/linux/module5/.final/key.txt"
DXS bash -c "nohup sleep 100000 > /dev/null 2>&1 & echo \$! > /home/student/linux/module5/.runaway_pid" || true

# Symlinks for legacy /home/student/module1..5 access
for m in module1 module2 module3 module4 module5; do
    DXS ln -sfn "/home/student/linux/${m}" "/home/student/${m}"
done


# ============================================================
# 2. PYTHON TRACK WORKSPACES (Flags hidden in .flag files)
# ============================================================
for m in module1 module2 module3 module4 module5; do
    DXS mkdir -p "/home/student/python/${m}"
    flag_val=$(eval echo "\$FLAG_python_${m}")
    DXS bash -c "echo '${flag_val}' > /home/student/python/${m}/.flag"
done

# Python Module 1
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/python/module1/main.py" <<PY1
#!/usr/bin/env python3
import os
app_name = "CyberRange"
status = "active"
print(f"[{app_name}] System Status: {status}")
if os.path.exists(".flag"):
    with open(".flag") as f:
        print(f"Execution Successful! Flag: {f.read().strip()}")
PY1

# Python Module 2
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/python/module2/security.py" <<PY2
#!/usr/bin/env python3
import os
tokens = ["  USER_GUEST:1001 ", " KEY_ADMIN_VALID ", "  TEMP_TOKEN:999 "]
for t in tokens:
    cleaned = t.strip()
    if cleaned.startswith("KEY_"):
        print("Validated Access Token:", cleaned)
        if os.path.exists(".flag"):
            with open(".flag") as f:
                print("Key Verified! Flag:", f.read().strip())
PY2

# Python Module 3 (Multi-module imports & Code Flow)
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/python/module3/data_loader.py" <<PY3_LOAD
def load_metrics():
    return [45, 120, 88, 210, 150, 30]
PY3_LOAD

docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/python/module3/calculator.py" <<PY3_CALC
def process(items):
    return sum(x for x in items if x > 100)
PY3_CALC

docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/python/module3/analytics.py" <<PY3_MAIN
#!/usr/bin/env python3
import os, data_loader, calculator
data = data_loader.load_metrics()
total = calculator.process(data)
print("Aggregated Threshold Sum:", total)
if total == 480 and os.path.exists(".flag"):
    with open(".flag") as f:
        print("Metrics Calculated! Flag:", f.read().strip())
PY3_MAIN

# Python Module 4 (Config Files & JSON parsing)
DXS bash -c "echo '{\"app\": \"CyberRange\", \"auth\": {\"secret_key\": \"SECRET_PARSED\"}}' > /home/student/python/module4/config.json"
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/python/module4/app.py" <<PY4
#!/usr/bin/env python3
import json, os
with open("config.json") as f:
    data = json.load(f)
key = data["auth"]["secret_key"]
print("Extracted Secret Key:", key)
if os.path.exists(".flag"):
    with open(".flag") as f:
        print("Config Parsed! Flag:", f.read().strip())
PY4

# Python Module 5 (Exception Tracing & Safe Handling)
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/python/module5/runner.py" <<PY5
#!/usr/bin/env python3
import hashlib, os
def process_log(entry):
    try:
        return "VALID_" + hashlib.sha256(entry.encode()).hexdigest()[:8]
    except Exception:
        return None
result = process_log("SYS_LOG_OK")
print("Log Processing Status:", result)
if os.path.exists(".flag"):
    with open(".flag") as f:
        print("Auth Success! Flag:", f.read().strip())
PY5


# ============================================================
# 3. JAVA TRACK WORKSPACES (Flags hidden in .flag files)
# ============================================================
for m in module1 module2 module3 module4 module5; do
    DXS mkdir -p "/home/student/java/${m}"
    flag_val=$(eval echo "\$FLAG_java_${m}")
    DXS bash -c "echo '${flag_val}' > /home/student/java/${m}/.flag"
done

# Java Module 1
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module1/Main.java" <<J1
import java.io.File;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        System.out.println("Java Environment Initialized.");
        try {
            File f = new File(".flag");
            if (f.exists()) {
                Scanner sc = new Scanner(f);
                if (sc.hasNextLine()) System.out.println("Execution Successful! Key: " + sc.nextLine().trim());
                sc.close();
            }
        } catch (Exception e) {}
    }
}
J1

# Java Module 2
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module2/ControlFlow.java" <<J2
import java.io.File;
import java.util.Scanner;

public class ControlFlow {
    public static void main(String[] args) {
        int[] codes = { 101, 502, 1337, 999 };
        for (int i = 0; i < codes.length; i++) {
            if (codes[i] == 1337) {
                System.out.println("Target Authorization Code Found: " + codes[i]);
                try {
                    File f = new File(".flag");
                    if (f.exists()) {
                        Scanner sc = new Scanner(f);
                        if (sc.hasNextLine()) System.out.println(sc.nextLine().trim());
                        sc.close();
                    }
                } catch (Exception e) {}
            }
        }
    }
}
J2

# Java Module 3 (Package Architecture com.cyber.App)
DXS mkdir -p /home/student/java/module3/com/cyber/utils
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module3/com/cyber/utils/SecurityHelper.java" <<J3_UTIL
package com.cyber.utils;

public class SecurityHelper {
    public static String getSecurityKey() {
        return "KEY_ADMIN_SECRET_1337";
    }
}
J3_UTIL

docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module3/com/cyber/App.java" <<J3_APP
package com.cyber;

import java.io.File;
import java.util.Scanner;
import com.cyber.utils.SecurityHelper;

public class App {
    public static void main(String[] args) {
        String parsed = SecurityHelper.getSecurityKey();
        System.out.println("Parsed Key: " + parsed);
        try {
            File f = new File(".flag");
            if (f.exists()) {
                Scanner sc = new Scanner(f);
                if (sc.hasNextLine()) System.out.println(sc.nextLine().trim());
                sc.close();
            }
        } catch (Exception e) {}
    }
}
J3_APP

# Java Module 4 (Class Inheritance SecureVault extends Vault)
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module4/Vault.java" <<J4_BASE
public class Vault {
    protected String accessKey;
    public Vault(String key) { this.accessKey = key; }
}
J4_BASE

docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module4/SecureVault.java" <<J4_SUB
public class SecureVault extends Vault {
    public SecureVault(String key) { super(key); }
    public String getAccessKey() { return this.accessKey; }
}
J4_SUB

docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module4/VaultApp.java" <<J4_APP
import java.io.File;
import java.util.Scanner;

public class VaultApp {
    public static void main(String[] args) {
        SecureVault v = new SecureVault("SECURE_VAULT_KEY");
        System.out.println("Vault Unlocked: " + v.getAccessKey());
        try {
            File f = new File(".flag");
            if (f.exists()) {
                Scanner sc = new Scanner(f);
                if (sc.hasNextLine()) System.out.println(sc.nextLine().trim());
                sc.close();
            }
        } catch (Exception e) {}
    }
}
J4_APP

# Java Module 5 (Resource Properties Loading)
DXS bash -c "echo -e 'app.name=CyberRange\nauth.secret=SYSTEM_METRICS_OK' > /home/student/java/module5/app.properties"
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/java/module5/ConfigLoader.java" <<J5
import java.io.File;
import java.io.FileInputStream;
import java.util.Properties;
import java.util.Scanner;

public class ConfigLoader {
    public static void main(String[] args) {
        try {
            Properties prop = new Properties();
            prop.load(new FileInputStream("app.properties"));
            System.out.println("Property Read: " + prop.getProperty("auth.secret"));
            File f = new File(".flag");
            if (f.exists()) {
                Scanner sc = new Scanner(f);
                if (sc.hasNextLine()) System.out.println(sc.nextLine().trim());
                sc.close();
            }
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
}
J5


# ============================================================
# 4. C TRACK WORKSPACES (Flags hidden in .flag files)
# ============================================================
for m in module1 module2 module3 module4 module5; do
    DXS mkdir -p "/home/student/c/${m}"
    flag_val=$(eval echo "\$FLAG_c_${m}")
    DXS bash -c "echo '${flag_val}' > /home/student/c/${m}/.flag"
done

# C Module 1
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/c/module1/main.c" <<C1
#include <stdio.h>

int main() {
    printf("C Environment Ready.\n");
    FILE *f = fopen(".flag", "r");
    if (f != NULL) {
        char flag[64];
        if (fscanf(f, "%63s", flag) == 1) printf("%s\n", flag);
        fclose(f);
    }
    return 0;
}
C1

# C Module 2
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/c/module2/calc.c" <<C2
#include <stdio.h>

int main() {
    int code = 1337;
    if (code == 1337) {
        printf("Authorization Code Evaluated: %d\n", code);
        FILE *f = fopen(".flag", "r");
        if (f != NULL) {
            char flag[64];
            if (fscanf(f, "%63s", flag) == 1) printf("%s\n", flag);
            fclose(f);
        }
    }
    return 0;
}
C2

# C Module 3 (Header Files & Macro Definitions: config.h, app.c)
DXS bash -c "echo -e '#define TARGET_PORT 8080\n#define APP_TITLE \"CyberTelemetry\"' > /home/student/c/module3/config.h"
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/c/module3/app.c" <<C3
#include <stdio.h>
#include "config.h"

int main() {
    printf("Application Initialized: %s (Port %d)\n", APP_TITLE, TARGET_PORT);
    FILE *f = fopen(".flag", "r");
    if (f != NULL) {
        char flag[64];
        if (fscanf(f, "%63s", flag) == 1) printf("%s\n", flag);
        fclose(f);
    }
    return 0;
}
C3

# C Module 4 (Binary Inspection & String Extraction: strings, file)
DXS bash -c "echo 'BINARY_METRICS_DATA_TABLE_SERIAL_9982' > /home/student/c/module4/artifact.bin"
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/c/module4/decoder.c" <<C4
#include <stdio.h>

void decode(char *ptr) {
    printf("%s\n", ptr);
}

int main() {
    FILE *f = fopen(".flag", "r");
    if (f != NULL) {
        char flag[64];
        if (fscanf(f, "%63s", flag) == 1) decode(flag);
        fclose(f);
    }
    return 0;
}
C4

# C Module 5 (Struct Deserialization & Binary File I/O)
DXS bash -c "echo 'SYSTEM_METRICS_OK' > /home/student/c/module5/data.bin"
docker exec -i -u student "$STUDENT_CONTAINER" bash -c "cat > /home/student/c/module5/structs.c" <<C5
#include <stdio.h>

struct Config {
    char key[64];
};

int main() {
    struct Config c;
    FILE *f = fopen("data.bin", "rb");
    if (f != NULL) {
        fread(&c, sizeof(struct Config), 1, f);
        printf("Struct Data Read: %s\n", c.key);
        fclose(f);
    }
    FILE *ff = fopen(".flag", "r");
    if (ff != NULL) {
        char flag[64];
        if (fscanf(ff, "%63s", flag) == 1) printf("Deserialized Key: %s\n", flag);
        fclose(ff);
    }
    return 0;
}
C5

    echo "==> Lab setup complete for student: ${STUDENT_ID}"
) &

echo ""
echo "=================================================="
echo "  Command Line Lab services started."
echo "  Student:  ${STUDENT_ID}"
echo "  Terminal: ws://<host>:8022"
echo "  Progress: http://<host>:9500"
echo "  Hints:    http://<host>:9600"
echo "  Lab setup running in background..."
echo "=================================================="

wait
