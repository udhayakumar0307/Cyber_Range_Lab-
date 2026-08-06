# Module 3: API Endpoint Discovery

**NARRATIVE:**
"The Master PLC has a REST API for remote management. No authentication. Query it and map out the system." Your team leader slides you a terminal. "How many safety interlocks are protecting this railway?"

---

## OBJECTIVES
- [ ] Query the Master PLC's status API endpoint
- [ ] Parse the JSON response
- [ ] Count the number of active safety interlocks

## LEARNING CONCEPTS
Modern PLCs often expose REST APIs alongside traditional industrial protocols. These APIs provide rich diagnostic data, but if left unauthenticated, they become a goldmine for attackers.

**Hints:**
- Hint 1: Use `curl` to query the status endpoint of the Master PLC.
- Hint 2: The endpoint is `/api/status`. Pipe the output through `python3 -m json.tool` to read it.
- Hint 3: Look at the `safety_interlocks` array. Count entries where `active` is true.

## SUBMIT YOUR EVIDENCE
**Flag:** The number of active safety interlocks (an integer)

## NOTES
- Time Estimate: 10-15 minutes
- Difficulty: Medium
- Tools: `curl`, `python3`
