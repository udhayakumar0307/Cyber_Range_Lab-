import { complianceTestKeys, getConsentsForApiKey, getPiiResultsFromConsents } from "../data/consentScenarios.js";
import { fetchConsents } from "../server/services/consentSources.js";

const CONSENT_ROW_LIMIT = Number(process.env.ECOMMERCE_CONSENT_LIMIT || process.env.CONSENT_LIMIT || 500);

export default async function handler(request, response) {
  const authorization = request.headers["authorization"] ?? "";
  const apiKey = request.headers["x-api-key"] ?? authorization.replace("Bearer ", "") ?? "";

  try {
    let consents = null;
    try {
      consents = await fetchConsents(apiKey, CONSENT_ROW_LIMIT);
    } catch (e) {
      console.warn("Live fetchConsents failed in serverless function:", e.message);
    }

    if (consents === null) {
      consents = getConsentsForApiKey(apiKey);
    }

    if (consents !== null) {
      const results = getPiiResultsFromConsents(consents);
      return response.status(200).json({
        results,
        total: results.length
      });
    }

    return response.status(401).json({ error: "Invalid API Key" });
  } catch (error) {
    return response.status(502).json({ error: "Unable to fetch PII results: " + error.message });
  }
}
