import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { resolveViteApiBase } from "./vite.api-base";

const port = Number(process.env.PORT ?? 5174);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(({ command }) => {
  const apiOrigin = resolveViteApiBase(command);

  return {
    base: basePath,
    define: {
      // Production build → "https://api.skillad.in"
      // Dev server → "" → relative /api/... (proxied below)
      __API_BASE__: JSON.stringify(apiOrigin),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            ui: ["framer-motion", "lucide-react"],
          },
        },
      },
      // Ensure Hostinger deploy files from public/ are copied (default Vite behavior)
      copyPublicDir: true,
    },
    server: {
      port,
      strictPort: false,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
    },
  };
});
