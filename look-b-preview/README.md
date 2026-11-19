# Ellie's Book — look B preview

An isolated, dark, touch-first design prototype of the five v1 flows. This entry does not import or change the live workbench. It is not a replacement production data model or a migration.

```sh
pnpm install --frozen-lockfile
pnpm run dev:look-b
# Production preview:
pnpm run build:look-b
pnpm run preview:look-b
```

- Start empty, choose Household / Just me / Team, then confirm a total and category limits. The example is an explicit, removable choice.
- Spending has one record and one status: planned (estimate), committed (reserved, not paid), paid (actual). Edit a record to move it forward; do not create a second record for the same payment. Amounts are integer USD cents. There are no proposed budget adjustments in this prototype; saving a plan explicitly confirms its limits.
- `left = confirmed budget − paid − committed`; `forecast = paid + committed + uncommitted planned`; `projected headroom = budget − forecast`. Unassigned budget remains available and appears separately in category tables and finance CSV.
- The money-flow view is a focused, typed budget → category → spending projection of the same records, not a separate freehand canvas. Nodes can be selected without zooming or dragging on phones. Notes attach to budgets, categories or spending records; the audit trail persists alongside them.
- All preview data lives as Markdown in the separate browser key `ellies-book-look-b-markdown-v1`. It never reads or modifies the live app's keys. Download Markdown to keep a portable copy. There is no cloud sync or cross-device persistence. Markdown restore/import is outside this visual prototype.
- Share uses the native share sheet where supported, then clipboard, then a downloadable plain-text report. Print / PDF invokes browser printing; Export for finance downloads a formula-safe category summary CSV, not the live app's 11 canonical tables.
- A browser preview uses the production build on port 4174. It is session-authorized, not a public deployment. Native iOS share/print behavior still requires physical-device verification.

Checks: `node --test tests/look-b.test.mjs` plus the repository's existing lint, domain, production-build and rendered-HTML gates. The review PR targets its own snapshot branch; do not merge it to main or run the live Pages deployment for it.
