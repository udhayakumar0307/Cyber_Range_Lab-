# Module 3: Register Mapping

**NARRATIVE:**
"We know where the PLC is and how it talks. Now let's see what it knows." Your team leader leans in. "Read every register. Map the entire memory. Somewhere in there is a marker value the plant engineers left behind. Find it."

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Connect to the PLC using Python and pymodbus
- [ ] Read all holding registers from the PLC
- [ ] Identify the hidden marker value planted by the engineers

---

## LEARNING CONCEPTS

**Reading PLC Memory**
Using the `pymodbus` library, you can connect to the Modbus server and read its registers programmatically. This is exactly what SCADA systems do every few seconds to update their dashboards.

**Why This Matters**
An attacker who can read registers knows the current state of the physical process: tank levels, pump speeds, chemical concentrations. This intelligence is critical before launching an attack.

**Hints (Progressive)**

Hint 1: There is a pre-built script at `/tools/scripts/read_registers.py` that reads all registers.

Hint 2: Run the script and look for a value that stands out. Engineers often use recognizable "marker" values like 31337 or 1337.

---

## SUBMIT YOUR EVIDENCE

1. **The hidden marker value** (this is your flag)

**Module 3 Flag Format:** An integer

---

## NOTES

- **Time Estimate:** 15-20 minutes
- **Difficulty:** Medium
- **Prerequisite:** Module 1 and 2
- **Tools:** `python3`, `pymodbus`, `/tools/scripts/read_registers.py`
