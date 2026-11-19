import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exampleBudget, serializeBook, totals } from "../app/book/model.mjs";

const script = new URL("../scripts/ellies-book-mcp.mjs", import.meta.url);
const request = (id, method, params = {}) => ({ jsonrpc: "2.0", id, method, params });
function run(file, requests, useEnv = false) {
  const result = spawnSync(process.execPath, [script.pathname, ...(useEnv ? [] : [file])], {
    input: requests.map((r) => typeof r === "string" ? r : JSON.stringify(r)).join("\n") + "\n",
    encoding: "utf8", env: { ...process.env, ELLIES_BOOK_FILE: file },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout.trim().split("\n").map((line) => JSON.parse(line));
}

test("stdio connector initializes, lists and calls tools without writing the backup", () => {
  const dir = mkdtempSync(join(tmpdir(), "ellies-book-mcp-"));
  const file = join(dir, "ellies-book.md");
  try {
    const book = exampleBudget();
    const markdown = serializeBook(book);
    writeFileSync(file, markdown);
    const responses = run(file, [request(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } }), { jsonrpc: "2.0", method: "notifications/initialized" }, request(2, "tools/list"), request(3, "tools/call", { name: "get_book_summary", arguments: {} }), request(4, "ping")]);
    assert.equal(responses.length, 4);
    assert.equal(responses[0].result.protocolVersion, "2024-11-05");
    assert.deepEqual(responses[0].result.capabilities, { tools: { listChanged: false } });
    assert.equal(responses[1].result.tools.length, 5);
    assert.equal(responses[2].result.structuredContent.remaining, totals(book).left);
    assert.equal(responses[2].result.content[0].type, "text");
    assert.deepEqual(responses[3].result, {});
    assert.equal(readFileSync(file, "utf8"), markdown);
    assert.equal(run(file, [request(5, "tools/call", { name: "get_book_summary" })], true)[0].result.structuredContent.name, book.name);
    const errors = run(file, ["not-json", {}, request(6, "write"), request(7, "tools/call", { name: "delete_book" }), request(8, "tools/call", { name: "list_spending", arguments: { limit: -1 } })]);
    assert.deepEqual(errors.map((r) => r.error.code), [-32700, -32600, -32601, -32602, -32602]);
    writeFileSync(file, "broken");
    assert.match(run(file, [request(9, "tools/list")])[0].error.message, /Could not read the saved book/);
    assert.match(run(join(dir, "missing.md"), [request(10, "tools/list")])[0].error.message, /Could not read the saved book/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
