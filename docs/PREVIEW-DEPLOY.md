# GitHub Pages static preview: deploy guide

> Owner: SHUAI (`Chen Shuaizhou`). Repository: `woussc/Ellies-Book`.

This repo ships a GitHub Pages static preview of the client workbench. It lets
SHUAI review the UI from a live URL without a Cloudflare account. The Cloudflare
Worker (SSR + D1) build is untouched and stays the production target.

## What is automated

- [Fact] `.github/workflows/pages.yml` builds the static preview with
  `pnpm run build:pages` (output dir `dist-pages/`, base path `/Ellies-Book/`),
  then uploads and deploys it with `actions/upload-pages-artifact@v3` and
  `actions/deploy-pages@v4`.
- [Fact] The workflow runs on push to `main` and on `workflow_dispatch`, so
  SHUAI can also start it on demand from the Actions tab.
- [Fact] The workflow uses only the built-in `GITHUB_TOKEN` / OIDC. It needs
  NO repository secrets.

## When the preview publishes (read this first)

> [!IMPORTANT]
> [Fact] This work lives on the branch `feat/github-pages-preview`. It is NOT
> merged to `main` yet. The push trigger watches `main` only, so pushing the
> feature branch does NOT publish a preview by itself.

- [Fact] Auto-publish starts only AFTER this branch merges to `main`. From then
  on, every push to `main` publishes the preview automatically.
- [Inference] Before merge, SHUAI can still get a pre-merge preview on demand.
  Run the workflow manually with `workflow_dispatch`:
  1. Open the repository on GitHub: `Actions` tab.
  2. Select the workflow **Deploy static preview to GitHub Pages**.
  3. Click **Run workflow**, then set the branch to
     `feat/github-pages-preview` and run it.
- [Fact] A manual dispatch uses the workflow file AND the build from the branch
  you pick. Running it from `feat/github-pages-preview` deploys that branch's
  build, so SHUAI sees the pre-merge UI. The one published Pages site is shared,
  so a later push to `main` overwrites a pre-merge preview with the merged one.
- [Assumption] Pages must already be enabled (see the manual action below)
  before any dispatch can publish. Verify on the first run.

## SHUAI manual action (required, cannot be done via API)

> [!IMPORTANT]
> [Fact] GitHub Pages cannot be enabled through the API in this setup. SHUAI
> must do this once in the browser before the first deploy can publish.

1. Open the repository on GitHub: `Settings` > `Pages`.
2. Under `Build and deployment`, set `Source` to **GitHub Actions**.
3. Save.

[Inference] After this one-time setting, every push to `main` publishes the
preview automatically, and a manual `workflow_dispatch` run publishes on demand.
Before this branch merges to `main`, use the manual `workflow_dispatch` path
described above in "When the preview publishes (read this first)".

## Where to find the live URL

[Fact] After a successful run, the deploy job exposes the live URL. Find it in:

- The Actions run summary, under the `github-pages` environment.
- `Settings` > `Pages`, which shows the current published URL.

[Projection] The URL will be
`https://woussc.github.io/Ellies-Book/` once Pages is enabled and the first
deploy succeeds.

## Notes and known behavior

- [Fact] The preview is client-only. There is no `/api/sync` server route on
  Pages. The cloud sync button already fails safe: it catches the failed fetch
  and shows the local-only message, so the preview degrades gracefully with no
  code change.
- [Unknown -> adjust-after-first-CI-run] The build command `pnpm run build:pages`
  and the upload `path: dist-pages` must match `outDir` in
  `vite.config.pages.ts`. If the first CI run shows the static build emits to a
  different directory, update those lines together. They are flagged in
  `pages.yml` with the same tag.
- [Inference] The preview stylesheet uses a Pages-local entry
  (`pages-preview/pages.css`) that re-imports `app/globals.css` and adds
  explicit Tailwind v4 `@source` directives for the app component tree. This is
  a low-risk preventive fix: Tailwind v4 auto-detection runs from the Vite root
  `pages-preview/` and may not scan `../app/*`, so the explicit `@source`
  guarantees the workbench utility classes ship in the preview CSS. It is
  additive and does NOT touch `app/globals.css` or the Worker build.
  [Unknown] Still needs first-CI-run visual confirmation that the preview
  renders fully styled. If auto-detection already reached the app tree, the
  directives are a harmless no-op.
