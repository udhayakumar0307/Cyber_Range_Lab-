# Module 2: Protocol Identification

**NARRATIVE:**
"Good, you found the Master PLC. Now, what protocol does it use for inter-PLC communication?" Your team leader points at the Wireshark capture. "Modbus TCP is the standard in railway systems. What port does it use?"

---

## OBJECTIVES
- [ ] Identify the standard Modbus TCP port
- [ ] Verify it by checking network configuration or captures

## LEARNING CONCEPTS
Modbus TCP runs on a well-known port that has been the industry standard since 1979. Every OT security professional needs to know this number by heart.

**Hints:**
- Hint 1: This is the default Modbus TCP port. It is a well-known number in the ICS world.
- Hint 2: Check the docker-compose.yml for port mappings, or Google "Modbus TCP default port."

## SUBMIT YOUR EVIDENCE
**Flag:** The Modbus TCP port number

## NOTES
- Time Estimate: 5-10 minutes
- Difficulty: Easy
- Tools: Research, docker-compose.yml
