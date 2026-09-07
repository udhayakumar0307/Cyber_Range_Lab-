function readEnv(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function joinUrl(baseUrl, path = "") {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path ? `/${String(path).replace(/^\/+/, "")}` : "";
  return `${normalizedBase}${normalizedPath}`;
}

export const serverConfig = {
  apiBaseUrl: readEnv("VITE_API_BASE_URL"),
  consentSourceUrl: readEnv("CONSENTS_SOURCE_URL"),
  consentSourceFile: readEnv("CONSENTS_SOURCE_FILE")
};

export function getServerApiUrl(path = "") {
  if (!serverConfig.apiBaseUrl) {
    throw new Error("Missing required configuration: VITE_API_BASE_URL");
  }

  return joinUrl(serverConfig.apiBaseUrl, path);
}
