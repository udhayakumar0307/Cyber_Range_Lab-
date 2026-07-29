# Lab: OT Water Treatment Plant Attack
## AquaShield Security Assessment — ClearWater Municipal Utilities

---

## Your Mission

You've been contracted by **AquaShield**, a critical infrastructure security firm. ClearWater Municipal Utilities runs a small-scale water treatment plant controlled by an industrial PLC (Programmable Logic Controller) using the Modbus TCP protocol.

Your job: **assess the security of this OT environment**. Map the network, understand the protocols, exploit the vulnerabilities, and prove that an attacker on the network can manipulate physical water treatment processes.

Target Network: `172.28.0.0/16`

---

## Getting Started

### 1. Launch the lab

```bash
docker-compose up --build -d
```

Wait about 60 seconds for the plant simulation to initialize.

### 2. Enter your workstation

```bash
docker exec -it lab-ot-water-student bash
```

You'll land in a **Kali Linux environment** with all tools pre-installed, including `nmap`, `python3`, and the `pymodbus` library.

### 3. Open the scoring dashboard

In your browser: **http://localhost:5000**

This is where you submit flags and watch your score update in real time.

### 4. Open the SCADA Dashboard

In another browser tab: **http://localhost:3000**

This is the operator's view of the water treatment plant. Watch it as you attack.

---

## The 10 Modules

Work through these in order. Each phase builds on the last.

### Phase 1: Reconnaissance

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 1 | Network Recon | Easy | 100 |
| 2 | Protocol Identification | Easy | 100 |
| 3 | Register Mapping | Medium | 150 |

### Phase 2: Exploitation

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 4 | Pump Manipulation | Medium | 200 |
| 5 | Emergency Shutdown | Medium | 200 |
| 6 | Chemical Dosing Sabotage | Hard | 250 |
| 7 | Stealthy Register Tampering | Hard | 250 |

### Phase 3: Defense and Recovery

| Module | Challenge | Difficulty | Points |
|--------|-----------|------------|--------|
| 8 | Intrusion Detection (Coils) | Hard | 200 |
| 9 | Intrusion Detection (Registers) | Hard | 200 |
| 10 | Incident Response | Expert | 350 |

Read each module's brief in `/modules/` inside the student container, or browse them at `http://localhost:5000/modules/`.

---

## Submitting Flags

Flags are specific values you discover through the challenges (IP addresses, register values, function codes, etc.).

**Option A -- Web UI (recommended):** Go to http://localhost:5000

**Option B -- Terminal:**

```bash
python3 /opt/tools/submit_flag.py <module_number> "<your_flag>"
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
| `python3` | Scripting (pymodbus pre-installed) |
| `curl` | HTTP requests |
| `nc` (netcat) | General TCP connections |
| `pymodbus` | Python library for Modbus TCP communication |
| `/opt/tools/submit_flag.py` | Flag submission from terminal |

---

## Tips

- **Watch the SCADA dashboard** while you attack. You'll see physical changes in real time.
- **Modbus has no authentication.** If you can reach the PLC, you can control it.
- **Take notes.** Module 10 requires knowledge from all earlier modules.
- **Wireshark is available** at http://localhost:3001 for packet capture analysis.

---

## Resetting the Lab

```bash
docker-compose down -v
docker-compose up --build -d
```

---

## Questions?

Ask your instructor. Explaining your approach to a classmate is the best way to learn -- just don't share the flag values themselves.
