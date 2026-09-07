import { API_BASE_URL } from "../config/appConfig";

export async function getSettingsData() {
  const response = await fetch(`${API_BASE_URL}/settings`);
  if (!response.ok) throw new Error("Failed to load settings data");
  return response.json();
}

export async function updateSettingsData(data) {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error("Failed to update settings data");
  return response.json();
}
