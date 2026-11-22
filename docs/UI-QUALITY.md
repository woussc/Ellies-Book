# UI spacing and alignment gate

This is a standing requirement for every UI change, across Household, Just me and Team. Preserve the approved information hierarchy and visual language. A passing build or geometry probe is not visual approval.

## Automated gate

Serve the production build, then run:

```sh
BASE_URL=http://localhost:3000/ node scripts/spacing-audit.mjs
```

Playwright and its Chromium/WebKit engines must be installed. CI installs them ephemerally; do not change the app lockfile for audit tooling. `SPACING_OUT` selects the ledger/screenshot directory. `ENGINES`, `WIDTHS` and `MODES` narrow local diagnosis only; the full CI matrix remains required.

The matrix covers all three modes at 320, 390, 430, 768 and 1440px in Chromium and Linux WebKit. It uses isolated, synthetic Markdown books, five entries in one category, an empty sibling category, all three money states and entry-owned notes. Each state is identified in a per-engine JSON ledger. Representative screenshots and every failed state's screenshot are retained.

Allocations also checks the new-category field/action gap, matching heights and 16px input/action content insets. Collapsed and expanded Ask AI check list-row gaps and text clearance before the next column's bullet. The ledger records action content insets and list spacing; horizontal bullet clearance uses the rendered font's bullet-and-space advance, so native screenshots must still confirm marker paint.

Check Board, Arrange, legend, project/budget/category/entry details, folded and paginated trails, empty trails, Entries add/edit/remove confirmation/filters, empty and populated Books, new-book setup, dated project setup, allocations, Profile, Budget settings, Report and collapsed/expanded Ask AI. Existing visual regressions also check layout persistence and financial invariance. The spacing gate fails on document overflow, field escape, undersized or overlapping active controls, heading/connector collisions, native button fills, mismatched paired controls, cramped text/action groups and card-text inset violations. Modal-background elements are excluded; focus must settle before evaluating scroll clearance.

## Visual acceptance, every time

- Inspect each page in each mode, not just a clean example.
- Keep related controls at least 8px apart; prefer 12px in action groups.
- Keep curved-card text at least 16px inside its safe boundary.
- Prefer 24px between cards; distinguish grouping from accidental whitespace.
- Use 44px minimum action targets; align peer tops and bottoms on shared rows.
- Stack phone fields when their contents cannot fit; never truncate money defaults.
- Keep dates readable, fully inside fields, and stack paired phone dates.
- Inspect long titles, large/negative amounts, notes, empty and populated states.
- Check every dialog, expanded section, error and removal confirmation.
- Scroll to the last action: fixed navigation must not cover it.
- Check native date/select glyphs and currency text visually; matched outer boxes cannot prove internal readability.
- Keep layout actions financially inert, including notes and stage history.

Review the generated screenshots at phone, tablet and desktop widths using the UI/UX Congress app-screen gate. Record focused interaction acceptance after fixes. Do not hide overflow, shrink text, skip a mode, or exclude a failing state to make the gate pass. New reachable surfaces must be added to the matrix and this inventory in the same change.

## Evidence limits

Linux WebKit is engine coverage, not physical iPhone/Safari validation. Native control internals, keyboard appearance, device safe areas, gestures and OS sharing need device-specific evidence. Report those gaps explicitly; never call the matrix a complete accessibility or native-device certification. Use a macOS/device pass when a Safari-only issue cannot be reproduced locally.
