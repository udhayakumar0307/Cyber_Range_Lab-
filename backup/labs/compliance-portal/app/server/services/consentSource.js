import fs from "node:fs/promises";
import { serverConfig } from "../config/appConfig.js";

async function readJsonFromUrl(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Unable to fetch consent data (${response.status})`);
  }

  return response.json();
}

async function readJsonFromFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

function normalizeConsents(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.consents)) return payload.consents;
  }

  return [];
}

export async function loadConsentRecords() {
  if (serverConfig.consentSourceUrl) {
    return normalizeConsents(await readJsonFromUrl(serverConfig.consentSourceUrl));
  }

  if (serverConfig.consentSourceFile) {
    return normalizeConsents(await readJsonFromFile(serverConfig.consentSourceFile));
  }

  throw new Error("Consent data source is not configured. Set CONSENTS_SOURCE_URL or CONSENTS_SOURCE_FILE.");
}
