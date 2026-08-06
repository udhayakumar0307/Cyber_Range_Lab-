# 🗄️ Module 2: Service Fingerprinting — Database Access

**NARRATIVE:**  
Your manager reviews your port list. "Good start. But versions. I need to know what they're running, not just that ports are open. And that database you found—let's see if we can get into it. Weak credentials on databases are everywhere."

Now you know *what* ports exist. The next step: understanding *what's running* on them. And more importantly: can you authenticate?

---

## 🎯 OBJECTIVES

By the end of this module, you will:
- [ ] Use version detection techniques to identify service software
- [ ] Determine the exact version of the database service
- [ ] Discover default or weak credentials for database access
- [ ] Connect to the database using those credentials
- [ ] Query the database and extract sensitive data
- [ ] Find the flag hidden in database records

---

## 📚 LEARNING CONCEPTS

**What is Service Fingerprinting?**  
Services often broadcast their version in banners or headers. SSH says "OpenSSH 7.4". MySQL says "MySQL 5.7.31". This intel is valuable: each version has known vulnerabilities.

**Why Connect to Databases?**  
Databases store sensitive data: credentials, configuration, secrets. If you can authenticate, you have access to organizational intelligence.

**The Hint from Module 1:**  
In Module 1, you found an FTP server with files. Those files contained hints—possibly usernames, passwords, or configuration details. **Use that information now.**

---

## 🔍 DISCOVERY PATH

### Step 1: Service Version Detection
After your basic port scan in Module 1, try scanning again with version detection enabled. Look for the database service (port 3306 typically). What version is it running?

**Hint:** Try techniques like banner grabbing or nmap's version scanning. What headers does the service send?

### Step 2: Finding Credentials
In Module 1, you accessed the FTP server anonymously. Were there configuration files? README files? Messages? 

**Hint:** Administrators often leave hints in `README` files, `config.txt`, or messages left for staff. Look for usernames and passwords that might work on the database.

**Hint 2:** Some databases allow connections without authentication (default users with no password). Try:
- `scanner` user (no password)
- Connection from the local network (10.10.0.0/24) might have reduced restrictions

### Step 3: Database Queries
Once connected, explore the database schema:
- What tables exist?
- What data is in them?
- Is there a "config" table with secrets?
- Is there an "employees" table with credentials or hints?

**Look for:** Flags in database records, hints about next modules, credentials for other services.

---

## 🧠 CRITICAL THINKING

⚠️ **This module introduces a key security concept:**  
Databases often leak flags, API keys, and credentials in their records. A penetration tester's job is to query strategically and extract valuable data.

**Questions to ask yourself:**
- Which table might contain an admin flag?
- Are there any suspicious columns (like `secret_note` or `api_key`)?
- Do the credentials you find hint at other services or modules?

---

## ✅ SUBMIT YOUR EVIDENCE

1. **Database connection method** (username used, any password if applicable)
2. **MySQL/Database version string** (exact version)
3. **Name of the table where you found the flag**
4. **Number of records in that table** (proves you queried it)
5. **Your flag** (from the database)

---

## 📝 NOTES

- **Time Estimate:** 20-30 minutes
- **Difficulty:** ⭐ Easy
- **Prerequisite:** Module 1 (you need the FTP credentials/hints)
- **Tools:** `mysql` client, `nmap -sV`, or `curl`/`nc` for banner grabbing

---

## 🚀 NEXT STEPS

The database contains more than just your flag. Look carefully at what you discover:

- **What service is mentioned in the records?**
- **What credentials are stored?**
- **What hints about future modules are in the data?**

These will point you toward Module 3: Hidden Service Discovery.