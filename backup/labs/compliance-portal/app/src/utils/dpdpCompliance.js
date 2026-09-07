const DPDP_RULES = [
  {
    id: 1,
    name: "Consent Management",
    description: "Consent records should capture consent status, purpose, and timestamp.",
    weight: 18,
    evaluate: ({ completeness }) => completeness
  },
  {
    id: 2,
    name: "Notice and Transparency",
    description: "Data Principals should be informed about the purpose of processing.",
    weight: 12,
    evaluate: ({ purposeCoverage }) => purposeCoverage
  },
  {
    id: 3,
    name: "Rights of Data Principals",
    description: "Data Principals should be able to access, correct, erase, and manage consent.",
    weight: 12,
    evaluate: ({ revocationTraceability }) => revocationTraceability
  },
  {
    id: 4,
    name: "Time Period for Erasure",
    description: "Consent and revocation records should include timestamps for retention review.",
    weight: 10,
    evaluate: ({ timestampCoverage }) => timestampCoverage
  },
  {
    id: 5,
    name: "Reasonable Security Safeguards",
    description: "Systems should use controlled API access and protect consent data in transit.",
    weight: 12,
    evaluate: ({ securitySafeguards }) => securitySafeguards
  },
  {
    id: 6,
    name: "Contact Information for Queries",
    description: "Consent data should include a contact channel for user communication.",
    weight: 8,
    evaluate: ({ contactCoverage }) => contactCoverage
  },
  {
    id: 7,
    name: "Data Minimization",
    description: "Collected data should be limited to what is needed for the stated purpose.",
    weight: 10,
    evaluate: ({ minimizationScore }) => minimizationScore
  },
  {
    id: 8,
    name: "Intimation of Personal Data Breach",
    description: "Operational readiness should include breach notification procedures.",
    weight: 8,
    evaluate: ({ breachNotificationReadiness }) => breachNotificationReadiness
  },
  {
    id: 9,
    name: "Processing Personal Data Outside India",
    description: "Cross-border processing should follow applicable government restrictions.",
    weight: 5,
    evaluate: ({ domesticProcessingCoverage }) => domesticProcessingCoverage
  },
  {
    id: 10,
    name: "Verifiable Consent for Children",
    description: "Children's data processing should support verifiable guardian consent.",
    weight: 5,
    evaluate: ({ childrenConsentReadiness }) => childrenConsentReadiness
  }
];

function percent(count, total) {
  return total ? (count / total) * 100 : 0;
}

function average(values) {
  const validValues = values.filter((value) => Number.isFinite(value));

  return validValues.length
    ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length
    : 0;
}

function hasValidTimestamp(item) {
  return Boolean(item.timestamp) && !Number.isNaN(new Date(item.timestamp).getTime());
}

function getStatus(score) {
  if (score >= 85) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs Action";
  return "Critical";
}

function getRuleEvaluationStatus(score) {
  if (score >= 85) return "met";
  if (score >= 70) return "partial";
  if (score < 40) return "critical_gap";
  return "not_met";
}

function getStatusValue(status) {
  if (status === "met") return 1;
  if (status === "partial") return 0.5;
  if (status === "critical_gap") return -0.5;
  return 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function calculateDpdpCompliance(consents = [], apiKeyConnected = false) {
  const total = consents.length;
  const requiredFields = ["user_id", "name", "purpose", "consent_status", "timestamp"];
  const completeRecords = consents.filter((item) =>
    requiredFields.every((field) => Boolean(item[field]))
  ).length;
  const recordsWithPurpose = consents.filter((item) => Boolean(item.purpose)).length;
  const recordsWithTimestamp = consents.filter(hasValidTimestamp).length;
  const recordsWithContact = consents.filter((item) => Boolean(item.email || item.phone)).length;
  const revokedRecords = consents.filter((item) => item.consent_status === "revoked");
  const revokedWithTimestamp = revokedRecords.filter(hasValidTimestamp).length;
  const recordsWithLocation = consents.filter((item) => Boolean(item.address));
  const domesticRecords = recordsWithLocation.filter((item) =>
    String(item.address).toLowerCase().includes("india")
  ).length;
  const recordsWithExtraPersonalData = consents.filter(
    (item) => Boolean(item.email) && Boolean(item.phone) && Boolean(item.address)
  ).length;
  const minorRecords = consents.filter(
    (item) =>
      item.is_minor === true ||
      String(item.age_category ?? "").toLowerCase() === "minor" ||
      String(item.data_principal_type ?? "").toLowerCase() === "child"
  );
  const minorRecordsWithGuardianConsent = minorRecords.filter(
    (item) => Boolean(item.guardian_consent) || Boolean(item.parent_contact)
  ).length;

  const completeness = percent(completeRecords, total);
  const purposeCoverage = percent(recordsWithPurpose, total);
  const timestampCoverage = percent(recordsWithTimestamp, total);
  const contactCoverage = percent(recordsWithContact, total);
  const revocationTraceability = revokedRecords.length
    ? percent(revokedWithTimestamp, revokedRecords.length)
    : 100;
  const locationCoverage = percent(recordsWithLocation.length, total);
  const domesticProcessingCoverage = recordsWithLocation.length
    ? percent(domesticRecords, recordsWithLocation.length)
    : 0;
  const minimizationScore = Math.max(0, 100 - percent(recordsWithExtraPersonalData, total) * 0.35);
  const securitySafeguards = average([
    apiKeyConnected ? 100 : 50,
    timestampCoverage,
    completeness,
    contactCoverage
  ]);
  const breachNotificationReadiness = average([
    contactCoverage,
    timestampCoverage,
    revocationTraceability
  ]);
  const childrenConsentReadiness = minorRecords.length
    ? percent(minorRecordsWithGuardianConsent, minorRecords.length)
    : 100;

  const context = {
    apiKeyConnected,
    completeness,
    purposeCoverage,
    timestampCoverage,
    contactCoverage,
    revocationTraceability,
    locationCoverage,
    domesticProcessingCoverage,
    minimizationScore,
    securitySafeguards,
    breachNotificationReadiness,
    childrenConsentReadiness
  };

  const rules = DPDP_RULES.map((rule) => {
    const score = Math.round(rule.evaluate(context));
    const evaluationStatus = getRuleEvaluationStatus(score);

    return {
      ...rule,
      score,
      status: getStatus(score),
      evaluationStatus,
      statusValue: getStatusValue(evaluationStatus),
      compliant: evaluationStatus === "met" ? "yes" : evaluationStatus === "partial" ? "partial" : "no"
    };
  });

  const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
  const weightedScore = totalWeight
    ? rules.reduce((sum, rule) => sum + rule.weight * rule.statusValue, 0) / totalWeight * 100
    : 0;

  const rulesReviewed = rules.length;
  const needsAction = rules.filter((rule) => rule.evaluationStatus === "partial" || rule.evaluationStatus === "not_met").length;
  const criticalRisks = rules.filter((rule) => rule.evaluationStatus === "critical_gap").length;

  return {
    score: Math.round(clamp(weightedScore)),
    status: getStatus(weightedScore),
    rules,
    rulesReviewed,
    needsAction,
    criticalRisks,
    criticalRules: rules.filter((rule) => rule.evaluationStatus === "critical_gap"),
    actionRules: rules.filter((rule) => rule.evaluationStatus === "partial" || rule.evaluationStatus === "not_met")
  };
}
