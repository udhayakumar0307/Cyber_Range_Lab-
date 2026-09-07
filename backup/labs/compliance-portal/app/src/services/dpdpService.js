import { API_BASE_URL } from "../config/appConfig";

export async function getDpdpData() {
  const response = await fetch(`${API_BASE_URL}/dpdp`);
  if (!response.ok) throw new Error("Failed to load DPDP Compliance audit");
  return response.json();
}
