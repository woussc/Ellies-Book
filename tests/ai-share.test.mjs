import test from "node:test";
import assert from "node:assert/strict";
import { copyAiPack, registerNativeShare, shareAiPack } from "../app/book/ai-share.ts";

test("share prefers native, supports Web Share files, and falls back honestly", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const pack = "# Private book\nRead-only copy";
  const setNavigator = (value) => Object.defineProperty(globalThis, "navigator", { configurable: true, value });
  try {
    setNavigator({ share: () => { throw new Error("Must prefer native"); } });
    let nativePack;
    registerNativeShare(async (text) => { nativePack = text; });
    assert.equal((await shareAiPack(pack)).method, "native");
    assert.equal(nativePack, pack);
    registerNativeShare();
    let shared;
    setNavigator({ canShare: () => true, share: async (data) => { shared = data; } });
    assert.equal((await shareAiPack(pack)).method, "share");
    assert.equal(shared.text, pack);
    assert.equal(shared.files[0].name, "ellies-book-ai.md");
    assert.equal(await shared.files[0].text(), pack);
    setNavigator({ canShare: () => false, share: async (data) => { shared = data; } });
    await shareAiPack(pack);
    assert.equal(shared.files, undefined);
    let copied;
    setNavigator({ clipboard: { writeText: async (text) => { copied = text; } } });
    assert.deepEqual(await shareAiPack(pack), { method: "clipboard", offerDownload: true });
    assert.equal(copied, pack);
    await copyAiPack("");
    assert.equal(copied, "");
    setNavigator({ share: async () => { throw new Error("Share failed"); }, clipboard: { writeText: async (text) => { copied = text; } } });
    assert.equal((await shareAiPack(pack)).method, "clipboard");
    setNavigator({ share: async () => { throw new DOMException("Cancelled", "AbortError"); } });
    assert.equal((await shareAiPack(pack)).method, "cancelled");
    setNavigator({});
    assert.deepEqual(await shareAiPack(pack), { method: "download", offerDownload: true });
    registerNativeShare(async () => { throw new Error("Native failed"); });
    await assert.rejects(shareAiPack(pack), /Native failed/);
  } finally {
    registerNativeShare();
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("native cancellation does not offer a download and other failures reject", async () => {
  try {
    registerNativeShare(async () => { throw new DOMException("Sharing cancelled", "AbortError"); });
    assert.deepEqual(await shareAiPack("Pack"), { method: "cancelled", offerDownload: false });
    registerNativeShare(async () => { throw new Error("Native unavailable"); });
    await assert.rejects(shareAiPack("Pack"), /Native unavailable/);
  } finally {
    registerNativeShare();
  }
});
