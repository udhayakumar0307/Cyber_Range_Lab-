import { getApiUrl } from "../config/appConfig.js";
import { requestJson } from "./apiClient.js";

async function request(endpoint, options = {}) {
  return requestJson(getApiUrl(endpoint), options);
}

// --- Principals ---
export const registerPrincipal = (data) => request("/principals/register", { method: "POST", body: JSON.stringify(data) });
export const getPrincipal = (id) => request(`/principals/${id}`);

// --- Nominees ---
export const createNominee = (data) => request("/nominees", { method: "POST", body: JSON.stringify(data) });
export const getNomineesByPrincipal = (id) => request(`/nominees/principal/${id}`);
export const deactivateNominee = (id) => request(`/nominees/${id}/deactivate`, { method: "PATCH" });

// --- DSR Requests ---
export const createDsrRequest = (data) => request("/dsr", { method: "POST", body: JSON.stringify(data) });

export const listDsrRequests = (filters = {}) => {
  const params = new URLSearchParams(filters);
  return request(`/dsr?${params.toString()}`);
};

export const getDsrRequest = (id) => request(`/dsr/${id}`);

export const updateDsrStatus = (id, data) => request(`/dsr/${id}/status`, { method: "PATCH", body: JSON.stringify(data) });

export const getDsrActivity = (id) => request(`/dsr/${id}/activity`);

// --- Right to Access ---
export const respondToAccessRequest = (requestId, data) => request(`/dsr/access/${requestId}/respond`, { method: "POST", body: JSON.stringify(data) });

// --- Right to Correction/Erasure ---
export const applyCorrectionErasure = (requestId, data) => request(`/dsr/correction-erasure/${requestId}/apply`, { method: "POST", body: JSON.stringify(data) });

// --- Right to Grievance ---
export const escalateGrievance = (requestId, data) => request(`/dsr/grievance/${requestId}/escalate`, { method: "POST", body: JSON.stringify(data) });
export const recordOfficerResponse = (requestId, data) => request(`/dsr/grievance/${requestId}/officer-response`, { method: "POST", body: JSON.stringify(data) });

// --- Right to Nominate ---
export const registerNomineeAndRequest = (data) => request("/dsr/nominate", { method: "POST", body: JSON.stringify(data) });
export const submitDsrAsNominee = (nomineeId, data) => request(`/dsr/nominate/${nomineeId}/submit-dsr`, { method: "POST", body: JSON.stringify(data) });

// --- Grievance Officers ---
export const createOfficer = (data) => request("/officers", { method: "POST", body: JSON.stringify(data) });
export const listOfficers = () => request("/officers");