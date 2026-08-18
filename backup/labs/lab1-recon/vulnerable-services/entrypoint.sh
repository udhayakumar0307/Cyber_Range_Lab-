#!/bin/bash
# ============================================================
# TechCorp Vulnerable Services Entrypoint
# Generates per-student dynamic flags from STUDENT_ID seed
# ============================================================

set -uo pipefail

STUDENT_ID="${STUDENT_ID:-student}"
LAB_SEED="${LAB_SEED:-defaultseed}"

# ── Dynamic Flag Generation ───────────────────────────────
# Each flag is deterministic per student but unique across students.
# Format: FLAG{techcorp_labX_modY_<student>_<hash8>}

gen_flag() {
    local lab="$1"
    local mod="$2"
    # Match scoring server's algorithm: lab{lab}_mod{module}_{student_id}_{lab_seed}
    echo -n "lab${lab}_mod${mod}_${STUDENT_ID}_${LAB_SEED}" | sha256sum | awk '{print substr($1,1,8)}'
}

FLAG1="FLAG{techcorp_lab1_mod1_${STUDENT_ID}_$(gen_flag 1 1)}"
FLAG2="FLAG{techcorp_lab1_mod2_${STUDENT_ID}_$(gen_flag 1 2)}"
FLAG3="FLAG{techcorp_lab1_mod3_${STUDENT_ID}_$(gen_flag 1 3)}"
FLAG4="FLAG{techcorp_lab1_mod4_${STUDENT_ID}_$(gen_flag 1 4)}"
FLAG5="FLAG{techcorp_lab1_mod5_${STUDENT_ID}_$(gen_flag 1 5)}"

echo "==> Generated flags for student: $STUDENT_ID"

# ── Persist flags for scoring server ─────────────────────
mkdir -p /flags
cat > /flags/flags.json <<EOF
{
  "student_id": "${STUDENT_ID}",
  "lab": 1,
  "flags": {
    "module1": "${FLAG1}",
    "module2": "${FLAG2}",
    "module3": "${FLAG3}",
    "module4": "${FLAG4}",
    "module5": "${FLAG5}"
  }
}
EOF

# ── Start MySQL/MariaDB ───────────────────────────────────
echo "==> Starting MariaDB..."
if [ ! -d "/var/lib/mysql/mysql" ] || [ ! -f "/var/lib/mysql/ibdata1" ] || [ ! -s "/var/lib/mysql/ibdata1" ]; then
    echo "==> Re-initializing MariaDB data directory..."
    rm -rf /var/lib/mysql/*
    mysql_install_db --user=mysql --datadir=/var/lib/mysql
fi
# Bind to all interfaces so nmap/students can reach port 3306
sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf
service mariadb start
sleep 3

# Initialize DB if it doesn't exist yet
DB_EXISTS=$(mysql -u root -sse "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='techcorp_db';" 2>/dev/null || echo "0")
if [ "$DB_EXISTS" = "0" ]; then
    echo "==> Initializing database..."
    mysql -u root < /docker-entrypoint-initdb.d/init.sql
fi

# Inject student-specific flags into database (runs every boot to survive restarts)
mysql -u root techcorp_db <<SQL
  UPDATE employees SET secret_note='${FLAG2}' WHERE username='admin';
  UPDATE config SET value='${FLAG3}' WHERE key_name='internal_api_key';
SQL

# ── Start SSH ─────────────────────────────────────────────
echo "==> Starting SSH..."
service ssh start

# ── Plant flags in backup user's home directory ─────────────
echo "==> Setting up backup user environment (Module 4)..."

# Create .ssh directory for SSH hint files
mkdir -p /home/backup/.ssh
chmod 700 /home/backup/.ssh

# Create SSH config file with admin console hints
cat > /home/backup/.ssh/config << 'SSHEOF'
# SSH Configuration for backup account

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa

Host backup-mirror.internal
    HostName 10.10.0.5
    User backup
    Port 22
    IdentityFile ~/.ssh/id_rsa

# ===============================================
# ADMIN CONSOLE PASSWORD REFERENCE
# ===============================================
# Service: TechCorp Admin Console (port 8888)
# Authentication: Required for FLAG retrieval
#
# Password Format: techcorp_[role]_[year]
# Actual Password: techcorp_admin_2024
#
# NOTE: Storing plaintext passwords in config files
# is a security vulnerability but useful for admin
# emergency access. This is intentional for this lab.
# ===============================================
SSHEOF

# Create SSH notes file with explicit admin password hint
# (Students will find this in Module 4 when they SSH as backup)
cat > /home/backup/.ssh/id_rsa.notes << 'SSHEOF'
=================================================================
            Admin Console Access Credentials
=================================================================

Service Name: TechCorp Industries Admin Console
Location: port 8888
Protocol: Raw TCP (use netcat/telnet)

Authentication:
  Command: AUTH
  Username: admin (implicit)
  Password: techcorp_admin_2024

Flag Retrieval:
  Command: FLAG
  (Only works after successful authentication)

Password Pattern:
  Format: techcorp_[role]_[year]
  Example: techcorp_sysadmin_2026, techcorp_admin_2024

This file contains sensitive credentials in plaintext.
Standard: ❌ DANGEROUS
For Lab/Emergency Access: ✅ ACCEPTABLE
=================================================================
SSHEOF

# Set correct permissions
chown -R backup:backup /home/backup/.ssh
chmod 600 /home/backup/.ssh/config
chmod 600 /home/backup/.ssh/id_rsa.notes

# Also set up tcbackup for backward compatibility
mkdir -p /home/tcbackup/.ssh
chmod 700 /home/tcbackup/.ssh
cp /home/backup/.ssh/config /home/tcbackup/.ssh/
cp /home/backup/.ssh/id_rsa.notes /home/tcbackup/.ssh/
chown -R tcbackup:tcbackup /home/tcbackup/.ssh
chmod 600 /home/tcbackup/.ssh/config
chmod 600 /home/tcbackup/.ssh/id_rsa.notes

# Plant Module 4 flag in backup user's home
echo "${FLAG4}" > /home/backup/.secret_backup_key
chown backup:backup /home/backup/.secret_backup_key
chmod 600 /home/backup/.secret_backup_key

# ── Start FTP ─────────────────────────────────────────────
echo "==> Starting FTP..."
# Plant FTP README for Module 1 entry point
cat > /var/ftp/pub/README.txt << 'FTPEOF'
=================================================================
         Welcome to TechCorp FTP Server (Public Access)
=================================================================

System Information:
- This FTP server contains public documentation
- Main database available on port 3306 (MySQL)
- 'scanner' user is used for easy access to the database
- For system access, contact the backup administrator
- Backup user account available for SSH access

Database Credentials Note:
- Check the database config table for internal system hints
- Password fields in the employees table contain security notes

Network Services:
- FTP (you are here): port 21
- SSH: port 22
- HTTP: port 80
- MySQL: port 3306
- Internal API: port 9000
- Admin Console: port 8888 (hidden from this list)

System Access:
- Username: backup
- Password: (find in database config table)

Discovery Path:
1. Scan ports on 10.10.0.10 (you already found FTP!)
2. Check the database for admin intel
3. Look for services not listed here
4. Explore API endpoints when you find them
5. Follow the hints—they'll lead you somewhere useful

Good luck with your security assessment!
=================================================================
FTPEOF

# Also plant Module 1 flag in FTP directory
echo "${FLAG1}" > /var/ftp/pub/FLAG1_DISCOVERED.txt
chown ftp:ftp /var/ftp/pub/README.txt
chown ftp:ftp /var/ftp/pub/FLAG1_DISCOVERED.txt
chmod 644 /var/ftp/pub/README.txt
chmod 644 /var/ftp/pub/FLAG1_DISCOVERED.txt

service vsftpd start

# ── Start Apache ──────────────────────────────────────────
echo "==> Starting Apache..."
service apache2 start

# ── Start Hidden Services ─────────────────────────────────
echo "==> Starting hidden admin service on port 8888..."
python3 /opt/services/admin_service.py "${FLAG5}" &

echo "==> Starting internal API on port 9000..."
python3 /opt/services/internal_api.py "${FLAG3}" &

# Give services time to start
sleep 2

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     TechCorp Industries - Vulnerable Lab Environment     ║"
echo "║                  All services started.                   ║"
echo "║                                                          ║"
echo "║  Student ID:        ${STUDENT_ID}                        ║"
echo "║  Target IP:         10.10.0.10                           ║"
echo "║  Available Services:                                     ║"
echo "║    • FTP (21)       - Anonymous access enabled           ║"
echo "║    • SSH (22)       - backup user available              ║"
echo "║    • HTTP (80)      - Web server                         ║"
echo "║    • MySQL (3306)   - Weak credentials                   ║"
echo "║    • API (9000)     - Internal, unprotected              ║"
echo "║    • Admin (8888)   - Hidden admin console               ║"
echo "║                                                          ║"
echo "║  System Access:  backup user (password in DB)            ║"
echo "║  Ready for pentesting. Begin reconnaissance!            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Keep container alive
tail -f /dev/null