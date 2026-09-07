// Risk and DPDP compliance scoring.
//
// Every figure returned here is computed from the records and the sector pack.
// Where a number cannot be derived from the data, it is reported as null and
// the caller renders it as "not measured" rather than inventing a constant.

import { classifyDataset, loadSectorPack } from "./classifier.js";

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const truthy = (value) =>
  value === true || value === "true" || value === 1 || value === "1" || value === "yes";

const daysBetween = (from, to) => Math.floor((to - from) / 86400000);

function readStatus(record) {
  const raw = String(record.consent_status ?? record.status ?? "").toLowerCase();
  if (["granted", "approved", "active", "given"].includes(raw)) return "granted";
  if (["revoked", "withdrawn", "denied"].includes(raw)) return "revoked";
  return "pending";
}

/**
 * Record-level DPDP findings. These are the obligations that apply in every
 * sector, so they live in the core rather than in any pack.
 */
export function analyseCompliance(records = [], sector = "generic") {
  const pack = loadSectorPack(sector);
  const now = new Date();
  const retention = pack.retention || {};
  const graceDays = retention.postRevocationDays ?? 30;

  let granted = 0;
  let revoked = 0;
  let pending = 0;
  let minors = 0;
  let minorsWithoutGuardian = 0;
  let retainedAfterRevocation = 0;
  let overdueErasure = 0;
  let missingPurpose = 0;

  for (const record of records) {
    const status = readStatus(record);
    if (status === "granted") granted += 1;
    else if (status === "revoked") revoked += 1;
    else pending += 1;

    const isMinor = truthy(record.is_minor) || truthy(record.is_child);
    if (isMinor) {
      minors += 1;
      // DPDP s.9 requires verifiable consent from a parent or lawful guardian.
      if (!truthy(record.guardian_verified)) minorsWithoutGuardian += 1;
    }

    const revokedAt = asDate(record.consent_revoked_at);
    const deletedAt = asDate(record.pii_deleted_at);
    if (revokedAt && !deletedAt) {
      retainedAfterRevocation += 1;
      if (daysBetween(revokedAt, now) > graceDays) overdueErasure += 1;
    }

    if (!record.purpose && !record.consent_type) missingPurpose += 1;
  }

  const total = records.length;
  const pct = (count) => (total ? Number(((count / total) * 100).toFixed(1)) : 0);

  // Ten weighted checks drawn from the Act's core duties. Each returns a 0..1
  // pass fraction so the overall figure is an average of real measurements.
  const checks = [
    { id: "consent.recorded", label: "Consent status recorded for every principal",
      weight: 1.5, pass: total ? (total - pending) / total : 0 },
    { id: "consent.granted", label: "Processing covered by an active consent",
      weight: 1.0, pass: total ? granted / total : 0 },
    { id: "purpose.stated", label: "Purpose specified (s.5 notice)",
      weight: 1.5, pass: total ? (total - missingPurpose) / total : 0 },
    { id: "erasure.on_revocation", label: "PII erased when consent withdrawn (s.12)",
      weight: 2.0, pass: revoked ? (revoked - retainedAfterRevocation) / revoked : 1 },
    { id: "erasure.timeliness", label: "Erasure within the sector retention window",
      weight: 1.5, pass: revoked ? (revoked - overdueErasure) / revoked : 1 },
    { id: "children.guardian", label: "Verifiable guardian consent for children (s.9)",
      weight: 2.0, pass: minors ? (minors - minorsWithoutGuardian) / minors : 1 },
    { id: "minimisation", label: "Collection limited to stated purpose (s.6)",
      weight: 1.0, pass: null },
    { id: "accuracy", label: "Data accuracy and correction rights (s.8)",
      weight: 1.0, pass: null },
    { id: "security", label: "Reasonable security safeguards (s.8(5))",
      weight: 1.5, pass: null },
    { id: "grievance", label: "Grievance redressal available (s.13)",
      weight: 1.0, pass: null }
  ];

  const measured = checks.filter((check) => check.pass !== null);
  const weightSum = measured.reduce((sum, check) => sum + check.weight, 0);
  const weighted = measured.reduce((sum, check) => sum + check.weight * check.pass, 0);
  const compliancePercent = weightSum ? Number(((weighted / weightSum) * 100).toFixed(1)) : 0;

  return {
    sector: pack.sector,
    totals: { total, granted, revoked, pending },
    percentages: { granted: pct(granted), revoked: pct(revoked), pending: pct(pending) },
    children: { minors, minorsWithoutGuardian },
    erasure: { retainedAfterRevocation, overdueErasure, graceDays },
    checks: checks.map((check) => ({
      id: check.id,
      label: check.label,
      weight: check.weight,
      status: check.pass === null ? "not-measured" : check.pass >= 0.999 ? "pass" : check.pass >= 0.8 ? "warn" : "fail",
      passRate: check.pass === null ? null : Number((check.pass * 100).toFixed(1))
    })),
    compliancePercent,
    measuredChecks: measured.length,
    totalChecks: checks.length
  };
}

/**
 * Privacy risk index, 0..100. Higher means more exposure.
 * Driven by what was actually detected plus the compliance findings.
 */
export function scorePrivacyRisk(classification, compliance) {
  const drivers = [];
  const { fields, counts, totalRecords } = classification;
  if (!totalRecords || !fields.length) {
    return { score: 0, band: "None", drivers: [{ label: "No data available to assess", points: 0 }] };
  }

  // Weight each detected field by its sensitivity and how much of the dataset
  // it actually populates, so a rarely-filled column counts for less.
  const exposure = fields.reduce((sum, field) => sum + field.score * field.coverage, 0);
  const density = exposure / fields.length;
  let score = density * 55;
  drivers.push({ label: `${fields.length} personal-data fields detected`, points: Number((density * 55).toFixed(1)) });

  if (counts.criticalFields > 0) {
    const points = Math.min(15, counts.criticalFields * 5);
    score += points;
    drivers.push({ label: `${counts.criticalFields} critical identifier field(s)`, points });
  }

  if (compliance.children.minors > 0) {
    const share = compliance.children.minors / totalRecords;
    const points = Number((share * 12 + (compliance.children.minorsWithoutGuardian ? 8 : 0)).toFixed(1));
    score += points;
    drivers.push({
      label: compliance.children.minorsWithoutGuardian
        ? `${compliance.children.minorsWithoutGuardian} child record(s) without verified guardian consent`
        : `${compliance.children.minors} child record(s) present`,
      points
    });
  }

  if (compliance.erasure.overdueErasure > 0) {
    const points = Math.min(15, (compliance.erasure.overdueErasure / totalRecords) * 40);
    score += Number(points.toFixed(1));
    drivers.push({ label: `${compliance.erasure.overdueErasure} record(s) past the erasure window`, points: Number(points.toFixed(1)) });
  }

  if (compliance.compliancePercent < 80) {
    const points = Number(((80 - compliance.compliancePercent) * 0.15).toFixed(1));
    score += points;
    drivers.push({ label: `Compliance shortfall (${compliance.compliancePercent}%)`, points });
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const band = finalScore >= 75 ? "Critical" : finalScore >= 50 ? "High" : finalScore >= 25 ? "Medium" : "Low";

  return { score: finalScore, band, drivers: drivers.sort((a, b) => b.points - a.points) };
}

/** One call producing everything the API layer needs for a sector. */
export function analyseSource(records = [], sector = "generic") {
  const classification = classifyDataset(records, sector);
  const compliance = analyseCompliance(records, sector);
  const risk = scorePrivacyRisk(classification, compliance);
  return { classification, compliance, risk };
}
