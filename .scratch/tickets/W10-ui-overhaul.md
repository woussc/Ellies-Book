# Wave 10: UI Overhaul via taste-skill (parallel-safe workstreams)

- **Wave**: Wave 10 (proposed / not yet started)
- **Status**: `proposed`
- **Blocked By**: WS-A is the foundation. WS-B, WS-C, WS-D all rebase on WS-A and start only after it merges.
- **Governing ADRs**: **ADR 0006 (UI overhaul design direction)**, ADR 0002 (graph-first + adaptive surfaces + Coordinate Invariance), ADR 0001 (hybrid + dual-graph), ADR 0003 (Kiro-native team + gate), ADR 0005 (Pages preview).
- **Design method**: `.agent/skills/design-taste-frontend/` `--app` run. App-screen rules only (`references/app-screens.md`, `critique.md`, `colour.md`, `type.md`, `layout.md`, `tells.md`).
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (currently **20/20** on `main` at `321a72e`). lint/build/rendered-html/`inspect.mjs --app`/Playwright are **CI-only** in this sandbox (ADR 0003); visual confirmation is on the Pages preview `https://woussc.github.io/Ellies-Book/` after merge.

> `[Context]` SHUAI wants a complete visual overhaul: calmer, more legible, "minimum information, maximum impact". Four product requirements ride along: discoverable new-project, document-grade Notes, a redesigned Setup, training-mode removal + a left-toolbar "Sample data / Developer" button, and an Obsidian-like infinite canvas with correct edges and fit-to-selected-node. See ADR 0006 for the binding palette/type/nav/house-rules decision.

> `[Hard guardrail, all tickets]` Do NOT touch `app/budget-domain.mjs`, `db/schema.ts`, `app/api/sync/route.ts`, `worker/index.ts`, `vite.config.ts`, `vite.config.pages.ts`, `.github/workflows/ci.yml`, or `.github/workflows/pages.yml`. Keep every `assert.doesNotMatch` jargon guard and every pinned label/state string in `tests/budget-domain.test.mjs` green. Accounting terms stay in `title`/tooltip attributes only.

---

## Parallelization map (which files each workstream owns)

| WS | Objective | PRIMARY files it edits | Shared regions to coordinate |
| :-- | :-- | :-- | :-- |
| **WS-A** (FOUNDATION) | Design tokens + nav-shell restructure (left=spaces, top=page actions) + remove training mode + add "Sample data / Developer" button + clean blank default | `app/globals.css` (`:root` tokens, `.eb-framed-shell`, `.eb-sidebar`, shell/top-bar), `app/ellies-book-workbench.tsx` (shell/header/sidebar region ~lines 2138-2340, sidebar footer), `app/page.tsx` (remove `Mode`/`training` plumbing, mount workbench with a sample-data loader) | Defines the tokens + shell every other WS consumes. Must land and merge FIRST. |
| **WS-B** | Obsidian-like canvas: true large/infinite pan+zoom, edges correct at any offset, fit-to-selected-node | `app/ellies-book-workbench.tsx` canvas subsystem (graph state ~881-905, `handleNodePointerDown`/`handleCanvasPointerMove`/`jumpToNode` ~1395-1458, the graph render block ~2980-3320, the edges `<svg>` ~3193-3242), `app/globals.css` canvas classes (`.eb-canvas-viewport`, `.eb-canvas-stage`, `.eb-edges-svg`, `.eb-graph-node`, `.eb-edge-*`, `.eb-canvas-controls`) | Edits the `journeyStep === "graph"` block only. |
| **WS-C** | Notes reading experience: markdown -> polished document rendering | `app/ellies-book-workbench.tsx` notes/vault block (`renderNotePreviewWithWikilinks` ~1928-2001, the `eb-vault-*`/`eb-markdown-preview` render ~3476-3760) + a NEW in-repo renderer module, `app/globals.css` notes classes (`.eb-vault-*`, `.eb-markdown-preview`, `.eb-md-*`, `.eb-wikilink-pill`, `.eb-tag-pill`) | Edits the `journeyStep === "vault"` block only. |
| **WS-D** | Setup redesign: per-team tailored spending definitions serving a common business intent | `app/page.tsx` legacy studio components (`Header`, `LibraryScreen`, `MetadataBoard`, `ProfileScreen`, `Workspace`, `PlanView`/`SpendView`/`MonitorView` and their classic-slot markup), `app/globals.css` legacy classes (`.topbar`, `.studio-*`, `.library-*`, `.definition-*`, `.tag-*`, `.screen-card`, `.eb-classic-*`) | Edits the classic studio slot only. |

`[Inference]` **No two of B/C/D edit the same JSX surface or the same CSS class family.** B owns the graph block + `.eb-canvas*`/`.eb-edge*` classes; C owns the vault block + `.eb-md*`/`.eb-vault*` classes; D owns `app/page.tsx`'s classic components + the `.studio-*`/`.library-*` legacy classes. They all SHARE one file region: `app/globals.css` `:root` tokens and `app/ellies-book-workbench.tsx` imports/top-level state. That shared region is OWNED and FROZEN by WS-A: B/C/D only READ the tokens, they do not edit `:root`. See "Serialization" below.

**Sequence**: WS-A first (merge to `main`). Then **WS-B, WS-C, WS-D run in parallel** off the post-WS-A `main`, each on its own feature branch, each its own PR.

---

## WS-A - Foundation: tokens + nav shell + training removal + Sample/Developer button `[proposed]` `[BLOCKING]`

- **Objective**: Establish the ADR 0006 visual system and the nav model so B/C/D rebase on it.
- **Steps**:
  1. In `app/globals.css` `:root`, add the ADR 0006 palette tokens (`--eb-ground`, `--eb-sheet`, `--eb-surface`, `--eb-ink`, `--eb-muted`, `--eb-line`, `--eb-accent`, `--eb-accent-ink`) and type tokens (`--eb-step-small/body/lead/h1`). Re-point the existing `.eb-*` chrome to these tokens: quiet tinted ground on `.eb-framed-shell`/`.eb-sidebar`, soft sheet on `.eb-workbench`, flat `--eb-surface` panels, remove resting-element shadows and ornamental 1px boxes, body =16px, `tabular-nums` on figures.
  2. Left sidebar = global space switcher: active item is a neutral `--eb-surface` grey pill (not accent). Keep the guarded labels and order exactly: `1. Workflow map`, `2. Overview`, `3. Notes`, `4. Reports &amp; export`, then the `Setup` group. Keep the brand monogram/name pinned top.
  3. Top bar = page-specific actions only: move global navigation OUT of any top bar; the sheet header (`.eb-header`) holds the surface title context + the contextual action cluster for the current surface. No global space-switching in the top bar.
  4. New-project discoverability: make "Start a new project" the one dominant primary action on the workspace landing and on the blank/empty state.
  5. Remove training mode end-to-end in `app/page.tsx`: delete the `Mode`/`training` toggle in `Header`, the `TrainingScreen`, `Workspace isTraining`, the `trainingData`/`setTrainingData` state, `TRAINING_KEY`/`LEGACY_TRAINING_KEY`, and the `mode === "training"` branches. Mount `ElliesBookWorkbench` with the working data only. Default to a clean BLANK landing (`blankData()`), no sample data lurking.
  6. Add a single left-toolbar **"Sample data / Developer"** button that loads `sampleData()` onto the blank landing on click. Update the sidebar footer so it no longer prints `· {mode} mode` (that prop is gone).
- **Taste-skill rules it must satisfy**: `colour.md` proportion (accent <5%, surfaces by tone not shadow), `type.md` few-sizes/16px body, `app-screens.md` §3 shell (grey active pill, product named, nav recedes), house rules (no gradients/glows/shadows/eyebrows).
- **Touches these files**: `app/globals.css` (`:root`, shell/sidebar/top-bar/header classes), `app/ellies-book-workbench.tsx` (shell+header+sidebar region ~2138-2340, footer, the `mode` prop + its type), `app/page.tsx` (training removal + sample-data loader + mount).
- **Acceptance criteria**:
  - `node --test tests/budget-domain.test.mjs` = 20/20 (labels, graph-first default, lens, sync states, mobile cards all still present).
  - No `Mode`/`training`/`TRAINING_KEY`/`TrainingScreen` references remain in `app/page.tsx`.
  - A "Sample data / Developer" button exists on the left toolbar and loads `sampleData()`; first paint with no sample loaded is a blank landing.
  - CI: lint + build + rendered-html green; `inspect.mjs --app` 0 FAIL (grey active pill, no banned ornaments, one h1, body =16px).
- **Verification**: domain gate locally; CI `inspect.mjs --app` + Playwright 1440/768/390; visual on the Pages preview after merge.

---

## WS-B - Obsidian-like canvas (infinite pan/zoom, correct edges, fit-to-selected) `[proposed]`

- **Objective**: Replace the bounded canvas with a true large/infinite, correctly-rendering, interactive graph like Obsidian's graph view, and add fit-to-selected-node.
- `[Fact]` **Root cause of the current bug**: the edges `<svg className="eb-edges-svg" viewBox="0 0 1220 520" preserveAspectRatio="none">` (~line 3195) has a FIXED 1220x520 coordinate box, while nodes are absolutely positioned inside `.eb-canvas-stage` which gets `transform: translate(pan) scale(zoom)`. Any node dragged beyond 1220x520 has its edge mis-projected, so "beyond a certain drag the links/flows stop rendering". Zoom is also clamped to 0.75-1.25 (not real zoom), and only nodes are draggable (no empty-canvas pan).
- **Steps**:
  1. Make the edge SVG share ONE coordinate space with the nodes: either render the SVG inside `.eb-canvas-stage` with a dynamic `viewBox`/size computed from the node bounding box (so it grows with the content), or move pan/zoom onto a single SVG `<g transform>` that carries BOTH nodes (as `foreignObject`/SVG) and edges. Remove the fixed `0 0 1220 520` box and `preserveAspectRatio="none"`.
  2. Implement empty-canvas pan (pointer-drag on the viewport background updates `pan`) and true wheel/pinch zoom with a wider range (e.g. 0.2-3), zooming toward the cursor. Keep pan/zoom as pure VIEW state.
  3. Recompute edge `pathD` from the same transformed coordinates the nodes use, so edges stay attached at ANY pan/zoom/offset, including nodes far outside the old bounds.
  4. Add a **Fit to selected node** action (in the graph's page-specific top-bar cluster from WS-A): compute the bounding box of the selected node + its incoming/outgoing neighbours (`selectedNodeEdges` already exists) and set `pan`/`zoom` to frame them with padding. Also offer fit-to-all.
  5. Keep the List fallback (`outlineFallback`) and the "Show on map" lens exactly as guarded.
- **HARD guardrail (ADR 0002 Coordinate Invariance)**: pan/zoom/drag/fit change ONLY view state (`pan`, `zoom`, `nodeViewState`). Node geometry, financial totals, lineage, canonical tables and the sync checksum MUST stay identical. Do NOT touch `app/budget-domain.mjs`. The domain test proves coordinates never change totals; keep it green.
- **Taste-skill rules**: `app-screens.md` canvas/builder guidance (quiet, the product's own signature flow element), no decorative grid lines as ornament (lane guides are functional labels, keep them subtle), colour only on the selected/active element.
- **Touches these files**: `app/ellies-book-workbench.tsx` (graph state ~881-905, pointer/jump handlers ~1395-1458, graph render + edges SVG ~2980-3320), `app/globals.css` (`.eb-canvas-viewport`, `.eb-canvas-stage`, `.eb-edges-svg`, `.eb-graph-node`, `.eb-edge-*`, `.eb-canvas-controls`, `.eb-lane-guides`).
- **Acceptance criteria**:
  - Dragging a node far past the old 1220x520 bounds keeps all its edges attached and visible.
  - Empty-canvas pan works; zoom range is wide and zooms toward the cursor; "Fit to selected node" frames the node + neighbours.
  - `node --test tests/budget-domain.test.mjs` = 20/20 (Coordinate Invariance + lens guards intact).
  - CI: lint/build/rendered-html green; `inspect.mjs --app` 0 FAIL; Playwright screenshots show attached edges at an offset.
- **Verification**: domain gate; CI visual; manual pan/zoom/drag/fit check on the Pages preview.

---

## WS-C - Notes reading experience (markdown -> polished document) `[proposed]`

- **Objective**: Render authored markdown as a polished, document-grade reading experience, not a plain/raw markdown dump, while keeping the `[[wikilink]]`/`#tag` interactivity.
- `[Fact]` **Current state**: `renderNotePreviewWithWikilinks` (~1928) strips frontmatter and splits on newlines, wrapping every line in `<p className="eb-md-line">` with wikilink/tag pills. It does NOT handle headings, lists, emphasis, blockquotes, inline code, or paragraph grouping, so it reads as flat text. The wikilink/tag/frontmatter PARSING lives in the pure engine (`extractWikilinks` in `app/budget-domain.mjs`) and must NOT move or change.
- `[Fact]` **Dependency finding**: `package.json` dependencies are only `react`, `react-dom`, `drizzle-orm`. There is NO markdown library.
- **Recommendation (dependency decision)**: `[Inference]` **Build a small, dependency-free markdown-to-rich-text renderer in-repo** (a new module imported by the workbench, e.g. `app/markdown-render.tsx` or `app/markdown-render.ts`), NOT a new npm dependency. Reasons:
  1. The sandbox CANNOT install packages (HTTP 403, no `node_modules`), so a dep cannot be validated here; a dep would only be provable in CI, slowing the parallel wave.
  2. The app already ships a bespoke inline tokenizer for `[[wikilinks]]`/`#tags`; the renderer needs to compose block-level markdown (headings, paragraphs, lists, blockquote, hr, inline `code`, bold/italic) around that SAME inline pass, which a tiny in-repo function does cleanly.
  3. It keeps the domain engine pure (parsing stays in `extractWikilinks`) and avoids lockfile churn and supply-chain surface for a client-only reading pane.
  4. `[Projection]` If SHUAI later wants full CommonMark/GFM (tables, task lists, nested blockquotes), a lightweight dep (e.g. a small MD parser) is acceptable ONLY added to `package.json` with the lockfile refreshed in a network-capable env / CI; recommend deferring that to a follow-up and shipping the in-repo renderer now.
- **Steps**:
  1. Add the in-repo renderer module: parse markdown blocks (ATX headings `#..######`, paragraphs, `-`/`*`/`1.` lists, `>` blockquotes, `---` hr, fenced/inline code) and reuse the existing inline tokenizer for `[[wikilink]]` (-> `jumpToNode`) and `#tag` (-> `setActiveTagFilter`) pills. Output semantic elements (`<h1>..<h3>`, `<p>`, `<ul>/<ol>/<li>`, `<blockquote>`, `<code>`), NOT a wall of `<p className="eb-md-line">`.
  2. Replace the body of `renderNotePreviewWithWikilinks` (and the `eb-markdown-preview` render) to use the new renderer. Keep the frontmatter bar.
  3. Style the reading pane per ADR 0006 type scale: body 16px / leading 1.6, measure capped ~70ch, decisive heading sizes within the 16/20/24 scale, quiet blockquote (tone step, no ornament), inline code on `--eb-surface`. The editor's raw markdown textarea stays as-is for authoring.
- **Taste-skill rules**: `type.md` (few sizes, readable measure, body =16px, real paragraphs not statement-size walls), `colour.md` (ink + muted, accent only on interactive pills), no decorative hairlines.
- **Touches these files**: `app/ellies-book-workbench.tsx` (`renderNotePreviewWithWikilinks` + vault render ~3476-3760), NEW `app/markdown-render.*`, `app/globals.css` (`.eb-markdown-preview`, `.eb-md-*`, `.eb-vault-*`, `.eb-wikilink-pill`, `.eb-tag-pill`).
- **Acceptance criteria**:
  - A note with headings, lists, bold/italic, blockquote and `[[links]]`/`#tags` renders as a formatted document with working pills, not line-per-`<p>` plain text.
  - No new runtime dependency in `package.json`; `extractWikilinks` in the pure engine is unchanged.
  - `node --test tests/budget-domain.test.mjs` = 20/20.
  - CI: lint/build/rendered-html green; `inspect.mjs --app` 0 FAIL on the notes surface.
- **Verification**: domain gate; CI visual; read a sample note on the Pages preview.

---

## WS-D - Setup redesign (tailored per-team definitions, common intent) `[proposed]`

- **Objective**: Replace the legacy "Function Budget Studio" look with a calm, purposeful, modern Setup where each department/team defines TAILORED spending definitions and patterns while all serve a COMMON business goal/intent.
- `[Fact]` **Current state**: `app/page.tsx` renders the legacy studio (`Header` topbar, `LibraryScreen`/`MetadataBoard` with `eyebrow` labels, `ProfileScreen`, `Workspace` with `PlanView`/`SpendView`/`MonitorView`) via the `classicStudioSlot` passed to the workbench. It uses the old `.topbar`/`.studio-*`/`.library-*`/`.definition-*` CSS and eyebrow/step-stamp ornaments the house rules ban.
- **Steps**:
  1. Restate the COMMON business intent once as the dominant element at the top of the Setup surface (the shared goal all teams serve), per "one question / one dominant element".
  2. Rework the library/definition editors into quiet, flat `--eb-surface` panels on the ADR 0006 tokens and type scale. Group the per-team/department TAILORED definitions as repeated flat panels under the common intent, so tailoring reads as purposeful variation, not a form dump.
  3. Remove banned ornaments (`eyebrow` tracked caps, `step-stamp`, decorative hairlines, any gradients/shadows); replace with heading + space + tone steps. Keep real form fields (inputs/selects) which are allowed to have borders.
  4. Keep all existing data flow and validation behaviour; this is a visual/structural redesign of the classic slot, not a logic change.
- **Taste-skill rules**: `app-screens.md` §8 forms/settings (flat fields, filled surfaces, clear focus in accent), no eyebrows / no tracked caps, `type.md` scale, `colour.md` proportion.
- **Touches these files**: `app/page.tsx` (classic studio components + the `classicStudioSlot` markup), `app/globals.css` (`.topbar`, `.studio-*`, `.library-*`, `.definition-*`, `.tag-*`, `.screen-card`, `.eb-classic-*`).
- **Acceptance criteria**:
  - The Setup surface states a single common business intent as its dominant element, with per-team tailored definitions as quiet flat panels beneath.
  - No eyebrow/step-stamp/tracked-caps ornaments remain in the Setup markup/CSS.
  - `node --test tests/budget-domain.test.mjs` = 20/20 (no jargon-guard regressions).
  - CI: lint/build/rendered-html green; `inspect.mjs --app` 0 FAIL on the Setup surface.
- **Verification**: domain gate; CI visual; open Setup on the Pages preview.

---

## Serialization note (the one shared region)

`[Inference]` The ONLY file region B/C/D share is:
- `app/globals.css` `:root` token block -> **owned and frozen by WS-A**. B/C/D consume the tokens read-only. If a workstream needs a new token, it asks WS-A to add it (or the orchestrator adds it to WS-A before fan-out); workstreams do not edit `:root` themselves.
- `app/ellies-book-workbench.tsx` top-of-file imports + top-level component state -> WS-A settles the `mode`-prop removal and any new shared state FIRST. After WS-A merges, B edits only the graph block, C edits only the vault block; they do not overlap in JSX or handlers.

`[Inference]` With `:root` and the shell frozen by WS-A, **WS-B, WS-C, WS-D touch disjoint JSX blocks and disjoint CSS class families**, so they merge without collision. The only merge point is ordinary: each rebases on the post-WS-A `main`. No finer serialization is required.

---

## Sequencing summary

1. **WS-A** (blocking foundation) -> merge to `main`.
2. **WS-B + WS-C + WS-D** in parallel off post-WS-A `main`, one feature branch + PR each.
3. Each slice keeps the domain gate at 20/20, passes CI (`lint` + `build` + `rendered-html` + `inspect.mjs --app` + Playwright), and is visually confirmed on the Pages preview after merge.
