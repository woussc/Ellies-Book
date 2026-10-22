// Pages-only client bootstrap for the GitHub Pages static preview.
//
// [Fact] This entry is ADDITIVE. It is NOT part of the Cloudflare Worker build
// (vite.config.ts / worker/index.ts). It mounts the existing client-first
// workbench shell (app/page.tsx default export `Home`) into a plain static
// index.html, with NO server, NO SSR, NO D1, and NO /api/sync route.
//
// [Fact] It imports only client-safe modules: React, the app shell, and the
// Pages-local stylesheet ./pages.css, which re-imports app/globals.css and
// adds explicit Tailwind v4 @source directives for the preview build only. It
// must NOT import worker/index.ts,
// @cloudflare/vite-plugin, the sites() plugin, db/, or app/api. The app shell
// (`Home`) already imports only ./budget-domain.mjs (pure engine) and
// ./ellies-book-workbench (both "use client"), so the import graph stays
// server-free.
//
// [Fact] triggerHybridSync() in app/ellies-book-workbench.tsx already fails
// safe: when fetch('/api/sync') fails it shows local-only copy, so the missing
// server route on Pages degrades gracefully with no code change.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "./pages.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Pages preview: #root container not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <div className="studio-app-root">
      <Home />
    </div>
  </StrictMode>,
);
