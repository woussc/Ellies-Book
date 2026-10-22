# ADR 0004: GitHub Pages Static Preview (Cloudflare-Free Visual Preview)

- **Status**: Proposed
- **Date**: 2026-10-21
- **Decider**: **SHUAI** (`Chen Shuaizhou`)
- **Scope**: Preview Deployment, Static Hosting, CI/CD

---

## 1. Context

SHUAI does not have a Cloudflare account yet and wants to open Ellie's Book in a browser soon to review it visually. The goal is a fast, shareable visual preview that needs no Cloudflare account and no server runtime.

GitHub Pages is the chosen preview host because the repository already lives on GitHub and Pages is free, static, and requires no third-party account.

Key facts that frame the decision:

- `[Fact]` The production build today targets a **Cloudflare Worker**. `vite.config.ts` wires `@cloudflare/vite-plugin`; `worker/index.ts` is the Worker entry; the build output is `dist/`, with `dist/server/index.js` as the Worker SSR bundle.
- `[Fact]` `app/page.tsx` and `app/ellies-book-workbench.tsx` both begin with `"use client"`, so the workbench UI runs entirely in the browser. `app/budget-domain.mjs` is a pure, dependency-free engine.
- `[Fact]` `triggerHybridSync()` in `app/ellies-book-workbench.tsx` already fails safe. When `fetch('/api/sync')` fails it catches the error and shows local-only copy ("Saved on this device. Cloud backup is not reachable right now."). A missing `/api/sync` route therefore degrades gracefully with no code change.
- `[Fact]` GitHub Pages serves **static files only**. There is no Worker runtime, no SSR server, no D1 database, and no `/api/sync` server route.
- `[Fact]` GitHub **project** Pages serve under `/<repo>/`, here `/Ellies-Book/`, so a base path `/Ellies-Book/` is likely required for the preview build.

### Feasibility finding: vinext static export

- `[Unknown]` Whether vinext `1.0.0-beta.2` exposes a static, SSG, or SPA export mode is not confirmed. No repo config enables it today. The npm registry is blocked in the build sandbox (HTTP 403, no `node_modules`), so the capability could not be probed locally. **The first GitHub Pages CI run is the authoritative proof.**

---

## 2. Decision (`[Proposed]`)

Stand up a GitHub Pages **static preview** of Ellie's Book that runs without Cloudflare, alongside the existing Cloudflare Worker build.

### Decision 1: Static-only preview target
- `[Fact]` The preview serves static assets from GitHub Pages under the base path `/Ellies-Book/`.
- `[Inference]` Because the workbench is `"use client"`, the React UI can mount and run in the browser from static assets, without the Worker or SSR path.

### Decision 2: Build approach, preferred then fallback
- `[Projection]` **Preferred**: use vinext's own static output if `vinext build` (or a documented flag) can emit a static/SSG/SPA bundle. `[Unknown]` existence, confirmed by the first CI run.
- `[Inference]` **Documented fallback**: if vinext has no static mode, build a **Vite client-SPA shell** that mounts the React workbench and skips the Worker/SSR path. Serve a `404.html` that falls back to `index.html` for client-side routing. Set the Vite base to `/Ellies-Book/`.

### Decision 3: Preview coexists with, and does not replace, the Cloudflare Worker deploy
- `[Fact]` This ADR adds a preview channel only. The Cloudflare Worker deploy (SSR + D1 + `/api/sync`, per ADR 0001 Decision 1) remains the planned production target and is untouched.
- `[Inference]` The two channels are independent: the Pages preview is for fast visual review without an account; the Worker deploy is the full hybrid product.

---

## 3. What works vs. what is disabled on Pages

### Works (client-first, local-first)
- `[Inference]` Visual Canvas Map / graph canvas.
- `[Inference]` Relational tables and charts.
- `[Inference]` Obsidian-style knowledge notes and `[[wikilinks]]`.
- `[Inference]` Mobile quick-capture actions.
- `[Fact]` Local-first state in the browser (`IndexedDB` / `localStorage`), per ADR 0001 Decision 1.

### Disabled or degraded (server-dependent)
- `[Fact]` Cloud `/api/sync` backup. The route does not exist on Pages, so sync becomes **local-only**. `[Fact]` This already fails safe via `triggerHybridSync()`, so the app stays usable with no code change. Hiding or relabeling the "Back up to the cloud" affordance for the preview build is optional polish (tracked as W9-T3).
- `[Inference]` Cross-device cloud synchronization (depends on D1 + the Worker).

---

## 4. Consequences

- **Positive**:
  - `[Projection]` SHUAI gets a fast, account-free visual preview reachable at a public GitHub Pages URL.
  - `[Inference]` No change to domain or geometry code, so the preview carries low risk.
  - `[Inference]` The Cloudflare path stays intact for the full product.
- **Negative / risks**:
  - `[Unknown]` The static export capability of vinext beta is unproven; the first CI run may require adjusting the build command or base path.
  - `[Inference]` Cloud sync and cross-device features are not demonstrable on the preview.
- **Invariants preserved**:
  - `[Fact]` **ADR 0002 Coordinate Invariance** (Technical Invariant #1: node coordinates `(x, y)` are visual layout metadata and never alter financial totals, GL codes, or table records) is preserved, because this work touches no domain or geometry code. The guarded files `app/budget-domain.mjs`, `db/schema.ts`, and `app/api/sync/route.ts` are not modified.
  - `[Fact]` The `node --test tests/budget-domain.test.mjs` gate stays green (20/20); a docs-and-config preview channel does not affect the pure engine.

---

## 5. Open questions for SHUAI

- `[Decision for SHUAI]` Confirm the public preview is acceptable (the repository and preview are visible to anyone with the URL).
- `[Unknown]` Preferred vinext static mode vs. the Vite client-SPA fallback is resolved by the first CI run.

> Related tickets: `.scratch/tickets/W9-github-pages-preview.md` (W9-T1..T5).
