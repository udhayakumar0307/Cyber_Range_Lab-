# Sysadmin Labs: Complete Level Specifications (v2)
## TechCorp Inc. Infrastructure Remediation
### Docker-Native, Progressive Learning, Embedded Flags

---

## **CORE DESIGN PRINCIPLES**

1. **Embedded Flags:** The password for level N+1 is INSIDE the solution for level N. Students must solve to access it.
2. **Progressive Learning:** Each level teaches skills needed for the next level.
3. **Dockerizable:** Each level is self-contained, no external dependencies, isolated state.
4. **No Cheating:** Flag is locked behind permissions/ownership/state until challenge is solved.

---

## **PHASE 1: FILE PERMISSIONS & OWNERSHIP (Levels 0-6)**
*Learning Focus: Understanding file permissions, ownership, and access control*

### Level 0 → 1: "The Permission Audit Begins"

**Scenario:**  
Your first day at TechCorp. A developer named alice reports she can't read the deployment log `/opt/labs/level0/deploy.log`. The file exists but is completely locked down (permissions: 000). Your job: set permissions so alice can read it (and only alice + admin can).

**Initial State (Container Setup):**
```bash
# File exists but is unreadable
-r--r----- 1 root root   ... /opt/labs/level0/deploy.log  # Contains: "level1_password: abc123xyz"
# Permissions are 440 (owner read, group read, others nothing)
# User 'alice' is NOT in root group, so she can't read it
```

**Objective:**  
Change `/opt/labs/level0/deploy.log` permissions so alice can read it. The file should remain readable only by alice and root. Run: `cat /opt/labs/level0/deploy.log` and you'll see the password for level1.

**Hints:**
1. Use `ls -l /opt/labs/level0/deploy.log` to inspect permissions. The file starts with limited access.
2. You need to make it readable. Research `chmod` and understand owner/group/others permission bits.

**Verification:**  
When you run `cat /opt/labs/level0/deploy.log`, it displays: `level1_password: <PASSWORD>`

**Why No Cheating:**  
The file is initially unreadable (perms 000 or 440 where alice isn't in the group). Even `root` (if students run as root) sees the file but as alice, can't read it. Only fixing permissions allows access.

---

### Level 1 → 2: "Hidden Configuration"

**Scenario:**  
Operations team stored a critical config in a hidden file. You need to find and read `/opt/labs/level1/.secret_config`. The problem: it's completely hidden (doesn't appear in normal `ls` output). This teaches you that hidden files are just files starting with `.` — they're not actually secured by the filesystem, just convention.

**Initial State:**
```bash
# File exists but is hidden
-rw-r--r-- 1 level1 level1 ... /opt/labs/level1/.secret_config  # Contains: "level2_password: def456uvw"
```

**Objective:**  
Navigate to `/opt/labs/level1/`. Use `ls` with a special flag to reveal hidden files. Read `.secret_config` to get the password for level2.

**Hints:**
1. Regular `ls` doesn't show files starting with `.`. The `ls` command has a flag to show "all" files.
2. Check `man ls` or use `ls --help` to find the right flag.

**Verification:**  
When you run `cat /opt/labs/level1/.secret_config`, it displays: `level2_password: <PASSWORD>`

**Why No Cheating:**  
The file is readable but genuinely hidden from normal `ls`. Students must learn the correct `ls -a` flag. Brute-force cat-ing random names won't help.

**Learning Progression:**  
Level 0 taught: "Permissions control access." Level 1 teaches: "Hidden files are just naming convention, not security."

---

### Level 2 → 3: "Ownership & Access Control"

**Scenario:**  
A configuration file `/opt/labs/level2/config.conf` is owned by the wrong user. It's currently owned by `alice:users` but should be `root:techcorp`. You need to use `chown` to fix it. Once the ownership is correct, the content (password) becomes readable.

**Initial State:**
```bash
# File is owned by alice, not readable by current level2 user
-rw------- 1 alice   users   ... /opt/labs/level2/config.conf  # Contains: "level3_password: ghi789rst"
# level2 user can't read it (different owner, not in users group, no other access)
```

**Objective:**  
Use `chown` to change ownership to `root:techcorp`. Verify with `ls -l`. Then read the file to get the level3 password.

**Hints:**
1. `chown owner:group filename` is the syntax. You'll need to do this with `sudo` or as root.
2. After changing ownership, check `ls -l` to confirm. Then `cat` the file.

**Verification:**  
When you run `cat /opt/labs/level2/config.conf`, it displays: `level3_password: <PASSWORD>`

**Why No Cheating:**  
The file is genuinely unreadable by the current user until ownership changes. Only solving the challenge makes it accessible.

**Learning Progression:**  
Level 2 teaches: "Ownership matters. Only the owner (or root) can change permissions. Different owners have different access rights."

---

### Level 3 → 4: "Special Permissions - setuid"

**Scenario:**  
There's a utility script `/opt/labs/level3/check_status.sh` that needs elevated privileges to run. It should execute as root (the owner) when called by regular users. This requires the setuid bit.

**Initial State:**
```bash
# Script lacks setuid; runs as current user (insufficient privileges)
-rwxr-xr-x 1 root root ... /opt/labs/level3/check_status.sh
# Script content tries to read /opt/labs/level3/protected_data.txt (readable only by root)
# Running as level3 user fails: "Permission denied"
```

**Objective:**  
Set the setuid bit on the script using `chmod u+s` or `chmod 4755`. Once set, the script will execute with root privileges. Run the script and capture its output, which contains the level4 password.

**Hints:**
1. Setuid is represented by a leading `4` in octal notation (e.g., 4755). Use `chmod u+s` to add it symbolically.
2. After setting, run `ls -l` to verify (you'll see an `s` instead of `x` in the owner's execute position).

**Verification:**  
When you run `/opt/labs/level3/check_status.sh`, it displays: `level4_password: <PASSWORD>`

**Why No Cheating:**  
The script's output depends on it running as root. Without the setuid bit, it fails or shows nothing. Only setting the bit correctly makes it work.

**Learning Progression:**  
Level 3 teaches: "Setuid allows privilege escalation for specific tasks. This is how tools like `sudo` work at a filesystem level."

---



---

### Level 5 → 6: "umask & Default Permissions"

**Scenario:**  
New files in `/opt/labs/level5/` are being created with overly permissive defaults (mode 666). This is a security issue. The umask controls defaults. You need to set it correctly so new files are 644 and directories are 755.

**Initial State:**
```bash
# Current umask is loose (e.g., 0022, resulting in 644 files — but students should verify and adjust)
# Actually, let's start with 0002 (resulting in 664 files — too permissive)
# Student must calculate and set umask to 0022

# A test file is pre-created with wrong permissions to show the problem
-rw-rw-r-- 1 level5 level5 ... /opt/labs/level5/insecure_log.txt  # (664 perms, others can write)
```

**Objective:**  
1. Check current umask: `umask` shows it's too permissive
2. Calculate correct umask for 644 files: 666 - 644 = 022, so `umask 0022`
3. Create a test file and verify it's 644
4. Make the umask persistent by adding it to a startup filels (e.g., ~/.bashrc or /etc/profile.d/umask.sh)
5. A flag file is created with 644 permissions (readable by all) after you fix umask

**Hints:**
1. umask is the inverse of permissions. To get 644, you need umask 022.
2. Set it with `umask 0022` in the shell. To make it permanent, add to ~/.bashrc or system-wide in /etc/login.defs.

**Verification:**  
After setting umask correctly, a file `/opt/labs/level5/level6_password.txt` appears (or becomes readable) with: `level6_password: <PASSWORD>`

**Why No Cheating:**  
The file is initially hidden or unreadable. Only after fixing umask system-wide does a setup script create/unlock the password file.

**Learning Progression:**  
Level 5 teaches: "umask controls default file creation permissions. Security starts with good defaults."

---

### Level 6 → 7: "Practical Permission Audit & Multi-level Challenge"

**Scenario:**  
You've completed basic permission challenges. Now, real-world: `/opt/labs/level6/` contains multiple files with misconfigured permissions. Some should be owner-only (600), others owner+group readable (640), others public (644). You must audit and fix ALL of them correctly. This level bridges Phases 1 and 2.

**Initial State:**
```bash
# Multiple files with wrong permissions
-rw-r--r-- 1 root root ... /opt/labs/level6/admin_key  # Should be 600 (owner only)
-rw-rw-r-- 1 root tech ... /opt/labs/level6/shared_log  # Should be 640 (owner + group)
  -rw------- 1  root root ... /opt/labs/level6/public_readme  # Should be 644 (world readable)

# A file listing requirements
-rw-r--r-- 1 root root ... /opt/labs/level6/AUDIT_SPEC.txt  # Lists desired permissions for each file
```

**Objective:**  
1. Read `/opt/labs/level6/AUDIT_SPEC.txt` for the specification
2. Use `chmod` to fix permissions on all files
3. After ALL files are correctly fixed, a script validates and outputs the level7 password

**Hints:**
1. Use `ls -l` to inspect each file and compare against AUDIT_SPEC.txt
2. You can use `find` with `-exec chmod` to batch-fix, or individually with `chmod`.

**Verification:**  
A validation script runs automatically (or you run it with `./validate.sh`). If all permissions are correct, it outputs: `level7_password: <PASSWORD>`

**Why No Cheating:**  
The password is locked behind a validation script. Only correct permissions on ALL files trigger the unlock.

**Learning Progression:**  
Level 6 synthesizes Phase 1 knowledge. Moving into Phase 2 (users/groups), students now understand that permissions are the gatekeepers. Next, they'll learn WHO the users/groups are.

---

## **PHASE 2: USERS & GROUPS (Levels 7-13)**
*Learning Focus: User and group management, applying permission knowledge to real accounts*

### Level 7 → 8: "On-board the New Team"

**Scenario:**  
Three new junior admins start today: bob, charlie, and diana. They need accounts, a "junior_admins" group, and proper permissions. Once created, you can ssh into their accounts to access password files.

**Initial State:**   
```bash
# Users don't exist
# Group doesn't exist
# Directories needed: /home/bob, /home/charlie, /home/diana

# A script validates user creation
-rwxr-xr-x 1 root root ... /opt/labs/level7/validate_users.sh
# This script checks: users exist, have home dirs, are in junior_admins group
```

**Objective:**  
1. Create group: `groupadd junior_admins`
2. Create users: `useradd -m -s /bin/bash bob` (repeat for charlie, diana)
3. Add to group: `usermod -a -G junior_admins bob` (repeat for all)
4. Run validation: `/opt/labs/level7/validate_users.sh`
5. If successful, it outputs: `level8_password: <PASSWORD>`

**Hints:**
1. `useradd -m` creates home directory. `-s /bin/bash` sets shell.
2. `usermod -a -G` appends to group (don't remove existing groups).
 
**Verification:**  
Validation script outputs: `level8_password: <PASSWORD>`

**Why No Cheating:**  
The password is locked in a validation script. Only correct user/group creation triggers it.

**Learning Progression:**  
Level 7 transitions from file permissions to users/groups. Students now realize: "permissions mean nothing without knowing who the users are."

---

### Level 8 → 9: "Password Policies & Shadow File"

**Scenario:**  
Bob's password should expire every 90 days and warn him 14 days before expiration. You configure this using `chage`. Once configured, a service script unlocks the password.

**Initial State:**
```bash
# Bob exists (created in Level 7)
# Shadow file shows: no expiration set
# A monitoring script waits for the correct chage configuration
```

**Objective:**  
1. Set bob's password to expire in 90 days: `chage -M 90 bob`
2. Set warning 14 days before: `chage -W 14 bob`
3. Run validation: `./validate_password_policy.sh`
4. If correct, it outputs: `level9_password: <PASSWORD>`

**Hints:**
1. `chage -l bob` shows current settings. Modify with `-M` (max days) and `-W` (warning days).
2. The shadow file (`/etc/shadow`) records this; you can verify with `sudo cat /etc/shadow | grep bob`.

**Verification:**  
Validation script outputs: `level9_password: <PASSWORD>`

**Learning Progression:**  
Level 8 teaches: "Passwords expire. Security policies must be enforced systematically."

---

### Level 9 → 10: "Group Permissions & Shared Resources"

**Scenario:**  
Developers need shared access to `/opt/labs/level9/shared_repo/`. Set it up with setgid so files created by any team member are automatically owned by the "developers" group.

**Initial State:**
```bash
# Directory exists but permissions are wrong
drwxr-xr-x 1 root root ... /opt/labs/level9/shared_repo/
# No setgid bit; file created by alice won't be in developers group
```

**Objective:**  
1. Change group ownership: `chgrp developers /opt/labs/level9/shared_repo/`
2. Set setgid: `chmod g+s /opt/labs/level9/shared_repo/` (or `chmod 2775`)
3. Ensure rw access for group: `chmod g+w /opt/labs/level9/shared_repo/`
4. Test: create a file and verify it's owned by developers group
5. Validation script checks this and outputs password

**Hints:**
1. Setgid on directories (2 in octal) makes new files inherit the directory's group.
2. Test by creating a file as alice and checking ownership with `ls -l`.

**Verification:**  
Validation script outputs: `level10_password: <PASSWORD>`

**Learning Progression:**  
Level 9 teaches: "Groups are the mechanism for shared access and collaborative work."

---

### Level 10 → 11: "sudo Basics & sudoers"

**Scenario:**  
The junior_admins group needs sudo access for common operations without a password. You edit `/etc/sudoers` (with `visudo`) to grant it.

**Initial State:**
```bash
# /etc/sudoers exists, junior_admins not yet granted sudo
# A test script tries to run privileged commands and expects them to succeed
```

**Objective:**  
1. Run `visudo` to safely edit sudoers
2. Add line: `%junior_admins ALL=(ALL) NOPASSWD: /bin/systemctl, /bin/journalctl, /bin/cat`
3. Test as a junior_admins member: `sudo systemctl status ssh` (should work without password)
4. Validation script tests this and outputs password

**Hints:**
1. Always use `visudo`, never edit `/etc/sudoers` directly (it validates syntax).
2. `%` prefix means "group". Format: `%groupname command`

**Verification:**  
Validation script outputs: `level11_password: <PASSWORD>`

**Learning Progression:**  
Level 10 teaches: "sudo is how you grant escalated privileges safely. visudo prevents lockout via syntax checking."

---

### Level 11 → 12: "sudo with Specific Commands (Least Privilege)"

**Scenario:**  
Bob should only be able to restart nginx, not Apache or any other systemctl command. You configure this fine-grained sudo rule.

**Initial State:**
```bash
# Bob exists (created earlier)
# Sudoers might grant him broad sudo or none yet
```

**Objective:**  
1. Edit sudoers (visudo): add `bob ALL=(ALL) NOPASSWD: /bin/systemctl restart nginx`
2. Test: `sudo systemctl restart nginx` should work as bob
3. Test: `sudo systemctl stop nginx` should fail or require password
4. Validation script tests both and outputs password if correct

**Hints:**
1. Specific commands must include the full path AND subcommand. `/bin/systemctl` alone is too broad.
2. Testing is important—verify both success and failure cases.

**Verification:**  
Validation script outputs: `level12_password: <PASSWORD>`

**Learning Progression:**  
Level 11 teaches: "Principle of least privilege. Every user gets the MINIMUM access needed, no more."

---

### Level 12 → 13: "User Quotas & Account Disabling"

**Scenario:**  
Diana is using too much storage. Set a 500MB quota on her account. Also, disable an old account "oldadmin" that's unused.

**Initial State:**
```bash
# Diana exists (created earlier)
# oldadmin account exists but shouldn't be usable
# Quota system is configured on the filesystem
```

**Objective:**  
1. Set quota for diana: `setquota -u diana 500M 500M 0 0 /` (or use edquota)
2. Disable oldadmin: `chage -E 0 oldadmin` (expire immediately) or `passwd -l oldadmin` (lock)
3. Test: diana can't write past 500MB; oldadmin can't log in
4. Validation script tests both and outputs password

**Hints:**
1. Quotas require filesystem support and quota tools. If not available, focus on account disabling.
2. `chage -E 0` sets expiration to epoch (disables immediately). `passwd -l` locks the password.

**Verification:**  
Validation script outputs: `level13_password: <PASSWORD>`

**Learning Progression:**  
Level 12 teaches: "Quotas enforce resource limits. Account disabling prevents unauthorized access."

---

### Level 13 → 14: "Practical User Provisioning Scenario"

**Scenario:**  
A contractor (eve) joins the payments team. Provision her account from scratch: user creation, group membership, sudo access (payments service only), password aging, and skeleton home directory.

**Initial State:**
```bash
# eve doesn't exist
# payments group exists (created in earlier challenges)
# A provisioning checklist specifies requirements
# A validation script checks all requirements
```

**Objective:**  
1. Create eve: `useradd -m -s /bin/bash eve`
2. Add to payments group: `usermod -a -G payments eve`
3. Set sudo rule: edit sudoers to allow eve to restart payments service
4. Set password aging: `chage -M 90 -W 14 eve`
5. Populate home directory: copy skeleton files (run a provisioning script)
6. Run validation: `./provision_contractor.sh`

**Hints:**
1. Break this into steps: create user, group, sudo, password policy, skeleton setup.
2. Validation script checks all these aspects.

**Verification:**  
Validation script outputs: `level14_password: <PASSWORD>`

**Learning Progression:**  
Level 13 synthesizes Phase 2. Students can now provision a complete user account following best practices. Transitioning to Phase 3, they'll manage the services these users need.

---

## **PHASE 3: SERVICES & SYSTEMD (Levels 14-20)**
*Learning Focus: Service management, running services safely under specific users*

### Level 14 → 15: "systemd Basics - Service Control"

**Scenario:**  
Apache2 is running but shouldn't be. Stop it and disable it from auto-start. Also, examine its logs to understand why it's not needed (logs contain the password hint).

**Initial State:**
```bash
# apache2 is installed and running
# Enabled for auto-start
# systemd unit file exists
# Logs contain sensitive info (the password) that appears after stopping service
```

**Objective:**  
1. Stop apache2: `systemctl stop apache2`
2. Disable: `systemctl disable apache2`
3. Check status: `systemctl status apache2` (should be inactive)
4. View logs: `journalctl -u apache2 -n 50`
5. In logs, you'll find: "DEPRECATED: Apache2 no longer needed. Next level password: <PASSWORD>"

**Hints:**
1. `systemctl stop` halts now. `systemctl disable` prevents auto-start.
2. `systemctl status` shows current state and recent logs.
3. `journalctl -u servicename` filters logs for that service.

**Verification:**  
In the logs, you find: `level15_password: <PASSWORD>`

**Why No Cheating:**  
The password is hidden in service logs. Only stopping the service (solving the challenge) reveals the logs.

**Learning Progression:**  
Level 14 transitions from user management to service management. Students now control which services run and who sees what.

---

### Level 15 → 16: "Service Dependencies & Ordering"

**Scenario:**  
A "database" service and an "appserver" service both exist. Currently, they start in arbitrary order, causing race conditions. Configure the appserver to depend on and start after database.

**Initial State:**
```bash
# /etc/systemd/system/database.service exists (no deps)
# /etc/systemd/system/appserver.service exists (no deps)
# Both are enabled but start race condition causes issues

# Appserver logs show errors due to database not being ready
# A validation script checks if dependencies are correct
```

**Objective:**  
1. Edit `/etc/systemd/system/appserver.service`
2. Add to [Unit] section: `After=database.service` and `Requires=database.service`
3. Save and reload: `systemctl daemon-reload`
4. Restart appserver: `systemctl restart appserver`
5. Check logs: `journalctl -u appserver` (should show successful start now)
6. Validation script outputs password

**Hints:**
1. `After=` means "start after this service". `Requires=` means "fail if this service is stopped".
2. Always run `systemctl daemon-reload` after editing unit files.

**Verification:**  
Validation script outputs: `level16_password: <PASSWORD>`

**Learning Progression:**  
Level 15 teaches: "Service orchestration prevents race conditions. Dependencies ensure correct startup order."

---

### Level 16 → 17: "Creating Custom systemd Services"

**Scenario:**  
A custom application at `/opt/techcorp/monitor.sh` needs to run on boot under a dedicated user and be managed by systemd. You create a unit file for it.

**Initial State:**
```bash
# /opt/techcorp/monitor.sh exists (a bash script)
# A dedicated user "monitor_user" exists
# /etc/systemd/system/techcorp-monitor.service doesn't exist
# A test checks if the service runs correctly
```

**Objective:**  
1. Create `/etc/systemd/system/techcorp-monitor.service`:
   ```
   [Unit]
   Description=TechCorp Monitor Service
   After=network.target

   [Service]
   Type=simple
   User=monitor_user
   WorkingDirectory=/opt/techcorp
   ExecStart=/bin/bash /opt/techcorp/monitor.sh
   Restart=on-failure
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
2. Enable and start: `systemctl enable --now techcorp-monitor.service`
3. Verify: `systemctl status techcorp-monitor` (should be active)
4. Check script output for password

**Hints:**
1. Use existing unit files as templates (e.g., nginx, docker).
2. `Type=simple` is the default. `Restart=on-failure` ensures resilience.

**Verification:**  
When service starts successfully, script outputs to a log file: `level17_password: <PASSWORD>`

**Why No Cheating:**  
The password is in the script output, which only happens if the service runs correctly.

**Learning Progression:**  
Level 16 teaches: "Creating custom services is how you integrate your applications into systemd management."

---

### Level 17 → 18: "Logs & journalctl"

**Scenario:**  
An application crashes unexpectedly. You need to use `journalctl` to find the root cause error message, which contains the password.

**Initial State:**
```bash
# A service called "buggy-app" is installed and running
# It crashes and logs an error: "CRITICAL: Database connection failed. Recovery key: <PASSWORD>"
```

**Objective:**  
1. Check service status: `systemctl status buggy-app` (shows it's failed)
2. View logs: `journalctl -u buggy-app -n 50` (recent 50 lines)
3. Filter by priority: `journalctl -u buggy-app -p err` (errors only)
4. Find the CRITICAL message and extract the password

**Hints:**
1. `journalctl -u servicename` filters by service.
2. `-p err` filters by priority (err, crit, alert, etc.).
3. Use `grep` to search for keywords like "CRITICAL" or "Recovery".

**Verification:**  
In the logs, you find: `level18_password: <PASSWORD>`

**Learning Progression:**  
Level 17 teaches: "Logs are your first debugging tool. Understanding journalctl is essential."

---

### Level 18 → 19: "Service Security - User Context & Capabilities"

**Scenario:**  
A web service (webapp) currently runs as root but doesn't need full root privilege. Configure it to run as an unprivileged user while retaining the ability to bind to port 80 (which normally requires root). Use Linux capabilities.

**Initial State:**
```bash
# /etc/systemd/system/webapp.service exists, runs as root
# User "webapp_user" exists (unprivileged)
# Webapp listens on port 80
```

**Objective:**  
1. Edit `/etc/systemd/system/webapp.service`
2. Change: `User=webapp_user`
3. Add capability: `AmbientCapabilities=CAP_NET_BIND_SERVICE` (allows binding to port <1024)
4. Reload and restart: `systemctl daemon-reload && systemctl restart webapp`
5. Verify: `ps aux | grep webapp` shows it's running as webapp_user
6. Verify: port 80 is still listening (check with `netstat -tuln`)
7. Validation script confirms security posture and outputs password

**Hints:**
1. Capabilities are fine-grained privileges. `CAP_NET_BIND_SERVICE` is one of many.
2. Check process list to confirm user. Check open ports to confirm 80 is listening.

**Verification:**  
Validation script outputs: `level19_password: <PASSWORD>`

**Learning Progression:**  
Level 18 teaches: "Principle of least privilege for services. Capabilities split root privileges."

---

### Level 19 → 20: "Troubleshooting Failing Services"

**Scenario:**  
A service (broken-svc) is in a "failed" state. Diagnose the root cause (e.g., bad path, missing user, permission denied) and fix it.

**Initial State:**
```bash
# /etc/systemd/system/broken-svc.service exists with intentional error
# E.g., ExecStart points to non-existent path
# Or User specified doesn't exist
# Or working directory doesn't exist
```

**Objective:**  
1. Check status: `systemctl status broken-svc` (failed, shows error hint)
2. View logs: `journalctl -u broken-svc -n 20` (shows the actual error)
3. Identify root cause (missing path, user, permissions, etc.)
4. Fix the unit file or create missing resources
5. Reload and restart: `systemctl daemon-reload && systemctl restart broken-svc`
6. Verify active status
7. Validation script checks and outputs password

**Hints:**
1. Common causes: ExecStart path wrong, User doesn't exist, WorkingDirectory missing.
2. Test the ExecStart command manually to see exact error: `/path/to/script arg1 arg2`

**Verification:**  
Validation script outputs: `level20_password: <PASSWORD>`

**Learning Progression:**  
Level 19 teaches: "Troubleshooting is a skill. Logs and status messages give clues."

---

### Level 20 → 21: "Real Scenario - Deploying & Managing an App Service"

**Scenario:**  
A Python Flask application needs production deployment. Create a systemd service, ensure it runs as an unprivileged user, starts on boot, auto-restarts on failure, and is properly logged.

**Initial State:**
```bash
# /opt/techcorp/api_server.py exists (Flask app listening on port 5000)
# User "api_user" exists
# No systemd service exists yet
```

**Objective:**  
1. Create `/etc/systemd/system/api-server.service`:
   ```
   [Unit]
   Description=TechCorp API Server
   After=network.target

   [Service]
   Type=simple
   User=api_user
   WorkingDirectory=/opt/techcorp
   ExecStart=/usr/bin/python3 /opt/techcorp/api_server.py
   Restart=on-failure
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```
2. Enable and start: `systemctl enable --now api-server.service`
3. Verify running: `systemctl status api-server`
4. Test connectivity: `curl localhost:5000` (should respond)
5. Check logs: `journalctl -u api-server`
6. Password is in the API response or logs

**Hints:**
1. Ensure python3 is available. Test the ExecStart command manually first.
2. Flask apps listen on localhost by default. The curl test verifies it's working.

**Verification:**  
When service starts and responds to requests, output contains: `level21_password: <PASSWORD>`

**Learning Progression:**  
Level 20 synthesizes Phase 3. Students can now deploy and manage production applications. Transitioning to Phase 4, they'll expose these services securely over the network.

---

## **PHASE 4: NETWORKING & FIREWALL (Levels 21-27)**
*Learning Focus: Network configuration, firewalling, secure service exposure*

### Level 21 → 22: "Network Interfaces & IP Configuration"

**Scenario:**  
A second network interface exists but is not configured. Assign it a static IP (192.168.1.100/24) with gateway 192.168.1.1 using netplan (or /etc/network/interfaces).

**Initial State:**
```bash
# eth1 (or similar) exists but has no IP
# ip addr show : eth1 has no inet address
# netplan config file exists but eth1 not defined
```

**Objective:**  
1. View current config: `ip addr show`
2. Edit netplan: `/etc/netplan/01-netcfg.yaml` (Ubuntu) or similar
3. Add eth1 configuration with static IP and gateway
4. Apply: `netplan apply`
5. Verify: `ip addr show eth1` (should show 192.168.1.100/24)
6. Test routing: `ip route show` (should show default via 192.168.1.1)
7. A check script verifies and outputs password

**Hints:**
1. Netplan uses YAML. Indentation matters. Basic syntax:
   ```
   ethernets:
     eth1:
       addresses:
         - 192.168.1.100/24
       routes:
         - to: default
           via: 192.168.1.1
   ```
2. Always `netplan apply` after editing. No service restart needed.

**Verification:**  
Validation script outputs: `level22_password: <PASSWORD>`

**Learning Progression:**  
Level 21 teaches: "Static IP configuration is foundational. DHCP is convenient but static IPs are reliable."

---

### Level 22 → 23: "DNS & Hostname Configuration"

**Scenario:**  
Set the system hostname to "techcorp-server01" and configure DNS to use Google's nameservers (8.8.8.8, 8.8.4.4).

**Initial State:**
```bash
# Hostname is generic (e.g., "localhost")
# /etc/resolv.conf has default nameservers (or none)
```

**Objective:**  
1. Set hostname: `hostnamectl set-hostname techcorp-server01`
2. Edit netplan and add DNS:
   ```
   nameservers:
       addresses: [8.8.8.8, 8.8.4.4]
   ```
3. Apply: `netplan apply` or restart systemd-resolved: `systemctl restart systemd-resolved`
4. Verify: `hostname` (shows techcorp-server01)
5. Verify DNS: `nslookup google.com` or `dig google.com` (should resolve)
6. A check script verifies and outputs password

**Hints:**
1. `hostnamectl` is the modern way to set hostname (overwrites /etc/hostname).
2. DNS can be set in netplan (modern) or /etc/resolv.conf (legacy). Netplan is preferred.

**Verification:**  
Validation script outputs: `level23_password: <PASSWORD>`

**Learning Progression:**  
Level 22 teaches: "Hostname and DNS resolution are critical for service discovery and management."

---

### Level 23 → 24: "iptables Basics - Firewall Rules"

**Scenario:**  
Configure a basic firewall: allow SSH (22) and HTTP (80), drop all other incoming traffic by default.

**Initial State:**
```bash
# iptables has no rules (or default ACCEPT)
# A test script verifies the firewall rules
```

**Objective:**  
1. Set default policy: `sudo iptables -P INPUT DROP`
2. Allow loopback: `sudo iptables -A INPUT -i lo -j ACCEPT`
3. Allow established: `sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT`
4. Allow SSH: `sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT`
5. Allow HTTP: `sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT`
6. View rules: `sudo iptables -L -v`
7. Save (install iptables-persistent): `sudo iptables-save > /etc/iptables/rules.v4`
8. A test verifies SSH and HTTP work, others fail
9. Validation script outputs password

**Hints:**
1. Rules are evaluated top-to-bottom. Specific rules first.
2. Loopback and established connections must be allowed, or you'll break local connections.

**Verification:**  
Validation script outputs: `level24_password: <PASSWORD>`

**Why No Cheating:**  
Password is in a validation script that tests actual network connectivity. Rules must work.

**Learning Progression:**  
Level 23 teaches: "Firewalling is essential. Default-deny is more secure than default-allow."

---

### Level 24 → 25: "Port Filtering & Service Exposure"

**Scenario:**  
A database (port 3306) should only be accessible from the app server (10.0.1.50). Block all others.

**Initial State:**
```bash
# Current iptables allow port 3306 from anywhere
# A test from other IPs should fail
# A test from 10.0.1.50 should succeed
```

**Objective:**  
1. Add rule to allow only 10.0.1.50: `sudo iptables -A INPUT -p tcp --dport 3306 -s 10.0.1.50 -j ACCEPT`
2. Add rule to drop others: `sudo iptables -A INPUT -p tcp --dport 3306 -j DROP`
3. Test from 10.0.1.50: should succeed (or use `telnet 10.0.1.50 3306` simulation in container)
4. Test from other IPs: should timeout/fail
5. Validation script tests both scenarios and outputs password

**Hints:**
1. Order matters! Specific ACCEPT before general DROP.
2. The `-s` flag specifies source IP. This is how you whitelist.

**Verification:**  
Validation script outputs: `level25_password: <PASSWORD>`

**Learning Progression:**  
Level 24 teaches: "Port filtering by source IP is how you restrict service access."

---

### Level 25 → 26: "Troubleshooting Network Connectivity"

**Scenario:**  
An application can't reach an external service (203.0.113.50:443). Diagnose: is it DNS, routing, or firewall?

**Initial State:**
```bash
# Outgoing rules block port 443
# DNS works fine
# A test script tries to connect and fails
# Error message provides hints to troubleshoot
```

**Objective:**  
1. Test DNS: `nslookup example.com` (should resolve)
2. Test routing: `traceroute 203.0.113.50` (or `ip route show`)
3. Test firewall: `telnet 203.0.113.50 443` (times out if blocked)
4. Identify: firewall is the issue
5. Add rule: `sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT`
6. Test again: should now connect
7. Validation script verifies connectivity and outputs password

**Hints:**
1. Systematically test each layer: DNS, routing, firewall.
2. Check both INPUT and OUTPUT rules. OUTPUT controls outgoing traffic.

**Verification:**  
Validation script outputs: `level26_password: <PASSWORD>`

**Learning Progression:**  
Level 25 teaches: "Troubleshooting methodology. Test each layer systematically."

---

### Level 26 → 27: "Advanced Filtering - Stateful Rules & Rate Limiting"

**Scenario:**  
Limit SSH connections to prevent brute force attacks. Allow max 5 new connections per minute per source.

**Initial State:**
```bash
# No rate limiting rules
# A stress test script attempts many rapid connections
```

**Objective:**  
1. Add rate limit to SSH: `sudo iptables -A INPUT -p tcp --dport 22 -m limit --limit 5/m -j ACCEPT`
2. Add drop rule after limit: `sudo iptables -A INPUT -p tcp --dport 22 -j DROP`
3. Add stateful filtering: `sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT`
4. Test: rapid connections should be limited (some fail)
5. Persistent connections should still work
6. Validation script tests this and outputs password

**Hints:**
1. `-m limit --limit 5/m` means 5 packets per minute.
2. Order matters: limit rule first, then drop. Established connections bypass limit rules.

**Verification:**  
Validation script outputs: `level27_password: <PASSWORD>`

**Learning Progression:**  
Level 26 teaches: "Rate limiting prevents resource exhaustion. Stateful filtering is more efficient."

---

### Level 27 → 28: "Security Hardening Scenario"

**Scenario:**  
Implement a hardened firewall: SSH only from admin network (10.0.0.0/24), HTTP/HTTPS public, outgoing traffic whitelisted (DNS, HTTP, HTTPS only), everything else denied.

**Initial State:**
```bash
# Firewall rules are loose or non-existent
# Multiple test cases verify hardening
```

**Objective:**  
1. Set strict default policies: `iptables -P INPUT DROP`, `iptables -P OUTPUT DROP`, `iptables -P FORWARD DROP`
2. Allow loopback: `-i lo -j ACCEPT`
3. Allow established/related: `-m state --state ESTABLISHED,RELATED -j ACCEPT`
4. Allow SSH from 10.0.0.0/24: `-p tcp --dport 22 -s 10.0.0.0/24 -j ACCEPT`
5. Allow HTTP/HTTPS in: `-p tcp --dport 80,443 -j ACCEPT`
6. Allow DNS out: `-p udp --dport 53 -j ACCEPT`
7. Allow HTTP/HTTPS out: `-p tcp --dport 80,443 -j ACCEPT`
8. Test: SSH from 10.0.0.0/24 works, others fail; HTTP/HTTPS work; DNS works; others fail
9. Document rules; validation script tests all scenarios and outputs password

**Hints:**
1. With strict OUTPUT rules, test carefully or you'll lose access.
2. Multiple test cases: SSH allowed/blocked, HTTP/HTTPS work, DNS works, other traffic blocked.

**Verification:**  
Validation script outputs: `level28_password: <PASSWORD>`

**Learning Progression:**  
Level 27 synthesizes Phase 4. Students now understand firewalling principles and can implement them. Transitioning to Phase 5, they'll manage the storage underneath all these services.

---

## **PHASE 5: STORAGE & FILESYSTEMS (Levels 28-33)**
*Learning Focus: Partitioning, filesystems, LVM, backup, disk management*

### Level 28 → 29: "Partitions & fdisk"

**Scenario:**  
A new 50GB disk (`/dev/sdb`) is attached. Partition it: 40GB for data, 10GB for backup.

**Initial State:**
```bash
# /dev/sdb exists, unpartitioned (no partition table)
# ip addr show : unformatted space
# A check script verifies partition existence and sizes
```

**Objective:**  
1. List disks: `lsblk` or `fdisk -l`
2. Open fdisk: `sudo fdisk /dev/sdb`
3. Create partition 1: `n` → `primary` → `+40G`
4. Create partition 2: `n` → `primary` → `+10G` (or accept default)
5. Write: `w`
6. Verify: `fdisk -l /dev/sdb` (should show sdb1, sdb2)
7. Validation script confirms sizes and outputs password

**Hints:**
1. fdisk is interactive. Commands: `n` (new), `d` (delete), `p` (print), `w` (write).
2. When specifying size, use `+40G` format for 40GB.

**Verification:**  
Validation script outputs: `level29_password: <PASSWORD>`

**Why No Cheating:**  
Password is in a validation script that checks actual partition sizes.

**Learning Progression:**  
Level 28 transitions from networking to storage. Students now understand the full stack: network services run on systems with filesystems.

---

### Level 29 → 30: "Filesystems - mkfs, mount, umount"

**Scenario:**  
Create ext4 filesystems on the new partitions and mount them persistently at `/mnt/data` and `/mnt/backup`.

**Initial State:**
```bash
# /dev/sdb1 and /dev/sdb2 exist (from Level 28)
# No filesystems created yet
# No mount points exist
```

**Objective:**  
1. Create filesystems: `sudo mkfs.ext4 /dev/sdb1` and `sudo mkfs.ext4 /dev/sdb2`
2. Create mount points: `sudo mkdir -p /mnt/data /mnt/backup`
3. Mount: `sudo mount /dev/sdb1 /mnt/data` and `sudo mount /dev/sdb2 /mnt/backup`
4. Verify: `mount | grep sdb` and `df -h`
5. Make persistent: edit `/etc/fstab` (add two lines with `/dev/sdb1 /mnt/data ext4 defaults 0 2` format)
6. Test persistence: `sudo umount /mnt/data && sudo mount -a` (remounts from fstab)
7. Validation script verifies mounts and fstab entries, outputs password

**Hints:**
1. fstab format: `device mount_point fstype options dump pass`
2. Always test fstab changes with `mount -a` before rebooting.

**Verification:**  
Validation script outputs: `level30_password: <PASSWORD>`

**Learning Progression:**  
Level 29 teaches: "Creating filesystems and mounting are foundational for storage management."

---

### Level 30 → 31: "Logical Volume Management (LVM)"

**Scenario:**  
Use LVM to create a flexible storage pool. Physical volume → volume group → logical volume that can be grown later.

**Initial State:**
```bash
# /dev/sdb (or a free partition) available
# LVM tools installed
```

**Objective:**  
1. Initialize PV: `sudo pvcreate /dev/sdb2` (use sdb2 from Level 28)
2. Create VG: `sudo vgcreate data_vg /dev/sdb2`
3. Create LV: `sudo lvcreate -L 8G -n data_lv data_vg` (use 8GB to leave room for growth)
4. Format: `sudo mkfs.ext4 /dev/data_vg/data_lv`
5. Mount: `sudo mount /dev/data_vg/data_lv /mnt/lvm_data`
6. Verify: `sudo lvs`, `sudo pvs`, `sudo vgs` (show LVM structure)
7. Document advantage: "Can grow LV without unmounting"
8. Validation script verifies LVM structure and outputs password

**Hints:**
1. LVM hierarchy: PV (physical volume on disk) → VG (volume group pooling PVs) → LV (logical volume from VG).
2. `-L 8G -n data_lv` creates an 8GB logical volume named data_lv.

**Verification:**  
Validation script outputs: `level31_password: <PASSWORD>`

**Learning Progression:**  
Level 30 teaches: "LVM provides flexibility. You can grow storage on-the-fly."

---

### Level 31 → 32: "Disk Usage Analysis & Cleanup"

**Scenario:**  
The root filesystem is 85% full. Find large directories, identify unnecessary files (old logs, temp files, duplicates), clean up, and document what was removed.

**Initial State:**
```bash
# /opt/labs/level31/ pre-populated with simulated clutter
  - Old log files (30 days old)
  - Temp files
  - Duplicate compressed backups
  - Total: 50% of filesystem used
# Cleanup to bring below 40% triggers password
```

**Objective:**  
1. Analyze: `du -sh /opt/labs/level31/*` (identify large dirs)
2. Deep dive: `du -sh /opt/labs/level31/*/* | sort -rh` (find largest subdirs)
3. Identify targets: old logs (`find . -name "*.log.*" -mtime +30`), temp files
4. Clean up: `rm -rf /opt/labs/level31/old_backups`, delete old logs
5. Verify: `df -h` (should show improvement)
6. Document: create `/opt/labs/level31/cleanup_report.txt` listing what was removed
7. After cleanup meets threshold, validation script outputs password

**Hints:**
1. `du` (disk usage) and `df` (disk free) are complementary.
2. `find -mtime +30` finds files modified more than 30 days ago.
3. Always check before deleting. Use `ls` to confirm, then `rm`.

**Verification:**  
Validation script outputs: `level32_password: <PASSWORD>`

**Why No Cheating:**  
Password is unlocked only when actual disk space is freed (validation checks `df`).

**Learning Progression:**  
Level 31 teaches: "Disk space is a finite resource. Regular cleanup is essential."

---

### Level 32 → 33: "Backup & Restore Basics"

**Scenario:**  
Back up critical files, simulate data loss, and restore from backup to verify integrity.

**Initial State:**
```bash
# /opt/labs/level32/important_data/ contains critical files
# No backup exists yet
```

**Objective:**  
1. Create backup: `sudo tar -czf /opt/labs/level32/backup.tar.gz /opt/labs/level32/important_data/`
2. Verify archive: `tar -tzf /opt/labs/level32/backup.tar.gz | head` (list contents)
3. Simulate loss: `rm -rf /opt/labs/level32/important_data/`
4. Confirm gone: `ls /opt/labs/level32/important_data` (empty or missing)
5. Restore: `tar -xzf /opt/labs/level32/backup.tar.gz -C /` (or appropriate path)
6. Verify restored: `ls /opt/labs/level32/important_data` (files back)
7. Document backup strategy: create `/opt/labs/level32/backup_plan.txt`
8. Validation script tests restore and outputs password

**Hints:**
1. `tar -czf` creates (`c`), gzips (`z`), to file (`f`).
2. `tar -tzf` lists without extracting.
3. `tar -xzf` extracts.

**Verification:**  
Validation script outputs: `level33_password: <PASSWORD>`

**Learning Progression:**  
Level 32 teaches: "Backups are insurance. Test restores regularly."

---

### Level 33 → 34: "Capstone - Infrastructure Audit & Remediation"

**Scenario:**  
Demonstrate mastery across all domains in a comprehensive audit. Cover permissions, users, services, networking, and storage.

**Initial State:**
```bash
# /opt/labs/level33/ contains a mixed environment with intentional issues
# An AUDIT_CHECKLIST.txt specifies what to audit and fix
```

**Objective:**  
Create a comprehensive audit report (`/opt/labs/level33/audit_report.txt`) with:

1. **Permissions Audit (5 examples):**
   - File path, current perms, desired perms, justification
   - Apply fixes if needed

2. **User & Group Audit:**
   - List active users (exclude system users)
   - Identify sudo access and justify
   - Check for orphaned accounts

3. **Service Audit:**
   - List enabled services
   - Justify each one
   - Check that critical services run as unprivileged users

4. **Network Audit:**
   - Listening ports and services
   - Firewall rules
   - Justify each rule

5. **Storage Audit:**
   - Filesystem usage
   - Mount points and persistence (fstab)
   - Backup strategy

**Objective (cont'd):**  
Submit report to `/opt/labs/level33/audit_report.txt`. If audit shows understanding of all 5 domains and correct analysis, validation script extracts and outputs the final password.

**Hints:**
1. Commands: `ls -la`, `getfacl`, `getent passwd`, `systemctl list-units`, `ss -tuln`, `iptables -L`, `df -h`, `du -sh`, `mount`
2. Report should be clear and justified (as if presenting to management).

**Verification:**  
Validation script reads report, verifies correctness, and outputs: `level34_password: CONGRATULATIONS! You've mastered TechCorp's infrastructure.`

---

## **LEVEL 34 (Final)**

### Level 34: "Congratulations!"

**Scenario:**  
You've completed all 33 labs and mastered sysadmin fundamentals.

**Objective:**  
You're done! Review achievements:
- 7 permission labs (file ownership, ACLs, special bits)
- 7 user/group labs (provisioning, policies, security)
- 7 service labs (systemd, logging, security hardening)
- 7 network/firewall labs (configuration, filtering, troubleshooting)
- 6 storage labs (partitions, filesystems, LVM, backups)

**Verification:**  
Congratulations message displayed. Your terminal shows:
```
═══════════════════════════════════════════════════════════════
  🎉 CONGRATULATIONS! 🎉
═══════════════════════════════════════════════════════════════
You've successfully completed all 34 TechCorp infrastructure
remediation labs. You've mastered:

✓ File Permissions & Security
✓ User & Group Management
✓ Service Management with systemd
✓ Network Configuration & Firewalling
✓ Storage Management & Backups

You're now ready to handle real-world sysadmin challenges.
═══════════════════════════════════════════════════════════════
```

---

## **KEY DESIGN CHANGES (v2)**

| Aspect | v1 | v2 |
|--------|----|----|
| **Flag Storage** | Separate flag file (cheatable) | Embedded in solution (unsolvable without solving) |
| **Verification** | Manual or none | Automated validation scripts |
| **Cheating Risk** | HIGH (cat flag.txt) | ELIMINATED (flag tied to solution) |
| **Progression** | Linear but independent | Progressive, each level builds on prior |
| **Dockerization** | Assumed | Explicit (no external dependencies) |
| **Realism** | Simplified scenarios | Real-world problems requiring actual work |

---

## **IMPLEMENTATION ROADMAP**

### Week 1: Scenario Validation (You)
- Review all 34 levels
- Approve scenarios, objectives, hints
- Flag any adjustments needed

### Week 2: Docker & Provisioning (Me)
- Build base Docker image (Ubuntu + tools)
- Write provisioning script (creates users, flags, scenarios)
- Create docker-compose.yml for 60 containers

### Week 3: Testing & Refinement (Me + You)
- Test each level end-to-end
- Verify flags are correctly embedded
- Refine validation scripts based on findings

### Week 4: Deployment & Documentation (Me)
- Deploy to AWS ap-south-1 (t3.xlarge)
- Write student README + instructor manual
- Launch to students

---

## **Next Steps**

1. **Review this v2 specification** — Approve or request changes
2. **Confirm scenarios feel right** — Difficulty, realism, learning progression
3. **Sign off** — Ready to build Docker + provisioning?

Let me know! 🚀
