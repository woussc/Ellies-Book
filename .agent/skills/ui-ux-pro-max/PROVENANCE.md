# PROVENANCE — ui-ux-pro-max (vendored, reference-only)

> **Owner**: **SHUAI** (`Chen Shuaizhou`)
> **Related**: ADR 0007 (UI/UX congress workflow), `docs/VENDORING-PLAN-congress.md` section 1, W11 tickets.

This file records the upstream origin, license, and vendoring scope of the
`ui-ux-pro-max` skill installed under `.agent/skills/ui-ux-pro-max/`.

## 1. Upstream identity (`[Fact]`)

- **Upstream URL**: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- **Skill name**: `ui-ux-pro-max` (from upstream `skill.json`)
- **Version**: `2.15.0`
- **License**: MIT — Copyright (c) 2024 Next Level Builder (see `LICENSE`)
- **Branch fetched**: `main` (commit `d14efff8ed1faa4187f004f79926f428c8074ec7`)

## 2. Fetch method (`[Fact]`)

The general web, the npm registry, and plain `git clone` are blocked in this
sandbox (HTTP 403). Files were fetched through the authenticated GitHub gateway:

```bash
gh api "repos/nextlevelbuilder/ui-ux-pro-max-skill/contents/<path>" \
  --jq '.content' | base64 -d > <dest>
```

The upstream repository lays its skills out as `.claude/skills/<subskill>/`. The
`.claude/skills/` prefix was dropped on vendoring so the layout matches this
repository's `.agent/skills/<name>/` convention.

## 3. What was vendored (`[Fact]`)

Only the **methodology and catalog documents** were vendored — the parts that are
usable offline by reading them directly.

- **Router + design-intelligence catalog** (from `.claude/skills/ui-ux-pro-max/`):
  `SKILL.md`, `references/pro-rules.md`, `references/quick-reference.md`, and the
  `data/` catalogs — `styles.csv`, `colors.csv`, `typography.csv`,
  `google-fonts.csv`, `ux-guidelines.csv`, `charts.csv`, `app-interface.csv`,
  `products.csv`, `landing.csv`, `motion.csv`, `icons.csv`, `ui-reasoning.csv`,
  `react-performance.csv`, `catalog-summary.json`, `data-provenance.json`, and all
  22 `data/stacks/*.csv` (angular, astro, avalonia, flutter, html-tailwind, javafx,
  jetpack-compose, laravel, nextjs, nuxt-ui, nuxtjs, react-native, react, shadcn,
  svelte, swiftui, threejs, uno, uwp, vue, winui, wpf).
- **Design-system token methodology** (from `.claude/skills/design-system/`), placed
  under `design-system/`: `SKILL.md`, `references/{token-architecture,
  primitive-tokens, semantic-tokens, component-tokens, component-specs,
  states-and-variants, tailwind-integration}.md`, and
  `templates/design-tokens-starter.json`.
- The upstream MIT `LICENSE` text, at `LICENSE`.

## 4. What was excluded and why (`[Fact]`)

- **`scripts/` CLIs** — `search.py`, `core.py`, `design_system.py`,
  `reasoning_contract.py`, `validate_data.py`, the `*.cjs` helpers, and their
  `scripts/tests/` fixtures. These are runnable tools that cannot run in this
  sandbox (HTTP 403, no Python/node deps). The CSV catalogs they normally query are
  vendored and read directly instead.
- **Images and binaries** — all `screenshots/`, `gallery/`, `preview/`, `projects/`
  assets and every `.png/.jpg/.jpeg/.gif/.webp/.svg/.ico` plus `.ttf/.otf/.woff`
  font binaries. Large, and not usable offline.
- **Other subskills** — `design/`, `ui-styling/` (including the ~80
  `canvas-fonts/*.ttf`), `brand/`, `banner-design/`, and `slides/`. These are driven
  by image/slide/banner generation CLIs and large assets that cannot run here and are
  outside the app-screen workbench need. The `design-system/` slide-serving data
  (`data/slide-*.csv`) and its scripts were also excluded.
- **Packaging/tooling** — `cli/`, `src/`, `stack/`, `.claude-plugin/`, and localized
  `README.*.md`.

## 5. Runnability note (`[Fact]`)

The search CLI `scripts/search.py` is **NOT vendored and is NOT runnable here**. Use
the vendored CSV catalogs directly as reference: the headers describe each column,
and each row is a design-intelligence entry. No network or Python runtime is required
to read them.
