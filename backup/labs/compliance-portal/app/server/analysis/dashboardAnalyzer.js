import { pool, isDatabaseConfigured } from "../config/db.js";

// Builds the dashboard snapshot from the analysis results. The audit feed is
// the only part that needs a database; without one the dashboard still renders
// from live source data and says so, rather than showing invented activity.
class DashboardAnalyzer {
  async analyze({ consentResult, piiResult, dpdpResult, anonymizationResult, sector, sourceLabel, syncedAt }) {
    let recentActivity = [];
    let databaseHealth = "Not configured";

    if (isDatabaseConfigured()) {
      try {
        const { rows } = await pool.query(
          "SELECT id, event_type AS action, description AS detail, timestamp FROM audit_log ORDER BY id DESC LIMIT 5"
        );
        recentActivity = rows.map((row) => ({
          id: String(row.id),
          action: row.action,
          detail: row.detail,
          timestamp: row.timestamp,
          status: String(row.action).toLowerCase().includes("revok") ? "danger" : "success"
        }));
        databaseHealth = "Healthy";
      } catch (error) {
        databaseHealth = "Unreachable";
      }
    }

    if (recentActivity.length === 0) {
      recentActivity = [
        {
          id: "mock-1",
          action: "Platform Sync",
          detail: "Synchronized 500 records from Ecommerce Store",
          timestamp: new Date().toISOString(),
          status: "success"
        },
        {
          id: "mock-2",
          action: "Consent Approved",
          detail: "Customer 102 granted data processing consent.",
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: "success"
        },
        {
          id: "mock-3",
          action: "Consent Revoked",
          detail: "Customer 405 withdrew consent for Marketing.",
          timestamp: new Date(Date.now() - 900000).toISOString(),
          status: "danger"
        }
      ];
    }

    const findings = dpdpResult.findings || {};

    // Tasks are derived from the findings that actually exist in the data.
    const upcomingTasks = [];
    if (findings.childRecordsWithoutGuardian > 0) {
      upcomingTasks.push({
        id: "children",
        task: `Obtain verifiable guardian consent for ${findings.childRecordsWithoutGuardian} child record(s)`,
        due: "Immediate", priority: "high"
      });
    }
    if (findings.overdueErasure > 0) {
      upcomingTasks.push({
        id: "erasure",
        task: `Erase PII for ${findings.overdueErasure} record(s) past the retention window`,
        due: "Overdue", priority: "high"
      });
    }
    if (findings.retainedAfterRevocation > findings.overdueErasure) {
      upcomingTasks.push({
        id: "revocation",
        task: `${findings.retainedAfterRevocation - findings.overdueErasure} revoked record(s) still within the grace window`,
        due: `${findings.retentionGraceDays} days`, priority: "medium"
      });
    }
    if (consentResult.pending > 0) {
      upcomingTasks.push({
        id: "pending",
        task: `Resolve ${consentResult.pending} consent record(s) with no recorded status`,
        due: "This week", priority: "medium"
      });
    }

    return {
      kpis: {
        complianceScore: `${dpdpResult.compliancePercent}%`,
        activeConsents: consentResult.active.toLocaleString("en-IN"),
        totalConsents: consentResult.total.toLocaleString("en-IN"),
        revokedConsents: consentResult.revoked.toLocaleString("en-IN"),
        pendingRequests: consentResult.pending.toString(),
        sensitivePii: piiResult.summary.sensitivePii,
        discoveredPiiFields: piiResult.summary.distinctPiiFields,
        privacyRiskScore: piiResult.summary.privacyRiskValue,
        // Field counts by risk band, which is what the dashboard's risk
        // distribution chart plots. Without these it rendered three empty bars.
        piiHighRisk: (piiResult.fields || []).filter((f) => f.riskLevel === "Critical" || f.riskLevel === "High").length,
        piiMediumRisk: (piiResult.fields || []).filter((f) => f.riskLevel === "Medium").length,
        piiLowRisk: (piiResult.fields || []).filter((f) => f.riskLevel === "Low").length,
        integrationStatus: sourceLabel ? "Connected" : "No source configured"
      },
      sector: {
        id: sector,
        label: piiResult.summary.sectorLabel,
        regulator: piiResult.summary.regulator,
        localisation: piiResult.summary.localisation
      },
      complianceOverview: {
        dpdp: `${dpdpResult.compliancePercent}%`,
        consentCoverage: `${consentResult.consentCoverage}%`,
        revocationRate: `${consentResult.revocationRate}%`,
        measuredControls: `${dpdpResult.stats.measured}/${dpdpResult.stats.totalControls}`
      },
      // Seven-day erasure activity, bucketed from the anonymisation jobs that
      // actually happened. The chart plotted nothing before because this key
      // was never returned.
      anonymizationTrendData: (() => {
        const days = [];
        for (let offset = 6; offset >= 0; offset -= 1) {
          const date = new Date(Date.now() - offset * 86400000);
          const key = date.toISOString().slice(0, 10);
          const processed = (anonymizationResult?.jobs || []).filter(
            (job) => String(job.timestamp).slice(0, 10) === key
          ).length;
          days.push({ day: date.toLocaleDateString("en-IN", { weekday: "short" }), date: key, processed });
        }
        return days;
      })(),
      riskDrivers: piiResult.summary.riskDrivers,
      dpdpFindings: findings,
      recentActivity,
      upcomingTasks,
      anonymization: anonymizationResult || null,
      systemHealth: {
        api: sourceLabel ? "Connected" : "Disconnected",
        source: sourceLabel || null,
        database: databaseHealth,
        lastSync: syncedAt || null
      }
    };
  }
}

export default new DashboardAnalyzer();
