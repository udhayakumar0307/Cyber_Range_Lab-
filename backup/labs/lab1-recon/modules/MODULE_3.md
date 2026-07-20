# 🔓 Module 3: API Discovery — Hidden Service Investigation

**NARRATIVE:**  
Your manager leans back in their chair. "That database is useful. But here's the thing: they're running something else. Something not on the common ports. Port 80, 22, 3306—those are expected. But a company like TechCorp isn't running just the obvious stuff. There's always something hidden. Find it."

Criminals and defenders both know: hide services on non-standard ports. Your job is to look beyond the usual suspects.

---

## 🎯 OBJECTIVES

By the end of this module, you will:
- [ ] Understand why comprehensive port scanning matters
- [ ] Discover a service running on a non-standard port
- [ ] Identify what service is running there
- [ ] Explore its API or capabilities
- [ ] Extract sensitive information from hidden endpoints
- [ ] Find the flag (an API key)

---

## 📚 LEARNING CONCEPTS

**What are Non-Standard Ports?**  
Ports 1-1024 are "well-known" (SSH on 22, HTTP on 80, etc.). Ports above 1024 are rarely scanned by default tools. Administrators sometimes hide services here thinking "security through obscurity" will protect them.

**API Endpoints as Information Disclosure:**  
Web APIs often expose endpoints like `/debug`, `/status`, `/config` that leak system information. A pentester's job is to find and enumerate these endpoints.

**The Hint from Module 2:**  
The database you accessed in Module 2 likely contained hints. Did you see:
- References to an "internal API"?
- Mentions of port numbers?
- Configuration entries about additional services?

**Use these clues now.**

---

## 🔍 DISCOVERY PATH

### Step 1: Full Port Range Scan
You did a basic scan in Module 1 (ports 1-1000 or top common ports). Now: **expand your scan**.

**Hint:** Scan all 65,535 ports. Yes, this takes time. But imagine you're a real pentester—finding that hidden service could be the difference between a successful breach and nothing.

**Hint 2:** Look for ports between 8000-9000. That's a common range for developers to hide internal services.

### Step 2: Identify the Service
Once you find an open port (other than 21, 22, 80, 3306), determine what's running there:
- Connect with `netcat` or `telnet`
- Check the banner (does it say anything?)
- Try HTTP requests with `curl`
- Look for API-like responses

**Hint:** The service might respond to HTTP requests, even if it's on a non-standard port.

### Step 3: Enumerate Endpoints
If it's an API:
- Try `/` (root)
- Try `/status`
- Try `/api/`
- Try `/debug`
- Try `/admin`

**Hint:** The `/debug` endpoint often exposes sensitive information that developers forgot to disable.

### Step 4: Extract the Flag
The API likely exposes an endpoint or response that contains your flag. Look for:
- JSON responses with keys like `"api_key"`, `"secret"`, or `"flag"`
- Headers that leak information
- Error messages that reveal structure

**Critical Hint:** APIs designed poorly will expose secrets in their responses. The /debug endpoint is specifically vulnerable.

---

## 🧠 CRITICAL THINKING

⚠️ **This module teaches an important lesson:**  
Developers often create "debug" or "status" endpoints for internal troubleshooting. If left accessible, these become goldmines for attackers.

**Questions to ask yourself:**
- Why would a company have a `/debug` endpoint?
- What information would you want to leak if you were debugging?
- How would an attacker misuse that?

---

## ✅ SUBMIT YOUR EVIDENCE

1. **Hidden port discovered** (the port number)
2. **Service type running on that port** (e.g., "HTTP API", "Flask", etc.)
3. **Endpoint where you found the flag** (e.g., "/debug")
4. **The API key / flag** (extracted from the response)

---

## 📝 NOTES

- **Time Estimate:** 25-35 minutes
- **Difficulty:** ⭐⭐ Medium
- **Prerequisite:** Module 2 (you need the hints about what to look for)
- **Tools:** `nmap` (full range), `curl`, `netcat`, `bash`, or browser

---

## ⚠️ TROUBLESHOOTING

**Full port scan is slow:**  
Use `nmap -p- 10.10.0.10 -T4` to speed it up (aggressive timing).

**I found a port but can't connect:**  
Make sure the port is actually open. Re-run your scan to confirm. Also, try both TCP and UDP (`-sU`).

---

## 🚀 NEXT STEPS

The API you found likely exposes more than just the flag. It probably reveals:
- **Usernames and roles** of employees
- **Hint about credential storage** (e.g., where backup keys are kept)
- **Paths to sensitive files** (e.g., `/home/backup/` or `/home/tcbackup/`)

These will guide you toward Module 4: Credential Discovery.