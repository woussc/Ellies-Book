# Ellie's Book

A warm, touch-first budget book for your household, yourself or your team.

## The five v1 flows

1. **Start my budget** — choose Household / Just me / Team, a name, total and period. The example is a separate, removable book.
2. **Plan by category** — one amount per category; owner/vendor and finance code stay under Advanced.
3. **Log spending** — one form for planned, committed and paid entries.
4. **See where I stand** — category totals, a phone-readable money-flow graph, Markdown notes and activity.
5. **Share a report** — plain-language sharing, print/PDF and Markdown; CSV stays under **Export for finance**.

Worker and GitHub Pages mount the same `app/book/budget-app.tsx`. The legacy studio and workbench are no longer app entry points.

## Storage and accounting

- The current book is saved **only in this browser**, not to a cloud account. Download a **book backup** before changing devices or clearing browser data.
- The backup is versioned Markdown: record metadata in frontmatter, exact notes in the body. **Restore a book (.md)** opens that backup on another device.
- Malformed saved data is protected, not silently replaced. Storage failures offer a download rather than claiming the save worked.
- Earlier Function Budget Studio storage remains untouched and downloadable from My budget. It is not automatically converted.
- `app/budget-domain.mjs` owns financial lineage, headroom and forecast calculations. A paid invoice cannot remain an open commitment.
- The canonical graph/table/vault helpers and Worker sync API remain available; v1 does not claim cloud backup. Native iOS packaging through Capacitor is later.

See [ADR 0009](docs/adr/0009-look-a-five-flow-app.md), [GLOSSARY](GLOSSARY.md) and the [graph contract](docs/foundation/GRAPH-PURCHASE-LIST-CONTRACT.md).

## Development

Use Node 22 and the locked pnpm version from `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm run dev

# Full verification gate
node --test tests/budget-domain.test.mjs tests/book-model.test.mjs
pnpm run lint
pnpm run build
node --test tests/rendered-html.test.mjs
pnpm run build:pages
```

The Worker serves at the root; the static build uses `/Ellies-Book/` for project Pages. Both self-host DM Sans and Lora. Review widths: 390, 768 and 1440px.

| Path | Purpose |
| :--- | :--- |
| `app/book/` | Five-flow client app, typed book model and browser storage adapter. |
| `app/budget-domain.mjs` | Canonical calculations and graph/table/vault projections. |
| `pages-preview/` | Static client bootstrap of the same app, not a second UI. |
| `tests/` | Domain, storage and rendered entry-point contracts. |
| [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) | Repository operating contract. |
| [docs/adr/](docs/adr/) | Product and architectural decisions. |
| [docs/foundation/](docs/foundation/) | Long-term project, knowledge-graph and canonical-table contracts. |
