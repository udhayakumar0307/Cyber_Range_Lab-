import express from "express";
import { scheduler } from "../scheduler/scheduler.js";
import { resolveSector, resolveConsentSource, listRegisteredSources } from "../services/consentSources.js";
import {
  processorsFor, addRuntimeProcessor, removeRuntimeProcessor,
  persistProcessor, deletePersistedProcessor
} from "../services/processorRegistry.js";
import { toSharingRows, summariseProcessors } from "../privacy/processors.js";

const router = express.Router();

function sectorFor(request) {
  const apiKey = request.get("x-api-key") ?? request.query.key ?? "";
  if (apiKey) {
    if (!resolveConsentSource(apiKey)) return { error: "Unknown API key", status: 401 };
    return { sector: resolveSector(apiKey), apiKey };
  }
  const explicit = String(request.body?.sector || request.query.sector || "").toLowerCase();
  if (explicit) {
    const source = listRegisteredSources({ includeKeys: true }).find((entry) => entry.sector === explicit);
    return { sector: explicit, apiKey: source?.key };
  }
  const [primary] = listRegisteredSources({ includeKeys: true });
  if (!primary) return { error: "No platform is connected.", status: 503 };
  return { sector: primary.sector, apiKey: primary.key };
}

// Who this platform shares personal data with, and whether each transfer is
// covered by a contract.
router.get("/processors", async (request, response, next) => {
  try {
    const resolved = sectorFor(request);
    if (resolved.error) return response.status(resolved.status).json({ error: resolved.error });

    const processors = await processorsFor(resolved.sector, resolved.apiKey);
    const rows = toSharingRows(processors);
    response.json({
      sector: resolved.sector,
      processors: rows,
      summary: summariseProcessors(rows),
      // An empty registry is not evidence that no data is shared. Saying so
      // keeps a missing disclosure from reading as a clean result.
      declared: rows.length > 0,
      note: rows.length
        ? null
        : "No processors declared. This is not the same as none existing — a data fiduciary that shares personal data must disclose each processor and hold a contract with it (s.8(2))."
    });
  } catch (err) {
    next(err);
  }
});

// Register a processor for platforms whose API cannot declare them.
router.post("/processors", async (request, response, next) => {
  try {
    const resolved = sectorFor(request);
    if (resolved.error) return response.status(resolved.status).json({ error: resolved.error });

    let processor;
    try {
      processor = addRuntimeProcessor(resolved.sector, request.body || {});
    } catch (error) {
      return response.status(400).json({ error: error.message, status: 400 });
    }

    await persistProcessor(resolved.sector, processor);
    await scheduler.runJobs();

    const rows = toSharingRows(await processorsFor(resolved.sector, resolved.apiKey));
    response.json({
      success: true,
      message: `${processor.name} recorded as a processor for ${resolved.sector}.`,
      processor: toSharingRows([processor])[0],
      summary: summariseProcessors(rows)
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/processors/:id", async (request, response, next) => {
  try {
    const resolved = sectorFor(request);
    if (resolved.error) return response.status(resolved.status).json({ error: resolved.error });

    const removed = removeRuntimeProcessor(resolved.sector, request.params.id);
    if (!removed) return response.status(404).json({ error: "That processor is not registered.", status: 404 });

    await deletePersistedProcessor(resolved.sector, request.params.id);
    await scheduler.runJobs();
    response.json({ success: true, message: "Processor removed." });
  } catch (err) {
    next(err);
  }
});

export default router;
