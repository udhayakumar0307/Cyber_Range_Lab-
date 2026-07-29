# Module 4: Pump Manipulation

**NARRATIVE:**
"Time to see if this thing is as vulnerable as we think." Your team leader opens the SCADA dashboard on the big screen. "Write to the pump speed register. Set it to something absurd. Let's see what the operators see."

This is the moment it gets real. You are about to manipulate physical equipment.

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Write a value to the PLC's pump speed register using pymodbus
- [ ] Observe the flow anomaly appear on the SCADA dashboard
- [ ] Count the number of alarms triggered by your manipulation

---

## LEARNING CONCEPTS

**Writing to Registers**
Just as you read registers in Module 3, you can write to them. The PLC will accept the new value without question because Modbus has no authentication.

**Physical Consequences**
When you change the pump speed register, the simulated pump actually changes speed. The SCADA dashboard will show flow rate anomalies, and the alarm system will trigger. In a real plant, this could cause pipe bursts or equipment damage.

**Hints (Progressive)**

Hint 1: Use `pymodbus` to write a value to register address 0. Try setting it to 99.

Hint 2: After writing the value, watch the SCADA dashboard at http://localhost:3000 for 10-15 seconds. Count the alarms.

Hint 3: `c.write_register(0, 99)` -- register 0 controls pump speed.

---

## SUBMIT YOUR EVIDENCE

1. **The number of alarms triggered** (this is your flag)

**Module 4 Flag Format:** A single integer

---

## NOTES

- **Time Estimate:** 15-20 minutes
- **Difficulty:** Medium
- **Prerequisite:** Module 3
- **Tools:** `python3`, `pymodbus`
