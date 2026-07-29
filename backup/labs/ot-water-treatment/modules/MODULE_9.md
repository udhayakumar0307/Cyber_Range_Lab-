# Module 9: Intrusion Detection -- Registers

**NARRATIVE:**
"Coils are just half the picture," your team leader says. "The registers hold the real operational data. Pump speeds, tank levels, chemical concentrations. If an attacker changed any of these, you need to find every single one."

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Read all holding register values from the PLC
- [ ] Identify which registers have been tampered with
- [ ] Count the total number of modified registers

---

## LEARNING CONCEPTS

**Register Tampering is Stealthy**
An attacker who changes a register value by a small amount might not trigger alarms. For example, reducing chlorine by 10% might go unnoticed for hours but could affect water safety. This is why baseline comparison is essential.

**Hints (Progressive)**

Hint 1: Use the read_registers.py script to dump all register values.

Hint 2: Compare against known defaults. Count every register that does not match.

---

## SUBMIT YOUR EVIDENCE

1. **The total number of registers that differ from their default state** (this is your flag)

**Module 9 Flag Format:** An integer

---

## NOTES

- **Time Estimate:** 15 minutes
- **Difficulty:** Hard
- **Prerequisite:** Module 8
- **Tools:** `python3`, `pymodbus`, `/tools/scripts/read_registers.py`
