# Module 2: Consent Lifecycle Management

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 200

## Briefing

Under the DPDP Act, processing of personal data must rest on **free, specific,
informed and unambiguous consent**, and a Data Principal can **withdraw** that
consent as easily as they gave it. Your portal's **Consent Management**
workspace is where you evidence that lifecycle.

## Mission

Work every tab of the Consent Management workspace, understand the consent
metrics the engine computes, and confirm that revocation and downstream
deletion are being tracked.

## Objectives

1. In **Consent Records**, inspect the registry: note how personal fields are
   shown as **PRESENT** rather than raw values, and explain why a compliance
   portal must not surface personal data in the clear.
2. Use the **purpose filter** and **status filter** to isolate every
   **revoked** record. Record how many there are and for which purposes.
3. Open **Consent Requests** and **Revocations** and read the derived metrics:
   Approved / Revoked / Pending Revocations, **Avg Revocation Time**,
   **Consent Coverage**, and **Revocation SLA Compliance**.
4. Open **Consent Analytics** and record the **revocation rate** and the
   **purpose distribution** (Marketing / Research / Analytics).
5. In the **Data Lifecycle** view, trigger a **secure PII deletion** for one
   revoked record and confirm it appears in the **deletion audit** with
   `status = Success`, `verification = Verified`. Then attempt deletion of a
   record whose ID ends in `9` and confirm the simulated failure is logged.

## Steps

1. **Sidebar → Consent Management → Consent Records.** The registry lists each
   consent with `RECORD / NAME / EMAIL / PURPOSE / STATUS / CAPTURED`. Names and
   emails read **PRESENT** — the portal reports *presence*, never *content*.

2. **Filter to revoked.** Use the **All Statuses → Revoked** dropdown (and the
   purpose filter) to see only withdrawals. Cross-check the count against the
   **Revoked Consents** metric on the Revocations tab.

3. **Revocations tab.** This is the operational SLA view:
   - **Pending Revocations** — revoked but PII not yet erased downstream.
   - **Avg Revocation Time** / **SLA Compliance** — how fast withdrawals
     propagate.
   - **Revocation Propagation Timeline** — the ingestion → registry → downstream
     deletion chain.

4. **Consent Analytics tab.** Read:
   - **Revocation rate** = revoked ÷ total consents.
   - **Purpose distribution** — granted vs revoked per purpose.

5. **Data Lifecycle → secure deletion.** Pick a **revoked** record and run the
   PII deletion action. The portal issues the downstream deletion call, then
   writes a row to the **deletion audit**:
   `platform, status, verification_status, completion_timestamp`.
   Now repeat for a record whose ID ends in `9` — the platform deliberately
   simulates a *connection timeout* so you can see how a **failed** erasure is
   recorded and surfaced for follow-up.

> **Note (demo mode):** approve / revoke / grant actions from the **Consent
> Records** table write to the optional audit database. In self-contained demo
> mode there is no database, so those buttons will not persist a status change —
> the analytics above are still fully live because they are computed from the
> consent source, not the database. The **secure PII deletion** flow *is*
> tracked in demo mode (in an in-memory audit ledger). Set `DATABASE_URL` to
> persist consent-status writes and the sync-history log.

## Evidence

| Field | What to record |
|---|---|
| Total consents | Consent Analytics |
| Revoked count | Revocations tab |
| Revocation rate | Consent Analytics |
| Purpose distribution | Consent Analytics (M / R / A) |
| Pending revocations | Revocations tab |
| Deletion audit — success row | record id + completion timestamp |
| Deletion audit — failed row | record id ending in 9 + failure reason |

## Concepts

- **Withdrawal = ease of giving** (DPDP §6(4)–(6)). The portal measures the lag
  between withdrawal and downstream erasure as an SLA.
- **Data minimisation & storage limitation** — a revoked consent should lead to
  erasure "as soon as reasonably practicable"; the deletion audit is your
  evidence.
- **Presence-not-content** — a governance tool proves you *hold* a field, never
  by exposing the field.

## Completion

Record the evidence table and confirm both a successful and a failed deletion
appear in the audit trail. Proceed to Module 3.
