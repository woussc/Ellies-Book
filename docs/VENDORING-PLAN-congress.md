# Vendoring Plan: UI/UX Congress Skills

> **Owner**: **SHUAI** (`Chen Shuaizhou`)
> **Branch**: `feat/congress-uiux-skills`
> **Related**: ADR 0007 (congress workflow), ADR 0006 (binding visual system), W11 tickets (`.scratch/tickets/W11-uiux-congress.md`)

This document records the exact source -> destination file sets for installing the two external skills,
and states what is excluded and why. Controlled language; epistemic tags per AGENTS.md.

---

## 0. Constraints that shape this plan (`[Fact]`)

- The general web, the npm registry, and plain `git clone` are BLOCKED in this sandbox (HTTP 403).
- Both target repos ARE reachable through the authenticated GitHub gateway. Fetch file content with:
  ```bash
  gh api "repos/<owner>/<repo>/contents/<path>" --jq '.content' | base64 -d > <dest>
  ```
  List trees with:
  ```bash
  gh api "repos/<owner>/<repo>/git/trees/main?recursive=1" --jq '.tree[] | select(.type=="blob") | .path'
  ```
- No `node_modules`, no Python deps, no browser, no Docker. So EVERY skill script (python/node CLI,
  live-browser) CANNOT run here. Scripts are vendored only where small and useful as data/metadata; the
  large runnable CLIs and binaries are EXCLUDED. The skills are installed as **reference**.
- The only runnable gate is `node --test tests/budget-domain.test.mjs` (currently **21/21**). Vendoring
  reference docs into `.agent/skills/` does not touch `app/`, the domain engine, schema, or CI, so the
  gate is unaffected by design.
- Skills are vendored self-contained under `.agent/skills/<name>/`, matching the 44 existing skills.

---

## 1. `ui-ux-pro-max` (MIT) -> `.agent/skills/ui-ux-pro-max/`

- **Upstream**: `github.com/nextlevelbuilder/ui-ux-pro-max-skill`, branch `main`.
- **Identity** (`[Fact]`, from `skill.json`): name `ui-ux-pro-max`, version `2.15.0`, license **MIT** (c) 2024 Next Level Builder.
- **Shape** (`[Fact]`): a MULTI-SUBSKILL bundle laid out as `.claude/skills/<subskill>/`. Subskills:
  `ui-ux-pro-max` (router + the searchable catalog), `design-system`, `design`, `ui-styling`, `brand`,
  `banner-design`, `slides`. ~697 blobs total, most of them images/screenshots/gallery/preview and font binaries.

### 1.1 Recommendation and justification (`[Inference]`)

Vendor **the router/catalog subskill + the design-system token methodology only** — NOT the whole bundle.

- The router subskill `ui-ux-pro-max/` is the breadth of design intelligence SHUAI wants: `data/*.csv`
  hold the 79 styles, 192 palettes, 74 font pairings, 119 UX guidelines, chart types and the 22 stack
  tables. These are plain CSV/JSON and are fully usable OFFLINE by reading them directly, even though the
  `search.py` CLI that normally queries them cannot run here.
- The `design-system/` subskill carries the token-architecture rigor (primitive/semantic/component tokens,
  tailwind integration) that directly complements ADR 0006's `--eb-*` token system. Its methodology docs
  are usable offline.
- EXCLUDE `design/`, `ui-styling/`, `brand/`, `banner-design/`, `slides/` subskills: they are oriented to
  logo/slide/banner/image generation driven by python CLIs and large font/image assets that cannot run
  here and are off the app-screen workbench need. (A later wave can add them if SHUAI wants them.)

### 1.2 Exact source -> destination (drop the `.claude/skills/` prefix)

Router + catalog (`.claude/skills/ui-ux-pro-max/*` -> `.agent/skills/ui-ux-pro-max/*`):

| Source (upstream) | Destination |
|---|---|
| `.claude/skills/ui-ux-pro-max/SKILL.md` | `.agent/skills/ui-ux-pro-max/SKILL.md` |
| `.claude/skills/ui-ux-pro-max/references/pro-rules.md` | `.agent/skills/ui-ux-pro-max/references/pro-rules.md` |
| `.claude/skills/ui-ux-pro-max/references/quick-reference.md` | `.agent/skills/ui-ux-pro-max/references/quick-reference.md` |
| `.claude/skills/ui-ux-pro-max/data/styles.csv` | `.agent/skills/ui-ux-pro-max/data/styles.csv` |
| `.claude/skills/ui-ux-pro-max/data/colors.csv` | `.agent/skills/ui-ux-pro-max/data/colors.csv` |
| `.claude/skills/ui-ux-pro-max/data/typography.csv` | `.agent/skills/ui-ux-pro-max/data/typography.csv` |
| `.claude/skills/ui-ux-pro-max/data/google-fonts.csv` | `.agent/skills/ui-ux-pro-max/data/google-fonts.csv` |
| `.claude/skills/ui-ux-pro-max/data/ux-guidelines.csv` | `.agent/skills/ui-ux-pro-max/data/ux-guidelines.csv` |
| `.claude/skills/ui-ux-pro-max/data/charts.csv` | `.agent/skills/ui-ux-pro-max/data/charts.csv` |
| `.claude/skills/ui-ux-pro-max/data/app-interface.csv` | `.agent/skills/ui-ux-pro-max/data/app-interface.csv` |
| `.claude/skills/ui-ux-pro-max/data/products.csv` | `.agent/skills/ui-ux-pro-max/data/products.csv` |
| `.claude/skills/ui-ux-pro-max/data/landing.csv` | `.agent/skills/ui-ux-pro-max/data/landing.csv` |
| `.claude/skills/ui-ux-pro-max/data/motion.csv` | `.agent/skills/ui-ux-pro-max/data/motion.csv` |
| `.claude/skills/ui-ux-pro-max/data/icons.csv` | `.agent/skills/ui-ux-pro-max/data/icons.csv` |
| `.claude/skills/ui-ux-pro-max/data/ui-reasoning.csv` | `.agent/skills/ui-ux-pro-max/data/ui-reasoning.csv` |
| `.claude/skills/ui-ux-pro-max/data/react-performance.csv` | `.agent/skills/ui-ux-pro-max/data/react-performance.csv` |
| `.claude/skills/ui-ux-pro-max/data/catalog-summary.json` | `.agent/skills/ui-ux-pro-max/data/catalog-summary.json` |
| `.claude/skills/ui-ux-pro-max/data/data-provenance.json` | `.agent/skills/ui-ux-pro-max/data/data-provenance.json` |
| `.claude/skills/ui-ux-pro-max/data/stacks/*.csv` (22 files) | `.agent/skills/ui-ux-pro-max/data/stacks/*.csv` |

Design-system token methodology (`.claude/skills/design-system/*` -> `.agent/skills/ui-ux-pro-max/design-system/*`):

| Source (upstream) | Destination |
|---|---|
| `.claude/skills/design-system/SKILL.md` | `.agent/skills/ui-ux-pro-max/design-system/SKILL.md` |
| `.claude/skills/design-system/references/token-architecture.md` | `.agent/skills/ui-ux-pro-max/design-system/references/token-architecture.md` |
| `.claude/skills/design-system/references/primitive-tokens.md` | `.agent/skills/ui-ux-pro-max/design-system/references/primitive-tokens.md` |
| `.claude/skills/design-system/references/semantic-tokens.md` | `.agent/skills/ui-ux-pro-max/design-system/references/semantic-tokens.md` |
| `.claude/skills/design-system/references/component-tokens.md` | `.agent/skills/ui-ux-pro-max/design-system/references/component-tokens.md` |
| `.claude/skills/design-system/references/component-specs.md` | `.agent/skills/ui-ux-pro-max/design-system/references/component-specs.md` |
| `.claude/skills/design-system/references/states-and-variants.md` | `.agent/skills/ui-ux-pro-max/design-system/references/states-and-variants.md` |
| `.claude/skills/design-system/references/tailwind-integration.md` | `.agent/skills/ui-ux-pro-max/design-system/references/tailwind-integration.md` |
| `.claude/skills/design-system/templates/design-tokens-starter.json` | `.agent/skills/ui-ux-pro-max/design-system/templates/design-tokens-starter.json` |
| `LICENSE` | `.agent/skills/ui-ux-pro-max/LICENSE` |

Plus a new authored `.agent/skills/ui-ux-pro-max/PROVENANCE.md`.

### 1.3 Excluded and why (`[Fact]`)

- `screenshots/`, `gallery/`, `preview/`, `projects/` and every `.png/.jpg/.svg/.ico` — images, large, not usable offline.
- All `scripts/` (`search.py`, `core.py`, `design_system.py`, `*.cjs`, test fixtures) — runnable CLIs that
  cannot run in-sandbox; the CSV catalogs they query are vendored and read directly instead.
- `.claude/skills/{design,ui-styling,brand,banner-design,slides}/` subskills and `ui-styling/canvas-fonts/*.ttf`
  (~80 font binaries) — out of the app-screen need and large binaries.
- `cli/`, `src/`, `stack/`, `.claude-plugin/`, localized `README.*.md` — tool wrappers / packaging, not methodology.

---

## 2. `impeccable` (Apache 2.0) -> `.agent/skills/impeccable/`

- **Upstream**: `github.com/pbakaus/impeccable`, branch `main`.
- **Identity** (`[Fact]`, from `.agent/skills/impeccable/SKILL.md` front-matter and the repo `LICENSE`):
  name `impeccable`, version **4.7.1**, license **Apache 2.0**. `[Note]` This corrects the orchestrator
  briefing, which anticipated MIT; the authoritative manifest and LICENSE file both say Apache 2.0. The
  PROVENANCE note must say Apache 2.0.
- **Shape** (`[Fact]`): ~828MB repo, mostly assets. The skill content already lives at
  `.agent/skills/impeccable/` upstream, so source and destination paths match exactly (no prefix rewrite).

### 2.1 Exact source -> destination (paths identical)

| Source (upstream) | Destination |
|---|---|
| `.agent/skills/impeccable/SKILL.md` | same |
| `.agent/skills/impeccable/reference/*.md` (ALL: verb library + modes + degraded/ + native) | same |
| `.agent/skills/impeccable/scripts/command-metadata.json` | same |
| `.agent/skills/impeccable/scripts/VERSION` | same |
| `.agent/skills/impeccable/scripts/data/font-index.json` | same |
| `.agent/skills/impeccable/scripts/data/font-index-failures.json` | same |
| `LICENSE` | `.agent/skills/impeccable/LICENSE` |

Enumerate the reference set at vendor time with:
```bash
gh api "repos/pbakaus/impeccable/git/trees/main?recursive=1" --jq '.tree[] | select(.type=="blob") | .path' \
  | grep '^\.agent/skills/impeccable/reference/.*\.md$'
```
Plus a new authored `.agent/skills/impeccable/PROVENANCE.md`.

### 2.2 Verb/command library vendored (`[Fact]`, the craft loop)

`craft`, `shape`, `init`, `document`, `extract`, `critique`, `audit` (+`audit.native`), `polish`,
`bolder`, `quieter`, `distill`, `harden`, `onboard`, `animate`, `colorize`, `typeset`, `layout`,
`delight`, `overdrive`, `clarify`, `adapt` (+`adapt.native`), `optimize`, `live` (+`live-setup`),
`generate`, `visualize`, `operate`, `new-work`, `doctor`, `hooks`, `component-review`, `region-map`,
`routing`, `craft-floor`, modes `mode-read`/`mode-operate`/`mode-persuade`, `ios`/`android`, and
`reference/degraded/*.md`.

### 2.3 Excluded and why (`[Fact]`)

- `scripts/impeccable`, `scripts/impeccable.cmd`, `scripts/*.js` (live-browser, modern-screenshot) — the
  launcher binary and browser automation; none can run in-sandbox.
- `crates/`, `cli/`, `cursor-plugin/`, `browser-bundle/`, `demos/`, `tests/`, `.kiro/`, `.claude/` and all
  other agent-tool wrappers — not skill methodology; ~828MB of assets/fixtures.
- `DESIGN.md`/`PRODUCT.md` at repo root (the project's own kinpaku design philosophy) — NOT vendored, so the
  impeccable house palette does not leak into Ellie's Book. Per ADR 0007 the congress uses impeccable's
  PROCESS, not its visual defaults.

---

## 3. Licensing and attribution (`[Fact]`)

- `ui-ux-pro-max` is MIT; `impeccable` is Apache 2.0. Both permit vendoring with attribution.
- Each vendored skill gets its upstream `LICENSE` text at `.agent/skills/<name>/LICENSE` and an authored
  `PROVENANCE.md` recording upstream URL, name, version, license, branch fetched, what was vendored, and
  what was excluded. This satisfies attribution and records that the skills are reference-only here.

---

## 4. Verification (`[Fact]`)

- `node --test tests/budget-domain.test.mjs` stays **21/21** after each vendoring slice (reference docs do
  not touch the engine).
- No image/font/binary/CLI path is present under either vendored skill (grep check in the W11 tickets).
- `git status` shows additions only under `.agent/skills/{ui-ux-pro-max,impeccable}/`; `app/`, `db/`,
  `tests/`, `.github/` untouched.
