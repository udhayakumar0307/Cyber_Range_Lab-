# Module 1: Network Reconnaissance

**NARRATIVE:**
Your team leader opens a map of NorthRail's infrastructure. "The railway runs on a Master-Slave PLC architecture. The Master PLC coordinates three track segments. Find it. Modbus TCP, port 502. But there's also a REST API running on the Master for remote management. Find that too."

---

## OBJECTIVES
- [ ] Discover the Master PLC's internal IP address
- [ ] Understand the Master-Slave architecture

## LEARNING CONCEPTS
The Master PLC sits on the OT network (172.25.x.x) and manages three Slave PLCs, one per track segment. It exposes both a Modbus TCP interface (port 502) and a REST API (port 8085).

**Hints:**
- Hint 1: Use Wireshark to capture traffic and identify the internal Docker IPs.
- Hint 2: Filter HTTP traffic in Wireshark. The Master PLC's IP will appear as the destination.
- Hint 3: Check the docker-compose.yml for static IP assignments.

## SUBMIT YOUR EVIDENCE
**Flag:** The Master PLC's IP address (e.g., `172.25.x.x`)

## NOTES
- Time Estimate: 10-15 minutes
- Difficulty: Easy
- Tools: Wireshark, `nmap`
