# Lab: OT Railroad North Attack
## IronTrack Security Assessment -- NorthRail Transit Authority

---

## Your Mission

You've been contracted by **IronTrack**, a critical infrastructure security firm. NorthRail Transit Authority operates a three-segment railway system controlled by a Master-Slave PLC architecture. The Master PLC coordinates track switching, signal control, and safety interlocks across all segments.

Your job: **assess the security of this railway OT environment**. Map the control network, exploit the lack of authentication on the SCADA API, manipulate track switches, and prove that an attacker on the network can cause physical rail incidents.

Target: `Master PLC API`

---

## Getting Started

### 1. Launch the lab

```bash
docker-compose up --build -d
```

Wait about 60 seconds for the PLC heartbeat system to initialize.

### 2. Enter your workstation

```bash
docker exec -it lab-ot-rail-student bash
```

You'll land in a **Kali Linux environment** with `curl`, `python3`, `nmap`, and other tools pre-installed.

### 3. Open the scoring dashboard

In your browser: **http://localhost:5000**

### 4. Open the SCADA Dashboard

In another tab: **http://localhost:8081**

This is the train operator's view. Three track segments, signals, barriers, and an audit log. Watch it as you attack.

### 5. Open Wireshark

In another tab: **https://localhost:3001** (click Advanced, then Proceed past the security warning)

---

## The 10 Modules

### Phase 1: Reconnaissance

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 1 | Network Recon | Easy | 100 |
| 2 | Protocol Identification | Easy | 100 |
| 3 | API Endpoint Discovery | Medium | 150 |

### Phase 2: Exploitation

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 4 | Unauthorized Track Switch | Medium | 200 |
| 5 | Alarm Flooding (DoS) | Medium | 200 |
| 6 | Safety Interlock Bypass | Hard | 300 |
| 7 | API Fuzzing | Hard | 300 |

### Phase 3: Forensics and Defense

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 8 | Packet Capture Analysis | Hard | 250 |
| 9 | Emergency Recovery | Medium | 200 |
| 10 | Deep Memory Forensics | Expert | 400 |

---

## Submitting Flags

**Option A -- Web UI (recommended):** Go to http://localhost:5000

**Option B -- Terminal:**

```bash
python3 /opt/tools/submit_flag.py <module_number> "<your_flag>"
```

---

## Tools Available

| Tool | Purpose |
|------|---------|
| `curl` | Send HTTP requests to the PLC API |
| `python3` | Scripting |
| `nmap` | Port scanning |
| `nc` (netcat) | TCP connections |
| Wireshark | Packet capture (browser-based at port 3001) |

---

## Tips

- **Watch the SCADA dashboard** while you attack. Track switches and audit log entries appear in real time.
- **The Master PLC API has zero authentication.** Anyone who can reach it can control the trains.
- **Yellow audit log entries** mean unauthorized API calls were detected.
- **Red entries** mean a safety interlock rejected a dangerous command.

---

## Resetting the Lab

```bash
docker-compose down -v
docker-compose up --build -d
```
