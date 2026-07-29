# Module 1: Network Reconnaissance

**NARRATIVE:**
You've just arrived at AquaShield's operations center. Your team leader hands you a sticky note: "ClearWater Municipal runs their treatment plant on the 172.28.0.0/16 subnet. Find their PLC. Modbus TCP, port 502. Go."

Before you can attack anything, you need to find it.

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Confirm the target network is reachable
- [ ] Discover the PLC's IP address using a port scan
- [ ] Understand what Modbus TCP is and why port 502 matters

---

## LEARNING CONCEPTS

**What is a PLC?**
A Programmable Logic Controller is a small industrial computer that directly controls physical equipment like pumps, valves, and motors. Unlike IT servers that process data, PLCs process physical reality.

**What is Modbus TCP?**
Modbus is an industrial protocol from 1979. It runs on TCP port 502. It has zero encryption and zero authentication. If you can send a TCP packet to port 502, you can read and write the PLC's memory.

**Hints (Progressive)**

Hint 1 (Thinking): What tool can scan an entire subnet for a specific open port?

Hint 2 (Strategy): You're looking for port 502 on the 172.28.0.0/24 subnet. Narrow your scan.

Hint 3 (Execution): `nmap -sT -p 502 172.28.0.0/24` will find every device with Modbus open.

---

## SUBMIT YOUR EVIDENCE

1. **The IP address of the PLC** (this is your flag)
2. **Number of open ports** you discovered on that host

**Module 1 Flag Format:** An IP address (e.g., `172.28.x.x`)

---

## NOTES

- **Time Estimate:** 10-15 minutes
- **Difficulty:** Easy
- **Prerequisite:** None
- **Tools:** `nmap`, `ping`
