# TechCorp Sysadmin Labs: Student Guide

Welcome to the TechCorp Infrastructure Remediation Labs! This is a hands-on course covering Linux system administration fundamentals.

---

## **Access Information**

### Connection Details

```
Server: <INSTRUCTOR_PROVIDED_IP>
Port Range: 2220-2279 (one per student)
Protocol: SSH (Secure Shell)
```

### Your Assigned Port

Your instructor will assign you a port number between 2220-2279. This is YOUR port for the entire course.

**Example:**
- Student 0 (Alice): Port 2220
- Student 1 (Bob): Port 2221
- Student 59: Port 2279

---

## **How to Connect**

### Step 1: Open a Terminal

On macOS, Linux, or Windows (with WSL or Git Bash):

```bash
# Connect to the labs
ssh -p <YOUR_PORT> level0@<SERVER_IP>

# Example:
ssh -p 2220 level0@203.0.113.100
```

### Step 2: Enter Your Password

You'll be prompted for a password. Use the initial password provided by your instructor.

```
Password: ___________
```

### Step 3: Success!

You should now see a command prompt:

```
level0@techcorp-server:~$
```

Congratulations! You're connected to the labs. 🎉

---

## **How the Labs Work**

### The Challenge System

Each level is a real-world infrastructure problem:

1. **Read the Objective**
   ```bash
   cat /opt/labs/level0/OBJECTIVE.txt
   ```
   This tells you what problem to solve.

2. **Solve the Challenge**
   Use your Linux skills to fix the issue (change permissions, create users, configure services, etc.)

3. **Check Your Progress**
   ```bash
   check_level 0
   ```
   This validates whether you solved it correctly.

4. **Get the Password**
   If successful, you'll see:
   ```
   ✓ Level 0 solved!
   Password for level1: abc123xyz
   ```

5. **Advance to the Next Level**
   ```bash
   ssh -p 2220 level1@<SERVER_IP>
   # Use the password shown in step 4
   ```

### Example: Level 0

```bash
# Connected as level0

# Read what needs to be done
$ cat /opt/labs/level0/OBJECTIVE.txt
=== LEVEL 0 → 1: The Permission Audit Begins ===
OBJECTIVE: Change /opt/labs/level0/deploy.log permissions...

# Check the current state
$ ls -l /opt/labs/level0/deploy.log
---------- 1 root root 42 Dec 20 10:00 deploy.log
# (Permissions show 000 = unreadable)

# Try to read it (fails)
$ cat /opt/labs/level0/deploy.log
-bash: /opt/labs/level0/deploy.log: Permission denied

# Fix the permissions (based on objective)
$ chmod 644 /opt/labs/level0/deploy.log

# Verify it's fixed
$ cat /opt/labs/level0/deploy.log
level1_password: abc123xyz

# Check your progress
$ check_level 0
✓ Level 0 solved!
Password for level1: abc123xyz
```

---

## **Lab Overview: 34 Levels, 5 Domains**

### Phase 1: File Permissions & Ownership (Levels 0-6)
Learn how permissions control access to files and directories.
- Change permissions with `chmod`
- Understand owner/group/others
- Work with special permissions (setuid, setgid, sticky bit)
- Use ACLs for granular access control

**Skills you'll learn:**
- `ls -l` (viewing permissions)
- `chmod` (changing permissions)
- `chown` (changing ownership)
- `setfacl` / `getfacl` (ACLs)

### Phase 2: Users & Groups (Levels 7-13)
Create and manage user accounts with proper access controls.
- Create users and groups
- Manage group membership
- Configure password policies
- Set sudo access
- Provision new accounts

**Skills you'll learn:**
- `useradd`, `groupadd`, `usermod`
- `chage` (password aging)
- `visudo` (sudoers configuration)
- User provisioning best practices

### Phase 3: Services & Systemd (Levels 14-20)
Manage system services with systemd.
- Start/stop/enable services
- Configure service dependencies
- Create custom systemd units
- Secure service execution
- Troubleshoot failing services

**Skills you'll learn:**
- `systemctl` (service management)
- `journalctl` (log viewing)
- systemd unit files
- Service security and hardening

### Phase 4: Networking & Firewall (Levels 21-27)
Configure network interfaces and implement firewalling.
- Configure static IPs with netplan
- Set DNS and hostname
- Implement firewall rules with iptables
- Filter traffic by source/destination
- Troubleshoot connectivity issues

**Skills you'll learn:**
- `ip`, `ifconfig` (network configuration)
- `netplan` (modern network config)
- `iptables` (firewall rules)
- Network troubleshooting tools

### Phase 5: Storage & Filesystems (Levels 28-33)
Manage disks, partitions, and filesystems.
- Partition disks with fdisk/parted
- Create filesystems (ext4, etc.)
- Mount filesystems persistently
- Use LVM for flexible storage
- Manage disk space and backups

**Skills you'll learn:**
- `fdisk`, `parted` (partitioning)
- `mkfs` (filesystem creation)
- `mount` (mounting filesystems)
- `lvm` (logical volumes)
- `tar` (backups)

### Capstone: Audit & Remediation (Level 33)
Synthesize all five domains in a comprehensive infrastructure audit.

---

## **Getting Help**

### Commands Reference

Once connected, you have man pages:

```bash
# View detailed documentation
man chmod      # How to use chmod
man systemctl  # How to use systemctl
man iptables   # How to use iptables

# Quick help
chmod --help
systemctl --help
```

### Key Tools

- **`ls -l`**: View file permissions
- **`whoami`**: Check current user
- **`id`**: View user/group info
- **`sudo`**: Run commands as superuser
- **`journalctl`**: View system logs
- **`systemctl`**: Manage services
- **`check_level`**: Check if you solved a level

### Getting Stuck?

1. **Re-read the objective carefully**
   ```bash
   cat /opt/labs/levelN/OBJECTIVE.txt
   ```

2. **Check the hints**
   The objective file has 1-2 hints to point you in the right direction.

3. **Use man pages and research**
   ```bash
   man chmod
   man systemctl
   ```

4. **Verify your solution step-by-step**
   ```bash
   ls -l /path/to/file     # Check current state
   # Make changes
   ls -l /path/to/file     # Verify changes
   check_level N           # Validate
   ```

5. **Ask your instructor**
   If you're still stuck, reach out for clarification (without spoiling the solution).

---

## **Important Notes**

### ⚠️ Do NOT

- Try to find passwords in validation scripts (they're not readable anyway)
- Modify /etc/sudoers without using `visudo` (you'll lock yourself out)
- Use `rm -rf /` or similar destructive commands
- Try to cheat by looking at source code (the validation is encrypted)

### ✅ DO

- Ask questions if objectives are unclear
- Test your understanding with `man` pages
- Try multiple approaches to problems
- Help classmates learn (without giving answers)
- Document what you learn (it helps retention)

---

## **Tips for Success**

1. **Take your time**
   These labs are designed to teach, not to race. Each level should take 30-60 minutes.

2. **Understand, don't memorize**
   Focus on *why* commands work, not just memorizing commands.

3. **Make mistakes**
   The safest place to break things is in a lab! Experiment and learn.

4. **Read error messages**
   Linux error messages are usually helpful. Read them carefully!

5. **Document your learning**
   Keep notes on what each level teaches. This becomes your study guide.

6. **Test before moving on**
   Don't just guess the password. Verify you actually solved the challenge.

---

## **Keyboard Shortcuts**

Once connected via SSH:

| Shortcut | Action |
|----------|--------|
| `Ctrl + C` | Cancel current command |
| `Ctrl + D` | Logout / Exit |
| `Ctrl + L` | Clear screen |
| `Up Arrow` | Previous command |
| `Ctrl + R` | Search command history |
| `Tab` | Autocomplete |

---

## **Troubleshooting**

### Can't connect?

```bash
# Check server status
ping <SERVER_IP>

# Try explicit port and verbosity
ssh -v -p 2220 level0@<SERVER_IP>

# Check firewall (on your machine)
# Port 2220 should be accessible to your network

# Contact instructor if server is down
```

### Connection drops?

```bash
# SSH will auto-reconnect, but you can also:
ssh -p 2220 level0@<SERVER_IP>  # Reconnect
```

### Forgot your password?

```bash
# Contact your instructor
# They can reset your password to an initial value
```

### Container seems broken?

```bash
# Contact instructor - they can restart your container
# Your progress is saved in persistent storage
```

---

## **Course Structure**

| Phase | Levels | Focus | Hours |
|-------|--------|-------|-------|
| Permissions | 0-6 | File security | 6-8 |
| Users | 7-13 | Account management | 6-8 |
| Services | 14-20 | Service management | 6-8 |
| Networking | 21-27 | Network & firewall | 7-10 |
| Storage | 28-33 | Disk management | 6-8 |
| Capstone | 33 | Comprehensive audit | 2-3 |
| **Total** | **34** | **Full stack** | **33-45** |

Estimated completion: **2-3 weeks** working 2-3 hours/day

---

## **What You'll Be Able To Do After**

✓ Manage file permissions and access control  
✓ Provision and manage user accounts  
✓ Deploy and troubleshoot system services  
✓ Configure networking and firewalls  
✓ Manage storage and backups  
✓ Troubleshoot system issues via command line  
✓ Understand Linux best practices  
✓ Work effectively in any Linux environment  

---

## **Questions?**

Reach out to your instructor or TA:
- Name: [Instructor Name]
- Email: [Instructor Email]
- Office Hours: [Time]

Good luck! 🚀

---

**Last Updated:** December 2025  
**Course:** TechCorp Sysadmin Fundamentals  
**Version:** 1.0  
