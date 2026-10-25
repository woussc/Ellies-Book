# Wave 11: UI/UX Congress Skills (install + blend)

- **Wave**: Wave 11 (planned / not yet executed)
- **Status**: `proposed`
- **Branch**: `feat/congress-uiux-skills` (off `main` @ `c6f71a0`)
- **Blocked By**: none technically. All four slices run in-sandbox via the `gh` gateway + file writes.
- **Governing ADRs**: ADR 0002 (graph-first + adaptive surfaces), ADR 0003 (Kiro-native team + gate),
  **ADR 0006 (binding quiet app-screen visual system)**, **ADR 0007 (congress workflow - NEW)**.
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays **21/21**.
  lint/build/rendered-html + `inspect.mjs --app` + Playwright are CI-only in this sandbox (ADR 0003).
- **Reference**: `docs/VENDORING-PLAN-congress.md` (exact source -> dest file sets).

> `[Context]` SHUAI asked to install two GitHub skills and blend them with the vendored taste-skill into a
> single routed "congress of UI/UX design workflow". The general web, npm, and `git clone` are BLOCKED;
> both target repos are reachable only through the `gh` gateway. The skills' scripts cannot run here, so
> they are vendored as REFERENCE. ADR 0006's shipped quiet app-screen look stays binding; the congress is
> a workflow/library, NOT a re-skin.

> `[Note]` License correction: `impeccable` is **Apache 2.0** (its SKILL.md front-matter + repo LICENSE),
> version 4.7.1 — not MIT. `ui-ux-pro-max` is MIT v2.15.0. Record both exactly in PROVENANCE.

---

## W11-T1 - Vendor `ui-ux-pro-max` selected files (MIT) `[proposed]`

- **Finding** (`[Fact]`): upstream is a multi-subskill bundle under `.claude/skills/`; the design
  intelligence lives in the `ui-ux-pro-max` router's `data/*.csv` + `references/*.md`, plus the
  `design-system` token methodology. Images/fonts/CLIs cannot run here.
- **Goal**: vendor the router/catalog + design-system methodology into `.agent/skills/ui-ux-pro-max/`
  (drop the `.claude/skills/` prefix; nest design-system under `design-system/`). See
  `docs/VENDORING-PLAN-congress.md` section 1.2 for the exact source -> dest table. Add `LICENSE` + an
  authored `PROVENANCE.md`.
- **Scope** (exact files): the ~41 files in the section-1.2 table ONLY. Do NOT vendor any
  `screenshots/gallery/preview/projects/*`, any image/`.ttf`, any `scripts/` CLI, or the
  `design/ui-styling/brand/banner-design/slides` subskills. Do NOT touch `app/`, `db/`, `tests/`, `.github/`.
- **Gate / verification**:
  - `node --test tests/budget-domain.test.mjs` = 21/21.
  - `find .agent/skills/ui-ux-pro-max -type f | grep -iE '\.(png|jpg|jpeg|gif|webp|svg|ico|ttf|otf|woff)$'`
    returns nothing.
  - `test -s .agent/skills/ui-ux-pro-max/data/ux-guidelines.csv && test -s .agent/skills/ui-ux-pro-max/references/pro-rules.md`.
  - `git status --porcelain app/ db/ tests/ .github/` is empty.
- **Acceptance**: the catalog CSVs + `pro-rules.md` + `quick-reference.md` + design-system methodology +
  LICENSE + PROVENANCE present; gate green; no binaries/CLIs; engine untouched.
- **Cross-reference**: delivered as FEAT-001.

---

## W11-T2 - Vendor `impeccable` selected files (Apache 2.0) `[proposed]`

- **Finding** (`[Fact]`): upstream already uses the `.agent/skills/impeccable/` layout, so paths match.
  The craft loop lives in `SKILL.md` + `reference/*.md` + small `scripts/*.json` metadata. The ~828MB of
  assets, the launcher binary and the live-browser `*.js` cannot run here.
- **Goal**: vendor `.agent/skills/impeccable/SKILL.md` + ALL `reference/*.md` + `scripts/command-metadata.json`
  + `scripts/VERSION` + `scripts/data/font-index*.json` + the Apache-2.0 `LICENSE`, plus an authored
  `PROVENANCE.md`. See `docs/VENDORING-PLAN-congress.md` section 2.1.
- **Scope** (exact files): the section-2.1 table ONLY. Do NOT vendor `scripts/impeccable`,
  `scripts/*.js`, `scripts/*.cmd`, `crates/`, `cli/`, `cursor-plugin/`, `browser-bundle/`, `demos/`,
  `tests/`, or the root `DESIGN.md`/`PRODUCT.md` (its kinpaku palette). Do NOT touch `app/`, `db/`, `tests/`, `.github/`.
- **Gate / verification**:
  - `node --test tests/budget-domain.test.mjs` = 21/21.
  - `find .agent/skills/impeccable -type f | grep -iE '\.(png|jpg|svg|ttf|woff|js|cmd)$|/impeccable$'`
    returns nothing.
  - `test -s .agent/skills/impeccable/reference/craft-floor.md && test -s .agent/skills/impeccable/reference/critique.md`.
  - PROVENANCE states Apache 2.0 (not MIT).
- **Acceptance**: SKILL.md + full reference verb library + modes + scripts metadata + LICENSE + PROVENANCE
  present; gate green; no binaries/CLIs; engine untouched.
- **Cross-reference**: delivered as FEAT-002.

---

## W11-T3 - Author the congress doc/skill `[proposed]`

- **Finding** (`[Inference]`): the blend is the heart of the request. It needs one decision record and one
  single entry point, with no contradiction between the three skills and an explicit precedence rule that
  protects ADR 0006.
- **Goal**: write `docs/adr/0007-uiux-congress-design-workflow.md` (0007 confirmed free on `main`) and
  `.agent/skills/uiux-congress/SKILL.md`. Define the three roles (taste-skill = art direction + the
  anti-slop `inspect.mjs --app` gate; ui-ux-pro-max = design-intelligence library + token architecture;
  impeccable = craft->critique->polish->harden loop), the single routed pipeline with concrete hand-offs,
  the conflict-precedence rule (**ADR 0006's quiet light app-screen system stays binding; the congress is
  workflow/library, not a re-skin; no re-theme to any other palette unless SHUAI redirects**), and the
  app-screen reality (Operate mode / `--app`). State that the skills' scripts are reference-only and the
  real verification is CI `inspect.mjs --app` + Pages preview.
- **Scope** (exact files): `docs/adr/0007-uiux-congress-design-workflow.md`, `.agent/skills/uiux-congress/SKILL.md`.
  Do NOT touch `app/`, `db/`, `tests/`, `.github/`, or `app/globals.css` tokens.
- **Gate / verification**:
  - `node --test tests/budget-domain.test.mjs` = 21/21.
  - Both files exist and are valid markdown; `0007` is the only new ADR number.
  - Every `.agent/skills/...` path referenced resolves on disk (grep check).
- **Acceptance**: three distinct roles + numbered routed pipeline + single PASS/FAIL owner (taste gate) +
  explicit ADR-0006 precedence section + app-screen reality; entry-point SKILL.md links the three members +
  ADR 0007 + ADR 0006.
- **Cross-reference**: delivered as FEAT-003.

---

## W11-T4 - Wire AGENTS.md section 3 + CLAUDE.md pointer + provenance `[proposed]` `[Flag for SHUAI]`

- **Finding** (`[Fact]`): the operating contract's skill routing lives in AGENTS.md section 3. UI agents
  must be pointed to the congress entry point. CLAUDE.md (Definitive Task Executor) needs a one-line pointer.
- **Goal**: add a focused subsection to AGENTS.md section 3 (e.g. "D. Unified UI/UX Congress Workflow")
  naming `.agent/skills/uiux-congress/SKILL.md` as the entry point, listing the two new skills with one-line
  roles, and linking ADR 0007 + the ADR 0006 precedence note. Add one line to CLAUDE.md step 2. Confirm the
  two PROVENANCE + LICENSE pairs from T1/T2 exist.
- **Scope** (exact files): `AGENTS.md`, `CLAUDE.md` (+ any missing PROVENANCE/LICENSE). Keep subsections
  A/B/C intact. Do NOT touch `app/`, `db/`, `tests/`, `.github/`.
- **Gate / verification**:
  - `node --test tests/budget-domain.test.mjs` = 21/21.
  - `grep -n 'uiux-congress' AGENTS.md CLAUDE.md` matches in both; `grep -n '0007' AGENTS.md` matches.
  - `git status --porcelain app/ db/ tests/ .github/` empty.
- **Acceptance**: AGENTS.md section 3 has the focused congress subsection; CLAUDE.md has the one-line
  pointer; all four PROVENANCE/LICENSE files exist.
- **Status gate**: `[Flag for SHUAI]` AGENTS.md section 3 is edited. SHUAI previously authorized AGENTS.md
  edits; this is a focused skills addition, flagged here for visibility, not a new approval request.
- **Cross-reference**: delivered as FEAT-004.
