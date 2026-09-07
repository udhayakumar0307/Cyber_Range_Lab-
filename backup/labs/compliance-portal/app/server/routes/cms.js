import express from "express";
import { dashboardController } from "../controllers/dashboardController.js";
import { consentController } from "../controllers/consentController.js";
import { dpdpController } from "../controllers/dpdpController.js";
import { piiController } from "../controllers/piiController.js";
import { anonymizationController } from "../controllers/anonymizationController.js";
import { reportController } from "../controllers/reportController.js";
import { settingsController } from "../controllers/settingsController.js";
import { integrationController } from "../controllers/integrationController.js";
import { validateIntegrationConfig } from "../validators/integrationValidator.js";
import sectorRoutes from "./sectors.js";
import processorRoutes from "./processors.js";
import { scheduler } from "../scheduler/scheduler.js";

const router = express.Router();

// 0. Sector registry, cross-sector overview and refresh
router.use(sectorRoutes);
router.use(processorRoutes);

// 1. Health monitoring and engine status
router.get("/status", (_req, res) => res.json(scheduler.getStatus()));
router.get("/health", integrationController.getStatus);

// 2. Integration configurations
router.get("/integration/config", integrationController.getConfig);
router.get("/integration/sectors", integrationController.getSectors);
router.get("/integration/platforms", async (_req, res, next) => {
  try {
    const { integrationRepository } = await import("../repositories/integrationRepository.js");
    res.json(await integrationRepository.listPlatforms());
  } catch (err) { next(err); }
});
router.get("/integration/status", integrationController.getStatus);
router.post("/integration/connect", integrationController.testConnection);
router.post("/integration/test-connection", validateIntegrationConfig, integrationController.testConnection);
router.post("/integration/disconnect", integrationController.disconnect);
router.post("/integration/start-sync", integrationController.startSync);
router.post("/integration/stop-sync", integrationController.stopSync);
router.get("/integration/sync-history", integrationController.getSyncHistory);
router.post("/integration/clear-sync-history", integrationController.clearSyncHistory);
router.post("/integration/delete-sync-history", integrationController.deleteSyncHistory);

// 3. Dashboard metrics
router.get("/dashboard", dashboardController.getDashboard);

// 4. Consents management
router.get("/consents", consentController.getConsents);
router.get("/consents/statistics", consentController.getStatistics);
router.get("/consents/deletion-audit", consentController.getDeletionAudit);
router.put("/consents/:id/approve", consentController.approveConsent);
router.put("/consents/:id/revoke", consentController.revokeConsent);
router.post("/consents/:id/delete", consentController.deleteConsentPII);

// 5. DPDP compliance checks
router.get("/dpdp", dpdpController.getDpdpCompliance);

// 6. PII Classification
router.get("/pii", piiController.getPiiInventory);

// 7. Anonymization & Hashing
router.get("/anonymization", anonymizationController.getAnonymizationOverview);
router.get("/anonymization/jobs", anonymizationController.getJobs);
router.get("/anonymization/sharing", anonymizationController.getSharingLog);
router.get("/anonymization/hash-log", anonymizationController.getHashLog);
router.post("/anonymization/share", anonymizationController.triggerAnonymizationJob);
// The masking workspace calls these; without them the requests fell through to
// the SPA fallback and the page tried to parse index.html as JSON.
router.post("/anonymization/jobs", anonymizationController.triggerAnonymizationJob);
router.post("/anonymization/preview", anonymizationController.getPreview);
router.get("/anonymization/trace", anonymizationController.traceSharing);
router.post("/anonymization/feedback", anonymizationController.saveFeedback);
router.post("/anonymization/reset-feedback", anonymizationController.resetFeedback);

// 8. Reports downloads
router.get("/reports", reportController.getReports);
router.post("/reports/generate", reportController.generateReport);
router.get("/reports/download/:id", reportController.downloadReport);

// 9. Settings
router.get("/settings", settingsController.getSettings);
router.put("/settings", settingsController.updateSettings);

export default router;
