import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getConsentsForApiKey, complianceTestKeys, getPiiResultsFromConsents, getPiiRiskDetailsFromResults } from '../data/consentScenarios.js';
import { fetchConsents, resolveSector } from './services/consentSources.js';
import { getDatabaseColumns } from './services/dbSchema.js';
import { redactRecords } from './privacy/redact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DSR Routes
import principalsRoutes from './routes/principals.js';
import nomineesRoutes from './routes/nominees.js';
import dsrRoutes from './routes/dsr.js';
import accessRoutes from './routes/access.js';
import correctionErasureRoutes from './routes/correctionErasure.js';
import grievanceRoutes from './routes/grievance.js';
import nominateRoutes from './routes/nominate.js';
import officersRoutes from './routes/officers.js';
import anonymizationRoutes from './routes/anonymization.js';
import thirdPartySharingRoutes from './routes/thirdPartySharing.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 4000;
const CONSENT_ROW_LIMIT = Number(process.env.ECOMMERCE_CONSENT_LIMIT || process.env.CONSENT_LIMIT || 500);

function readApiKey(request) {
  const authorization = request.get("authorization") ?? "";
  return request.get("x-api-key") ?? authorization.replace("Bearer ", "");
}

import { initializeSchema } from './config/db.js';
import { scheduler } from './scheduler/scheduler.js';
import { ensureSourceTable, loadPersistedSources } from './repositories/sourceRepository.js';
import { ensureProcessorTable, loadPersistedProcessors } from './services/processorRegistry.js';
import cmsRouter from './routes/cms.js';

app.use(cors());
app.use(express.json());

// Mount the CMS Version 1 API routes
app.use('/api/v1', cmsRouter);

// ─── Existing Routes ────────────────────────────────────────────
app.get("/api/consents", async (request, response, next) => {
  const apiKey = readApiKey(request);

  // Registered key → fetch live consent from that company's source (URL or DB).
  try {
    const live = await fetchConsents(apiKey, CONSENT_ROW_LIMIT);
    if (live !== null) {
      // Presence, not content — the portal must not hand out personal data.
      return response.json(redactRecords(live, resolveSector(apiKey)));
    }
  } catch (error) {
    console.warn(`Live consent fetch failed for key: ${apiKey}. Falling back to demo data. Error: ${error.message}`);
  }

  // Otherwise fall back to the built-in demo scenarios (null → invalid key).
  const data = getConsentsForApiKey(apiKey);
  if (data === null) {
    return response.status(401).json({ error: "Invalid API Key: Database connection failed or unauthorized." });
  }
  response.json(redactRecords(data, resolveSector(apiKey)));
});

app.get("/api/pii-results", async (request, response) => {
  const authorization = request.get("authorization") ?? "";
  const apiKey = request.get("x-api-key") ?? authorization.replace("Bearer ", "") ?? "";

  try {
    let consents = null;
    try {
      consents = await fetchConsents(apiKey, CONSENT_ROW_LIMIT);
    } catch (e) {
      console.warn("Live fetchConsents failed:", e.message);
    }

    if (consents === null) {
      consents = getConsentsForApiKey(apiKey);
    }

    if (consents !== null) {
      const results = getPiiResultsFromConsents(consents);
      return response.json({
        results,
        total: results.length
      });
    }

    return response.status(401).json({ error: "Invalid API Key" });
  } catch (error) {
    return response.status(502).json({ error: "Unable to fetch PII results: " + error.message });
  }
});

app.get("/api/pull-and-classify", async (request, response) => {
  response.json({ status: "success", message: "PII classification completed." });
});

app.get("/api/pii-risk-details", async (request, response) => {
  const authorization = request.get("authorization") ?? "";
  const apiKey = request.get("x-api-key") ?? authorization.replace("Bearer ", "") ?? "";

  try {
    let consents = null;
    try {
      consents = await fetchConsents(apiKey, CONSENT_ROW_LIMIT);
    } catch (e) {
      console.warn("Live fetchConsents failed:", e.message);
    }

    if (consents === null) {
      consents = getConsentsForApiKey(apiKey);
    }

    if (consents !== null) {
      const results = getPiiResultsFromConsents(consents);
      const riskDetails = getPiiRiskDetailsFromResults(results);
      return response.json(riskDetails);
    }

    return response.status(401).json({ error: "Invalid API Key" });
  } catch (error) {
    return response.status(502).json({ error: "Unable to fetch PII risk details: " + error.message });
  }
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

// ─── DSR Routes ─────────────────────────────────────────────────
app.use('/api/principals', principalsRoutes);
app.use('/api/nominees', nomineesRoutes);
app.use('/api/dsr', dsrRoutes);
app.use('/api/dsr/access', accessRoutes);
app.use('/api/dsr/correction-erasure', correctionErasureRoutes);
app.use('/api/dsr/grievance', grievanceRoutes);
app.use('/api/dsr/nominate', nominateRoutes);
app.use('/api/officers', officersRoutes);
app.use('/api/anonymization', anonymizationRoutes);
app.use('/api/third-party-sharing', thirdPartySharingRoutes);

// ─── Serve the built frontend (production single-container deploy) ──
const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback for any non-API route
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.join(distPath, "index.html"));
  });
}

// ─── Error Handler (must be last) ───────────────────────────────
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Bootstrap tables and kick off background scheduler
  await initializeSchema();
  await ensureSourceTable();
  await loadPersistedSources();
  await ensureProcessorTable();
  await loadPersistedProcessors();
  scheduler.start();
});
