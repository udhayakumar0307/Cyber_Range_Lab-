export function formatStatus(status) {
  const normalized = String(status || "").toLowerCase();
  switch (normalized) {
    case "granted":
    case "approved":
    case "active":
    case "connected":
    case "success":
    case "healthy":
    case "verified":
    case "yes":
      return "success";
    case "pending":
    case "awaiting":
    case "requested":
    case "warning":
    case "running":
    case "scanning":
      return "warning";
    case "revoked":
    case "rejected":
    case "danger":
    case "critical":
    case "failed":
    case "disconnected":
    case "no":
      return "danger";
    default:
      return "info";
  }
}
