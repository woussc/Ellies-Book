# PR13 — Preserve remaining Business intent on deselection

## Scope
- Reproduce Multiple -> Growth + Efficiency -> Single -> untick Growth at the TagPicker component seam (user-approved component/logic test level).
- Preserve Efficiency and unrelated tags. Keep the last required intent selected.
- Show all project Save validation errors beside Save, using existing error styling.
- Do not normalize saved selections when changing family mode.

## Verification
- Component handler regression test must fail before the toggle fix.
- Run all Node tests, CI lint/build gates, and TypeScript check. Record preexisting failures.
- Compare `main...feat/wave-13-14`; current main already merged PR13, so also inspect `main^1...feat/wave-13-14`.
- Commit and push only to feat/wave-13-14.
