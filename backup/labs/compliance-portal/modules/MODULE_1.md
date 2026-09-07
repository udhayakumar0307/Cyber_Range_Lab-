# Module 1: Platform Integration & Consent Sync

**Difficulty:** ★ &nbsp;|&nbsp; **Points:** 150

## Briefing

You have just been appointed **Data Protection Officer** at a company that
processes personal data of Indian users and therefore falls under the **Digital
Personal Data Protection (DPDP) Act, 2023**.

Your compliance portal is running but it has never been pointed at a data
platform. Before you can assess anything, you need to connect a **consent
source** and let the privacy engine run its first analysis.

> In this lab the portal launches in **self-contained demo mode** — a demo
> platform ("Deeptrust Demo Store") is already registered for you. Your job in
> this module is to understand that connection, confirm it is healthy, and
> drive a fresh synchronisation.

## Mission

Confirm the compliance portal is connected to a consent source, trigger a
synchronisation + analysis run, and verify that the DPDP Command Center is
populated with a real posture.

## Objectives

1. Open **Platform Integration** and read the **Connection Setup** panel —
   note the platform name, platform type, and business **sector**.
2. Open the **API Protocols** and **Data Flows** tabs and describe, in one
   sentence each, what the portal ingests and what it exposes.
3. On the **Dashboard**, use **Run Compliance Scan** (or **Platform
   Integration → Recent Synchronization**) to trigger a fresh analysis.
4. Confirm the engine status becomes **READY** and the **Recent
   Synchronization** panel shows `Analysed 1 sector(s)` with a record count.
5. Return to the **Dashboard** and record the four headline KPIs: Compliance
   Index, Total Consents, Discovered PII, Adapter State.

## Steps

1. **Sidebar → Platform Integration.** The **Connection Setup** tab shows the
   registered platform. Read off:
   - Platform Name
   - Platform Type (e.g. *Custom REST / Generic REST API*)
   - Business Sector — this selects the regulator overlay and the PII
     sensitivity weighting used everywhere else in the portal.

2. **API Protocols tab.** This is the ingestion contract — the standard
   consent-record shape the portal expects from any platform
   (`user_id, name, email, phone, address, purpose, consent_status,
   timestamp`).

3. **Data Flows tab.** Follow how a consent record travels from the source
   through the analysers to the dashboard.

4. **Trigger a sync.** Either:
   - **Dashboard → Run Compliance Scan**, or
   - **Platform Integration → Recent Synchronization** (the live panel).

   The engine re-fetches the source and re-runs the consent, DPDP, PII and
   anonymization analysers.

5. **Verify.** The **Recent Synchronization** panel should log a `Success`
   entry: `Analysed 1 sector(s): ecommerce (N)`. The Dashboard status pill
   should read **READY / Idle**.

## Evidence

| Field | What to record |
|---|---|
| Platform name | From Connection Setup |
| Business sector | From Connection Setup |
| Regulator | Shown on the Dashboard sector card / PII Management |
| Records analysed | From the Recent Synchronization success log |
| Compliance Index | Dashboard KPI |
| Discovered PII | Dashboard KPI (field count) |

## Concepts

- **Consent source** — the portal never stores personal data itself. It reads
  each company's consent route (or DB) on a schedule and computes every score
  at runtime. Adding a company is one registry entry.
- **Sector pack** — `ecommerce`, `finance`, `healthcare`, … Each pack sets which
  fields are sensitive, how heavily they weigh, and which regulator applies.
- **Stateless analysis** — with no database the portal still produces a full
  posture; a database only adds audit-history persistence.

## Completion

Record the evidence table above and confirm the Dashboard is no longer showing
"No Platform Connected". Proceed to Module 2.
