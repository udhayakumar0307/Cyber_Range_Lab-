import { API_BASE_URL } from "../config/appConfig";

export async function getConsents() {
  const response = await fetch(`${API_BASE_URL}/consents`);
  if (!response.ok) throw new Error("Failed to load consent records");
  return response.json();
}

export async function updateConsent(id, status) {
  const action = status === "Approved" ? "approve" : "revoke";
  const response = await fetch(`${API_BASE_URL}/consents/${id}/${action}`, {
    method: "PUT"
  });
  if (!response.ok) throw new Error(`Failed to ${action} consent`);
  return response.json();
}

export async function bulkApprove(ids) {
  // Simple simulation of sequential approvals
  for (const id of ids) {
    await updateConsent(id, "Approved");
  }
  return { success: true };
}

export async function bulkRevoke(ids) {
  // Simple simulation of sequential revokes
  for (const id of ids) {
    await updateConsent(id, "Revoked");
  }
  return { success: true };
}

export async function deleteConsentPII(id) {
  const response = await fetch(`${API_BASE_URL}/consents/${id}/delete`, {
    method: "POST"
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to start data deletion");
  }
  return response.json();
}

export async function getDeletionAuditLogs() {
  const response = await fetch(`${API_BASE_URL}/consents/deletion-audit`);
  if (!response.ok) throw new Error("Failed to load data deletion audit logs");
  return response.json();
}
