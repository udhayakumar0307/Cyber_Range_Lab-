import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const server = {};

  if (env.VITE_DEV_HOST) server.host = env.VITE_DEV_HOST;
  if (env.VITE_DEV_PORT) server.port = Number(env.VITE_DEV_PORT);

  // When the lab is exposed under a reverse-proxy sub-path instead of its own
  // origin (e.g. https://range/compliance-lab/), set VITE_BASE_PATH=/compliance-lab/
  // and VITE_API_BASE_URL=/compliance-lab/api at build time. Defaults to "/"
  // (its own origin / a dedicated sub-domain), which needs no extra config.
  const base = env.VITE_BASE_PATH || "/";

  return {
    base,
    plugins: [react()],
    server,
    preview: server
  };
});