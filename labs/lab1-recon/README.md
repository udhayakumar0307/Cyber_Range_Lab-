# Lab 1: Network Reconnaissance
## SecureGuard Red Team Program — TechCorp Industries

---

## Your Mission

You've just joined **SecureGuard**, a penetration testing firm. TechCorp Industries is your first client — a mid-sized software company with notoriously poor security hygiene. They've given you permission to assess their internal network.

Your job this week: **map everything**.

Target IP: `10.10.0.10`

---

## Getting Started

### 1. Launch the lab

```bash
# Set your student ID (use your actual name/ID — flags are unique to you!)
export STUDENT_ID=yourname
export LAB_SEED=lab1semester1   # instructor will give you this

docker-compose up --build -d
```

### 2. Enter your workstation

```bash
docker exec -it lab1-student bash
```

You'll land in a **Kali Linux environment** with all tools pre-installed.

### 3. Open the scoring dashboard

In your browser: **http://localhost:5000**

This is where you submit flags and watch your score update in real time.

---

## The 5 Modules

Work through these in order — each one builds on the last.

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 1 | Port Discovery & Enumeration | ⭐ | 100 |
| 2 | Service Version Fingerprinting | ⭐ | 150 |
| 3 | Hidden Service Discovery | ⭐⭐ | 200 |
| 4 | Credential Discovery | ⭐⭐ | 250 |
| 5 | Full Network Infiltration *(Capstone)* | ⭐⭐⭐ | 300 |

Read each module's brief:

```bash
cat /modules/module1/CHALLENGE.sh
cat /modules/module2/CHALLENGE.sh
# etc.
```

---

## Submitting Flags

Flags look like: `FLAG{techcorp_lab1_mod1_yourname_a7f3e2c1}`

**Option A — Web UI (recommended):** Go to http://localhost:5000

**Option B — Terminal:**

```bash
python3 /opt/tools/submit_flag.py module1 "FLAG{...}" ports="21,22,80" ftp_anon="yes"
```

**Check your score:**

```bash
score    # alias for the scoring API
```

---

## Tools Available

| Tool | Purpose |
|------|---------|
| `nmap` | Port scanning and service detection |
| `ftp` | FTP client |
| `mysql` | MySQL client |
| `curl` | HTTP requests |
| `nc` (netcat) | General TCP connections |
| `ssh` | SSH client |
| `python3` | Scripting |
| `recon_helper.py` | Guided step-by-step recon assistant |

---

## Tips

- **Read banners.** Services often broadcast their version and OS.
- **Take notes.** Module 5 requires knowledge from all earlier modules.
- **Flags are unique to you.** You can share techniques, not answers.
- **Hints cost 25 points.** Use them if you're stuck, not as a shortcut.
- **Full port scans are slow but necessary.** Add `--min-rate 2000` to nmap.

---

## Resetting the Lab

```bash
docker-compose down -v
STUDENT_ID=yourname docker-compose up --build -d
```

---

## Questions?

Ask your instructor, or post in the class discussion board. Explaining your approach to a classmate is the best way to learn — just don't share the flag values themselves.

Good luck. 🔐
