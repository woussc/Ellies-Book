import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyLibrary,
  changeLibrary,
  serializeLibrary,
  parseLibrary,
} from "../app/book/library-model.mjs";
import { blankBudget } from "../app/book/model.mjs";
import { saveStatement } from "../app/book/statement-storage.mjs";
const library = () =>
  changeLibrary(emptyLibrary(), {
    type: "book",
    name: "Before",
    project: { ...blankBudget("Household"), id: "project", created: true },
  });
test("a manual save during the import read cannot be overwritten", () => {
  const initial = library(),
    newer = structuredClone(initial);
  newer.books[0].name = "Manual save in another tab";
  let saved = serializeLibrary(initial),
    reads = 0,
    writes = 0;
  const storage = {
    getItem: () => {
      const value = saved;
      if (++reads === 1) saved = serializeLibrary(newer);
      return value;
    },
    setItem: (_key, value) => {
      writes++;
      saved = value;
    },
  };
  assert.throws(
    () =>
      saveStatement(storage, (l) => {
        l.books[0].name = "Import";
        return l;
      }),
    /another tab/,
  );
  assert.equal(writes, 0);
  assert.deepEqual(parseLibrary(saved), newer);
});
test("a failed storage write preserves the old library and a retry publishes once", () => {
  const initial = library();
  let saved = serializeLibrary(initial),
    fail = true,
    writes = 0;
  const storage = {
    getItem: () => saved,
    setItem: (_key, value) => {
      if (fail) throw new Error("quota");
      writes++;
      saved = value;
    },
  };
  const change = (l) => {
    l.books[0].name = "Imported";
    return l;
  };
  assert.throws(() => saveStatement(storage, change), /Nothing was imported/);
  assert.deepEqual(parseLibrary(saved), initial);
  fail = false;
  const next = saveStatement(storage, change);
  assert.deepEqual(parseLibrary(saved), next);
  assert.equal(writes, 1);
});
