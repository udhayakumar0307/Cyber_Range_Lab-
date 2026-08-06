# 🕵️ Module 1: Network Reconnaissance — Port Discovery

**NARRATIVE:**  
Your manager slides a note across the desk. "TechCorp hired us. IP is 10.10.0.10. I need to know what they're running. Every. Single. Service. You have 30 minutes."

This is your first real task. Network reconnaissance is the foundation of every penetration test. Before you can exploit anything, you need to map the landscape.

---

## 🎯 OBJECTIVES

By the end of this module, you will:
- [ ] Confirm the target is reachable
- [ ] Discover all open ports on 10.10.0.10
- [ ] Identify at least 5 running services
- [ ] Connect to the FTP service anonymously
- [ ] Retrieve the flag from the FTP server

---

## 📚 LEARNING CONCEPTS

**What is Port Scanning?**  
A port scan sends network requests to determine which services are running and listening. Think of it like knocking on doors in an office building to find which ones are open.

**Why Does FTP Matter?**  
FTP (File Transfer Protocol) often allows anonymous access on misconfigured systems. If you can connect, you might find configuration files, credentials, or hints about the broader system.

**Hints (Progressive)**

💡 **Hint 1 (Thinking):** How do you discover what services are running on a remote machine? What tools exist for this?

💡 **Hint 2 (Strategy):** FTP typically listens on a well-known port. What is it? And when connecting, which username might allow anonymous access?

💡 **Hint 3 (Execution):** After connecting anonymously to FTP, explore what files are available. Look for anything labeled "README" or "flag" — but also think: what other files might hint at the next part of your investigation?

---

## 🔍 WHAT YOU'LL DISCOVER

When you successfully complete this module, you'll find a flag in the FTP server. But more importantly, **you'll discover a hint** that points you toward Module 2.

**Module 1 Flag Format:**
```
FLAG{techcorp_lab1_mod1_[studentid]_[hash]}
```

**Hidden Hint in FTP:**  
When you retrieve files from FTP, look for a file or message that mentions the next step. It will reference a database or credentials—this is your bridge to Module 2.

---

## ✅ SUBMIT YOUR EVIDENCE

The scoring system needs proof you actually did the work:

1. **Number of open ports discovered** (integer)
2. **List of port numbers** (comma-separated, e.g., "21,22,80,...")
3. **The FTP service software** (e.g., "vsftpd", "Pure-FTPd")
4. **Your flag** (from FTP server)

Even if you know the flag, you won't complete this module without proving you found the ports, connected to FTP, and retrieved the file yourself.

---

## 📝 NOTES

- **Time Estimate:** 20-30 minutes
- **Difficulty:** ⭐ Trivial
- **Prerequisite:** None (this is Module 1!)
- **Tools You'll Need:** Network tools (nmap, ftp client, etc.)

---

## 🚀 NEXT STEPS

Once you capture this flag, Module 2 will unlock. But don't rush—the hint you find here is crucial for what comes next.