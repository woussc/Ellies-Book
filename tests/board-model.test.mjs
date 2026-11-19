import test from "node:test";
import assert from "node:assert/strict";
import { exampleBudget, totals, serializeBook, parseBook } from "../app/book/model.mjs";
import { boardLayout, changeBoard, noteConnections, orderedNodes } from "../app/book/board-model.mjs";

test("shuffling, resizing and opening nodes are view-only and survive a Markdown backup", () => {
  const original = exampleBudget();
  let b = changeBoard(original, { type: "move", id: "paid", before: "budget" });
  b = changeBoard(b, { type: "size", id: "paid", size: "wide" });
  b = changeBoard(b, { type: "expand", id: "rent" });
  b = changeBoard(b, { type: "node", id: "shop", before: "rent" });
  assert.deepEqual(boardLayout(b).order, ["paid", "budget", "committed", "notes"]);
  assert.equal(boardLayout(b).sizes.paid, "wide");
  assert.deepEqual(boardLayout(b).expanded, ["rent"]);
  assert.deepEqual(orderedNodes(b.expenses.filter(e => e.status === "paid"), b.board).map(e => e.id), ["shop", "rent"]);
  assert.deepEqual(totals(b), totals(original));
  assert.deepEqual(b.expenses, original.expenses);
  assert.deepEqual(b.events, original.events);
  assert.deepEqual(parseBook(serializeBook(b)), b);
  assert.equal(original.board, undefined);
  assert.equal(changeBoard(b, { type: "move", id: "paid", before: "unknown" }), b);
  assert.deepEqual(boardLayout(changeBoard(b, { type: "reset" })), boardLayout(original));
});

test("Markdown backlinks resolve names and immutable ids; YAML and inline tags remain note metadata", () => {
  const b = exampleBudget();
  b.notes = '---\ntags: [home, review]\n---\n[[Home & bills]] [[rent|Rent]] [[not here]] #weekend';
  const links = noteConnections(b);
  assert.deepEqual(links.resolved.map(l => l.id), ["category-0", "rent"]);
  assert.deepEqual(links.unresolved, ["not here"]);
  assert.deepEqual(links.tags.sort(), ["home", "review", "weekend"]);
});

test("a card can move after the last card without changing money", () => {
  const b = exampleBudget();
  const moved = changeBoard(b, { type: "move", id: "budget", before: null });
  assert.deepEqual(boardLayout(moved).order, ["committed", "paid", "notes", "budget"]);
  assert.deepEqual(totals(moved), totals(b));
});
