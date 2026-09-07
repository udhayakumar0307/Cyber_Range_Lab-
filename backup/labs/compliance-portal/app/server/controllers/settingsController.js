import settingsMockData from "../../src/mock/settings.json" with { type: "json" };
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import { listRegisteredSources } from "../services/consentSources.js";
import { availableSectors } from "../privacy/classifier.js";
import { scheduler } from "../scheduler/scheduler.js";

// Held at module scope rather than on the instance. Express receives these
// methods as bare function references, so `this` is undefined when they run —
// which is why every settings request failed with "Cannot read properties of
// undefined (reading 'currentSettings')".
let currentSettings = structuredClone(settingsMockData);

class SettingsController {
  async getSettings(_req, res, next) {
    try {
      const sources = listRegisteredSources();
      const engine = scheduler.getStatus();

      // The values that are actually configuration are reported from the live
      // configuration, not from a stored copy that can drift out of date.
      res.json({
        ...currentSettings,
        platform: {
          connectedPlatforms: sources.length,
          sectors: sources.map((source) => ({
            sector: source.sector,
            label: source.label,
            endpoint: source.endpoint,
            keyMasked: source.keyMasked,
            origin: source.origin
          })),
          engineStatus: engine.status,
          lastRun: engine.last_run || null,
          syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES || 5),
          consentLimit: Number(process.env.CONSENT_LIMIT || 500),
          fetchTimeoutMs: Number(process.env.CONSENT_FETCH_TIMEOUT_MS || 20000),
          databaseConfigured: Boolean(process.env.DATABASE_URL || process.env.ECOMMERCE_DATABASE_URL)
        },
        availableSectors: availableSectors()
      });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const { organization, api, retention, notifications } = req.body || {};
      if (organization) currentSettings.organization = { ...currentSettings.organization, ...organization };
      if (api) currentSettings.api = { ...currentSettings.api, ...api };
      if (retention) currentSettings.retention = { ...currentSettings.retention, ...retention };
      if (notifications) currentSettings.notifications = { ...currentSettings.notifications, ...notifications };

      await auditLogRepository.logEvent("Settings Updated", "Portal configuration updated by an administrator.");
      res.json({ success: true, settings: currentSettings });
    } catch (err) {
      next(err);
    }
  }
}

export const settingsController = new SettingsController();
