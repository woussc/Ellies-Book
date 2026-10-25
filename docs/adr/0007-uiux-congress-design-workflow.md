# ADR 0007: UI/UX Congress Design Workflow (blend of three vendored skills)

- **Status**: Proposed
- **Date**: 2026-10-25
- **Decider**: **SHUAI** (`Chen Shuaizhou`)
- **Scope**: The UI/UX design **workflow** agents follow. This ADR blends three vendored skills into one
  routed process. It is NOT a change to the shipped visual system.
- **Governing method**: `.agent/skills/uiux-congress/SKILL.md` is the single entry point; it routes to the
  three member skills below.
- **Related ADRs**: ADR 0002 (graph-first + adaptive surfaces, Coordinate Invariance), ADR 0003
  (Kiro-native team + verification gate), **ADR 0006 (UI overhaul — the binding visual system)**.

---

## 1. Context

`[Fact]` SHUAI asked to install two external GitHub skills and blend them with the already-vendored
taste-skill into a single "congress of UI/UX design workflow": one routed process every agent follows for
UI work, where each skill has a clear, non-overlapping role.

`[Fact]` The three skills are vendored self-contained under `.agent/skills/`:
- `.agent/skills/design-taste-frontend/` — `Leonxlnx/taste-skill` v2 (already present). It deals an art
  direction from a studied library, enforces an app-screen house style, and ships the only
  CI-runnable meter `scripts/inspect.mjs --app`.
- `.agent/skills/ui-ux-pro-max/` — `nextlevelbuilder/ui-ux-pro-max-skill` (MIT, v2.15.0). A searchable
  design-intelligence catalog (styles, 192 palettes, 74 font pairings, 119 UX guidelines, chart types, 22
  stacks) plus a design-system token architecture (primitive/semantic/component).
- `.agent/skills/impeccable/` — `pbakaus/impeccable` (Apache 2.0, v4.7.1). A craft/process skill: a verb
  library (`craft`, `critique`, `polish`, `harden`, `layout`, `typeset`, `clarify`, …), four surface
  **modes** (Persuade / Operate / Read / Experience), and a `craft-floor.md` quality floor.

`[Fact]` Environment truth: the general web, npm, and `git clone` are blocked in the sandbox. The two new
skills were fetched through the `gh` gateway and vendored as REFERENCE. Their scripts (`search.py`, the
impeccable launcher, live-browser) CANNOT run here. The only runnable gate in-sandbox is
`node --test tests/budget-domain.test.mjs` (**21/21**). The real, runnable design verification stays in CI
(`inspect.mjs --app` at 1440/768/390 + Playwright) and on the live Pages preview
`https://woussc.github.io/Ellies-Book/`.

`[Fact]` Ellie's Book is an **app screen** (a workbench people work in), not a marketing page. ADR 0006
already decided its visual system: a quiet, light, framed-sheet app-screen look with `--eb-*` tokens in
`app/globals.css`, accent under 5% of any screen, few type sizes far apart, 16px body.

`[Fact]` Risk the blend must manage: the three skills carry different colour/token defaults — taste-skill's
quiet app-screen palette, ui-ux-pro-max's 192 palettes, and impeccable's darker craft defaults (its repo's
own "kinpaku" world, which is NOT vendored). Without a precedence rule, a future agent could read a member
skill and re-skin the app away from ADR 0006.

---

## 2. Decision (`[Proposed]`)

Adopt a single **congress**: a routed UI/UX workflow with three distinct roles and one gate. The congress
blends the **process** and taps the **library**; it does not override the shipped look.

### Decision 1: The three roles (no overlap)

`[Inference]` Each skill is assigned the one thing it is best at, so they compose instead of competing.

| Skill | Role in the congress | Owns |
| :--- | :--- | :--- |
| **taste-skill** (`design-taste-frontend/`) | **Art Direction + the anti-slop VERIFICATION GATE.** Deals the direction, holds the app-screen house rules, and runs the meter. | The single PASS/FAIL authority: `scripts/inspect.mjs --app` (colour-share, no gradients/glows/shadows, contrast, tabular numerics, one h1) + the critique rubric. |
| **ui-ux-pro-max** (`ui-ux-pro-max/`) | **Design-Intelligence LIBRARY.** An evidence base that GROUNDS choices (which UX guideline, which chart type, which app-interface pattern, which token structure) — read, not run. | The catalog `data/*.csv` + `references/{pro-rules,quick-reference}.md` + `design-system/` token architecture. |
| **impeccable** (`impeccable/`) | **Craft & Polish LOOP.** The build-time discipline: pick the mode, run the verbs, hold the craft-floor. | The verb library (`layout`, `typeset`, `clarify`, `harden`, `polish`, `distill`, …), the mode choice, and `reference/craft-floor.md`. |

`[Fact]` For Ellie's Book the impeccable **mode is Operate** (a workbench where the visitor completes a
task). Persuade/Read/Experience guidance is secondary and reserved for any future marketing or docs surface.

### Decision 2: The single routed pipeline

`[Inference]` Every UI task flows through five steps. The hand-off between steps is explicit, and each
step names which skill leads.

1. **Frame + inventory** — *taste-skill brief + impeccable mode.* State the one question the surface
   answers (per ADR 0006 §Decision 4) and set the impeccable mode to **Operate**. Output: a one-line brief
   and the dominant element for the surface.
2. **Ground the direction** — *ui-ux-pro-max (read-only).* Consult `data/ux-guidelines.csv`,
   `data/app-interface.csv`, the relevant `data/stacks/<stack>.csv` (this project is React/Next), and the
   `design-system/` token methodology to make evidence-backed choices. Hand-off constraint: every choice
   lands **inside ADR 0006's `--eb-*` token system and house rules**; the library informs, it does not
   re-palette.
3. **Build + craft** — *impeccable verbs.* Implement with `layout` / `typeset` / `clarify` / `onboard`,
   reading `reference/craft-floor.md` immediately before any UI edit. Hand-off constraint: the craft-floor
   must not reintroduce anything ADR 0006 bans (gradients, glows, resting shadows, rainbow charts, tinted
   icon squares, etc.).
4. **Verify** — *taste-skill gate (PASS/FAIL owner) + impeccable self-check.* Run `inspect.mjs --app` at
   1440/768/390 and the critique rubric; run impeccable `audit`/`critique` and the craft-floor self-check
   as a secondary read. The taste-skill gate is authoritative: if it FAILs, the surface is not done.
5. **Iterate** — the look-and-fix loop: fix what one look shows, then look again, until the gate is clean.

`[Fact]` In this sandbox steps 2-4's scripts cannot run; agents read the vendored docs/CSVs directly and the
step-4 gate runs in CI. The pipeline is the same; only the execution venue differs.

### Decision 3: Conflict precedence (this protects the shipped look)

`[Fact]` **ADR 0006 is the binding visual system for Ellie's Book.** Its quiet, light, framed-sheet
app-screen direction — the `--eb-*` tokens, accent under 5%, few type sizes far apart, 16px body, and the
banned-ornament list — remains in force.

`[Fact]` The congress is a **workflow and a library, not a visual mandate.** Where any member skill's
default conflicts with ADR 0006, **ADR 0006 wins**:
- ui-ux-pro-max's 192 palettes are a reference for *reasoning about* colour roles; they do NOT replace the
  `--eb-*` palette.
- impeccable's own design world (its repo "kinpaku" gold/verdigris-on-dark) is NOT vendored and is NOT the
  look of this app; impeccable contributes its **process**, not its palette.
- taste-skill's `--app` house rules already align with ADR 0006 and remain the enforced floor.

`[Fact]` **No future agent re-themes Ellie's Book** (for example to a dark gold-on-black look) on the
strength of a member skill. A re-skin requires an explicit new decision from SHUAI and a superseding ADR.

### Decision 4: App-screen reality is primary

`[Fact]` Because Ellie's Book is a workbench: taste-skill `--app` rules, ui-ux-pro-max's app/dashboard
guidance (`data/app-interface.csv`), and impeccable's **Operate** mode + `audit.native`-style checks apply.
Landing-page / Persuade-mode guidance from any skill is secondary and only for a future public surface.

---

## 3. Consequences

### Positive
- `[Inference]` Three non-overlapping roles + one gate give agents a deliberate, repeatable UI process that
  draws on all three skills, which is exactly the "congress" SHUAI asked for.
- `[Inference]` The explicit precedence rule means adding breadth (ui-ux-pro-max) and craft discipline
  (impeccable) cannot accidentally undo ADR 0006's shipped look.
- `[Inference]` Grounding step 2 in ui-ux-pro-max's evidence base reduces "average-of-the-internet" defaults;
  step 3's craft-floor plus the step-4 gate catch slop before it ships.

### Costs / risks
- `[Fact]` The member skills' scripts cannot run in-sandbox; they are reference-only. The authoritative
  visual check remains CI `inspect.mjs --app` + Playwright + the live Pages preview.
- `[Projection]` A future agent could still misread a member skill as a licence to re-skin; Decision 3 is
  written in plain words at the top of `.agent/skills/uiux-congress/SKILL.md` to make that hard to miss.

### Verification
1. `node --test tests/budget-domain.test.mjs` stays **21/21** (this ADR and the vendored docs are
   reference-only; they do not touch `app/`, the domain engine, schema, or CI).
2. CI (unchanged): `inspect.mjs --app` reports 0 FAIL at 1440/768/390 on any future UI change, per ADR 0006.
3. The congress entry point `.agent/skills/uiux-congress/SKILL.md` links all three member skills, this ADR,
   and ADR 0006, and every linked path resolves on disk.
