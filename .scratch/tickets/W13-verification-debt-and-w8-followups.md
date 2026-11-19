# Wave 13 (Part 1): Wave 12 Verification Debt Closure, W8 Guard Hardening & Conditional 390px Mobile Card Audit

- **Wave**: Wave 13
- **Status**: `proposed`
- **Blocked By**:
  - `W13-T1`: Done 10 Nov 2026.
  - `W13-T2`: Done 10 Nov 2026 (Gate 1 approved: keep & dark-tune).
  - `W13-T3`: Unblocked for CI/build-capable runner dispatch (cannot run locally in this 403 sandbox).
- **Governing ADRs**: ADR 0001 (hybrid + dual-mode), ADR 0002 (graph-first + adaptive surfaces + Coordinate Invariance), ADR 0003 (Kiro-native team + verification gate), ADR 0007 (UI/UX congress workflow), ADR 0008 (dark canvas re-theme + legibility-disciplined data surfaces).
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (**25/25** on `main` @ `110e2fd`, or **26/26** if a new test block is added). `pnpm run lint`, `pnpm run build`, `tests/rendered-html.test.mjs`, `inspect.mjs --app`, and Playwright are **CI-only** in this sandbox (ADR 0003).

> `[Context]` Inspection of `main` @ `110e2fd` revealed three pieces of verification and documentation debt bridging Wave 8 and Wave 12:
> 1. `[Fact]` Wave 12 (`WS-A`, `WS-B`, `WS-C`, `WS-D`) is merged on `main` (`110e2fd`) with 25/25 domain tests passing, but `.scratch/tickets/W12-dark-canvas-retheme.md`, `docs/adr/0008-dark-canvas-retheme-and-interaction-model.md`, `.scratch/tickets/W8-post-wave7-followups.md`, and `.scratch/HANDOFF-STATE.md` still carry stale `proposed` / `PLANNED` statuses and stale gate counts (`19/19`, `20/20`, `21/21`, `24/24`).
> 2. `[Fact]` `W8-candidate-B` was partially landed in `tests/budget-domain.test.mjs` line 759 (`assert.match(workbenchSource, /Saved here and backed up to the cloud/)`), but `W8-post-wave7-followups.md` was never updated, and the sync-affordance test guard in `tests/budget-domain.test.mjs` does not yet assert all three user-visible hybrid sync states (`Saved on this device`, `Backing up to the cloud`, `Saved here and backed up to the cloud`) plus the `/api/sync` fetch wiring in a single cohesive contract check.
> 3. `[Fact]` `W8-candidate-A` (`@media (max-width: 680px)` `.eb-plan-table` stacked-card CSS + test #20 at lines 909-943 of `tests/budget-domain.test.mjs`) is already present in `main`, even though `HANDOFF-STATE.md` §7 Open Item #1 and `W8-post-wave7-followups.md` state "Do NOT implement until SHUAI decides." `W13-T2` holds any `app/globals.css` / `app/ellies-book-workbench.tsx` changes strictly conditional on SHUAI's decision.

> `[Hard guardrail, all tickets in this file]` Do NOT touch `app/budget-domain.mjs`, `db/schema.ts`, `app/api/sync/route.ts`, `worker/index.ts`, `vite.config.ts`, `vite.config.pages.ts`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, or `AGENTS.md` §2. Do NOT touch PR #4. Preserve Coordinate Invariance (ADR 0002).

---

## Parallelization map (which files each ticket owns)

| Ticket | Objective | PRIMARY files it edits | Shared regions to coordinate |
| :-- | :-- | :-- | :-- |
| **W13-T1** (UNBLOCKED QUICK WIN) | Close Wave 12 & Wave 8 doc/status debt + harden `W8-candidate-B` hybrid sync UI guard in `tests/budget-domain.test.mjs` | `.scratch/tickets/W12-dark-canvas-retheme.md`, `.scratch/tickets/W8-post-wave7-followups.md`, `docs/adr/0008-dark-canvas-retheme-and-interaction-model.md`, `.scratch/HANDOFF-STATE.md`, `tests/budget-domain.test.mjs` (lines 745-760 & 865-907 only) | Owns docs + sync-guard lines in `tests/budget-domain.test.mjs`. |
| **W13-T2** (`[CONDITIONAL ON SHUAI]`) | Reconcile `W8-candidate-A` (`390px` `.eb-plan-table` stacked-card layout on dark theme): either dark-tune & lock OR revert to horizontal scroll per SHUAI's choice | `app/globals.css` (`@media (max-width: 680px)` `.eb-plan-table` rules only), `app/ellies-book-workbench.tsx` (`.eb-plan-table` `data-label` markup only if reverting), `tests/budget-domain.test.mjs` (lines 909-943 only) | Disjoint from `W13-T1` lines in `tests/budget-domain.test.mjs`. **DO NOT START without SHUAI approval.** |
| **W13-T3** (`[CI-ONLY GATE]`) | Execute `W8-candidate-C` Part 1 + Wave 12 post-merge CI & real-browser visual verification at `1440px` / `768px` / `390px` | `.scratch/reviews/W13-T3-ci-visual-verification.md` (evidence artifact only; zero app code edits unless a visual regression is caught) | Read-only verification pass in a build-capable CI environment. |

---

## W13-T1 — Close Wave 12 / Wave 8 status debt + harden W8-candidate-B Hybrid Sync guard `[done]` `[UNBLOCKED]`

- `[Fact]` **Done 10 Nov 2026**: guard hardened (three sync states + `fetch("/api/sync")` wiring + comment-only obsolete phrasing, gate 25/25 green); W12 ticket marked `done` at 25/25; ADR 0008 accepted at 25/25; W8 ticket reconciled (B done, A governed by W13-T2, C cross-referenced).

- **Objective**: Reconcile all stale Wave 12 and Wave 8 ticket/ADR/handoff statuses and gate counts against `main` @ `110e2fd` (`25/25`), and complete `W8-candidate-B` by hardening the hybrid sync UI regression guard in `tests/budget-domain.test.mjs`.
- **Steps**:
  1. In `tests/budget-domain.test.mjs` (around lines 745-760 and 865-907), verify and tighten the `W8-candidate-B` re-anchor so that it asserts:
     - All three plain-language `syncState` strings exist in `app/ellies-book-workbench.tsx` (`"Saved on this device"`, `"Backing up to the cloud…"`, `"Saved here and backed up to the cloud"`);
     - The `/api/sync` endpoint call (`fetch("/api/sync"`) is wired to the workbench state transition; and
     - No test relies on the obsolete `/Hybrid Sync Snapshot/` code comment.
  2. In `.scratch/tickets/W12-dark-canvas-retheme.md`, update the top-level status from `proposed` to `done` (merged at `110e2fd`), mark `WS-A`, `WS-B`, `WS-C`, and `WS-D` as `[done]`, and update the gate count from `21/21` (and `24/24` in `WS-C`) to `25/25` on `main` @ `110e2fd`.
  3. In `docs/adr/0008-dark-canvas-retheme-and-interaction-model.md`, update `Status: Proposed` to `Status: Accepted (implemented in Wave 12, merged at 110e2fd)` and update the domain gate references (lines 43, 177, 184) from `21/21` to `25/25`.
  4. In `.scratch/tickets/W8-post-wave7-followups.md`, mark `W8-candidate-B` as `[done]`, record that `W8-candidate-A` CSS/test landed in `main` and is governed by conditional ticket `W13-T2`, and cross-reference `W13-T3` and `W13-D1..D4` for `W8-candidate-C` Parts 1 and 2.
  5. Update `.scratch/HANDOFF-STATE.md` with the Wave 12 completion record and Wave 13 frontier section.
- **Touches**: `tests/budget-domain.test.mjs`, `.scratch/tickets/W12-dark-canvas-retheme.md`, `.scratch/tickets/W8-post-wave7-followups.md`, `docs/adr/0008-dark-canvas-retheme-and-interaction-model.md`, `.scratch/HANDOFF-STATE.md`.
- **Acceptance criteria**:
  - `node --test tests/budget-domain.test.mjs` passes **25/25** (all existing + hardened `W8-candidate-B` assertions green).
  - Zero stale `21/21` or `PLANNED` labels remain in the active W12 header/ticket or ADR 0008.
  - Coordinate Invariance (ADR 0002) holds: `app/budget-domain.mjs`, `db/schema.ts`, and `app/api/sync/route.ts` are untouched.
- **Verification**: Run `node --test tests/budget-domain.test.mjs` locally; inspect `git diff` to confirm only docs and test-guard lines changed.

---

## W13-T2 — Conditional 390px `.eb-plan-table` stacked-card layout audit & dark-surface alignment (`W8-candidate-A`) `[done]` `[Gate 1 approved 10 Nov 2026: keep & dark-tune]`

- `[Fact]` **Done 10 Nov 2026**: card background `--eb-surface` (lightness step), separators `1px --eb-line`, labels `--eb-muted`, figures `tabular-nums` restated in card mode, zero banned ornament; test #20 extended with the dark-token + ornament guards. Gate 25/25 green. Open Item #1 closed in HANDOFF-STATE.md; W8-candidate-A marked `[done]`.

- **Status gate**: **`[Decision for SHUAI]` — DO NOT EXECUTE until SHUAI selects Option 1A or Option 1B (see Decision Gate 1).**
- `[Fact]` **Current state in `main` @ `110e2fd`**:
  - `app/ellies-book-workbench.tsx` renders `data-label` attributes (`Item`, `Supplier`, `Quarter`, `Quantity × price`, `Total`, `Status`) on `.eb-plan-table` cells.
  - `app/globals.css` already includes `@media (max-width: 680px)` rules turning `.eb-plan-table` rows into stacked cards via `.eb-plan-table td::before { content: attr(data-label) }`, guarded by test #20 in `tests/budget-domain.test.mjs` (lines 909-943).
  - However, `.scratch/HANDOFF-STATE.md` §7 Open Item #1 and `.scratch/tickets/W8-post-wave7-followups.md` still flag `W8-candidate-A` as an unapproved decision item for SHUAI, and its mobile card rules need explicit verification against ADR 0008 Decision 5's dark-surface legibility rules (1px `--eb-line` separator, `--eb-surface` / `--eb-sheet` lightness step, right-aligned `tabular-nums` values, zero glow/shadow/gradient).
- **Congress steps** (if Option 1A is chosen): FRAME (390px Overview answers "what is planned and what is each line's status without horizontal scrolling?"); GROUND (`app-screens.md` §7 mobile table-to-card rules + ADR 0008 Decision 5 dark tokens); CRAFT (impeccable `layout` + `typeset` at `390px`); VERIFY (`inspect.mjs --app` at `390px` with NO waivers).
- **Branch A — If SHUAI chooses Option 1A (Keep & Dark-Tune 390px Stacked Cards)**:
  1. Audit `@media (max-width: 680px)` `.eb-plan-table` rules in `app/globals.css` to ensure every stacked card uses ADR 0008 dark tokens (`--eb-surface`, `1px solid var(--eb-line)`, `--eb-muted` for the `::before` `data-label`, `--eb-ink` + `tabular-nums` for figures, and zero box-shadow/gradient).
  2. Extend test #20 in `tests/budget-domain.test.mjs` (lines 909-943) to assert that the `@media (max-width: 680px)` `.eb-plan-table` block carries no banned ornament (`box-shadow`, `linear-gradient`, `backdrop-filter`) and preserves `tabular-nums`.
  3. Close Open Item #1 in `.scratch/HANDOFF-STATE.md` and mark `W8-candidate-A` `[done]` in `.scratch/tickets/W8-post-wave7-followups.md`.
- **Branch B — If SHUAI chooses Option 1B (Revert to Desktop-First Horizontal Scroll on Mobile)**:
  1. Remove the `@media (max-width: 680px)` `.eb-plan-table` card-collapse CSS in `app/globals.css` so `.eb-plan-table` scrolls horizontally inside its overflow container at `390px`.
  2. Replace test #20 in `tests/budget-domain.test.mjs` (lines 909-943) with a guard asserting horizontal-scroll container containment for `.eb-plan-table` (preserving total test count at **25/25**).
  3. Record SHUAI's rejection of `W8-candidate-A` in `.scratch/HANDOFF-STATE.md` and `.scratch/tickets/W8-post-wave7-followups.md`.
- **Touches**: `app/globals.css`, `tests/budget-domain.test.mjs` (lines 909-943), `.scratch/tickets/W8-post-wave7-followups.md`, `.scratch/HANDOFF-STATE.md`.
- **Acceptance criteria**:
  - `node --test tests/budget-domain.test.mjs` stays **25/25** green.
  - Zero glow, gradient, or resting shadow on `.eb-plan-table` at any breakpoint (ADR 0008 Decision 5).
  - Open Item #1 in `.scratch/HANDOFF-STATE.md` is permanently resolved per SHUAI's choice.
- **Verification**: `node --test tests/budget-domain.test.mjs` locally; CI `inspect.mjs --app` at `390px`.

---

## W13-T3 — CI Build, Rendered-HTML & Real-Browser Visual Gate at 1440px / 768px / 390px (`W8-candidate-C` Part 1 + Wave 12 Visual Gate) `[proposed]` `[CI-ONLY]`

- **Objective**: Close the cumulative CI-only verification debt from Waves 7–12 (`W8-candidate-C` Part 1, `HANDOFF-STATE.md` §7 Open Item #4, and ADR 0008 §3 Verification) in a build-capable environment or GitHub Actions CI runner.
- `[Fact]` **Why this cannot run locally**: `pnpm install` fails with HTTP 403 in this sandbox and `node_modules` is absent (`ADR 0003`).
- **Steps** (in CI or a network-enabled build runner):
  1. Run the deterministic build & SSR suite:
     ```bash
     pnpm install --frozen-lockfile
     pnpm run lint
     pnpm run build
     node --test tests/budget-domain.test.mjs
     node --test tests/rendered-html.test.mjs
     ```
  2. Run `taste-skill` real-browser inspection across all three mandatory viewports (`1440px`, `768px`, `390px`):
     - On `1. Workflow map` (canvas hero): run `node .agent/skills/design-taste-frontend/scripts/inspect.mjs --app` with the committed `.taste-skill/direction.json` scoped allow-list (`gradient`, `heavy-shadow`, `glass`, `icon-chips`). Confirm 0 FAIL, attached bezier status ribbons under pan/zoom, right-docked controls, and working bottom-right `.eb-minimap`.
     - On `2. Overview`, `3. Notes`, `4. Reports & export`, and `Setup`: run `inspect.mjs --app` with **NO waivers** (`--allow ""`). Confirm 0 FAIL, `--eb-ink` contrast ≥ 13:1, `--eb-muted` contrast ≥ 4.5:1, body ≥ 16px, KPI figures 16px–40px `tabular-nums`, no clipping on `.eb-plan-table` at `1440px`, clean wrapping on `.eb-sync-affordance`, and short mobile quick-capture sheet at `390px`.
  3. Record the structured verification output and screenshot hashes in `.scratch/reviews/W13-T3-ci-visual-verification.md`.
- **Touches**: `.scratch/reviews/W13-T3-ci-visual-verification.md`, `.scratch/HANDOFF-STATE.md` (close Open Item #4 once verified).
- **Acceptance criteria**:
  - `pnpm run lint`, `pnpm run build`, `node --test tests/budget-domain.test.mjs` (`25/25`), and `node --test tests/rendered-html.test.mjs` all exit `0`.
  - `inspect.mjs --app` reports `0 FAIL` at `1440px`, `768px`, and `390px` under ADR 0008 Decision 7 rules.
- **Verification**: CI workflow logs + `.scratch/reviews/W13-T3-ci-visual-verification.md`.

---

## Decisions Requiring SHUAI Before Implementation Starts

### Decision Gate 1 — `W8-candidate-A` (`W13-T2`): 390px Mobile Plan-Table Layout
`[Fact]` `main` @ `110e2fd` already contains `@media (max-width: 680px)` stacked-card CSS for `.eb-plan-table` (`content: attr(data-label)`) and test #20 in `tests/budget-domain.test.mjs` (lines 909-943), even though `.scratch/HANDOFF-STATE.md` §7 Open Item #1 still marks it as awaiting your decision.
- **Option 1A (Recommended — Keep & Verify on Dark Theme)**: Keep the `390px` stacked-card layout for `.eb-plan-table` (realizing ADR 0002 Pillar 3 zero horizontal overflow on phones), verify/tune its dark-token legibility (`--eb-surface`, `1px --eb-line`, `tabular-nums`, zero shadow/gradient per ADR 0008 Decision 5), and close Open Item #1.
- **Option 1B (Revert to Desktop-First Horizontal Scroll)**: Remove the `@media (max-width: 680px)` card-collapse rules so `.eb-plan-table` stays a traditional scrollable table on mobile, and update test #20 accordingly.

### Decision Gate 2 — `W13-D1` / `W13-D2`: Multi-Tenant Authentication & Workspace Identity Mechanism
`[Fact]` Per ADR 0001 Decision 1, Ellie's Book must work both as a zero-login local-first app and as an authenticated cloud-synced workspace. How should `/api/sync` authenticate cloud workspace requests in `W13-D2`?
- **Option 2A (Recommended — Cloudflare Access Zero-Trust Headers + Optional Workspace Bearer Token)**:
  - Keep anonymous local-first mode active when no auth headers are sent (`local-first-verified`), AND in cloud mode accept either Cloudflare Access JWT headers (`Cf-Access-Authenticated-User-Email` / `Cf-Access-Jwt-Assertion`, zero auth-UI maintenance on Cloudflare) or a workspace `Authorization: Bearer <token>` + `X-Ellie-Workspace-Id` header hashed against `workspace_members.token_hash` in D1.
- **Option 2B (Workspace API Key / Bearer Token Only)**:
  - Authenticate cloud sync strictly via `X-Ellie-Workspace-Id` + `Authorization: Bearer <workspace-secret>` validated against `workspace_members.token_hash` in D1, with no dependency on Cloudflare Access headers.
- **Option 2C (Full In-App Session Auth / Magic Link)**:
  - Add user login/session cookie routes inside the app before enabling multi-tenant D1 writes (larger scope; requires an email/OAuth provider secret).

### Decision Gate 3 — `W13-D2`: Cloud D1 Sync Conflict & Upsert Policy
`[Fact]` Currently, `app/api/sync/route.ts` (lines 154-330) uses `.onConflictDoNothing()`, which silently ignores all subsequent edits to an already-synced project. When two devices sync the same `project.recordId` in a workspace, what conflict policy should `POST /api/sync` enforce?
- **Option 3A (Recommended — Checksum-Guarded Optimistic Upsert + Immutable Audit Log)**:
  - Use `.onConflictDoUpdate()` for mutable tables (`projects`, `workPackages`, `purchaseItems`, `sourcingAllocations`, `lifecycleRecords`, `lifecycleLines`, `purchaseLinks`, `lifecycleTransitions`, `knowledgeNotes`), keep `budgetVersions` and `auditEvents` append-only/immutable, and if the client passes `If-Match-Checksum` that mismatches the latest D1 snapshot, return `409 Conflict` with the server snapshot so the client never silently overwrites a teammate's newer sync.
- **Option 3B (Last-Write-Wins Upsert)**:
  - Always overwrite mutable project/item/allocation rows in D1 via `.onConflictDoUpdate()` on valid payload (`allValid === true`), logging every overwrite in `auditEvents`.

### Decision Gate 4 — `AGENTS.md` §2 Lead-Architect Model Naming (`HANDOFF-STATE.md` §7 Open Item #3)
`[Fact]` `AGENTS.md` §2 currently names `Claude (latest model)` in the table while `HANDOFF-STATE.md` §7 Open Item #3 notes a discrepancy between `Gemini 4 Argon (High)` and `Claude (latest model)` (and ADR 0003). Per the hard boundary, `AGENTS.md` §2 was not touched.
- **Option 4A (Keep `AGENTS.md` §2 Untouched & Close Open Item #3 as Resolved)**: Leave `AGENTS.md` §2 as-is and mark Open Item #3 closed in `HANDOFF-STATE.md`.
- **Option 4B (Authorize a 1-Line Alignment Edit in `W13-T1`)**: Authorize adding a one-line cross-reference in `docs/ROADMAP.md` / `AGENTS.md` §2 pointing to ADR 0003.
