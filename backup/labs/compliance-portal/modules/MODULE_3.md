# Module 3: PII Discovery & Classification

**Difficulty:** ★★ &nbsp;|&nbsp; **Points:** 200

## Briefing

You cannot protect what you have not mapped. The DPDP Act makes the Data
Fiduciary accountable for **every** item of personal data it processes. The
portal's **PII Management** workspace runs an automated discovery + sensitivity
classification and turns it into a **privacy-risk score**.

## Mission

Run a PII scan, review the classified inventory and its risk tiers, and explain
how the active sector pack drives the DPDP privacy-risk score.

## Objectives

1. On **PII Management**, run **Scan for PII**. Record the totals: **Total PII
   Records**, **Sensitive PII Fields**, **Encrypted PII Records**.
2. Open the **PII Inventory** tab. For each discovered field record its
   `pii_type` and `risk` tier (High / Medium / Low).
3. Open the **DPDP Risk Score Calculation** panel and note the inputs — how
   many High / Medium / Low fields feed the score and how they are weighted.
4. Open **Industry Benchmarking** and record how this posture compares with the
   sector's market context.
5. Open **Data Lifecycle** and **Sharing & Minimisation** and summarise the
   portal's counsel on retention and on reducing the PII footprint.

## Steps

1. **Sidebar → PII Management → Executive Posture.** Hit **Scan for PII**. The
   `pii` analyser walks the consent dataset, matches each column against the
   sector pack's PII dictionary, and assigns a sensitivity tier.

2. **PII Inventory tab.** Every discovered field with:
   - `table` / `column`
   - `pii_type` (Full Name, Email Address, Phone Number, Physical Address,
     Other Personal Attribute, …)
   - `risk` (High / Medium / Low)

3. **DPDP Risk Score Calculation.** The privacy-risk value (0–100) is a
   weighted function of the tier counts and the sector multiplier. A finance
   or healthcare sector weights the same field higher than ecommerce.

4. **Industry Benchmarking.** The sector pack carries a market context
   (regulator, localisation expectation, peer risk band). Record where this
   deployment sits.

5. **Data Lifecycle / Sharing & Minimisation.** The portal recommends
   retention limits and flags fields that could be dropped, hashed, or
   generalised without breaking the stated purpose.

## Evidence

| Field | What to record |
|---|---|
| Total PII records | Executive Posture KPI |
| Sensitive PII fields | Executive Posture KPI |
| Distinct PII types | count from PII Inventory |
| High / Medium / Low counts | from PII Inventory |
| Privacy-risk score | Executive Posture / Dashboard |
| Sector multiplier effect | one sentence, from Risk Score Calculation |

## Concepts

- **Personal data** (DPDP §2(t)) — any data about an identifiable individual.
  The classifier's job is to find all of it, not just the obvious fields.
- **Sensitivity weighting** — the Act does not enumerate "sensitive" categories
  the way GDPR does, but a Data Fiduciary is still expected to apply
  proportionate safeguards; the sector pack encodes that proportionality.
- **Risk score** — a single number the board can track quarter over quarter; it
  should fall as you minimise, hash, and retire fields.

## Completion

Record the evidence table and confirm the privacy-risk score on this page
matches the one on the Dashboard. Proceed to Module 4.
