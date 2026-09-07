import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const server = {};

  if (env.VITE_DEV_HOST) server.host = env.VITE_DEV_HOST;
  if (env.VITE_DEV_PORT) server.port = Number(env.VITE_DEV_PORT);

  return {
    plugins: [react()],
    server,
    preview: server
  };
});