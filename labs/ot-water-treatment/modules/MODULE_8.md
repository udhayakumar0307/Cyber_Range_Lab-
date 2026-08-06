# Module 8: Intrusion Detection -- Coils

**NARRATIVE:**
"We've done enough damage. Now let's switch sides." Your team leader pulls up a fresh terminal. "Imagine you're the plant's security analyst. You just got an alert that someone may have tampered with the system. Your job: figure out WHAT was changed."

Welcome to the defense side. Time to think like an investigator.

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Read all coil values from the PLC
- [ ] Compare them against the expected default state
- [ ] Count how many coils have been modified

---

## LEARNING CONCEPTS

**Baseline Analysis**
Every OT system has a "known good" state. When an incident occurs, the first step is comparing current state against baseline. Any deviation is evidence of tampering.

**OT Forensics**
Unlike IT forensics (disk images, log files), OT forensics involves reading PLC memory in real time. The evidence is volatile. If you restart the PLC, the evidence is gone.

**Hints (Progressive)**

Hint 1: Use `read_coils.py` to read all coil values. The default state has all pumps ON (True) and emergency OFF (False).

Hint 2: Compare what you read against the defaults. How many coils are NOT what they should be?

---

## SUBMIT YOUR EVIDENCE

1. **The number of coils that differ from their default state** (this is your flag)

**Module 8 Flag Format:** An integer

---

## NOTES

- **Time Estimate:** 15 minutes
- **Difficulty:** Hard
- **Prerequisite:** Modules 4-6 (you need to have modified the system first)
- **Tools:** `python3`, `pymodbus`, `/tools/scripts/read_coils.py`
