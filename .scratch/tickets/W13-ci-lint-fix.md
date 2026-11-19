# Ticket: W13-CI-LINT-FIX — Fix PR #13 CI failure (Lint step, exit 1)

## Status
- [Fact] PR #13 (`feat/wave-13-14` @ 53188155, 20 files) opened 11 Nov 2026 08:28 SGT for SHUAI's review.
- [Fact] CI run #30 failed 11 Nov 2026 08:29 SGT in 19 seconds.
- [Fact] Failing step: `Lint` (`pnpm run lint` → `eslint . --ignore-pattern dist --ignore-pattern .next`) in job `Lint, build & test`.
- [Fact] Steps before Lint passed: Checkout, Set up pnpm, Set up Node.js 22, Install dependencies (`pnpm install --frozen-lockfile`).
- [Fact] Steps after Lint skipped: Domain gate, Build, Rendered-HTML contract. Visual-screenshots job skipped (needs build-and-test).
- [Fact] Annotations (3): error `Process completed with exit code 1.` on Lint; warning Node.js 20 deprecation (actions/checkout@v4, setup-node@v4, pnpm/action-setup@v4 forced onto Node 24); notice ubuntu-latest migrating to Ubuntu 26. Only the error annotation relates to the failure.
- [Fact] Local domain gate re-run 11 Nov ~10:45 SGT: `node --test tests/budget-domain.test.mjs` 30/30 pass, 0 fail. Local clone on main @ 110e2fd with the W13+W14 changes uncommitted.
- [Inference] Failure is in lint, not the domain tests. The annotation text gives no file, line, or rule.
- [Unknown] The exact lint error(s): the detailed step log requires GitHub sign-in. Browser password sign-in is a dead route — SHUAI confirmed 11 Nov 13:37 SGT that the GitHub account signs in via Google, so there is no GitHub password (the saved login was rejected 11 Nov 13:36 SGT). The browser task for the log was stopped. Remaining routes: local lint reproduction (registry reachable, toolchain installing) or SHUAI pasting the lint error lines from the job log himself.

## Run / job URLs
- Run: https://github.com/woussc/Ellies-Book/actions/runs/42931654703
- Failed job: https://github.com/woussc/Ellies-Book/actions/runs/42931654703/job/130231629244?pr=13

## Suspect surface (lint covers these changed files; `.scratch/**` is ignored by eslint.config.mjs)
- `app/api/sync/route.ts` (new, W13-D2) — imports spot-checked used; no `console`/`debugger`; no `<img>`.
- `app/ellies-book-workbench.tsx` (W13-D3 workspace field) — only `any` is the pre-existing eslint-disabled type at line 287-288.
- `app/page.tsx` (W14-F1 TagPicker guard, W14-F2 baseline total).
- `db/schema.ts` (W13-D1 workspaces tables).
- `tests/budget-domain.test.mjs` (W13-D3 + W14 guard tests).
- `app/globals.css`, `.md`, `.sql` files are not linted by this config.
- Local lint cannot run in the sandbox: no `node_modules`, no `pnpm`, and `pnpm install` is blocked (403, per ADR 0003). Registry reachability probe pending — if reachable, install the exact devDeps and run the real lint locally instead of waiting on the GitHub log.

## Acceptance
1. Lint error(s) identified from the CI log (or a local reproduction) with file, line, and rule.
2. Fix applied in the local clone, minimal scope, no changes to `app/budget-domain.mjs`, `db/schema.ts` (unless the fix itself requires it — D1 already authorised schema), `/api/sync` behaviour, the Worker, `ci.yml`, `pages.yml`, `vite.config*`, or AGENTS.md §2.
3. Local domain gate re-run: 30/30 green.
4. Fix pushed to `feat/wave-13-14` via the GitHub connector snapshot push (SHUAI approved the fix+push 11 Nov 13:19 SGT).
5. New CI run on the branch green; only then does SHUAI review PR #13. No merge and no visual-screenshots pass until CI is green.

## Finding (local reproduction, 11 Nov 13:39 SGT)
- [Fact] The npm registry is reachable from the sandbox (registry.npmjs.org returned 200). Installed the exact lint toolchain from package.json via npm (`eslint@9.39.4`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `@next/eslint-plugin-next`, `globals`, `typescript`, `react`, `react-dom`) into the repo's gitignored `node_modules/` (`--no-save --no-package-lock`, so no lockfile was created and nothing extra enters the snapshot push).
- [Fact] Local lint reproduces the CI failure exactly: exit 1, 1 error, 0 warnings:
  `app/ellies-book-workbench.tsx 1296:18 error react-hooks/set-state-in-effect` — `if (saved) setWorkspaceId(saved);` called setState synchronously inside the W13-D3 mount effect that restores the saved workspace id from localStorage.
- [Fact] GitHub password sign-in is a dead route for this account (SHUAI signs in to GitHub via Google, confirmed 11 Nov 13:37 SGT); the browser log-reading task was stopped. The CI log was never read — the local reproduction made it unnecessary.

## Fix (W13-CI-LINT-FIX, 11 Nov 13:40 SGT)
- `app/ellies-book-workbench.tsx`: replaced the `useState("")` + mount-effect pair with a lazy initializer that reads `localStorage("ellies-book-workspace-sync-v1")` on the first client render (`typeof window === "undefined"` → `""` on the server). Deleted the effect. Added `suppressHydrationWarning` to the Shared workspace input, whose value legitimately differs between the server render ("") and the first client render (stored id). Behaviour preserved: empty = this device only; stored id reused on next backup; header sent only when set; bearer token still read from sessionStorage at call time.
- `tests/budget-domain.test.mjs` (W13-D3 guard): updated the workspace-state assertion to the lazy-initializer shape and added an assertion that the server default is `""`. All other guard assertions unchanged.
- [Fact] Verification after the fix: local lint exit 0; domain gate 30/30 pass, 0 fail.

## Rules
- Epistemic tags on consequential claims ([Fact]/[Inference]/[Assumption]/[Projection]/[Unknown]).
- 3-strike pivot rule: after 3 failed attempts with the same approach, stop and escalate to the Lead Architect (Argon High) rather than looping.
- Nothing pushed without SHUAI's approval — approval for this fix push already given.
