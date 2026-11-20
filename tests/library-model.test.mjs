import test from "node:test";
import assert from "node:assert/strict";
import {
  blankBudget,
  serializeBook,
  STORAGE_KEY,
  totals,
} from "../app/book/model.mjs";
import {
  activeBudget,
  changeLibrary,
  emptyLibrary,
  parseLibrary,
  readLibrary,
  restoreLibrary,
  serializeLibrary,
  LIBRARY_KEY,
} from "../app/book/library-model.mjs";

const project = (id, name = id) => ({
  ...blankBudget("Team"),
  id,
  name,
  total: 10000,
  created: true,
});
const storage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
};

test("legacy Markdown becomes one book and project without touching the saved original", () => {
  const budget = project("old", "Our November");
  budget.notes = "---\ntags: [home]\n---\n[[category-0|People]]\n";
  const raw = serializeBook(budget),
    disk = storage({ [STORAGE_KEY]: raw });
  const library = readLibrary(disk);
  assert.deepEqual(activeBudget(library), budget);
  assert.equal(library.books[0].projects.length, 1);
  assert.equal(disk.getItem(STORAGE_KEY), raw);
  assert.equal(disk.getItem(LIBRARY_KEY), null);
  assert.deepEqual(parseLibrary(serializeLibrary(library)), library);
});

test("two project budgets and another book stay independent across selection and reload", () => {
  let library = changeLibrary(emptyLibrary(), {
    type: "book",
    name: "Studio",
    project: project("studio"),
  });
  const bookId = library.books[0].id;
  library = changeLibrary(library, {
    type: "project",
    bookId,
    project: project("winter"),
  });
  library = changeLibrary(library, {
    type: "book",
    name: "Home",
    project: project("home"),
  });
  library = changeLibrary(library, { type: "select", id: "winter" });
  library = changeLibrary(library, {
    type: "update",
    project: { ...activeBudget(library), total: 6000, notes: "Winter only" },
  });
  library = parseLibrary(serializeLibrary(library));
  assert.equal(activeBudget(library).total, 6000);
  assert.equal(library.books[0].projects[0].total, 10000);
  assert.equal(library.books[1].projects[0].notes, "");
  assert.deepEqual(totals(library.books[1].projects[0]), {
    plan: 0,
    spent: 0,
    committed: 0,
    left: 10000,
    forecast: 0,
  });
  assert.throws(() =>
    changeLibrary(library, { type: "select", id: "missing" }),
  );
});

test("restoring an old book or whole library adds copies, never replaces another project", () => {
  const original = changeLibrary(emptyLibrary(), {
    type: "book",
    name: "Studio",
    project: project("same"),
  });
  let restored = restoreLibrary(
    original,
    serializeBook(project("same", "Restored")),
  );
  restored = restoreLibrary(restored, serializeLibrary(original));
  assert.equal(restored.books.length, 3);
  const projects = restored.books.flatMap((b) => b.projects);
  assert.equal(new Set(projects.map((p) => p.id)).size, 3);
  assert.deepEqual(restored.books[0], original.books[0]);
});

test("a malformed library or legacy budget is protected rather than silently reset", () => {
  assert.throws(() => readLibrary(storage({ [LIBRARY_KEY]: "broken" })));
  assert.throws(() => readLibrary(storage({ [STORAGE_KEY]: "broken" })));
  const library = changeLibrary(emptyLibrary(), {
    type: "book",
    name: "Studio",
    project: project("p"),
  });
  assert.throws(() =>
    parseLibrary(
      serializeLibrary(library).replace(
        '"activeProjectId":"p"',
        '"activeProjectId":"gone"',
      ),
    ),
  );
});

test("local profile and example changes cannot alter real budgets", () => {
  let library = changeLibrary(emptyLibrary(), {
    type: "book",
    name: "Studio",
    project: project("p"),
  });
  const before = serializeBook(activeBudget(library));
  library = changeLibrary(library, { type: "profile", name: "Shuai" });
  library = changeLibrary(library, { type: "example" });
  assert.equal(activeBudget(library).sample, true);
  library = changeLibrary(library, { type: "remove-example" });
  assert.equal(library.profile.name, "Shuai");
  assert.equal(serializeBook(activeBudget(library)), before);
});
