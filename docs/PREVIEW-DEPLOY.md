# GitHub Pages static preview — deploy guide

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

## SHUAI manual action (required — cannot be done via API)

> [!IMPORTANT]
> [Fact] GitHub Pages cannot be enabled through the API in this setup. SHUAI
> must do this once in the browser before the first deploy can publish.

1. Open the repository on GitHub: `Settings` > `Pages`.
2. Under `Build and deployment`, set `Source` to **GitHub Actions**.
3. Save.

[Inference] After this one-time setting, every push to `main` (and every manual
`workflow_dispatch` run) publishes the preview automatically.

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
