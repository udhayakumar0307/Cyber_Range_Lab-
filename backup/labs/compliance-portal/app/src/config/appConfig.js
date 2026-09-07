const base = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, "")
  : "http://localhost:4000";

export const API_BASE_URL = `${base}/api/v1`;
export const APP_NAME = "Company Privacy & DPDP Command Center";
export const STORE_NAME = "Privacy Shield Platform";

export const appConfig = {
  aiUrl: import.meta.env.VITE_AI_URL || "",
  aiModel: import.meta.env.VITE_AI_MODEL || "",
};

export function getRequiredValue(val, envName) {
  return val || import.meta.env[envName] || "";
}

export function getConsentApiUrl() {
  return `${base}/api/consents`;
}

export function getPiiResultsApiUrl() {
  return `${base}/api/pii-results`;
}

export function getPiiRiskDetailsApiUrl() {
  return `${base}/api/pii-risk-details`;
}

export function getClassificationApiUrl() {
  return `${base}/api/pull-and-classify`;
}

export function getApiUrl(endpoint) {
  return `${base}/api${endpoint}`;
}
