# Module 7: API Fuzzing

**NARRATIVE:**
"What happens when you send garbage to the PLC?" Your team leader smiles. "Real pentesters don't just use valid inputs. They send invalid data to see how the system breaks. If the error message reveals internal logic, that's an information leak."

---

## OBJECTIVES
- [ ] Send an invalid route value to the PLC API
- [ ] Read the error message in the response
- [ ] Understand why verbose error messages are a security vulnerability (CWE-209)

## LEARNING CONCEPTS
A well-configured system returns generic errors like "400 Bad Request." A poorly configured one tells you exactly what went wrong, including internal naming conventions, valid input formats, and validation logic. This is CWE-209: Information Exposure Through an Error Message.

**Hints:**
- Hint 1: Send a route that doesn't exist, like `ROUTE_XYZ`.
- Hint 2: Read the `error` field in the JSON response.
- Hint 3: `curl -X POST ... -d '{"segment_id": 1, "route": "ROUTE_XYZ"}'`

## SUBMIT YOUR EVIDENCE
**Flag:** The exact error string from the response

## NOTES
- Time Estimate: 10-15 minutes
- Difficulty: Hard
- Tools: `curl`
