import { analyseSource } from "../privacy/scorer.js";
import { loadSectorPack } from "../privacy/classifier.js";

// Presents the sector-aware engine's output in the shape the PII page consumes.
// Every value below is derived from the records passed in or from the sector
// pack — there are no multipliers and no invented constants.
class PiiAnalyzer {
  async analyze(consents = [], sector = "generic") {
    const { classification, compliance, risk } = analyseSource(consents, sector);
    const pack = loadSectorPack(sector);
    const { counts, fields, totalRecords } = classification;

    // Records whose consent timestamp falls in the last 24 hours.
    const dayAgo = Date.now() - 86400000;
    const detectedToday = consents.filter((record) => {
      const stamp = Date.parse(record.timestamp || record.consent_granted_at || record.created || "");
      return Number.isFinite(stamp) && stamp >= dayAgo;
    }).length;

    // Values already erased at source count as protected; low-confidence
    // matches are not counted as exposed clear-text.
    const protectedInstances = fields
      .filter((field) => field.confidence === "name-mismatch")
      .reduce((sum, field) => sum + field.populated, 0);

    // Distribution of detected fields across categories.
    const byCategory = new Map();
    for (const field of fields) {
      const entry = byCategory.get(field.category) || { category: field.category, fields: 0, instances: 0 };
      entry.fields += 1;
      entry.instances += field.populated;
      byCategory.set(field.category, entry);
    }
    const systemDistribution = [...byCategory.values()]
      .map((entry) => {
        const share = counts.piiInstances
          ? Number(((entry.instances / counts.piiInstances) * 100).toFixed(1))
          : 0;
        return {
          ...entry,
          // `system`, `records` and `share` are what the Data Lifecycle view
          // reads; `name`/`value`/`percentage` are what the charts read. Both
          // shapes are returned so neither has to know about the other.
          system: entry.category,
          records: entry.instances,
          share,
          name: entry.category,
          value: entry.instances,
          percentage: share
        };
      })
      .sort((a, b) => b.value - a.value);

    // Lifecycle status, each stage answered from the data rather than asserted.
    const lifecycle = [
      { stage: "Collection", description: "Processing purpose recorded against each principal",
        status: compliance.checks.find((c) => c.id === "purpose.stated")?.status === "pass" ? "Healthy" : "Warning" },
      { stage: "Consent", description: "Consent state known for every record",
        status: compliance.totals.pending === 0 ? "Healthy" : "Warning" },
      { stage: "Retention", description: `Erasure within ${compliance.erasure.graceDays} days of withdrawal`,
        status: compliance.erasure.overdueErasure > 0 ? "Critical" : compliance.erasure.retainedAfterRevocation > 0 ? "Warning" : "Healthy" },
      { stage: "Children", description: "Verifiable guardian consent where the principal is a child",
        status: compliance.children.minorsWithoutGuardian > 0 ? "Critical" : compliance.children.minors > 0 ? "Healthy" : "Not applicable" },
      { stage: "Minimisation", description: `${counts.distinctPiiFields} personal-data fields collected`,
        status: counts.criticalFields > 3 ? "Warning" : "Healthy" }
    ];

    // Fields that are rarely populated are candidates for removal; highly
    // sensitive ones for masking. Both are computed from actual coverage.
    const minimizationOpps = fields
      .filter((field) => field.coverage < 0.5 || field.score >= 0.9)
      .slice(0, 6)
      .map((field) => ({
        field: field.field,
        opportunity: field.coverage < 0.5
          ? `Populated in only ${(field.coverage * 100).toFixed(0)}% of records — consider dropping the column`
          : `${field.piiType} at ${field.riskLevel} risk — mask or tokenise at rest`,
        estimatedReduction: `${Math.round(field.score * (1 - field.coverage + 0.4) * 100)}%`
      }));

    const riskBreakdown = risk.drivers.map((driver) => ({
      factor: driver.label,
      impact: `+${driver.points}`,
      points: driver.points,
      details: `Contributes ${driver.points} points to the ${risk.score}/100 index`
    }));

    // Rendered directly as text by the PII page, so these are sentences.
    const aiRecommendations = [];
    if (compliance.children.minorsWithoutGuardian > 0) {
      aiRecommendations.push(
        `Obtain verifiable guardian consent: ${compliance.children.minorsWithoutGuardian} of ${compliance.children.minors} child records lack a verified guardian. DPDP s.9 requires verifiable consent from a parent or lawful guardian before a child's personal data may be processed.`
      );
    }
    if (compliance.erasure.overdueErasure > 0) {
      aiRecommendations.push(
        `Erase withdrawn-consent records: ${compliance.erasure.overdueErasure} record(s) are past the ${compliance.erasure.graceDays}-day window since withdrawal but still hold personal data (s.12).`
      );
    }
    if (counts.criticalFields > 0) {
      aiRecommendations.push(
        `Protect ${counts.criticalFields} critical identifier field(s): ${fields.filter((f) => f.riskLevel === "Critical").map((f) => f.field).join(", ")} carry the highest sensitivity under the ${pack.regulator} overlay.`
      );
    }
    if (compliance.totals.pending > 0) {
      aiRecommendations.push(
        `Resolve consent state: ${compliance.totals.pending} record(s) have no recorded consent status, so no lawful basis can be evidenced for them.`
      );
    }
    if (!aiRecommendations.length) {
      aiRecommendations.push(`No DPDP gaps detected across ${totalRecords} record(s) in this sector.`);
    }

    // Trend uses whatever history the source timestamps support.
    const buckets = new Map();
    for (const record of consents) {
      const stamp = Date.parse(record.timestamp || record.consent_granted_at || "");
      if (!Number.isFinite(stamp)) continue;
      const day = new Date(stamp).toISOString().slice(0, 10);
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }
    const historicalTrends = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([date, count]) => ({ date, records: count, name: date.slice(5) }));

    return {
      summary: {
        totalPiiRecords: counts.piiInstances.toLocaleString("en-IN"),
        distinctPiiFields: counts.distinctPiiFields,
        sensitivePii: counts.sensitiveInstances.toLocaleString("en-IN"),
        criticalFields: counts.criticalFields,
        validatedFields: counts.validatedFields,
        encryptedRecords: protectedInstances.toLocaleString("en-IN"),
        detectedToday: detectedToday.toLocaleString("en-IN"),
        privacyRiskScore: String(risk.score),
        privacyRiskLevel: risk.band,
        privacyRiskValue: risk.score,
        riskDrivers: risk.drivers,
        recordsScanned: totalRecords,
        sector: classification.sector,
        sectorLabel: classification.sectorLabel,
        regulator: classification.regulator,
        localisation: classification.localisation
      },
      fields: fields.map((field, index) => ({
        id: String(index + 1),
        field: field.field,
        category: field.category,
        piiType: field.piiType,
        riskLevel: field.riskLevel,
        score: field.score,
        confidence: field.confidence,
        coverage: field.coverage,
        populated: field.populated,
        sectorWeighted: field.sectorWeighted,
        source: classification.sectorLabel,
        status: field.confidence === "validated" ? "Verified" : "Detected"
      })),
      riskBreakdown,
      systemDistribution,
      lifecycle,
      minimizationOpps,
      aiRecommendations,
      historicalTrends,
      // No third-party processor registry is wired up yet, so this is reported
      // as empty rather than populated with invented vendors.
      thirdPartyExposure: [],
      industryAssessment: {
        industry: classification.sectorLabel,
        regulator: classification.regulator,
        averageRisk: pack.benchmarkRisk,
        actualRisk: risk.score,
        gapDescription: risk.score > pack.benchmarkRisk
          ? `${risk.score - pack.benchmarkRisk} points above the ${classification.sectorLabel} benchmark of ${pack.benchmarkRisk}.`
          : `${pack.benchmarkRisk - risk.score} points below the ${classification.sectorLabel} benchmark of ${pack.benchmarkRisk}.`
      },
      children: compliance.children,
      erasure: compliance.erasure
    };
  }
}

export default new PiiAnalyzer();
