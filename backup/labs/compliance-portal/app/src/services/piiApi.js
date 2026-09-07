import { getPiiResultsApiUrl } from "../config/appConfig.js";
import { requestJson } from "./apiClient.js";

export async function fetchPiiResults(apiKey = "") {
  const url = getPiiResultsApiUrl();
  const headers = {};
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  const payload = await requestJson(url, { headers });
  const results = Array.isArray(payload) ? payload : Array.isArray(payload.results) ? payload.results : [];
  return {
    results,
    total: Number(payload.total ?? results.length ?? 0)
  };
}
