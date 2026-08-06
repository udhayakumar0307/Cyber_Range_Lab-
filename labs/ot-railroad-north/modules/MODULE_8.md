# Module 8: Packet Capture Analysis

**NARRATIVE:**
"You've been attacking. Now let's see what the network saw." Your team leader opens Wireshark. "Every command you sent left a footprint. A network forensics analyst would pull these captures and reconstruct exactly what happened. Find the JSON key that identifies which track segment was targeted."

---

## OBJECTIVES
- [ ] Open Wireshark and start a packet capture
- [ ] Run an attack (track switch command)
- [ ] Filter for HTTP POST requests
- [ ] Follow the TCP stream and read the JSON body
- [ ] Identify the key that specifies the track segment

## LEARNING CONCEPTS
Network forensics is how incidents are investigated after the fact. Every byte that crosses the wire is recorded. Wireshark decodes the raw packets into human-readable protocol layers.

**Hints:**
- Hint 1: Open Wireshark at https://localhost:3001. Start a capture.
- Hint 2: Run Module 4's attack again while capturing.
- Hint 3: Filter with `http.request.method == POST`, then right-click -> Follow -> TCP Stream.

## SUBMIT YOUR EVIDENCE
**Flag:** The JSON key name that specifies the track segment

## NOTES
- Time Estimate: 20-30 minutes
- Difficulty: Hard
- Tools: Wireshark (browser), `curl`
