import { API_BASE_URL } from "../config/appConfig";

export async function getReportsData() {
  const response = await fetch(`${API_BASE_URL}/reports`);
  if (!response.ok) throw new Error("Failed to load reports matrix");
  return response.json();
}

export async function generateReport(name, type) {
  const response = await fetch(`${API_BASE_URL}/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type })
  });
  if (!response.ok) throw new Error("Failed to trigger report generation");
  return response.json();
}
