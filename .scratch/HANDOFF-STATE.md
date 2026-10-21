# Context Checkpoint & Handoff State — Ellie's Book

> Address the user as **SHUAI**. Tag consequential claims with `[Fact]` / `[Inference]` / `[Assumption]` / `[Projection]` / `[Unknown]` (per AGENTS.md + ADR 0003).
> This file is written so a brand-new session with zero memory can resume confidently.

---

## 0. Snapshot (refresh-critical)

| Field | Value |
| :--- | :--- |
| **Git branch at handoff** | `feat/w7-graph-first-landing` (feature branch off `main`; NOT yet pushed) |
| **`main` base SHA** | `fe0b7d1` ("docs(adr): record ADR 0002 graph-first canvas hero interface...") |
| **Mandatory green gate** | `node --test tests/budget-domain.test.mjs` |
| **Gate result** | `[Fact]` **14/14 passing** on `main` at `fe0b7d1`. (The previous handoff claim of 16/16 was DRIFT and is corrected here.) After W7-T1 the gate should read 15+/pass. |
| **Can build/lint here?** | `[Fact]` NO. No `node_modules`; `pnpm install` fails HTTP 403. So `pnpm run lint`, `pnpm run build` (`vinext build`), and `tests/rendered-html.test.mjs` CANNOT run in this sandbox. They are best-effort / CI-only (see ADR 0003). |
| **Can push / open PR here?** | `[Fact]` NO. Planner + coder never publish. The orchestrator pushes the branch and opens the PR. |
| **Telegram notifier** | `[Fact]` Out of scope (no external network / bot). |

---

## 1. Objective

`[Fact]` Deliver the **Ellie's Book** product goal (README): bridge PLAN (projects / work / deliverables / notes) and REALITY (budgets / commitments / POs / invoices / actuals) via:
- Pillar 1: a visual node canvas + Obsidian knowledge graph as the HERO interface;
- Pillar 2: 100% auditable modular tables + clear plan-vs-reality charts;
- Pillar 3: adaptive mobile ops (capture / insight / 1-tap approvals at 390px).

`[Fact]` The core domain engine is DONE (Waves 1-6 committed). The remaining frontier is **UX cohesion** and solidifying the two locked decisions as first-class in the live user flow.

---

## 2. Locked Decisions (confirmed by SHUAI — not a pivot)

- `[Fact]` **Decision 1 (Persistence): HYBRID Local-First + Cloud D1/SQLite.** Matches ADR 0001 Decision 1.
- `[Fact]` **Decision 2 (Canvas interaction): DUAL-MODE graph** — structured auto-layout financial DAG (`Project -> WorkPackage -> PurchaseItem -> SourcingAllocation -> Quotation/PO/Invoice`) PLUS a toggleable force/freeform Obsidian `[[wikilink]]` knowledge overlay. Matches ADR 0001 Decision 2 and ADR 0002.

---

## 3. Team Architecture (Kiro-native — see ADR 0003)

`[Fact]` AGENTS.md external-model roles (Gemini Argon High lead, Claude CLI executor, Gemini review subagents, Telegram gate) are NOT available in Kiro. They are remapped:
- **Orchestrator + Planner** = lead architect: strategy, spec, tickets, routing, publish.
- **`coder` subagent** = definitive vertical-slice TDD executor (one ticket at a time, commits on a feature branch).
- **`semantic-reviewer` subagent** = dual-gate behavioral/spec review (writes a verdict artifact).

`[Fact]` Preserved discipline: SHUAI address; epistemic tags; controlled language; no multi-step work without a `.scratch/tickets/` file; atomic test-green slices; handoff refresh per wave; 3-strike pivot rule.

`[Fact]` Adapted verification gate: `node --test tests/budget-domain.test.mjs` is the ONLY mandatory green gate in this sandbox. lint / build / rendered-html are best-effort and MUST run in a build-capable env or CI before merge.

---

## 4. Verified ground truth (what exists)

- `[Fact]` `app/budget-domain.mjs` (1618 lines): pure dependency-free domain engine — allocations, budget versions, lifecycle lineage, graph projection, wikilink extraction / backlink index, Obsidian vault serialize/parse, hybrid sync receipt, canonical-table formatters.
- `[Fact]` `app/ellies-book-workbench.tsx` (4128 lines): the main UI. Graph Canvas, Inspector drawer, nodes/edges, wikilinks already present. `JourneyStep = "overview" | "graph" | "vault" | "tables" | "classic"`; default is `"overview"` (see gap below).
- `[Fact]` `app/page.tsx` (514 lines): legacy Function Budget Studio shell, reached via a "Setup" sidebar group.
- `[Fact]` `db/schema.ts` (217 lines): populated Drizzle schema, ~14 canonical tables.
- `[Fact]` `app/api/sync/route.ts`: GET/POST hybrid D1 + local-first sync endpoint.
- `[Fact]` `tests/budget-domain.test.mjs` (737 lines): 14 tests. Includes `assert.doesNotMatch` source guards over the workbench that forbid finance/dev jargon in visible copy (e.g. `Mode A ·`, `Mode B ·`, `Financial Lineage DAG`, `On-the-Fly Command Bar`, `Canonical relational table switcher`, `Attach [[Note]]`). Keep these green.
- `[Fact]` ADRs: `0001` (hybrid + dual-graph), `0002` (graph-first + adaptive surfaces), `0003` (Kiro-native team + gate — new this session).

---

## 5. The gap driving Wave 7

`[Fact]` ADR 0002 requires the Visual Canvas Map (dual-mode graph) to be the **default landing surface**. But the workbench defaults `journeyStep` to `"overview"` (a table/KPI view) and labels the graph as step "2. Workflow map". Decision 2's "hero interface" is therefore not yet realized in the landing flow. This is W7-T1.

`[Fact]` Known UX follow-ups from Wave 5/6 handoff (fold into Wave 7):
- (a) Overview "The plan" table — residual horizontal scroll check at 1440px (Wave 6 consolidated 9->6 cols; confirm/finish).
- (b) KPI / chart copy still leaks finance jargon: "open PO" appears in chart head/legend (~line 3680 of the workbench).
- (c) Mobile quick-capture forms long — Wave 6 added progressive-disclosure bottom sheet; confirm it holds at 390px.

---

## 6. Completed vs. next

`[Fact]` **Completed & committed (on `main`):**
- Wave 1 — domain engine + Drizzle schema (`W1-domain-and-schema.md`).
- Wave 2/3 — dual-mode graph + Obsidian UI + table workbench + charts (`W2-dual-mode-graph-and-obsidian-ui.md`).
- Wave 4 — Obsidian vault round-trip + `/api/sync` hybrid D1 (`W4-hybrid-sync-and-obsidian-vault.md`).
- Wave 5 — approachability redesign (single framed-sheet journey, plain-language copy).
- Wave 6 — plan-table consolidation, plain-language KPIs, mobile bottom-sheet forms.

`[Fact]` **New this session (durable artifacts):**
- `docs/adr/0003-kiro-native-team-architecture-and-verification-gate.md`.
- This refreshed `.scratch/HANDOFF-STATE.md` (test count corrected 16 -> 14; branch/SHA/constraints/decisions recorded).
- `.scratch/tickets/W7-graph-first-landing-and-ux-cohesion.md` (W7-T1 .. W7-T5).
- `.agents/tasks/task-graph-first-ux-cohesion/` (planner task state: task.json, context.json, features/FEAT-001.json).

`[Fact]/[Projection]` **In progress / next:**
- **W7-T1 (graph-first default landing)** is the targeted first slice of Wave 7 — see section 7 for status.

---

## 7. Explicit next unblocked step

`[Fact]` **W7-T1 — graph-first is the confirmed default landing surface.**
- File: `app/ellies-book-workbench.tsx`. Change initial `journeyStep` default from `"overview"` to the graph surface; reorder/relabel the left-nav so the workflow map is primary; keep plain-language labels and all `doesNotMatch` guards green; do not touch node coordinates or financial totals (ADR 0002 Coordinate Invariance).
- Test: add a deterministic guard in `tests/budget-domain.test.mjs` asserting the graph surface is the default initial `journeyStep`.
- Gate: `node --test tests/budget-domain.test.mjs` must pass (>= 15 tests).
- After W7-T1: proceed to W7-T2 (dual-mode toggle clarity), then W7-T3 (plan-table 1440px), W7-T4 (KPI/chart jargon sweep — remove "open PO" from visible copy), W7-T5 (mobile capture length + hybrid-sync coherence).

`[Reminder]` Before merge, the orchestrator / CI MUST run in a build-capable env: `pnpm install && pnpm run lint && pnpm run build && node --test tests/rendered-html.test.mjs`.
