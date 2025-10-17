import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
const normalizeBasePath = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  if (withLeadingSlash.length === 1) {
    return withLeadingSlash;
  }

  return withLeadingSlash.replace(/\/+$/, "");
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeBasePath(env.VITE_APP_BASE_PATH),
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@supabase/supabase-js": path.resolve(
          __dirname,
          "./libs/supabase-js/index.js",
        ),
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/setupTests.ts",
      globals: true,
      css: true,
    },
  };
});
