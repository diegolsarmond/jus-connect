import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const proxyTarget =
    process.env.VITE_BACKEND_PROXY ||
    process.env.API_PROXY_TARGET ||
    process.env.BACKEND_URL ||
    "http://localhost:3000";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    root: path.resolve(__dirname, "frontend"),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "frontend/src"),
      },
    },
  };
});