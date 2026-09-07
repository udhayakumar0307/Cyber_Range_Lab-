import { getApiUrl } from "../config/appConfig.js";
import { requestJson } from "./apiClient.js";

export const getAnonymizationOverview = () => requestJson(getApiUrl("/anonymization/overview"));
export const getAnonymizationDatasets = () => requestJson(getApiUrl("/anonymization/datasets"));
export const getAnonymizationPolicies = () => requestJson(getApiUrl("/anonymization/policies"));
export const getAnonymizationActivity = () => requestJson(getApiUrl("/anonymization/activity-log"));
export const getSharingRecords = (query = "") => requestJson(getApiUrl(`/third-party-sharing${query ? `?q=${encodeURIComponent(query)}` : ""}`));
export const getSharingRecord = (shareId) => requestJson(getApiUrl(`/third-party-sharing/${shareId}`));
export const getSharingEvidenceUrl = (shareId) => getApiUrl(`/third-party-sharing/${shareId}/evidence`);
