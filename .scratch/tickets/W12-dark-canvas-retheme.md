# Wave 12: Dark node-graph canvas re-theme + whole-app interaction model (parallel-safe workstreams)

- **Wave**: Wave 12 (proposed / not yet started)
- **Status**: `proposed`
- **Blocked By**: WS-A is the foundation. WS-B, WS-C, WS-D all rebase on WS-A and start only after it merges.
- **Governing ADRs**: **ADR 0008 (dark canvas re-theme + interaction model)** - supersedes ADR 0006 for the canvas/hero, amends it for data surfaces. ADR 0007 (congress workflow), ADR 0002 (Coordinate Invariance), ADR 0005 (Pages preview).
- **Design method**: the congress (`.agent/skills/uiux-congress/SKILL.md`), Operate mode. For each ticket: FRAME (the surface's one question + dominant element), GROUND (ui-ux-pro-max `data/*.csv` + `design-system/`), CRAFT (impeccable `layout`/`typeset`/`colorize`/`craft-floor`), VERIFY (taste-skill `inspect.mjs --app`).
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (**21/21** on `main` @ `55d1725`). lint / build / rendered-html / `inspect.mjs --app` / Playwright are **CI-only** in this sandbox (ADR 0003); visual confirmation is on the Pages preview `https://woussc.github.io/Ellies-Book/` after merge.

> `[Context]` SHUAI chose Option 2: a DARK premium node-graph CANVAS as the hero, LEGIBILITY-DISCIPLINED data surfaces, and a refined whole-app tab/hover/positioning model. See ADR 0008 for the dark `--eb-*` token plan, status colours, flow edges, the legibility carve-out, and the glow/gradient-vs-gate reconciliation; see `docs/UI-INTERACTION-SPEC-w12.md` for the per-stage user-focus critique and the interaction model.

> `[Hard guardrail, all tickets]` Do NOT touch `app/budget-domain.mjs`, `db/schema.ts`, `app/api/sync/route.ts`, `worker/index.ts`, `vite.config.ts`, `vite.config.pages.ts`, `.github/workflows/ci.yml`, or `.github/workflows/pages.yml`. Keep every `assert.doesNotMatch` jargon guard and every pinned label/state string in `tests/budget-domain.test.mjs` green. Accounting terms stay in `title`/tooltip attributes only. Coordinate Invariance (ADR 0002): the canvas re-theme changes VISUALS and VIEW STATE only, never node geometry feeding totals or the checksum.

> `[Collision lesson from W10]` W10's parallel coders collided in a shared worktree. In W12, each coder MUST take its OWN branch off post-WS-A `main` and own DISJOINT file regions / CSS class families. WS-A owns and FREEZES the one shared region (`:root` tokens + the shell/top-level state); B/C/D only READ the tokens.

---

## Parallelization map (which files each workstream owns)

| WS | Objective | PRIMARY files it edits | Shared regions to coordinate |
| :-- | :-- | :-- | :-- |
| **WS-A** (FOUNDATION) | Dark `--eb-*` token set in `:root` + the whole-app interaction model (tab switching / hover / positioning) in the shell | `app/globals.css` (`:root` ~3-27 dark tokens, `.eb-sidebar` ~399, `.eb-header` ~594, shell/nav/active/hover classes), `app/ellies-book-workbench.tsx` (shell/nav JSX ~2280-2460, `eb-header` ~2470-2520, top in-surface tab row where a surface has sub-views) | Defines the dark tokens + shell every other WS consumes. Must land and merge FIRST. |
| **WS-B** | Canvas hero re-theme: dark luminous node cards + status badges + gradient/bezier status flow edges + right-docked zoom/fit/branch controls + NEW mini-map | `app/ellies-book-workbench.tsx` canvas block only (controls ~3208-3240, edges SVG ~3389-3440, nodes ~3477+), `app/globals.css` canvas classes (`.eb-canvas-viewport`, `.eb-canvas-stage`, `.eb-edges-svg`, `.eb-edge-*`, `.eb-graph-node`, `.eb-canvas-controls`, `.eb-lane-guides`, NEW `.eb-minimap`), NEW committed `.taste-skill/direction.json` (scoped canvas allow-list) | Edits the `journeyStep === "graph"` block only. |
| **WS-C** | Data-surface legibility pass on dark: Overview tables, Reports/canonical tables, KPI strip as big-number + sparkline | `app/ellies-book-workbench.tsx` overview + tables blocks (KPI strip, `.eb-plan-table`, canonical-table switcher/views), `app/globals.css` data classes (`.eb-kpi-strip`, `.eb-plan-table`, `.eb-table-*`, table/pill classes) | Edits the `overview` + `tables` blocks only. |
| **WS-D** | Setup + Notes on dark: common intent + per-team panels; markdown reading pane | `app/page.tsx` classic studio slot + `app/ellies-book-workbench.tsx` vault block (`renderNotePreviewWithWikilinks` ~2138, vault render ~3681-3960), `app/globals.css` Setup + notes classes (`.studio-*`, `.library-*`, `.definition-*`, `.setup-intent-*`, `.eb-vault-*`, `.eb-markdown-*`, `.eb-md-*`) | Edits the `classic` + `vault` blocks only. |

`[Inference]` **No two of B/C/D edit the same JSX surface or the same CSS class family.** B owns the graph block + `.eb-canvas*`/`.eb-edge*` classes; C owns the overview/tables blocks + `.eb-kpi*`/`.eb-plan-table`/`.eb-table*` classes; D owns `app/page.tsx` + the vault block + `.studio-*`/`.eb-vault*`/`.eb-md*` classes. The ONE shared region is `app/globals.css` `:root` and the `app/ellies-book-workbench.tsx` shell/top-level state, OWNED and FROZEN by WS-A.

**Sequence**: WS-A first (merge to `main`). Then **WS-B, WS-C, WS-D run in parallel** off post-WS-A `main`, each on its own feature branch + PR.

---

## WS-A - Foundation: dark tokens + interaction model `[proposed]` `[BLOCKING]`

- **Objective**: Establish the ADR 0008 dark `--eb-*` token system and the whole-app interaction model (left rail = spaces; top in-surface tabs = sub-views; active/hover/positioning) so B/C/D rebase on it.
- **Congress steps**: FRAME (shell answers "where am I and how do I move?"); GROUND (colors.csv row 6 Financial Dashboard + row 4 Luxury dark; app-interface.csv nav/tab/state rows; design-system token-architecture.md); CRAFT (impeccable `layout` for the shell, `colorize` for the token ramp); VERIFY (`inspect.mjs --app` shell: dark active pill readable, no banned ornament on chrome).
- **Steps**:
  1. In `app/globals.css` `:root`, replace the light `--eb-*` values with the ADR 0008 Decision 1 dark set (ground ramp, raised surface, line, soft ink + muted, accent + states, status go/alert/warn/idle, and the canvas-only luminous tokens `--eb-node-glow`/`--eb-edge-*`). Keep the type steps 13/16/20/24 unchanged. Re-point the existing `.eb-*` chrome (sidebar, header, workbench sheet) to the dark tokens: near-black frame, `--eb-sheet` working sheet, flat `--eb-surface` panels, elevation by lightness step not shadow, body 16px, `tabular-nums` on figures.
  2. Left sidebar stays the global space switcher. Active space = a raised/brightness-step `is-active` marker on dark (label to `--eb-ink` + optional accent text), NOT a glow. Keep the five spaces and the guarded labels and order EXACTLY: `1. Workflow map`, `2. Overview`, `3. Notes`, `4. Reports & export`, then the `Setup` group. Keep the brand monogram/name pinned top and `Sample data / Developer` on the rail.
  3. Add a TOP in-surface tab row pattern (underline or one accent pill) for surfaces with sub-views (WS-C uses it for the canonical-table switcher). Global space-switching stays in the left rail only; in-surface tabs never go in the rail.
  4. Hover: data-surface rows/items get a one-lightness-step hover, no fill flip; selected takes the active fill; controls get quiet press/hover; focus rings in the accent.
  5. Keep the top `eb-header` as title + finding line + contextual actions (recedes otherwise). Preserve view state on tab switch (do not unmount surfaces).
- **Touches**: `app/globals.css` (`:root` + `.eb-sidebar`/`.eb-header`/shell/nav/active/hover classes), `app/ellies-book-workbench.tsx` (shell/nav JSX ~2280-2460, `eb-header` ~2470-2520, the top in-surface tab row scaffold).
- **Acceptance criteria**:
  - `node --test tests/budget-domain.test.mjs` = 21/21 (journey labels, graph-first default, `Quick actions`, `1. Operational`/`2. Managerial`/`3. Accounting`, lens/showNoteLinks, and `.eb-workbench`/`.eb-kpi-strip`/`.eb-graph-workspace`/`.eb-command-bar` CSS presence all intact). If a guarded CSS class is renamed, the SAME PR re-anchors the guard.
  - The app renders on a dark ground with a readable active-space marker and a working in-surface tab-row scaffold; no glow/gradient on the shell chrome.
  - CI: lint + build + rendered-html green; `inspect.mjs --app` 0 FAIL on the shell (no gradients/glows/shadows on chrome, body >=16px, contrast passes, one h1).
- **Verification**: domain gate locally; CI `inspect.mjs --app` + Playwright 1440/768/390; visual on the Pages preview after merge.

---

## WS-B - Canvas hero re-theme (dark nodes + status badges + gradient edges + right controls + mini-map) `[proposed]`

- **Objective**: Re-theme the already-shipped canvas engine into the dark luminous node-graph hero from references 1, 3, 4, 5. This is a VISUAL re-theme + edge treatment + controls/mini-map, NOT an engine rebuild (infinite pan/zoom/fit already exist).
- `[Fact]` **What already exists** (do not rebuild): `CANVAS_ZOOM_MIN 0.2`/`MAX 3`, empty-canvas pan, `fitToSelectedNode`/`fitToAllNodes`/`resetCanvasView`, and a shared 1:1 coordinate SVG (`eb-edges-svg` sized to `stageBounds`, no `viewBox` remap) so edges stay attached at any offset. Node `x`/`y` come from `projection` (the pure domain engine).
- **Congress steps**: FRAME (canvas answers "where does the money flow and what is left?"); GROUND (colors.csv status hues; app-screens.md canvas/builder guidance; impeccable Operate-mode node-card craft); CRAFT (`layout` for the node card + port rows, `colorize` for status badge + gradient ribbon); VERIFY (`inspect.mjs --app` canvas WITH the scoped allow-list).
- **Steps**:
  1. Re-theme `.eb-graph-node` into a dark luminous rounded card using `--eb-raised` + `--eb-node-glow`, with a title + muted subtitle + a top-left circular STATUS badge (`--eb-status-go/alert/warn/idle` per Decision 3). Keep the existing node type pill + collapse toggle + figure.
  2. Restyle edges (`.eb-edge-path` / `.eb-path-*`) as status-coloured gradient ribbons (`--eb-edge-go/alert/idle`): thin for the lifecycle DAG, thicker/translucent for the `knowledge_backlink` overlay (which stays gated on `showNoteLinks`). Keep the bezier `C`-path geometry computed from node pixel coordinates (view state only).
  3. Re-dock the `eb-canvas-controls` cluster to the RIGHT edge as a vertical stack and ADD branch-layout toggles. Keep Zoom -/+, zoom %, Fit to selected, Fit to all, Reset view (all already present).
  4. ADD a NEW mini-map + scale slider docked BOTTOM-RIGHT (`.eb-minimap`): a thumbnail of the node bounding box + a viewport rectangle; dragging it updates `pan`. Pure view state.
  5. Hover: a node raises luminance + shows its status halo; its connected edges brighten. Feedback only.
  6. Commit a `.taste-skill/direction.json` with `{ "kind": "app", "allow": ["gradient","heavy-shadow","glass","icon-chips"] }` and a one-line justification per rule in the PR body (ADR 0008 Decision 7). These waivers are SCOPED to the canvas; the data surfaces run the gate with NO waivers.
- **HARD guardrail (ADR 0002 Coordinate Invariance)**: the re-theme changes VISUALS and VIEW STATE only. Node geometry, financial totals, lineage, canonical tables, and the sync checksum stay identical. Do NOT touch `app/budget-domain.mjs`. Keep the domain gate green.
- **Glow-exception note**: glow/gradient/halo are PERMITTED here (the hero) and ONLY here; they must not leak into the data surfaces. Record the allow-list + reasons in the PR.
- **Touches**: `app/ellies-book-workbench.tsx` (canvas block only: controls ~3208-3240, edges SVG ~3389-3440, nodes ~3477+, NEW mini-map render), `app/globals.css` (`.eb-canvas-*`, `.eb-edges-svg`, `.eb-edge-*`, `.eb-graph-node`, `.eb-lane-guides`, NEW `.eb-minimap`), NEW `.taste-skill/direction.json`.
- **Acceptance criteria**:
  - The canvas renders dark luminous node cards with status badges, status-coloured gradient bezier edges, a right-docked control cluster, and a working bottom-right mini-map; node status is read before any label.
  - Dragging/panning/zooming keeps edges attached at any offset (unchanged behaviour); the mini-map tracks the viewport.
  - `node --test tests/budget-domain.test.mjs` = 21/21 (Coordinate Invariance + lens guards intact).
  - CI: lint/build/rendered-html green; `inspect.mjs --app` 0 FAIL on the canvas WITH the committed scoped allow-list; Playwright shows attached status edges at an offset.
- **Verification**: domain gate; CI visual with the direction.json allow-list; manual pan/zoom/mini-map check on the Pages preview.

---

## WS-C - Data-surface legibility pass on dark (Overview, Reports, KPI strip) `[proposed]`

- **Objective**: Make the Overview plan table, the Reports/canonical tables, and the KPI strip calm and legible on the dark ground, with the headline figure leading and status only where a decision is needed. NO gratuitous glow (ADR 0008 Decision 5 legibility carve-out).
- **Congress steps**: FRAME (Overview answers "committed vs left?"; Reports answers "export the audited tables"); GROUND (app-screens.md §5 KPIs, §7 tables, colors.csv status pills); CRAFT (`typeset` for the figure hierarchy, `layout` for the table grid); VERIFY (`inspect.mjs --app` data surfaces, NO waivers).
- **Steps**:
  1. KPI strip: express each KPI as a big number + tiny label + optional micro-sparkline (reference 3), NEVER a tinted icon tile (`icon-chips`). The "left to spend" figure leads at `--eb-step-lead`/`h1`. Figures `tabular-nums`, right-aligned, 16-40px (no >=48px, `kpi-size`).
  2. Overview + canonical tables on dark: no zebra, right-aligned tabular numbers, a 1px `--eb-line` whisper or a lightness step for separation (not heavy borders), status pills as a pale tint of the status hue with dark-hue text. One active data element in the accent; everything else ink/muted.
  3. Reports: wire the canonical-table switcher to the WS-A top in-surface tab row (underline/pill active). Preserve scroll/selection on switch.
  4. Row hover = one lightness step, no fill flip; selected row = active fill.
- **Glow-exception note**: NONE here. The data surfaces run `inspect.mjs --app` with NO waivers; a glow or gradient leaking in from the canvas still FAILs.
- **Touches**: `app/ellies-book-workbench.tsx` (overview + tables blocks: KPI strip, `.eb-plan-table`, canonical-table switcher/views), `app/globals.css` (`.eb-kpi-strip`, `.eb-plan-table`, `.eb-table-*`, table/pill classes).
- **Acceptance criteria**:
  - The headline figure leads the Overview; the plan table is legible on dark with tabular right-aligned numbers and status-only colour; the Reports table switcher is an obvious top tab row.
  - No tinted icon tiles on KPIs; no heavy borders or resting shadows on data panels.
  - `node --test tests/budget-domain.test.mjs` = 21/21.
  - CI: lint/build/rendered-html green; `inspect.mjs --app` 0 FAIL on the overview + tables surfaces with NO waivers.
- **Verification**: domain gate; CI visual; open Overview + Reports on the Pages preview.

---

## WS-D - Setup + Notes on dark `[proposed]`

- **Objective**: Bring the Setup surface (common intent + per-team tailored definitions) and the Notes reading pane onto the dark theme, keeping both legibility-disciplined (Setup forms, Notes document). No glow; real form fields keep borders.
- **Congress steps**: FRAME (Setup answers "common goal + per-team tailoring?"; Notes answers "what was decided and why?"); GROUND (app-screens.md §8 forms/settings, type.md reading measure); CRAFT (`typeset` for the reading pane, `layout` for the settings panels); VERIFY (`inspect.mjs --app` Setup + Notes, NO waivers).
- **Steps**:
  1. Setup: state the common business intent once as the dominant element at the top; per-team tailored definitions as repeated flat `--eb-surface` panels beneath. Keep the W10 banned-ornament removal (no eyebrows/tracked-caps/step-stamps). Inputs stay bordered; focus ring in the accent. If Setup spans areas, each is its own view from the left-rail Setup group (one view per area).
  2. Notes reading pane: body 16px / 1.6 leading, measure capped ~70ch, headings within 16/20/24, ink on `--eb-sheet`; `[[wikilink]]`/`#tag` pills lift to the accent on hover and keep their jump behaviour (`jumpToNode` / tag filter). Keep the markdown render path; do NOT move `extractWikilinks` out of the pure engine.
  3. No gratuitous glow or gradient on either surface.
- **Glow-exception note**: NONE here. Setup + Notes run the gate with NO waivers.
- **Touches**: `app/page.tsx` (classic studio slot: `setup-intent-*`, library/definition components), `app/ellies-book-workbench.tsx` (vault block: `renderNotePreviewWithWikilinks` ~2138, vault render ~3681-3960), `app/globals.css` (`.studio-*`, `.library-*`, `.definition-*`, `.setup-intent-*`, `.eb-vault-*`, `.eb-markdown-*`, `.eb-md-*`).
- **Acceptance criteria**:
  - Setup states one common intent as its dominant element with quiet per-team panels beneath; no banned ornaments.
  - The Notes reading pane reads as a calm document on dark with working `[[wikilink]]`/`#tag` pills.
  - `node --test tests/budget-domain.test.mjs` = 21/21 (no jargon-guard regressions; `extractWikilinks` unchanged).
  - CI: lint/build/rendered-html green; `inspect.mjs --app` 0 FAIL on Setup + Notes with NO waivers.
- **Verification**: domain gate; CI visual; open Setup + Notes on the Pages preview.

---

## Serialization note (the one shared region)

`[Inference]` The ONLY file region B/C/D share is `app/globals.css` `:root` tokens + the `app/ellies-book-workbench.tsx` shell/top-level state, OWNED and FROZEN by WS-A. B/C/D consume the dark tokens read-only; if a workstream needs a new token it asks WS-A to add it before fan-out. After WS-A merges, B edits only the graph block, C only the overview/tables blocks, D only the `classic` + `vault` blocks; they do not overlap in JSX, handlers, or CSS class families. Each rebases on post-WS-A `main`. No finer serialization is required.

## Sequencing summary

1. **WS-A** (blocking foundation: dark tokens + interaction model) -> merge to `main`.
2. **WS-B + WS-C + WS-D** in parallel off post-WS-A `main`, one feature branch + PR each, on disjoint files.
3. Each slice keeps the domain gate at 21/21, passes CI (`lint` + `build` + `rendered-html` + `inspect.mjs --app` + Playwright), and is visually confirmed on the Pages preview after merge. WS-B commits the scoped `.taste-skill/direction.json` allow-list; WS-C and WS-D run the gate with NO waivers.
