# Wave 9: GitHub Pages Static Preview (Cloudflare-Free)

- **Wave**: Wave 9 (proposed / not yet started)
- **Status**: `proposed`
- **Blocked By**: none technically. W9-T1 carries an `[Unknown]` that only the first Pages CI run can resolve. Public-preview acceptance awaits **SHUAI** (see W9-T5).
- **Governing ADRs**: ADR 0001 (hybrid + dual-mode), ADR 0002 (graph-first + adaptive surfaces, incl. Coordinate Invariance), ADR 0003 (Kiro-native team + gate), **ADR 0004 (GitHub Pages static preview)**.
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (currently **20/20** at branch `feat/github-pages-preview` HEAD `f285a87`). lint/build/rendered-html are CI-only in this sandbox (ADR 0003).

> `[Context]` SHUAI has no Cloudflare account yet and wants a fast visual preview in a browser soon. GitHub Pages serves static files only: no Worker runtime, no SSR server, no D1, no `/api/sync` server route. This preview coexists with, and does not replace, the planned Cloudflare Worker deploy (ADR 0004). The workbench is `"use client"`, so the React UI can run from static assets; `triggerHybridSync()` already fails safe when `/api/sync` is absent.

---

## W9-T1 - Static build command, output dir, and base path `/Ellies-Book/` `[proposed]` `[Unknown]`

- `[Unknown]` **Finding**: Whether vinext `1.0.0-beta.2` exposes a static / SSG / SPA export is not confirmed. No repo config enables it; the npm registry is blocked in the sandbox (HTTP 403, no `node_modules`), so it could not be probed. The first Pages CI run is the authoritative proof.
- **Goal**: produce a static asset bundle suitable for GitHub Pages at base path `/Ellies-Book/`.
  - `[Projection]` **Preferred**: use vinext's own static output if `vinext build` (or a documented flag) emits one.
  - `[Inference]` **Fallback**: a Vite client-SPA shell that mounts the React workbench and skips the Worker/SSR path, with Vite `base` set to `/Ellies-Book/`.
- **Scope**: new preview build config and scripts only (for example a `package.json` preview script and/or a dedicated Vite preview config). Do NOT modify `app/budget-domain.mjs`, `db/schema.ts`, `app/api/sync/route.ts`, `worker/index.ts`, `vite.config.ts`, or `.github/workflows/ci.yml`.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green; static output and base path confirmed by the first Pages CI run (W9-T4).
- **Cross-reference**: delivered as part of FEAT-002 (preview build + SPA shell).

---

## W9-T2 - SPA fallback `404.html` -> `index.html` for client routing `[proposed]`

- `[Inference]` **Finding**: GitHub Pages returns `404.html` for unknown paths. A client-routed SPA needs `404.html` to serve the same shell as `index.html` so deep links and client routes resolve.
- **Goal**: emit a `404.html` that loads the same app shell as `index.html` under base `/Ellies-Book/`, so refreshing or opening a deep link does not 404.
- **Scope**: preview build output / a static `404.html` artifact only. Do NOT touch domain / schema / `/api/sync` / Worker.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green; deep-link behavior confirmed by the first Pages CI run (W9-T4).
- **Cross-reference**: delivered with FEAT-002.

---

## W9-T3 - Gate cloud-sync UI to local-only on the static build `[proposed]` `[optional polish]`

- `[Fact]` **Finding**: `triggerHybridSync()` already fails safe. When `/api/sync` is absent it shows local-only copy ("Saved on this device. Cloud backup is not reachable right now."), so the preview degrades gracefully with no code change.
- **Goal** (optional polish, if SHUAI wants it): hide or relabel the "Back up to the cloud" affordance **for the Pages preview build only**, so the preview does not advertise a backup that cannot run. The default Worker build keeps the full affordance.
- **Scope**: a preview-build-only flag or env guard in the UI shell. Do NOT change the shared `triggerHybridSync()` fail-safe path, and do NOT touch domain / schema / `/api/sync`.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green.
- **Status gate**: `[Decision for SHUAI]` - the app already fails safe, so this is cosmetic. **Do NOT implement unless SHUAI wants the preview to hide the cloud affordance.**

---

## W9-T4 - GitHub Actions Pages deploy workflow `[proposed]`

- `[Inference]` **Finding**: a dedicated `pages.yml` workflow is needed to build the preview and publish it with `actions/deploy-pages`. It must be separate from `ci.yml` (which is guarded and out of scope for this wave).
- **Goal**: on push to the target branch (or on manual dispatch), install deps, run the W9-T1 static build, upload the artifact with `actions/upload-pages-artifact`, and deploy with `actions/deploy-pages`.
- **Scope**: a new `.github/workflows/pages.yml` only. Do NOT modify `.github/workflows/ci.yml`. `[Fact]` Per AGENTS.md, CI/CD workflow files go via PR, never direct to `main`, and must never dump env or secrets.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green; the **first `pages.yml` run is the authoritative proof** that the W9-T1 build command and `/Ellies-Book/` base path are correct. Adjust W9-T1 if it fails.
- **Cross-reference**: delivered as FEAT-003 (Pages deploy workflow).

---

## W9-T5 - `docs/PREVIEW` link + SHUAI enablement steps `[proposed]` `[Decision for SHUAI]`

- `[Inference]` **Finding**: SHUAI needs clear steps to enable Pages and the final preview URL to open in a browser.
- **Goal**: add a short `docs/PREVIEW.md` (or a README section) with: how to enable GitHub Pages (Settings -> Pages -> source: GitHub Actions), the expected preview URL `https://woussc.github.io/Ellies-Book/`, and a plain-language note of what works vs. what is local-only (per ADR 0004 §3).
- **Scope**: docs only. Do NOT touch domain / schema / `/api/sync` / Worker.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green; renders as valid markdown; preview URL confirmed after W9-T4 runs.
- **Status gate**: `[Decision for SHUAI]` - confirm a **public** preview is acceptable before enabling Pages.

---

## Sequencing note

`[Inference]` W9-T1 and W9-T2 are the core build slices and ship together (FEAT-002). W9-T4 (FEAT-003) depends on them and provides the authoritative proof via its first run. W9-T3 is optional cosmetic polish awaiting SHUAI. W9-T5 is docs that await the confirmed preview URL and SHUAI's public-preview decision. Each slice stays an atomic, domain-gate-green change and touches no domain, schema, `/api/sync`, or Worker code.
