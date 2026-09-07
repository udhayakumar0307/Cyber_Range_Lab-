import { API_BASE_URL } from "../config/appConfig";

export async function getPiiData() {
  const response = await fetch(`${API_BASE_URL}/pii`);
  if (!response.ok) throw new Error("Failed to load PII inventory");
  return response.json();
}
