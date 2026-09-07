import { API_BASE_URL } from "../config/appConfig";

export async function getIntegrationData() {
  // We want to combine config details with sync history
  const [configRes, historyRes] = await Promise.all([
    fetch(`${API_BASE_URL}/integration/config`),
    fetch(`${API_BASE_URL}/integration/sync-history`)
  ]);

  if (!configRes.ok || !historyRes.ok) {
    throw new Error("Failed to load store integration details");
  }

  const config = await configRes.json();
  const history = await historyRes.json();

  return {
    ...config,
    history
  };
}

export async function verifyConnection(payload) {
  // The form keeps its state in snake_case; the API speaks camelCase. Convert
  // at this boundary — sending the form object straight through made every
  // connect attempt fail validation regardless of what was typed.
  const body = {
    storeName: payload.store_name,
    storeUrl: payload.store_url,
    platform: payload.platform,
    apiKey: payload.api_key,
    secret: payload.secret,
    sector: payload.sector || ""
  };
  const response = await fetch(`${API_BASE_URL}/integration/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || "Could not verify the connection.");
  }
  return response.json();
}

export async function regenerateApiKey() {
  // Regenerate is tested via verify/test endpoints locally in Phase 2
  return { success: true };
}

export async function disconnectStore(sector) {
  // The page only ever holds a masked key, so the platform is identified by its
  // sector. Sending no identifier at all was why disconnect reported success
  // and left the platform connected.
  const response = await fetch(`${API_BASE_URL}/integration/disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sector: sector || "" })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Could not disconnect the platform.");
  return result;
}

export async function clearSyncHistory() {
  const response = await fetch(`${API_BASE_URL}/integration/clear-sync-history`, {
    method: "POST"
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to clear sync history");
  }
  return response.json();
}

export async function deleteSyncHistory(timestamps) {
  const response = await fetch(`${API_BASE_URL}/integration/delete-sync-history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamps })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete sync history");
  }
  return response.json();
}
