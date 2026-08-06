# Module 5: Emergency Shutdown

**NARRATIVE:**
"Now let's go nuclear." Your team leader looks grim. "There's a coil in the PLC dedicated to emergency shutdown. If an attacker flips that coil, the entire plant stops. Pumps off. Treatment halted. Water stops flowing to the city. Find the emergency coil and trigger it."

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Understand the difference between writing coils and writing registers
- [ ] Identify the emergency shutdown coil address
- [ ] Trigger the emergency shutdown
- [ ] Observe the plant halt on the SCADA dashboard
- [ ] Read the pump speed value after shutdown

---

## LEARNING CONCEPTS

**Coils are ON/OFF Switches**
Unlike registers (which hold numbers), coils are booleans. `True` = ON, `False` = OFF. Emergency shutdowns, pump enables, and valve controls are typically coils.

**Why This Is Devastating**
An emergency shutdown in a real water plant means no water treatment, no distribution, and potential public health emergencies. The Modbus protocol provides zero protection against unauthorized writes.

**Hints (Progressive)**

Hint 1: Coil address 4 is the emergency shutdown coil. Setting it to `True` triggers the shutdown.

Hint 2: After triggering the shutdown, read register 0 (pump speed). What value does it show?

---

## SUBMIT YOUR EVIDENCE

1. **The pump speed value after emergency shutdown** (this is your flag)

**Module 5 Flag Format:** An integer

---

## NOTES

- **Time Estimate:** 15 minutes
- **Difficulty:** Medium
- **Prerequisite:** Module 4
- **Tools:** `python3`, `pymodbus`
