# IOS7 — PR 25 native integration

- [Fact] Scope: merge main's card/node redesign, retain native adapters, and verify the redesigned app in the iPhone 17 web view.
- Gates: all Node tests, lint, production/rendered HTML, Pages/iOS and Xcode simulator builds; native touch, keyboard, export/share/print, Ask AI, safe-area and persistence checks.
- [Fact] Completed: normal merge `8a25852`, native startup and action hooks retained in the redesigned workspace, native safe-area/keyboard/drag CSS fixes, and shared renamed-header print fix. Final 108 tests, lint, production/rendered HTML, Pages/iOS and simulator Xcode gates are green. App SPM restored to iOS 15.4 after sync.
- [Fact] Simulator flows, screenshots, layout-audit evidence and explicit interaction/device limits are recorded in the IOS7 completion checkpoint in `.scratch/HANDOFF-STATE.md`. No dependency or lockfile edits.
