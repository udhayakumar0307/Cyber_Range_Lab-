# 🔑 Module 4: Credential Harvesting — System Access

**NARRATIVE:**  
Your manager stands up from their desk. "You've got network intel. You've fingerprinted services. You've found hidden APIs. Now comes the hard part: actually getting *in*. Find credentials. Access a system. Prove we can move from network discovery to system compromise."

So far, you've been passive—observing. Now you take action: finding credentials and using them to gain access.

---

## 🎯 OBJECTIVES

By the end of this module, you will:
- [ ] Identify where credentials might be stored or hidden
- [ ] Use discovered information from previous modules to find them
- [ ] Authenticate to a system (SSH, FTP, or other service)
- [ ] Navigate the compromised system and find sensitive files
- [ ] Locate the flag hidden in the system
- [ ] Understand privilege escalation starting points

---

## 📚 LEARNING CONCEPTS

**Credential Discovery Methods:**
1. **From Database Queries** (Module 2): You accessed a database. Did it contain plaintext passwords or hints about where credentials are stored?
2. **From File Systems** (FTP access): Files on FTP servers sometimes contain credentials or hints.
3. **From API Responses** (Module 3): The API might reveal usernames, paths, or hints.
4. **From System Information** (Banners, error messages): Services leak OS type, installed software, user hints.

**Why This Matters:**  
Credentials are the gateway. Once you have them, you can authenticate as a legitimate user—making intrusion much harder to detect.

---

## 🔍 DISCOVERY PATH

### Step 1: Consolidate Your Findings
Review what you've discovered in Modules 1-3:

**From Module 1 (FTP):**
- Did you find a README or configuration file?
- Were there hints about users or servers?

**From Module 2 (Database):**
- Did you see usernames and passwords in the `employees` table?
- Did you see hints about other systems (e.g., "Check /home/tcbackup for backup keys")?
- Were there references to backup locations or admin accounts?

**From Module 3 (API):**
- Did the API reveal usernames or roles?
- Did it mention file paths or directories?
- Were there hints about "sysadmin" or "backup" users?

### Step 2: Identify Credential Storage Locations
Based on hints from Modules 1-3, where might credentials be stored?

**Possibilities:**
- FTP server files (README, config files)
- Database records
- Backup directories (`/home/backup/`, `/home/tcbackup/`)
- SSH configuration files
- Home directories of system users

**Hint:** Look for users mentioned in the database or API responses. Common sysadmin users include: `backup`, `tcbackup`, `admin`, `sysadmin`.

### Step 3: Attempt Authentication
Try accessing systems with credentials you've found:

**Option A: FTP Access**
- Use credentials from the database (you found usernames like `jsmith`, `bjones`, `sysadmin`, etc.)
- Or try default FTP users: `backup`, `tcbackup`

**Option B: SSH Access**
- Try SSH with discovered credentials
- SSH typically requires valid system users (not just DB users)
- Look for hints about which user account is actually available

**Hint:** Not all database users are system users. `admin` in the DB might not be a Linux system account. But `backup` or `tcbackup` might be.

### Step 4: Explore the System
Once you authenticate, explore:
```
ls -la /home/
ls -la /home/[username]/
cat /home/[username]/.ssh/id_rsa     # SSH keys
cat /home/[username]/.bashrc          # Shell config
cat /home/[username]/.secret_key      # Secrets
find /home/[username]/ -type f -name "*flag*"
```

### Step 5: Find the Flag
The flag is hidden in a file on the system. Look for:
- Files with "flag" in the name
- Hidden files (starting with `.`)
- Backup directories
- Configuration files with sensitive notes

**Hint:** The flag might be in a file called `.secret_backup_key` or similar—something that looks like it contains important data.

---

## 🧠 CRITICAL THINKING

⚠️ **This module teaches credential management:**  
- Plaintext passwords in databases = bad
- Passwords in README files = bad
- Shared backup accounts with known credentials = bad
- No file permissions on sensitive files = bad

**Questions to ask yourself:**
- Which user account would an administrator use for backups?
- Where would they store credentials for that account?
- What files might contain secrets?

---

## ✅ SUBMIT YOUR EVIDENCE

1. **System username you authenticated as** (e.g., "backup", "tcbackup", "sysadmin")
2. **Method of access** (SSH, FTP, etc.)
3. **Location of the flag file** (full path, e.g., "/home/tcbackup/.secret_backup_key")
4. **The flag itself**

---

## 📝 NOTES

- **Time Estimate:** 25-35 minutes
- **Difficulty:** ⭐⭐ Medium
- **Prerequisite:** Modules 1-3 (you need the credentials and hints)
- **Tools:** `ssh`, `ftp`, `scp`, file exploration (`ls`, `cat`, `find`)

---

## ⚠️ TROUBLESHOOTING

**I found a username but no password:**  
Review the database (Module 2). Did you see a password for that user? Or did hints point to a default password?

**SSH says permission denied:**  
- You might have the wrong user
- You might have the wrong password
- The user might not have SSH access (try FTP instead)

**I can access FTP but can't find the flag:**  
- List all files: `ls -la` (including hidden files with `-a`)
- Look in subdirectories: `cd pub/` or `cd backup/`
- Remember: the flag is in a *file*, not just displayed to you

---

## 🚀 NEXT STEPS

The system you just accessed likely contains hints about Module 5. Look for:
- Configuration files mentioning "admin console"
- Notes about other services
- Hints about authentication methods
- References to port 8888 or other hidden services

These will guide you toward Module 5: Full Network Infiltration.