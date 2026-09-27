import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development the API runs on :4000; proxying keeps requests same-origin.
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return "react";
          if (/[\\/](@tanstack|axios)[\\/]/.test(id)) return "data";
          if (/[\\/](zod|react-hook-form|@hookform)[\\/]/.test(id)) return "forms";
        },
      },
    },
  },
});
