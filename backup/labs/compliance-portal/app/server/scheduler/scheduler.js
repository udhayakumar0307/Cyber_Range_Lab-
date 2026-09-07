import { cacheManager } from "../cache/cacheManager.js";
import { fetchConsents, listRegisteredSources } from "../services/consentSources.js";
import { syncHistoryRepository } from "../repositories/syncHistoryRepository.js";
import { processorsFor } from "../services/processorRegistry.js";

// Analyzers are imported lazily to keep the module graph acyclic.
let consentAnalyzer, dpdpAnalyzer, piiAnalyzer, anonymizationAnalyzer, dashboardAnalyzer;

async function loadAnalyzers() {
  if (!consentAnalyzer) {
    consentAnalyzer = (await import("../analysis/consentAnalyzer.js")).default;
    dpdpAnalyzer = (await import("../analysis/dpdpAnalyzer.js")).default;
    piiAnalyzer = (await import("../analysis/piiAnalyzer.js")).default;
    anonymizationAnalyzer = (await import("../analysis/anonymizationAnalyzer.js")).default;
    dashboardAnalyzer = (await import("../analysis/dashboardAnalyzer.js")).default;
  }
}

const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MINUTES || 5) * 60 * 1000;

class Scheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.lastRunAt = null;
    this.lastError = null;
    // Per-source health, so a rejected key is visible in the UI instead of
    // only in the log.
    this.health = new Map();
  }

  /** Drop everything remembered about a sector that is no longer connected. */
  forgetSector(sector) {
    this.health.delete(sector);
    if (!this.health.size) this.lastRunAt = null;
  }

  /** Health of every source, worst first. */
  sourceHealth() {
    return [...this.health.values()].sort((a, b) => (a.state === "ok" ? 1 : 0) - (b.state === "ok" ? 1 : 0));
  }

  start() {
    if (this.intervalId) return;
    console.log(`Scheduler started (every ${SYNC_INTERVAL_MS / 60000} min).`);
    this.intervalId = setInterval(() => this.runJobs(), SYNC_INTERVAL_MS);
    setTimeout(() => this.runJobs(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Scheduler paused.");
    }
  }

  getStatus() {
    const sources = listRegisteredSources();
    if (!sources.length) {
      return {
        status: "NOT_CONNECTED",
        current_task: "No consent source registered. Set CONSENT_SOURCES.",
        progress: 0,
        sources: 0
      };
    }
    if (this.isRunning) {
      return { status: "SYNCING", current_task: "Fetching and analysing consent sources", progress: 50, sources: sources.length };
    }
    if (this.lastRunAt) {
      const failing = this.sourceHealth().filter((entry) => entry.state !== "ok");
      return {
        status: "READY",
        current_task: failing.length
          ? `${failing.length} of ${sources.length} platform(s) need attention`
          : "Idle",
        progress: 100,
        last_run: this.lastRunAt,
        sources: sources.length,
        healthy: sources.length - failing.length,
        failing: failing.map((entry) => ({
          sector: entry.sector, keyMasked: entry.keyMasked,
          endpoint: entry.endpoint, state: entry.state, error: entry.error
        })),
        last_error: this.lastError
      };
    }
    return {
      status: "PENDING",
      current_task: this.lastError ? `Last run failed: ${this.lastError}` : "Awaiting first synchronisation",
      progress: 0,
      sources: sources.length
    };
  }

  /**
   * Analyse one registered source and cache the result under its sector.
   * `prefetched` lets a caller that has already read the source pass the
   * records straight in — onboarding verifies a company by reading its route,
   * and fetching the whole dataset a second time to analyse it doubled the time
   * the operator waits and was the difference between connecting and timing out.
   */
  async analyseOne(source, prefetched = null) {
    await loadAnalyzers();
    const sector = source.sector || "generic";
    const records = prefetched || await fetchConsents(source.key, Number(process.env.CONSENT_LIMIT || 500));
    const consents = records || [];

    const consentResult = await consentAnalyzer.analyze(consents, sector);
    const piiResult = await piiAnalyzer.analyze(consents, sector);
    const dpdpResult = await dpdpAnalyzer.analyze(consents, consentResult, sector);
    const processors = await processorsFor(sector, source.key);
    const anonymizationResult = await anonymizationAnalyzer.analyze(consents, sector, piiResult, processors);
    const syncedAt = new Date().toISOString();

    const dashboard = await dashboardAnalyzer.analyze({
      consentResult, piiResult, dpdpResult, anonymizationResult,
      sector, sourceLabel: source.label || source.endpoint, syncedAt
    });

    const bundle = {
      sector, syncedAt, records: consents.length,
      consentResult, piiResult, dpdpResult, anonymizationResult, dashboard, consents
    };
    cacheManager.set(`sector:${sector}`, bundle);

    // Keep run state consistent whether a sector was analysed by the scheduled
    // sweep or by onboarding a company just now — otherwise a freshly connected
    // platform shows data on its own page while the engine still reports that
    // nothing has run and the cross-sector overview stays empty.
    const analysed = (cacheManager.get("sectorsAnalysed") || []).filter((entry) => entry.sector !== sector);
    analysed.push({ sector, records: consents.length });
    cacheManager.set("sectorsAnalysed", analysed);
    this.lastRunAt = syncedAt;
    this.lastError = null;
    this.health.set(sector, {
      sector, keyMasked: source.keyMasked || null, endpoint: source.endpoint || null,
      state: "ok", lastSuccessAt: syncedAt, records: consents.length, error: null, code: null, failures: 0
    });

    // A keyless caller sees the first analysed sector.
    if (!cacheManager.get("dashboard") || analysed.length === 1) {
      cacheManager.set("dashboard", dashboard);
      cacheManager.set("consents", consents);
      cacheManager.set("pii", piiResult);
      cacheManager.set("dpdp", dpdpResult);
      cacheManager.set("anonymization", anonymizationResult);
    }
    return bundle;
  }

  async runJobs() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const sources = listRegisteredSources({ includeKeys: true });
      if (!sources.length) {
        this.lastError = "No consent source registered";
        console.warn("Scheduler: no consent sources registered; nothing to analyse.");
        return;
      }

      const analysed = [];
      for (const source of sources) {
        try {
          const bundle = await this.analyseOne(source);
          analysed.push({ sector: bundle.sector, records: bundle.records });
          this.health.set(source.sector, {
            sector: source.sector, keyMasked: source.keyMasked, endpoint: source.endpoint,
            state: "ok", lastSuccessAt: bundle.syncedAt, records: bundle.records,
            error: null, code: null, failures: 0
          });
          console.log(
            `Scheduler: ${bundle.sector} — ${bundle.records} records, ` +
            `risk ${bundle.piiResult.summary.privacyRiskValue}/100, ` +
            `compliance ${bundle.dpdpResult.compliancePercent}%.`
          );
        } catch (error) {
          const previous = this.health.get(source.sector);
          const failures = (previous?.failures || 0) + 1;
          this.health.set(source.sector, {
            sector: source.sector, keyMasked: source.keyMasked, endpoint: source.endpoint,
            state: error.code === "AUTH_REJECTED" ? "auth-failed" : "unreachable",
            lastSuccessAt: previous?.lastSuccessAt || null, records: previous?.records || 0,
            error: error.message, code: error.code || null, failures
          });
          // A misconfigured source fails identically every cycle. Log it once,
          // then stay quiet until the cause changes or it recovers, so a single
          // bad key cannot bury everything else in the log.
          if (previous?.error !== error.message) {
            console.warn(`Scheduler: ${source.sector} (${source.keyMasked}) — ${error.message}`);
          } else if (failures % 12 === 0) {
            console.warn(`Scheduler: ${source.sector} still failing after ${failures} attempts — ${error.message}`);
          }
        }
      }

      // One broken source must never stop the working ones from being analysed.
      if (!analysed.length) {
        const reasons = [...this.health.values()].filter((h) => h.state !== "ok").map((h) => `${h.sector}: ${h.error}`);
        throw new Error(reasons.length ? reasons.join("; ") : "every registered source failed");
      }

      // The default (keyless) view is the first source that analysed cleanly.
      const primary = cacheManager.get(`sector:${analysed[0].sector}`);
      cacheManager.set("dashboard", primary.dashboard);
      cacheManager.set("consents", primary.consents);
      cacheManager.set("pii", primary.piiResult);
      cacheManager.set("dpdp", primary.dpdpResult);
      cacheManager.set("anonymization", primary.anonymizationResult);
      cacheManager.set("sectorsAnalysed", analysed);

      this.lastRunAt = new Date().toISOString();
      this.lastError = null;
      await this.record(
        `Analysed ${analysed.length} sector(s): ${analysed.map((a) => `${a.sector} (${a.records})`).join(", ")}`,
        "Success"
      );
    } catch (error) {
      this.lastError = error.message;
      console.error("Scheduler run failed:", error.message);
      await this.record(`Synchronisation failure: ${error.message}`, "Failed");
    } finally {
      this.isRunning = false;
    }
  }

  /** Recorded in memory always, and to the database when one is configured. */
  async record(event, status) {
    await syncHistoryRepository.logSync(event, status);
  }
}

export const scheduler = new Scheduler();
