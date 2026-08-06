# Module 9: Emergency Recovery

**NARRATIVE:**
"Someone triggered the emergency stop. All signals are RED. All barriers are locked. No trains are moving." Your team leader looks at the frozen SCADA dashboard. "Find the recovery endpoint and bring the system back online."

---

## OBJECTIVES
- [ ] Discover the emergency clear API endpoint
- [ ] Send the recovery command
- [ ] Read the `action` field in the response
- [ ] Verify the system recovers on the SCADA dashboard

## LEARNING CONCEPTS
OT systems have emergency procedures hardcoded into their APIs. Knowing these endpoints is critical for incident response. In a real scenario, the recovery process would require physical verification before clearing faults.

**Hints:**
- Hint 1: The Master PLC has an emergency management API. Try common REST patterns.
- Hint 2: The endpoint is `/api/emergency/clear`. Send a POST request to it.
- Hint 3: The `action` field in the response is your flag.

## SUBMIT YOUR EVIDENCE
**Flag:** The `action` field value from the emergency clear response

## NOTES
- Time Estimate: 10-15 minutes
- Difficulty: Medium
- Tools: `curl`
