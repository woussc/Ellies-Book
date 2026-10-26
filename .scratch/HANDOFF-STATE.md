# Context Checkpoint & Handoff State - Ellie's Book

> Address the user as **SHUAI**. Tag consequential claims with `[Fact]` / `[Inference]` / `[Assumption]` / `[Projection]` / `[Unknown]` (per AGENTS.md + ADR 0003).
> This file is written so a brand-new session with zero memory can resume confidently.
> **Checkpoint**: **Wave 12 (Dark node-graph canvas re-theme + interaction model) PLANNED** - latest. Prior waves (7-11) below remain for history.

---

## W12 - Dark canvas re-theme + whole-app interaction model (PLANNED this session)

| Field | Value |
| :--- | :--- |
| **Branch** | `[Fact]` `docs/w12-dark-canvas-retheme-plan`, off `main` @ `55d1725` (Wave 10 UI overhaul + the congress merged; app LIVE on the Pages preview). |
| **Gate** | `[Fact]` `node --test tests/budget-domain.test.mjs` = **21/21** at branch creation (baseline; docs do not affect it). |
| **Decision (do not reopen)** | `[Fact]` SHUAI chose **Option 2**: a DARK, premium node-graph **CANVAS as the hero** + LEGIBILITY-DISCIPLINED data surfaces (tables/forms/Setup/reports) + a refined **tab/hover/positioning** model across the whole app. This REVERSES ADR 0006's quiet LIGHT direction for the hero and AMENDS it for the rest. |
| **ADR** | `[Fact]` **ADR 0008** `docs/adr/0008-dark-canvas-retheme-and-interaction-model.md` (Status Proposed). **Supersedes ADR 0006 for the canvas/hero; amends it for data surfaces.** 0008 confirmed next free number (0001-0003,0005,0006,0007 exist; 0004 on open PR #4 - DO NOT touch #4). |
| **Task state** | `[Fact]` `.agents/tasks/task-w12-dark-canvas-retheme/` (context.json + FEAT-001..003 + task.json). `.agents/` is gitignored (local only). |
| **Artifacts committed** | `[Fact]` `docs/adr/0008-...md`, `docs/UI-INTERACTION-SPEC-w12.md` (per-stage user-focus critique + interaction model), `.scratch/tickets/W12-dark-canvas-retheme.md` (WS-A -> B/C/D), and this handoff. |

### The plan (congress-driven)
- `[Fact]` **Dark `--eb-*` token plan** (ADR 0008 Decision 1), grounded in `ui-ux-pro-max/data/colors.csv` row 6 "Financial Dashboard" + row 4 "Luxury dark": ground ramp `#060910`/`#0e1320`/`#161c2b`/`#1c2437`, line `#263044`, soft ink `#e8ecf4` (NOT #fff), muted `#94a3b8`, accent `#35c08a`, status go `#22c55e` / alert `#ef4444` / warn `#f59e0b` / idle `#94a3b8`, canvas-only `--eb-node-glow` + `--eb-edge-*` gradients. Type scale 13/16/20/24 UNCHANGED.
- `[Fact]` **Status colour** rides the node badge + the edge ribbon; green = go/healthy, red = alert, amber = warn, grey = idle (meaning, not decoration).
- `[Fact]` **Flow edges** = curved bezier + status-coloured gradient ribbons (thin DAG / thick knowledge overlay), geometry derived from node pixel coords (view state only).
- `[Fact]` **Interaction model** (SHUAI's first priority): KEEP left rail = global space switcher (grouped, dark active pill); ADD a TOP in-surface tab row (underline/accent pill) for sub-views; subtle data-surface hover (no fill flip); canvas node hover = luminance + status halo; right-docked zoom/fit/branch controls + NEW bottom-right mini-map; preserve view state on tab switch. Per-stage user-focus critique for all 5 surfaces is in `docs/UI-INTERACTION-SPEC-w12.md`.
- `[Fact]` **THE CRUX - glow vs the taste gate** (ADR 0008 Decision 7): `inspect.mjs --app` FAILs on `gradient`/`heavy-shadow`/`glass`/`icon-chips`, but every rule honours an allow-list (`--allow` or `.taste-skill/direction.json` `{allow:[...]}`). WS-B commits a direction.json waiving exactly those IDs, SCOPED to the canvas, justified per rule; the data surfaces run the gate with NO waivers. NOT a `data-ui` wrapper (that trips `ui-wrapper` on a title-bearing full surface).

### Sequencing (ready to fan out)
- `[Fact]` **WS-A FOUNDATION (blocking)**: dark `:root` tokens + interaction model in the shell. Files: `app/globals.css` (`:root` + `.eb-sidebar`/`.eb-header`/shell/nav), `app/ellies-book-workbench.tsx` (shell/nav ~2280-2520 + top tab-row scaffold). Merge FIRST.
- `[Fact]` Then **WS-B / WS-C / WS-D in parallel** off post-WS-A `main`, each its own branch, disjoint regions:
  - WS-B canvas block (`graph`) + `.eb-canvas*`/`.eb-edge*`/`.eb-graph-node` + NEW `.eb-minimap` + direction.json.
  - WS-C overview + tables blocks + `.eb-kpi*`/`.eb-plan-table`/`.eb-table*` (NO waivers).
  - WS-D `app/page.tsx` Setup + the vault block + `.studio-*`/`.eb-vault*`/`.eb-md*` (NO waivers).
- `[Fact]` **Coordinate Invariance (ADR 0002)** carried into WS-B: visuals/view-state only; do NOT touch `budget-domain.mjs`, the geometry, or the checksum.
- `[Fact]` **Guards** (`tests/budget-domain.test.mjs`, 21/21): recommended model KEEPS the journey labels + graph-first default, so no guard change needed for nav shape. If a coder renames a guarded label or CSS class (`.eb-workbench`/`.eb-kpi-strip`/`.eb-graph-workspace`/`.eb-command-bar`), the SAME PR re-anchors the guard (coverage preserved, not deleted).
- `[Fact]` Do NOT touch `budget-domain.mjs`, `db/schema.ts`, `/api/sync`, the Worker, `ci.yml`, `pages.yml`, `vite.config*`.
- `[Projection]` **Ready to fan out: WS-A first, then B/C/D in parallel on disjoint files / own branches.**
- `[Fact]` **Honesty**: planner cannot run a browser or the skills' scripts in-sandbox; the spec is reasoned from the references + vendored docs/CSVs. Real visual proof = CI (`inspect.mjs --app` + Playwright) + the Pages preview.

---

## W11 — UI/UX Congress Skills (PLANNED this session)

| Field | Value |
| :--- | :--- |
| **Branch** | `[Fact]` `feat/congress-uiux-skills`, off `main` @ `c6f71a0` (Wave 10 UI overhaul merged + live on Pages). |
| **Gate** | `[Fact]` `node --test tests/budget-domain.test.mjs` = **21/21** at branch creation (baseline, unaffected by docs/vendoring). |
| **Request** | `[Fact]` SHUAI: install two GitHub skills and blend them with the taste-skill into a single routed "congress of UI/UX design workflow". Skills: `ui-ux-pro-max` (MIT v2.15.0, `nextlevelbuilder/ui-ux-pro-max-skill`) + `impeccable` (**Apache 2.0** v4.7.1, `pbakaus/impeccable`). |
| **Reach** | `[Fact]` General web + npm + `git clone` BLOCKED (403). Both target repos reachable ONLY via the `gh` gateway (`gh api .../contents/<path> --jq .content | base64 -d`). Skills' scripts CANNOT run in-sandbox → vendored as REFERENCE. |
| **Task state** | `[Fact]` `.agents/tasks/task-congress-uiux-skills/` (context.json + FEAT-001..004 + task.json). |
| **Artifacts authored** | `[Fact]` `docs/VENDORING-PLAN-congress.md` (exact source→dest file sets + exclusions) and `.scratch/tickets/W11-uiux-congress.md` (T1-T4). |

### The blend (congress) — synthesis recorded
- `[Inference]` **taste-skill** (`.agent/skills/design-taste-frontend/`) = ART DIRECTION + the anti-slop VERIFICATION GATE (`scripts/inspect.mjs --app` at 1440/768/390 + critique rubric). Owns PASS/FAIL.
- `[Inference]` **ui-ux-pro-max** (`.agent/skills/ui-ux-pro-max/`) = DESIGN-INTELLIGENCE LIBRARY (styles / 192 palettes / font pairings / 119 UX guidelines / charts / 22 stacks) + design-system token architecture. Grounds decisions; does not mandate a look.
- `[Inference]` **impeccable** (`.agent/skills/impeccable/`) = CRAFT & POLISH LOOP (craft→critique→polish→harden verbs + craft-floor) applied in Operate mode during build and before the gate.
- `[Fact]` **Precedence rule (protects the shipped look)**: **ADR 0006's quiet light app-screen `--eb-*` system stays the binding visual system.** The congress blends PROCESS and taps the LIBRARY; it is NOT a licence to re-skin (no re-theme to kinpaku or any other palette) unless SHUAI explicitly redirects.

### What is DONE vs NEXT
- `[Fact]` DONE this session: all planning artifacts (task state, vendoring plan, W11 tickets, this handoff) + ADR 0007 authored (see below if present). Branch created; gate 21/21.
- `[Projection]` NEXT (coder fan-out, each keeps gate 21/21): **T1** vendor `ui-ux-pro-max` selected files; **T2** vendor `impeccable` selected files; **T3** author `docs/adr/0007-uiux-congress-design-workflow.md` + `.agent/skills/uiux-congress/SKILL.md` (if not already committed); **T4** wire AGENTS.md §3 + CLAUDE.md pointer + the two PROVENANCE/LICENSE pairs. `[Flag]` T4 edits AGENTS.md §3 (previously authorized). Orchestrator publishes; do NOT touch PR #4.

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
- **Wave 7 — graph-first landing + end-to-end UX cohesion (this session; see §5).**

`[Projection]` **Next (see `.scratch/tickets/W8-post-wave7-followups.md`):** non-blocking follow-ups seeded as candidate tickets for a future session, plus the CI/visual verification pass and the ROADMAP §5 next step (Cloudflare D1 / multi-tenant auth deployment).

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

---

## 9. Wave 10 (UI overhaul) PLANNED (ADR 0006 + W10 backlog): ready to fan out

`[Fact]` Planning branch `docs/w10-ui-overhaul-plan` off `main` (`321a72e`). Domain gate on `main` = **20/20**. Artifacts committed:
- `docs/adr/0006-ui-overhaul-taste-skill-direction.md`: the app-screen design direction from the vendored taste-skill (`.agent/skills/design-taste-frontend/`, `--app` rules). ADR number 0006 confirmed free (0004 is on PR #4; 0005 is on main).
- `.scratch/tickets/W10-ui-overhaul.md`: the parallel-safe workstream backlog.

`[Fact]` **Design direction (ADR 0006)**: evolve the existing `framed-sheet` shell. Palette = quiet tinted ground (not #fff), softened near-black ink (not #000), one calm accent under 5% of any screen on the action + one data element only, which answers "too harsh on the eyes". Type = few sizes far apart (13/16/20/24px, body =16px, one 24px h1), which answers "hard to track / not digestible". Nav model = LEFT sidebar switches spaces (grey active pill), TOP bar holds page-specific actions only. "Minimum information, maximum impact" = one question + one dominant element per surface, progressive disclosure, honest empty/zero states, colour means something. House rules: no gradients/glows/resting shadows/rainbow charts/fake dashboards/glass/eyebrows/tracked caps.

`[Fact]` **Workstreams** (exact files each owns, so they parallelize without collision):
- **WS-A (FOUNDATION, blocking)**: tokens + nav-shell restructure + remove training mode + add left-toolbar "Sample data / Developer" button + clean blank default. Files: `app/globals.css` (`:root` + shell/sidebar/top-bar), `app/ellies-book-workbench.tsx` (shell/header/sidebar ~2138-2340 + footer + `mode` prop removal), `app/page.tsx` (training removal + sample-data loader + mount).
- **WS-B**: Obsidian-like canvas (infinite pan/zoom, edges correct at any offset, fit-to-selected-node). Files: `app/ellies-book-workbench.tsx` graph subsystem (~881-905, ~1395-1458, ~2980-3320, edges SVG ~3193-3242), `app/globals.css` `.eb-canvas*`/`.eb-edge*`/`.eb-graph-node`. Root cause found: edges `<svg viewBox="0 0 1220 520">` is a fixed box while nodes pan/scale via CSS transform, so edges break past that bound. **Hard guardrail: ADR 0002 Coordinate Invariance (view state only; do NOT touch `budget-domain.mjs`).**
- **WS-C**: Notes markdown -> polished document. Files: `app/ellies-book-workbench.tsx` vault block (`renderNotePreviewWithWikilinks` ~1928, render ~3476-3760) + NEW in-repo `app/markdown-render.*`, `app/globals.css` `.eb-md*`/`.eb-vault*`. **Dependency recommendation: build a small dependency-free in-repo markdown renderer, NOT a new npm dep** (sandbox can't install; keeps domain engine pure; reuses the existing `[[wikilink]]`/`#tag` tokenizer). A real MD dep is a deferrable follow-up only if CI refreshes the lockfile.
- **WS-D**: Setup redesign (per-team tailored definitions under a common business intent). Files: `app/page.tsx` classic studio components, `app/globals.css` `.studio-*`/`.library-*`/`.definition-*`/`.tag-*`.

`[Inference]` **Parallelization**: WS-A merges first and owns/freezes the one shared region (`:root` tokens + shell/top-level state). Then WS-B / WS-C / WS-D run simultaneously on disjoint JSX blocks and disjoint CSS class families, so no further serialization is needed beyond each rebasing on post-WS-A `main`.

`[Fact]` **Guards that must stay green** (all in `tests/budget-domain.test.mjs`, 20/20): the pinned journey labels (`1. Workflow map`/`2. Overview`/`3. Notes`/`4. Reports &amp; export`), `useState<JourneyStep>("graph")` default, the "Show on map" lens + `showNoteLinks` wiring, the plain-language sync states, the mobile plan-card layout, and the `assert.doesNotMatch` finance/dev jargon guards. Accounting terms stay in `title`/tooltips only. Do NOT touch `budget-domain.mjs`, `db/schema.ts`, `/api/sync`, the Worker, `ci.yml`, `pages.yml`, or `vite.config.pages.ts`.

`[Fact]` **Verification per slice**: local `node --test tests/budget-domain.test.mjs` 20/20; CI `pnpm run lint` + `pnpm run build` + `tests/rendered-html.test.mjs` + `inspect.mjs --app` (0 FAIL at 1440/768/390) + Playwright; visual confirmation on the Pages preview `https://woussc.github.io/Ellies-Book/` after merge.
