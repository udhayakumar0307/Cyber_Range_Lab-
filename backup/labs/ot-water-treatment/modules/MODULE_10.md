# Module 10: Incident Response -- Fixing the Plant

**NARRATIVE:**
"This is the final test." Your team leader stands up. "You broke it. You analyzed the damage. Now fix it. Restore this plant to safe operating conditions. Every pump back online, every parameter at safe levels. The city needs clean water."

This is the capstone challenge. You need everything you learned in Modules 1-9.

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Clear the emergency shutdown
- [ ] Re-enable all pumps (intake, treatment, distribution, chlorine)
- [ ] Set pump speed to a safe operating level
- [ ] Set chlorine setpoint to a safe level
- [ ] Verify the plant is stable on the SCADA dashboard

---

## LEARNING CONCEPTS

**Incident Response in OT**
In IT, incident response means isolating the machine and reimaging it. In OT, you cannot take the system offline. The water must keep flowing. Recovery means restoring safe parameters while the system continues running.

**Safe Operating Parameters**
- Emergency shutdown coil (4): Must be OFF (False)
- All pump coils (0-3): Must be ON (True)
- Pump speed register (0): Safe operating range is 40-50
- Chlorine setpoint register (5): Safe range is 35-45

**Hints (Progressive)**

Hint 1: You need to write to multiple coils AND registers in the correct order.

Hint 2: Clear emergency first (coil 4 = False), then enable pumps (coils 0-3 = True), then set safe values.

Hint 3: The flag format is: emergency_pumpspeed_chlorine (e.g., 0_45_40 means emergency=off, pump=45, chlorine=40)

---

## SUBMIT YOUR EVIDENCE

1. **The final plant state** in format: `emergencycoil_pumpspeed_chlorinesetpoint` (this is your flag)

**Module 10 Flag Format:** Three values separated by underscores (e.g., `0_45_40`)

---

## NOTES

- **Time Estimate:** 20-30 minutes
- **Difficulty:** Expert
- **Prerequisite:** All previous modules
- **Tools:** `python3`, `pymodbus`, SCADA dashboard for verification
