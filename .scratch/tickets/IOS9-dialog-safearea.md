# IOS9 — Native dialog safe areas

- Scope: constrain expanded Ask AI to the native safe viewport, retain 44px Close, inspect other full-screen dialogs, and preserve browser layout.
- Verification: requested Node/lint/build/rendered HTML/iOS/Xcode gates, expanded Ask AI and garden dialog simulator checks, and inspected screenshot `/Users/devin/ios-shots/fix-askai-safearea.png`. Commit separately; do not push.
- [Fact] Native Ask AI and size dialogs now constrain their maximum height and center between safe insets. Full-screen node-detail receives the existing garden dialog top-safe-area rule. The current redesigned app uses garden dialogs; older node-detail/size-dialog routes were inspected in code, not exercised in the simulator.
- [Fact] Expanded Ask AI stays below status icons; its existing 44px minimum Close remains reachable and was pressed successfully. Also opened and inspected the full-screen Budget details dialog: `/Users/devin/ios-shots/fix-garden-safearea.png`. No browser CSS selector changed.
- [Fact] Verification shared with IOS10: 108 Node tests, lint, production build, rendered HTML 2/2, native sync and Xcode simulator build passed; SPM restored to iOS 15.4 after sync. Reinstalled iPhone 17 app, PID 10982. Chromium/WebKit spacing audit completed 900 states without failure. Logs: `/Users/devin/ios9-10-*.log`.
