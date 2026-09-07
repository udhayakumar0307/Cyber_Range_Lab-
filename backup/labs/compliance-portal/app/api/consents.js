import { getConsentsForApiKey } from "../data/consentScenarios.js";

function getApiKey(request) {
  const authorization = request.headers.authorization ?? "";

  return request.headers["x-api-key"] ?? authorization.replace("Bearer ", "");
}

export default function handler(request, response) {
  const data = getConsentsForApiKey(getApiKey(request));
  if (data === null) {
    return response.status(401).json({ error: "Invalid API Key: Database connection failed or unauthorized." });
  }
  response.status(200).json(data);
}
