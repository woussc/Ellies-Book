import assert from "node:assert/strict";
import { mock, test } from "node:test";

let native = false;
let failure;
let writeFailure;
const calls = [];
const keyboardEvents = new Map();
const removedListeners = [];
mock.module("@capacitor/core", { namedExports: {
  Capacitor: { isNativePlatform: () => native },
  registerPlugin: () => ({ print: async () => { calls.push("print"); } }),
} });
mock.module("@capacitor/share", { namedExports: { Share: {
  share: async (options) => { calls.push(options); if (failure) throw failure; },
} } });
mock.module("@capacitor/filesystem", { namedExports: {
  Directory: { Cache: "CACHE" }, Encoding: { UTF8: "utf8" },
  Filesystem: {
    writeFile: async (options) => {
      calls.push(options);
      if (writeFailure) throw writeFailure;
      return { uri: "file:///cache/report.md" };
    },
    rmdir: async (options) => { calls.push({ deleted: options.path, recursive: options.recursive }); },
  },
} });
mock.module("@capacitor/keyboard", { namedExports: { Keyboard: {
  setAccessoryBarVisible: async (options) => { calls.push(options); },
  addListener: async (event, listener) => {
    keyboardEvents.set(event, listener);
    return { remove: () => removedListeners.push(event) };
  },
} } });
const { shareReport, saveFile, printReport, watchNativeKeyboard } = await import("../app/book/platform.ts");

test("web report sharing falls through to the existing browser flow", async () => {
  assert.equal(await shareReport("Book", "Summary"), false);
  assert.deepEqual(calls, []);
});

test("native reports use the share sheet, including empty report text", async () => {
  native = true;
  assert.equal(await shareReport("Book", "Summary"), true);
  assert.deepEqual(calls.pop(), { title: "Book", text: "Summary" });
  await shareReport("Book", "");
  assert.equal(calls.pop().text, "");
});

test("native exports share cached UTF-8 files and remove them afterwards", async () => {
  for (const content of ["# Report", ""]) {
    await saveFile(content, "report.md", "text/markdown");
    const [written, shared, deleted] = calls.splice(0);
    assert.equal(written.data, content);
    assert.equal(written.directory, "CACHE");
    assert.equal(written.encoding, "utf8");
    assert.match(written.path, /^[^/]+\/report\.md$/);
    assert.equal(written.recursive, true);
    assert.deepEqual(shared, { title: "report.md", files: ["file:///cache/report.md"] });
    assert.equal(deleted.deleted, written.path.split("/")[0]);
    assert.equal(deleted.recursive, true);
  }
});

test("failed file sharing cleans up and propagates the error", async () => {
  failure = new Error("Unavailable");
  await assert.rejects(saveFile("data", "data.csv", "text/csv"), /Unavailable/);
  assert.equal(calls.at(-1).deleted, calls[0].path.split("/")[0]);
  calls.length = 0;
});

test("share cancellation is not treated as an export failure", async () => {
  failure = new Error("Share canceled");
  await assert.rejects(shareReport("Book", "Summary"), { name: "AbortError" });
  await assert.rejects(saveFile("", "empty.md", "text/markdown"), { name: "AbortError" });
  failure = undefined;
  calls.length = 0;
});

test("native printing dispatches to the registered print plugin", async () => {
  await printReport();
  assert.deepEqual(calls.splice(0), ["print"]);
});

test("a cache write failure never opens a share sheet", async () => {
  writeFailure = new Error("Cache full");
  await assert.rejects(saveFile("data", "data.csv", "text/csv"), /Cache full/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].data, "data");
  assert.equal(calls[1].deleted, calls[0].path.split("/")[0]);
  calls.length = 0;
  writeFailure = undefined;
});

test("web exports keep Blob downloads for normal and empty content", async () => {
  native = false;
  const anchor = { click: mock.fn() };
  mock.method(URL, "createObjectURL", (blob) => {
    calls.push(blob);
    return "blob:report";
  });
  mock.method(globalThis, "setTimeout", () => 0);
  globalThis.document = { createElement: () => anchor };
  for (const content of ["Report", ""]) {
    await saveFile(content, "report.md", "text/markdown");
    const blob = calls.pop();
    assert.equal(await blob.text(), content);
    assert.equal(blob.type, "text/markdown");
    assert.equal(anchor.download, "report.md");
    assert.equal(anchor.href, "blob:report");
  }
  assert.equal(anchor.click.mock.callCount(), 2);
  delete globalThis.document;
  mock.restoreAll();
});

test("web print keeps the browser print path and exposes failures", async () => {
  globalThis.window = { print: mock.fn() };
  await printReport();
  assert.equal(window.print.mock.callCount(), 1);
  window.print = () => { throw new Error("Printer unavailable"); };
  await assert.rejects(printReport(), /Printer unavailable/);
  delete globalThis.window;
});

test("web startup leaves the keyboard and document alone", () => {
  native = false;
  watchNativeKeyboard()();
  assert.deepEqual(calls, []);
});

test("native keyboard restores Done and scrolls each focused field after resize", async () => {
  native = true;
  const classes = new Set();
  const events = new Map();
  globalThis.HTMLElement = class {};
  const field = new HTMLElement();
  field.scrollIntoView = mock.fn();
  globalThis.document = {
    documentElement: { classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
    } },
    activeElement: field,
    addEventListener: (name, handler) => events.set(name, handler),
    removeEventListener: (name) => events.delete(name),
  };
  globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  const stop = watchNativeKeyboard();
  assert.deepEqual(calls.splice(0), [{ isVisible: true }]);
  events.get("focusin")();
  assert.equal(field.scrollIntoView.mock.callCount(), 0);
  keyboardEvents.get("keyboardDidShow")();
  assert.equal(classes.has("native-keyboard-open"), true);
  assert.deepEqual(field.scrollIntoView.mock.calls[0].arguments, [{ block: "center", behavior: "smooth" }]);
  events.get("focusin")();
  assert.equal(field.scrollIntoView.mock.callCount(), 2);
  document.activeElement = null;
  events.get("focusin")();
  keyboardEvents.get("keyboardDidHide")();
  assert.equal(classes.has("native-keyboard-open"), false);
  events.get("focusin")();
  assert.equal(field.scrollIntoView.mock.callCount(), 2);
  stop();
  await Promise.resolve();
  assert.deepEqual(removedListeners.sort(), ["keyboardDidHide", "keyboardDidShow"]);
  assert.equal(events.size, 0);
  delete globalThis.document;
  delete globalThis.HTMLElement;
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});
