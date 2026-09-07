import { resolveBundle } from "../routes/sectors.js";
import { scheduler } from "../scheduler/scheduler.js";

class DpdpController {
  async getDpdpCompliance(req, res, next) {
    try {
      let resolved = resolveBundle(req);
      if (resolved.error && resolved.status === 503) {
        await scheduler.runJobs();
        resolved = resolveBundle(req);
      }
      if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });
      res.json(resolved.bundle.dpdpResult);
    } catch (err) {
      next(err);
    }
  }
}

export const dpdpController = new DpdpController();
