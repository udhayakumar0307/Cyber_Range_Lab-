import { analyseCompliance } from "../privacy/scorer.js";

// DPDP compliance from the ten core duties in the Act. Checks that cannot be
// evidenced from consent data alone are reported as "not measured" and left out
// of the percentage, so the score never claims more than it can show.
class DpdpAnalyzer {
  async analyze(consents = [], _consentStats = {}, sector = "generic") {
    const compliance = analyseCompliance(consents, sector);

    const checklist = compliance.checks.map((check) => ({
      id: check.id,
      control: check.label,
      status: check.status === "pass" ? "Satisfied"
        : check.status === "warn" ? "Partial"
        : check.status === "fail" ? "Gap"
        : "Not measured",
      passRate: check.passRate,
      weight: check.weight
    }));

    const satisfied = checklist.filter((item) => item.status === "Satisfied").length;
    const gaps = checklist.filter((item) => item.status === "Gap").length;
    const partial = checklist.filter((item) => item.status === "Partial").length;

    return {
      compliancePercent: compliance.compliancePercent,
      sector: compliance.sector,
      stats: {
        satisfiedControls: satisfied,
        partialControls: partial,
        remaining: gaps + partial,
        highRisk: gaps,
        measured: compliance.measuredChecks,
        totalControls: compliance.totalChecks
      },
      checklist,
      findings: {
        childRecords: compliance.children.minors,
        childRecordsWithoutGuardian: compliance.children.minorsWithoutGuardian,
        retainedAfterRevocation: compliance.erasure.retainedAfterRevocation,
        overdueErasure: compliance.erasure.overdueErasure,
        retentionGraceDays: compliance.erasure.graceDays
      },
      totals: compliance.totals,
      percentages: compliance.percentages
    };
  }
}

export default new DpdpAnalyzer();
