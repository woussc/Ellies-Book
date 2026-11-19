import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Ask AI offers a private preview and plain-language actions in Share", () => {
  const sheet = readFileSync(new URL("../app/book/ask-ai-sheet.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/book/budget-app.tsx", import.meta.url), "utf8");
  for (const text of ["Ask AI", "A read-only copy of your book. Nothing is sent to us.", "Preview of your copy", "Share to AI app", "Copy for AI", "Paste into ChatGPT or Claude and ask: Where am I overspending?", "Download AI copy", "Only share with an app you trust."]) assert.ok(sheet.includes(text), text);
  assert.match(sheet, /<dialog[^>]+aria-labelledby="ask-ai-title"/);
  assert.match(sheet, /<textarea[^>]+readOnly value=\{pack\}/);
  assert.match(sheet, /role="status"/);
  assert.match(app, /setAiPack\(buildAiReadyPack\(budget\)\)/);
  assert.doesNotMatch(sheet, /MCP|JSON|canonical|schema|headroom|DAG|API/);
});
