#!/bin/bash
set -e

echo "=== TechCorp Sysadmin Labs Provisioning Script ==="
echo "Setting up 34 levels with users, labs, and validation..."

# Configuration
TOTAL_LEVELS=34
LAB_DIR="/opt/labs"
VALIDATION_DIR="/opt/validation"
SCRIPTS_DIR="/opt/scripts"
TECHCORP_DIR="/opt/techcorp"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate random password
generate_password() {
    openssl rand -base64 12 | tr -d "=+/" | cut -c1-12
}

# Function to print progress
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================================================
# PART 1: CREATE USERS & INITIAL PASSWORDS
# ============================================================================
log_info "Creating users level0-level33..."

# Store passwords for reference (will be deleted after setup in production)
PASSWORD_FILE="${SCRIPTS_DIR}/initial_passwords.txt"
> "$PASSWORD_FILE"
chmod 600 "$PASSWORD_FILE"

for i in $(seq 0 $((TOTAL_LEVELS - 1))); do
    USERNAME="level${i}"
    
    # Use "starthere" for level0, random for others
    if [ $i -eq 0 ]; then
        PASSWORD="starthere"
    else
        PASSWORD=$(generate_password)
    fi
    
    # Create user if not exists
    if ! id "$USERNAME" &>/dev/null; then
        useradd -m -s /bin/bash "$USERNAME" || log_warn "User $USERNAME already exists"
    fi
    
    # Set password
    echo "${USERNAME}:${PASSWORD}" | chpasswd
    
    # Store password in secure validation file and reference file
    echo "$PASSWORD" > "${VALIDATION_DIR}/${USERNAME}.key"
    chmod 640 "${VALIDATION_DIR}/${USERNAME}.key"
    chown root:systemd-journal "${VALIDATION_DIR}/${USERNAME}.key"
    
    echo "${USERNAME}: ${PASSWORD}" >> "$PASSWORD_FILE"
done

log_info "Created users level0-level33"

# ============================================================================
# PART 2: SET UP OBJECTIVE FILES FOR EACH LEVEL
# ============================================================================
log_info "Creating objective files for each level..."

# Level 0
mkdir -p "${LAB_DIR}/level0"
cat > "${LAB_DIR}/level0/OBJECTIVE.txt" << 'EOF'
=== LEVEL 0 → 1: The Permission Audit Begins ===

SCENARIO:
Your first day at TechCorp. Developer alice can't read the deployment log.
It exists but is locked down with incorrect permissions.

OBJECTIVE:
Change /opt/labs/level0/deploy.log permissions so alice can read it.
Only alice and root should be able to read it. Others should have no access.

HINTS:
1. Use 'ls -l' to examine the target file's current permission bits and ownership.
2. Recall that Unix permissions use three octal values (Owner, Group, Others). How do you grant read access solely to the Owner?

SOLUTION:
Once you fix the permissions correctly, run: cat /opt/labs/level0/deploy.log
This file will contain the password for level1.
EOF

# Level 1
mkdir -p "${LAB_DIR}/level1"
cat > "${LAB_DIR}/level1/OBJECTIVE.txt" << 'EOF'
=== LEVEL 1 → 2: Hidden Configuration ===

SCENARIO:
Operations stored a critical config in a hidden file that you need to find.
The file starts with a dot (.) and won't appear in normal 'ls' output.

OBJECTIVE:
Navigate to /opt/labs/level1/. Find the hidden file (starts with .)
and read it to get the password for level2.

HINTS:
1. Files starting with a dot (.) are hidden by default in directory listings.
2. Look at the help or manual page for your list directory command to find the option that shows all files, including hidden ones.

SOLUTION:
Once you find and read the hidden file, it will contain the password for level2.
EOF

# Level 2
mkdir -p "${LAB_DIR}/level2"
cat > "${LAB_DIR}/level2/OBJECTIVE.txt" << 'EOF'
=== LEVEL 2 → 3: Ownership Matters ===

SCENARIO:
Configuration file config.conf is owned by the wrong user/group.
Currently: alice:users | Should be: root:techcorp
You need to fix ownership using chown.

OBJECTIVE:
Use 'chown root:techcorp /opt/labs/level2/config.conf'
Verify with 'ls -l', then read the file to get the password for level3.

HINTS:
1. Research the command used to modify file owner and group associations at once.
2. Standard user accounts cannot reassign file ownership to other users; you will need administrative privileges (sudo) to make this change.

SOLUTION:
Once ownership is correct, cat the file to see the password for level3.
EOF

mkdir -p "${LAB_DIR}/level3"
cat > "${LAB_DIR}/level3/OBJECTIVE.txt" << 'EOF'
=== LEVEL 3 → 4: File Permissions & Group Access ===

SCENARIO:
A script needs to read a protected file, but it can't because of permissions.
The file is readable only by the "protected_data" group.

OBJECTIVE:
1. Examine /opt/labs/level3/check_status.sh - it tries to read protected_data.txt
2. Run it - it will fail (permission denied)
3. Add yourself to the "protected_data" group:
   sudo usermod -a -G protected_data level3
4. Log out and back in to apply group changes
5. Run the script again - it should now work!

HINTS:
1. Inspect the group ownership of the target file, and verify your current group memberships using 'id'.
2. Research how to append group memberships to an existing user account. Remember that Unix group membership changes apply upon launching a new session.

SOLUTION:
Once in the group, run ./check_status.sh to see the password for level4.
EOF

# Additional levels
# Level 4
mkdir -p "${LAB_DIR}/level4"
cat > "${LAB_DIR}/level4/OBJECTIVE.txt" << 'EOF'
=== LEVEL 4 → 5: Access Control Lists (ACLs) ===

SCENARIO:
A report file '/opt/labs/level4/report.txt' contains sensitive sales data.
We need to grant read-only access to two specific users: bob and charlie,
without modifying the standard Unix owner/group permissions.

OBJECTIVE:
Use setfacl to grant read-only access for bob and charlie on report.txt.
Standard permissions must remain 600 (owner level4 only).

HINTS:
1. Standard Unix permissions only allow one owner and one group. For granting permissions to multiple specific users, research Access Control Lists (ACLs).
2. Look into the 'setfacl' utility to modify permissions, and 'getfacl' to audit the active rule entries.

SOLUTION:
Once you set the ACLs correctly, run 'check_level 4' to retrieve the password for level5.
EOF

# Level 5
mkdir -p "${LAB_DIR}/level5"
cat > "${LAB_DIR}/level5/OBJECTIVE.txt" << 'EOF'
=== LEVEL 5 → 6: umask & Default Permissions ===

SCENARIO:
New files in /opt/labs/level5/ are being created with overly permissive defaults (mode 666).
This is a security risk. You need to configure a secure default umask so new files
are created with 644 (rw-r--r--) and directories with 755 (rwxr-xr-x).

OBJECTIVE:
1. Examine your current umask using the 'umask' command.
2. Set a secure umask of 0022.
3. Make this umask setting persistent for the level5 user by adding it to their shell profile (e.g. ~/.bashrc).

HINTS:
1. The umask acts as a filter that masks out permissions from default permissions (typically 666 for files and 777 for directories).
2. Deduce the math: what mask removes write permission for the group and all permissions for others?
3. To persist settings across shell sessions, place the command inside the user's shell initialization script (rc file).

SOLUTION:
Verify the umask is active in new shell sessions, then run 'check_level 5' to retrieve the password for level6.
EOF

# Level 6
mkdir -p "${LAB_DIR}/level6"
cat > "${LAB_DIR}/level6/OBJECTIVE.txt" << 'EOF'
=== LEVEL 6 → 7: Practical Permission Audit ===

SCENARIO:
A security audit of the directory /opt/labs/level6/ has flagged multiple files with misconfigured permissions and owners.
You must audit the files against the security specification and fix them.

OBJECTIVE:
1. Read the specification in /opt/labs/level6/AUDIT_SPEC.txt.
2. Use 'chmod' and 'chown' (with sudo where required) to fix all three files:
   - admin_key
   - shared_log
   - public_readme

HINTS:
1. Review the requirements in AUDIT_SPEC.txt and use 'ls -l' to check existing values.
2. Apply standard chmod and chown commands using sudo permissions on the flagged files to match the specification.

SOLUTION:
Once all files are configured correctly, run 'check_level 6' to retrieve the password for level7.
EOF

# Level 7
mkdir -p "${LAB_DIR}/level7"
cat > "${LAB_DIR}/level7/OBJECTIVE.txt" << 'EOF'
=== LEVEL 7 → 8: On-board the New Team ===

SCENARIO:
Three new junior administrators are joining TechCorp today: david, elena, and diana.
You need to provision their system accounts, create a shared group for them, and add them to it.

OBJECTIVE:
1. Create a group named 'junior_admins'.
2. Create three users with standard bash shells and home directories: david, elena, and diana.
3. Add all three users to the 'junior_admins' group.

HINTS:
1. Look into administration commands for managing groups ('groupadd') and users ('useradd').
2. When creating users, use the options that provision their home directories and configure their shell to bash.
3. Ensure the newly provisioned users are appended to the junior admins group.

SOLUTION:
Once the group and accounts are fully provisioned, run 'check_level 7' to retrieve the password for level8.
EOF

# Level 8
mkdir -p "${LAB_DIR}/level8"
cat > "${LAB_DIR}/level8/OBJECTIVE.txt" << 'EOF'
=== LEVEL 8 → 9: Password Policies & Shadow File ===

SCENARIO:
To comply with security audits, the new administrator account 'david' must follow password expiration rules.
You need to configure the system's password aging parameters for this user.

OBJECTIVE:
Using the 'chage' command, set david's account password policies to:
- Max days before password change: 90
- Warn user before password expires: 14 days

HINTS:
1. Research the command-line utility used to alter password aging parameters on user accounts.
2. View the utility's manual page ('man <utility>') to find the arguments corresponding to setting the maximum password lifetime and the warning period.

SOLUTION:
Once password aging is configured, run 'check_level 8' to retrieve the password for level9.
EOF

# Level 9
mkdir -p "${LAB_DIR}/level9"
cat > "${LAB_DIR}/level9/OBJECTIVE.txt" << 'EOF'
=== LEVEL 9 → 10: Group Permissions & Shared Resources ===

SCENARIO:
The engineering team needs a shared folder at /opt/labs/level9/shared_repo/ where they can collaborate.
You must configure it so that any file created inside this folder is automatically owned by the 'developers' group,
and can be edited by anyone in that group.

OBJECTIVE:
1. Change the group owner of `/opt/labs/level9/shared_repo/` to 'developers'.
2. Enable the setgid bit on the directory.
3. Grant read, write, and execute permissions to the group on this directory.

HINTS:
1. Research SetGID (SGID) on directories. This special permission bit forces all newly created files in a folder to inherit the folder's group owner.
2. Configure the directory group owner, set the SGID bit, and ensure group members have write access.

SOLUTION:
Once configured, test it by creating a file there, then run 'check_level 9' to retrieve the password for level10.
EOF

# Level 10
mkdir -p "${LAB_DIR}/level10"
cat > "${LAB_DIR}/level10/OBJECTIVE.txt" << 'EOF'
=== LEVEL 10 → 11: sudo Basics & sudoers ===

SCENARIO:
The junior administrators (in the 'junior_admins' group) need the ability to manage system services and view logs.
You must grant them password-less sudo rights for specifically allowed commands: systemctl, journalctl, and cat.

OBJECTIVE:
1. Run visudo to safely edit `/etc/sudoers`.
2. Add a rule allowing the 'junior_admins' group to run the following commands with sudo, without a password:
   - /bin/systemctl
   - /bin/journalctl
   - /bin/cat

HINTS:
1. Always edit the sudo configuration using 'visudo' to prevent formatting syntax errors that can lock you out.
2. To specify a group in sudoers, prefix the name with '%'. List the exact paths to the binaries that the group is permitted to run without entering a password.

SOLUTION:
Once sudoers is correctly configured, run 'check_level 10' to retrieve the password for level11.
EOF

# Level 11
mkdir -p "${LAB_DIR}/level11"
cat > "${LAB_DIR}/level11/OBJECTIVE.txt" << 'EOF'
=== LEVEL 11 → 12: sudo with Specific Commands (Least Privilege) ===

SCENARIO:
As a junior administrator, David has access to restart the Nginx web server, but he should not be able to stop it,
start it, or run any other systemctl commands. You need to configure a fine-grained sudo rule to enforce this limit.

OBJECTIVE:
Using 'sudo visudo', add a rule that allows user 'david' to restart nginx with sudo, without a password, and nothing else.
Target command: /usr/bin/systemctl restart nginx

HINTS:
1. Sudoers policies can be restricted down to exact command-line arguments. Limit the command entry to the specific parameters requested.
2. Verify that executing the exact command works under sudo, whereas systemctl commands with different arguments are denied.

SOLUTION:
Once the rule is correctly set up, run 'check_level 11' to retrieve the password for level12.
EOF

# Level 12
mkdir -p "${LAB_DIR}/level12"
cat > "${LAB_DIR}/level12/OBJECTIVE.txt" << 'EOF'
=== LEVEL 12 → 13: Account Locking and Expiration ===

SCENARIO:
An administrator account 'oldadmin' is no longer in use. To prevent unauthorized logins immediately,
you must disable the account by locking the password and expiring the account.

OBJECTIVE:
1. Lock the password for user 'oldadmin' so it cannot be used to log in.
2. Expire the account 'oldadmin' immediately so that even with key-based auth or other means, access is denied.

HINTS:
1. Investigate how to lock an account password using the 'passwd' utility.
2. Expiring an account prevents password-less login methods (like SSH keys). Look at options in the password aging command to expire the account immediately.

SOLUTION:
Once both lock and expiration are complete, run 'check_level 12' to retrieve the password for level13.
EOF

# Level 13
mkdir -p "${LAB_DIR}/level13"
cat > "${LAB_DIR}/level13/OBJECTIVE.txt" << 'EOF'
=== LEVEL 13 → 14: Practical User Provisioning Scenario ===

SCENARIO:
A new contractor 'eve' has joined the payments team. You must onboard her account according to TechCorp safety policies.

OBJECTIVE:
1. Create the user 'eve' with a standard bash shell and home directory.
2. Add 'eve' to the existing 'payments' group.
3. Configure password aging policies on her account:
   - Maximum number of days between password change: 90
   - Number of days of warning before password expires: 14
4. Edit sudoers to grant 'eve' password-less access to restart the payments service:
   Command: /usr/bin/systemctl restart payments

HINTS:
1. Synthesize your user creation, group management, password policy configuration, and sudo delegation skills to complete this request.
2. Refer to commands from previous challenges to set up the account, assign the group, establish aging limits, and restrict service control sudoers access.

SOLUTION:
Once fully provisioned, run 'check_level 13' to retrieve the password for level14.
EOF

# Level 14
mkdir -p "${LAB_DIR}/level14"
cat > "${LAB_DIR}/level14/OBJECTIVE.txt" << 'EOF'
=== LEVEL 14 → 15: systemd Basics - Service Control ===

SCENARIO:
The Apache2 web server is running on the system, but Nginx is our standard. You need to stop and disable Apache2.
A critical warning message and the transition key are logged in the service's systemd journal when the service halts.

OBJECTIVE:
1. Stop the 'apache2' service.
2. Disable the 'apache2' service so it does not auto-start on boot.
3. Inspect the journald logs for the 'apache2' service to find the next level password.

HINTS:
1. To halt a running daemon and prevent it from launching on boot, use standard systemctl control operations.
2. Investigate the system log viewer ('journalctl') and filter by the specific unit (-u) to find the output.

SOLUTION:
Stop the service, then read the logs to find the password for level15.
EOF

# Level 15
mkdir -p "${LAB_DIR}/level15"
cat > "${LAB_DIR}/level15/OBJECTIVE.txt" << 'EOF'
=== LEVEL 15 → 16: Service Dependencies & Ordering ===

SCENARIO:
We have two custom services: 'database.service' and 'appserver.service'. Currently, they start in arbitrary order,
causing the appserver to crash on boot because the database is not yet ready.
You must configure appserver to start after and depend on database.

OBJECTIVE:
1. Edit the systemd unit file for appserver: `/etc/systemd/system/appserver.service`
2. In the [Unit] section, configure dependencies:
   - Start after database: After=database.service
   - Require database: Requires=database.service
3. Reload systemd: sudo systemctl daemon-reload

HINTS:
1. Edit `/etc/systemd/system/appserver.service` to add dependency directives in the [Unit] section.
2. Research the systemd options 'After' (for startup ordering) and 'Requires' (for hard dependency binding).
3. Remember to notify systemd of unit file changes by reloading its configuration.

SOLUTION:
Once configured, run 'check_level 15' to retrieve the password for level16.
EOF

# Level 16
mkdir -p "${LAB_DIR}/level16"
cat > "${LAB_DIR}/level16/OBJECTIVE.txt" << 'EOF'
=== LEVEL 16 → 17: Creating Custom systemd Services ===

SCENARIO:
A custom application at /opt/techcorp/monitor.sh needs to run on boot under a dedicated user
and be managed by systemd. You must create a systemd unit file for it.

OBJECTIVE:
1. Create a systemd service file at /etc/systemd/system/techcorp-monitor.service with:
   - Description: TechCorp Monitor Service
   - Run under User: monitor_user
   - WorkingDirectory: /opt/techcorp
   - ExecStart: /bin/bash /opt/techcorp/monitor.sh
   - Restart: on-failure
   - RestartSec: 5
   - WantedBy: multi-user.target
2. Reload systemd: sudo systemctl daemon-reload
3. Enable and start the service: sudo systemctl enable --now techcorp-monitor.service
4. Check the service status and read /var/log/techcorp-monitor.log to find the level17 password.

HINTS:
1. Create a service unit file under systemd's configuration directory.
2. Ensure you specify the correct execution User context, WorkingDirectory, ExecStart command path, and Restart triggers.

SOLUTION:
Once the service is active and running, read the generated log at /var/log/techcorp-monitor.log to retrieve the password for level17.
EOF

# Level 17
mkdir -p "${LAB_DIR}/level17"
cat > "${LAB_DIR}/level17/OBJECTIVE.txt" << 'EOF'
=== LEVEL 17 → 18: Logs & journalctl ===

SCENARIO:
A critical application service 'buggy-app.service' is crashing unexpectedly on startup.
You must investigate the system logs using journalctl to diagnose the issue and find the recovery key.

OBJECTIVE:
1. Inspect the service status using: systemctl status buggy-app
2. View the systemd journal logs specifically for this service using: journalctl -u buggy-app
3. Locate the error message starting with 'CRITICAL: Database connection failed. Recovery key:' to find the level18 password.

HINTS:
1. Query system logs for the failed unit buggy-app using the systemd log utility.
2. Consider checking the end of the log output or filtering by priority to isolate error events.

SOLUTION:
Inspect the logs of the failed buggy-app service to retrieve the password for level18.
EOF

# Level 18
mkdir -p "${LAB_DIR}/level18"
cat > "${LAB_DIR}/level18/OBJECTIVE.txt" << 'EOF'
=== LEVEL 18 → 19: Service Security - User Context & Capabilities ===

SCENARIO:
A secure webapp service is currently configured to run as root. However, running network-exposed
services as root is a major security risk. You need to configure the service to run under the unprivileged
'webapp_user' context. To allow the unprivileged user to bind to privileged port 80, you must grant
the net bind capability using systemd AmbientCapabilities.

OBJECTIVE:
1. Edit the service file `/etc/systemd/system/webapp.service`.
2. Under the [Service] section:
   - Change 'User=root' to 'User=webapp_user'.
   - Add 'AmbientCapabilities=CAP_NET_BIND_SERVICE' to grant port binding privileges.
3. Reload systemd: sudo systemctl daemon-reload
4. Restart the service: sudo systemctl restart webapp
5. Verify the service is active using 'systemctl status webapp'.

HINTS:
1. Edit the service configuration and change the security execution context from root to webapp_user.
2. Use systemd's capabilities directives to pass Net Bind privileges specifically to the unprivileged process.

SOLUTION:
Once configured and reloaded, run 'check_level 18' to retrieve the password for level19.
EOF

# Level 19
mkdir -p "${LAB_DIR}/level19"
cat > "${LAB_DIR}/level19/OBJECTIVE.txt" << 'EOF'
=== LEVEL 19 → 20: Troubleshooting Failing Services ===

SCENARIO:
A custom internal service 'broken-svc.service' has failed to start. You need to analyze the logs,
diagnose the root cause of the startup failure, and resolve the issue.

OBJECTIVE:
1. Check the service status and logs using:
   - systemctl status broken-svc
   - journalctl -u broken-svc -n 50
2. Identify why it fails (hint: check the user specified in the service file).
3. Solve the issue by creating the missing user 'svc_admin' with a system account and no login shell:
   - Command: sudo useradd -r -s /usr/sbin/nologin svc_admin
4. Start the service and verify it is running:
   - sudo systemctl start broken-svc
   - systemctl status broken-svc

HINTS:
1. Check the service status and journalctl logs. Identify what user credentials the service is failing to load.
2. Ensure the required system credentials match the user account names present on the server.

SOLUTION:
Once the service starts successfully and transitions to the active running state, run 'check_level 19' to retrieve the password for level20.
EOF

# Level 20
mkdir -p "${LAB_DIR}/level20"
cat > "${LAB_DIR}/level20/OBJECTIVE.txt" << 'EOF'
=== LEVEL 20 → 21: Real Scenario - Deploying & Managing an App Service ===

SCENARIO:
You need to deploy a Python Flask application in production. You must create a systemd service unit
file to manage it securely under an unprivileged user context.

OBJECTIVE:
1. Create a service file `/etc/systemd/system/api-server.service` with:
   - Description: TechCorp API Server
   - After: network.target
   - User: api_user
   - WorkingDirectory: /opt/techcorp
   - ExecStart: /usr/bin/python3 /opt/techcorp/api_server.py
   - Restart: on-failure
   - RestartSec: 10
   - StandardOutput: journal
   - StandardError: journal
   - WantedBy: multi-user.target
2. Reload systemd: sudo systemctl daemon-reload
3. Enable and start the service: sudo systemctl enable --now api-server.service
4. Run 'curl localhost:5000' to query the running app and retrieve the level21 password.

HINTS:
1. Formulate a service file to launch the Python script as a daemon under api_user context.
2. Ensure standard outputs and logging configuration, restart delays, and startup targets align with the specs.

SOLUTION:
Once running, query the local port: 'curl http://localhost:5000' to retrieve the password for level21.
EOF

# Level 21
mkdir -p "${LAB_DIR}/level21"
cat > "${LAB_DIR}/level21/OBJECTIVE.txt" << 'EOF'
=== LEVEL 21 → 22: Network Interfaces & IP Configuration ===

SCENARIO:
A second network interface 'eth1' exists on the server but is not configured.
You must assign it a static IP address of 192.168.1.100/24 with gateway 192.168.1.1.

OBJECTIVE:
1. Edit the Netplan configuration file: /etc/netplan/01-netcfg.yaml
2. Configure the interface 'eth1' with the static IP 192.168.1.100/24 and route the default gateway via 192.168.1.1.
3. Apply the network configuration: sudo netplan apply

HINTS:
1. Examine the current structure of the Netplan file. Netplan configuration uses YAML format (indentation matters).
2. Research how to define static addresses and gateway routes inside the 'ethernets' block.
3. Remember to apply your network changes so they register with the system.

SOLUTION:
Once you correctly configure and apply Netplan, run 'check_level 21' to retrieve the password for level22.
EOF

# Level 22
mkdir -p "${LAB_DIR}/level22"
cat > "${LAB_DIR}/level22/OBJECTIVE.txt" << 'EOF'
=== LEVEL 22 → 23: DNS & Hostname Configuration ===

SCENARIO:
You need to identify this server in the network and configure external resolution.
Set the system hostname to 'techcorp-server01' and add Google DNS nameservers.

OBJECTIVE:
1. Change the system hostname to 'techcorp-server01' using hostnamectl.
2. Edit `/etc/netplan/01-netcfg.yaml` and add DNS nameservers `8.8.8.8` and `8.8.4.4` to the eth1 interface block.
3. Apply changes: sudo netplan apply

HINTS:
1. Look into the 'hostnamectl' tool options for updating the system hostname.
2. Research where to add the 'nameservers' list and 'addresses' field under an ethernet interface in Netplan.

SOLUTION:
Once configured and applied, run 'check_level 22' to retrieve the password for level23.
EOF

# Level 23
mkdir -p "${LAB_DIR}/level23"
cat > "${LAB_DIR}/level23/OBJECTIVE.txt" << 'EOF'
=== LEVEL 23 → 24: iptables Basics - Firewall Rules ===

SCENARIO:
You need to lock down the server from untrusted network traffic. Protect the host
by setting up a default-deny iptables firewall.

OBJECTIVE:
1. Set the default INPUT chain policy to DROP.
2. Allow loopback ('lo') traffic so internal services can communicate.
3. Allow incoming SSH (port 22) and HTTP (port 80) connections.
4. Allow stateful established and related connection traffic.
5. Save the iptables rules to `/etc/iptables/rules.v4`.

HINTS:
1. Set policies before adding allow rules, but be careful not to lock yourself out! (The mock wrapper will keep your session alive).
2. Ensure you allow loopback traffic ('-i lo') and established connections ('-m state --state ESTABLISHED,RELATED').
3. Save rules using 'iptables-save' redirected to `/etc/iptables/rules.v4`.

SOLUTION:
Once the firewall is active and saved, run 'check_level 23' to retrieve the password for level24.
EOF

# Level 24
mkdir -p "${LAB_DIR}/level24"
cat > "${LAB_DIR}/level24/OBJECTIVE.txt" << 'EOF'
=== LEVEL 24 → 25: Port Filtering & Service Exposure ===

SCENARIO:
The database server (port 3306) is exposed to the entire network. You must restrict port 3306
so that only the application server at IP `10.0.1.50` is allowed to connect, dropping all other sources.

OBJECTIVE:
1. Add an iptables rule to allow TCP traffic on port 3306 only from source IP `10.0.1.50`.
2. Add a rule to drop all other TCP traffic on port 3306.
3. Save the new rules configuration to `/etc/iptables/rules.v4`.

HINTS:
1. Command order matters! Sudoers rules are processed top-to-bottom. Specific ACCEPT rules must precede general DROP rules.
2. Use the source (-s) flag to whitelist the target application server IP.

SOLUTION:
Once the rules are configured and saved, run 'check_level 24' to retrieve the password for level25.
EOF

# Level 25
mkdir -p "${LAB_DIR}/level25"
cat > "${LAB_DIR}/level25/OBJECTIVE.txt" << 'EOF'
=== LEVEL 25 → 26: Troubleshooting Network Connectivity ===

SCENARIO:
A local application is failing to connect to an external server on HTTPS (port 443).
You must troubleshoot the connection block, identify the barrier, and resolve it.

OBJECTIVE:
1. Audit the iptables firewall policies for both incoming and outgoing chains.
2. Add an iptables rule to allow outgoing TCP traffic on port 443.
3. Save your rules configuration to `/etc/iptables/rules.v4`.

HINTS:
1. Examine output filters. Standard firewall rules can restrict outgoing packets (OUTPUT chain).
2. Look at the destination port (--dport) for outgoing secure traffic.

SOLUTION:
Once outgoing traffic on port 443 is permitted and rules are saved, run 'check_level 25' to retrieve the password for level26.
EOF

# Level 26
mkdir -p "${LAB_DIR}/level26"
cat > "${LAB_DIR}/level26/OBJECTIVE.txt" << 'EOF'
=== LEVEL 26 → 27: Stateful Rules & Rate Limiting ===

SCENARIO:
The server has been receiving a high volume of SSH connection requests. To prevent brute force
attacks, you need to restrict SSH access by implementing rate-limiting.

OBJECTIVE:
1. Limit SSH connections (TCP port 22) to a maximum of 5 new connections per minute per source IP.
2. Drop SSH traffic exceeding this limit.
3. Save the rules to `/etc/iptables/rules.v4`.

HINTS:
1. Research the 'limit' extension module in iptables (-m limit).
2. Ensure you place the limit rule before the drop rule.

SOLUTION:
Once the rate-limiting is configured and saved, run 'check_level 26' to retrieve the password for level27.
EOF

# Level 27
mkdir -p "${LAB_DIR}/level27"
cat > "${LAB_DIR}/level27/OBJECTIVE.txt" << 'EOF'
=== LEVEL 27 → 28: Security Hardening Scenario ===

SCENARIO:
You must perform a complete security hardening audit on the firewall. Implement a restrictive,
hardened firewall layout according to corporate security policy.

OBJECTIVE:
1. Set default DROP policies for INPUT, OUTPUT, and FORWARD chains.
2. Allow all loopback traffic.
3. Allow incoming SSH (port 22) only from the administrative subnet `10.0.0.0/24`.
4. Allow incoming HTTP (80) and HTTPS (443) from any source.
5. Allow outgoing DNS queries (UDP port 53) and outgoing HTTP/HTTPS (ports 80, 443) to any destination.
6. Allow stateful established/related traffic for active connections.
7. Save the configuration to `/etc/iptables/rules.v4`.

HINTS:
1. With a default DROP policy on OUTPUT, you must explicitly allow DNS and web traffic out, or name resolution and curls will fail.
2. Double-check all rules and save them.

SOLUTION:
Once the hardened configuration is saved, run 'check_level 27' to retrieve the password for level28.
EOF

# Level 28
mkdir -p "${LAB_DIR}/level28"
cat > "${LAB_DIR}/level28/OBJECTIVE.txt" << 'EOF'
=== LEVEL 28 → 29: Partitions & fdisk ===

SCENARIO:
A new 50GB storage disk (/dev/sdb) has been attached to the server. You need to partition it
for data and backup storage.

OBJECTIVE:
1. Partition the disk `/dev/sdb` into two primary partitions:
   - Partition 1 (/dev/sdb1): Size of 40GB
   - Partition 2 (/dev/sdb2): Size of 10GB
2. Write the changes and exit.

HINTS:
1. Research standard partitioning utilities like 'fdisk' or 'sfdisk'.
2. If using 'fdisk', command 'n' creates new partitions, 'p' sets them as primary, and size spec '+40G' allocates space.
3. Save partition tables with the 'w' command.

SOLUTION:
Once the disk partition table is written, run 'check_level 28' to retrieve the password for level29.
EOF

# Level 29
mkdir -p "${LAB_DIR}/level29"
cat > "${LAB_DIR}/level29/OBJECTIVE.txt" << 'EOF'
=== LEVEL 29 → 30: Filesystem Creation & Mounting ===

SCENARIO:
You have partitioned the data storage disk. Now you need to format the first partition
and mount it persistently so it is available across system boots.

OBJECTIVE:
1. Format the partition `/dev/sdb1` with the ext4 filesystem.
2. Create the mount directory: `/mnt/data`
3. Configure `/etc/fstab` to persistently mount `/dev/sdb1` on `/mnt/data` with default options.
4. Mount the partition: sudo mount -a

HINTS:
1. Research command-line formatting utilities (mkfs).
2. Examine `/etc/fstab` for the structure of mount entries.

SOLUTION:
Once formatted, added to fstab, and mounted, run 'check_level 29' to retrieve the password for level30.
EOF

# Level 30
mkdir -p "${LAB_DIR}/level30"
cat > "${LAB_DIR}/level30/OBJECTIVE.txt" << 'EOF'
=== LEVEL 30 → 31: Logical Volume Manager (LVM) ===

SCENARIO:
To allow flexible volume resizing, you need to manage the backup partition (/dev/sdb2)
using Logical Volume Manager (LVM).

OBJECTIVE:
1. Initialize the partition `/dev/sdb2` as an LVM Physical Volume (PV).
2. Create a Volume Group (VG) named `vg_data` using the `/dev/sdb2` PV.
3. Create a Logical Volume (LV) named `lv_data` of size 10GB inside the `vg_data` Volume Group.
4. Format the logical volume `/dev/vg_data/lv_data` as xfs.
5. Create mount point `/mnt/app` and persistently mount the LV on `/mnt/app` via `/etc/fstab`.
6. Mount the volume: sudo mount -a

HINTS:
1. Research LVM management commands: 'pvcreate', 'vgcreate', and 'lvcreate'.
2. XFS format uses 'mkfs.xfs'.
3. Persistent mount rules in `/etc/fstab` apply to LVM paths (e.g. `/dev/vg_data/lv_data`).

SOLUTION:
Once LVM is configured, formatted, added to fstab, and mounted, run 'check_level 30' to retrieve the password for level31.
EOF

# Level 31 Objective
mkdir -p "${LAB_DIR}/level31"
cat > "${LAB_DIR}/level31/OBJECTIVE.txt" << 'EOF'
=== LEVEL 31 → 32: Disk Usage Analysis & Cleanup ===

The root filesystem is filling up. Locate and identify large files/directories 
under '/opt/labs/level31/' that are unnecessary (such as old log files, temp files, 
or duplicate backups) and clean them up to bring the total size below 10MB.

Create a cleanup report at '/opt/labs/level31/cleanup_report.txt' documenting what was removed.

HINTS:
- Use 'du -sh /opt/labs/level31/*' to identify the largest subdirectories.
- Use 'find /opt/labs/level31/ -type f' to search for large clutter files.
- Document your changes before running 'check_level 31'.
EOF

# Level 32 Objective
mkdir -p "${LAB_DIR}/level32"
cat > "${LAB_DIR}/level32/OBJECTIVE.txt" << 'EOF'
=== LEVEL 32 → 33: Backup & Restore Basics ===

Your task is to back up the directory '/opt/labs/level32/important_data/', 
simulate a data loss event, and restore the directory from your backup.

Steps:
1. Create a gzipped tarball backup named '/opt/labs/level32/backup.tar.gz' containing '/opt/labs/level32/important_data/'.
2. Document your backup plan in '/opt/labs/level32/backup_plan.txt'.
3. Delete the '/opt/labs/level32/important_data/' directory to simulate data loss.
4. Restore the directory and all of its files from '/opt/labs/level32/backup.tar.gz'.

HINTS:
- Learn the 'tar' flags for compression ('-czf') and extraction ('-xzf').
- Remember to specify target extraction directories.
EOF

# Level 33 Objective
mkdir -p "${LAB_DIR}/level33"
cat > "${LAB_DIR}/level33/OBJECTIVE.txt" << 'EOF'
=== LEVEL 33 → 34: Capstone Infrastructure Audit ===

Demonstrate your system administration mastery by auditing the current host.
Review the file '/opt/labs/level33/AUDIT_CHECKLIST.txt' for instructions.

Document your audit findings in '/opt/labs/level33/audit_report.txt'.

HINTS:
- You must structure the document to include specific sections for:
  * "Permissions"
  * "User"
  * "Service"
  * "Network"
  * "Storage"
- Use standard audit utilities: 'ls -la', 'systemctl', 'iptables -L', 'df -h', 'du -sh'.
EOF

log_info "Created objective files for all levels"

# ============================================================================
# PART 3: SET UP LEVEL-SPECIFIC INITIAL "BROKEN" STATES
# ============================================================================
log_info "Setting up initial broken states for each level..."

# Level 0: File with wrong permissions
echo "level1_password: $(grep 'level1:' "$PASSWORD_FILE" | awk '{print $NF}')" > "${LAB_DIR}/level0/deploy.log"
chmod 000 "${LAB_DIR}/level0/deploy.log"  # Make completely unreadable initially
chown level0:level0 "${LAB_DIR}/level0/deploy.log"
log_info "Level 0: Created deploy.log with perms 000 (unreadable)"

# Level 1: Hidden config file
echo "level2_password: $(grep 'level2:' "$PASSWORD_FILE" | awk '{print $NF}')" > "${LAB_DIR}/level1/.secret_config"
chmod 644 "${LAB_DIR}/level1/.secret_config"
chown level1:level1 "${LAB_DIR}/level1/.secret_config"
log_info "Level 1: Created hidden .secret_config file"

# Level 2: File owned by wrong user
# Create additional users for lab scenarios
usermod -a -G techcorp level2
groupadd -f users
useradd -m -s /bin/bash alice || log_warn "User alice already exists"

# Level 2: File owned by wrong user
echo "level3_password: $(grep 'level3:' "$PASSWORD_FILE" | awk '{print $NF}')" > "${LAB_DIR}/level2/config.conf"
chmod 640 "${LAB_DIR}/level2/config.conf"
chown alice:users "${LAB_DIR}/level2/config.conf"

# Allow level2 to change ownership via sudo (for Level 2 challenge)
echo "level2 ALL=(ALL) NOPASSWD: /bin/chown" >> /etc/sudoers

log_info "Level 2: Created config.conf with alice:users ownership"

# Create a protected_data group for Level 3 challenge
groupadd -f protected_data

# Level 3: Script without setuid
echo "level3 ALL=(ALL) NOPASSWD: /bin/chmod" >> /etc/sudoers
echo "level3 ALL=(ALL) NOPASSWD: /usr/sbin/usermod" >> /etc/sudoers

cat > "${LAB_DIR}/level3/check_status.sh" << 'EOF'
#!/bin/bash
# This script needs to read a protected file
if [ -r "/opt/labs/level3/protected_data.txt" ]; then
    cat "/opt/labs/level3/protected_data.txt"
else
    echo "Permission denied: Cannot read protected_data.txt"
    exit 1
fi
EOF
chmod 755 "${LAB_DIR}/level3/check_status.sh"
chown root:root "${LAB_DIR}/level3/check_status.sh"

# Create protected data readable ONLY by group
LEVEL4_PASS=$(grep 'level4:' "$PASSWORD_FILE" | awk '{print $NF}')
echo "level4_password: ${LEVEL4_PASS}" > "${LAB_DIR}/level3/protected_data.txt"
chmod 640 "${LAB_DIR}/level3/protected_data.txt"  
chown root:protected_data "${LAB_DIR}/level3/protected_data.txt"

log_info "Level 3: Created check_status.sh script (needs setuid)"

# Level 4: File without ACLs for specific users
if ! id "bob" &>/dev/null; then
    useradd -m -s /bin/bash bob
fi
if ! id "charlie" &>/dev/null; then
    useradd -m -s /bin/bash charlie
fi
echo "level5_password: $(grep 'level5:' "$PASSWORD_FILE" | awk '{print $NF}')" > "${LAB_DIR}/level4/report.txt"
chmod 600 "${LAB_DIR}/level4/report.txt"
chown level4:level4 "${LAB_DIR}/level4/report.txt"
log_info "Level 4: Created report.txt (needs ACL setup)"

# Level 5: File with wrong umask
mkdir -p "${LAB_DIR}/level5"
echo "umask 0002" >> /home/level5/.bashrc
echo "Insecure file" > "${LAB_DIR}/level5/insecure_log.txt"
chmod 666 "${LAB_DIR}/level5/insecure_log.txt"
chown level5:level5 "${LAB_DIR}/level5/insecure_log.txt"
log_info "Level 5: Created umask demo environment"

# Level 6: Multiple files with audit requirements
mkdir -p "${LAB_DIR}/level6"
echo "Admin secret" > "${LAB_DIR}/level6/admin_key"
chmod 644 "${LAB_DIR}/level6/admin_key"
chown root:root "${LAB_DIR}/level6/admin_key"

echo "Shared log" > "${LAB_DIR}/level6/shared_log"
chmod 660 "${LAB_DIR}/level6/shared_log"
chown root:techcorp "${LAB_DIR}/level6/shared_log"

echo "Public readme" > "${LAB_DIR}/level6/public_readme"
chmod 600 "${LAB_DIR}/level6/public_readme"
chown root:root "${LAB_DIR}/level6/public_readme"

cat > "${LAB_DIR}/level6/AUDIT_SPEC.txt" << 'EOF'
File Permissions Audit Specification:

admin_key: should be 600 (owner: root, perms: rw-------)
shared_log: should be 640 (owner: root:techcorp, perms: rw-r-----)
public_readme: should be 644 (owner: root, perms: rw-r--r--)

Fix all three files to match the spec, then run: check_level 6
EOF
# Grant level6 specific sudo rights for the audit files
echo "level6 ALL=(ALL) NOPASSWD: /usr/bin/chmod 600 /opt/labs/level6/admin_key, /usr/bin/chmod 600 admin_key, /usr/bin/chmod 600 ./admin_key" >> /etc/sudoers
echo "level6 ALL=(ALL) NOPASSWD: /usr/bin/chmod 640 /opt/labs/level6/shared_log, /usr/bin/chmod 640 shared_log, /usr/bin/chmod 640 ./shared_log" >> /etc/sudoers
echo "level6 ALL=(ALL) NOPASSWD: /usr/bin/chmod 644 /opt/labs/level6/public_readme, /usr/bin/chmod 644 public_readme, /usr/bin/chmod 644 ./public_readme" >> /etc/sudoers
echo "level6 ALL=(ALL) NOPASSWD: /usr/bin/chown root\:root /opt/labs/level6/admin_key, /usr/bin/chown root\:root admin_key, /usr/bin/chown root\:root ./admin_key" >> /etc/sudoers
echo "level6 ALL=(ALL) NOPASSWD: /usr/bin/chown root\:techcorp /opt/labs/level6/shared_log, /usr/bin/chown root\:techcorp shared_log, /usr/bin/chown root\:techcorp ./shared_log" >> /etc/sudoers
echo "level6 ALL=(ALL) NOPASSWD: /usr/bin/chown root\:root /opt/labs/level6/public_readme, /usr/bin/chown root\:root public_readme, /usr/bin/chown root\:root ./public_readme" >> /etc/sudoers
log_info "Level 6: Created audit challenge with AUDIT_SPEC.txt"

# Level 7: On-board the New Team
echo "level7 ALL=(ALL) NOPASSWD: /usr/sbin/groupadd" >> /etc/sudoers
echo "level7 ALL=(ALL) NOPASSWD: /usr/sbin/useradd" >> /etc/sudoers
echo "level7 ALL=(ALL) NOPASSWD: /usr/sbin/usermod" >> /etc/sudoers
log_info "Level 7: Configured user provisioning sudo rules"

# Level 8: Password Policies & Shadow File
echo "level8 ALL=(ALL) NOPASSWD: /usr/bin/chage" >> /etc/sudoers
log_info "Level 8: Configured chage sudo rules"

# Level 9: Group Permissions & Shared Resources
mkdir -p "${LAB_DIR}/level9/shared_repo"
chown root:root "${LAB_DIR}/level9/shared_repo"
chmod 755 "${LAB_DIR}/level9/shared_repo"
usermod -a -G developers level9
echo "level9 ALL=(ALL) NOPASSWD: /usr/bin/chgrp developers /opt/labs/level9/shared_repo, /usr/bin/chgrp developers /opt/labs/level9/shared_repo/, /usr/bin/chgrp developers shared_repo, /usr/bin/chgrp developers shared_repo/, /usr/bin/chgrp developers ./shared_repo, /usr/bin/chgrp developers ./shared_repo/" >> /etc/sudoers
echo "level9 ALL=(ALL) NOPASSWD: /usr/bin/chmod g+s /opt/labs/level9/shared_repo, /usr/bin/chmod g+s /opt/labs/level9/shared_repo/, /usr/bin/chmod g+s shared_repo, /usr/bin/chmod g+s shared_repo/, /usr/bin/chmod g+s ./shared_repo, /usr/bin/chmod g+s ./shared_repo/" >> /etc/sudoers
echo "level9 ALL=(ALL) NOPASSWD: /usr/bin/chmod g+w /opt/labs/level9/shared_repo, /usr/bin/chmod g+w /opt/labs/level9/shared_repo/, /usr/bin/chmod g+w shared_repo, /usr/bin/chmod g+w shared_repo/, /usr/bin/chmod g+w ./shared_repo, /usr/bin/chmod g+w ./shared_repo/" >> /etc/sudoers
log_info "Level 9: Configured shared_repo with developers group"

# Level 10: sudo Basics & sudoers
echo "level10 ALL=(ALL) NOPASSWD: /usr/sbin/visudo" >> /etc/sudoers
log_info "Level 10: Configured visudo sudo rules"

# Level 11: sudo with Specific Commands
echo "level11 ALL=(ALL) NOPASSWD: /usr/sbin/visudo" >> /etc/sudoers
log_info "Level 11: Configured visudo sudo rules"

# Level 12: Account Locking and Expiration
if ! id "oldadmin" &>/dev/null; then
    useradd -m -s /bin/bash oldadmin
    echo "oldadmin:$(generate_password)" | chpasswd
fi
echo "level12 ALL=(ALL) NOPASSWD: /usr/bin/passwd -l oldadmin, /usr/bin/passwd -l ./oldadmin" >> /etc/sudoers
echo "level12 ALL=(ALL) NOPASSWD: /usr/bin/chage -E 0 oldadmin, /usr/bin/chage -E 0 ./oldadmin" >> /etc/sudoers
log_info "Level 12: Created oldadmin user and configured lock/expiry sudo rules"

# Level 13: Practical User Provisioning Scenario
echo "level13 ALL=(ALL) NOPASSWD: /usr/sbin/groupadd" >> /etc/sudoers
echo "level13 ALL=(ALL) NOPASSWD: /usr/sbin/useradd" >> /etc/sudoers
echo "level13 ALL=(ALL) NOPASSWD: /usr/sbin/usermod" >> /etc/sudoers
echo "level13 ALL=(ALL) NOPASSWD: /usr/bin/chage" >> /etc/sudoers
echo "level13 ALL=(ALL) NOPASSWD: /usr/sbin/visudo" >> /etc/sudoers
log_info "Level 13: Configured provisioning sudo rules for level13"

# Level 14: systemd Basics - Service Control
mkdir -p /etc/systemd/system/apache2.service.d
cat > /etc/systemd/system/apache2.service.d/override.conf << 'EOF'
[Service]
ExecStopPost=/bin/bash -c 'echo "DEPRECATED: Apache2 no longer needed. Next level password: $(cat /opt/validation/level15.key 2>/dev/null || echo placeholder)"'
EOF
systemctl daemon-reload || true
systemctl enable apache2 || true
systemctl start apache2 || true
echo "level14 ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/local/bin/systemctl" >> /etc/sudoers
usermod -a -G systemd-journal level14 || true
log_info "Level 14: Configured apache2 ExecStopPost log reveal override and level14 privileges"

# Level 15: Service Dependencies & Ordering
mkdir -p /opt/techcorp
cat > /opt/techcorp/db.sh << 'EOF'
#!/bin/bash
echo "Database starting..."
sleep 2
echo "Database ready and listening."
while true; do
    sleep 10
done
EOF
chmod +x /opt/techcorp/db.sh

cat > /opt/techcorp/app.sh << 'EOF'
#!/bin/bash
echo "Appserver starting..."
if ! systemctl is-active --quiet database.service; then
    echo "ERROR: Database is not running! Appserver crashing..."
    exit 1
fi
echo "Appserver connected to database."
while true; do
    sleep 10
done
EOF
chmod +x /opt/techcorp/app.sh

cat > /etc/systemd/system/database.service << 'EOF'
[Unit]
Description=TechCorp Database Service

[Service]
ExecStart=/opt/techcorp/db.sh
Restart=always

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/appserver.service << 'EOF'
[Unit]
Description=TechCorp Appserver Service

[Service]
ExecStart=/opt/techcorp/app.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload || true
systemctl enable database.service || true
systemctl enable appserver.service || true
systemctl start database.service || true
echo "level15 ALL=(ALL) NOPASSWD: /usr/bin/nano /etc/systemd/system/appserver.service, /usr/bin/vim /etc/systemd/system/appserver.service, /usr/bin/vi /etc/systemd/system/appserver.service" >> /etc/sudoers
echo "level15 ALL=(ALL) NOPASSWD: /usr/bin/systemctl daemon-reload, /usr/local/bin/systemctl daemon-reload" >> /etc/sudoers
log_info "Level 15: Created custom appserver and database services and configured level15 privileges"

# Level 16: Creating Custom systemd Services
if ! id "monitor_user" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin monitor_user
fi
mkdir -p /opt/techcorp
cat > /opt/techcorp/monitor.sh << 'EOF'
#!/bin/bash
echo "TechCorp Monitor starting..."
PASS=$(cat /opt/validation/level17.key 2>/dev/null || echo "level17_password_placeholder")
echo "level17_password: $PASS" > /var/log/techcorp-monitor.log
while true; do
    echo "[$(date)] System health OK" >> /var/log/techcorp-monitor.log
    sleep 10
done
EOF
chmod +x /opt/techcorp/monitor.sh
echo "level16 ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/local/bin/systemctl, /usr/bin/systemctl.real" >> /etc/sudoers
echo "level16 ALL=(ALL) NOPASSWD: /usr/bin/nano /etc/systemd/system/techcorp-monitor.service, /usr/bin/vim /etc/systemd/system/techcorp-monitor.service, /usr/bin/vi /etc/systemd/system/techcorp-monitor.service" >> /etc/sudoers
log_info "Level 16: Initial state configured (monitor_user and monitor.sh script)"

# Level 17: Logs & journalctl
cat > /etc/systemd/system/buggy-app.service << 'EOF'
[Unit]
Description=Buggy Web Application Service
After=network.target

[Service]
Type=simple
ExecStart=/bin/bash -c "echo 'Starting buggy-app...'; sleep 1; echo 'CRITICAL: Database connection failed. Recovery key: '$(cat /opt/validation/level18.key 2>/dev/null || echo placeholder); exit 1"
Restart=no

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload || true
usermod -a -G systemd-journal level17 || true
log_info "Level 17: Initial state configured (buggy-app.service and user groups)"

# Level 18: Service Security - User Context & Capabilities
if ! id "webapp_user" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin webapp_user
fi
cat > /etc/systemd/system/webapp.service << 'EOF'
[Unit]
Description=Secure Webapp Service
After=network.target

[Service]
Type=simple
User=root
ExecStart=/bin/bash -c "while true; do sleep 30; done"
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload || true
systemctl enable webapp.service || true
systemctl start webapp.service || true
echo "level18 ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/local/bin/systemctl, /usr/bin/systemctl.real" >> /etc/sudoers
echo "level18 ALL=(ALL) NOPASSWD: /usr/bin/nano /etc/systemd/system/webapp.service, /usr/bin/vim /etc/systemd/system/webapp.service, /usr/bin/vi /etc/systemd/system/webapp.service" >> /etc/sudoers
log_info "Level 18: Initial state configured (webapp.service running as root)"

# Level 19: Troubleshooting Failing Services (Missing User)
cat > /etc/systemd/system/broken-svc.service << 'EOF'
[Unit]
Description=TechCorp Broken Internal Service
After=network.target

[Service]
Type=simple
User=svc_admin
ExecStart=/bin/bash -c "while true; do sleep 30; done"
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload || true
systemctl enable broken-svc.service || true
echo "level19 ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/local/bin/systemctl, /usr/bin/systemctl.real" >> /etc/sudoers
echo "level19 ALL=(ALL) NOPASSWD: /usr/sbin/useradd, /usr/sbin/adduser, /usr/sbin/usermod, /usr/sbin/userdel" >> /etc/sudoers
echo "level19 ALL=(ALL) NOPASSWD: /usr/bin/nano /etc/systemd/system/broken-svc.service, /usr/bin/vim /etc/systemd/system/broken-svc.service, /usr/bin/vi /etc/systemd/system/broken-svc.service" >> /etc/sudoers
log_info "Level 19: Initial state configured (broken-svc.service with missing User)"

# Level 20: Real Scenario - Deploying & Managing an App Service
if ! id "api_user" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin api_user
fi
cat > /opt/techcorp/api_server.py << 'EOF'
import time
import os
import sys

print("Flask API Server starting up on port 5000...")
sys.stdout.flush()

import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(('0.0.0.0', 5000))
    s.listen(5)
except Exception as e:
    print(f"Error binding to port 5000: {e}")
    sys.exit(1)

while True:
    try:
        conn, addr = s.accept()
        request = conn.recv(1024)
        try:
            with open("/opt/validation/level21.key", "r") as f:
                pw = f.read().strip()
        except:
            pw = "placeholder_key"
        response = f"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nlevel21_password: {pw}\n"
        conn.sendall(response.encode())
        conn.close()
    except Exception as e:
        time.sleep(1)
EOF
chmod +x /opt/techcorp/api_server.py
# Level 21: Netplan eth1 Static IP Setup
mkdir -p /etc/netplan
cat > /etc/netplan/01-netcfg.yaml << 'EOF'
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: true
EOF
chmod 600 /etc/netplan/01-netcfg.yaml
chown root:root /etc/netplan/01-netcfg.yaml
echo "level21 ALL=(ALL) NOPASSWD: /usr/sbin/netplan, /usr/sbin/netplan apply, /usr/bin/nano /etc/netplan/01-netcfg.yaml, /usr/bin/vim /etc/netplan/01-netcfg.yaml, /usr/bin/vi /etc/netplan/01-netcfg.yaml" >> /etc/sudoers
log_info "Level 21: Initial state configured (default 01-netcfg.yaml)"

# Level 22: Hostname & DNS Configuration
echo "level22 ALL=(ALL) NOPASSWD: /usr/bin/hostnamectl, /usr/sbin/netplan, /usr/sbin/netplan apply, /usr/bin/nano /etc/netplan/01-netcfg.yaml, /usr/bin/vim /etc/netplan/01-netcfg.yaml, /usr/bin/vi /etc/netplan/01-netcfg.yaml" >> /etc/sudoers
log_info "Level 22: Initial state configured"

# Level 23: iptables Basics
mkdir -p /etc/iptables
touch /etc/iptables/rules.v4
echo "level23 ALL=(ALL) NOPASSWD: /usr/sbin/iptables, /usr/sbin/iptables-save, /usr/sbin/iptables-restore" >> /etc/sudoers
log_info "Level 23: Initial state configured"

# Level 24: Port Filtering
echo "level24 ALL=(ALL) NOPASSWD: /usr/sbin/iptables, /usr/sbin/iptables-save, /usr/sbin/iptables-restore" >> /etc/sudoers
log_info "Level 24: Initial state configured"

# Level 25: Troubleshooting Output Filtering
echo "level25 ALL=(ALL) NOPASSWD: /usr/sbin/iptables, /usr/sbin/iptables-save, /usr/sbin/iptables-restore" >> /etc/sudoers
log_info "Level 25: Initial state configured"

# Level 26: Stateful Rules & Rate Limiting
echo "level26 ALL=(ALL) NOPASSWD: /usr/sbin/iptables, /usr/sbin/iptables-save, /usr/sbin/iptables-restore" >> /etc/sudoers
log_info "Level 26: Initial state configured"

# Level 27: Security Hardening
echo "level27 ALL=(ALL) NOPASSWD: /usr/sbin/iptables, /usr/sbin/iptables-save, /usr/sbin/iptables-restore" >> /etc/sudoers
log_info "Level 27: Initial state configured"

# Level 28: Partitions & fdisk
mkdir -p /var/lib/sysadmin
touch /var/lib/sysadmin/mock_partitions.conf
echo "level28 ALL=(ALL) NOPASSWD: /usr/sbin/fdisk, /usr/sbin/sfdisk, /usr/sbin/parted" >> /etc/sudoers
log_info "Level 28: Initial state configured"

# Level 29: Filesystem Creation & Mounting
mkdir -p /mnt/data
echo "level29 ALL=(ALL) NOPASSWD: /usr/sbin/mkfs, /usr/sbin/mkfs.ext4, /usr/bin/mount, /usr/bin/umount, /usr/bin/nano /etc/fstab, /usr/bin/vim /etc/fstab, /usr/bin/vi /etc/fstab, /usr/bin/mkdir" >> /etc/sudoers
log_info "Level 29: Initial state configured"

# Level 30: Logical Volume Manager
mkdir -p /mnt/app
echo "level30 ALL=(ALL) NOPASSWD: /usr/sbin/pvcreate, /usr/sbin/vgcreate, /usr/sbin/lvcreate, /usr/sbin/pvdisplay, /usr/sbin/vgdisplay, /usr/sbin/lvdisplay, /usr/sbin/mkfs.xfs, /usr/bin/mount, /usr/bin/umount, /usr/bin/nano /etc/fstab, /usr/bin/vim /etc/fstab, /usr/bin/vi /etc/fstab, /usr/bin/mkdir" >> /etc/sudoers
log_info "Level 30: Initial state configured"
# Level 31: Disk Usage Clutter
mkdir -p /opt/labs/level31/old_backups
mkdir -p /opt/labs/level31/logs
mkdir -p /opt/labs/level31/tmp
dd if=/dev/zero of=/opt/labs/level31/old_backups/backup_2025.tar.gz bs=1M count=25 2>/dev/null
dd if=/dev/zero of=/opt/labs/level31/logs/app.log.2025-01-01 bs=1M count=10 2>/dev/null
dd if=/dev/zero of=/opt/labs/level31/logs/app.log.2025-02-01 bs=1M count=10 2>/dev/null
dd if=/dev/zero of=/opt/labs/level31/tmp/temp_cache.bin bs=1M count=15 2>/dev/null
chown -R level31:level31 /opt/labs/level31
log_info "Level 31: Disk usage clutter configured"

# Level 32: Backup & Restore
mkdir -p /opt/labs/level32/important_data
echo "sqlite_format_db_data_xyz_123" > /opt/labs/level32/important_data/credentials.db
echo "admin,password_hash,etc" > /opt/labs/level32/important_data/users.csv
echo '{"service":"api","debug":false}' > /opt/labs/level32/important_data/config.json
mkdir -p /opt/validation/.original_important_data
cp -r /opt/labs/level32/important_data/* /opt/validation/.original_important_data/
chown -R level32:level32 /opt/labs/level32
log_info "Level 32: Backup and restore initial files configured"

# Level 33: Capstone Initial Setup
mkdir -p /opt/labs/level33
cat > /opt/labs/level33/AUDIT_CHECKLIST.txt << 'EOF'
=== CAPSTONE INFRASTRUCTURE REMEDIATION AUDIT ===

As the senior system administrator, you must perform a comprehensive audit
of this server across the following domains and document your findings:

1. PERMISSIONS AUDIT: Analyze file permission issues.
2. USER & GROUP AUDIT: Identify users, groups, sudoers, and orphaned accounts.
3. SERVICE AUDIT: Review systemd services and security policies.
4. NETWORK AUDIT: List listening ports, active firewall rules, and configurations.
5. STORAGE AUDIT: Review filesystem sizes, partitions, mount points, and backup plans.

Write your report to: /opt/labs/level33/audit_report.txt

Make sure to include section headers for:
- "Permissions"
- "User"
- "Service"
- "Network"
- "Storage"

The report must be at least 15 lines long.
EOF
chown -R level33:level33 /opt/labs/level33
echo "level33 ALL=(ALL) NOPASSWD: /usr/sbin/iptables, /usr/sbin/iptables-save, /usr/bin/systemctl, /usr/local/bin/systemctl, /usr/bin/systemctl.real" >> /etc/sudoers
log_info "Level 33: Capstone audit checklist configured"

echo "level20 ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/local/bin/systemctl, /usr/bin/systemctl.real" >> /etc/sudoers
echo "level20 ALL=(ALL) NOPASSWD: /usr/bin/nano /etc/systemd/system/api-server.service, /usr/bin/vim /etc/systemd/system/api-server.service, /usr/bin/vi /etc/systemd/system/api-server.service" >> /etc/sudoers
log_info "Level 20: Initial state configured (api_user and api_server.py script)"

log_info "Initial broken states created for all levels"

# ============================================================================
# PART 4: CREATE VALIDATION SCRIPTS (Non-readable)
# ============================================================================
log_info "Creating validation scripts in ${VALIDATION_DIR}..."

# Validation script for Level 0
cat > "${VALIDATION_DIR}/validate_level_0.sh" << 'EOF'
#!/bin/bash
FILE="/opt/labs/level0/deploy.log"
EXPECTED_PERMS="644"

if [ ! -f "$FILE" ]; then
    echo "File not found"
    exit 1
fi

ACTUAL_PERMS=$(stat -c %a "$FILE" 2>/dev/null)
if [ "$ACTUAL_PERMS" == "$EXPECTED_PERMS" ]; then
    # Return the password
    grep "level1_password:" "$FILE" 2>/dev/null | awk '{print $NF}'
    exit 0
else
    echo "Level not solved. Expected perms $EXPECTED_PERMS, got $ACTUAL_PERMS"
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_0.sh"
chown root:root "${VALIDATION_DIR}/validate_level_0.sh"

# Validation script for Level 1
cat > "${VALIDATION_DIR}/validate_level_1.sh" << 'EOF'
#!/bin/bash
FILE="/opt/labs/level1/.secret_config"

if [ -f "$FILE" ]; then
    # File exists, student found the hidden file - return password
    grep "level2_password:" "$FILE" 2>/dev/null | awk '{print $NF}'
    exit 0
else
    echo "Level not solved. Find the hidden file in /opt/labs/level1/"
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_1.sh"
chown root:root "${VALIDATION_DIR}/validate_level_1.sh"

# Validation script for Level 2
cat > "${VALIDATION_DIR}/validate_level_2.sh" << 'EOF'
#!/bin/bash
FILE="/opt/labs/level2/config.conf"
EXPECTED_OWNER="root"
EXPECTED_GROUP="techcorp"

if [ ! -f "$FILE" ]; then
    echo "File not found"
    exit 1
fi

ACTUAL_OWNER=$(stat -c %U "$FILE" 2>/dev/null)
ACTUAL_GROUP=$(stat -c %G "$FILE" 2>/dev/null)

if [ "$ACTUAL_OWNER" == "$EXPECTED_OWNER" ] && [ "$ACTUAL_GROUP" == "$EXPECTED_GROUP" ]; then
    grep "level3_password:" "$FILE" 2>/dev/null | awk '{print $NF}'
    exit 0
else
    echo "Level not solved. Expected owner:group $EXPECTED_OWNER:$EXPECTED_GROUP, got $ACTUAL_OWNER:$ACTUAL_GROUP"
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_2.sh"
chown root:root "${VALIDATION_DIR}/validate_level_2.sh"

# Validation script for Level 3 (Group Access)
cat > "${VALIDATION_DIR}/validate_level_3.sh" << 'EOF'
#!/bin/bash
if id -nG level3 2>/dev/null | grep -q "\bprotected_data\b"; then
    grep "level4_password:" "/opt/labs/level3/protected_data.txt" 2>/dev/null | awk '{print $NF}'
    exit 0
else
    echo "Level not solved. Add the level3 user to the protected_data group."
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_3.sh"
chown root:root "${VALIDATION_DIR}/validate_level_3.sh"

# Validation script for Level 4 (ACLs)
cat > "${VALIDATION_DIR}/validate_level_4.sh" << 'EOF'
#!/bin/bash
FILE="/opt/labs/level4/report.txt"

# Check if bob and charlie have read ACL
ACL_OUTPUT=$(getfacl "$FILE" 2>/dev/null)
if echo "$ACL_OUTPUT" | grep -q "user:bob:r--" && echo "$ACL_OUTPUT" | grep -q "user:charlie:r--"; then
    grep "level5_password:" "$FILE" 2>/dev/null | awk '{print $NF}'
    exit 0
fi
echo "Level not solved. Set read ACLs for bob and charlie on report.txt"
exit 1
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_4.sh"
chown root:root "${VALIDATION_DIR}/validate_level_4.sh"

# Validation script for Level 5 (umask)
cat > "${VALIDATION_DIR}/validate_level_5.sh" << 'EOF'
#!/bin/bash
UMASK_LOGIN=$(su - level5 -c 'umask' 2>/dev/null)
UMASK_INTERACTIVE=$(su - level5 -c 'bash -i -c umask' 2>/dev/null)

if [ "$UMASK_LOGIN" = "0022" ] || [ "$UMASK_LOGIN" = "022" ] || [ "$UMASK_INTERACTIVE" = "0022" ] || [ "$UMASK_INTERACTIVE" = "022" ]; then
    cat /opt/validation/level6.key 2>/dev/null || echo "level6_password_placeholder"
    exit 0
else
    echo "Level not solved. Please set your umask to 0022 persistently in ~/.profile or ~/.bashrc."
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_5.sh"
chown root:root "${VALIDATION_DIR}/validate_level_5.sh"

# Validation script for Level 6 (Audit)
cat > "${VALIDATION_DIR}/validate_level_6.sh" << 'EOF'
#!/bin/bash
ADMIN_KEY="/opt/labs/level6/admin_key"
SHARED_LOG="/opt/labs/level6/shared_log"
PUBLIC_README="/opt/labs/level6/public_readme"

if [ "$(stat -c %a "$ADMIN_KEY" 2>/dev/null)" != "600" ] || [ "$(stat -c %U:%G "$ADMIN_KEY" 2>/dev/null)" != "root:root" ]; then
    echo "Level not solved. admin_key is incorrect."
    exit 1
fi

if [ "$(stat -c %a "$SHARED_LOG" 2>/dev/null)" != "640" ] || [ "$(stat -c %U:%G "$SHARED_LOG" 2>/dev/null)" != "root:techcorp" ]; then
    echo "Level not solved. shared_log is incorrect."
    exit 1
fi

if [ "$(stat -c %a "$PUBLIC_README" 2>/dev/null)" != "644" ] || [ "$(stat -c %U:%G "$PUBLIC_README" 2>/dev/null)" != "root:root" ]; then
    echo "Level not solved. public_readme is incorrect."
    exit 1
fi

cat /opt/validation/level7.key 2>/dev/null || echo "level7_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_6.sh"
chown root:root "${VALIDATION_DIR}/validate_level_6.sh"

# Validation script for Level 7 (User creation)
cat > "${VALIDATION_DIR}/validate_level_7.sh" << 'EOF'
#!/bin/bash
if ! getent group junior_admins >/dev/null 2>&1; then
    echo "Level not solved. The junior_admins group does not exist."
    exit 1
fi

for u in david elena diana; do
    if ! id "$u" >/dev/null 2>&1; then
        echo "Level not solved. User $u does not exist."
        exit 1
    fi
    if [ "$(getent passwd "$u" | cut -d: -f7)" != "/bin/bash" ]; then
        echo "Level not solved. User $u does not have /bin/bash shell."
        exit 1
    fi
    if ! id -nG "$u" 2>/dev/null | grep -q "\bjunior_admins\b"; then
        echo "Level not solved. User $u is not in the junior_admins group."
        exit 1
    fi
done

cat /opt/validation/level8.key 2>/dev/null || echo "level8_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_7.sh"
chown root:root "${VALIDATION_DIR}/validate_level_7.sh"

# Validation script for Level 8 (chage aging)
cat > "${VALIDATION_DIR}/validate_level_8.sh" << 'EOF'
#!/bin/bash
if ! id david >/dev/null 2>&1; then
    echo "Error: User david does not exist."
    exit 1
fi

MAX_DAYS=$(chage -l david | grep "Maximum number of days between password change" | cut -d: -f2 | tr -d ' ')
WARN_DAYS=$(chage -l david | grep "Number of days of warning before password expires" | cut -d: -f2 | tr -d ' ')

if [ "$MAX_DAYS" = "90" ] && [ "$WARN_DAYS" = "14" ]; then
    cat /opt/validation/level9.key 2>/dev/null || echo "level9_password_placeholder"
    exit 0
else
    echo "Level not solved. Password policy for david is incorrect. Current Max: $MAX_DAYS, Warn: $WARN_DAYS"
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_8.sh"
chown root:root "${VALIDATION_DIR}/validate_level_8.sh"

# Validation script for Level 9 (setgid shared_repo)
cat > "${VALIDATION_DIR}/validate_level_9.sh" << 'EOF'
#!/bin/bash
DIR="/opt/labs/level9/shared_repo"

if [ ! -d "$DIR" ]; then
    echo "Level not solved. Directory shared_repo does not exist."
    exit 1
fi

GRP=$(stat -c %G "$DIR" 2>/dev/null)
if [ "$GRP" != "developers" ]; then
    echo "Level not solved. Group ownership is $GRP, expected developers."
    exit 1
fi

PERMS=$(stat -c %A "$DIR" 2>/dev/null)

if [[ "${PERMS:6:1}" != "s" ]] && [[ "${PERMS:6:1}" != "S" ]]; then
    echo "Level not solved. setgid bit is not set on shared_repo."
    exit 1
fi

if [[ "${PERMS:5:1}" != "w" ]]; then
    echo "Level not solved. Group write permission is missing on shared_repo."
    exit 1
fi

cat /opt/validation/level10.key 2>/dev/null || echo "level10_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_9.sh"
chown root:root "${VALIDATION_DIR}/validate_level_9.sh"

# Validation script for Level 10 (sudoers junior_admins)
cat > "${VALIDATION_DIR}/validate_level_10.sh" << 'EOF'
#!/bin/bash
SUDO_CONFIGS=$(cat /etc/sudoers /etc/sudoers.d/* 2>/dev/null)
CLEAN_CONFIGS=$(echo "$SUDO_CONFIGS" | grep -v "^#")

if echo "$CLEAN_CONFIGS" | grep -E "%junior_admins.*NOPASSWD" | grep -q "systemctl" && \
   echo "$CLEAN_CONFIGS" | grep -E "%junior_admins.*NOPASSWD" | grep -q "journalctl" && \
   echo "$CLEAN_CONFIGS" | grep -E "%junior_admins.*NOPASSWD" | grep -q "cat"; then
    cat /opt/validation/level11.key 2>/dev/null || echo "level11_password_placeholder"
    exit 0
else
    echo "Level not solved. Grant NOPASSWD access to %junior_admins for systemctl, journalctl, and cat in sudoers."
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_10.sh"
chown root:root "${VALIDATION_DIR}/validate_level_10.sh"

# Validation script for Level 11 (Least Privilege Nginx)
cat > "${VALIDATION_DIR}/validate_level_11.sh" << 'EOF'
#!/bin/bash
OUT=$(sudo -n -u david sudo -n /usr/bin/systemctl restart nginx 2>&1)
if [[ "$OUT" == *"System has not been booted"* ]] || [[ "$OUT" == *"Failed to connect to bus"* ]] || [ $? -eq 0 ]; then
    OUT_STOP=$(sudo -n -u david sudo -n /usr/bin/systemctl stop nginx 2>&1)
    if [[ "$OUT_STOP" == *"a password is required"* ]] || [[ "$OUT_STOP" == *"not allowed to execute"* ]]; then
        cat /opt/validation/level12.key 2>/dev/null || echo "level12_password_placeholder"
        exit 0
    else
        echo "Level not solved. David has too many permissions (can stop nginx without password)."
        exit 1
    fi
else
    echo "Level not solved. David cannot restart nginx without a password."
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_11.sh"
chown root:root "${VALIDATION_DIR}/validate_level_11.sh"

# Validation script for Level 12 (Account locking & expiry)
cat > "${VALIDATION_DIR}/validate_level_12.sh" << 'EOF'
#!/bin/bash
if ! id oldadmin >/dev/null 2>&1; then
    echo "Error: User oldadmin does not exist."
    exit 1
fi

PWD_STATUS=$(passwd -S oldadmin | awk '{print $2}')
SHADOW_VAL=$(getent shadow oldadmin)
SHADOW_PWD=$(echo "$SHADOW_VAL" | cut -d: -f2)
SHADOW_EXP=$(echo "$SHADOW_VAL" | cut -d: -f8)

if [[ "$SHADOW_PWD" == !* ]] || [[ "$SHADOW_PWD" == \** ]] || [ "$PWD_STATUS" = "L" ]; then
    if [ "$SHADOW_EXP" = "0" ]; then
        cat /opt/validation/level13.key 2>/dev/null || echo "level13_password_placeholder"
        exit 0
    else
        echo "Level not solved. Account expiration is incorrect. Current: $SHADOW_EXP"
        exit 1
    fi
else
    echo "Level not solved. Password for oldadmin is not locked."
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_12.sh"
chown root:root "${VALIDATION_DIR}/validate_level_12.sh"

# Validation script for Level 13 (User Onboarding Eve)
cat > "${VALIDATION_DIR}/validate_level_13.sh" << 'EOF'
#!/bin/bash
if ! id eve >/dev/null 2>&1; then
    echo "Level not solved. User eve does not exist."
    exit 1
fi

if [ "$(getent passwd eve | cut -d: -f7)" != "/bin/bash" ]; then
    echo "Level not solved. User eve does not have /bin/bash shell."
    exit 1
fi

if ! id -nG eve 2>/dev/null | grep -q "\bpayments\b"; then
    echo "Level not solved. User eve is not in the payments group."
    exit 1
fi

MAX_DAYS=$(chage -l eve | grep "Maximum number of days between password change" | cut -d: -f2 | tr -d ' ')
WARN_DAYS=$(chage -l eve | grep "Number of days of warning before password expires" | cut -d: -f2 | tr -d ' ')

if [ "$MAX_DAYS" != "90" ] || [ "$WARN_DAYS" != "14" ]; then
    echo "Level not solved. Password policy for eve is incorrect (Max: $MAX_DAYS, Warn: $WARN_DAYS)."
    exit 1
fi

SUDO_CONFIGS=$(cat /etc/sudoers /etc/sudoers.d/* 2>/dev/null)
CLEAN_CONFIGS=$(echo "$SUDO_CONFIGS" | grep -v "^#")

if echo "$CLEAN_CONFIGS" | grep -E "eve.*NOPASSWD" | grep -q "systemctl" && \
   echo "$CLEAN_CONFIGS" | grep -E "eve.*NOPASSWD" | grep -q "payments"; then
    cat /opt/validation/level14.key 2>/dev/null || echo "level14_password_placeholder"
    exit 0
else
    echo "Level not solved. Sudo rule for eve to restart payments service is missing or incorrect."
    exit 1
fi
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_13.sh"
chown root:root "${VALIDATION_DIR}/validate_level_13.sh"

# Validation script for Level 14 (Service Control Apache2)
cat > "${VALIDATION_DIR}/validate_level_14.sh" << 'EOF'
#!/bin/bash
if systemctl is-active --quiet apache2 2>/dev/null; then
    echo "Level not solved. Apache2 service is still active."
    exit 1
fi

if systemctl is-enabled --quiet apache2 2>/dev/null; then
    echo "Level not solved. Apache2 service is still enabled."
    exit 1
fi

cat /opt/validation/level15.key 2>/dev/null || echo "level15_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_14.sh"
chown root:root "${VALIDATION_DIR}/validate_level_14.sh"

# Validation script for Level 15 (Service Dependencies)
cat > "${VALIDATION_DIR}/validate_level_15.sh" << 'EOF'
#!/bin/bash
FILE="/etc/systemd/system/appserver.service"

if [ ! -f "$FILE" ]; then
    echo "Level not solved. appserver.service unit file not found."
    exit 1
fi

UNIT_SECTION=$(sed -n '/^\[Unit\]/,/^\[/p' "$FILE" | grep -v "^\[")

if ! echo "$UNIT_SECTION" | grep -qE "After\s*=\s*database(\.service)?"; then
    echo "Level not solved. appserver does not start after database.service."
    exit 1
fi

if ! echo "$UNIT_SECTION" | grep -qE "Requires\s*=\s*database(\.service)?"; then
    echo "Level not solved. appserver does not require database.service."
    exit 1
fi

DEPS=$(/usr/local/bin/systemctl show -p After -p Requires appserver.service 2>/dev/null)
if ! echo "$DEPS" | grep -q "database.service"; then
    echo "Level not solved. Did you run 'systemctl daemon-reload'?"
    exit 1
fi

cat /opt/validation/level16.key 2>/dev/null || echo "level16_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_15.sh"
chown root:root "${VALIDATION_DIR}/validate_level_15.sh"

# Validation script for Level 16 (Custom Service techcorp-monitor)
cat > "${VALIDATION_DIR}/validate_level_16.sh" << 'EOF'
#!/bin/bash
FILE="/etc/systemd/system/techcorp-monitor.service"

if [ ! -f "$FILE" ]; then
    echo "Level not solved. techcorp-monitor.service file not found."
    exit 1
fi

UNIT_SECTION=$(cat "$FILE")

if ! echo "$UNIT_SECTION" | grep -q "User\s*=\s*monitor_user"; then
    echo "Level not solved. Service does not run as monitor_user."
    exit 1
fi

if ! echo "$UNIT_SECTION" | grep -q "ExecStart\s*=\s*.*monitor.sh"; then
    echo "Level not solved. ExecStart path is incorrect."
    exit 1
fi

if ! systemctl.real is-enabled techcorp-monitor.service &>/dev/null; then
    echo "Level not solved. techcorp-monitor.service is not enabled."
    exit 1
fi

if ! /usr/bin/systemctl is-active --quiet techcorp-monitor 2>/dev/null; then
    echo "Level not solved. techcorp-monitor.service is not active."
    exit 1
fi

cat /opt/validation/level17.key 2>/dev/null || echo "level17_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_16.sh"
chown root:root "${VALIDATION_DIR}/validate_level_16.sh"

# Validation script for Level 17 (Logs & journalctl buggy-app)
cat > "${VALIDATION_DIR}/validate_level_17.sh" << 'EOF'
#!/bin/bash
if ! systemctl.real is-enabled buggy-app.service &>/dev/null && [ ! -f /etc/systemd/system/buggy-app.service ]; then
    echo "Level not solved. buggy-app service is missing."
    exit 1
fi
cat /opt/validation/level18.key 2>/dev/null || echo "level18_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_17.sh"
chown root:root "${VALIDATION_DIR}/validate_level_17.sh"

# Validation script for Level 18 (Capabilities & Webapp unprivileged port 80)
cat > "${VALIDATION_DIR}/validate_level_18.sh" << 'EOF'
#!/bin/bash
FILE="/etc/systemd/system/webapp.service"

if [ ! -f "$FILE" ]; then
    echo "Level not solved. webapp.service file not found."
    exit 1
fi

UNIT_SECTION=$(cat "$FILE")

if ! echo "$UNIT_SECTION" | grep -q "User\s*=\s*webapp_user"; then
    echo "Level not solved. Service must run as webapp_user."
    exit 1
fi

if ! echo "$UNIT_SECTION" | grep -E -q "AmbientCapabilities\s*=\s*.*CAP_NET_BIND_SERVICE"; then
    echo "Level not solved. AmbientCapabilities=CAP_NET_BIND_SERVICE is missing."
    exit 1
fi

if ! /usr/bin/systemctl is-active --quiet webapp 2>/dev/null; then
    echo "Level not solved. webapp service is not active."
    exit 1
fi

cat /opt/validation/level19.key 2>/dev/null || echo "level19_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_18.sh"
chown root:root "${VALIDATION_DIR}/validate_level_18.sh"

# Validation script for Level 19 (Troubleshooting: Missing User)
cat > "${VALIDATION_DIR}/validate_level_19.sh" << 'EOF'
#!/bin/bash
FILE="/etc/systemd/system/broken-svc.service"

if [ ! -f "$FILE" ]; then
    echo "Level not solved. broken-svc.service file not found."
    exit 1
fi

if ! id "svc_admin" &>/dev/null; then
    echo "Level not solved. The system user 'svc_admin' has not been created."
    exit 1
fi

SHELL_VAL=$(getent passwd svc_admin | cut -d: -f7)
if [ "$SHELL_VAL" != "/usr/sbin/nologin" ] && [ "$SHELL_VAL" != "/sbin/nologin" ] && [ "$SHELL_VAL" != "/bin/false" ]; then
    echo "Level not solved. The 'svc_admin' user must have no login shell (e.g. /usr/sbin/nologin)."
    exit 1
fi

if ! /usr/bin/systemctl is-active --quiet broken-svc 2>/dev/null; then
    echo "Level not solved. broken-svc service is not active (running)."
    exit 1
fi

cat /opt/validation/level20.key 2>/dev/null || echo "level20_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_19.sh"
chown root:root "${VALIDATION_DIR}/validate_level_19.sh"

# Validation script for Level 20 (Real Python Flask app deployment)
cat > "${VALIDATION_DIR}/validate_level_20.sh" << 'EOF'
#!/bin/bash
FILE="/etc/systemd/system/api-server.service"

if [ ! -f "$FILE" ]; then
    echo "Level not solved. api-server.service file not found."
    exit 1
fi

UNIT_SECTION=$(cat "$FILE")

if ! echo "$UNIT_SECTION" | grep -q "User\s*=\s*api_user"; then
    echo "Level not solved. Service must run as api_user."
    exit 1
fi

if ! echo "$UNIT_SECTION" | grep -q "ExecStart\s*=\s*.*api_server.py"; then
    echo "Level not solved. ExecStart path is incorrect."
    exit 1
fi

if ! systemctl.real is-enabled api-server.service &>/dev/null; then
    echo "Level not solved. api-server.service is not enabled."
    exit 1
fi

if ! /usr/bin/systemctl is-active --quiet api-server 2>/dev/null; then
    echo "Level not solved. api-server service is not active."
    exit 1
fi

RESP=$(curl -s --connect-timeout 2 http://localhost:5000)
if ! echo "$RESP" | grep -q "level21_password"; then
    echo "Level not solved. Could not query Flask server on port 5000."
    exit 1
fi

cat /opt/validation/level21.key 2>/dev/null || echo "level21_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_20.sh"
chown root:root "${VALIDATION_DIR}/validate_level_20.sh"

# Validation script for Level 21
cat > "${VALIDATION_DIR}/validate_level_21.sh" << 'EOF'
#!/bin/bash
FILE="/etc/netplan/01-netcfg.yaml"
if [ ! -f "$FILE" ]; then
    echo "Level not solved. Netplan configuration file not found."
    exit 1
fi
NET_CONF=$(cat "$FILE" | grep -v "#" | sed 's/[[:space:]]//g')
if ! echo "$NET_CONF" | grep -q "eth1:"; then
    echo "Level not solved. eth1 interface not found in netplan configuration."
    exit 1
fi
if ! echo "$NET_CONF" | grep -q "192.168.1.100/24"; then
    echo "Level not solved. Static IP 192.168.1.100/24 not configured on eth1."
    exit 1
fi
if ! echo "$NET_CONF" | grep -E -q "gateway4:192.168.1.1|via:192.168.1.1"; then
    echo "Level not solved. Default gateway 192.168.1.1 not configured on eth1."
    exit 1
fi
if [ ! -f "/var/run/netplan_applied" ]; then
    echo "Level not solved. Netplan configuration has not been successfully applied."
    exit 1
fi
cat /opt/validation/level22.key 2>/dev/null || echo "level22_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_21.sh"
chown root:root "${VALIDATION_DIR}/validate_level_21.sh"

# Validation script for Level 22
cat > "${VALIDATION_DIR}/validate_level_22.sh" << 'EOF'
#!/bin/bash
CURRENT_HOSTNAME=$(cat /etc/hostname 2>/dev/null)
if [ "$CURRENT_HOSTNAME" != "techcorp-server01" ]; then
    echo "Level not solved. Hostname is not set to 'techcorp-server01'."
    exit 1
fi
FILE="/etc/netplan/01-netcfg.yaml"
if [ ! -f "$FILE" ]; then
    echo "Level not solved. Netplan configuration file not found."
    exit 1
fi
NET_CONF=$(cat "$FILE" | grep -v "#" | sed 's/[[:space:]]//g')
if ! (echo "$NET_CONF" | grep -q "8.8.8.8" && echo "$NET_CONF" | grep -q "8.8.4.4"); then
    echo "Level not solved. DNS nameservers 8.8.8.8 and 8.8.4.4 not found on eth1."
    exit 1
fi
cat /opt/validation/level23.key 2>/dev/null || echo "level23_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_22.sh"
chown root:root "${VALIDATION_DIR}/validate_level_22.sh"

# Validation script for Level 23
cat > "${VALIDATION_DIR}/validate_level_23.sh" << 'EOF'
#!/bin/bash
RULES_FILE="/etc/iptables/rules.v4"
if [ ! -f "$RULES_FILE" ]; then
    echo "Level not solved. iptables rules file '$RULES_FILE' not found."
    exit 1
fi
if ! grep -q -E "^:INPUT DROP" "$RULES_FILE"; then
    echo "Level not solved. Default policy for INPUT chain must be DROP."
    exit 1
fi
if ! grep -q -E "INPUT.*-i lo.*-j ACCEPT" "$RULES_FILE" && ! grep -q -E "INPUT.*-j ACCEPT.*-i lo" "$RULES_FILE"; then
    echo "Level not solved. Loopback interface traffic must be allowed."
    exit 1
fi
if ! grep -q -E "ESTABLISHED,RELATED" "$RULES_FILE"; then
    echo "Level not solved. Stateful ESTABLISHED,RELATED connections must be allowed."
    exit 1
fi
if ! grep -q -E "INPUT.*--dport 22.*-j ACCEPT" "$RULES_FILE" && ! grep -q -E "INPUT.*-p tcp.*-m tcp.*--dport 22.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. Incoming SSH traffic on port 22 must be allowed."
    exit 1
fi
if ! grep -q -E "INPUT.*--dport 80.*-j ACCEPT" "$RULES_FILE" && ! grep -q -E "INPUT.*-p tcp.*-m tcp.*--dport 80.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. Incoming HTTP traffic on port 80 must be allowed."
    exit 1
fi
cat /opt/validation/level24.key 2>/dev/null || echo "level24_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_23.sh"
chown root:root "${VALIDATION_DIR}/validate_level_23.sh"

# Validation script for Level 24
cat > "${VALIDATION_DIR}/validate_level_24.sh" << 'EOF'
#!/bin/bash
RULES_FILE="/etc/iptables/rules.v4"
if [ ! -f "$RULES_FILE" ]; then
    echo "Level not solved. iptables rules file '$RULES_FILE' not found."
    exit 1
fi
ACCEPT_LINE=$(grep -n -E "INPUT.*-s 10\.0\.1\.50(/32)?.*--dport 3306.*-j ACCEPT" "$RULES_FILE" | cut -d: -f1 | head -n 1)
DROP_LINE=$(grep -n -E "INPUT.*--dport 3306.*-j (DROP|REJECT)" "$RULES_FILE" | cut -d: -f1 | head -n 1)

if [ -z "$ACCEPT_LINE" ]; then
    echo "Level not solved. Must allow incoming port 3306 from source IP 10.0.1.50."
    exit 1
fi
if [ -z "$DROP_LINE" ]; then
    echo "Level not solved. Must drop/reject incoming traffic on port 3306 from other sources."
    exit 1
fi
if [ "$ACCEPT_LINE" -ge "$DROP_LINE" ]; then
    echo "Level not solved. Rule order is incorrect. The whitelist ACCEPT rule must precede the DROP rule."
    exit 1
fi
cat /opt/validation/level25.key 2>/dev/null || echo "level25_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_24.sh"
chown root:root "${VALIDATION_DIR}/validate_level_24.sh"

# Validation script for Level 25
cat > "${VALIDATION_DIR}/validate_level_25.sh" << 'EOF'
#!/bin/bash
RULES_FILE="/etc/iptables/rules.v4"
if [ ! -f "$RULES_FILE" ]; then
    echo "Level not solved. iptables rules file '$RULES_FILE' not found."
    exit 1
fi
if ! grep -q -E "OUTPUT.*--dport 443.*-j ACCEPT" "$RULES_FILE" && ! grep -q -E "OUTPUT.*-p tcp.*-m tcp.*--dport 443.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. Outgoing TCP traffic on port 443 (HTTPS) must be allowed."
    exit 1
fi
cat /opt/validation/level26.key 2>/dev/null || echo "level26_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_25.sh"
chown root:root "${VALIDATION_DIR}/validate_level_25.sh"

# Validation script for Level 26
cat > "${VALIDATION_DIR}/validate_level_26.sh" << 'EOF'
#!/bin/bash
RULES_FILE="/etc/iptables/rules.v4"
if [ ! -f "$RULES_FILE" ]; then
    echo "Level not solved. iptables rules file '$RULES_FILE' not found."
    exit 1
fi
if ! grep -q -E "dport 22.*-m limit --limit 5/m" "$RULES_FILE" && ! grep -q -E "dport 22.*--limit 5/min" "$RULES_FILE"; then
    echo "Level not solved. Must configure rate limiting of 5 connections/minute for SSH."
    exit 1
fi
cat /opt/validation/level27.key 2>/dev/null || echo "level27_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_26.sh"
chown root:root "${VALIDATION_DIR}/validate_level_26.sh"

# Validation script for Level 27
cat > "${VALIDATION_DIR}/validate_level_27.sh" << 'EOF'
#!/bin/bash
RULES_FILE="/etc/iptables/rules.v4"
if [ ! -f "$RULES_FILE" ]; then
    echo "Level not solved. iptables rules file '$RULES_FILE' not found."
    exit 1
fi
if ! grep -q -E "^:INPUT DROP" "$RULES_FILE" || ! grep -q -E "^:OUTPUT DROP" "$RULES_FILE" || ! grep -q -E "^:FORWARD DROP" "$RULES_FILE"; then
    echo "Level not solved. Default policies for INPUT, OUTPUT, and FORWARD must be DROP."
    exit 1
fi
if ! grep -q -E "INPUT.*-i lo.*-j ACCEPT" "$RULES_FILE" || ! grep -q -E "OUTPUT.*-o lo.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. Loopback traffic must be allowed on INPUT and OUTPUT."
    exit 1
fi
if ! grep -q -E "INPUT.*-s 10\.0\.0\.0/24.*--dport 22.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. SSH (port 22) must be restricted to administrative subnet 10.0.0.0/24."
    exit 1
fi
if ! grep -q -E "INPUT.*--dport 80.*-j ACCEPT" "$RULES_FILE" || ! grep -q -E "INPUT.*--dport 443.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. Public HTTP (80) and HTTPS (443) incoming traffic must be allowed."
    exit 1
fi
if ! grep -q -E "OUTPUT.*--dport 53.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. Outgoing DNS traffic (port 53) must be allowed."
    exit 1
fi
if ! grep -q -E "OUTPUT.*--dport 80.*-j ACCEPT" "$RULES_FILE" || ! grep -q -E "OUTPUT.*--dport 443.*-j ACCEPT" "$RULES_FILE"; then
    echo "Level not solved. Outgoing HTTP (80) and HTTPS (443) traffic must be allowed."
    exit 1
fi
cat /opt/validation/level28.key 2>/dev/null || echo "level28_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_27.sh"
chown root:root "${VALIDATION_DIR}/validate_level_27.sh"

# Validation script for Level 28
cat > "${VALIDATION_DIR}/validate_level_28.sh" << 'EOF'
#!/bin/bash
CONF="/var/lib/sysadmin/mock_partitions.conf"
if [ ! -f "$CONF" ]; then
    echo "Level not solved. No partitioning operations recorded on /dev/sdb."
    exit 1
fi
if ! grep -q "sdb1:40G" "$CONF" || ! grep -q "sdb2:10G" "$CONF"; then
    echo "Level not solved. /dev/sdb partitions do not match size specifications (sdb1: 40GB, sdb2: 10GB)."
    exit 1
fi
cat /opt/validation/level29.key 2>/dev/null || echo "level29_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_28.sh"
chown root:root "${VALIDATION_DIR}/validate_level_28.sh"

# Validation script for Level 29
cat > "${VALIDATION_DIR}/validate_level_29.sh" << 'EOF'
#!/bin/bash
FSTAB="/etc/fstab"
FS_CONF="/var/lib/sysadmin/mock_filesystems.conf"
MOUNT_CONF="/var/lib/sysadmin/mock_mounts.conf"

if [ ! -f "$FS_CONF" ] || ! grep -q "sdb1:ext4" "$FS_CONF"; then
    echo "Level not solved. /dev/sdb1 has not been formatted as ext4."
    exit 1
fi
if [ ! -d "/mnt/data" ]; then
    echo "Level not solved. Mount point /mnt/data does not exist."
    exit 1
fi
if ! grep -q -E "/dev/sdb1\s+/mnt/data\s+ext4" "$FSTAB" && ! grep -q -E "UUID=.*\s+/mnt/data\s+ext4" "$FSTAB"; then
    echo "Level not solved. Persistent mount entry for /dev/sdb1 on /mnt/data not configured in /etc/fstab."
    exit 1
fi
if [ ! -f "$MOUNT_CONF" ] || ! grep -q "/mnt/data" "$MOUNT_CONF"; then
    echo "Level not solved. /dev/sdb1 is not currently mounted on /mnt/data."
    exit 1
fi
cat /opt/validation/level30.key 2>/dev/null || echo "level30_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_29.sh"
chown root:root "${VALIDATION_DIR}/validate_level_29.sh"

# Validation script for Level 30
cat > "${VALIDATION_DIR}/validate_level_30.sh" << 'EOF'
#!/bin/bash
FSTAB="/etc/fstab"
FS_CONF="/var/lib/sysadmin/mock_filesystems.conf"
MOUNT_CONF="/var/lib/sysadmin/mock_mounts.conf"
LVM_CONF="/var/lib/sysadmin/mock_lvm.conf"

if [ ! -f "$LVM_CONF" ]; then
    echo "Level not solved. LVM configuration not found."
    exit 1
fi
if ! grep -q "pv:/dev/sdb2" "$LVM_CONF"; then
    echo "Level not solved. /dev/sdb2 has not been initialized as a Physical Volume (PV)."
    exit 1
fi
if ! grep -q "vg:vg_data" "$LVM_CONF"; then
    echo "Level not solved. Volume Group vg_data not found."
    exit 1
fi
if ! grep -q "lv:lv_data:10G" "$LVM_CONF"; then
    echo "Level not solved. Logical Volume lv_data (size 10GB) not found."
    exit 1
fi
if [ ! -f "$FS_CONF" ] || ! grep -q "lv_data:xfs" "$FS_CONF"; then
    echo "Level not solved. Logical Volume lv_data has not been formatted as xfs."
    exit 1
fi
if ! grep -q -E "lv_data\s+/mnt/app\s+xfs" "$FSTAB" && ! grep -q -E "vg_data-lv_data\s+/mnt/app\s+xfs" "$FSTAB" && ! grep -q -E "vg_data/lv_data\s+/mnt/app\s+xfs" "$FSTAB"; then
    echo "Level not solved. Persistent mount entry for lv_data on /mnt/app not configured in /etc/fstab."
    exit 1
fi
if [ ! -f "$MOUNT_CONF" ] || ! grep -q "/mnt/app" "$MOUNT_CONF"; then
    echo "Level not solved. Logical Volume is not currently mounted on /mnt/app."
    exit 1
fi
cat /opt/validation/level31.key 2>/dev/null || echo "level31_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_30.sh"
chown root:root "${VALIDATION_DIR}/validate_level_30.sh"

# Validation script for Level 31
cat > "${VALIDATION_DIR}/validate_level_31.sh" << 'EOF'
#!/bin/bash
REPORT="/opt/labs/level31/cleanup_report.txt"
if [ ! -f "$REPORT" ]; then
    echo "Level not solved. Cleanup report /opt/labs/level31/cleanup_report.txt not found."
    exit 1
fi

# Check size in KB
SIZE_KB=$(du -sk /opt/labs/level31 | awk '{print $1}')
if [ "$SIZE_KB" -gt 10000 ]; then
    echo "Level not solved. Remaining file size ($((SIZE_KB/1024))MB) is still above the 10MB threshold."
    exit 1
fi

cat /opt/validation/level32.key 2>/dev/null || echo "level32_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_31.sh"
chown root:root "${VALIDATION_DIR}/validate_level_31.sh"

# Validation script for Level 32
cat > "${VALIDATION_DIR}/validate_level_32.sh" << 'EOF'
#!/bin/bash
BACKUP="/opt/labs/level32/backup.tar.gz"
PLAN="/opt/labs/level32/backup_plan.txt"
DATA_DIR="/opt/labs/level32/important_data"
ORIG_DIR="/opt/validation/.original_important_data"

if [ ! -f "$BACKUP" ]; then
    echo "Level not solved. Backup archive $BACKUP not found."
    exit 1
fi

if [ ! -f "$PLAN" ]; then
    echo "Level not solved. Backup plan $PLAN not found."
    exit 1
fi

if [ ! -d "$DATA_DIR" ]; then
    echo "Level not solved. Directory $DATA_DIR does not exist (did you restore it?)."
    exit 1
fi

for file in credentials.db users.csv config.json; do
    if [ ! -f "$DATA_DIR/$file" ]; then
        echo "Level not solved. Restored file $file is missing from $DATA_DIR."
        exit 1
    fi
    diff -q "$DATA_DIR/$file" "$ORIG_DIR/$file" >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "Level not solved. Restored file $file does not match the original content."
        exit 1
    fi
done

cat /opt/validation/level33.key 2>/dev/null || echo "level33_password_placeholder"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_32.sh"
chown root:root "${VALIDATION_DIR}/validate_level_32.sh"

# Validation script for Level 33
cat > "${VALIDATION_DIR}/validate_level_33.sh" << 'EOF'
#!/bin/bash
REPORT="/opt/labs/level33/audit_report.txt"

if [ ! -f "$REPORT" ]; then
    echo "Level not solved. Audit report $REPORT not found."
    exit 1
fi

# Check sections
errors=0
for section in "Permissions" "User" "Service" "Network" "Storage"; do
    if ! grep -qi "$section" "$REPORT"; then
        echo "Level not solved. Section '$section' is missing or not mentioned in the audit report."
        errors=1
    fi
done

if [ $errors -ne 0 ]; then
    exit 1
fi

lines=$(wc -l < "$REPORT")
if [ "$lines" -lt 15 ]; then
    echo "Level not solved. The audit report is too brief. Please provide a detailed report with at least 15 lines of analysis."
    exit 1
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  🎉 CONGRATULATIONS! 🎉"
echo "═══════════════════════════════════════════════════════════════"
echo "You've successfully completed all 34 TechCorp infrastructure"
echo "remediation labs. You've mastered:"
echo ""
echo "✓ File Permissions & Security"
echo "✓ User & Group Management"
echo "✓ Service Management with systemd"
echo "✓ Network Configuration & Firewalling"
echo "✓ Storage Management & Backups"
echo ""
echo "You're now ready to handle real-world sysadmin challenges."
echo "═══════════════════════════════════════════════════════════════"
exit 0
EOF
chmod 511 "${VALIDATION_DIR}/validate_level_33.sh"
chown root:root "${VALIDATION_DIR}/validate_level_33.sh"

log_info "Created validation scripts for all ${TOTAL_LEVELS} levels"

# Change ownership of level directories to allow flag writing and set sudo validation privileges
for i in $(seq 0 $((TOTAL_LEVELS - 1))); do
    chown level${i}:level${i} "${LAB_DIR}/level${i}"
    echo "level${i} ALL=(ALL) NOPASSWD: ${VALIDATION_DIR}/validate_level_${i}.sh" >> /etc/sudoers
done

# ============================================================================
# PART 5: CREATE CHECK_LEVEL WRAPPER (Readable by students)
# ============================================================================
log_info "Creating check_level wrapper script..."

cat > /usr/local/bin/check_level << 'EOF'
#!/bin/bash
# Wrapper script for level validation
# Students can run this to check if they've solved a level

LEVEL=$1
VALIDATION_SCRIPT="/opt/validation/validate_level_${LEVEL}.sh"

if [ -z "$LEVEL" ]; then
    echo "Usage: check_level <level_number>"
    echo "Example: check_level 0"
    exit 1
fi

if [ ! -x "$VALIDATION_SCRIPT" ]; then
    echo "Error: Invalid level number or validation script not found"
    exit 1
fi

# Run validation
OUTPUT=$(sudo "$VALIDATION_SCRIPT" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ Level $LEVEL solved!"
    echo "Password for level$((LEVEL + 1)): $OUTPUT"
    
    # Also write to flag file for convenience
    echo "$OUTPUT" > "/opt/labs/level${LEVEL}/flag.txt"
    chmod 644 "/opt/labs/level${LEVEL}/flag.txt"
else
    echo "✗ Level $LEVEL not yet solved"
    echo "$OUTPUT"
    exit 1
fi
EOF
chmod 755 /usr/local/bin/check_level
log_info "Created check_level wrapper at /usr/local/bin/check_level"

# ============================================================================
# PART 6: CREATE SYSTEMD TIMER FOR AUTOMATIC VALIDATION
# ============================================================================
log_info "Setting up systemd timer for automatic validation..."

# Script that runs all validations
cat > "${SCRIPTS_DIR}/run_all_validations.sh" << 'EOF'
#!/bin/bash
# Run all validation scripts and write passwords to flag files
VALIDATION_DIR="/opt/validation"
LAB_DIR="/opt/labs"

for level_script in ${VALIDATION_DIR}/validate_level_*.sh; do
    if [ -x "$level_script" ]; then
        LEVEL=$(basename "$level_script" | sed 's/validate_level_//;s/.sh//')
        
        OUTPUT=$("$level_script" 2>&1)
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ]; then
            # Write password to flag file
            echo "$OUTPUT" > "${LAB_DIR}/level${LEVEL}/flag.txt"
            chmod 644 "${LAB_DIR}/level${LEVEL}/flag.txt"
        fi
    fi
done
EOF
chmod 755 "${SCRIPTS_DIR}/run_all_validations.sh"

# Systemd service
cat > /etc/systemd/system/validation-check.service << 'EOF'
[Unit]
Description=Validate TechCorp Lab Levels
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/opt/scripts/run_all_validations.sh
StandardOutput=journal
StandardError=journal
EOF

# Systemd timer (runs every 5 minutes)
cat > /etc/systemd/system/validation-check.timer << 'EOF'
[Unit]
Description=Run Level Validation Every 5 Minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable timer file manually via symlink for build compatibility
mkdir -p /etc/systemd/system/timers.target.wants
ln -sf /etc/systemd/system/validation-check.timer /etc/systemd/system/timers.target.wants/validation-check.timer

log_info "Systemd timer configured (will run every 5 minutes on container boot)"

# Backup and override system-wide systemctl and journalctl with the mock wrappers
if [ ! -f /usr/bin/systemctl.real ]; then
    mv /usr/bin/systemctl /usr/bin/systemctl.real
fi
if [ ! -f /usr/bin/journalctl.real ]; then
    mv /usr/bin/journalctl /usr/bin/journalctl.real
fi

cat > /usr/bin/systemctl << 'EOF'
#!/bin/bash
# Wrapper to mock systemd service management in non-systemd container

ACTION=""
SERVICE_NAME=""
QUIET=false
HAS_NOW=false

is_pid_alive() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file" 2>/dev/null)
        if [ -n "$pid" ] && [ -d "/proc/$pid" ]; then
            return 0
        fi
    fi
    return 1
}

for arg in "$@"; do
    case "$arg" in
        start|stop|restart|status|is-active|enable|disable|is-enabled|show|daemon-reload)
            ACTION="$arg"
            ;;
        --quiet|-q)
            QUIET=true
            ;;
        --now)
            HAS_NOW=true
            ;;
        *)
            clean_arg=$(echo "$arg" | sed 's/\.service$//')
            case "$clean_arg" in
                nginx|apache2|database|appserver|payments|techcorp-monitor|buggy-app|webapp|broken-svc|api-server)
                    SERVICE_NAME="$clean_arg"
                    ;;
            esac
            ;;
    esac
done

if [ "$ACTION" = "daemon-reload" ]; then
    exit 0
fi

if [ -z "$ACTION" ] || [ -z "$SERVICE_NAME" ]; then
    /usr/bin/systemctl.real "$@"
    exit $?
fi

case "$SERVICE_NAME" in
    nginx|apache2|database|appserver|payments|techcorp-monitor|buggy-app|webapp|broken-svc|api-server)
        case "$ACTION" in
            start)
                if [ "$SERVICE_NAME" = "apache2" ]; then
                    /usr/sbin/apache2ctl start >/dev/null 2>&1 || true
                    rm -f /var/run/apache2_stopped
                elif [ "$SERVICE_NAME" = "nginx" ]; then
                    /usr/sbin/nginx >/dev/null 2>&1 || true
                elif [ "$SERVICE_NAME" = "techcorp-monitor" ]; then
                    /opt/techcorp/monitor.sh >/dev/null 2>&1 &
                    echo $! > /var/run/techcorp-monitor.pid
                elif [ "$SERVICE_NAME" = "webapp" ]; then
                    /bin/bash -c "while true; do sleep 30; done" >/dev/null 2>&1 &
                    echo $! > /var/run/webapp.pid
                elif [ "$SERVICE_NAME" = "broken-svc" ]; then
                    if ! id "svc_admin" &>/dev/null; then
                        echo "Job for broken-svc.service failed because the control process exited with error code."
                        exit 1
                    fi
                    su -s /bin/bash svc_admin -c "while true; do sleep 30; done" >/dev/null 2>&1 &
                    echo $! > /var/run/broken-svc.pid
                elif [ "$SERVICE_NAME" = "api-server" ]; then
                    /usr/bin/python3 /opt/techcorp/api_server.py >/dev/null 2>&1 &
                    echo $! > /var/run/api-server.pid
                else
                    if [ "$SERVICE_NAME" = "database" ]; then
                        /opt/techcorp/db.sh >/dev/null 2>&1 &
                        echo $! > /var/run/database.pid
                    elif [ "$SERVICE_NAME" = "appserver" ]; then
                        /opt/techcorp/app.sh >/dev/null 2>&1 &
                        echo $! > /var/run/appserver.pid
                    fi
                fi
                echo "Synchronizing state of $SERVICE_NAME.service with SysV service script..."
                exit 0
                ;;
            stop)
                if [ "$SERVICE_NAME" = "apache2" ]; then
                    /usr/sbin/apache2ctl stop >/dev/null 2>&1 || true
                    touch /var/run/apache2_stopped
                elif [ "$SERVICE_NAME" = "nginx" ]; then
                    /usr/sbin/nginx -s stop >/dev/null 2>&1 || true
                else
                    if [ -f "/var/run/${SERVICE_NAME}.pid" ]; then
                        kill $(cat "/var/run/${SERVICE_NAME}.pid") >/dev/null 2>&1 || true
                        rm -f "/var/run/${SERVICE_NAME}.pid"
                    fi
                fi
                exit 0
                ;;
            restart)
                $0 stop "$SERVICE_NAME"
                $0 start "$SERVICE_NAME"
                exit 0
                ;;
            status)
                if [ "$SERVICE_NAME" = "apache2" ]; then
                    if [ -f "/var/run/apache2_stopped" ]; then
                        echo "● apache2.service - The Apache HTTP Server"
                        echo "   Loaded: loaded (/lib/systemd/system/apache2.service; disabled; vendor preset: enabled)"
                        echo "   Active: inactive (dead)"
                    else
                        echo "● apache2.service - The Apache HTTP Server"
                        echo "   Loaded: loaded (/lib/systemd/system/apache2.service; enabled; vendor preset: enabled)"
                        echo "   Active: active (running)"
                    fi
                elif [ "$SERVICE_NAME" = "nginx" ]; then
                    echo "● nginx.service - A high performance web server"
                    echo "   Active: active (running)"
                elif [ "$SERVICE_NAME" = "database" ]; then
                    if is_pid_alive "/var/run/database.pid"; then
                        echo "● database.service - TechCorp Database Service"
                        echo "   Active: active (running)"
                    else
                        echo "● database.service - TechCorp Database Service"
                        echo "   Active: inactive (dead)"
                    fi
                elif [ "$SERVICE_NAME" = "appserver" ]; then
                    if is_pid_alive "/var/run/appserver.pid"; then
                        echo "● appserver.service - TechCorp Appserver Service"
                        echo "   Active: active (running)"
                    else
                        echo "● appserver.service - TechCorp Appserver Service"
                        echo "   Active: inactive (dead)"
                    fi
                elif [ "$SERVICE_NAME" = "techcorp-monitor" ]; then
                    if is_pid_alive "/var/run/techcorp-monitor.pid"; then
                        echo "● techcorp-monitor.service - TechCorp Monitor Service"
                        echo "   Active: active (running)"
                    else
                        echo "● techcorp-monitor.service - TechCorp Monitor Service"
                        echo "   Active: inactive (dead)"
                    fi
                elif [ "$SERVICE_NAME" = "buggy-app" ]; then
                    echo "● buggy-app.service - Buggy Web Application Service"
                    echo "   Loaded: loaded (/etc/systemd/system/buggy-app.service; enabled; vendor preset: enabled)"
                    echo "   Active: failed (Result: exit-code) since Mon 2026-07-27 18:30:03 UTC"
                    echo "   Process: 123 ExecStart=/bin/bash /opt/techcorp/buggy-app.sh (code=exited, status=1/FAILURE)"
                elif [ "$SERVICE_NAME" = "webapp" ]; then
                    if is_pid_alive "/var/run/webapp.pid"; then
                        echo "● webapp.service - Secure Webapp Service"
                        echo "   Active: active (running)"
                    else
                        echo "● webapp.service - Secure Webapp Service"
                        echo "   Active: inactive (dead)"
                    fi
                elif [ "$SERVICE_NAME" = "broken-svc" ]; then
                    if ! id "svc_admin" &>/dev/null; then
                        echo "● broken-svc.service - TechCorp Broken Internal Service"
                        echo "   Active: failed (Result: exit-code)"
                    elif is_pid_alive "/var/run/broken-svc.pid"; then
                        echo "● broken-svc.service - TechCorp Broken Internal Service"
                        echo "   Active: active (running)"
                    else
                        echo "● broken-svc.service - TechCorp Broken Internal Service"
                        echo "   Active: inactive (dead)"
                    fi
                elif [ "$SERVICE_NAME" = "api-server" ]; then
                    if is_pid_alive "/var/run/api-server.pid"; then
                        echo "● api-server.service - TechCorp API Server"
                        echo "   Active: active (running)"
                    else
                        echo "● api-server.service - TechCorp API Server"
                        echo "   Active: inactive (dead)"
                    fi
                fi
                exit 0
                ;;
            is-active)
                if [ "$SERVICE_NAME" = "apache2" ]; then
                    if [ -f "/var/run/apache2_stopped" ]; then
                        [ "$QUIET" = "false" ] && echo "inactive"
                        exit 3
                    else
                        [ "$QUIET" = "false" ] && echo "active"
                        exit 0
                    fi
                elif [ "$SERVICE_NAME" = "nginx" ]; then
                    [ "$QUIET" = "false" ] && echo "active"
                    exit 0
                elif [ "$SERVICE_NAME" = "database" ]; then
                    if is_pid_alive "/var/run/database.pid"; then
                        [ "$QUIET" = "false" ] && echo "active"
                        exit 0
                    else
                        [ "$QUIET" = "false" ] && echo "inactive"
                        exit 3
                    fi
                elif [ "$SERVICE_NAME" = "appserver" ]; then
                    if is_pid_alive "/var/run/appserver.pid"; then
                        [ "$QUIET" = "false" ] && echo "active"
                        exit 0
                    else
                        [ "$QUIET" = "false" ] && echo "inactive"
                        exit 3
                    fi
                elif [ "$SERVICE_NAME" = "techcorp-monitor" ]; then
                    if is_pid_alive "/var/run/techcorp-monitor.pid"; then
                        [ "$QUIET" = "false" ] && echo "active"
                        exit 0
                    else
                        [ "$QUIET" = "false" ] && echo "inactive"
                        exit 3
                    fi
                elif [ "$SERVICE_NAME" = "buggy-app" ]; then
                    [ "$QUIET" = "false" ] && echo "inactive"
                    exit 3
                elif [ "$SERVICE_NAME" = "webapp" ]; then
                    if is_pid_alive "/var/run/webapp.pid"; then
                        [ "$QUIET" = "false" ] && echo "active"
                        exit 0
                    else
                        [ "$QUIET" = "false" ] && echo "inactive"
                        exit 3
                    fi
                elif [ "$SERVICE_NAME" = "broken-svc" ]; then
                    if is_pid_alive "/var/run/broken-svc.pid"; then
                        [ "$QUIET" = "false" ] && echo "active"
                        exit 0
                    else
                        [ "$QUIET" = "false" ] && echo "inactive"
                        exit 3
                    fi
                elif [ "$SERVICE_NAME" = "api-server" ]; then
                    if is_pid_alive "/var/run/api-server.pid"; then
                        [ "$QUIET" = "false" ] && echo "active"
                        exit 0
                    else
                        [ "$QUIET" = "false" ] && echo "inactive"
                        exit 3
                    fi
                fi
                ;;
            enable|disable)
                ARGS_WITHOUT_NOW=()
                for arg in "$@"; do
                    if [ "$arg" != "--now" ]; then
                        ARGS_WITHOUT_NOW+=("$arg")
                    fi
                done
                /usr/bin/systemctl.real "${ARGS_WITHOUT_NOW[@]}"
                REAL_EXIT=$?
                
                if [ $REAL_EXIT -eq 0 ] && [ "$HAS_NOW" = "true" ] && [ -n "$SERVICE_NAME" ]; then
                    if [ "$ACTION" = "enable" ]; then
                        $0 start "$SERVICE_NAME" >/dev/null 2>&1
                    else
                        $0 stop "$SERVICE_NAME" >/dev/null 2>&1
                    fi
                fi
                exit $REAL_EXIT
                ;;
            is-enabled)
                /usr/bin/systemctl.real "$@"
                exit $?
                ;;
            show)
                if [ "$SERVICE_NAME" = "appserver" ]; then
                    AFTER_VAL=$(grep -E "^After=" /etc/systemd/system/appserver.service | cut -d= -f2)
                    REQUIRES_VAL=$(grep -E "^Requires=" /etc/systemd/system/appserver.service | cut -d= -f2)
                    echo "After=$AFTER_VAL"
                    echo "Requires=$REQUIRES_VAL"
                    exit 0
                elif [ "$SERVICE_NAME" = "api-server" ]; then
                    # Standard show properties
                    exit 0
                fi
                /usr/bin/systemctl.real "$@"
                exit $?
                ;;
            *)
                /usr/bin/systemctl.real "$@"
                exit $?
                ;;
        esac
        ;;
    *)
        /usr/bin/systemctl.real "$@"
        exit $?
        ;;
esac
EOF
chmod 755 /usr/bin/systemctl

cat > /usr/bin/journalctl << 'EOF'
#!/bin/bash
# Wrapper to mock journald logging in non-systemd container

SERVICE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -u|--unit)
            SERVICE="$2"
            shift 2
            ;;
        *)
            if [[ "$1" == -u* ]]; then
                SERVICE="${1#-u}"
                shift
            else
                shift
            fi
            ;;
    esac
done

SERVICE_NAME=$(echo "$SERVICE" | sed 's/\.service$//')

if [ "$SERVICE_NAME" = "apache2" ]; then
    echo "-- Journal begins at Mon 2026-07-27 10:00:00 UTC, ends at Mon 2026-07-27 15:40:00 UTC. --"
    echo "Jul 27 10:00:01 techcorp-server systemd[1]: Starting The Apache HTTP Server..."
    echo "Jul 27 10:00:02 techcorp-server apache2[123]: AH00558: apache2: Could not reliably determine the server's fully qualified domain name"
    echo "Jul 27 10:00:03 techcorp-server systemd[1]: Started The Apache HTTP Server."
    if [ -f "/var/run/apache2_stopped" ]; then
        echo "Jul 27 15:30:00 techcorp-server systemd[1]: Stopping The Apache HTTP Server..."
        echo "Jul 27 15:30:01 techcorp-server apache2[456]: AH00544: apache2: Graceful restart requested, doing restart"
        echo "Jul 27 15:30:02 techcorp-server systemd[1]: apache2.service: Deactivated successfully."
        echo "Jul 27 15:30:02 techcorp-server systemd[1]: Stopped The Apache HTTP Server."
        PASS=$(cat /opt/validation/level15.key 2>/dev/null || echo "level15_password_placeholder")
        echo "Jul 27 15:30:03 techcorp-server bash[789]: DEPRECATED: Apache2 no longer needed. Next level password: $PASS"
    fi
elif [ "$SERVICE_NAME" = "buggy-app" ]; then
    echo "-- Journal begins at Mon 2026-07-27 10:00:00 UTC, ends at Mon 2026-07-27 18:40:00 UTC. --"
    echo "Jul 27 18:30:00 techcorp-server systemd[1]: Starting Buggy Web Application Service..."
    echo "Jul 27 18:30:01 techcorp-server buggy-app[123]: Starting buggy-app..."
    echo "Jul 27 18:30:02 techcorp-server buggy-app[123]: Connecting to database on 10.0.5.12..."
    PASS=$(cat /opt/validation/level18.key 2>/dev/null || echo "level18_password_placeholder")
    echo "Jul 27 18:30:03 techcorp-server buggy-app[123]: CRITICAL: Database connection failed. Recovery key: $PASS"
    echo "Jul 27 18:30:03 techcorp-server systemd[1]: buggy-app.service: Main process exited, code=exited, status=1/FAILURE"
    echo "Jul 27 18:30:03 techcorp-server systemd[1]: buggy-app.service: Failed with result 'exit-code'."
    echo "Jul 27 18:30:03 techcorp-server systemd[1]: Failed to start Buggy Web Application Service."
elif [ "$SERVICE_NAME" = "broken-svc" ]; then
    echo "-- Journal begins at Mon 2026-07-27 10:00:00 UTC, ends at Mon 2026-07-27 18:40:00 UTC. --"
    if ! id "svc_admin" &>/dev/null; then
        echo "Jul 27 18:35:00 techcorp-server systemd[1]: broken-svc.service: Failed to determine user credentials: No such process"
        echo "Jul 27 18:35:00 techcorp-server systemd[1]: broken-svc.service: Failed at step USER spawning /bin/bash: No such process"
        echo "Jul 27 18:35:00 techcorp-server systemd[1]: Failed to start TechCorp Broken Internal Service."
    else
        echo "Jul 27 18:38:00 techcorp-server systemd[1]: Starting TechCorp Broken Internal Service..."
        echo "Jul 27 18:38:01 techcorp-server systemd[1]: Started TechCorp Broken Internal Service."
    fi
elif [ "$SERVICE_NAME" = "api-server" ]; then
    echo "-- Journal begins at Mon 2026-07-27 10:00:00 UTC, ends at Mon 2026-07-27 18:40:00 UTC. --"
    if [ -f "/var/run/api-server.pid" ] && [ -d "/proc/$(cat /var/run/api-server.pid 2>/dev/null)" ]; then
        echo "Jul 27 18:39:00 techcorp-server systemd[1]: Starting TechCorp API Server..."
        echo "Jul 27 18:39:01 techcorp-server python3[200]: Flask API Server starting up on port 5000..."
        echo "Jul 27 18:39:01 techcorp-server systemd[1]: Started TechCorp API Server."
    fi
else
    /usr/bin/journalctl.real "$@"
fi
EOF
chmod 755 /usr/bin/journalctl

# ============================================================================
# PART 6: CREATE ADDITIONAL NETWORKING, FIREWALL & STORAGE WRAPPERS
# ============================================================================
log_info "Creating networking, firewall, and storage mock wrappers..."

# Backup real mount if we haven't already
if [ ! -f "/bin/mount.real" ]; then
    cp /bin/mount /bin/mount.real
fi

# Netplan wrapper
cat > /usr/sbin/netplan << 'EOF'
#!/bin/bash
if [ "$1" = "apply" ]; then
    if [ -f "/etc/netplan/01-netcfg.yaml" ]; then
        python3 -c "
import sys
try:
    lines = open('/etc/netplan/01-netcfg.yaml').readlines()
    for line in lines:
        if ':' in line and not line.strip().startswith('#'):
            pass
    print('Configuration valid')
except Exception as e:
    print('YAML syntax error:', e)
    sys.exit(1)
" >/dev/null
        if [ $? -ne 0 ]; then
            echo "Netplan YAML configuration is invalid."
            exit 1
        fi
        touch /var/run/netplan_applied
        echo "Configuration applied successfully."
        exit 0
    else
        echo "Configuration file /etc/netplan/01-netcfg.yaml not found."
        exit 1
    fi
else
    exit 0
fi
EOF
chmod 755 /usr/sbin/netplan

# Hostnamectl wrapper
cat > /usr/bin/hostnamectl << 'EOF'
#!/bin/bash
if [ "$1" = "set-hostname" ] && [ -n "$2" ]; then
    echo "$2" > /etc/hostname
    sed -i "s/127.0.1.1.*/127.0.1.1 $2/g" /etc/hosts 2>/dev/null || true
    echo "Hostname updated to $2"
    exit 0
elif [ -z "$1" ] || [ "$1" = "status" ]; then
    HN=$(cat /etc/hostname 2>/dev/null || echo "localhost")
    echo "   Static hostname: $HN"
    echo "         Icon name: computer-vm"
    echo "           Chassis: vm"
    echo "        Machine ID: 1234567890abcdef1234567890abcdef"
    echo "           Boot ID: 1234567890abcdef1234567890abcdef"
    echo "    Virtualization: docker"
    echo "  Operating System: Ubuntu 22.04 LTS"
    echo "            Kernel: Linux 5.15.0"
    echo "      Architecture: x86-64"
    exit 0
fi
EOF
chmod 755 /usr/bin/hostnamectl

# Remove existing symlinks for iptables commands before creating wrappers
rm -f /usr/sbin/iptables /usr/sbin/iptables-save /usr/sbin/iptables-restore /sbin/iptables /sbin/iptables-save /sbin/iptables-restore /usr/bin/iptables /usr/bin/iptables-save /usr/bin/iptables-restore /bin/iptables /bin/iptables-save /bin/iptables-restore

# iptables wrapper
cat > /usr/sbin/iptables << 'EOF'
#!/bin/bash
RULES_FILE="/var/run/iptables_current"
if [ ! -f "$RULES_FILE" ]; then
    if [ -f "/etc/iptables/rules.v4" ]; then
        cp /etc/iptables/rules.v4 "$RULES_FILE"
    else
        touch "$RULES_FILE"
    fi
fi
if ! grep -q "\*filter" "$RULES_FILE" 2>/dev/null; then
    cat > "$RULES_FILE" << 'RULES'
*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
COMMIT
RULES
fi

# Make files writable
chmod 666 "$RULES_FILE" 2>/dev/null || true
chmod 666 /etc/iptables/rules.v4 2>/dev/null || true

if [ "$1" = "-P" ] && [ -n "$2" ] && [ -n "$3" ]; then
    chain="$2"
    policy="$3"
    sed -i "s/^:${chain} [A-Z]*/:${chain} ${policy}/g" "$RULES_FILE"
    exit 0
fi

if [ "$1" = "-F" ]; then
    input_policy=$(grep "^:INPUT" "$RULES_FILE" | awk '{print $1}')
    forward_policy=$(grep "^:FORWARD" "$RULES_FILE" | awk '{print $1}')
    output_policy=$(grep "^:OUTPUT" "$RULES_FILE" | awk '{print $1}')
    cat > "$RULES_FILE" << RULES
*filter
${input_policy} [0:0]
${forward_policy} [0:0]
${output_policy} [0:0]
COMMIT
RULES
    exit 0
fi

if [ "$1" = "-L" ] || [ "$1" = "-S" ]; then
    cat "$RULES_FILE"
    exit 0
fi

if [ "$1" = "-A" ] || [ "$1" = "-I" ]; then
    action="$1"
    chain="$2"
    shift 2
    rule_str="-A ${chain} $*"
    if [ "$action" = "-I" ]; then
        sed -i "/^:${chain}/a ${rule_str}" "$RULES_FILE"
    else
        sed -i "/^COMMIT/i ${rule_str}" "$RULES_FILE"
    fi
    exit 0
fi
exit 0
EOF
chmod 755 /usr/sbin/iptables

cat > /usr/sbin/iptables-save << 'EOF'
#!/bin/bash
RULES_FILE="/var/run/iptables_current"
if [ -f "$RULES_FILE" ]; then
    cat "$RULES_FILE"
elif [ -f "/etc/iptables/rules.v4" ]; then
    cat "/etc/iptables/rules.v4"
else
    echo "# Generated by iptables-save"
    echo "*filter"
    echo ":INPUT ACCEPT [0:0]"
    echo ":FORWARD ACCEPT [0:0]"
    echo ":OUTPUT ACCEPT [0:0]"
    echo "COMMIT"
fi
EOF
chmod 755 /usr/sbin/iptables-save

cat > /usr/sbin/iptables-restore << 'EOF'
#!/bin/bash
RULES_FILE="/var/run/iptables_current"
cat > "$RULES_FILE"
chmod 666 "$RULES_FILE" 2>/dev/null || true
cp "$RULES_FILE" /etc/iptables/rules.v4 2>/dev/null || true
chmod 666 /etc/iptables/rules.v4 2>/dev/null || true
exit 0
EOF
chmod 755 /usr/sbin/iptables-restore

# fdisk & sfdisk wrappers
cat > /usr/sbin/fdisk << 'EOF'
#!/bin/bash
if [ "$1" = "-l" ]; then
    CONF="/var/lib/sysadmin/mock_partitions.conf"
    echo "Disk /dev/sdb: 50 GiB, 53687091200 bytes, 104857600 sectors"
    echo "Units: sectors of 1 * 512 = 512 bytes"
    echo "Sector size (logical/physical): 512 bytes / 512 bytes"
    echo "Disklabel type: gpt"
    echo "Disk identifier: ABCDEF12-3456-7890-ABCD-EF1234567890"
    echo ""
    if [ -f "$CONF" ] && [ -s "$CONF" ]; then
        echo "Device     Start       End   Sectors  Size Type"
        if grep -q "sdb1:40G" "$CONF"; then
            echo "/dev/sdb1   2048  83888127  83886080   40G Linux filesystem"
        fi
        if grep -q "sdb2:10G" "$CONF"; then
            echo "/dev/sdb2  83888128 104857599  20969472   10G Linux filesystem"
        fi
    fi
    exit 0
fi

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage:"
    echo " fdisk [options] <disk>      change partition table"
    echo " fdisk [options] -l [<disk>] list partition table(s)"
    echo ""
    echo "Options:"
    echo " -h, --help          display this help"
    echo " -v, --version       display version"
    exit 0
fi

if [ "$1" = "--version" ] || [ "$1" = "-v" ]; then
    echo "fdisk from util-linux 2.37.2"
    exit 0
fi

if [ "$1" != "/dev/sdb" ]; then
    echo "fdisk: cannot open $1: No such file or directory"
    exit 1
fi

echo "Welcome to fdisk (util-linux 2.37.2)."
echo "Changes will remain in memory only, until you decide to write them."
echo "Be careful before using the write command."
echo ""

CONF="/var/lib/sysadmin/mock_partitions.conf"
mkdir -p /var/lib/sysadmin
temp_partitions="/tmp/fdisk_temp_partitions"
rm -f "$temp_partitions"
[ -f "$CONF" ] && cp "$CONF" "$temp_partitions"

while true; do
    read -p "Command (m for help): " cmd
    case "$cmd" in
        m|M)
            echo "Help:"
            echo "  n   add a new partition"
            echo "  p   print the partition table"
            echo "  w   write table to disk and exit"
            echo "  q   quit without saving changes"
            ;;
        p|P)
            echo "Disk /dev/sdb: 50 GiB, 53687091200 bytes, 104857600 sectors"
            echo "Device     Start       End   Sectors  Size Type"
            if [ -f "$temp_partitions" ]; then
                if grep -q "sdb1:40G" "$temp_partitions"; then
                    echo "/dev/sdb1   2048  83888127  83886080   40G Linux filesystem"
                fi
                if grep -q "sdb2:10G" "$temp_partitions"; then
                    echo "/dev/sdb2  83888128 104857599  20969472   10G Linux filesystem"
                fi
            fi
            ;;
        n|N)
            pnum="1"
            if [ -f "$temp_partitions" ] && grep -q "sdb1:" "$temp_partitions"; then
                pnum="2"
                if grep -q "sdb2:" "$temp_partitions"; then
                    echo "All primary partitions are already defined."
                    continue
                fi
            fi
            read -p "Partition type (p primary, e extended, default p): " ptype
            read -p "Partition number (1-4, default $pnum): " input_pnum
            [ -z "$input_pnum" ] && input_pnum="$pnum"
            read -p "First sector (2048-104857599, default 2048): " fsector
            read -p "Last sector, +/-sectors or +/-size{K,M,G,T,P} (2048-104857599, default 104857599): " lsector
            
            if [ "$input_pnum" = "1" ]; then
                echo "sdb1:40G" >> "$temp_partitions"
                echo "Created a new partition 1 of type 'Linux filesystem' and of size 40 GiB."
            elif [ "$input_pnum" = "2" ]; then
                echo "sdb2:10G" >> "$temp_partitions"
                echo "Created a new partition 2 of type 'Linux filesystem' and of size 10 GiB."
            fi
            ;;
        w|W)
            [ -f "$temp_partitions" ] && cp "$temp_partitions" "$CONF"
            chmod 666 "$CONF" 2>/dev/null || true
            echo "The partition table has been altered."
            echo "Syncing disks."
            exit 0
            ;;
        q|Q)
            echo "Exiting fdisk without saving changes."
            exit 0
            ;;
        *)
            echo "$cmd: unknown command"
            ;;
    esac
done
EOF
chmod 755 /usr/sbin/fdisk

cat > /usr/sbin/sfdisk << 'EOF'
#!/bin/bash
CONF="/var/lib/sysadmin/mock_partitions.conf"
mkdir -p /var/lib/sysadmin
if [[ "$*" == *"/dev/sdb"* ]]; then
    echo "sdb1:40G" > "$CONF"
    echo "sdb2:10G" >> "$CONF"
    chmod 666 "$CONF" 2>/dev/null || true
    echo "Successfully partitioned /dev/sdb"
    exit 0
fi
exit 0
EOF
chmod 755 /usr/sbin/sfdisk

# mkfs wrappers
rm -f /usr/sbin/mkfs.ext4 /sbin/mkfs.ext4
cat > /usr/sbin/mkfs.ext4 << 'EOF'
#!/bin/bash
CONF="/var/lib/sysadmin/mock_filesystems.conf"
mkdir -p /var/lib/sysadmin
target=""
for arg in "$@"; do
    if [[ "$arg" == "/dev/sdb1" ]]; then
        target="/dev/sdb1"
    fi
done
if [ "$target" = "/dev/sdb1" ]; then
    echo "Writing superblocks and filesystem accounting information: done"
    echo "sdb1:ext4" >> "$CONF"
    chmod 666 "$CONF" 2>/dev/null || true
    exit 0
else
    echo "mkfs.ext4: device not specified or invalid"
    exit 1
fi
EOF
chmod 755 /usr/sbin/mkfs.ext4

cat > /usr/sbin/mkfs.xfs << 'EOF'
#!/bin/bash
CONF="/var/lib/sysadmin/mock_filesystems.conf"
mkdir -p /var/lib/sysadmin
target=""
for arg in "$@"; do
    if [[ "$arg" == "/dev/vg_data/lv_data" ]] || [[ "$arg" == "/dev/mapper/vg_data-lv_data" ]] || [[ "$arg" == "lv_data" ]] || [[ "$arg" == *"lv_data"* ]]; then
        target="lv_data"
    fi
done
if [ -n "$target" ]; then
    echo "lv_data:xfs" >> "$CONF"
    chmod 666 "$CONF" 2>/dev/null || true
    exit 0
else
    echo "mkfs.xfs: device not specified or invalid"
    exit 1
fi
EOF
chmod 755 /usr/sbin/mkfs.xfs

# mount / umount wrappers
cat > /bin/mount << 'EOF'
#!/bin/bash
MOUNT_CONF="/var/lib/sysadmin/mock_mounts.conf"
mkdir -p /var/lib/sysadmin
chmod 666 "$MOUNT_CONF" 2>/dev/null || true

if [ "$1" = "-a" ]; then
    if [ -f "/etc/fstab" ]; then
        while read -r line; do
            [[ "$line" =~ ^# ]] && continue
            [[ -z "$line" ]] && continue
            mountpoint=$(echo "$line" | awk '{print $2}')
            if [[ "$mountpoint" == "/mnt/data" ]] || [[ "$mountpoint" == "/mnt/app" ]]; then
                echo "$mountpoint" >> "$MOUNT_CONF"
                mkdir -p "$mountpoint"
            fi
        done < /etc/fstab
    fi
    chmod 666 "$MOUNT_CONF" 2>/dev/null || true
    echo "fstab mounts applied."
    exit 0
fi

dev=""
target=""
for arg in "$@"; do
    if [[ "$arg" == "/dev/"* ]] || [[ "$arg" == "UUID="* ]]; then
        dev="$arg"
    elif [[ "$arg" == "/mnt/"* ]]; then
        target="$arg"
    fi
done

if [ -n "$target" ]; then
    mkdir -p "$target"
    echo "$target" >> "$MOUNT_CONF"
    chmod 666 "$MOUNT_CONF" 2>/dev/null || true
    echo "Mounted $dev on $target"
    exit 0
else
    /bin/mount.real "$@"
    exit $?
fi
EOF
chmod 755 /bin/mount

cat > /usr/bin/umount << 'EOF'
#!/bin/bash
# Mock umount
MOUNT_CONF="/var/lib/sysadmin/mock_mounts.conf"
if [ -f "$MOUNT_CONF" ] && [ -n "$1" ]; then
    sed -i "s|$1||g" "$MOUNT_CONF" 2>/dev/null || true
    sed -i '/^$/d' "$MOUNT_CONF" 2>/dev/null || true
fi
exit 0
EOF
chmod 755 /usr/bin/umount

# LVM wrappers
rm -f /usr/sbin/pvcreate /usr/sbin/vgcreate /usr/sbin/lvcreate /usr/sbin/pvdisplay /usr/sbin/vgdisplay /usr/sbin/lvdisplay /sbin/pvcreate /sbin/vgcreate /sbin/lvcreate /sbin/pvdisplay /sbin/vgdisplay /sbin/lvdisplay
cat > /usr/sbin/pvcreate << 'EOF'
#!/bin/bash
LVM_CONF="/var/lib/sysadmin/mock_lvm.conf"
mkdir -p /var/lib/sysadmin
target=""
for arg in "$@"; do
    if [[ "$arg" == "/dev/sdb2" ]]; then
        target="/dev/sdb2"
    fi
done
if [ "$target" = "/dev/sdb2" ]; then
    echo "pv:/dev/sdb2" >> "$LVM_CONF"
    chmod 666 "$LVM_CONF" 2>/dev/null || true
    echo "  Physical volume \"/dev/sdb2\" successfully created."
    exit 0
else
    echo "Device not found or not specified."
    exit 1
fi
EOF
chmod 755 /usr/sbin/pvcreate

cat > /usr/sbin/vgcreate << 'EOF'
#!/bin/bash
LVM_CONF="/var/lib/sysadmin/mock_lvm.conf"
mkdir -p /var/lib/sysadmin
vgname="$1"
pvname="$2"
if [ "$vgname" = "vg_data" ] && [ "$pvname" = "/dev/sdb2" ]; then
    echo "vg:vg_data" >> "$LVM_CONF"
    chmod 666 "$LVM_CONF" 2>/dev/null || true
    echo "  Volume group \"vg_data\" successfully created"
    exit 0
else
    echo "vgcreate usage error."
    exit 1
fi
EOF
chmod 755 /usr/sbin/vgcreate

cat > /usr/sbin/lvcreate << 'EOF'
#!/bin/bash
# Mock lvcreate
LVM_CONF="/var/lib/sysadmin/mock_lvm.conf"
mkdir -p /var/lib/sysadmin
size=""
name=""
vg=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -L) size="$2"; shift 2 ;;
        -n) name="$2"; shift 2 ;;
        *) vg="$1"; shift ;;
    esac
done
if [ "$name" = "lv_data" ] && [ "$vg" = "vg_data" ]; then
    echo "lv:lv_data:${size}" >> "$LVM_CONF"
    chmod 666 "$LVM_CONF" 2>/dev/null || true
    echo "  Logical volume \"lv_data\" created."
    exit 0
else
    echo "lvcreate usage error."
    exit 1
fi
EOF
chmod 755 /usr/sbin/lvcreate

cat > /usr/sbin/pvdisplay << 'EOF'
#!/bin/bash
LVM_CONF="/var/lib/sysadmin/mock_lvm.conf"
if [ -f "$LVM_CONF" ] && grep -q "pv:/dev/sdb2" "$LVM_CONF"; then
    echo "  --- Physical volume ---"
    echo "  PV Name               /dev/sdb2"
    echo "  VG Name               vg_data"
    echo "  PV Size               10.00 GiB"
    exit 0
fi
echo "No PV found."
exit 1
EOF
chmod 755 /usr/sbin/pvdisplay

cat > /usr/sbin/vgdisplay << 'EOF'
#!/bin/bash
LVM_CONF="/var/lib/sysadmin/mock_lvm.conf"
if [ -f "$LVM_CONF" ] && grep -q "vg:vg_data" "$LVM_CONF"; then
    echo "  --- Volume group ---"
    echo "  VG Name               vg_data"
    echo "  VG Size               10.00 GiB"
    exit 0
fi
echo "No VG found."
exit 1
EOF
chmod 755 /usr/sbin/vgdisplay

cat > /usr/sbin/lvdisplay << 'EOF'
#!/bin/bash
LVM_CONF="/var/lib/sysadmin/mock_lvm.conf"
if [ -f "$LVM_CONF" ] && grep -q "lv:lv_data" "$LVM_CONF"; then
    echo "  --- Logical volume ---"
    echo "  LV Path               /dev/vg_data/lv_data"
    echo "  LV Name               lv_data"
    echo "  VG Name               vg_data"
    echo "  LV Size               10.00 GiB"
    exit 0
fi
echo "No LV found."
exit 1
EOF
chmod 755 /usr/sbin/lvdisplay

# Ensure write permissions for sysadmin mock data folder
mkdir -p /var/lib/sysadmin
chmod 777 /var/lib/sysadmin 2>/dev/null || true
touch /var/lib/sysadmin/mock_partitions.conf 2>/dev/null || true
touch /var/lib/sysadmin/mock_filesystems.conf 2>/dev/null || true
touch /var/lib/sysadmin/mock_mounts.conf 2>/dev/null || true
touch /var/lib/sysadmin/mock_lvm.conf 2>/dev/null || true
chmod 666 /var/lib/sysadmin/mock_* 2>/dev/null || true

# ============================================================================
# PART 7: SETUP COMPLETE
# ============================================================================
log_info "Provisioning complete!"
log_info "Summary:"
echo "  - Created users: level0-level33"
echo "  - Created lab directories: ${LAB_DIR}/level*"
echo "  - Created validation scripts: ${VALIDATION_DIR}/validate_level_*.sh (non-readable)"
echo "  - Created check_level wrapper: /usr/local/bin/check_level"
echo "  - Configured systemd timer for automatic validation every 5 minutes"
echo ""
echo "Students can now:"
echo "  1. SSH into the container as level0"
echo "  2. Solve level challenges"
echo "  3. Run 'check_level 0' to check if solved"
echo "  4. Or check '/opt/labs/level0/flag.txt' for password (auto-populated every 5 min)"
echo ""
echo "IMPORTANT: Delete the password file in production:"
echo "  rm ${PASSWORD_FILE}"
