import { API_BASE_URL } from "../config/appConfig";

export async function getAnonymizationData() {
  const response = await fetch(`${API_BASE_URL}/anonymization`);
  if (!response.ok) throw new Error("Failed to load anonymization data");
  return response.json();
}

export async function triggerAnonymizeJob(payload) {
  const response = await fetch(`${API_BASE_URL}/anonymization/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to trigger anonymization masking job");
  }
  return response.json();
}

export async function triggerThirdPartyShare(payload) {
  const response = await fetch(`${API_BASE_URL}/anonymization/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to trigger secure third-party sharing");
  }
  return response.json();
}

export async function submitOverrideFeedback(payload) {
  const response = await fetch(`${API_BASE_URL}/anonymization/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to save classification feedback");
  }
  return response.json();
}

export async function resetOverrideFeedback() {
  const response = await fetch(`${API_BASE_URL}/anonymization/reset-feedback`, {
    method: "POST"
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to reset feedback rules");
  }
  return response.json();
}

export async function getAnonymizationPreview(payload) {
  const response = await fetch(`${API_BASE_URL}/anonymization/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to load anonymization preview");
  }
  return response.json();
}

export async function traceLeak(params) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/anonymization/trace?${query}`);
  if (!response.ok) throw new Error("Failed to trace leak signature");
  return response.json();
}
