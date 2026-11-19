import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Isolated comparison build. Does not alter the app or the live Pages demo.
export default defineConfig({
  root: fileURLToPath(new URL("./app/look-a-preview", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  server: { host: "0.0.0.0", port: 5180, allowedHosts: true },
  preview: { host: "0.0.0.0", port: 5180, allowedHosts: true },
  build: { outDir: fileURLToPath(new URL("./dist-look-a", import.meta.url)), emptyOutDir: true },
});
