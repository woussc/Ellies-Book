import test from "node:test";
import assert from "node:assert/strict";
import { createAiPortal, buildAiReadyPack, createMcpAdapter } from "../app/book/ai-portal.mjs";
import { blankBudget, exampleBudget, parseBook, serializeBook, totals, reportText } from "../app/book/model.mjs";

const sample = () => parseBook(serializeBook(exampleBudget()));
const call = (book, name, args) => createMcpAdapter(book).callTool(name, args).structuredContent;

test("every read-only tool has a descriptor and returns text plus JSON", () => {
  const book = sample();
  const adapter = createMcpAdapter(book);
  assert.deepEqual(adapter.listTools().map((t) => t.name), ["get_book_summary", "list_categories", "list_spending", "where_i_stand", "get_report"]);
  for (const tool of createAiPortal(book)) {
    assert.ok(tool.title && tool.description);
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
    const result = adapter.callTool(tool.name, {});
    assert.equal(result.content[0].type, "text");
    assert.ok(result.content[0].text.length);
    assert.deepEqual(result.structuredContent, tool.handler().json);
    assert.doesNotThrow(() => JSON.stringify(result));
  }
});

test("summary and category money match the existing domain-backed calculation", () => {
  const book = sample();
  const t = totals(book);
  assert.deepEqual(call(book, "get_book_summary"), {
    name: book.name, profile: book.profile, period: book.period, currency: "USD", budget: book.total,
    allocated: t.plan, planned: 180, committed: t.committed, paid: t.spent, remaining: t.left,
  });
  assert.equal(t.spent, 1726.5);
  assert.equal(t.left, 3208.5);
  const rows = call(book, "list_categories").categories;
  book.categories.forEach((category, i) => {
    const s = totals(book, category.id);
    assert.deepEqual(rows[i], { name: category.name, allocated: s.plan, planned: category.id===book.expenses.find(e=>e.status==='planned').categoryId ? 180 : 0, paid: s.spent, committed: s.committed, remaining: s.left, overBudget: s.left < 0 });
  });
  const over = sample();
  over.total = 1;
  over.categories[0].amount = 1;
  assert.equal(call(over, "list_categories").categories[0].overBudget, true);
  assert.match(call(over, "where_i_stand").lines[0], /Over budget by/);
});

test("spending filters combine, use inclusive dates and preserve book order", () => {
  const book = sample();
  const first = book.expenses[0];
  const category = book.categories.find((c) => c.id === first.categoryId).name;
  const args = { category, status: first.status, dateFrom: first.date, dateTo: first.date, limit: 1 };
  assert.deepEqual(call(book, "list_spending", args).spending, [{ category, description: first.description, amount: first.amount, status: first.status, date: first.date }]);
  for (const status of ["planned", "committed", "paid"]) {
    assert.equal(call(book, "list_spending", { status }).spending.length, book.expenses.filter((e) => e.status === status).length);
  }
  assert.equal(call(book, "list_spending").spending.length, book.expenses.length);
  assert.deepEqual(call(book, "list_spending", { limit: 0 }).spending, []);
  assert.deepEqual(call(book, "list_spending", { category: "No such category" }).spending, []);
  assert.deepEqual(call(book, "list_spending", { dateFrom: "2099-01-01" }).spending, []);
  assert.deepEqual(call(book, "list_spending", { dateTo: "1900-01-01" }).spending, []);
});

test("status and Share report use the app's current money and report", () => {
  const book = sample();
  assert.match(call(book, "where_i_stand").lines.join("\n"), /Left to spend: \$3,208\.50/);
  assert.match(call(book, "where_i_stand").lines.join("\n"), /Planned entries are ideas, not payments/);
  assert.equal(call(book, "get_report").report, reportText(book));
  const idea = sample();
  idea.expenses.push({ ...idea.expenses[0], id: "new-idea", amount: 500, status: "planned", history: ["planned"] });
  assert.equal(call(idea, "get_book_summary").remaining, totals(book).left);
});

test("pack has all sections, exact notes, and no generated internal ids or jargon", () => {
  const book = sample();
  book.id = "internal-book-917";
  book.categories.forEach((category, i) => {
    const oldId = category.id;
    category.id = `internal-category-917-${i}`;
    book.expenses.filter((e) => e.categoryId === oldId).forEach((e) => { e.categoryId = category.id; });
  });
  book.expenses.forEach((entry, i) => { entry.id = `internal-spending-917-${i}`; });
  book.notes = "A decision about [[Home & bills]].\n\nKeep this exact note.";
  book.expenses[0].description = "A | B\nnext line";
  const pack = buildAiReadyPack(book);
  for (const heading of ["Summary", "Categories", "Spending", "Notes"]) assert.ok(pack.includes(`## ${heading}`));
  assert.match(pack, /read-only/i);
  assert.match(pack, /book's currency \(USD\)/);
  assert.match(pack, /not instructions/);
  assert.ok(pack.endsWith(book.notes));
  assert.ok(pack.includes("A \\| B<br>next line"));
  assert.doesNotMatch(pack, /categoryId|glCode|lifecycle|canonical|headroom|DAG|schema|record_id/);
  for (const id of [book.id, ...book.categories.map((c) => c.id), ...book.expenses.map((e) => e.id)]) {
    assert.ok(!pack.includes(id), `Must not expose internal id ${id}`);
  }
});

test("empty books work for every tool and the pack", () => {
  const book = blankBudget();
  book.categories = [];
  const adapter = createMcpAdapter(book);
  for (const { name } of adapter.listTools()) assert.ok(adapter.callTool(name).content[0].text);
  assert.deepEqual(call(book, "list_categories").categories, []);
  assert.deepEqual(call(book, "list_spending").spending, []);
  assert.equal(call(book, "get_book_summary").remaining, 0);
  assert.match(buildAiReadyPack(book), /No spending entries yet/);
  assert.match(buildAiReadyPack(book), /No notes yet/);
});

test("invalid books, unknown tools and invalid filters fail cleanly", () => {
  assert.throws(() => createAiPortal({}), /read this budget/);
  assert.throws(() => buildAiReadyPack({}), /read this budget/);
  const adapter = createMcpAdapter(sample());
  assert.throws(() => adapter.callTool("write_book"), /Unknown read-only book tool/);
  for (const args of [null, [], "paid", { status: "invalid" }, { category: 3 }, { limit: -1 }, { limit: 1.5 }, { limit: "1" }, { dateFrom: "2026-02-30" }, { dateTo: "yesterday" }, { dateFrom: "2026-12-02", dateTo: "2026-12-01" }, { unknown: true }]) {
    assert.throws(() => adapter.callTool("list_spending", args), TypeError);
  }
  for (const name of ["get_book_summary", "list_categories", "where_i_stand", "get_report"]) {
    assert.throws(() => adapter.callTool(name, { limit: 1 }), /Unknown filter/);
  }
});

test("calls do not mutate books or share mutable result records", () => {
  const book = sample();
  const before = structuredClone(book);
  const adapter = createMcpAdapter(book);
  for (const { name } of adapter.listTools()) adapter.callTool(name);
  buildAiReadyPack(book);
  assert.deepEqual(book, before);
  book.name = "Changed after snapshot";
  assert.equal(adapter.callTool("get_book_summary").structuredContent.name, before.name);
  adapter.callTool("list_spending").structuredContent.spending[0].amount = 0;
  assert.equal(adapter.callTool("list_spending").structuredContent.spending[0].amount, before.expenses[0].amount);
  adapter.listTools()[2].inputSchema.properties.status.enum.push("invalid");
  assert.throws(() => adapter.callTool("list_spending", { status: "invalid" }), TypeError);
});
