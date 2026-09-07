import { resolveBundle } from "../routes/sectors.js";
import { scheduler } from "../scheduler/scheduler.js";

class PiiController {
  async getPiiInventory(req, res, next) {
    try {
      let resolved = resolveBundle(req);
      // First caller after a cold start triggers the analysis rather than
      // being handed an empty page.
      if (resolved.error && resolved.status === 503) {
        await scheduler.runJobs();
        resolved = resolveBundle(req);
      }
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });
      res.json(resolved.bundle.piiResult);
    } catch (err) {
      next(err);
    }
  }
}

export const piiController = new PiiController();
