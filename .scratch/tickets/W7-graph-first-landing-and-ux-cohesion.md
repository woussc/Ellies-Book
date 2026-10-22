# Wave 7: Graph-First Landing & End-to-End UX Cohesion (390px -> 1440px)

- **Wave**: Wave 7 (User Flow & Experience - solidify the two locked decisions as first-class)
- **Status**: `completed` (all five tickets done, dual-gate APPROVED, committed + pushed on `feat/w7-graph-first-landing`; gate 19/19)
- **Blocked By**: none (builds on Waves 1-6, all committed)
- **Governing ADRs**: ADR 0001 (hybrid + dual-mode), ADR 0002 (graph-first + adaptive surfaces), ADR 0003 (Kiro-native team + gate)
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green. lint/build are best-effort only in this sandbox (see ADR 0003).

---

## 1. Objective

Make the two locked decisions first-class in the live user flow, and close the three known UX follow-ups from the Wave 5/6 handoff, as a sequence of atomic, test-green vertical slices. The product goal (README): the visual node canvas + Obsidian knowledge graph is the HERO interface; tables/charts are 100% auditable lenses on the same projection; mobile (390px) is capture / insight / 1-tap approvals.

`[Fact]` Current gap: ADR 0002 requires the Visual Canvas Map to be the DEFAULT landing surface, but `app/ellies-book-workbench.tsx` defaults `journeyStep` to `"overview"` and labels the graph as step "2. Workflow map". Decision 2 (dual-mode graph as hero) is therefore not yet realized in the landing flow.

---

## 2. Tickets (atomic vertical slices, in order)

### W7-T1 - Graph-first is the confirmed default landing surface `[completed]`
- **Outcome** `[Fact]`: Default landing `journeyStep` is now the graph/canvas surface (commit `c44de9d`); realizes locked Decision 2 ("hero interface"). Deterministic guard added to `tests/budget-domain.test.mjs`; gate 14→15. Coordinate Invariance held.
- **Goal**: Entering a project lands on the Visual Canvas Map (the dual-mode graph), per ADR 0002, instead of the Overview table.
- **Scope** (`app/ellies-book-workbench.tsx`):
  - Change the initial `journeyStep` state so the graph surface is the default landing view when a project opens.
  - Reorder / relabel the left-nav "Project journey" so the workflow map reads as the primary/first step and Overview follows, keeping the plain-language labels (no finance/dev jargon). Keep `3. Notes` and `4. Reports & export` reachable.
  - Preserve all existing behavior of the overview, notes, tables, and classic surfaces; this is a default + ordering change, not a rewrite.
  - Keep node coordinates as pure view state (ADR 0002 Coordinate Invariance): changing the landing surface must not touch any financial total or table row.
- **Domain / test**: Add a deterministic guard in `tests/budget-domain.test.mjs` that reads `app/ellies-book-workbench.tsx` source and asserts the graph/canvas surface is the default landing state (e.g. the initial `journeyStep` is the graph surface), so a future regression back to overview-first fails the gate. Keep all existing `doesNotMatch` plain-language guards green.
- **Acceptance**:
  - `node --test tests/budget-domain.test.mjs` passes (now 15+ tests) including the new landing-surface guard.
  - Source inspection confirms the graph surface is the initial `journeyStep`.
  - No change to any numeric domain assertion (totals, allocations, lineage).
- **Verification**: `node --test tests/budget-domain.test.mjs`.

### W7-T2 - Dual-mode toggle clarity (Mode A structured DAG <-> Mode B knowledge overlay) `[completed]`
- **Outcome** `[Fact]`: Plain-language dual-mode canvas toggle shipped (commit `ceef89f`): "Show on map" → "Spending flow" / "Spending flow + notes", pure view-state `showNoteLinks`. No forbidden "Mode A ·"/"Mode B ·"/"Financial Lineage DAG" literals. Gate 15→16.
- **Goal**: Make the dual-mode toggle an obvious, labeled, plain-language control on the canvas across 390px -> 1440px, so Decision 2 is visibly first-class.
- **Scope** (`app/ellies-book-workbench.tsx`, `app/globals.css`): ensure the structured financial DAG vs. Obsidian `[[wikilink]]` overlay toggle is discoverable with plain labels (no "Mode A ·"/"Mode B ·"/"Financial Lineage DAG" literals - the source guard forbids them), has clear active state, and remains reachable on mobile.
- **Domain / test**: extend plain-language source guards if new copy is introduced.
- **Verification**: `node --test tests/budget-domain.test.mjs`.

### W7-T3 - Plan table 1440px overflow (known follow-up a) `[completed]`
- **Outcome** `[Fact]`: New `.eb-plan-table` CSS (commit `4fa8068`): `table-layout:fixed` + 6-col width budget + cell wrap, overriding the global `white-space:nowrap`; the plan table now fits 1440px. Gate held at 19 (combined T3/T5 slice).
- **Noted follow-up** `[Decision for SHUAI]`: there is NO true 390px stacked-card layout. `data-label` attributes exist on cells but there is no `content: attr(data-label)` card-mode CSS, so on mobile the table falls back to horizontal scroll. A mobile card layout is a separate future ticket → W8-candidate-A (`.scratch/tickets/W8-post-wave7-followups.md`), pending SHUAI's decision on PR #1.
- **Goal**: Overview "The plan" table shows zero horizontal clipping at 1440px (the Wave 6 6-column consolidation reportedly fixed most of this; confirm and finish any residual Status/Map clipping, add responsive scroll container if still needed).
- **Scope**: `app/ellies-book-workbench.tsx` overview table + `app/globals.css`.
- **Verification**: `node --test tests/budget-domain.test.mjs`; visual at 1440px must be re-checked in a build-capable env (best-effort here).

### W7-T4 - KPI / chart plain-language sweep (known follow-up b) `[completed]`
- **Outcome** `[Fact]`: Removed residual "open PO" jargon → "Ordered, not yet paid" across chart heading / legend / inspector label / aria-label (commit `f1c987d`); accounting term kept only in `title` tooltips for auditors. Also gated the inspector "Knowledge backlinks" row on `showNoteLinks` for lens consistency with the map. New `doesNotMatch`/consistency guards added; gate 16→18 (+2).
- **Goal**: Remove residual finance jargon from visible copy. `[Fact]` "open PO" still appears in chart copy (`app/ellies-book-workbench.tsx` ~line 3680: "actuals & open PO" / "Open PO" legend). Replace with the already-established plain phrasing ("Paid & ordered" / "Ordered, not yet paid"), keeping the accounting term only in `title`/tooltip for auditors.
- **Scope**: `app/ellies-book-workbench.tsx` chart heads + legends.
- **Domain / test**: add the jargon string(s) to the `doesNotMatch` plain-language guard in `tests/budget-domain.test.mjs` so leaks regress-fail.
- **Verification**: `node --test tests/budget-domain.test.mjs`.

### W7-T5 - Mobile quick-capture length + hybrid-sync coherence (known follow-up c + Decision 1 surface) `[completed]`
- **Outcome** `[Fact]`: Confirmed the Wave 6 bottom sheet keeps mobile capture short; added a persistent plain-language hybrid local/cloud sync affordance (commit `4fa8068`): pure view-state `syncState: local|cloud|working` → "Saved on this device" / "Backing up to the cloud…" / "Saved here and backed up to the cloud", with fail-safe failure copy and "Checksum"→"Reference". The `/api/sync` contract and domain functions were NOT touched — realizes Decision 1 legibility. New plain-language guard added; gate →19.
- **Noted follow-up** `[Note]`: the pre-existing guard `assert.match(src, /Hybrid Sync Snapshot/)` is now satisfied only by a code comment (phrase no longer user-visible). Re-anchor to a visible string or the `/api/sync` call → W8-candidate-B.
- **Goal**: Confirm the Wave 6 progressive-disclosure bottom sheet keeps the primary capture forms short on 390px, and that the hybrid local-first + cloud D1 sync surface (Decision 1) reads coherently end-to-end (clear "saved locally" vs "synced to cloud" affordance) across 390px -> 1440px.
- **Scope**: `app/ellies-book-workbench.tsx` quick-capture + sync surfaces, `app/globals.css`.
- **Verification**: `node --test tests/budget-domain.test.mjs`; mobile visual re-check in a build-capable env.

---

## 3. Sequencing rationale

`[Inference]` W7-T1 is first because graph-first default is the single most direct realization of the locked Decision 2 and the README "hero interface" goal, and it is a low-risk default/ordering change with a clean deterministic guard. W7-T2 builds on the now-primary canvas. T3/T4/T5 close the three named UX follow-ups. Each ticket is independently committable and leaves the domain gate green.
