import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const base = process.env.VERCEL === "1" ? "/" : "/DDPro-App/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
