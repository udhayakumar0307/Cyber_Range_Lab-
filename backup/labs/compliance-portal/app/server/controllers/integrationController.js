import { integrationRepository } from "../repositories/integrationRepository.js";
import { syncHistoryRepository } from "../repositories/syncHistoryRepository.js";
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import { scheduler } from "../scheduler/scheduler.js";
import {
  registerSource, unregisterSource, listRegisteredSources, fetchConsents
} from "../services/consentSources.js";
import { availableSectors, loadSectorPack } from "../privacy/classifier.js";
import { inferSector } from "../privacy/sectorInference.js";
import { persistSource, deleteSource } from "../repositories/sourceRepository.js";
import { cacheManager } from "../cache/cacheManager.js";

// Accept either convention from the client without caring which.
const pick = (body, ...names) => {
  for (const name of names) {
    if (body?.[name] !== undefined && body[name] !== null && String(body[name]).trim() !== "") return body[name];
  }
  return "";
};

class IntegrationController {
  async getConfig(req, res, next) {
    try {
      res.json(await integrationRepository.getConfig());
    } catch (err) {
      next(err);
    }
  }

  async getStatus(_req, res, next) {
    try {
      const sources = listRegisteredSources();
      const engine = scheduler.getStatus();
      res.json({
        connected: engine.status === "READY",
        platforms: sources.length,
        sectors: [...new Set(sources.map((source) => source.sector))],
        health: engine.status === "READY" ? "Healthy" : engine.status === "SYNCING" ? "Syncing" : "Unhealthy",
        lastSync: engine.last_run || null,
        engine
      });
    } catch (err) {
      next(err);
    }
  }

  async getSectors(_req, res, next) {
    try {
      res.json(availableSectors());
    } catch (err) {
      next(err);
    }
  }

  /**
   * Onboard a company.
   *
   * This is the only path that adds a source without a redeploy, so it has to
   * do the real work: call the company's route with the key it was given,
   * register it in the same registry the environment feeds, and analyse it
   * immediately. A route that does not answer is a failed connection and is
   * reported as one. Previously this returned success regardless and registered
   * nothing, which is why a connected platform never appeared afterwards.
   */
  async testConnection(req, res, next) {
    try {
      const storeUrl = pick(req.body, "storeUrl", "store_url");
      const apiKey = pick(req.body, "apiKey", "api_key");
      const secret = pick(req.body, "secret");
      const storeName = pick(req.body, "storeName", "store_name") || null;
      const platform = pick(req.body, "platform") || "Custom REST";
      const requestedSector = String(pick(req.body, "sector") || "").toLowerCase();

      try {
        // The API key is the credential that gets forwarded to the company's
        // route. The optional secret is a separate token some companies issue
        // instead, so it only overrides the key when it is plainly one — never
        // because the form happened to carry a placeholder in that field.
        const token = secret && secret.length >= 16 && !secret.startsWith("•") ? secret : undefined;
        registerSource({
          key: apiKey,
          url: storeUrl,
          sector: requestedSector && requestedSector !== "auto" ? requestedSector : undefined,
          label: storeName,
          token
        });
      } catch (error) {
        return res.status(400).json({ error: error.message, status: 400 });
      }

      // Verify by actually reading the company's consent route.
      let records;
      try {
        records = await fetchConsents(apiKey, Number(process.env.CONSENT_LIMIT || 500));
      } catch (error) {
        unregisterSource(apiKey);
        return res.status(502).json({
          error: `Could not read consent data from ${storeUrl} — ${error.message}`,
          status: 502
        });
      }
      if (!Array.isArray(records)) {
        unregisterSource(apiKey);
        return res.status(502).json({ error: `${storeUrl} did not return a consent list.`, status: 502 });
      }

      // Sector decides which rules apply, so it has to be right. When the
      // operator did not choose one, infer it from the identifiers actually
      // present rather than silently treating every company as generic.
      let sector = requestedSector && requestedSector !== "auto" ? requestedSector : null;
      let inference = null;
      if (!sector) {
        inference = inferSector(records);
        sector = inference.sector;
      }
      registerSource({ key: apiKey, url: storeUrl, sector, label: storeName });

      const pack = loadSectorPack(sector);
      await persistSource({ key: apiKey, url: storeUrl, sector, label: storeName });
      await integrationRepository.updateConfig(storeName, storeUrl, platform, apiKey, secret, "Connected");

      // Analyse the records already read during verification — re-fetching the
      // whole dataset here is what made connecting slow enough to time out.
      const bundle = await scheduler.analyseOne(
        { key: apiKey, sector, label: storeName, endpoint: storeUrl },
        records
      );

      await syncHistoryRepository.logSync(
        `Connected ${storeName || storeUrl} as ${pack.label}: ${bundle.records} records analysed.`, "Success"
      );
      await auditLogRepository.logEvent(
        "Integration Connected", `${pack.label} source registered (${bundle.records} records).`
      );

      res.json({
        success: true,
        message: `Connected ${storeName || storeUrl}: ${bundle.records} records analysed as ${pack.label}.`,
        sector,
        sectorLabel: pack.label,
        regulator: pack.regulator,
        records: bundle.records,
        privacyRisk: bundle.piiResult.summary.privacyRiskValue,
        compliancePercent: bundle.dpdpResult.compliancePercent,
        sectorInferred: Boolean(inference),
        inferenceReason: inference ? inference.reason : null
      });
    } catch (err) {
      next(err);
    }
  }

  async startSync(_req, res, next) {
    try {
      await scheduler.runJobs();
      res.json({ success: true, ...scheduler.getStatus() });
    } catch (err) {
      next(err);
    }
  }

  async stopSync(_req, res, next) {
    try {
      scheduler.stop();
      await auditLogRepository.logEvent("Sync Terminated", "Background scheduler stopped.");
      res.json({ success: true, message: "Background analysis paused." });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Removes a company from the registry so it is no longer read or analysed.
   *
   * The caller identifies the platform by sector, because the page only ever
   * holds a masked key. An explicit key is still accepted for API callers. With
   * neither, the primary platform is disconnected — which is what the single
   * Disconnect button on the form means.
   */
  async disconnect(req, res, next) {
    try {
      const body = req.body || {};
      const explicitKey = pick(body, "apiKey", "api_key") || req.query?.key || "";
      const sector = String(pick(body, "sector") || req.query?.sector || "").toLowerCase();

      const sources = listRegisteredSources({ includeKeys: true });
      if (!sources.length) {
        return res.status(404).json({ error: "No platform is connected.", status: 404 });
      }

      const target = explicitKey
        ? sources.find((source) => source.key === explicitKey)
        : sector
          ? sources.find((source) => source.sector === sector)
          : sources[0];

      if (!target) {
        return res.status(404).json({
          error: sector ? `No connected platform for sector "${sector}".` : "That platform is not connected.",
          status: 404
        });
      }

      unregisterSource(target.key);
      await deleteSource(target.key);

      // Drop the analysis too. Leaving it cached would keep the disconnected
      // company's data on the dashboard after it had been removed.
      const stillPresent = listRegisteredSources().some((source) => source.sector === target.sector);
      if (!stillPresent) {
        cacheManager.set(`sector:${target.sector}`, null);
        cacheManager.set(
          "sectorsAnalysed",
          (cacheManager.get("sectorsAnalysed") || []).filter((entry) => entry.sector !== target.sector)
        );
        scheduler.forgetSector(target.sector);
      }

      const remaining = listRegisteredSources();
      await integrationRepository.disconnect();
      await auditLogRepository.logEvent(
        "Integration Disconnected",
        `${target.label || target.endpoint} (${target.sector}) removed from the registry.`
      );
      await syncHistoryRepository.logSync(`Disconnected ${target.label || target.endpoint}.`, "Success");

      // Re-analyse so the remaining platforms become the active view.
      if (remaining.length) await scheduler.runJobs();

      res.json({
        success: true,
        message: `${target.label || target.endpoint} disconnected. ${remaining.length} platform(s) still connected.`,
        disconnected: { sector: target.sector, keyMasked: target.keyMasked, endpoint: target.endpoint },
        platforms: remaining.length,
        // An environment-configured source is reloaded from the deployment
        // config at boot, so say so rather than letting it reappear silently.
        returnsOnRestart: target.origin === "environment"
      });
    } catch (err) {
      next(err);
    }
  }

  async getSyncHistory(_req, res, next) {
    try {
      res.json(await syncHistoryRepository.getHistory());
    } catch (err) {
      next(err);
    }
  }

  async clearSyncHistory(_req, res, next) {
    try {
      await syncHistoryRepository.clearHistory();
      res.json({ success: true, message: "Sync history cleared." });
    } catch (err) {
      next(err);
    }
  }

  async deleteSyncHistory(req, res, next) {
    try {
      const { timestamps } = req.body;
      await syncHistoryRepository.deleteHistory(timestamps);
      res.json({ success: true, message: "Sync history entries deleted." });
    } catch (err) {
      next(err);
    }
  }
}

export const integrationController = new IntegrationController();
