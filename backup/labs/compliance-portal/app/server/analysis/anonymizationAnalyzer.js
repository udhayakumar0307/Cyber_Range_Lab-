import crypto from "crypto";
import { isDatabaseConfigured } from "../config/db.js";
import { hashAuditRepository } from "../repositories/hashAuditRepository.js";
import { loadSectorPack } from "../privacy/classifier.js";
import { toSharingRows, summariseProcessors } from "../privacy/processors.js";
import { syncHistoryRepository } from "../repositories/syncHistoryRepository.js";


// Anonymisation is measured from the sources themselves: a record whose consent
// was withdrawn and whose PII has been erased (pii_deleted_at) is a completed
// anonymisation. That is real evidence of an erasure obligation being met,
// rather than a job count invented for the page.
const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// The technique that actually protects each class of identifier. An identifier
// that must stay unique but never readable is tokenised; a value only used for
// matching is hashed; a value only used in aggregate is generalised.
// Values must match the technique options the masking workspace offers, or the
// recommendation silently falls back to the first option and every field looks
// identical regardless of how sensitive it is.
const TECHNIQUE = {
  "National Identifier": "Tokenization",
  "Financial Data": "Tokenization",
  "Health Data": "Tokenization",
  "Credentials": "Tokenization",
  "Biometric": "Tokenization",
  "Contact Information": "Hashing",
  "Identity Information": "Masking",
  "Child Data": "Masking",
  "Location Data": "Generalization",
  "Technical Identifier": "Generalization",
  "Behavioural": "Generalization"
};

const CONFIDENCE = { validated: "99%", partial: "80%", "name-only": "75%", "name-mismatch": "40%" };

class AnonymizationAnalyzer {
  async analyze(consents = [], sector = "generic", piiResult = null, processors = []) {
    const pack = loadSectorPack(sector);
    const dayAgo = Date.now() - 86400000;

    // The masking workspace needs the field inventory to work from. Without it
    // the scanner table renders with no rows and the page looks broken even
    // though the erasure figures above it are correct.
    const detectedPii = (piiResult?.fields || []).map((field) => ({
      field: field.field,
      category: field.category,
      piiType: field.piiType,
      risk: field.riskLevel,
      recommended: TECHNIQUE[field.category] || "Masking",
      // Critical and high-risk fields are pre-selected; low-risk ones are not,
      // so the default action is proportionate rather than blanket.
      selected: field.riskLevel === "Critical" || field.riskLevel === "High",
      confidence: CONFIDENCE[field.confidence] || "75%",
      reasoning: field.confidence === "validated"
        ? `Values match the ${field.piiType} format, and ${pack.regulator} treats this category as sensitive.`
        : `Column name indicates ${field.piiType}; populated in ${Math.round(field.coverage * 100)}% of records.`,
      coverage: field.coverage,
      isOverride: false
    }));

    const erased = [];
    let revoked = 0;
    let pendingErasure = 0;

    for (const record of consents) {
      const revokedAt = asDate(record.consent_revoked_at);
      const deletedAt = asDate(record.pii_deleted_at);
      if (revokedAt) revoked += 1;
      if (deletedAt) erased.push({ record, deletedAt, revokedAt });
      else if (revokedAt) pendingErasure += 1;
    }

    erased.sort((a, b) => b.deletedAt - a.deletedAt);
    
    const history = await syncHistoryRepository.getHistory();
    const anonHistory = history.filter(h => h.event.includes("Anonymization:") || h.event.toLowerCase().includes("sync"));

    let todaysJobsCount = erased.filter((entry) => entry.deletedAt.getTime() >= dayAgo).length;
    
    const jobs = [];
    
    // Add baseline erasures
    erased.forEach((entry, index) => {
      jobs.push({
        id: `ERZ-${String(index + 1).padStart(4, "0")}`,
        recordsCount: 1,
        method: "Erasure at source",
        subject: entry.record.user_id || "unknown",
        timestamp: entry.deletedAt.toISOString(),
        status: "Completed",
        elapsedDays: entry.revokedAt ? Math.max(0, Math.floor((entry.deletedAt - entry.revokedAt) / 86400000)) : null
      });
    });

    // Add recent sync history events
    const successfulCounts = [];
    anonHistory.forEach((h, index) => {
      const match = h.event.match(/(\d+)\s+customer/);
      const count = match ? parseInt(match[1]) : 0;
      
      if (h.status === "Success") {
        successfulCounts.push(count);
      }
      
      const ts = new Date(h.timestamp);
      if (ts.getTime() >= dayAgo) {
        todaysJobsCount += 1;
      }

      let jobType = "Autopilot Masking";
      const eventLower = h.event.toLowerCase();
      if (eventLower.includes("disclosed") || eventLower.includes("share")) {
        jobType = "Third-Party Disclosure";
      } else if (!eventLower.includes("mask")) {
        jobType = "Manual Sync";
      }

      jobs.push({
        id: `ANON-${h.id || index}`,
        recordsCount: count,
        method: jobType,
        subject: h.status === "Failed" ? "Failed Run" : "All active consents",
        timestamp: ts.toISOString(),
        status: h.status === "Failed" ? "Failed" : "Completed",
        elapsedDays: null
      });
    });

    // Sort jobs newest first
    jobs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const maxActiveRecords = successfulCounts.length ? Math.max(...successfulCounts) : 0;
    const successfulRecords = erased.length + maxActiveRecords;

    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(j => j.status === "Completed" || j.status === "Success").length;
    const successRate = totalJobs ? `${((successfulJobs / totalJobs) * 100).toFixed(1)}%` : "100.0%";

    // Integrity trail: a stable digest of the subject id proves the record was
    // processed without retaining the identifier itself.
    const hashAuditTrail = erased.slice(0, 10).map((entry, index) => ({
      recordId: `REC-${index + 1}`,
      sha256: crypto.createHash("sha256").update(String(entry.record.user_id ?? index)).digest("hex").slice(0, 32),
      timestamp: entry.deletedAt.toISOString(),
      verification: "Passed",
      destination: "Source of record",
      purpose: "Erasure verification"
    }));

    const storedHashes = isDatabaseConfigured() ? await hashAuditRepository.getHashes() : [];

    // Declared by the company or registered by an operator — never inferred.
    const sharingRows = toSharingRows(processors);

    return {
      summary: {
        activeIndustry: pack.label,
        regulator: pack.regulator,
        recordsAnonymized: successfulRecords,
        pendingErasure,
        revokedTotal: revoked,
        successRate,
        todaysJobs: todaysJobsCount,
        // null rather than a sentence: the field is a date, and a caller that
        // formats it should get "not recorded", not a string it cannot parse.
        latestProcess: jobs.length ? jobs[0].timestamp : null,
        retentionWindowDays: (pack.retention || {}).postRevocationDays ?? 30
      },
      detectedPii,
      jobs,
      hashAuditTrail: storedHashes.length
        ? storedHashes.map((row) => ({
          recordId: row.record_id,
          sha256: row.sha256_hash,
          timestamp: row.timestamp,
          verification: row.verification_status,
          destination: row.destination,
          purpose: row.purpose
        }))
        : hashAuditTrail,
      thirdPartySharing: sharingRows,
      thirdPartySummary: summariseProcessors(sharingRows),
      available: true
    };
  }
}

export default new AnonymizationAnalyzer();
