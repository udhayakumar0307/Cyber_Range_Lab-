import { API_BASE_URL } from "../config/appConfig";

export async function getDashboardData() {
  const response = await fetch(`${API_BASE_URL}/dashboard`);
  if (!response.ok) throw new Error("Failed to load dashboard data");
  return response.json();
}
