# DPDP Act Compliance Scoring System: Formulas & Concepts

This document outlines the formulas, concepts, and assessment criteria used by the **Consent Management System (CMS) / Data Discovery System (DDS)** dashboard to compute compliance scores under the **Digital Personal Data Protection (DPDP) Act, 2023**.

---

## 1. Core Compliance Concept
The dashboard evaluates compliance by checking the presence, structure, and consistency of properties across the imported consent records. It acts as an automated auditor, translating raw database attributes into compliance indicators mapped directly to the statutory requirements of the DPDP Act.

---

## 2. Base Metric Formulas
Before calculating compliance rules, the system extracts the following basic metrics from the total imported consent records:

### A. Record Completeness
Measures whether consent records capture all critical legal parameters of a valid consent transaction.
$$\text{Completeness (\%)} = \left( \frac{\text{Records containing user\_id, name, purpose, consent\_status, and timestamp}}{\text{Total Records}} \right) \times 100$$

### B. Notice & Purpose Coverage
Under Sec. 5 of the DPDP Act, every request for consent must be accompanied or preceded by a notice specifying the purpose.
$$\text{Notice Coverage (\%)} = \left( \frac{\text{Records with a non-empty purpose field}}{\text{Total Records}} \right) \times 100$$

### C. Timestamp Coverage
Required to track consent validity periods and erasure schedules.
$$\text{Timestamp Coverage (\%)} = \left( \frac{\text{Records with a valid, parseable ISO timestamp}}{\text{Total Records}} \right) \times 100$$

### D. Contact Channel Coverage
Determines if communication details exist to support notice deliveries and grievance queries (Sec. 13).
$$\text{Contact Coverage (\%)} = \left( \frac{\text{Records containing either email or phone}}{\text{Total Records}} \right) \times 100$$

### E. Revocation Traceability
Sec. 6(4) grants Data Principals the right to withdraw consent. Withdrawal must be documented with temporal traceability.
$$\text{Revocation Traceability (\%)} = \left( \frac{\text{Revoked records with a valid timestamp}}{\text{Total Revoked Records}} \right) \times 100$$
*(If there are no revoked records, this defaults to 100%).*

### F. Domestic Processing Coverage
Under Sec. 16, cross-border data flows are subject to restrictions. This measures compliance with localized/approved processing.
$$\text{Domestic Processing Coverage (\%)} = \left( \frac{\text{Records with address containing "India"}}{\text{Total Records with a specified address}} \right) \times 100$$

### G. Data Minimization Score
Evaluates adherence to the principle that only necessary data should be collected (Sec. 4(1)). Overcollection of multiple contact identifiers incurs a penalty.
$$\text{Minimization Score (\%)} = \max\left(0, 100 - \left( \frac{\text{Records containing email AND phone AND address}}{\text{Total Records}} \right) \times 35\right)$$

---

## 3. The 10 DPDP Compliance Rules
The metrics above are used to evaluate **10 distinct rules** representing requirements of the DPDP Act. Each rule is assigned a **weight** representing its relative importance:

| Rule ID | Rule Name | Evaluated Metric | Weight | DPDP Act Section Reference |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Consent Management** | Completeness | **18** | Section 6 (Consent) |
| **2** | **Notice and Transparency** | Purpose Coverage | **12** | Section 5 (Notice) |
| **3** | **Rights of Data Principals** | Revocation Traceability | **12** | Section 6 & 11 (Right to Withdraw) |
| **4** | **Time Period for Erasure** | Timestamp Coverage | **10** | Section 12 (Erasure of Personal Data) |
| **5** | **Reasonable Security Safeguards** | Average of (API Connected status, Timestamp, Completeness, Contact Coverage) | **12** | Section 8(5) (Security Safeguards) |
| **6** | **Contact Information for Queries** | Contact Coverage | **8** | Section 13 (Grievance Redressal) |
| **7** | **Data Minimization** | Minimization Score | **10** | Section 4(1) (Usage Limitation) |
| **8** | **Intimation of Personal Data Breach** | Average of (Contact, Timestamp, Revocation Traceability) | **8** | Section 8(6) (Breach Notification) |
| **9** | **Processing Personal Data Outside India**| Domestic Processing Coverage | **5** | Section 16 (Cross-border transfer) |
| **10** | **Verifiable Consent for Children** | Guardian Consent Coverage *(Minors with guardian contact)* | **5** | Section 9 (Processing of Children's Data) |

---

## 4. Rule-Level Status & Grading
Each rule's calculated score is graded into one of four compliance statuses, which determines its mathematical contribution (**Status Value**) to the overall score:

* **Excellent / Met** (Score $\ge 85$):
  * **Status Value**: `1.0` (Full positive contribution)
* **Good / Partial** (Score $\ge 70$ but $< 85$):
  * **Status Value**: `0.5` (Half contribution)
* **Needs Action / Not Met** (Score $\ge 40$ but $< 70$):
  * **Status Value**: `0.0` (Zero contribution)
* **Critical / Critical Gap** (Score $< 40$):
  * **Status Value**: `-0.5` (Negative penalty contribution)

---

## 5. Overall DPDP Compliance Score Formula
The overall readiness score is a **weighted average** of the rule-level contribution values. It is calculated by taking the sum of the products of each rule's weight and status value, normalizing it against the total weight, and clamping the result between `0` and `100`:

$$\text{Weighted Score} = \left( \frac{\sum_{i=1}^{10} (\text{Weight}_i \times \text{Status Value}_i)}{\sum_{i=1}^{10} \text{Weight}_i} \right) \times 100$$

$$\text{Overall DPDP Compliance Score} = \text{clamp}(\text{Weighted Score}, 0, 100)$$

### Dashboard Status Grading:
* **Score $\ge 85$**: **Excellent**
* **Score $\ge 75$**: **Good**
* **Score $\ge 60$**: **Needs Action**
* **Score $< 60$**: **Critical**
