import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Ask AI leads with a friendly summary and keeps the exact copy collapsed", () => {
  const sheet = readFileSync(new URL("../app/book/ask-ai-sheet.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app/book/budget-app.tsx", import.meta.url), "utf8");
  for (const text of ["Ask AI", "A read-only copy of your book. Nothing is sent to us.", "What gets shared", "Budget totals", "Your notes", "Notes (none added yet)", "Try asking", "Where am I overspending?", "What’s left for the rest of the month?", "Write a short update for my partner.", "Share to AI app", "Copy for AI", "Download AI copy", "Only share with an app you trust.", "See exactly what’s shared"]) assert.ok(sheet.includes(text), text);
  assert.match(sheet, /book\.categories\.length/);
  assert.match(sheet, /book\.expenses\.length/);
  assert.match(sheet, /book\.notes\.trim\(\)/);
  assert.match(sheet, /<details className="ai-exact-copy">/);
  assert.ok(sheet.indexOf("What gets shared") < sheet.indexOf("Try asking"));
  assert.ok(sheet.indexOf("Try asking") < sheet.indexOf('<div className="ai-sheet-actions">'));
  assert.ok(sheet.indexOf('<div className="ai-sheet-actions">') < sheet.indexOf('<details'));
  assert.match(sheet, /<dialog[^>]+aria-labelledby="ask-ai-title"/);
  assert.match(sheet, /<textarea[^>]+readOnly value=\{pack\}/);
  assert.match(sheet, /role="status"/);
  assert.match(app, /setAiPack\(buildAiReadyPack\(budget\)\)/);
  assert.doesNotMatch(sheet, /MCP|JSON|canonical|schema|headroom|DAG|API/);
});
