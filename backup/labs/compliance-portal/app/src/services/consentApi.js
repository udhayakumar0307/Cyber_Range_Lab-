import { API_BASE_URL } from "../config/appConfig.js";

/**
 * Fetch consent records from the CMS backend.
 * The backend uses its own registered API key to talk to the live website —
 * the frontend never needs to supply the raw key.
 */
export async function fetchConsents(_apiKey = "") {
  const response = await fetch(`${API_BASE_URL}/consents`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
