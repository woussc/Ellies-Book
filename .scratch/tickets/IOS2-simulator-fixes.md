# IOS2 — Simulator follow-up

## Scope
Restore the native keyboard accessory bar and focus scrolling. Export clean
filenames from unique cache directories. Cover the top safe area on iOS and
Safari without changing desktop layout. Add the requested future integration
note in the iOS guide; do not change Ask AI or MCP implementation.

## Verification
Test the platform helper seam for cache paths, cleanup, keyboard setup and focus
events, including empty exports, errors and cancellation. Run the existing web
and native gates. Inspect simulator screenshots of the keyboard accessory bar,
scrolled safe area and file share sheet.

## Result
- [Fact] Platform tests: 11 passed. Domain/model/Markdown: 39 passed. Rendered HTML: 2 passed. Lint, production build, Pages build, native build/sync and Xcode simulator build passed. Typecheck has only the three pre-existing Cloudflare errors recorded in IOS1.
- [Fact] Reinstalled/relaunched the simulator app. Inspected `fix-keyboard.png`, `fix-scrolled-save.png`, `fix-report-share.png` and `fix-csv-share.png` under `/Users/devin/ios-shots/`. Native toolbar, opaque scrolled top and clean file names are visible. Cache cleanup after dismissal was checked.
- [Unknown] Safari standalone and physical-device appearance remain unverified.
