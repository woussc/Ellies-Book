# Context Checkpoint & Handoff State — Ellie's Book

> Address the user as **SHUAI**. Tag consequential claims with `[Fact]` / `[Inference]` / `[Assumption]` / `[Projection]` / `[Unknown]` (per AGENTS.md + ADR 0003).
> This file is written so a brand-new session with zero memory can resume confidently.
> **Checkpoint**: Wave 7 COMPLETE + Wave 8-A/8-B shipped (PR #3) + **Wave 8-C PLANNED** (ADR 0004 + W8C backlog, awaiting SHUAI inputs).

---

## 0a. Latest update (2026-10-22) — W8-A/B shipped, W8-C planned

`[Fact]` **Branch for this planning work**: `docs/w8c-deployment-plan`, cut off
`main` HEAD `0f9958e`. Domain gate `node --test tests/budget-domain.test.mjs` =
**19/19** green on this branch. This branch adds PLANNING artifacts only; it
modified NO production app files (`app/budget-domain.mjs`,
`app/ellies-book-workbench.tsx`, `app/page.tsx`, `db/schema.ts`,
`app/api/sync/route.ts`, and `.github/workflows/ci.yml` were read-only).

`[Fact]` **W8-A / W8-B shipped on `main`** (follow-ups from the Wave 7 dual-gate
review are now landed, open as PR #3 `feat/w8-mobile-plan-cards-and-guard`):
- **W8-A** (`7e3834a`): 390px stacked-card layout for the plan table (the
  W8-candidate-A mobile card layout SHUAI had flagged for decision).
- **W8-B** (`da76a9b`): re-anchored the hybrid-sync guard to a visible affordance
  string (resolves the W8-candidate-B stale-guard `[Note]`).
- `[Note]` PR #3 is a separate branch; this planning branch does NOT touch it.

`[Fact]` **W8-C is now PLANNED, not started.** Artifacts committed on
`docs/w8c-deployment-plan`:
- `docs/adr/0004-cloud-deployment-and-multi-tenant-auth.md` — deployment ADR:
  target = Cloudflare Workers + D1; hybrid local-first ⇄ cloud D1 of reference
  with **LWW + `eb-v1` checksum receipt**; tenant = a **workspace**, isolated by a
  shared-DB `workspace_id` scope column (pool model, not DB-per-tenant);
  recommended V1 auth = **Cloudflare Access** (Option A), with self-hosted session
  (B) and third-party provider (C) as alternatives; invariants preserved (ADR 0002
  Coordinate Invariance, pure domain engine, byte-stable checksum); secrets via
  `wrangler.toml` placeholder + GitHub Actions secrets, no env dumping.
- `.scratch/tickets/W8C-cloud-deployment.md` — atomic slices W8C-T1…T5:
  - **W8C-T1** wrangler.toml (placeholder id) + generated `./drizzle` migrations,
    no behavior change — *shippable now, config only*.
  - **W8C-T2** `workspace_id` scoping in `db/schema.ts` + `/api/sync` + NEW
    deterministic isolation tests (domain engine stays pure) — *shippable without
    the auth decision*.
  - **W8C-T3** minimal auth/session (login → workspace), route protection,
    local-first still works unauthenticated — **blocked on SHUAI auth choice**.
  - **W8C-T4** `.github/workflows/deploy.yml` (wrangler deploy + D1 migrate,
    gated on CI, secrets from Actions, no env dump) — **blocked on Cloudflare
    account/token/account-id/real D1 id**.
  - **W8C-T5** `docs/DEPLOYMENT.md` + `docs/DEVELOPMENT.md` pointer.

`[Fact]` **SHUAI-gated external inputs required before W8-C implementation**
(ADR 0004 §8; cannot be produced in the sandbox, must NOT be faked):
1. Cloudflare account + scoped `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
   (stored as GitHub Actions secrets).
2. A created D1 database (`wrangler d1 create ellies-book-d1`) and its real
   `database_id` (injected via environment; git keeps the `<YOUR_D1_DATABASE_ID>`
   placeholder).
3. Auth-provider decision: Option A Cloudflare Access (recommended) / B
   self-hosted session / C third-party provider.
4. `[Assumption to confirm]` R2 not needed for V1 (`r2: null`).

`[Projection]` Next unblocked frontier once inputs land: W8C-T1 then W8C-T2 (both
can start immediately as config + pure-logic slices); W8C-T3/T4 follow after the
auth choice and Cloudflare inputs; W8C-T5 closes the wave.

---

## 0. Snapshot (refresh-critical)

| Field | Value |
| :--- | :--- |
| **Git branch at handoff** | `feat/w7-graph-first-landing` (feature branch off `main`; **ALREADY PUSHED** — head of open PR #1 against `main`). |
| **Branch HEAD SHA** | `[Fact]` `4fa8068` ("fix(ux): plan table fits 1440px + clearer local/cloud backup (W7-T3, W7-T5)"). |
| **`main` base SHA** | `[Fact]` `fe0b7d1` ("docs(adr): record ADR 0002 graph-first canvas hero interface..."). |
| **Mandatory green gate** | `node --test tests/budget-domain.test.mjs` |
| **Gate result** | `[Fact]` **19/19 passing** on this branch at `4fa8068`. Progression this wave: 14 (`main`) → 15 (T1) → 16 (T2) → 18 (T4, +2) → 19 (T3/T5, +1). |
| **Can build/lint here?** | `[Fact]` NO. No `node_modules`; `pnpm install` fails HTTP 403. So `pnpm run lint`, `pnpm run build` (`vinext build`), and `tests/rendered-html.test.mjs` CANNOT run in this sandbox. They are CI-only (see ADR 0003). |
| **Can push / open PR here?** | `[Fact]` NO. Planner + coder never publish. The orchestrator pushes the branch and opens/updates the PR. |
| **Telegram notifier** | `[Fact]` Out of scope (no external network / bot). |

---

## 1. Objective

`[Fact]` Deliver the **Ellie's Book** product goal (README): bridge PLAN (projects / work / deliverables / notes) and REALITY (budgets / commitments / POs / invoices / actuals) via:
- Pillar 1: a visual node canvas + Obsidian knowledge graph as the HERO interface;
- Pillar 2: 100% auditable modular tables + clear plan-vs-reality charts;
- Pillar 3: adaptive mobile ops (capture / insight / 1-tap approvals at 390px).

`[Fact]` The core domain engine is DONE (Waves 1-6 committed). Wave 7 closed the **UX cohesion** frontier and made the two locked decisions first-class in the live user flow.

---

## 2. Locked Decisions (confirmed by SHUAI — now REALIZED in the live flow)

- `[Fact]` **Decision 1 (Persistence): HYBRID Local-First + Cloud D1/SQLite.** Matches ADR 0001 Decision 1. Realized in-flow by W7-T5: a persistent plain-language sync affordance ("Saved on this device" → "Backing up to the cloud…" → "Saved here and backed up to the cloud"), pure view-state `syncState: local|cloud|working`; the `/api/sync` contract and domain functions were NOT touched.
- `[Fact]` **Decision 2 (Canvas interaction): DUAL-MODE graph** — structured auto-layout financial DAG (`Project -> WorkPackage -> PurchaseItem -> SourcingAllocation -> Quotation/PO/Invoice`) PLUS a toggleable force/freeform Obsidian `[[wikilink]]` knowledge overlay. Matches ADR 0001 Decision 2 and ADR 0002. Realized in-flow by W7-T1 (graph-first default landing) + W7-T2 (plain-language dual-mode toggle: "Show on map" → "Spending flow" / "Spending flow + notes", pure view-state `showNoteLinks`).

---

## 3. Team Architecture (Kiro-native — see ADR 0003)

`[Fact]` AGENTS.md external-model roles (lead architect, Claude CLI executor, review subagents, Telegram gate) are NOT available in Kiro. They are remapped:
- **Orchestrator + Planner** = lead architect: strategy, spec, tickets, routing, publish.
- **`coder` subagent** = definitive vertical-slice TDD executor (one ticket at a time, commits on a feature branch).
- **`semantic-reviewer` subagent** = dual-gate behavioral/spec review (writes a verdict artifact).

`[Fact]` Preserved discipline: SHUAI address; epistemic tags; controlled language; no multi-step work without a `.scratch/tickets/` file; atomic test-green slices; handoff refresh per wave; 3-strike pivot rule.

`[Fact]` Adapted verification gate: `node --test tests/budget-domain.test.mjs` is the ONLY mandatory green gate in this sandbox. lint / build / rendered-html are CI-only and MUST run in a build-capable env or CI before merge.

`[Note]` ADR 0003 now names the lead-architect model as "Claude (latest model)". AGENTS.md §2 still names "Gemini 4 Argon (High)" — left intentionally unedited (AGENTS.md is SHUAI's operating contract / workspace rule file). See Open Item #3.

---

## 4. Verified ground truth (what exists)

- `[Fact]` `app/budget-domain.mjs`: pure dependency-free domain engine — allocations, budget versions, lifecycle lineage, graph projection, wikilink extraction / backlink index, Obsidian vault serialize/parse, hybrid sync receipt, canonical-table formatters. **UNCHANGED this wave** (Coordinate Invariance, ADR 0002).
- `[Fact]` `app/ellies-book-workbench.tsx`: the main UI. Graph Canvas, Inspector drawer, nodes/edges, wikilinks. `JourneyStep = "overview" | "graph" | "vault" | "tables" | "classic"`; **default is now the graph surface** (W7-T1).
- `[Fact]` `app/page.tsx`: legacy Function Budget Studio shell, reached via a "Setup" sidebar group.
- `[Fact]` `db/schema.ts`: populated Drizzle schema, ~14 canonical tables. **UNCHANGED this wave.**
- `[Fact]` `app/api/sync/route.ts`: GET/POST hybrid D1 + local-first sync endpoint. **UNCHANGED this wave.**
- `[Fact]` `tests/budget-domain.test.mjs`: **19 tests**. Includes `assert.doesNotMatch` source guards that forbid finance/dev jargon in visible copy, plus new W7 guards (graph-first default, "Show on map" lens gating of the inspector "Knowledge backlinks" row, "open PO" jargon removal, hybrid backup plain-language affordance).
- `[Fact]` ADRs: `0001` (hybrid + dual-graph), `0002` (graph-first + adaptive surfaces), `0003` (Kiro-native team + gate; references Claude latest model).

---

## 5. Wave 7 — COMPLETE (all five tickets, dual-gate APPROVED, committed + pushed)

`[Fact]` All on branch `feat/w7-graph-first-landing`:

| Ticket | Outcome (one line) | Commit |
| :--- | :--- | :--- |
| **W7-T1** | Graph-first default landing surface — realizes locked Decision 2 (graph is the hero). | `c44de9d` |
| **W7-T2** | Plain-language dual-mode canvas toggle: "Show on map" → "Spending flow" / "Spending flow + notes" (pure view-state `showNoteLinks`). | `ceef89f` |
| **W7-T4** | Removed residual "open PO" jargon → "Ordered, not yet paid" (heading/legend/inspector label/aria-label); accounting term kept only in `title` tooltips; seed KnowledgeNote (~line 679) intact; inspector "Knowledge backlinks" row gated on `showNoteLinks`. | `f1c987d` |
| **W7-T3** | Plan table fits 1440px — new `.eb-plan-table` CSS (`table-layout:fixed` + 6-col width budget + cell wrap; overrides global `white-space:nowrap`). | `4fa8068` |
| **W7-T5** | Mobile quick-capture confirmed short (Wave 6) + persistent plain-language hybrid local/cloud sync affordance (`syncState`, fail-safe failure copy, "Checksum"→"Reference"); `/api/sync` + domain untouched — realizes Decision 1 legibility. | `4fa8068` |

`[Fact]` Supporting commits on the branch: `c0afbe1` (ADR 0003 + refreshed HANDOFF + W7 backlog), `63433d5` (ADR 0003 lead-architect = Claude latest model).

`[Fact]` Coordinate Invariance (ADR 0002) held on every slice: `app/budget-domain.mjs`, `db/schema.ts`, `app/api/sync/route.ts` never changed.

`[Fact]` Review artifacts: `.agents/tasks/task-graph-first-ux-cohesion/` dated `*-review.md`. Note: `.agents/` is gitignored — local only, NOT committed.

---

## 6. Completed vs. next

`[Fact]` **Completed & committed:**
- Wave 1 — domain engine + Drizzle schema.
- Wave 2/3 — dual-mode graph + Obsidian UI + table workbench + charts.
- Wave 4 — Obsidian vault round-trip + `/api/sync` hybrid D1.
- Wave 5 — approachability redesign (single framed-sheet journey, plain-language copy).
- Wave 6 — plan-table consolidation, plain-language KPIs, mobile bottom-sheet forms.
- **Wave 7 — graph-first landing + end-to-end UX cohesion (see §5).**
- **Wave 8-A/8-B — Wave 7 follow-ups shipped (PR #3): 390px plan-table cards (`7e3834a`) + re-anchored sync guard (`da76a9b`). See §0a.**

`[Fact]` **Planned, not started (see §0a + `.scratch/tickets/W8C-cloud-deployment.md` + ADR 0004):** Wave 8-C — Cloudflare D1 + multi-tenant workspace auth deployment (ROADMAP §5 next step / `W4-T2`). Awaiting SHUAI inputs (Cloudflare account + D1 id + auth choice) before implementation.

---

## 7. Open items (non-blocking — surfaced by dual-gate review; awaiting SHUAI where noted)

1. `[Decision for SHUAI]` The Overview plan table has **no true 390px stacked-card layout**. `data-label` attributes exist on cells, but there is no `content: attr(data-label)` card-mode CSS, so on mobile the table falls back to horizontal scroll. If a mobile card layout is wanted, it is a separate future ticket (W8-candidate-A). Flagged to SHUAI on PR #1. **Do NOT auto-apply.**
2. `[Note]` Pre-existing test guard `assert.match(src, /Hybrid Sync Snapshot/)` is now satisfied only by a code comment (the phrase is no longer user-visible). Consider re-anchoring that guard to a visible string or the `/api/sync` call if that assurance still matters (W8-candidate-B).
3. `[Note / Decision for SHUAI]` AGENTS.md §2 still names "Gemini 4 Argon (High)" as lead architect while ADR 0003 now says Claude (latest model). Left as-is intentionally (AGENTS.md is the operating contract / workspace rule file). A one-line pointer in AGENTS.md → ADR 0003 would remove the apparent contradiction, but editing AGENTS.md requires SHUAI's explicit say-so. **Do NOT auto-apply.**
4. `[CI-only]` Visual confirmation at 1440px / 768px / 390px for the plan table (no clipping), the sync affordance (clean wrap), and the mobile capture sheet is still REQUIRED in a build-capable env — cannot be produced in this sandbox.

---

## 8. Required before merge (CI + visual) — reminder

`[Reminder]` In a build-capable env / CI, the orchestrator MUST run:
```
pnpm install && pnpm run lint && pnpm run build && node --test tests/rendered-html.test.mjs
```
plus the real-browser visual inspection at 1440px / 768px / 390px per Open Item #4. The domain gate `node --test tests/budget-domain.test.mjs` is already green at **19/19** on `4fa8068`.
