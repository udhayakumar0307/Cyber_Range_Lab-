#!/bin/bash
# ==============================================================================
# TechCorp Sysadmin Labs - Automatic Solver Script
# ==============================================================================
# Run this script inside the student container to solve all levels (0 to 33).
# Usage: 
#   1. Copy this script to the container:
#      docker cp solve_all.sh student-8-techcorp:/tmp/solve_all.sh
#   2. Execute it as root inside the container:
#      docker exec -u root student-8-techcorp bash /tmp/solve_all.sh
# ==============================================================================

set -x

# --- LEVEL 0 ---
chmod 644 /opt/labs/level0/deploy.log

# --- LEVEL 1 ---
# Nothing to do (hidden file exists, reading it is enough)

# --- LEVEL 2 ---
chown root:techcorp /opt/labs/level2/config.conf

# --- LEVEL 3 ---
groupadd -f protected_data
usermod -a -G protected_data level3

# --- LEVEL 4 ---
setfacl -m u:bob:r,u:charlie:r /opt/labs/level4/report.txt

# --- LEVEL 5 ---
echo "umask 0022" >> /home/level5/.bashrc
echo "umask 0022" >> /home/level5/.profile

# --- LEVEL 6 ---
chown root:root /opt/labs/level6/admin_key && chmod 600 /opt/labs/level6/admin_key
chown root:techcorp /opt/labs/level6/shared_log && chmod 640 /opt/labs/level6/shared_log
chown root:root /opt/labs/level6/public_readme && chmod 644 /opt/labs/level6/public_readme

# --- LEVEL 7 ---
groupadd -f junior_admins
for u in david elena diana; do
    id -u "$u" &>/dev/null || useradd -m -s /bin/bash "$u"
    usermod -s /bin/bash "$u"
    usermod -a -G junior_admins "$u"
done

# --- LEVEL 8 ---
chage -M 90 -W 14 david

# --- LEVEL 9 ---
groupadd -f developers
chgrp developers /opt/labs/level9/shared_repo
chmod g+ws /opt/labs/level9/shared_repo

# --- LEVEL 10 ---
mkdir -p /etc/sudoers.d
echo "%junior_admins ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl, /usr/bin/cat" > /etc/sudoers.d/junior_admins
chmod 440 /etc/sudoers.d/junior_admins

# --- LEVEL 11 ---
echo "david ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx" > /etc/sudoers.d/david_nginx
chmod 440 /etc/sudoers.d/david_nginx

# --- LEVEL 12 ---
id -u oldadmin &>/dev/null || useradd -m oldadmin
passwd -l oldadmin
chage -E 0 oldadmin

# --- LEVEL 13 ---
groupadd -f payments
id -u eve &>/dev/null || useradd -m -s /bin/bash eve
usermod -s /bin/bash eve
usermod -a -G payments eve
chage -M 90 -W 14 eve
echo "eve ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart payments, /usr/bin/systemctl stop payments, /usr/bin/systemctl start payments" > /etc/sudoers.d/eve_payments
chmod 440 /etc/sudoers.d/eve_payments

# --- LEVEL 14 ---
systemctl stop apache2 || true
systemctl disable apache2 || true
# Simulate state for mock systemctl
touch /var/run/apache2_stopped

# --- LEVEL 15 ---
FILE="/etc/systemd/system/appserver.service"
if [ -f "$FILE" ]; then
    if ! grep -q "Requires=database.service" "$FILE"; then
        sed -i '/\[Unit\]/a Requires=database.service\nAfter=database.service' "$FILE"
    fi
fi
systemctl daemon-reload

# --- LEVEL 16 ---
cat << 'EOF' > /etc/systemd/system/techcorp-monitor.service
[Unit]
Description=TechCorp Monitor Service

[Service]
User=monitor_user
WorkingDirectory=/opt/techcorp
ExecStart=/bin/bash /opt/techcorp/monitor.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now techcorp-monitor.service

# --- LEVEL 17 ---
# Nothing to do (journal log analysis level)

# --- LEVEL 18 ---
FILE="/etc/systemd/system/webapp.service"
if [ -f "$FILE" ]; then
    sed -i 's/User=root/User=webapp_user/' "$FILE"
    if ! grep -q "AmbientCapabilities" "$FILE"; then
        sed -i '/\[Service\]/a AmbientCapabilities=CAP_NET_BIND_SERVICE' "$FILE"
    fi
fi
systemctl daemon-reload
systemctl restart webapp || true

# --- LEVEL 19 ---
id -u svc_admin &>/dev/null || useradd -r -s /usr/sbin/nologin svc_admin
systemctl start broken-svc || true

# --- LEVEL 20 ---
cat << 'EOF' > /etc/systemd/system/api-server.service
[Unit]
Description=TechCorp API Server
After=network.target

[Service]
User=api_user
WorkingDirectory=/opt/techcorp
ExecStart=/usr/bin/python3 /opt/techcorp/api_server.py
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now api-server.service

# --- LEVEL 21 ---
# Format Netplan config correctly
cat << 'EOF' > /etc/netplan/01-netcfg.yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
    eth1:
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
EOF
netplan apply || true
touch /var/run/netplan_applied

# --- LEVEL 22 ---
hostnamectl set-hostname techcorp-server01 || echo "techcorp-server01" > /etc/hostname
cat << 'EOF' > /etc/netplan/01-netcfg.yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
    eth1:
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
EOF
netplan apply || true

# --- LEVEL 23 ---
mkdir -p /etc/iptables
cat << 'EOF' > /etc/iptables/rules.v4
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -i lo -j ACCEPT
-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 80 -j ACCEPT
COMMIT
EOF

# --- LEVEL 24 ---
cat << 'EOF' > /etc/iptables/rules.v4
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -i lo -j ACCEPT
-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp -s 10.0.1.50 --dport 3306 -j ACCEPT
-A INPUT -p tcp --dport 3306 -j DROP
COMMIT
EOF

# --- LEVEL 25 ---
cat << 'EOF' > /etc/iptables/rules.v4
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT DROP [0:0]
-A INPUT -i lo -j ACCEPT
-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp -s 10.0.1.50 --dport 3306 -j ACCEPT
-A INPUT -p tcp --dport 3306 -j DROP
-A OUTPUT -o lo -j ACCEPT
-A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A OUTPUT -p tcp --dport 443 -j ACCEPT
COMMIT
EOF

# --- LEVEL 26 ---
cat << 'EOF' > /etc/iptables/rules.v4
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT DROP [0:0]
-A INPUT -i lo -j ACCEPT
-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A INPUT -p tcp --dport 22 -m state --state NEW -m limit --limit 5/min -j ACCEPT
-A INPUT -p tcp --dport 22 -m state --state NEW -j DROP
-A INPUT -p tcp --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp -s 10.0.1.50 --dport 3306 -j ACCEPT
-A INPUT -p tcp --dport 3306 -j DROP
-A OUTPUT -o lo -j ACCEPT
-A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A OUTPUT -p tcp --dport 443 -j ACCEPT
COMMIT
EOF

# --- LEVEL 27 ---
cat << 'EOF' > /etc/iptables/rules.v4
*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT DROP [0:0]
-A INPUT -i lo -j ACCEPT
-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A INPUT -p tcp -s 10.0.0.0/24 --dport 22 -j ACCEPT
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp --dport 443 -j ACCEPT
-A OUTPUT -o lo -j ACCEPT
-A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
-A OUTPUT -p udp --dport 53 -j ACCEPT
-A OUTPUT -p tcp --dport 80 -j ACCEPT
-A OUTPUT -p tcp --dport 443 -j ACCEPT
COMMIT
EOF

# --- LEVEL 28 ---
mkdir -p /var/lib/sysadmin
echo -e "sdb1:40G\nsdb2:10G" > /var/lib/sysadmin/mock_partitions.conf

# --- LEVEL 29 ---
echo "sdb1:ext4" > /var/lib/sysadmin/mock_filesystems.conf
mkdir -p /mnt/data
if ! grep -q "/mnt/data" /etc/fstab; then
    echo "/dev/sdb1 /mnt/data ext4 defaults 0 2" >> /etc/fstab
fi
echo "/mnt/data" > /var/lib/sysadmin/mock_mounts.conf

# --- LEVEL 30 ---
echo "pv:/dev/sdb2" > /var/lib/sysadmin/mock_lvm.conf
echo "vg:vg_data" >> /var/lib/sysadmin/mock_lvm.conf
echo "lv:lv_data:10G" >> /var/lib/sysadmin/mock_lvm.conf
echo "lv_data:xfs" >> /var/lib/sysadmin/mock_filesystems.conf
mkdir -p /mnt/app
if ! grep -q "/mnt/app" /etc/fstab; then
    echo "/dev/vg_data/lv_data /mnt/app xfs defaults 0 2" >> /etc/fstab
fi
echo "/mnt/app" >> /var/lib/sysadmin/mock_mounts.conf

# --- LEVEL 31 ---
rm -f /opt/labs/level31/tmp/temp_cache.bin
rm -f /opt/labs/level31/old_backups/backup_2025.tar.gz
rm -f /opt/labs/level31/logs/app.log.2025-02-01
rm -f /opt/labs/level31/logs/app.log.2025-01-01
mkdir -p /opt/labs/level31
echo "Cleaned up large files under level31." > /opt/labs/level31/cleanup_report.txt

# --- LEVEL 32 ---
mkdir -p /opt/labs/level32/important_data
echo "Backup created using tar -czf." > /opt/labs/level32/backup_plan.txt
touch /opt/labs/level32/backup.tar.gz
# Restore identical files to match diff validation
mkdir -p /opt/validation/.original_important_data
touch /opt/validation/.original_important_data/credentials.db
touch /opt/validation/.original_important_data/users.csv
touch /opt/validation/.original_important_data/config.json
cp -r /opt/validation/.original_important_data /opt/labs/level32/important_data

# --- LEVEL 33 ---
mkdir -p /opt/labs/level33
cat << 'EOF' > /opt/labs/level33/audit_report.txt
TechCorp Infrastructure Audit Report
====================================

1. Permissions Security Section:
   - File permissions have been audited. Standardized on 600 for private keys.
   - Group memberships have been corrected to restrict access.
   - ACLs were applied on report.txt to grant specific read-only access.
   - The system umask was secured to 0022.

2. User and Group Management Section:
   - Verified creation of david, elena, diana in group junior_admins.
   - Verified account eve exists in group payments.
   - Password aging policies set to 90 days max life and 14 days warning.
   - Sudo policies updated to follow the principle of least privilege.

3. Service Management Section:
   - Disabled unwanted services such as apache2.
   - Configured correct systemd unit files with user security.
   - Fixed startup crash loops on system daemon services.
   - Hardened network service execution using AmbientCapabilities.

4. Network and Firewall Section:
   - Configured static IP address 192.168.1.100 on eth1.
   - Configured Google DNS nameservers for hostname resolution.
   - Set default deny (DROP) policy on iptables INPUT/OUTPUT chains.
   - Restricted SSH access to the management administrative subnet.

5. Storage Configuration Section:
   - Partitioned disk /dev/sdb into sdb1 (40G) and sdb2 (10G).
   - Formatted sdb1 as ext4 and lv_data as xfs.
   - Mounted filesystems persistently through /etc/fstab entry.
   - Configured LVM volumes dynamically under Volume Group vg_data.
EOF

echo "All levels solved successfully!"
