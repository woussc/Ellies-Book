# PROVENANCE — impeccable (vendored, reference-only)

> **Owner**: **SHUAI** (`Chen Shuaizhou`)
> **Vendored into**: `.agent/skills/impeccable/`
> **Related**: ADR 0007 (UI/UX congress workflow), `docs/VENDORING-PLAN-congress.md` section 2, W11-T2.

Controlled language; epistemic tags per `AGENTS.md`.

## Upstream identity (`[Fact]`)

- **Upstream repository**: `github.com/pbakaus/impeccable`
- **Skill name**: `impeccable` (from `SKILL.md` front-matter)
- **Version**: `4.7.1` (from `SKILL.md` front-matter)
- **License**: **Apache 2.0** (`[Fact]` — the `SKILL.md` front-matter declares `license: Apache 2.0`, and the
  repo-root `LICENSE` is the Apache License, Version 2.0, January 2004). This is **Apache 2.0, not MIT**.
- **Branch fetched**: `main`
- **Fetch method**: authenticated GitHub gateway only (`gh api "repos/pbakaus/impeccable/contents/<path>"`
  and the git blobs API for files over the contents 1 MB limit). General web, npm, and plain `git clone`
  are blocked (HTTP 403) in this sandbox.

## What was vendored (`[Fact]`)

ONLY the skill methodology. Upstream already uses the `.agent/skills/impeccable/` layout, so source and
destination paths match exactly (no prefix rewrite).

- `SKILL.md` — the manifest: modes (Persuade / Operate / Read / Experience) and the Commands table.
- `reference/*.md` — the full verb/command library plus modes, native variants, and degraded helpers:
  - **Verbs**: `craft`, `shape`, `init`, `document`, `extract`, `critique`, `audit`, `polish`, `bolder`,
    `quieter`, `distill`, `harden`, `onboard`, `animate`, `colorize`, `typeset`, `layout`, `delight`,
    `overdrive`, `clarify`, `adapt`, `optimize`, `live`, `live-setup`, `generate`, `visualize`, `operate`,
    `new-work`, `doctor`, `hooks`, `component-review`, `region-map`, `routing`, `craft-floor`.
  - **Modes**: `mode-read`, `mode-operate`, `mode-persuade`.
  - **Native variants**: `audit.native`, `adapt.native`, `ios`, `android`.
  - **Degraded helpers**: `reference/degraded/*.md`.
- `scripts/command-metadata.json`, `scripts/VERSION` — small command metadata and the version marker.
- `scripts/data/font-index.json`, `scripts/data/font-index-failures.json` — the font-index data (readable
  offline as reference; the CLI that normally builds/queries them is not vendored).
- `LICENSE` — the upstream Apache 2.0 license text (repo-root `LICENSE`).
- `PROVENANCE.md` — this authored record.

## What was deliberately EXCLUDED and why (`[Fact]`)

The upstream repo is ~828 MB, mostly assets and runnable tooling. None of the following can run in this
sandbox (no `node_modules`, no Python deps, no browser, no Docker), so they are excluded and are **not
runnable here**:

- **Launcher binary and shell wrappers**: `scripts/impeccable`, `scripts/*.cmd` — the self-contained
  launcher binary and its Windows wrapper.
- **Browser automation scripts**: `scripts/*.js` (live-browser, modern-screenshot capture, etc.).
- **Tool/packaging trees**: `crates/`, `cli/`, `cursor-plugin/`, `browser-bundle/`, `demos/`, `tests/`,
  `.kiro/`, `.claude/` — agent-tool wrappers, build crates, and fixtures, not skill methodology.
- **Repo-root `DESIGN.md` and `PRODUCT.md`** — impeccable's own "kinpaku" house design philosophy and
  product context. Excluded on purpose so the impeccable house palette and defaults do NOT leak into
  Ellie's Book. Per ADR 0007 the congress uses impeccable's **process**, not its visual defaults; the
  binding visual system stays ADR 0006.
- Every image, font, and other binary asset.

## Reference-only status (`[Fact]` / `[Inference]`)

- `[Fact]` The vendored verbs and `craft-floor.md` are read **as reference**. The real "verify by looking
  at the rendered result" step that impeccable describes cannot execute here, because the launcher,
  browser, and screenshot tooling are excluded and the sandbox has no browser.
- `[Inference]` Rendered-result verification for Ellie's Book stays with the taste-skill CI gate
  (`.agent/skills/design-taste-frontend/scripts/inspect.mjs --app` at 1440 / 768 / 390 plus Playwright) and
  the live Pages preview. This vendoring adds craft methodology; it does not add a runnable verifier.
- `[Fact]` Vendoring these reference docs does not touch `app/`, the domain engine, schema, or CI, so the
  local gate `node --test tests/budget-domain.test.mjs` stays 21/21.
