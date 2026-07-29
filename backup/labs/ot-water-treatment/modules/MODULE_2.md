# Module 2: Protocol Identification

**NARRATIVE:**
"Good, you found the PLC," your team leader says. "Now I need to know how it talks. Modbus uses function codes -- numbered operations that tell the PLC what to do. Before you start writing exploits, you need to understand the language."

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Understand what Modbus function codes are
- [ ] Identify the function code for reading holding registers
- [ ] Understand the difference between coils (booleans) and registers (integers)

---

## LEARNING CONCEPTS

**Modbus Function Codes**
Every Modbus message starts with a function code that tells the PLC what operation to perform:
- Function 1: Read Coils (ON/OFF switches)
- Function 3: Read Holding Registers (numeric values)
- Function 5: Write Single Coil
- Function 6: Write Single Register

**Coils vs Registers**
- **Coils** are like light switches: ON or OFF. They control pumps, valves, and alarms.
- **Registers** are numbers: pump speed, tank level, pressure readings.

**Hints (Progressive)**

Hint 1: The question asks about reading numeric values from the PLC. Which type of data stores numbers?

Hint 2: Holding registers store numeric values. What function code reads them?

---

## SUBMIT YOUR EVIDENCE

1. **The Modbus function code for "Read Holding Registers"** (this is your flag)

**Module 2 Flag Format:** A single integer

---

## NOTES

- **Time Estimate:** 10 minutes
- **Difficulty:** Easy
- **Prerequisite:** Module 1
- **Tools:** Research / documentation reading
