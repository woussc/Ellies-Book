import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  advanceExpense,
  blankBudget,
  csvText,
  editCategory,
  editBudgetDetails,
  editExpense,
  exampleBudget,
  legacyBackup,
  parseBook,
  persistBudget,
  readStoredBudget,
  reportText,
  removeExpense,
  serializeBook,
  totals,
} from "../app/book/model.mjs";

test("correcting Coffee updates every money projection and preserves the original in the book", () => {
  const b = blankBudget("Team");
  b.total = 2000;
  b.categories[0].amount = 1500;
  b.expenses = [
    { id: "other", categoryId: "category-0", description: "Other payments", amount: 1131.13, status: "paid", history: ["paid"], date: "2026-11-01" },
    { id: "coffee", categoryId: "category-0", description: "Coffee", amount: 12.34, status: "paid", history: ["planned", "committed", "paid"], date: "2026-11-19" },
  ];
  assert.equal(totals(b).spent, 1143.47);
  const corrected = editExpense(b, "coffee", { amount: 2.34 });
  assert.equal(totals(corrected).spent, 1133.47);
  assert.equal(totals(corrected).committed, 0);
  assert.equal(totals(corrected).left, 866.53);
  assert.equal(totals(corrected, "category-0").spent, 1133.47);
  assert.match(reportText(corrected), /We've paid \$1,133\.47/);
  assert.match(csvText(corrected), /"People","1500","1133.47","0","366.53"/);
  const restored = parseBook(serializeBook(corrected));
  assert.deepEqual(restored, corrected);
  assert.deepEqual(restored.events.at(-1).before, b.expenses[1]);
  assert.deepEqual(restored.events.at(-1).after, corrected.expenses[1]);
  assert.match(restored.events.at(-1).text, /Coffee.*\$12\.34 → \$2\.34/);
  assert.equal(b.expenses[1].amount, 12.34);
  assert.equal(editExpense(corrected, "coffee", { amount: 2.34 }), corrected);
});

test("an unpaid invoice is a commitment, not actual spent", () => {
  const b = blankBudget();
  b.total = 1000;
  b.categories[0].amount = 500;
  b.expenses.push({
    id: "invoice",
    categoryId: b.categories[0].id,
    description: "Internet",
    amount: 85,
    status: "committed",
    history: ["committed"],
  });
  assert.deepEqual(totals(b), {
    plan: 500,
    spent: 0,
    committed: 85,
    left: 915,
    forecast: 500,
  });
  const paid = advanceExpense(b, "invoice");
  assert.deepEqual(totals(paid), {
    plan: 500,
    spent: 85,
    committed: 0,
    left: 915,
    forecast: 500,
  });
  assert.equal(totals(paid, b.categories[0].id).left, 415);
  assert.equal(advanceExpense(paid, "invoice").expenses[0].history.length, 2);
});

test("status and category corrections replace exposure without double counting previous payments", () => {
  const b = exampleBudget();
  let edited = editExpense(b, "shop", { description: "Office groceries", categoryId: "category-4", date: "2026-11-18", status: "committed" });
  assert.equal(totals(edited).spent, 1600);
  assert.equal(totals(edited).committed, 191.5);
  assert.equal(totals(edited).left, 3208.5);
  assert.equal(totals(edited, "category-1").spent, 0);
  assert.equal(totals(edited, "category-4").committed, 126.5);
  assert.match(edited.events.at(-1).text, /Food & groceries → A little extra/);
  assert.match(edited.events.at(-1).text, /paid → committed/);
  assert.deepEqual(edited.expenses.find((e) => e.id === "shop").history, ["committed"]);
  edited = advanceExpense(edited, "shop");
  assert.equal(totals(edited).spent, 1726.5);
  assert.equal(totals(edited).committed, 65);
  edited = editExpense(edited, "shop", { status: "planned" });
  assert.equal(totals(edited).spent, 1600);
  assert.equal(totals(edited).committed, 65);
  assert.equal(totals(edited).left, 3335);
  assert.equal(parseBook(serializeBook(edited)).events[0].before.status, "paid");
});

test("removal excludes spending from projections but keeps a complete, persistent audit record", () => {
  const b = exampleBudget();
  for (const [id, spent, committed, left] of [
    ["shop", 1600, 65, 3335],
    ["internet", 1726.5, 0, 3273.5],
    ["weekend", 1726.5, 65, 3208.5],
  ]) {
    const removed = removeExpense(b, id);
    assert.equal(removed.expenses.some((e) => e.id === id), false);
    assert.equal(b.expenses.length, 4);
    assert.equal(totals(removed).spent, spent);
    assert.equal(totals(removed).committed, committed);
    assert.equal(totals(removed).left, left);
    const restored = parseBook(serializeBook(removed));
    assert.deepEqual(restored.events.at(-1).before, b.expenses.find((e) => e.id === id));
    assert.equal(restored.events.at(-1).after, null);
    assert.match(restored.events.at(-1).text, /Removed.*Kept in the audit trail/);
    assert.equal(removeExpense(removed, id), removed);
  }
  const removed = removeExpense(b, "shop");
  assert.match(reportText(removed), /We've paid \$1,600/);
  assert.match(csvText(removed), /"Food & groceries","900","0","0","900"/);
});

test("invalid corrections cannot replace a valid book or rewrite immutable entry identity", () => {
  const b = exampleBudget();
  for (const patch of [
    { amount: -1 }, { amount: 0 }, { amount: NaN }, { amount: 1e10 },
    { amount: 0.001 }, { categoryId: "missing" }, { status: "unknown" },
    { description: "   " }, { date: "not-a-date" },
  ]) assert.throws(() => editExpense(b, "shop", patch));
  assert.equal(editExpense(b, "shop", { id: "rewritten", history: ["planned"] }), b);
  assert.equal(editExpense(b, "missing", { amount: 1 }), b);
  assert.equal(b.events.length, 0);
});
test("planned -> committed -> paid keeps one exposure and an auditable trail", () => {
  const b = blankBudget();
  b.total = 100;
  b.categories[0].amount = 100;
  b.expenses.push({
    id: "idea",
    categoryId: b.categories[0].id,
    description: "Dinner",
    amount: 40,
    status: "planned",
    history: ["planned"],
  });
  assert.equal(totals(b).left, 100);
  const committed = advanceExpense(b, "idea");
  assert.equal(totals(committed).committed, 40);
  const paid = advanceExpense(committed, "idea");
  assert.equal(totals(paid).spent, 40);
  assert.equal(totals(paid).committed, 0);
  assert.equal(totals(paid).left, 60);
  assert.deepEqual(paid.expenses[0].history, ["planned", "committed", "paid"]);
});
test("fresh budgets have no sample and examples never contaminate a fresh start", () => {
  const demo = exampleBudget();
  assert.equal(demo.sample, true);
  assert.equal(totals(demo).spent, 1726.5);
  assert.equal(totals(demo).committed, 65);
  assert.equal(totals(demo).left, 3208.5);
  const empty = blankBudget("Team");
  assert.equal(empty.sample, false);
  assert.equal(empty.expenses.length, 0);
  assert.equal(totals(empty).plan, 0);
});
test("saved Markdown, notes, report and finance export preserve the same numbers", () => {
  const b = exampleBudget();
  b.notes = "## Keep this\nA decision about [[Home & bills]].";
  const restored = JSON.parse(JSON.stringify(b));
  assert.equal(restored.notes, b.notes);
  assert.match(reportText(restored), /\$1,726\.50/);
  assert.match(reportText(restored), /\$65/);
  assert.match(reportText(restored), /Keep this/);
  assert.match(csvText(restored), /"Home & bills","2000","1600","65","335"/);
  b.categories[0].name = "=danger";
  assert.match(csvText(b), /"'=danger"/);
  b.categories[0].glCode = "001230";
  assert.match(csvText(b), /"'001230"/);
});
test("exploring and removing an example preserves the personal budget across refresh", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  const personal = blankBudget();
  personal.name = "My real budget";
  personal.notes = "Keep my real note";
  personal.total = 750;
  persistBudget(storage, personal);
  persistBudget(storage, exampleBudget());
  assert.equal(readStoredBudget(storage).sample, true);
  assert.deepEqual(readStoredBudget(storage, false), personal);
  persistBudget(storage, readStoredBudget(storage, false));
  assert.deepEqual(readStoredBudget(storage), personal);
});
test("Markdown preserves real newlines without interpreting literal backslash-n input", () => {
  const book = blankBudget();
  for (const notes of ["# Home repairs\nKeep this edit.", "# Home repairs\\nKeep this edit."]) {
    book.notes = notes;
    const markdown = serializeBook(book);
    assert.ok(markdown.endsWith(notes));
    assert.equal(parseBook(markdown).notes, notes);
  }
});
test("finance CSV keeps negative numeric shortfalls numeric but neutralizes authored formulas", () => {
  const b = blankBudget();
  b.total = 100;
  b.categories[0] = { ...b.categories[0], name: "=SUM(A1)", amount: 100, owner: "-2+3", glCode: "001230" };
  b.expenses = [{ id: "overspend", categoryId: b.categories[0].id, description: "Invoice", amount: 125, status: "paid", history: ["paid"] }];
  assert.equal(totals(b, b.categories[0].id).left, -25);
  assert.match(csvText(b), /"'=SUM\(A1\)","100","125","0","-25","'-2\+3","'001230"/);
  assert.doesNotMatch(csvText(b), /"'-25"/);
});
test("category changes preserve before/after values in the audit trail", () => {
  const b = exampleBudget();
  const id = b.categories[0].id;
  const edited = editCategory(b, id, { amount: 2100, glCode: "001230" });
  assert.equal(edited.categories[0].amount, 2100);
  assert.equal(b.categories[0].amount, 2000);
  assert.equal(edited.events.at(-1).before.amount, 2000);
  assert.equal(edited.events.at(-1).after.amount, 2100);
  assert.match(edited.events.at(-1).text, /2000 → 2100/);
  assert.match(edited.events.at(-1).text, /001230/);
  assert.equal(editCategory(edited, id, { amount: 2100 }), edited);
});
test("saved activity survives a storage reload, further edits and Markdown restore", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  const created = editBudgetDetails(blankBudget(), {
    name: "Family cents", total: 1000.55, profile: "Household", period: "November 2026",
  });
  const id = created.categories[0].id;
  const edited = editCategory(created, id, { amount: 600.25 });
  persistBudget(storage, edited);
  const refreshed = readStoredBudget(storage);
  assert.equal(refreshed.events.length, 2);
  assert.deepEqual(refreshed.events, edited.events);
  assert.equal(refreshed.events[1].before.amount, 0);
  assert.equal(refreshed.events[1].after.amount, 600.25);
  const next = editCategory(refreshed, id, { amount: 700 });
  persistBudget(storage, next);
  const restored = parseBook(serializeBook(readStoredBudget(storage)));
  assert.equal(restored.events.length, 3);
  assert.deepEqual(restored.events.slice(0, 2), edited.events);
  assert.deepEqual(restored.events[2], next.events[2]);
});
test("budget detail edits retain prior funding and descriptive values after a Markdown round trip", () => {
  const original = { ...blankBudget(), created: true, name: "December", total: 1200, period: "December 2026" };
  const updated = editBudgetDetails(original, { name: "Holiday", total: 1500, profile: "Team", period: "January 2027" });
  assert.equal(original.total, 1200);
  assert.equal(updated.total, 1500);
  const event = parseBook(serializeBook(updated)).events.at(-1);
  assert.deepEqual(event.before, { name: "December", total: 1200, profile: "Household", period: "December 2026" });
  assert.deepEqual(event.after, { name: "Holiday", total: 1500, profile: "Team", period: "January 2027" });
  assert.match(event.text, /Budget total: \$1,200\.00 → \$1,500\.00/);
  assert.match(event.text, /Name: December → Holiday/);
  assert.match(event.text, /Period: December 2026 → January 2027/);
  assert.match(event.text, /Profile: Household → Team/);
  assert.equal(editBudgetDetails(updated, event.after), updated);
  const fresh = blankBudget();
  const created = editBudgetDetails(fresh, { name: "Team book", total: 100, profile: "Team", period: "May 2027" });
  assert.equal(created.created, true);
  assert.equal(created.categories[0].name, "People");
  assert.match(created.events.at(-1).text, /Created and confirmed budget/);
});
test("an example saved by the earlier preview never becomes a personal budget", () => {
  const map = new Map([
    ["ellies-book:look-a:v1", JSON.stringify(exampleBudget())],
  ]);
  const storage = {
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  // The old single-key preview could store an example in the personal slot.
  const personal = readStoredBudget(storage, false);
  assert.equal(personal.sample, false);
  assert.equal(personal.created, false);
  assert.equal(personal.expenses.length, 0);
  assert.equal(personal.notes, "");
  persistBudget(storage, personal);
  assert.equal(readStoredBudget(storage).sample, false);
});
test("spending date uses the local day rather than the UTC day", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { localDate } from './app/book/model.mjs'; console.log(localDate(new Date('2026-11-19T01:00:00Z')));`,
    ],
    { env: { ...process.env, TZ: "America/Los_Angeles" }, encoding: "utf8" },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "2026-11-18");
});

test("the authoritative stored book is Markdown and round-trips raw notes and finance codes", () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
  const b = exampleBudget();
  b.sample = false;
  b.notes = "\n---\n# Keep **this**\n[[Home & bills]]\n\n";
  b.categories[0].glCode = "001230";
  persistBudget(storage, b);
  const raw = [...map.values()][0];
  assert.match(raw, /^---\nschema: ellies-book\/v1\n/);
  assert.ok(raw.endsWith(b.notes));
  assert.deepEqual(readStoredBudget(storage), b);
});

test("malformed personal storage is never silently replaced with a fresh book", () => {
  const storage = {
    getItem: (key) => (key === "ellies-book:book:v1.md" ? "broken book" : null),
  };
  assert.throws(() => readStoredBudget(storage), /backup|read|format/i);
});

test("the server storage adapter imports without request-scoped randomness", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
    Object.defineProperty(globalThis, 'crypto', { value: { randomUUID() { throw new Error('randomness outside request'); } } });
    await import('./app/book/use-book.ts');
  `], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("restore rejects duplicate records, orphan spending and invalid lifecycle history", () => {
  const b = exampleBudget();
  for (const corrupt of [
    { ...b, categories: [b.categories[0], b.categories[0]] },
    { ...b, expenses: [b.expenses[0], b.expenses[0]] },
    { ...b, expenses: [{ ...b.expenses[0], categoryId: "missing" }] },
    { ...b, expenses: [{ ...b.expenses[0], history: ["paid", "committed", "paid"] }] },
    { ...b, expenses: [{ ...b.expenses[0], history: ["committed"] }] },
    { ...b, categories: [{ ...b.categories[0], amount: -1 }] },
  ]) {
    const { notes, ...data } = corrupt;
    assert.throws(() => parseBook(`---\nschema: ellies-book/v1\ndata: ${JSON.stringify(data)}\n---\n${notes}`));
  }
  assert.deepEqual(parseBook(serializeBook(b)), b);
});

test("storage errors surface and legacy data is downloadable without being rewritten", () => {
  const raw = '{"projects":["keep exactly"]}';
  const map = new Map([["function-budget-studio-v1-4-working", raw]]);
  const storage = { getItem: (key) => map.get(key), setItem: () => { throw new Error("QuotaExceededError"); } };
  const backup = JSON.parse(legacyBackup(storage));
  assert.equal(backup["function-budget-studio-v1-4-working"], raw);
  assert.throws(() => persistBudget(storage, exampleBudget()), /QuotaExceededError/);
  assert.equal(map.get("function-budget-studio-v1-4-working"), raw);
});

test("exploring an example cannot replace the only copy of unsaved personal edits", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { useBook } from './app/book/use-book.ts';
    import { blankBudget, exampleBudget, STORAGE_KEY, SAMPLE_STORAGE_KEY } from './app/book/model.mjs';
    import { activeBudget, parseLibrary, LIBRARY_KEY } from './app/book/library-model.mjs';
    const map = new Map();
    let failWrites = false;
    globalThis.localStorage = {
      getItem: key => map.get(key) ?? null,
      setItem(key, value) { if (failWrites) throw new Error('QuotaExceededError'); map.set(key, value); },
      removeItem: key => map.delete(key),
    };
    let book;
    renderToStaticMarkup(createElement(function Probe() { book = useBook(); return null; }));
    const personal = { ...blankBudget(), created: true, name: 'My book', notes: 'Original note' };
    assert.equal(book.setBudget(personal), true);
    failWrites = true;
    const unsaved = { ...personal, notes: '# Keep the unsaved decision', categories: personal.categories.map((c, i) => i ? c : { ...c, amount: 900 }) };
    assert.equal(book.setBudget(unsaved), false);
    assert.equal(book.setBudget(exampleBudget()), false);
    let retained;
    book.setBudget(budget => { retained = budget; return budget; });
    assert.deepEqual(retained, unsaved, 'The downloadable in-memory book must retain every unsaved edit');
    assert.equal(activeBudget(parseLibrary(map.get(LIBRARY_KEY))).notes, 'Original note');
    assert.equal(map.has(STORAGE_KEY), false, 'The legacy single-book key is not rewritten');
    assert.equal(map.has(SAMPLE_STORAGE_KEY), false);
    failWrites = false;
    assert.equal(book.setBudget(retained), true);
    assert.equal(book.setBudget(exampleBudget()), true);
    book.removeExample();
    assert.deepEqual(activeBudget(parseLibrary(map.get(LIBRARY_KEY))), unsaved);
  `], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("a stale project editor cannot write into a selected restored copy", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { useBook } from './app/book/use-book.ts';
    import { exampleBudget, editExpense } from './app/book/model.mjs';
    import { activeBudget, parseLibrary, LIBRARY_KEY } from './app/book/library-model.mjs';
    const map = new Map();
    globalThis.localStorage = {getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value)};
    let book;
    renderToStaticMarkup(createElement(function Probe() {book = useBook(); return null;}));
    const original = {...exampleBudget(), sample: false, id: 'original'};
    book.setBudget(original);
    const copy = {...structuredClone(original), id: 'restored-copy'};
    book.libraryAction({type: 'book', name: 'Restored', project: copy});
    const before = map.get(LIBRARY_KEY);
    assert.equal(book.setBudget(budget => editExpense(budget, original.expenses[0].id, {amount: 999}), original.id), false);
    assert.equal(map.get(LIBRARY_KEY), before, 'A stale editor cannot modify either project');
    assert.deepEqual(activeBudget(parseLibrary(before)), copy);
  `], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});

test("an active example can be reopened without treating a new example as an update", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import {createElement} from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {useBook} from './app/book/use-book.ts';
    import {exampleBudget} from './app/book/model.mjs';
    import {activeBudget, parseLibrary, LIBRARY_KEY} from './app/book/library-model.mjs';
    const map = new Map();
    globalThis.localStorage = {getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value)};
    let book;
    renderToStaticMarkup(createElement(function Probe() {book = useBook(); return null;}));
    assert.equal(book.setBudget(exampleBudget()), true);
    const first = activeBudget(parseLibrary(map.get(LIBRARY_KEY)));
    assert.equal(book.setBudget(exampleBudget()), true);
    assert.equal(activeBudget(parseLibrary(map.get(LIBRARY_KEY))).sample, true);
    const selected = activeBudget(parseLibrary(map.get(LIBRARY_KEY)));
    assert.notEqual(selected.id, first.id);
    assert.equal(book.setBudget({...selected, notes: 'A sample edit'}), true);
    assert.equal(activeBudget(parseLibrary(map.get(LIBRARY_KEY))).notes, 'A sample edit');
  `], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});

test("unconfirmed ideas affect forecast but never approved headroom or paid spend", () => {
  const b = blankBudget();
  b.total = 1000;
  b.categories[0].amount = 100;
  b.expenses = [{ id: "idea", categoryId: b.categories[0].id, amount: 200, status: "planned", history: ["planned"] }];
  assert.deepEqual(totals(b), { plan: 100, spent: 0, committed: 0, left: 1000, forecast: 200 });
});

test("board view metadata is validated without changing the Markdown or money contracts", () => {
  const b = exampleBudget();
  b.board = { order: ["paid", "budget", "committed", "notes"], sizes: { paid: "wide" }, expanded: ["rent"], nodeOrder: ["rent"] };
  assert.deepEqual(parseBook(serializeBook(b)), b);
  assert.deepEqual(totals(b), totals(exampleBudget()));
  for (const board of [null, { ...b.board, order: ["paid", "paid"] }, { ...b.board, sizes: { paid: "enormous" } }, { ...b.board, expanded: [123] }]) {
    assert.throws(() => serializeBook({ ...b, board }), /board/i);
  }
});
