# Module 6: Chemical Dosing Sabotage

**NARRATIVE:**
"This is the one that keeps water plant operators awake at night." Your team leader's voice drops. "Chlorine dosing is what makes water safe to drink. If an attacker disables the chlorine pump, the water flowing to homes is untreated. Nobody would know until people start getting sick."

---

## OBJECTIVES

By the end of this module, you will:
- [ ] Identify the coil that controls chlorine dosing
- [ ] Disable the chlorine dosing pump
- [ ] Observe the chlorine level drop on the SCADA dashboard
- [ ] Report the final chlorine level

---

## LEARNING CONCEPTS

**Chemical Treatment in Water Plants**
Chlorine kills bacteria and pathogens in drinking water. The dosing pump runs continuously, maintaining a safe chlorine level (typically 1-4 ppm). If disabled, the chlorine residual drops to zero over time, and waterborne diseases become a risk.

**The Stuxnet Parallel**
This is conceptually similar to what Stuxnet did to Iranian centrifuges: silently disabling a critical physical process while the operators' screens still showed "everything normal."

**Hints (Progressive)**

Hint 1: Coil address 3 controls the chlorine dosing pump.

Hint 2: Set coil 3 to `False` to disable it, then watch the SCADA dashboard for 30 seconds.

---

## SUBMIT YOUR EVIDENCE

1. **The chlorine level after 30 seconds of disabled dosing** (this is your flag)

**Module 6 Flag Format:** An integer

---

## NOTES

- **Time Estimate:** 15-20 minutes
- **Difficulty:** Hard
- **Prerequisite:** Module 5
- **Tools:** `python3`, `pymodbus`, SCADA dashboard
