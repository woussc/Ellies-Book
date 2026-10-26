# ADR 0008: Dark Node-Graph Canvas Re-theme and Whole-App Interaction Model

- **Status**: Proposed
- **Date**: 2026-10-26
- **Decider**: **SHUAI** (`Chen Shuaizhou`)
- **Scope**: The visual system and the whole-app interaction model (tab switching, hover, positioning). A DARK, premium node-graph **canvas as the hero**; LEGIBILITY-DISCIPLINED data surfaces (tables, forms, Setup, reports); and a refined tab/hover/positioning model across every surface.
- **Supersession**: **This ADR SUPERSEDES ADR 0006 for the canvas / hero surface, and AMENDS ADR 0006 for every other (data) surface.** ADR 0006's "quiet, light, framed-sheet" mandate no longer governs the canvas. Its legibility discipline (few type sizes far apart, 16px body, honest states, colour means something, one dominant element per surface) is CARRIED FORWARD, re-expressed on a dark ground, for the data surfaces.
- **Governing method**: `.agent/skills/uiux-congress/SKILL.md` (ADR 0007) pipeline, Operate mode. `scripts/inspect.mjs --app` remains the CI PASS/FAIL gate, with a scoped exception recorded in Decision 7.
- **Related ADRs**: ADR 0002 (graph-first + adaptive surfaces, Coordinate Invariance), ADR 0006 (the superseded/amended light app-screen system), ADR 0007 (the congress workflow + its "no re-skin without a superseding ADR" clause - **this ADR is that superseding ADR**).

---

## 1. Context

`[Fact]` SHUAI asked to overhaul the UI toward a set of dark node-graph dashboard references, to redesign tab switching / hover / positioning, and to critique the user's focus at each stage. This REVERSES ADR 0006's quiet LIGHT direction for the hero. ADR 0007 Decision 3 requires an explicit superseding ADR from SHUAI before any re-skin. SHUAI chose **Option 2**:

1. `[Fact]` A **dark, premium node-graph CANVAS as the hero** surface (matching the references).
2. `[Fact]` The **data-dense surfaces** (tables, forms, Setup, reports) stay **legibility-disciplined**: calm and readable on a dark ground, not a glow bath.
3. `[Fact]` A **refined tab / hover / positioning interaction model across the WHOLE app** (specified in Decision 8 and in the companion `docs/UI-INTERACTION-SPEC-w12.md`).

`[Fact]` This is the first real task driven through the congress (ADR 0007). The pipeline is followed in the planning: **frame + critique the user focus per stage** (the companion spec), **ground** choices in `.agent/skills/ui-ux-pro-max/data/*.csv` + `design-system/`, **craft** the interaction model + node-graph with impeccable's `layout`/`typeset`/`colorize`/`craft-floor` Operate-mode references, and **verify** against the taste-skill gate + Playwright + the Pages preview.

### 1.1 The five pasted references (encoded faithfully)

`[Fact]` SHUAI pasted five images. They cannot be stored as files here; they are encoded below so the spec is reproducible.

1. **Dark node-graph "General statistics" dashboard**: near-black ground; a left summary card (Total Users 438, Projected income 546, inline sparkline bars); a left-to-right flow of rounded node cards joined by thin curved bezier edges; each node has a title + muted subtitle + a small circular +/status badge top-left (green = go, red = alert); a top-left big KPI "7,541,390 / All users / DETAIL>"; a right-docked vertical control cluster (+/- zoom, a fit/target button, branch-layout toggles); a bottom-right mini-map thumbnail + "Scale 50%" slider. Status colour rides the node badge + a subtle coloured edge glow.
2. **Mobile trio (dark, glassy)**: a frosted "Service Insights" card screen on a blue-to-green gradient with a big outcome sentence + a "Swipe ^" affordance; a mobile node-graph with +/- zoom, a "Back" chip, green connection dots, a bottom time-scrubber with a pink "100+" pill; a "TCP Throughput / Service Overview" screen with a High/Medium/Low KPI triplet, a small bar chart with an "Alerts 52 Excellent" callout, a Service/From/Status table with Alert/Warm pills, and a 5-icon bottom tab bar (active heart tab = white rounded).
3. **AppDynamics "NextGen Financial" dark dashboard** (the key reference for DATA surfaces + nav): near-black; a TOP nav of horizontal text tabs with ONE active lime-green pill ("Applications") + right search + avatar; a secondary filter strip; a LEFT rail of grouped, collapsible nav with icons ("Applications Dashboard, Business Transactions, Service Endpoints, Tiers & Nodes, Servers, ... Troubleshoot" expanded to "Slow Response Time / Errors"); a CENTER "Application Flow Map" of nodes joined by thick GRADIENT flow ribbons coloured by health (lime=success, red=error, grey=pending) with inline latency labels; a RIGHT rail of dense health panels (Events, Business/Node/Server Health, Transaction Scorecard with tiny status bars, Exceptions) using small lime/amber/red segmented bars; a BOTTOM row of small metric cards (Load, Response Time with sparkline, Errors with a radial gauge). Active tab = filled lime pill; nav hover subtle.
4. **"Home Bot V2" LIGHT node-builder** (the one light reference, used for STRUCTURE only): Overview/Builder/Behaviour/Simulation/Logs top tabs; a "Live Vision" primary button top-right; a left rail of Nodes/Templates with search + grouped Inputs/Events/Logic/Actions; a center node canvas with input/output port rows per node and curved connectors; a right "Vars" inspector; a red "+" FAB bottom-left; a "100%" zoom control; a bottom legend of node categories. Shows a clean port-based node-card + interaction model.
5. **"Data visualisation" dark dashboard** (gradient flow ribbons): near-black; top nav text tabs (Statistics / Overview active with underline / Dashboard / Analytics) + search; a centered timeline segmented control (1W/1M/3M active=blue pill/1Y/ALL); a central Sankey-like flow (left "Finance" card to middle cards Sales $13,430 / Investments / Startup to right cards) joined by THICK translucent GRADIENT ribbons (blue to pink to purple); each card shows a value + "x% more than last year"; right-docked zoom/fit/branch controls; a bottom row of 3 icon+big-number KPIs.

`[Inference]` **Common visual language** across all five, to encode: dark near-black grounds; luminous rounded node cards; curved bezier/gradient flow EDGES (thin or thick); STATUS COLOUR (green=go/healthy, red=alert, amber=warn) on the node badge + the edge; a right-docked zoom/fit/branch + mini-map cluster; a top nav of text tabs with ONE active pill or underline + an optional segmented timeline control; a left grouped/collapsible rail; dense but legible right-side health/metric panels; KPI = big number + tiny label + micro-sparkline, never a tinted icon tile.

`[Fact]` **Ground truth of the shipped app** (verified in code, Wave 10 merged at `main` `55d1725`):
- Left `eb-sidebar` is the global space switcher with a grey `is-active` pill and `eb-count-pill` counts; the five spaces are `1. Workflow map`, `2. Overview`, `3. Notes`, `4. Reports & export`, and a `Setup` group (`app/ellies-book-workbench.tsx` ~2280-2460).
- The top `eb-header` holds the project title, the plain-English finding line, and the contextual action cluster (~2470-2520). This is already ADR 0006 Decision 3's "left = spaces, top = page actions" model.
- The canvas engine is already built: `CANVAS_ZOOM_MIN 0.2` / `CANVAS_ZOOM_MAX 3`, empty-canvas pan, `fitToSelectedNode` / `fitToAllNodes` / `resetCanvasView`, and a **shared 1:1 coordinate SVG** (`eb-edges-svg` sized to `stageBounds`, no `viewBox` remap) so edges stay attached at any pan/zoom/offset (~3208-3440). Node `x`/`y` come from `projection` (the pure domain engine). **There is no mini-map yet.**
- The `:root` tokens are the ADR 0006 light set (`app/globals.css` ~3-27): `--eb-ground #f6f7f8`, `--eb-sheet #fdfdfc`, `--eb-ink #1f2328`, `--eb-accent #2f6d5b`, and the type steps 13/16/20/24.

`[Fact]` **The gate we must not break.** The taste-skill `scripts/inspect.mjs --app` is the CI PASS/FAIL authority (ADR 0006/0007). Its app mode runs `judgeApp()` plus a filtered `judge()` (`.agent/skills/design-taste-frontend/scripts/lib/rules.mjs`). The rules that a dark glowing node-graph would trip are: `gradient` (FAIL; from `judge()` and NOT in `APP_SKIP`, so it still fires in app mode), `heavy-shadow` and `glass` (FAIL; from `judgeApp()`), `icon-chips` (FAIL at >=2 hues), `rainbow-chart` (FAIL over 6 hues), and `colour-sprawl` (WARN over 12% coloured pixels). `[Fact]` **Every one of these is suppressible**: each `add()` is gated by `if (!allow.includes(id))`, and `inspect.mjs` merges allowances from `--allow id,id` and from a `.taste-skill/direction.json` `{ "allow": [...] }`. This is the lever that makes a dark hero pass the gate (Decision 7).

`[Fact]` **Honesty.** The planner cannot run a browser or the skills' scripts in this sandbox (no `node_modules`; network blocked). Token values and the gate reconciliation are reasoned from the references + the vendored skill docs/CSVs. The only runnable gate here is `node --test tests/budget-domain.test.mjs` (**21/21** on this branch). The real visual proof is CI (`inspect.mjs --app` + Playwright at 1440/768/390) and the live Pages preview `https://woussc.github.io/Ellies-Book/`.

---

## 2. Decision (`[Proposed]`)

Adopt a **two-zone visual system on a shared dark ground**: a luminous node-graph HERO (glow/gradient permitted, scoped) and LEGIBILITY-DISCIPLINED data surfaces (no gratuitous glow). One token system expresses both. A refined whole-app interaction model governs tab switching, hover, and positioning.

### Decision 1: Dark palette ROLES and the concrete `--eb-*` dark token set

`[Fact]` The ground truth of the references is a near-black ground, luminous raised card surfaces, a strict accent, status green/red/amber, and a soft (not maximum-contrast) text ramp. `[Inference]` This is the next evolution of the `--eb-*` tokens: the SAME token NAMES keep their ROLES; only their VALUES move to a dark ramp. A single `:root` dark set is the one source of truth; a raw hex anywhere else is a second palette and is banned (carried forward from ADR 0006).

`[Fact]` Grounded in `ui-ux-pro-max/data/colors.csv` **row 6 "Financial Dashboard"** (bg `#020617`, surface `#0E1223`, border `#1A1E2F`, muted `#94A3B8`, positive green `#22C55E`, negative `#EF4444`) and **row 4 "E-commerce Luxury"** (the premium-dark + restrained-accent pattern). The proposed dark set:

```css
:root {
  /* GROUND RAMP (near-black, elevation by lightness alone per app-screens.md true-black-flat) */
  --eb-ground:   #060910;  /* app ground: the near-black frame + canvas void */
  --eb-sheet:    #0e1320;  /* the working data sheet, one lightness step up from ground */
  --eb-surface:  #161c2b;  /* panels / fields / node cards: one more step up, flat */
  --eb-raised:   #1c2437;  /* a node card or a floating panel that must read as luminous */
  --eb-line:     #263044;  /* the single 1px separator tone; a whisper on the dark ground */

  /* TEXT RAMP (soft, not #fff at max contrast; app-screens dark rule: #bbb to #fff) */
  --eb-ink:      #e8ecf4;  /* main text: a soft near-white, ~13:1 on --eb-sheet, NOT #ffffff */
  --eb-muted:    #94a3b8;  /* secondary text; still >=4.5:1 on --eb-sheet and --eb-surface */

  /* ACCENT (one calm accent; marks the one primary action + the one active data element) */
  --eb-accent:      #35c08a;  /* luminous green accent, legible on dark */
  --eb-accent-ink:  #04140d;  /* ink ON the accent fill */
  --eb-accent-dark: #28a074;  /* pressed/hover of the accent action */
  --eb-accent-soft: #112a22;  /* quiet accent wash for the one active data element */

  /* STATUS SEMANTICS (meaning, not decoration - Decision 3) */
  --eb-status-go:    #22c55e;  /* green: healthy / go / approved */
  --eb-status-alert: #ef4444;  /* red: alert / over / error */
  --eb-status-warn:  #f59e0b;  /* amber: warning / pending-attention */
  --eb-status-idle:  #94a3b8;  /* grey: pending / off / no-signal */

  /* CANVAS-ONLY luminous tokens (permitted-exception zone - Decision 7) */
  --eb-node-glow:    0 0 0 1px #263044, 0 8px 24px -8px rgba(53,192,138,.18); /* node elevation + faint halo */
  --eb-edge-go:      linear-gradient(90deg, rgba(34,197,94,.0), rgba(34,197,94,.9));   /* status flow ribbon */
  --eb-edge-alert:   linear-gradient(90deg, rgba(239,68,68,.0), rgba(239,68,68,.9));
  --eb-edge-idle:    linear-gradient(90deg, rgba(148,163,184,.0), rgba(148,163,184,.6));
}
```

- **Proportion** (carried from ADR 0006, re-measured on dark): ground + sheet + surface hold 85-95% of each screen; the accent stays **under 5% of any screen** and marks only the primary action + its one data element; status colour marks only status. On dark, elevation is by **lightness step, not shadow**, on data surfaces (true-black-flat rule, `app-screens.md` §3.1).
- `[Projection]` Exact hex values are a starting point the WS-A coder tunes against the CI contrast + colour-share meters; the ROLES and PROPORTIONS are the binding decision.

### Decision 2: Type scale (keep the few-sizes discipline)

`[Fact]` ADR 0006 Decision 2's scale is CARRIED FORWARD unchanged in size; only colour tokens move to dark:

```css
--eb-step-small: 0.8125rem; /* 13px captions, table sublabels */
--eb-step-body:  1rem;      /* 16px body / table cells (reading floor; never below 16) */
--eb-step-lead:  1.25rem;   /* 20px the one finding line under the title */
--eb-step-h1:    1.5rem;    /* 24px the single sheet h1 */
```

One `h1` per surface at 24px; nothing between 16/20/24; figures `font-variant-numeric: tabular-nums`, right-aligned. `[Fact]` App-screen rules add: KPI figures run 16-40px (none >= 48px, `kpi-size`); 4-9 font sizes (`size-count`). The hero KPI in reference 1 ("7,541,390") is large but still within the 40px figure ceiling, or it is set as the `h1` finding, not display type.

### Decision 3: Status-colour semantics

`[Fact]` Colour means good/bad, not up/down (ADR 0006 Decision 4.5, `app-screens.md` §5). On the dark theme:
- `--eb-status-go` (green) = healthy / within budget / approved / go.
- `--eb-status-alert` (red) = over budget / error / needs a decision.
- `--eb-status-warn` (amber) = pending attention / nearing a limit.
- `--eb-status-idle` (grey) = pending / no signal / zero.

Status rides the **node badge** (the top-left circular +/status badge in references 1 and 2) AND the **edge** (the status-coloured ribbon in references 1, 3, 5). A node with no status issue carries the idle/neutral badge, not green; green is reserved for a true "go", so a wall of green is not the resting state.

### Decision 4: Flow-edge treatment (bezier + gradient status ribbons)

`[Fact]` The existing canvas already draws curved bezier edges from shared pixel coordinates (`eb-edge-path`, cubic `C` paths). `[Inference]` The re-theme:
- Keeps the bezier geometry (it is view-state derived from domain coordinates; see Decision 6).
- Restyles edges as **status-coloured gradient ribbons** (`--eb-edge-go/alert/idle`), thin for the lifecycle DAG and thicker/translucent for the knowledge-link overlay, matching references 1 (thin) and 3/5 (thick gradient ribbons).
- Adds a subtle coloured edge glow ONLY on the canvas (permitted-exception zone, Decision 7).
- The `knowledge_backlink` edges stay gated on `showNoteLinks` (the guarded dual-mode lens) exactly as today.

### Decision 5: Legibility carve-out for data surfaces (the AMENDMENT to ADR 0006)

`[Fact]` ADR 0006's legibility discipline is retained for the data surfaces (Overview tables, Reports, KPI strip, Notes reading pane, Setup), re-expressed on the dark ground:
- No gratuitous glow, no gradient fills, no resting shadows on data panels; separation by a lightness step or a 1px `--eb-line` whisper (`heavy-borders` rule: ~1.2-1.5:1 on dark).
- Readable contrast: `--eb-ink` on `--eb-sheet` >= ~13:1; `--eb-muted` >= 4.5:1. No text under 13px; body 16px.
- KPIs = big number + tiny label + optional **micro-sparkline** (reference 3's Response Time card), never a tinted icon tile (`icon-chips`). `[Note]` `app-screens.md` §5 says the 23 LIGHT study screens drew no KPI sparkline; the dark references (1, 3) do. The sparkline is permitted as a small inline chart in the data surface because it carries data, but it is NOT a tinted icon tile and the KPI label/number lead.
- Tables: no zebra, right-aligned tabular numbers, status pills as pale-tint-on-dark of the status hue.
- Reference 3 is the controlling example for how dense the dark data panels may be while staying legible.

### Decision 6: Coordinate Invariance holds for the canvas (ADR 0002)

`[Fact]` The re-theme changes **visuals and view state only**. Node geometry (`x`/`y` from `projection`), financial totals, lineage, canonical tables, and the sync checksum MUST stay identical. The WS-B coder does NOT touch `app/budget-domain.mjs`, `db/schema.ts`, or `app/api/sync/route.ts`. Pan/zoom/fit/mini-map are pure view state. The domain gate proves totals never change; it stays green.

### Decision 7: The glow/gradient exception reconciled with the taste-skill gate (THE CRUX)

`[Fact]` The taste-skill `--app` house rules mechanically FAIL on gradients (`gradient`), heavy shadows/glow (`heavy-shadow`), glass blur (`glass`), and multi-hue icon chips (`icon-chips`). A dark glowing node-graph hero WILL trip these if nothing is done, which would make CI an impossible gate. The reconciliation:

1. `[Fact]` **Glow/gradient are PERMITTED on the canvas hero ONLY**: the node-edge glow, the gradient flow ribbons, and the status halos on node badges. They are NOT permitted on the data surfaces (Decision 5), where the legibility discipline still holds.
2. `[Fact]` **Mechanism - a scoped allow-list, NOT a data-ui wrapper.** The inspector honours allowances from `--allow id,id` and from `.taste-skill/direction.json` `{ "allow": [...] }`. The project commits a `direction.json` (or the CI `inspect.mjs` invocation passes `--allow`) that waives exactly these rule IDs, with a one-line justification each:
   - `gradient` - the canvas flow ribbons are status-carrying data edges, not chrome decoration.
   - `heavy-shadow` - the node-card elevation + faint status halo is the hero's signature luminosity; data panels keep flat elevation.
   - `glass` - only if a frosted node/control surface is used (reference 2); at most one blurred layer.
   - `icon-chips` - only if the node status badge reads as a tinted circle; justify as the product's signature status mark, not a generated-dashboard KPI tile.
3. `[Fact]` **Why not wrap the canvas in `data-ui`.** `data-ui` marks a cropped interface fragment, but the `ui-wrapper` rule FAILs when a `data-ui` element wraps a heading or more than ~1.5 screens. The canvas hero is a full-surface, title-bearing region, so a `data-ui` wrapper would trip `ui-wrapper`. The scoped allow-list is the correct, documented lever.
4. `[Fact]` **The waiver is scoped and justified, not blanket.** Each waived rule is listed with its reason in `direction.json`; the data surfaces run the gate with NO waivers, so a glow that leaks off the canvas into a table still FAILs. The WS coders record any added allowance and its reason in their PR (per `app-screens.md` §2.8 "any check you allowed and why", e.g. `--allow icon-chips`).
5. `[Projection]` If a future taste-skill version adds a canvas-aware rule set, prefer that over the allow-list. Until then, the scoped allow-list keeps CI a real gate on the data surfaces while permitting the decided dark hero.

### Decision 8: The whole-app interaction model (SHUAI's first priority)

`[Fact]` Full detail, with the per-stage user-focus critique, lives in `docs/UI-INTERACTION-SPEC-w12.md`. The binding decisions:

- **Navigation shape.** KEEP the left rail as the global **space switcher** (the five spaces), grouped and collapsible per reference 3's left rail. ADD, within a surface that has sub-views, a **top in-surface tab row** (underline or one segmented pill) per references 3 and 5. Global space-switching never moves into the top bar; in-surface tabs never appear in the left rail. This reconciles the shipped ADR 0006 model with the references.
- **Active state.** Left-rail active space = a grey/raised `is-active` pill (carried from ADR 0006 / `app-screens.md` §3.2 dark rule: brightness step + optional accent text). In-surface tabs = a 2px underline or one filled accent pill (reference 3's lime pill, reference 5's underline). One "you are here" marker per level; never two at once.
- **Hover.** Subtle everywhere on data surfaces: one lightness step, no fill flip on table rows (`app-screens.md` §7.8). On the CANVAS: a node raises luminance + shows its status halo on hover; an edge brightens its ribbon. Hover is feedback, within the permitted-exception zone for the canvas.
- **Positioning.** The canvas control cluster (zoom -, zoom %, zoom +, fit-to-selected, fit-to-all, reset, and NEW branch-layout toggles) docks to the **right edge** of the canvas (references 1, 5). A NEW **mini-map** + scale slider docks **bottom-right** (reference 1). The inspector drawer stays the secondary element; the canvas dominates (ADR 0006 Decision 4.2 carried forward).
- **Switching feel.** Fast, obvious, low-travel. Tab switches PRESERVE each surface's view state (scroll, canvas pan/zoom, selected node), per `ui-ux-pro-max/data/app-interface.csv` (`unmountOnBlur: false`). Switching between the five spaces is a single click in the left rail; switching sub-views is a single click in the top tab row.

---

## 3. Consequences

### Positive
- `[Inference]` One dark `--eb-*` token system keeps the look coherent and lets every workstream rebase cleanly, exactly as the light system did in Wave 10.
- `[Inference]` The two-zone model gives SHUAI the premium dark hero from the references AND keeps the data surfaces trustworthy and legible, which is the whole point of Option 2.
- `[Inference]` The scoped allow-list keeps `inspect.mjs --app` a REAL gate on the data surfaces while permitting the decided canvas glow, so CI does not become an impossible gate and the anti-slop discipline still bites where it matters.

### Costs / risks
- `[Fact]` Visual confirmation cannot happen in this sandbox. It happens in CI (`inspect.mjs --app` + Playwright 1440/768/390) and on the Pages preview after merge. Every workstream's acceptance includes a CI visual pass.
- `[Projection]` WS-B (the canvas re-theme) is the highest-risk slice: it must hold Coordinate Invariance (Decision 6) while restyling edges and adding a mini-map. Hard guardrail: view state only; `budget-domain.mjs` and the checksum do not change.
- `[Fact]` The dark theme must keep contrast above the gate's thresholds; a soft near-white ink (`#e8ecf4`), not pure `#fff`, and muted text >= 4.5:1 are binding, not cosmetic.
- `[Projection]` If the nav redesign changes the pinned journey labels or structure, the test guards below must be UPDATED to the new reality by the coder (coverage preserved, not deleted).

### Test guards affected (what must update if nav changes)
`[Fact]` In `tests/budget-domain.test.mjs` (currently **21/21**):
- The pinned journey labels `1. Workflow map` / `2. Overview` / `3. Notes` / `4. Reports & export` and `Quick actions`, and the `1. Operational` / `2. Managerial` / `3. Accounting` labels (~482-494). If WS-A keeps the five spaces and their labels (recommended), NO change is needed. If a label or structure changes, the WS-A coder updates the guard to assert the NEW label, keeping coverage.
- `useState<JourneyStep>("graph")` graph-first default (~503). KEEP; the canvas hero only strengthens this.
- The `Show on map` lens + `showNoteLinks` wiring and the dual-mode toggle. KEEP.
- The CSS-presence guards `.eb-workbench` / `.eb-kpi-strip` / `.eb-graph-workspace` / `.eb-command-bar` (~497-500). These class names must survive the re-theme, or the guard is re-anchored to the renamed class in the same PR.

### Verification (every surface)
1. `node --test tests/budget-domain.test.mjs` stays **21/21** (this ADR is docs-only; it does not touch `app/`).
2. CI: `pnpm run lint` + `pnpm run build` + `tests/rendered-html.test.mjs` green; `inspect.mjs --app` reports 0 FAIL at 1440/768/390 on the DATA surfaces with NO waivers, and 0 FAIL on the CANVAS with the scoped, justified `direction.json` allow-list (Decision 7).
3. Visual review on the live Pages preview `https://woussc.github.io/Ellies-Book/` after merge.
