# Module 6: Safety Interlock Bypass

**NARRATIVE:**
"The PLC has safety interlocks that prevent dangerous track configurations." Your team leader draws two tracks converging at a junction. "Two trains on the same express route through the junction means a head-on collision. The interlock should block this. Your job: trigger the interlock and read exactly WHY it was rejected."

---

## OBJECTIVES
- [ ] Create a conflicting route scenario (two segments on the same express route)
- [ ] Read the rejection response from the PLC
- [ ] Extract the exact `reason` text

## LEARNING CONCEPTS
Safety interlocks are the last line of defense in OT systems. They are hardcoded logic rules that prevent physically dangerous states, regardless of what the operator or attacker commands. Understanding what triggers them is critical for both attackers and defenders.

**Hints:**
- Hint 1: Set Segment 1 to ROUTE_A first. Then try to set Segment 2 to ROUTE_A.
- Hint 2: The response will have `"success": false` and a `"reason"` field.
- Hint 3: The exact reason text is your flag.

## SUBMIT YOUR EVIDENCE
**Flag:** The exact `reason` text from the rejection response

## NOTES
- Time Estimate: 15-20 minutes
- Difficulty: Hard
- Tools: `curl`
