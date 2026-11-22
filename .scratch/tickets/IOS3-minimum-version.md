# IOS3 — iOS minimum version

- [Fact] Scope: raise the app project, target and SPM minimum to iOS 15.4; document the minimum. Do not change plugin packages or domain/model code.
- Acceptance: the app deployment target is 15.4 and the simulator Xcode build succeeds.
- [Fact] `build:ios` succeeded. Capacitor sync resets only the app SPM platform to 15.0; restored 15.4 after sync and documented this regeneration behavior. Plugin packages remain unchanged.
- [Fact] Final simulator Xcode build: `** BUILD SUCCEEDED **`. `git diff --check` exits 0.
