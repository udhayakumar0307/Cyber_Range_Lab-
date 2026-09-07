# Module 4: Anonymization & Third-Party Sharing

**Difficulty:** ★★ &nbsp;|&nbsp; **Points:** 200

## Briefing

Your company shares customer data with downstream processors — analytics,
logistics, a marketing partner. Under the DPDP Act every such transfer must be
covered by a contract and by purpose limitation, and wherever the recipient
does not need to identify the individual, the data should be **anonymised or
pseudonymised** first.

The **Anonymization** workspace is where you configure masking, run jobs, and
keep a tamper-evident record of what left the building.

## Mission

Configure the PII masking rules, run an anonymization job, disclose a dataset
to a third party, and trace that disclosure through the hash audit trail.

## Objectives

1. On **Anonymization → Overview & Masking Workspace**, read the
   **AI-Driven Personal Data Scanner** configuration for the active sector.
   Record which fields it auto-selects and the crypto treatment proposed
   (drop / generalise / `sha256:` hash / retain).
2. Switch between **Manual Mode** and **Autopilot Mode** and describe the
   difference.
3. Use **Step 2: Before & After Previews** to preview the transform on a
   representative record. Record one field's raw → anonymised value.
4. Run an **anonymization job** (**Step 1 → execute**, or the Jobs tab). Record
   **Records Anonymized**, **Success Rate**, **Today's Jobs**.
5. Open **Third-Party Sharing Log**, register/trigger a sharing event, then
   open **Hash Audit Trail** and **trace** that event by its record id or
   `sha256:` signature. Confirm the chain: *record → hash → destination →
   purpose → verification status*.

## Steps

1. **Sidebar → Anonymization → Overview & Masking Workspace.** The scanner
   config is sector-aware — an ecommerce deployment hashes phone, generalises
   address to city, and retains order metadata; a finance deployment is
   stricter.

2. **Manual vs Autopilot.** Manual lets you override each field's treatment;
   Autopilot applies the sector-recommended policy wholesale.

3. **Before & After preview.** `POST /anonymization/preview` returns a
   representative `{ raw, anonymized }` pair (synthetic sample — never a real
   record).

4. **Run the job.** The job walks the dataset, applies the policy, and reports
   a summary: `recordsAnonymized`, `successRate`, `pendingErasure`,
   `revokedTotal`.

5. **Share + trace.**
   - **Third-Party Sharing Log** — each disclosure row: destination, purpose,
     records, timestamp.
   - **Hash Audit Trail** — every shared record is fingerprinted (`sha256:…`)
     so you can later prove exactly what was sent without keeping a copy of the
     personal data.
   - **Trace** — given a record id or a hash, the portal reconstructs the
     disclosure and its verification status.

## Evidence

| Field | What to record |
|---|---|
| Auto-selected fields | from the scanner config |
| Example transform | one field: raw → anonymised |
| Records anonymised | job summary |
| Success rate | job summary |
| Sharing event | destination + purpose |
| Hash signature | the `sha256:` prefix of the traced record |
| Verification status | from the hash audit trail |

## Concepts

- **Anonymisation vs pseudonymisation** — anonymised data is out of scope of
  the Act; pseudonymised (hashed with a key you hold) is still personal data
  but lower risk.
- **Purpose limitation on transfer** (DPDP §5–§8) — a processor may only use
  the data for the fiduciary's stated purpose.
- **Tamper-evident evidence** — hashing each shared record means an auditor can
  later verify "was record X part of the 12 March disclosure?" from the hash
  alone.

## Completion

Record the evidence table and confirm a sharing event is traceable end-to-end
in the Hash Audit Trail. Proceed to Module 5.
