# Module 5: Alarm Flooding (DoS)

**NARRATIVE:**
"Real attackers don't just send one command. They flood the system." Your team leader pulls up the SCADA audit log. "Send 50 rapid commands. Watch what happens to the operator's screen. This is how you blind a control room."

---

## OBJECTIVES
- [ ] Send 50 rapid route-switch commands to the PLC
- [ ] Observe the SCADA dashboard audit log being overwhelmed
- [ ] Query `/api/status` and find the total command count

## LEARNING CONCEPTS
Alert Fatigue is a real attack tactic. SOC analysts process thousands of alerts daily. When attackers flood the system with garbage alerts, operators stop reading them, and the real attack hides in the noise.

**Hints:**
- Hint 1: Use a bash loop or the attack script to send 50 commands rapidly.
- Hint 2: After flooding, query the status API. Look at `total_commands`.
- Hint 3: `for i in $(seq 1 50); do curl -s -X POST ... > /dev/null; done`

## SUBMIT YOUR EVIDENCE
**Flag:** The `total_commands` value from `/api/status` after the flood (any number >= 50)

## NOTES
- Time Estimate: 15 minutes
- Difficulty: Medium
- Tools: `curl`, bash scripting
