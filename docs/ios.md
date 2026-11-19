# Run Ellie's Book on iOS

Use a Mac with Xcode 26 or newer, Node 22.13 or newer and pnpm 9.15.9.
The project uses Swift Package Manager. CocoaPods is not needed.

```sh
pnpm install --frozen-lockfile
pnpm run build:ios
pnpm run ios:open
```

In Xcode, select the App scheme and an iPhone simulator, then press Run.
For a real iPhone, select your signing team in App → Signing & Capabilities.
Use your own bundle identifier if your team cannot sign `com.woussc.elliesbook`.

The native build uses the same client entry, components and styles as GitHub
Pages. It builds relative asset URLs into `dist-ios`, then copies them into the
iOS project. Run `build:ios` again after web changes. Do not commit these copied
assets or Xcode build outputs. `build:pages` still builds into `dist-pages` with
the `/Ellies-Book/` base path.

On iOS, report sharing opens the system share sheet. File exports first write
UTF-8 text to the app cache, then offer Save to Files, AirDrop and other share
destinations. The temporary file is removed after the sheet closes. Printing
opens the iOS print preview using the existing report print styles. Expand the
preview to save or share a PDF. No cloud service is needed.

The keyboard resizes the native web view; the focused field scrolls into view.
The app keeps its light appearance and uses safe-area spacing around the chrome.
Saved books stay in this app's local storage, separate from Safari's storage.

Before release, test report sharing, Markdown/CSV export, print preview and
keyboard navigation on a real iPhone and iPad. Simulator launch alone does not
verify the available share destinations or a physical printer.

Adapter tests (Node 22.13 or newer):

```sh
node --experimental-test-module-mocks --test tests/platform.test.mjs
```
