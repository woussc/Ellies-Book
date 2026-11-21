# IOS1 — Native iOS wrapper

## Scope
Package the existing Pages client with Capacitor 8 and Swift Package Manager.
Keep Pages output, domain/schema/sync, Worker, CI and AI/MCP work unchanged.
Use small native adapters for report sharing, cached file export, printing and keyboard handling.

## Acceptance
Run the requested domain, lint, build, rendered HTML, Pages, TypeScript and iOS build gates.
Build for the iPhone 17 simulator, install, launch and inspect a launch screenshot.
Document local build steps. Commit the native project, not generated assets or build outputs.

## Verification seams
Exercise the native wrapper through the simulator and the existing web contracts through their tests.
Native share, file and print adapters preserve the existing report and CSV generators.

## Results
- [Fact] Domain/model/Markdown: 39 passed. Platform adapters: 9 passed. Rendered HTML: 2 passed.
- [Fact] Lint, Worker build, Pages build, native build/sync and simulator Xcode build passed.
- [Fact] Typecheck has three unchanged Cloudflare typing errors, reproduced from a clean main archive with the same dependencies. No new TypeScript errors remain.
- [Fact] Simulator installation and launch succeeded. Launch screenshot inspected at `/Users/devin/ios-shots/launch.png`.
- [Unknown] System sharing, print preview, keyboard interaction and real-device signing remain unverified interactively.
