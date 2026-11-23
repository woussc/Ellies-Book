import test from "node:test";
import assert from "node:assert/strict";
import {
  blankBudget,
  totals,
  serializeBook,
  parseBook,
} from "../app/book/model.mjs";
import {
  emptyLibrary,
  changeLibrary,
  serializeLibrary,
  parseLibrary,
  restoreLibrary,
} from "../app/book/library-model.mjs";
import {
  applyStatement,
  reviewStatement,
  undoStatement,
} from "../app/book/statement-model.mjs";
import { saveRepeatingEntry, openPeriod } from "../app/book/repeat-model.mjs";
const setup = (profile = "Household") => {
  const b = {
    ...blankBudget(profile),
    id: "project",
    created: true,
    total: 1000,
    period: "2026-11",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    categories: [
      { id: "bills", name: "Bills", amount: 1000, owner: "", glCode: "" },
    ],
    expenses: [],
  };
  return changeLibrary(emptyLibrary(), {
    type: "book",
    name: "Home",
    project: b,
  });
};
const project = (l) => l.books[0].projects[0];
const row = (patch = {}) => ({
  id: "row-1",
  sourceId: "a".repeat(64) + ":1",
  date: "2026-11-05",
  description: "CITY ENERGY",
  amount: 86,
  currency: "USD",
  direction: "out",
  checked: true,
  categoryId: "bills",
  decision: "new",
  ...patch,
});
const request = (rows = [row()], patch = {}) => ({
  id: "batch-1",
  projectId: "project",
  period: "2026-11",
  account: { id: "checking", label: "Joint checking" },
  rows,
  ...patch,
});
test("review is inert; an import adds Paid exactly once and survives Markdown restore", () => {
  const l = setup(),
    before = serializeLibrary(l);
  assert.equal(reviewStatement(l, request())[0].state, "ready");
  assert.equal(serializeLibrary(l), before);
  const next = applyStatement(l, request());
  assert.equal(project(next).expenses.length, 1);
  assert.equal(totals(project(next)).spent, 86);
  assert.equal(totals(project(next)).left, 914);
  assert.deepEqual(applyStatement(next, request()), next);
  const restored = parseLibrary(serializeLibrary(next));
  assert.equal(
    reviewStatement(restored, request([row()], { id: "second" }))[0].state,
    "already",
  );
  assert.deepEqual(parseBook(serializeBook(project(next))), project(next));
});
for (const mode of ["Household", "Just me", "Team"])
  test(`${mode}: matching open bills pays only those entries; undo restores notes and money`, () => {
    let l = setup(mode),
      b = project(l);
    b.expenses = [
      {
        id: "electric",
        categoryId: "bills",
        description: "Electric bill",
        amount: 86,
        status: "committed",
        history: ["planned", "committed"],
        date: "2026-11-04",
        notes: "Keep [[receipt]]",
      },
      {
        id: "internet",
        categoryId: "bills",
        description: "Internet",
        amount: 45,
        status: "planned",
        history: ["planned"],
        date: "2026-11-06",
        notes: "Future bill",
      },
    ];
    const before = totals(b),
      req = request([
        row({
          decision: "match",
          matchId: "electric",
          matchProjectId: b.id,
          matchPeriod: b.period,
        }),
        row({
          id: "2",
          sourceId: "b".repeat(64) + ":2",
          description: "INTERNET",
          amount: 45,
          date: "2026-11-06",
          decision: "match",
          matchId: "internet",
          matchProjectId: b.id,
          matchPeriod: b.period,
        }),
      ]);
    const next = applyStatement(l, req),
      paid = project(next);
    assert.equal(paid.expenses.length, 2);
    assert.equal(paid.expenses[0].notes, "Keep [[receipt]]");
    assert.deepEqual(paid.expenses[0].history, [
      "planned",
      "committed",
      "paid",
    ]);
    assert.equal(totals(paid).left, before.left - 45);
    assert.equal(totals(paid).forecast, before.forecast);
    assert.equal(paid.total, 1000);
    const undone = undoStatement(
      parseLibrary(serializeLibrary(next)),
      b.id,
      req.id,
    );
    assert.deepEqual(project(undone).expenses, b.expenses);
    assert.deepEqual(totals(project(undone)), before);
    assert.equal(
      project(applyStatement(undone, { ...req, id: "again" })).expenses.length,
      2,
    );
  });
test("cross-format likely matches require an explicit Paid link; duplicates never create another expense", () => {
  const first = applyStatement(setup(), request()),
    existing = project(first).expenses[0];
  const other = row({ sourceId: "f".repeat(64) + ":9" }),
    req = request([other], { id: "pdf" });
  assert.equal(reviewStatement(first, req)[0].state, "needs");
  assert.throws(() => applyStatement(first, req), /look/);
  const linked = applyStatement(
    first,
    request(
      [
        {
          ...other,
          decision: "link",
          matchId: existing.id,
          matchProjectId: "project",
          matchPeriod: "2026-11",
        },
      ],
      { id: "pdf" },
    ),
  );
  assert.equal(project(linked).expenses.length, 1);
  assert.throws(
    () => undoStatement(linked, "project", "batch-1"),
    /later import/,
  );
  assert.equal(
    reviewStatement(
      parseLibrary(serializeLibrary(linked)),
      request([other], { id: "again" }),
    )[0].state,
    "already",
  );
});

test("a latest cross-format Paid-link batch can undo, then the original import can undo", () => {
  const initial = setup(),
    first = applyStatement(initial, request()),
    entry = project(first).expenses[0];
  const linked = applyStatement(
    first,
    request(
      [
        row({
          sourceId: "f".repeat(64) + ":9",
          decision: "link",
          matchId: entry.id,
          matchProjectId: "project",
          matchPeriod: "2026-11",
        }),
      ],
      { id: "pdf" },
    ),
  );
  const unlink = undoStatement(
    parseLibrary(serializeLibrary(linked)),
    "project",
    "pdf",
  );
  assert.deepEqual(project(unlink).expenses, project(first).expenses);
  assert.equal(
    reviewStatement(
      unlink,
      request([row({ sourceId: "f".repeat(64) + ":9" })], { id: "again" }),
    )[0].state,
    "needs",
  );
  assert.deepEqual(
    project(undoStatement(unlink, "project", "batch-1")).expenses,
    project(initial).expenses,
  );
});

test("restoring an imported backup alongside its original remaps references to the restored project", () => {
  const original = applyStatement(setup(), request()),
    restored = restoreLibrary(original, serializeLibrary(original));
  const id = restored.activeProjectId;
  assert.notEqual(id, "project");
  const undone = undoStatement(restored, id, "batch-1");
  assert.equal(undone.books.at(-1).projects[0].expenses.length, 0);
  assert.equal(undone.books[0].projects[0].expenses.length, 1);
});
test("overlapping images and identical real purchases need a same-payment/separate choice", () => {
  const l = setup(),
    a = row(),
    b = row({ id: "two", sourceId: "b".repeat(64) + ":1" }),
    req = request([a, b]);
  assert.ok(reviewStatement(l, req).every((r) => r.state === "needs"));
  assert.throws(() => applyStatement(l, req));
  const next = applyStatement(
    l,
    request([
      { ...a, separate: true },
      { ...b, separate: true },
    ]),
  );
  assert.equal(totals(project(next)).spent, 172);
  const same = reviewStatement(l, request([a, { ...a, id: "second" }]));
  assert.ok(same.every((r) => r.state === "needs"));
});
test("recheck rejects a newly matching payment, bad amounts, missing categories and unreviewed rows atomically", () => {
  const l = setup(),
    raw = serializeLibrary(l);
  for (const patch of [
    { checked: false },
    { amount: 0 },
    { amount: 12.345 },
    { currency: "EUR" },
    { date: "2026-12-01" },
    { date: "2026-02-30" },
    { categoryId: "missing" },
    { direction: "unknown" },
  ])
    assert.throws(() =>
      applyStatement(
        l,
        request([
          row(),
          row({ id: "other", sourceId: "b".repeat(64) + ":2", ...patch }),
        ]),
      ),
    );
  assert.equal(serializeLibrary(l), raw);
  const changed = applyStatement(l, request());
  assert.throws(
    () =>
      applyStatement(
        changed,
        request([row({ sourceId: "c".repeat(64) + ":1" })], { id: "stale" }),
      ),
    /look/,
  );
});
test("undo blocks later changes without overwriting edits or partial undo", () => {
  const next = applyStatement(setup(), request());
  project(next).expenses[0].notes = "Added later";
  const before = serializeLibrary(next);
  assert.throws(() => undoStatement(next, "project", "batch-1"), /edited/);
  assert.equal(serializeLibrary(next), before);
});
test("income, transfers and excluded rows stay out; undo restores duplicate protection for a re-import", () => {
  const req = request([
    row(),
    row({ id: "income", direction: "in", sourceId: "b".repeat(64) + ":2" }),
    row({
      id: "transfer",
      direction: "transfer",
      sourceId: "b".repeat(64) + ":3",
    }),
    row({ id: "skip", decision: "skip", checked: false }),
  ]);
  const next = applyStatement(setup(), req);
  assert.equal(project(next).expenses.length, 1);
  const undone = undoStatement(next, "project", "batch-1");
  assert.equal(totals(project(undone)).spent, 0);
  assert.equal(reviewStatement(undone, request())[0].state, "ready");
});
test("a repeating match changes the imported occurrence only, including after period navigation and undo", () => {
  let l = setup(),
    b = project(l);
  b = saveRepeatingEntry(
    b,
    {
      id: "bill",
      categoryId: "bills",
      description: "City energy",
      amount: 86,
      status: "committed",
      history: ["committed"],
      date: "2026-11-05",
      notes: "Keep this",
    },
    { frequency: "monthly" },
  );
  l.books[0].projects[0] = b;
  const next = applyStatement(
    l,
    request([
      row({
        decision: "match",
        matchId: "bill",
        matchProjectId: "project",
        matchPeriod: "2026-11",
      }),
    ]),
  );
  assert.equal(project(next).expenses.length, 1);
  assert.equal(project(next).expenses[0].status, "paid");
  const december = openPeriod(project(next), "2026-12");
  assert.equal(december.expenses[0].status, "planned");
  next.books[0].projects[0] = december;
  const undone = undoStatement(next, "project", "batch-1");
  assert.equal(
    openPeriod(project(undone), "2026-11").expenses[0].status,
    "committed",
  );
  assert.equal(project(undone).expenses[0].status, "planned");
});
