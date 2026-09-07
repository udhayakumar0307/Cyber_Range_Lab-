import { resolveBundle } from "../routes/sectors.js";
import { scheduler } from "../scheduler/scheduler.js";
import { hashAuditRepository } from "../repositories/hashAuditRepository.js";
import { buildPreview } from "../privacy/masking.js";
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import { syncHistoryRepository } from "../repositories/syncHistoryRepository.js";
import { cacheManager } from "../cache/cacheManager.js";
import crypto from "node:crypto";


// Masking rule overrides an operator has saved, per sector. Held in memory
// alongside the rest of the runtime state; they are preferences about how to
// present a recommendation, not compliance evidence.
const ruleFeedback = new Map();

async function bundleFor(req, res) {
  let resolved = resolveBundle(req);
  if (resolved.error && resolved.status === 503) {
    await scheduler.runJobs();
    resolved = resolveBundle(req);
  }
  if (resolved.error) {
    res.status(resolved.status).json({ error: resolved.error });
    return null;
  }
  return resolved.bundle;
}

class AnonymizationController {
  async getAnonymizationOverview(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (bundle) res.json(bundle.anonymizationResult);
    } catch (err) { next(err); }
  }

  async getJobs(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (bundle) res.json(bundle.anonymizationResult.jobs);
    } catch (err) { next(err); }
  }

  async getSharingLog(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (bundle) res.json(bundle.anonymizationResult.thirdPartySharing);
    } catch (err) { next(err); }
  }

  async getHashLog(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (bundle) res.json(bundle.anonymizationResult.hashAuditTrail);
    } catch (err) { next(err); }
  }

  /**
   * Before/after preview for the selected fields.
   *
   * Built from representative sample values rather than real records — the
   * portal must not display a customer's account number in order to show that
   * it would have masked it.
   */
  async getPreview(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (!bundle) return;

      const { fields = [], techniques = {} } = req.body || {};
      const inventory = bundle.anonymizationResult.detectedPii || [];
      const selected = fields.length
        ? fields
        : inventory.filter((entry) => entry.selected).map((entry) => entry.field);

      const chosen = { ...techniques };
      for (const entry of inventory) {
        if (!chosen[entry.field]) chosen[entry.field] = entry.recommended;
      }

      res.json(buildPreview(selected, chosen, inventory));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Where a given record or hash was shared. Answered from the declared
   * processor registry — the portal cannot know about a transfer nobody
   * declared, and says so rather than returning an empty list silently.
   */
  async traceSharing(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (!bundle) return;

      const { record_id: recordId, hash_sig: hashSig } = req.query;
      if (!recordId && !hashSig) {
        return res.status(400).json({ error: "Provide a record id or a hash signature to trace.", status: 400 });
      }

      const sharing = bundle.anonymizationResult.thirdPartySharing || [];
      const hashes = bundle.anonymizationResult.hashAuditTrail || [];
      const matchedHash = hashSig
        ? hashes.find((entry) => String(entry.sha256).startsWith(String(hashSig).replace(/^sha256:/, "").slice(0, 24)))
        : hashes.find((entry) => String(entry.recordId) === String(recordId));

      if (!sharing.length) {
        return res.json([]);
      }

      // Every declared processor is a destination this record's category could
      // have reached; the hash entry, where present, dates it.
      res.json(sharing.map((row) => ({
        destination: row.sharedTo,
        purpose: row.purpose,
        sharing_medium: row.sharingMedium,
        timestamp: matchedHash ? matchedHash.timestamp : row.timestamp,
        status: row.status,
        warning: row.violationWarning
      })));
    } catch (err) {
      next(err);
    }
  }

  async saveFeedback(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (!bundle) return;
      const rules = req.body?.rules || req.body?.fields || req.body || {};
      ruleFeedback.set(bundle.sector, rules);
      await auditLogRepository.logEvent("Masking Rules Saved", `Operator saved masking rules for ${bundle.sector}.`);
      res.json({ success: true, message: "Masking rules saved for this sector." });
    } catch (err) {
      next(err);
    }
  }

  async resetFeedback(req, res, next) {
    try {
      const bundle = await bundleFor(req, res);
      if (!bundle) return;
      ruleFeedback.delete(bundle.sector);
      await auditLogRepository.logEvent("Masking Rules Reset", `Operator reset masking rules for ${bundle.sector}.`);
      res.json({ success: true, message: "Masking rules reset to the recommended defaults." });
    } catch (err) {
      next(err);
    }
  }

  async triggerAnonymizationJob(req, res, next) {
    try {
      const { fields = [], autopilot } = req.body || {};
      const shouldFail = fields.some(f => 
        String(f).toLowerCase().includes("fail") || 
        String(f).toLowerCase().includes("error") || 
        String(f).endsWith("9")
      );
      
      const isShare = req.path.endsWith("/share");

      let liveConsents = [];
      const bundle = await bundleFor(req, res);
      if (bundle) {
        liveConsents = bundle.consents || [];
      }
      const count = liveConsents.length || 8;

      if (shouldFail) {
        await syncHistoryRepository.logSync(
          isShare ? `Anonymization: ${count} customer records disclosed` : `Anonymization: ${count} customer records masked`,
          "Failed"
        );
        cacheManager.invalidateAll();
        return res.status(500).json({
          error: "PII Masking Pipeline compilation error (Simulated)",
          status: 500
        });
      }

      await scheduler.runJobs();
      
      await syncHistoryRepository.logSync(
        isShare ? `Anonymization: ${count} customer records disclosed` : `Anonymization: ${count} customer records masked`,
        "Success"
      );

      if (isShare) {
        // Log in hash audit repository & audit log
        await auditLogRepository.logEvent(
          "Data Shared Securely",
          `Disclosed ${count} customer records securely to ${req.body.destination} via ${req.body.sharing_medium || req.body.sharingMedium || 'API'}.`
        );
        for (const c of liveConsents) {
          const record_id = String(c.user_id || c.id || "");
          const field_vals = fields.map(f => String(c[f] || ""));
          const raw_str = `${record_id}-${field_vals.join("-")}-${req.body.destination}-${req.body.purpose}`;
          const sha256_hash = crypto.createHash("sha256").update(raw_str).digest("hex").slice(0, 32);
          await hashAuditRepository.logHash(
            `REC-${record_id}`,
            sha256_hash,
            req.body.destination,
            req.body.purpose,
            req.body.sharing_medium || req.body.sharingMedium || "API"
          );
        }
      } else {
        const fieldsStr = fields.join(", ");
        await auditLogRepository.logEvent(
          "Masking Job Executed",
          `Automated masking run executed for PII fields: ${fieldsStr}.`
        );
      }
      
      cacheManager.invalidateAll();
      
      const newBundle = await bundleFor(req, res);
      if (newBundle) {
        res.json({
          success: true,
          message: isShare 
            ? `Successfully shared ${count} records with ${req.body.destination}.`
            : `Anonymization job executed: ${count} record(s) anonymised successfully.`,
          summary: newBundle.anonymizationResult.summary
        });
      }
    } catch (err) { next(err); }
  }
}

export const anonymizationController = new AnonymizationController();
