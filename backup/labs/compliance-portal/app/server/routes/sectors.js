import express from "express";
import { cacheManager } from "../cache/cacheManager.js";
import { scheduler } from "../scheduler/scheduler.js";
import { listRegisteredSources, resolveSector, resolveConsentSource } from "../services/consentSources.js";
import { availableSectors, loadSectorPack } from "../privacy/classifier.js";

const router = express.Router();

function readApiKey(request) {
  const authorization = request.get("authorization") ?? "";
  return request.get("x-api-key") ?? request.query.key ?? authorization.replace("Bearer ", "");
}

/**
 * Resolve which sector bundle to serve.
 * A caller presenting a registered key gets that key's sector; a caller with no
 * key gets the primary (first configured) source. An unknown key is rejected —
 * it must not silently fall through to another company's data.
 */
export function resolveBundle(request) {
  const apiKey = readApiKey(request);
  if (apiKey) {
    if (!resolveConsentSource(apiKey)) return { error: "Unknown API key", status: 401 };
    const sector = resolveSector(apiKey);
    const bundle = cacheManager.get(`sector:${sector}`);
    return bundle ? { bundle } : { error: `No analysis available yet for sector "${sector}"`, status: 503 };
  }

  const [primary] = listRegisteredSources();
  if (!primary) return { error: "No consent source registered. Set CONSENT_SOURCES.", status: 503 };
  const bundle = cacheManager.get(`sector:${primary.sector}`);
  return bundle ? { bundle } : { error: "Analysis has not completed yet", status: 503 };
}

// Which sector packs the engine ships with, and which are actually wired up.
router.get("/sectors", (_request, response) => {
  const configured = listRegisteredSources();
  response.json({
    available: availableSectors(),
    configured: configured.map((source) => ({
      sector: source.sector,
      pack: loadSectorPack(source.sector).label,
      regulator: loadSectorPack(source.sector).regulator,
      mode: source.mode,
      endpoint: source.endpoint,
      keyMasked: source.keyMasked,
      analysed: Boolean(cacheManager.get(`sector:${source.sector}`))
    })),
    analysed: cacheManager.get("sectorsAnalysed") || [],
    health: scheduler.sourceHealth()
  });
});

// Full analysis for one sector by name, for side-by-side comparison.
router.get("/sectors/:sector", (request, response) => {
  const bundle = cacheManager.get(`sector:${request.params.sector}`);
  if (!bundle) {
    return response.status(404).json({ error: `No analysis for sector "${request.params.sector}"` });
  }
  const { consents, ...rest } = bundle;
  response.json(rest);
});

// Every analysed sector at once — the cross-sector compliance view.
router.get("/overview", (_request, response) => {
  const analysed = cacheManager.get("sectorsAnalysed") || [];
  const sectors = analysed
    .map((entry) => cacheManager.get(`sector:${entry.sector}`))
    .filter(Boolean)
    .map((bundle) => ({
      sector: bundle.sector,
      label: bundle.piiResult.summary.sectorLabel,
      regulator: bundle.piiResult.summary.regulator,
      localisation: bundle.piiResult.summary.localisation,
      records: bundle.records,
      syncedAt: bundle.syncedAt,
      privacyRisk: bundle.piiResult.summary.privacyRiskValue,
      riskBand: bundle.piiResult.summary.privacyRiskScore,
      compliancePercent: bundle.dpdpResult.compliancePercent,
      distinctPiiFields: bundle.piiResult.summary.distinctPiiFields,
      criticalFields: bundle.piiResult.summary.criticalFields,
      piiInstances: bundle.piiResult.summary.totalPiiRecords,
      consents: bundle.consentResult,
      findings: bundle.dpdpResult.findings
    }));

  const totalRecords = sectors.reduce((sum, s) => sum + s.records, 0);
  response.json({
    sectors,
    totals: {
      sectors: sectors.length,
      records: totalRecords,
      // Weighted by record count so a large source is not diluted by a small one.
      weightedCompliance: totalRecords
        ? Number((sectors.reduce((sum, s) => sum + s.compliancePercent * s.records, 0) / totalRecords).toFixed(1))
        : null,
      weightedRisk: totalRecords
        ? Number((sectors.reduce((sum, s) => sum + s.privacyRisk * s.records, 0) / totalRecords).toFixed(1))
        : null,
      childRecords: sectors.reduce((sum, s) => sum + (s.findings.childRecords || 0), 0),
      childRecordsWithoutGuardian: sectors.reduce((sum, s) => sum + (s.findings.childRecordsWithoutGuardian || 0), 0)
    },
    engine: scheduler.getStatus()
  });
});

// Force a re-analysis of every registered source.
router.post("/refresh", async (_request, response) => {
  await scheduler.runJobs();
  response.json({ success: true, ...scheduler.getStatus() });
});

export default router;
