# 👑 Module 5: Full Network Infiltration — Admin Console Access

**NARRATIVE:**  
Your manager reviews your findings. "Excellent work. Ports. Versions. Databases. System access. Now for the crown jewel. There's one more service—something for administrators only. It's hidden, protected, and contains the final secret about TechCorp's infrastructure. Use everything you've learned to access it."

This is the capstone. You must synthesize everything: network reconnaissance, service discovery, credential harvesting, and authentication. One final barrier stands between you and complete network access.

---

## 🎯 OBJECTIVES

By the end of this module, you will:
- [ ] Discover a hidden administrative service
- [ ] Identify how to authenticate to it
- [ ] Use credentials from previous modules
- [ ] Successfully authenticate
- [ ] Extract the final flag
- [ ] Understand the full attack chain

---

## 📚 LEARNING CONCEPTS

**Service Layering:**  
Large systems often have multiple layers of access:
1. **Public Services** (Web servers, file servers)
2. **Internal Services** (Databases, APIs)
3. **Administrative Services** (Admin consoles, management interfaces)

Each layer requires increasingly sophisticated authentication and discovery.

**Synthesis Over Memorization:**  
This module doesn't teach new techniques—it requires you to *apply* what you've learned across all five modules:
- Port scanning (Module 1)
- Service fingerprinting (Module 2)
- API discovery (Module 3)
- Credential harvesting (Module 4)
- And now: bringing it all together

---

## 🔍 DISCOVERY PATH

### Step 1: Find the Hidden Service
You've scanned ports in previous modules. But have you found *everything*?

**Hint:** A full port scan reveals all listening services. If you haven't done a comprehensive scan yet, now is the time.

**Hint 2:** The administrative console is intentionally hidden on a non-standard port. It's not 80, 22, 3306, or 9000. It's somewhere else.

**Hint 3:** If you found hints in Module 4 about "admin console" or a specific port number, use that.

### Step 2: Connect to the Service
Once you've identified the port, connect to it:

```bash
# Using netcat to connect
nc [target_ip] [port]

# Or telnet
telnet [target_ip] [port]
```

**What to expect:**
- The service will send a banner or prompt
- You might see commands listed
- Authentication will likely be required

**Hint:** Look at the banner carefully. It will tell you what service this is and what commands are available.

### Step 3: Identify Authentication Requirements
The service will likely require authentication before you can proceed.

**Hint:** What credentials have you discovered across all five modules?
- Database usernames and passwords (Module 2)
- System usernames (Module 4)
- Backup account credentials (Module 4)
- Admin usernames from the API (Module 3)

**Critical Thinking:** Which credential would an *administrator* use? What password would protect an *admin console*?

### Step 4: Find the Admin Password
The admin password is NOT stored in the admin service itself. It's discoverable through previous modules:

**Possible Locations:**
- A configuration file you found in Module 4 (the system you accessed)
- A hint in a file you read (`.bashrc`, `.notes`, `/etc/config`)
- A password stored in the database (Module 2)
- A hint from the API (Module 3)
- A README or notes from FTP (Module 1)

**Hint:** Look for files like:
- `/home/[user]/.config/admin.conf`
- `/home/[user]/.notes`
- `/home/[user]/.secret_admin_password`
- Hints in the database `config` table

**Ultimate Hint:** The password is *not* random. It's discoverable by carefully reviewing everything you've found. It might be in a configuration file, a database field, or a system file you accessed.

### Step 5: Authenticate and Extract the Flag
Once you have the password:

```bash
nc [target_ip] [port]
> auth
Enter admin password: [password]
Authentication successful.
> flag
Admin flag: FLAG{techcorp_lab1_mod5_[studentid]_[hash]}
```

---

## 🧠 CRITICAL THINKING

⚠️ **This module teaches full attack chain awareness:**

An attacker doesn't just guess passwords. They:
1. Gather intelligence (recon)
2. Identify targets (scanning)
3. Analyze vulnerabilities (fingerprinting)
4. Extract credentials (data harvesting)
5. Authenticate and escalate (exploitation)

Each step depends on previous steps. This lab mirrors that real-world progression.

**Reflection Questions:**
- How did you find each piece of information?
- Which module was most critical?
- What would an administrator have done to prevent this?

---

## ✅ SUBMIT YOUR EVIDENCE

1. **Hidden service port** (where the admin console runs)
2. **Service type/name** (what is it called?)
3. **Username used for authentication** (likely "admin")
4. **Method/location where you discovered the admin password** (e.g., "Found in /home/backup/.config")
5. **The final flag**

---

## 📝 NOTES

- **Time Estimate:** 30-40 minutes
- **Difficulty:** ⭐⭐⭐ Hard
- **Prerequisite:** ALL previous modules (this is the capstone)
- **Tools:** `nc`, `telnet`, or similar for raw TCP connections

---

## ⚠️ TROUBLESHOOTING

**I can't find the admin password anywhere:**  
- Review the database (Module 2). Did you query the `config` table carefully?
- Review any files you accessed via SSH/FTP (Module 4). Did you read every configuration file?
- Review the API responses (Module 3). Did any hint at an admin password location?

**I found a port but it won't connect:**  
- Make sure it's actually open (re-run nmap to confirm)
- Try different tools: `nc`, `telnet`, `bash`, etc.
- The service might need a specific connection protocol

**I authenticated but can't get the flag:**  
- Did you send the right command? (Try `flag`, `FLAG`, `help`)
- Are you actually authenticated? The service should say "Authentication successful."
- Try other commands to explore what's available.

---

## 🏁 COMPLETION

**Congratulations!**  

You've completed the full attack chain:
1. ✅ Discovered the network (Module 1)
2. ✅ Fingerprinted services (Module 2)
3. ✅ Found hidden services (Module 3)
4. ✅ Harvested credentials (Module 4)
5. ✅ Gained admin access (Module 5)

This mirrors real-world penetration testing. Each step builds on previous discoveries. Each module teaches a fundamental cybersecurity concept.

**What You've Learned:**
- Network reconnaissance and scanning
- Service identification and vulnerability assessment
- Information disclosure vulnerabilities
- Credential harvesting and management
- Authentication mechanisms
- Attack chain synthesis

The attacks you performed here (password discovery, credential use, service enumeration) are exactly what happens in real breaches. Understanding and defending against them is the foundation of cybersecurity.

---

## 🚀 REFLECTION

Before you finish:

1. **What was the hardest part?** Why?
2. **Which vulnerability was most critical?** (If you could only fix one issue, which would it be?)
3. **How would you defend against this attack chain?**
4. **In a real company, where did security fail?**

These answers will deepen your understanding. Share them with your peers if you're in a class setting.