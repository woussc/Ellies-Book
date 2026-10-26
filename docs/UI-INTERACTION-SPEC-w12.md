# UI Interaction Spec - Wave 12 (tab switching, hover, positioning) + per-stage user-focus critique

> **For**: **SHUAI** (`Chen Shuaizhou`). Epistemic tags per AGENTS.md. Controlled language.
> **Companion to**: [`docs/adr/0008-dark-canvas-retheme-and-interaction-model.md`](./adr/0008-dark-canvas-retheme-and-interaction-model.md).
> **Governing workflow**: the congress (ADR 0007). Verification = taste-skill `inspect.mjs --app` in CI + Playwright 1440/768/390 + the Pages preview. The planner cannot run a browser or the skills' scripts in-sandbox; this spec is reasoned from the five pasted references + the vendored skill docs/CSVs.

This is SHUAI's FIRST priority: redesign tab switching, hover, and positioning to improve clicking and switching, introduce a better workflow, and critique the user's focus at each stage. The per-stage user-focus critique below is the headline deliverable; the interaction decisions follow from it.

---

## 1. Per-stage USER-FOCUS CRITIQUE (one question + one dominant element + focus + guidance per surface)

`[Fact]` The app has five spaces (the `JourneyStep` union: `graph` / `overview` / `vault` / `tables` / `classic`). For each, the critique states the ONE question it answers, the ONE dominant element, what the user is actually focused on at that stage and step, and how tab-switching / hover / positioning should GUIDE that focus.

### Stage 1 - Workflow map (the canvas hero, `graph`)
- `[Fact]` **One question**: "Where does this project's money flow, and what is left?"
- `[Fact]` **One dominant element**: the node-graph canvas. The inspector drawer is secondary.
- `[Inference]` **What the user is focused on**: tracing the left-to-right flow (Project to WorkPackage to Item to Allocation to Quote/PO/Invoice), spotting a node in trouble, and drilling into one node. At the step level: (a) orient on the whole flow, (b) find the alert node, (c) open it, (d) act.
- `[Inference]` **Critique of the shipped state**: the flow is legible but FLAT - nothing pulls the eye to the node that needs a decision, and the user must read every node to find trouble. The controls are present but not positioned as a stable cluster, and there is no overview (mini-map) for a large graph, so on a big project the user loses their place when they pan.
- `[Fact]` **Interaction guidance**:
  - **Focus pull**: status colour on the node badge + the edge ribbon (Decision 3/4) makes the alert node the first thing read, so step (b) is a glance, not a scan.
  - **Positioning**: dock zoom/fit/branch to the RIGHT edge and the mini-map + scale slider BOTTOM-RIGHT (references 1, 5), so the controls are always where the hand expects them and never cover a node.
  - **Hover**: hovering a node raises its luminance + shows its status halo, and brightens its connected edges, so the user sees a node's lineage before clicking (reduces mis-clicks).
  - **Switching**: clicking a node opens the inspector WITHOUT leaving the canvas; "fit to selected" frames the node + neighbours so step (c) keeps context.

### Stage 2 - Overview (the plan table + KPIs, `overview`)
- `[Fact]` **One question**: "How much of the approved budget is committed vs left?"
- `[Fact]` **One dominant element**: the "left to spend" figure, with the plan table supporting it.
- `[Inference]` **What the user is focused on**: the single headline number, then scanning rows for the line that is over or at risk. Step level: (a) read the headline, (b) find the row that moved, (c) compare against plan.
- `[Inference]` **Critique**: on a dark theme a table can turn into a wall of equal-weight text; the risk is that the headline number and the one row that matters sink into the grid. The user's focus must be protected by weight, alignment, and one status colour, not by glow.
- `[Fact]` **Interaction guidance**:
  - **Focus pull**: the headline figure leads at `--eb-step-lead`/`h1`; the table uses tabular right-aligned numbers; status pills (pale tint of the status hue) mark only the rows that need a decision.
  - **Hover**: a one-lightness-step row hover, no fill flip (`app-screens.md` §7.8); the selected row takes the active fill, so a hover is never mistaken for a selection.
  - **Switching**: arriving from a canvas node selection pre-filters/scrolls the table to that node's row, so the canvas-to-table switch keeps the user's subject.

### Stage 3 - Notes (the reading pane, `vault`)
- `[Fact]` **One question**: "What was decided, and why?"
- `[Fact]` **One dominant element**: the rendered note document (the reading pane), not the raw markdown editor.
- `[Inference]` **What the user is focused on**: reading prose and following `[[wikilinks]]` / `#tags` back to the graph. Step level: (a) read, (b) jump to a linked node or tag, (c) return.
- `[Inference]` **Critique**: a reading surface demands the calmest treatment of all; glow or low contrast here directly harms reading. The user's focus is the sentence, so the pane must be a quiet document with a capped measure, and the only colour is on the interactive pills.
- `[Fact]` **Interaction guidance**:
  - **Focus pull**: body 16px / 1.6 leading, measure capped ~70ch, headings within the 16/20/24 scale; ink `--eb-ink` on `--eb-sheet`.
  - **Hover**: a wikilink/tag pill lifts to the accent on hover; nothing else moves.
  - **Switching**: clicking a `[[wikilink]]` jumps to the graph and frames that node (`jumpToNode`), so Notes-to-canvas is one click and keeps the subject.

### Stage 4 - Reports & export (canonical tables, `tables`)
- `[Fact]` **One question**: "Export the audited tables."
- `[Fact]` **One dominant element**: the table being exported.
- `[Inference]` **What the user is focused on**: picking the right canonical table and copying/exporting it cleanly. Step level: (a) pick the table, (b) verify it reconciles, (c) export.
- `[Inference]` **Critique**: this is a precision surface; the focus is correctness, so the table switcher must be an obvious top in-surface tab row (not buried), and the numbers must line up digit-for-digit. No decoration competes with the data.
- `[Fact]` **Interaction guidance**:
  - **Positioning / switching**: the canonical-table switcher is a TOP in-surface tab row (underline/segmented), so picking a table is a single obvious click (reference 3/5 top tabs).
  - **Hover**: subtle; the active table tab carries the one active marker.
  - **State**: switching tables preserves scroll/selection per `app-interface.csv` (`unmountOnBlur: false`).

### Stage 5 - Setup (per-team definitions under a common intent, `classic`)
- `[Fact]` **One question**: "What common goal do all teams serve, and how does each team tailor its spending definitions?"
- `[Fact]` **One dominant element**: the stated common business intent at the top.
- `[Inference]` **What the user is focused on**: first the shared intent, then editing one team's tailored definitions. Step level: (a) read the common intent, (b) pick a team, (c) edit its definitions.
- `[Inference]` **Critique**: Setup is the densest form surface; the focus must land on the common intent first, then on quiet flat panels per team. No eyebrows/tracked-caps/step-stamps (banned), no glow; real form fields keep their borders.
- `[Fact]` **Interaction guidance**:
  - **Focus pull**: the common intent is the dominant element; per-team tailoring reads as repeated flat `--eb-surface` panels beneath it.
  - **Positioning / switching**: if Setup has areas (Library / Plan / Needs attention), each is its own view reached from the left rail's Setup group (one view per area, `app-screens.md` §8.2), not one long scroll.
  - **Hover**: subtle on list items; clear focus ring on inputs in the accent.

---

## 2. Recommended concrete interaction model (decisions, each tied to the critique and a reference)

### 2.1 Navigation shape - left rail (spaces) + top in-surface tabs (sub-views)
- `[Fact]` **Decision**: KEEP the left `eb-sidebar` as the global space switcher for the five spaces (grouped, collapsible), per reference 3's left rail and the shipped ADR 0006 model. ADD a TOP in-surface tab row for surfaces with sub-views (Reports table switcher; any future canvas layout modes), per references 3 and 5.
- `[Inference]` **Why**: global navigation lives in exactly one place (the left rail), so the user never hunts for "where am I"; in-surface tabs sit where the eye already is (the top of the working sheet), so sub-view switching is low-travel. This ties to the Stage 4 critique (the table switcher must be obvious) and the Stage 1 critique (space switching must not compete with canvas controls).
- `[Fact]` **Anti-pattern avoided**: global space-switching never moves into the top bar; in-surface tabs never appear in the left rail (`app-screens.md` §3.2: nav items are other screens, not anchors).

### 2.2 Active state
- `[Fact]` Left-rail active space = a raised/brightness-step `is-active` pill (dark rule: label `#bbb` to `#fff` + optional accent text), carried from ADR 0006 and `app-screens.md` §3.2.
- `[Fact]` In-surface active tab = a 2px underline on a 1px rule (reference 5) OR one filled accent pill (reference 3's lime pill). Pick ONE per the surface; do not mix underline and pill in the same row.
- `[Fact]` One "you are here" marker per level; the two levels (space + sub-view) each show exactly one.

### 2.3 Hover
- `[Fact]` **Data surfaces**: one lightness step on rows/items; NO fill flip (`app-screens.md` §7.8); the selected row takes the active fill so hover and selection never collide. Buttons/controls get a quiet press/hover; focus rings in the accent.
- `[Fact]` **Canvas (permitted-exception zone)**: a node raises luminance + shows its status halo on hover; its connected edges brighten their ribbon. This is feedback, allowed under ADR 0008 Decision 7, scoped to the canvas.

### 2.4 Positioning
- `[Fact]` **Canvas controls** (zoom -, zoom %, zoom +, fit-to-selected, fit-to-all, reset, NEW branch-layout toggles) dock to the RIGHT edge of the canvas as a vertical cluster (references 1, 5). The shipped `eb-canvas-controls` cluster already holds zoom/fit/reset; WS-B re-docks it right and adds branch toggles.
- `[Fact]` **Mini-map** + scale slider dock BOTTOM-RIGHT (reference 1), NEW. It renders a thumbnail of the node bounding box + the current viewport rectangle; dragging it pans. Pure view state (ADR 0002).
- `[Fact]` **Inspector drawer** stays the secondary element on the canvas; the canvas dominates (ADR 0006 Decision 4.2).
- `[Fact]` **Top header** keeps the title + finding line + contextual action cluster (the shipped `eb-header`); it recedes and holds only real actions (`app-screens.md` §3.3).

### 2.5 Switching feel (fast, obvious, low-travel) + state preservation
- `[Fact]` Switching between the five spaces = one click in the left rail. Switching sub-views = one click in the top tab row.
- `[Fact]` Tab switches PRESERVE each surface's view state: canvas pan/zoom/selected node, table scroll/selection, notes scroll. Grounded in `ui-ux-pro-max/data/app-interface.csv` ("Preserve Screen State", `unmountOnBlur: false`). Returning to a surface restores it, so the user never re-orients.
- `[Fact]` Cross-surface subject carry: selecting a canvas node then opening Overview scrolls to that node's row; clicking a `[[wikilink]]` in Notes jumps to and frames that canvas node.

### 2.6 Mobile (390px)
- `[Fact]` The left rail folds into the existing mobile drawer (`mobileNavOpen`); on the phone the five spaces may also present as a bottom tab bar of up to 5 destinations (reference 2; `app-interface.csv` "Bottom Tabs" max 5). The canvas keeps +/- zoom and a Back chip (reference 2). The mobile plan-card layout guard stays green.

---

## 3. Reference-to-decision map

| Reference | Patterns taken | Applied to |
| :--- | :--- | :--- |
| 1 - dark node-graph "General statistics" | node status badge, thin bezier edges, right-docked controls, bottom-right mini-map + scale slider, big KPI | Stage 1 canvas; §2.4 positioning |
| 2 - dark glassy mobile trio | bottom 5-tab bar, +/- zoom + Back chip, status dots, outcome sentence | §2.6 mobile |
| 3 - AppDynamics NextGen Financial (KEY for data + nav) | top text tabs with ONE active lime pill, left grouped/collapsible rail, gradient health flow ribbons, dense legible right panels, KPI with sparkline | §2.1 nav shape; §2.2 active; Stage 2/4 data surfaces; ADR 0008 Decision 5 |
| 4 - Home Bot V2 (LIGHT, structure only) | port-based node cards, grouped left node palette, top sub-view tabs, zoom %, bottom category legend | Stage 1 node-card structure; §2.1 top tabs |
| 5 - Data visualisation (gradient ribbons) | top tabs with underline active, centered timeline segmented control, thick gradient Sankey ribbons, right-docked zoom/fit/branch, bottom KPI row | §2.1/§2.2; Stage 1 edges; ADR 0008 Decision 4 |

---

## 4. Test guards affected if the nav changes
`[Fact]` See ADR 0008 §3 "Test guards affected". The recommended model KEEPS the five journey labels and the graph-first default, so NO guard change is required for the nav shape. IF a coder renames a label, changes the `JourneyStep` default, or renames a guarded CSS class (`.eb-workbench` / `.eb-kpi-strip` / `.eb-graph-workspace` / `.eb-command-bar`), the SAME PR updates the guard in `tests/budget-domain.test.mjs` to the new reality, preserving coverage (never deleting it).
