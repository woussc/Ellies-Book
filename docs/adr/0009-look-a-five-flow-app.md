# ADR 0009 — Make the selected Look A the v1 app

## Status

Accepted direction from SHUAI: “Shuai picked Look A. Next: make it the real Ellie's Book app on main.” Implementation is submitted for review, not merged.

## Decision

- Both Worker `/` and GitHub Pages mount the same five-flow `BudgetApp`: start a budget, plan categories, log spending, see where I stand, share a report. There is no embedded classic studio or second spend/report route.
- The selected cream/forest/DM Sans/Lora visual design replaces ADR 0008's dark theme and ADR 0006's visual tokens. The five-flow navigation replaces ADR 0002's default graph landing, not its accounting or graph-to-table invariants. ADR 0007's congress craft and verification process remains in force.
- Household, Just me and Team remain modular category presets. Profile changes on an existing book do not delete its categories or spending.
- Money flow projects the same category, spending and lifecycle records as the overview and report. Planned ideas are not payments; a committed invoice becomes an Actual only when marked paid. `budget-domain.mjs` owns headroom and forecast math.
- The authoritative book is versioned Markdown in browser storage: JSON-compatible YAML frontmatter stores records; the body preserves the exact Markdown note. Notes, category edits and lifecycle changes persist immediately. Budget details have an explicit draft/Save boundary. Save errors retain the page state and offer a backup instead of claiming success.
- A separate removable example never replaces a personal book. A Markdown backup restores the same categories, spending, finance codes, notes and activity on another browser/device. Malformed storage is protected and can be downloaded before an explicit restore.
- Earlier Function Budget Studio local-storage keys remain untouched and can be downloaded. No lossy automatic migration, cloud-sync claim, or automatic approval is introduced. The existing canonical graph/vault helpers and sync API remain available for later integration, not as duplicate user interfaces.
- Capacitor packaging is a later step.

## Verification consequences

Retire the fifteen source-string tests for the deleted studio/workbench (dark tokens, split-pane layout, sample toggle and old graph landing). Retain every pure domain test, canonical table/vault/lineage test and server sync contract; only remove the UI assertions from the mixed sync test. Replace the obsolete UI tests with book-model/storage tests, a rendered five-flow entry contract and browser evidence at 390/768/1440px.

Review the storage seam separately from the app replacement. The latter is one coherent UI change because keeping either old entry point would reintroduce the duplicate paths SHUAI asked to remove.
