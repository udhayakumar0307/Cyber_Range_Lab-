# Module 10: Deep Memory Forensics

**NARRATIVE:**
"Here's the thing about PLCs." Your team leader leans back. "The SCADA dashboard only shows the operator what they need to see: green lights, red lights, route status. But the PLC's actual memory contains much more. Debug flags, firmware notes, configuration secrets. An attacker who queries the raw API sees everything."

This is the capstone. The flag is hidden in plain sight, but you need to look where no one else looks.

---

## OBJECTIVES
- [ ] Query the raw Master PLC status API (not the SCADA dashboard)
- [ ] Carefully read every field in the JSON response
- [ ] Find the hidden flag planted in the PLC's memory

## LEARNING CONCEPTS
Defense-in-depth means not relying on the UI to tell you the full story. The SCADA dashboard is a filtered view. The raw API is the truth. In real OT environments, attackers and forensic analysts both work at the API/memory level, not the dashboard level.

**Hints:**
- Hint 1: The dashboard does NOT show this field. You must query the API directly.
- Hint 2: Use `curl` on the status endpoint and pipe through `python3 -m json.tool`.
- Hint 3: Search the JSON output for the word "FLAG" or look at unusual field names.

## SUBMIT YOUR EVIDENCE
**Flag:** The hidden flag string from the PLC's memory

## NOTES
- Time Estimate: 15-20 minutes
- Difficulty: Expert
- Tools: `curl`, `python3`, your browser
