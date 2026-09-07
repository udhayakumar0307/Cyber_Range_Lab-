# Module 5: DPDP Compliance Audit & Reporting (Capstone)

**Difficulty:** ★★★ &nbsp;|&nbsp; **Points:** 250

## Briefing

The board has asked for a defensible statement of the company's **DPDP
posture** ahead of the annual review. You have connected the platform, worked
the consent lifecycle, mapped the PII, and put anonymization controls in place.
Now you produce the evidence.

## Mission

Read the DPDP compliance breakdown rule by rule, close the outstanding action
item, generate a consolidated compliance report, and confirm the compliance
index and next-audit date on the Command Center.

## Objectives

1. On **DPDP Compliance**, record the **current posture** (compliance %),
   **Rules Reviewed**, **Needs Action**, and **Critical Risks**.
2. Expand **Compliance controls at a glance** and, for **every** rule, record
   its status and the one-line finding. Identify the rule(s) driving *Needs
   Action* and *Critical Risks*.
3. Run **Run Compliance Audit** and confirm the score is recomputed from live
   consent + PII + anonymization state (not a stored value).
4. Address the outstanding action item using the relevant workspace
   (Consent Management, PII Management, or Anonymization), re-run the audit,
   and record whether *Needs Action* decreased.
5. On **Reports**, set the scope filter (date range, platform, data category)
   and **generate** a **DPDP Compliance Audit Report**. Confirm a
   `downloadUrl` is returned and the **Live Report Preview** renders. Also
   generate the **Consent** and **PII** reports.
6. Return to the **Dashboard** and record the final **Compliance Index**, the
   **Real-Time Audit Trail (ROPA)** entries your actions produced, and the
   **next audit date**.

## Steps

1. **Sidebar → DPDP Compliance.** The header gauge is the **statutory
   alignment index** — the share of the core DPDP provisions the current state
   satisfies. Below it: *Rules Reviewed / Needs Action / Critical Risks*.

2. **Compliance controls at a glance.** Each control maps to a DPDP obligation
   — notice, consent basis, purpose limitation, retention, security
   safeguards, breach readiness, grievance redressal, children's data, etc.
   Each shows `status` + a computed finding.

3. **Run Compliance Audit.** `POST /dpdp` (via the button) re-runs the
   `dpdpAnalyzer` against the current consent + PII + anonymization bundle.
   The score moves when the underlying state moves.

4. **Close the gap.** Typical action items:
   - *Downstream processing audit* → run a secure deletion for outstanding
     revoked records (Module 2).
   - *Unminimised PII* → run an anonymization job (Module 4).
   - *Notice coverage* → review Settings → notification/notice configuration.
   Re-run the audit and compare.

5. **Reports.** **Scope Filter Controls** → pick range + platform + category →
   **Generate**. Each report returns
   `{ success, downloadUrl }` and updates the **Live Report Preview Document**.
   Download at least the DPDP report.

6. **Dashboard.** Confirm:
   - Compliance Index reflects your changes.
   - The **ROPA audit trail** shows your sync / deletion / anonymization /
     report events with timestamps.
   - **Action Required Items** is reduced (ideally "All regulatory checklist
     items closed").
   - The **next audit date** is one year out from the most recent review.

## Evidence

| Field | What to record |
|---|---|
| Starting compliance % | DPDP Compliance header |
| Rules reviewed / needs action / critical | DPDP Compliance |
| Rule driving *Needs Action* | rule name + finding |
| Action taken | which workspace + what you did |
| Compliance % after re-audit | DPDP Compliance header |
| Reports generated | list + one downloadUrl |
| ROPA entries produced | count + example |
| Next audit date | Dashboard |

## Concepts

- **Accountability (DPDP §8)** — the Data Fiduciary must be *able to
  demonstrate* compliance. A number is not enough; the ROPA trail and the
  downloadable reports are the demonstration.
- **Live vs stored score** — a compliance score that does not move when you fix
  something is theatre. Confirm causality: change state → re-audit → score
  moves.
- **Continuous compliance** — the 5-minute sync means the posture is never more
  than a few minutes stale; the annual audit just formalises what the portal
  already tracks.

## Completion

You have run the full DPDP compliance loop: connect → consent → discover →
anonymise → audit → report. Record the final evidence table and submit.
