# IOS4 — Merge Ask AI and register native sharing

- [Fact] Scope: merge origin/main without rebasing; preserve both Ask AI and native platform behavior. Register the native text-share hook at startup and clear it on cleanup.
- Acceptance: all Node tests, lint, production/Pages/native builds and simulator build succeed; inspect Ask AI, clipboard feedback and native share-sheet screenshots.

## Result
- [Fact] Resolved only `app/book/budget-app.tsx`, retaining both native export/startup handling and Ask AI UI/state. No dependency conflict or lockfile regeneration was needed.
- [Fact] Lint and all builds passed; all 63 Node tests passed, including rendered HTML and Ask AI tests. The simulator Xcode build printed `** BUILD SUCCEEDED **` with the restored 15.4 app SPM platform.
- [Fact] Reinstalled and relaunched. Inspected `/Users/devin/ios-shots/askai-sheet.png` and `askai-native-share.png`. Copy for AI displayed success and the simulator clipboard contained the pack. Native sharing displayed its read-only pack text.
- [Unknown] Third-party AI share destinations and physical devices were not tested.
