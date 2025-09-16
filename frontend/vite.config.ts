import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    css: {
      preprocessorOptions: {},
    },
    envPrefix: ["VITE_", "BACKEND_"],
    server: {
      host: "0.0.0.0",
      port: Number(env.VITE_PORT ?? 5173),
    },
  };
});
