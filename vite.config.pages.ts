// Pages-only Vite config for the GitHub Pages STATIC preview.
//
// [Fact] This file is ADDITIVE and SEPARATE from vite.config.ts. The default
// `vinext build` (the Cloudflare Worker source of truth in vite.config.ts) is
// untouched. This config is invoked ONLY by the `build:pages` script.
//
// [Fact] It builds a plain client React SPA (no vinext, no SSR, no
// @cloudflare/vite-plugin, no sites() plugin, no worker/index.ts, no db/, no
// app/api). It reuses the existing client components and app/globals.css.
//
// [Fact] GitHub PROJECT Pages serve under /<repo>/, here /Ellies-Book/, so the
// base path is set to '/Ellies-Book/' for THIS build only. Setting base
// globally in vite.config.ts would break the Worker build and local dev, so it
// lives here instead.
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import { defineConfig } from "vite";

// [Fact] GitHub project Pages base path. Must match the repository name.
// If the repo is renamed or served from a user/org root domain, update this
// single value (and the matching base in pages.yml, if present).
const PAGES_BASE = "/Ellies-Book/";

export default defineConfig({
  // Resolve relative to this config file so `pnpm run build:pages` works from
  // the repo root. The project root for this build is pages-preview/, which
  // holds the static index.html entry and the client bootstrap.
  root: fileURLToPath(new URL("./pages-preview", import.meta.url)),
  base: PAGES_BASE,
  // Serve the existing favicon/svg assets from the repo's public/ folder.
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  css: {
    // app/globals.css uses `@import "tailwindcss"`, so Tailwind must run via
    // PostCSS for the preview build. @tailwindcss/postcss is already a devDep.
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  plugins: [react()],
  build: {
    // [Unknown -> adjust-after-first-CI-run] Output dir for the Pages artifact.
    // dist-pages is isolated from the Worker's dist/ so the two builds never
    // collide. This is the ONE line most likely to need adjustment after the
    // first GitHub Pages CI run (W9-T4 / FEAT-003): if the deploy workflow or
    // vinext static mode expects a different directory (e.g. `out`), change
    // `outDir` here and the matching `path:` in pages.yml together.
    outDir: fileURLToPath(new URL("./dist-pages", import.meta.url)),
    emptyOutDir: true,
  },
});
