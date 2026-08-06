# Module 7: Stealthy Register Tampering

**NARRATIVE:**
"Here's the thing about real attackers," your team leader explains. "They don't just break things. They understand the protocol at a deep level. A script kiddie runs someone else's tool. A real penetration tester understands every byte on the wire."

Time to prove you understand the protocol, not just the tools.

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Understand how pymodbus commands map to raw Modbus frames
- [ ] Identify the exact function code used when writing a single register
- [ ] Verify your answer using Wireshark packet captures

---

## LEARNING CONCEPTS

**From Python to Protocol**
When you run `c.write_register(0, 99)` in Python, pymodbus constructs a Modbus TCP frame with a specific function code. That frame travels across the network as raw bytes. Wireshark can capture and decode it.

**Why Protocol Knowledge Matters**
IDS (Intrusion Detection Systems) for OT networks analyze raw Modbus frames. If you know the function codes, you can write custom detection rules. This is the bridge between offensive and defensive security.

**Hints (Progressive)**

Hint 1: Open Wireshark at http://localhost:3001, run a write_register command, and filter by `mbtcp`.

Hint 2: Look at the "Function Code" field in the Modbus layer of the captured packet.

Hint 3: Write Single Register is function code 6, or `0x06` in hexadecimal.

---

## SUBMIT YOUR EVIDENCE

1. **The function code for Write Single Register in hex format** (this is your flag)

**Module 7 Flag Format:** A hex value (e.g., `0x06`)

---

## NOTES

- **Time Estimate:** 15-20 minutes
- **Difficulty:** Hard
- **Prerequisite:** Module 4
- **Tools:** Wireshark (http://localhost:3001), `python3`, `pymodbus`
