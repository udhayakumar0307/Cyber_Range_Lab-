# Module 4: Unauthorized Track Switch

**NARRATIVE:**
"Time to see if this thing is really unprotected." Your team leader watches the SCADA dashboard on the big screen. "Send a route command directly to the PLC API. Switch Segment 1 to the maintenance track. Watch the dashboard change in real time."

This is the moment it gets real. You are about to reroute a train.

---

## OBJECTIVES
- [ ] Send a POST request to the Master PLC's command API
- [ ] Switch Segment 1 to ROUTE_C (Maintenance)
- [ ] Observe the change on the SCADA dashboard
- [ ] Note the `requested_route` value in the API response

## LEARNING CONCEPTS
The Master PLC API accepts JSON commands with zero authentication. Any device on the network can send route commands. The SCADA dashboard will show a YELLOW "UNAUTHORIZED API CALL" in its audit log because it detects commands it did not initiate.

**Hints:**
- Hint 1: Use `curl` with a POST request and JSON body.
- Hint 2: The endpoint is `/api/command`. The body needs `segment_id` and `route`.
- Hint 3: `curl -X POST http://<IP>:8085/api/command -H "Content-Type: application/json" -d '{"segment_id": 1, "route": "ROUTE_C"}'`

## SUBMIT YOUR EVIDENCE
**Flag:** The `requested_route` value from the API response

## NOTES
- Time Estimate: 15 minutes
- Difficulty: Medium
- Tools: `curl`
