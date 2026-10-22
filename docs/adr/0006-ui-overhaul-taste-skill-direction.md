# ADR 0006: UI Overhaul Design Direction (taste-skill app-screen art direction)

- **Status**: Proposed
- **Date**: 2026-10-22
- **Decider**: **SHUAI** (`Chen Shuaizhou`)
- **Scope**: Visual system, navigation model, canvas/graph, notes reading, Setup redesign
- **Governing method**: `.agent/skills/design-taste-frontend/` (vendored `Leonxlnx/taste-skill` v2), `--app` run. This app is an **app screen** (a workbench people work in), so `references/app-screens.md` rules apply, NOT the landing-page run.
- **Related ADRs**: ADR 0001 (hybrid + dual-graph), ADR 0002 (graph-first + adaptive surfaces, Coordinate Invariance), ADR 0003 (Kiro-native team + gate), ADR 0005 (GitHub Pages preview).

---

## 1. Context

`[Fact]` SHUAI judges the current UI "too harsh on the eyes" and hard to track information in. The north star is **minimum information, maximum impact**: calmer, more legible, more digestible.

`[Fact]` The surfaces that need the overhaul are three files:
- `app/ellies-book-workbench.tsx` (~4227 lines): the main shell, left "Project journey" nav, the graph canvas (SVG edges + absolutely-positioned nodes), the Overview plan table, the charts, the Notes/vault surface, the hybrid-sync affordance.
- `app/page.tsx` (~514 lines): the legacy "Function Budget Studio" shell (the "Setup" surface), plus the `working`/`training` mode plumbing.
- `app/globals.css` (~1947 lines): all `.eb-*` styling and the 1440/680/390 breakpoints.

`[Fact]` `app/budget-domain.mjs` and `db/schema.ts` are pure logic. Per ADR 0002 (Coordinate Invariance) they are OUT of scope for any UI change: node geometry and financial totals stay pure, and the sync checksum must not change.

`[Fact]` The only local gate in this sandbox is `node --test tests/budget-domain.test.mjs` (20/20). That suite holds `assert.doesNotMatch` source guards over the workbench that forbid finance/dev jargon in visible copy and pin specific journey labels (`1. Workflow map`, `2. Overview`, `3. Notes`, `4. Reports &amp; export`), the graph-first default (`useState<JourneyStep>("graph")`), the "Show on map" lens, the plain-language sync states, and the mobile plan-card layout. The overhaul MUST keep all of these green. The real build, `inspect.mjs --app`, and Playwright screenshots run in CI (`.github/workflows/ci.yml`) and on the live Pages preview (`https://woussc.github.io/Ellies-Book/`).

`[Fact]` From `references/app-screens.md`, the measured house style of 23 real product screens: colour sits on data not chrome (median ~3% coloured pixels; 17/23 at =5%); KPIs are type, not tiles; surfaces are flat (17/23 no card shadow, separation by a 1px line or one tone step); no hero header (9/23 have no heading over 16px; median 24px where present); charts carry almost no chrome; navigation recedes (active item = neutral grey pill or a text-colour change); tables are rules and alignment (no zebra, no header bands, numbers right-aligned); data states are honest (zeros as zeros, missing as a grey dash).

`[Fact]` Banned for this app screen (from `SKILL.md` house rules + `app-screens.md`): gradients, glows, shadows on resting elements, icons in tinted squares/circles, rainbow charts, fake dashboards of grey bars, glass/backdrop-blur, decorative hairlines-as-ornament, tiny tracked uppercase labels, eyebrows, 01/02/03 numbering, emoji.

---

## 2. Decision (`[Proposed]`)

Adopt a single, quiet, light **app-screen** direction across every surface. The nearest library style (`references/app-screens.md` §2.3) is **`framed-sheet`**: one tinted L-frame with the working sheet on a white inset. `[Inference]` This matches what the workbench already is: the JSX root is `eb-framed-shell` with an `eb-sidebar` + an inset white `eb-workbench` sheet. So the direction is an evolution of the existing frame, not a rebuild, which de-risks parallel work and keeps the test guards satisfiable.

### Decision 1: Palette roles and proportions (answers "too harsh on the eyes")

`[Fact]` "Harsh" on a light screen comes from three measurable things: pure-white ground at maximum luminance, near-black text at maximum contrast, and saturated accents spread across the chrome. The fix is a low-contrast quiet ground, a softened ink, and a strict accent budget. Define these as CSS custom properties in `app/globals.css` `:root` (the single source of truth; a raw hex anywhere else is a second palette starting):

```css
:root {
  --eb-ground:  #f6f7f8;  /* tinted L-frame ground (sidebar + top bar). NOT pure white. */
  --eb-sheet:   #fdfdfc;  /* the working sheet: one soft step up from the ground, not #fff */
  --eb-surface: #f1f2f3;  /* panels/fields: 2-6 lightness points from the sheet, flat */
  --eb-ink:     #1f2328;  /* main text: a soft near-black, ~15:1 on the sheet, NOT #000 */
  --eb-muted:   #5c6269;  /* secondary text; still =4.5:1 on ground and sheet */
  --eb-line:    #e5e7ea;  /* the single 1px separator tone; never an ornament */
  --eb-accent:  #2f6d5b;  /* one accent (a calm deep green); marks the action + one data element */
  --eb-accent-ink: #ffffff;
}
```

- **Proportion rules** (checked in the CI screenshot, per `colour.md` §3): ground holds 70-90% of each surface; ink is text and at most one inverted region; **accent is under 5% of any screen** and marks only the primary action and the one data element it belongs to (today's/selected figure). The accent is NOT for headings, node pills, chart series fills, bullets, borders, or underlines.
- **Surfaces are told apart by tone, not lines or shadows** (`colour.md` §4): one step between `--eb-sheet`, `--eb-surface` and `--eb-ground`. Shadows only on things that truly float (a dialog, the mobile nav sheet). `[Fact]` This directly removes the "harsh" edges: no 1px outlined boxes as ornament, no drop shadows on resting panels.
- **Charts are ink + one hue**, never rainbow: plan/baseline in `--eb-muted`, the one figure that answers the screen's question in `--eb-accent`, status polarity (over/under) in a single red-vs-ink pair, never a palette of series colours.

`[Projection]` Exact hex values are a starting point the per-workstream coder tunes against the `inspect.mjs --app` colour-share and contrast meters in CI; the ROLES and PROPORTIONS above are the binding decision.

### Decision 2: Type scale (answers "hard to track / not digestible")

`[Fact]` Harsh, hard-to-track screens usually run many near-identical type sizes. Per `type.md` §2 the fix is few sizes, far apart, with readable body =16px. Define a decisive scale in `:root`:

```css
:root {
  --eb-step-small: 0.8125rem; /* 13px  captions, table sublabels, legal */
  --eb-step-body:  1rem;      /* 16px  body / table cells (floor; never below 16 for reading) */
  --eb-step-lead:  1.25rem;   /* 20px  the one finding line under the title */
  --eb-step-h1:    1.5rem;    /* 24px  the single sheet h1 (app-screen median) */
}
```

- **One `h1` per surface at 24px** (the `eb-heading`), sentence case, two lines at most. No second heading competes with it. This satisfies the existing guard that the sheet keeps a single dominant title.
- **Nothing sits between 16px and 20px, or between 20px and 24px.** Node titles, nav items, table cells and KPI labels all read at body size; weight and position carry hierarchy, not a sixth size.
- **Numbers are `font-variant-numeric: tabular-nums`**, right-aligned in columns, so figures line up digit-for-digit (the Overview plan table and KPI strip).
- `--eb-muted` carries secondary text at the same size; never a lighter-weight grey smaller than 13px.

### Decision 3: Navigation model (SHUAI's explicit restructure)

`[Fact]` SHUAI wants: **LEFT sidebar = switch the main spaces** (global nav between primary surfaces); **TOP bar = page-specific functions only**, used carefully.

- **Left sidebar (the one `eb-sidebar`)** becomes the global space switcher. The active item is a neutral grey pill (`--eb-surface`), label unchanged, per `app-screens.md` §3.2, NOT an accent fill. The spaces map 1:1 to the existing `JourneyStep` surfaces and MUST keep the guarded plain-language labels and ordering: **`1. Workflow map` -> `2. Overview` -> `3. Notes` -> `4. Reports &amp; export`**, with the "Setup" group below. The brand monogram + product name stay pinned at the top (`app-screens.md` names the product). Utility/dev actions sit at the bottom of the rail.
- **Top bar = contextual actions for the current surface only.** It holds the page title context and the small set of actions that belong to THIS surface (for the graph: the "Show on map" lens, zoom/fit, add-item; for Notes: new note, insert link; for Reports: the copy/export buttons). It must hold something real and recede otherwise (`app-screens.md` §3.3). No global navigation lives in the top bar.
- **Discipline**: one left edge from the sidebar through the sheet header to the first row; one gutter value; the active-space pill is the only "you are here" marker. Global nav never appears in two places at once.

### Decision 4: "Minimum information, maximum impact" as concrete rules

`[Fact]` Translated from the north star into checkable rules (`app-screens.md` §2.2, `critique.md`):

1. **One question per surface, answered by the biggest thing on it.** Graph = "where does this project's money flow and what is left?"; Overview = "how much of the approved budget is committed vs left?"; Notes = "what was decided and why?"; Reports = "export the audited tables". The largest figure on each surface answers that question.
2. **One dominant element per screen.** On the graph the canvas dominates; the inspector is secondary. On Overview the "left to spend" figure dominates; the table supports it. Do not let two blocks compete.
3. **Progressive disclosure.** Detail lives in the inspector/drawer and in expand/collapse, not all on screen at once. Reduce simultaneous info density: cap long lists at 4-6 rows with "View all"; keep accounting precision in tooltips/`title` attributes (already the pattern the guards enforce), plain language in primary copy.
4. **Honest states.** Zeros render as zeros, missing values as a grey dash, an empty surface keeps its frame with a single clear call to action (this is the lever for the "start a new project" and "blank landing" requirements below).
5. **Colour means something.** The accent appears where the decision is, never as decoration. Status colour says good/bad, not merely up/down.

### Decision 5: The four product requirements, folded into the system

`[Fact]` These are SHUAI's named requirements; each is realized through the system above and specified per-workstream in `.scratch/tickets/W10-ui-overhaul.md`.

- **New-project discoverability** (Project Workspace landing): a primary "Start a new project" action is the one dominant call on the workspace landing and on the blank/empty state. It is the screen's first job, placed where the answer shows (`app-screens.md` §2.2 "most frequent job one click away").
- **Notes read like a document, not raw markdown**: the Notes reading pane renders authored markdown into polished typographic prose (headings, paragraphs at `--eb-step-body`/1.6 leading, lists, emphasis, blockquotes), measure capped ~70ch, while keeping the `[[wikilink]]` and `#tag` pills that `extractWikilinks` already produces. We author in markdown and render it richly.
- **Setup redesigned** (replace the legacy look): the Setup surface becomes a calm, purposeful workspace where each department/team defines **tailored** spending definitions and patterns while all serve a **common business goal**. The common intent is stated once at the top as the dominant element; the per-team tailoring reads as quiet, flat panels beneath it, on the same tokens and type scale as the rest of the app.
- **Training mode removed; "Sample data / Developer" button added**: no hidden training toggle. The default is a clean blank landing. A single, clearly-labelled "Sample data / Developer" button on the LEFT toolbar loads the sample dataset onto the otherwise blank landing.

### Decision 6: House rules this app must follow

`[Fact]` From `SKILL.md` + `app-screens.md`, binding on every workstream and measured by `inspect.mjs --app` in CI:

- Quiet borders (one `--eb-line` tone), small labels, and repeated flat panels are FINE for an app screen.
- BANNED: gradients, glows, shadows on resting elements, icons in tinted squares/circles, rainbow charts, fake dashboards of grey bars, glass/backdrop-blur, decorative hairlines-as-ornament, tiny tracked uppercase labels, eyebrows, 01/02/03 numbering, emoji, more than ~4 corner radii, text under 11px.
- No nav item is an in-page scroll anchor; nav items are other surfaces.
- The product is named in the shell; the canvas carries the one signature element this product has (the Project -> WorkPackage -> Item -> Allocation -> Quote/PO/Invoice spending flow), which is already the graph.

---

## 3. Consequences

### Positive
- `[Inference]` A single token system in `app/globals.css` makes the other workstreams rebase cleanly and keeps the look coherent; the coder tunes values against the CI meters rather than guessing.
- `[Inference]` Because the direction evolves the existing `eb-framed-shell`, the strict source guards in `tests/budget-domain.test.mjs` stay satisfiable (labels, graph-first default, lens, sync copy, mobile cards are all preserved by intent).
- `[Inference]` Quieter ground + softened ink + a strict accent budget directly answer "harsh on the eyes"; few sizes far apart + 16px body answer "hard to track / not digestible".

### Costs / risks
- `[Fact]` Visual confirmation cannot happen in this sandbox (no build, no browser). It happens in CI (`inspect.mjs --app`, Playwright at 1440/768/390) and on the Pages preview after merge. Every workstream's acceptance includes a CI visual pass.
- `[Projection]` The canvas overhaul (WS-B) is the highest-risk slice: it must keep Coordinate Invariance (ADR 0002) while changing the coordinate/transform model. Hard guardrail: node geometry and financial totals stay pure; `app/budget-domain.mjs` and the sync checksum do not change.
- `[Fact]` Copy changes must keep the `assert.doesNotMatch` jargon guards green; accounting terms stay in `title`/tooltips only.

### Verification (every surface)
1. `node --test tests/budget-domain.test.mjs` stays 20/20 (local gate).
2. CI: `pnpm run lint` + `pnpm run build` + `tests/rendered-html.test.mjs` green; `inspect.mjs --app` reports 0 FAIL at 1440/768/390 (colour share, no gradients/glows/shadows, contrast, tabular numerics, one h1).
3. Visual review on the live Pages preview `https://woussc.github.io/Ellies-Book/` after merge.
