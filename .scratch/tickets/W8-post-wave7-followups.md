# Wave 8 (candidate): Post-Wave-7 Follow-ups & Deployment Frontier

- **Wave**: Wave 8 (candidate / not yet started)
- **Status**: `proposed`
- **Blocked By**: none technically; candidates A and C involve decisions that await **SHUAI** (see each ticket).
- **Governing ADRs**: ADR 0001 (hybrid + dual-mode), ADR 0002 (graph-first + adaptive surfaces), ADR 0003 (Kiro-native team + gate).
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (currently **19/19** at branch `feat/w7-graph-first-landing` HEAD `4fa8068`). lint/build/rendered-html are CI-only in this sandbox (ADR 0003).

> `[Context]` These are the **non-blocking** follow-ups surfaced by the Wave 7 dual-gate review. None of them block PR #1. They are recorded here so a future session can pick them up cold. See `.scratch/HANDOFF-STATE.md` §7 (Open items) for full context.

---

## W8-candidate-A — Optional 390px plan-table stacked-card layout `[done]`

- `[Fact]` **Finding (corrected W13-T1)**: The stacked-card layout is ALREADY in `main` @ `110e2fd` — `@media (max-width: 680px)` `.eb-plan-table td::before { content: attr(data-label) }` in `app/globals.css` (line 2493) plus test #20 in `tests/budget-domain.test.mjs` (lines 909-943). The earlier "not implemented" reading was wrong.
- **Goal** (decided by SHUAI 10 Nov 2026, Gate 1): KEEP the stacked-card layout and dark-tune it (do not revert to horizontal scroll). Execution is ticket `W13-T2` in `.scratch/tickets/W13-verification-debt-and-w8-followups.md`.
- **Scope**: `app/ellies-book-workbench.tsx` (`.eb-plan-table` markup already carries `data-label`) + `app/globals.css` (new `@media` card-mode rules). Do NOT touch domain / schema / `/api/sync`.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green; plus CI/visual re-check at 390px in a build-capable env.
- **Status gate**: `[Decision made]` — SHUAI chose keep & dark-tune (Gate 1, 10 Nov 2026). Execution in `W13-T2`.

---

## W8-candidate-B — Re-anchor the "Hybrid Sync Snapshot" presence guard `[done]`

- `[Fact]` **Finding**: The pre-existing test guard `assert.match(src, /Hybrid Sync Snapshot/)` in `tests/budget-domain.test.mjs` is now satisfied only by a code comment, because W7-T5 replaced the user-visible "Hybrid Sync Snapshot" phrasing with the plain-language affordance. The guard no longer proves anything user-facing.
- **Goal**: re-anchor that assurance to something meaningful — either a currently-visible sync string (e.g. "Saved here and backed up to the cloud") or the presence of the `/api/sync` call wiring — so the guard regress-fails if the hybrid sync surface is removed.
- **Scope**: `tests/budget-domain.test.mjs` only (and, if needed, confirm the chosen anchor string exists in `app/ellies-book-workbench.tsx`). Do NOT touch domain / schema / `/api/sync`.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green with the re-anchored guard (test count unchanged or +0; this re-targets an existing assertion).
- `[Fact]` **Done (W13-T1, 10 Nov 2026)**: re-anchored in test #15 (line 759) and hardened in the hybrid-backup-surface test — all three plain-language sync states asserted, `fetch("/api/sync")` POST wiring asserted via `triggerHybridSync`, and the obsolete phrasing guarded to code comments only. Gate 25/25 green.

---

## W8-candidate-C — CI/visual verification pass + deployment frontier `[proposed]` `[placeholder]`

- `[CI-only]` **Part 1 — required-before-merge verification** (cannot run in this sandbox; ADR 0003):
  - Run `pnpm install && pnpm run lint && pnpm run build && node --test tests/rendered-html.test.mjs` in a build-capable env / CI.
  - Real-browser visual inspection at **1440px / 768px / 390px** confirming: the plan table has no clipping (W7-T3), the sync affordance wraps cleanly (W7-T5), and the mobile quick-capture sheet stays short (W7-T5).
- `[Projection]` **Part 2 — ROADMAP §5 next step (deployment)**: stand up the Cloudflare D1 / multi-tenant auth deployment so Ellie's Book runs as either a local-first vault app or a cloud-hosted SaaS with workspace authentication (realizes ADR 0001 Decision 1 end-to-end; relates to the roadmap `W4-T2` hybrid-persistence objective). Decompose into atomic tracer-bullet slices before any implementation.
- **Scope**: `db/schema.ts`, `app/api/sync/route.ts`, auth/session wiring, deployment config. `[Reminder]` Any change here breaks Coordinate Invariance only if it touches node geometry or financial totals — keep those pure.
- **Gate / verification**: `node --test tests/budget-domain.test.mjs` green throughout; full CI gate per Part 1 before merge.
- **Status gate**: `[Fact]` Part 1 is ticket `W13-T3` (CI/visual pass); Part 2 is tickets `W13-D1..D4` (D4 deferred). Decision Gates 2 & 3 approved by SHUAI 10 Nov 2026.

---

## Sequencing note

`[Inference]` W8-candidate-B is the lowest-risk, docs/test-only quick win and can proceed independently. W8-candidate-A awaits SHUAI's PR #1 decision. W8-candidate-C (Part 1 CI/visual) should run before PR #1 merges; Part 2 (deployment) is a larger frontier to plan separately. Each candidate stays an atomic, domain-gate-green slice.
