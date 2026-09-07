import { analyseCompliance } from "../privacy/scorer.js";

// Consent totals, tolerant of both source shapes: the e-commerce API reports
// `consent_status: granted|revoked`, the finance API the same field, and the
// legacy EverShop path maps to Approved/Revoked/Pending.
class ConsentAnalyzer {
  async analyze(consents = [], sector = "generic") {
    const { totals, percentages } = analyseCompliance(consents, sector);

    return {
      active: totals.granted,
      pending: totals.pending,
      revoked: totals.revoked,
      total: totals.total,
      consentCoverage: percentages.granted,
      revocationRate: percentages.revoked
    };
  }
}

export default new ConsentAnalyzer();
