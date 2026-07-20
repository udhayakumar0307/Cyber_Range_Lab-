# Lab 1: Instructor Guide
## Network Reconnaissance — Solutions & Setup

---

## Setup Instructions

### Generating Student Seeds

Each student needs a unique `LAB_SEED` to get unique flags. Generate them:

```python
import hashlib, secrets

students = ["alice", "bob", "charlie", "diana"]  # replace with real IDs

for s in students:
    seed = secrets.token_hex(8)
    print(f"Student: {s:15} | STUDENT_ID={s} LAB_SEED={seed}")
    # Save these — you need them to validate flags if needed
```

Distribute each student's `STUDENT_ID` and `LAB_SEED` privately.

### Running for Multiple Students

Each student runs their own isolated stack:

```bash
STUDENT_ID=alice LAB_SEED=abc123def456 docker-compose up --build -d
```

For a classroom, consider:
- One VM per student (each running their own docker-compose)
- Or a shared server with Docker namespacing per student

---

## Module Solutions

### Module 1: Port Discovery & Enumeration

**Solution:**
```bash
nmap -F 10.10.0.10
# Or: nmap -p 1-1000 10.10.0.10

# Connect to FTP anonymously
ftp 10.10.0.10
# Username: anonymous
# Password: (any email or blank)

ftp> ls
# Shows: README_INTERNAL.txt

ftp> get README_INTERNAL.txt
ftp> quit
cat README_INTERNAL.txt  # Contains FLAG{...}
```

**What students should find:**
- Open ports: 21 (FTP), 22 (SSH), 80 (HTTP), 3306 (MySQL)
- FTP allows anonymous login
- Flag is in `/var/ftp/pub/README_INTERNAL.txt`

---

### Module 2: Service Version Fingerprinting

**Solution:**
```bash
nmap -sV -p 21,22,80,3306 10.10.0.10

# Grab SSH banner directly
nc 10.10.0.10 22

# Connect to MySQL with the scanner account (no password)
mysql -h 10.10.0.10 -u scanner
> USE techcorp_db;
> SELECT * FROM employees;
# Flag is in the 'secret_note' column for the admin user
```

**What students should find:**
- MySQL version string (e.g., `5.7.31-ubuntu`)
- SSH banner reveals OS + OpenSSH version
- MySQL `scanner` account has no password
- Flag is the `secret_note` of the `admin` employee

---

### Module 3: Hidden Service Discovery

**Solution:**
```bash
# Must scan ALL ports — not just common ones
nmap -p- --min-rate 2000 10.10.0.10
# Discovers port 9000

# Enumerate the HTTP API
curl http://10.10.0.10:9000/
# Returns JSON listing endpoints including /debug

curl http://10.10.0.10:9000/debug | python3 -m json.tool
# Flag is the value of "internal_api_key"
```

**Common mistakes:**
- Only scanning common ports (misses 9000 and 8888)
- Not reading the endpoint listing at `/`

---

### Module 4: Credential Discovery

**Solution:**
```bash
# From Module 2, students found 'backup' user and a password
# The sysadmin note in the DB says: "Check /home/backup for backup keys"
# The password for backup user is in the employees table: backup123

ssh backup@10.10.0.10
# Password: backup123

ls -la /home/backup/
# Shows: .secret_backup_key (hidden file, starts with dot)

cat /home/backup/.secret_backup_key
# Contains FLAG{...}
```

**Key lesson:** The credential chain — DB exposes username → DB notes expose hint → SSH login → flag found.

---

### Module 5: Full Network Infiltration (Capstone)

**Solution:**
```bash
# Port 8888 was found in Module 3's full scan
nc 10.10.0.10 8888
# Banner shows: AdminConsole/1.3.2 with command list

> AUTH
# Password prompt appears

# Password is "techcorp_admin_2024"
# Students should find this via:
# - The /debug endpoint from Module 3 (db_pass leakage pattern)
# - Pattern matching from other passwords in the DB
# Note: The exact password can be found by examining
#       admin_service.py or by brute force with discovered patterns

> FLAG
# Returns FLAG{...}
```

**Design note:** The admin password `techcorp_admin_2024` follows the same pattern as other TechCorp passwords. Students who paid attention to the naming convention can guess it. This teaches pattern recognition in password enumeration.

---

## Grading Rubric

| Criteria | Points |
|----------|--------|
| Module 1 flag captured | 100 |
| Module 2 flag captured | 150 |
| Module 3 flag captured | 200 |
| Module 4 flag captured | 250 |
| Module 5 flag captured | 300 |
| Speed bonus (first blood per module) | +50 each |
| **Total possible** | **1,250** |

---

## Resetting a Student's Progress

```bash
curl -X POST http://localhost:5000/reset \
  -H "Content-Type: application/json" \
  -d '{"secret": "instructor_reset_2024"}'
```

Change the reset secret in `scoring-server/app.py` before deploying.

---

## Common Student Issues

| Problem | Solution |
|---------|---------|
| "nmap not found" | Rebuild student container: `docker-compose build student-env` |
| "Can't connect to scoring server" | Check container is up: `docker ps` |
| "FTP connection refused" | vsftpd may have crashed; restart: `docker-compose restart techcorp-services` |
| "MySQL login denied" | Use `-u scanner` with no password flag: `mysql -h 10.10.0.10 -u scanner` |
| "Can't find port 8888" | Students must run full scan (`-p-`), not fast scan (`-F`) |

---

## Architecture Notes

- All flags are generated deterministically from `STUDENT_ID + LAB_SEED`
- The same algorithm runs in both `entrypoint.sh` and `scoring-server/app.py`
- This means the scoring server can validate flags without needing to contact the target
- Flags cannot be shared: Bob's `FLAG{...}` will be rejected when Alice submits it

---

## Next Steps

After Lab 1, students have:
- Mapped open ports and services
- Fingerprinted software versions
- Found credentials in databases
- Used credentials to gain access
- Discovered hidden services via full-range scanning

Lab 2 builds directly on this: the web app they found on port 80 becomes the primary attack surface for SQL injection and XSS.
