# Data Discovery System Dashboard Walkthrough

Hosted dashboard:

```text
https://dds-cms.vercel.app?_vercel_share=d9DEJ645OhqbmcTmP6enYxMPdzxEPid6
```

## What This Dashboard Does

The Data Discovery System is a DPDP readiness dashboard. It helps an organization view consent status, check DPDP compliance readiness, identify PII fields, and maintain ROPA/DPIA records from one place.

The dashboard has five main components:

```text
Overview
Consent
DPDP Score
PII Mapping
ROPA & DPIA
```

## Sample API Keys For Testing

You can paste any of these sample keys into the **Consent API key** input box and click **Sync**:

```text
cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2
cms_test_sk_42b7f0a9e6d34c81b5f2a7d93c0e18ab
dds_demo_key_91f4c2a87e6b49dca2517ff03b0e8c19
dpdp_readiness_test_6d3b9f20a44d48c98a5b12ef77c901ad
dds_dpdp_score_50_test
dds_dpdp_score_75_test
dds_dpdp_score_80_test
```

These are only test keys. The current demo API accepts them for testing the input and sync flow.

These keys return different mock consent datasets so you can test different dashboard states:

```text
cms_test_sk_8f2a91d7c4b64e3fa0d925b71e6a34c2       -> baseline dataset
cms_test_sk_42b7f0a9e6d34c81b5f2a7d93c0e18ab       -> marketing-heavy dataset
dds_demo_key_91f4c2a87e6b49dca2517ff03b0e8c19      -> revocation-heavy dataset
dpdp_readiness_test_6d3b9f20a44d48c98a5b12ef77c901ad -> balanced high-readiness dataset
dds_dpdp_score_50_test                              -> lower readiness scenario
dds_dpdp_score_75_test                              -> medium readiness scenario
dds_dpdp_score_80_test                              -> stronger readiness scenario
```

## How To Use The API Key Box

1. Open the hosted dashboard.
2. Find the **Consent API key** input near the top.
3. Paste one sample key.
4. Click **Sync**.
5. The dashboard will refresh the consent data and show that it is using a keyed consent feed.

If the API fails, check that the deployed API endpoint is working:

```text
https://dds-cms.vercel.app/api/consents
```

## 1. Overview

The **Overview** tab gives a quick summary of the full DPDP readiness platform.

It shows module-level scores for:

```text
Consent Management
DPDP Gap Review
PII Mapping
ROPA & DPIA
```

Use this section to quickly understand the overall health of the organization’s data discovery and privacy readiness.

The cards are clickable, so users can jump into a specific module.

## 2. Consent

The **Consent** tab focuses on user consent records.

It shows:

```text
Consents Granted
Consents Revoked
Revocation Rate
Total Consents
```

It also includes:

```text
Pie chart for granted vs revoked consent
Bar chart for consent distribution by purpose
Recent revocations table
Purpose filter
User search
CSV export
```

This tab helps track whether users have granted or revoked consent for purposes such as:

```text
Marketing
Research
Analytics
```

## 3. DPDP Score

The **DPDP Score** tab shows an estimated DPDP compliance readiness score.

It includes:

```text
Overall DPDP Compliance Score
Rules reviewed
Needs action count
Critical risks count
DPDP rule coverage table
```

The score is based on dashboard data and DPDP control coverage. It checks areas such as:

```text
Consent Management
Notice and Transparency
Rights of Data Principals
Time Period for Erasure
Reasonable Security Safeguards
Contact Information for Queries
Data Minimization
Breach Notification Readiness
Cross-border Processing
Children's Consent
```

Important: This score is an operational readiness estimate, not a legal certification.

## 4. PII Mapping

The **PII Mapping** tab identifies personal data fields found in the consent dataset.

It shows:

```text
PII fields identified
High sensitivity fields
Purpose categories
Assigned owners
```

The PII inventory table includes:

```text
Field name
Category
Sensitivity
Purpose
Owner
Protection method
Retention posture
```

Examples of PII fields:

```text
Full Name
Email Address
Phone Number
Address
User ID
```

This module helps the organization understand what personal data it collects and how each field is classified.

## 5. ROPA & DPIA

The **ROPA & DPIA** tab tracks processing activities and privacy risk assessments.

ROPA means:

```text
Record of Processing Activities
```

DPIA means:

```text
Data Protection Impact Assessment
```

This tab shows:

```text
Processing activities
DPIA required count
High risk activities
Assigned owners
DPIA completion posture
```

The register table includes:

```text
Activity
Purpose
Data Categories
Lawful Basis
Owner
Risk
DPIA Required
DPIA Status
Last Reviewed Date
```

This helps privacy and compliance teams track whether important processing activities have been reviewed and assessed.

## Night Mode

The dashboard includes a night mode toggle in the top-right area.

Click the moon/sun button to switch between:

```text
Light mode
Dark mode
```

The selected theme is remembered in the browser.

## Exporting Data

In the **Consent** tab, click **Export CSV** to download the currently filtered consent data.

The exported file includes:

```text
User ID
Name
Email
Phone
Address
Purpose
Consent Status
Timestamp
```

## Simple Demo Flow

Use this flow when presenting the dashboard:

1. Open the hosted dashboard.
2. Paste a sample API key.
3. Click **Sync**.
4. Start with the **Overview** tab to explain the platform scores.
5. Open **Consent** to show consent analytics and revocations.
6. Open **DPDP Score** to explain compliance readiness.
7. Open **PII Mapping** to show personal data classification.
8. Open **ROPA & DPIA** to show processing activities and privacy risk tracking.
9. Toggle night mode to show UI flexibility.
10. Export consent data as CSV if needed.

## Summary

The dashboard acts as a central DPDP readiness system. It combines consent monitoring, compliance scoring, PII discovery, and ROPA/DPIA tracking into one interface.
