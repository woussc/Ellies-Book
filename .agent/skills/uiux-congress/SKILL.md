---
name: uiux-congress
description: >-
  The single entry point for any UI/UX design, redesign, restyle, polish, review, or audit task in
  Ellie's Book. Routes one coherent "congress" workflow across three member skills: taste-skill (art
  direction + the anti-slop --app verification gate), ui-ux-pro-max (design-intelligence library +
  design-system tokens), and impeccable (the craft -> critique -> polish -> harden loop). Open this
  FIRST for any surface people look at, work in, or read. Not for backend, domain-engine, schema, or
  non-UI work.
---

# UI/UX Congress — routed design workflow

> **Binding precedence (read first):** **ADR 0006 is the binding visual system for Ellie's Book.** Its
> quiet, light, framed-sheet app-screen look — the `--eb-*` tokens in `app/globals.css`, accent under 5%,
> few type sizes far apart, 16px body, and the banned-ornament list — stays in force. This congress blends
> the **process** and taps the **library**. It is NOT a licence to re-skin the app (no re-theme to any
> other palette or a dark gold-on-black look) unless SHUAI explicitly redirects with a superseding ADR.
> See [`docs/adr/0007-uiux-congress-design-workflow.md`](../../../docs/adr/0007-uiux-congress-design-workflow.md)
> and [`docs/adr/0006-ui-overhaul-taste-skill-direction.md`](../../../docs/adr/0006-ui-overhaul-taste-skill-direction.md).

Ellie's Book is an **app screen** (a workbench). Use the app-screen / Operate-mode path everywhere;
landing-page guidance is secondary and only for a future public surface.

## The three members and their roles

| Member skill | Role | Open |
| :--- | :--- | :--- |
| **taste-skill** | Art direction + the anti-slop **verification gate** (owns PASS/FAIL). | [`../design-taste-frontend/SKILL.md`](../design-taste-frontend/SKILL.md) and [`../design-taste-frontend/references/app-screens.md`](../design-taste-frontend/references/app-screens.md) |
| **ui-ux-pro-max** | Design-intelligence **library** (styles, palettes, font pairings, 119 UX guidelines, charts, 22 stacks) + design-system tokens. Read, do not run. | [`../ui-ux-pro-max/SKILL.md`](../ui-ux-pro-max/SKILL.md), [`../ui-ux-pro-max/references/quick-reference.md`](../ui-ux-pro-max/references/quick-reference.md), [`../ui-ux-pro-max/design-system/references/token-architecture.md`](../ui-ux-pro-max/design-system/references/token-architecture.md) |
| **impeccable** | Craft & polish **loop** (verbs + modes + craft-floor), Operate mode for this workbench. | [`../impeccable/SKILL.md`](../impeccable/SKILL.md) and [`../impeccable/reference/craft-floor.md`](../impeccable/reference/craft-floor.md) |

## The routed pipeline (follow in order)

1. **Frame + inventory** — *taste-skill brief + set impeccable mode = Operate.* State the one question the
   surface answers and name its single dominant element (ADR 0006 §Decision 4).
2. **Ground the direction** — *ui-ux-pro-max (read-only).* Consult `data/ux-guidelines.csv`,
   `data/app-interface.csv`, `data/stacks/react.csv` (or `nextjs`), and `design-system/` for token
   structure. **Every choice lands inside ADR 0006's `--eb-*` system** — the library informs, it never
   re-palettes.
3. **Build + craft** — *impeccable verbs.* Read `reference/craft-floor.md` immediately before any UI edit,
   then apply `layout` / `typeset` / `clarify` / `onboard` / `harden`. The craft-floor must not reintroduce
   anything ADR 0006 bans (gradients, glows, resting shadows, rainbow charts, tinted icon squares, …).
4. **Verify** — *taste-skill gate = authoritative.* Run `scripts/inspect.mjs --app` at 1440/768/390 + the
   critique rubric; run impeccable `audit`/`critique` + craft-floor self-check as a secondary read. If the
   taste-skill gate FAILs, the surface is not done.
5. **Iterate** — fix what one look shows, then look again, until the gate is clean.

## Environment note (`[Fact]`)

In this sandbox the member skills' scripts (`search.py`, the impeccable launcher, live-browser) cannot run;
read the vendored docs/CSVs directly. The authoritative visual check runs in CI (`inspect.mjs --app` +
Playwright) and on the live Pages preview `https://woussc.github.io/Ellies-Book/`.

## Provenance

- taste-skill: `Leonxlnx/taste-skill` v2 (vendored earlier).
- ui-ux-pro-max: `nextlevelbuilder/ui-ux-pro-max-skill`, MIT — see [`../ui-ux-pro-max/PROVENANCE.md`](../ui-ux-pro-max/PROVENANCE.md).
- impeccable: `pbakaus/impeccable`, Apache 2.0 — see [`../impeccable/PROVENANCE.md`](../impeccable/PROVENANCE.md).
