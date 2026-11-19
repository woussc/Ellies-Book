import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { blankBudget, cents, exampleBudget, financeCsv, fromMarkdown, persistSnapshot, reportText, STORAGE_KEY, toMarkdown, totals, transitionSpending } from "../app/look-b-model.mjs";

test("a stale tab cannot replace or remove another tab's saved notes", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const original = toMarkdown(exampleBudget());
  persistSnapshot(storage, null, original);
  const changed = fromMarkdown(original);
  changed.notes.push({ id: "new-note", target: "budget", date: "2026-11-19", text: "Save this context" });
  const latest = persistSnapshot(storage, original, toMarkdown(changed));
  assert.throws(() => persistSnapshot(storage, original, original), /changed in another tab/);
  assert.throws(() => persistSnapshot(storage, original, null), /changed in another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), latest);
  persistSnapshot(storage, latest, null);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("a fresh budget is empty and never falls back to example data", () => {
  const budget = blankBudget();
  assert.equal(budget.created, false);
  assert.equal(budget.example, false);
  assert.deepEqual(budget.categories, []);
  assert.deepEqual(budget.spending, []);
  assert.equal(totals(budget).paid, 0);
});

test("local dates and budget boundaries agree in timezones on either side of UTC", () => {
  const moduleUrl = new URL("../app/look-b-model.mjs", import.meta.url).href;
  for (const [zone, instant, expected] of [
    ["America/Los_Angeles", "2026-05-01T01:30:00Z", ["2026-04-30", "2026-04-01", "2026-04-30"]],
    ["Asia/Shanghai", "2026-04-30T17:30:00Z", ["2026-05-01", "2026-05-01", "2026-05-31"]],
  ]) {
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { today, blankBudget } from ${JSON.stringify(moduleUrl)};
      const date = new Date(${JSON.stringify(instant)});
      const b = blankBudget("Household", date);
      console.log(JSON.stringify([today(date), b.start, b.end]));
    `], { env: { ...process.env, TZ: zone }, encoding: "utf8" });
    assert.deepEqual(JSON.parse(result), expected);
  }
});

test("paid, committed and planned remain separate in the overview and report", () => {
  const budget = exampleBudget();
  const t = totals(budget);
  assert.equal(t.paid, 192650);
  assert.equal(t.committed, 8500);
  assert.equal(t.planned, 14000);
  assert.equal(t.left, 278850);
  assert.equal(t.forecast, 215150);
  assert.equal(t.headroom, 264850);
  assert.match(reportText(budget), /\$1,926.50 has been paid/);
  assert.match(reportText(budget), /\$85 is committed but not paid/);
  assert.match(financeCsv(budget), /"Home","2200","1800","85","315"/);
});

test("paying a committed bill changes the same record without double counting", () => {
  const budget = exampleBudget();
  const bill = budget.spending.find(s => s.description === "Electricity bill");
  const next = transitionSpending(budget, bill.id, "paid");
  assert.equal(next.spending.length, budget.spending.length);
  assert.equal(totals(next).paid, 201150);
  assert.equal(totals(next).committed, 0);
  assert.equal(totals(next).left, totals(budget).left);
  assert.equal(next.spending.find(s => s.id === bill.id).id, bill.id);
  assert.equal(budget.spending.find(s => s.id === bill.id).status, "committed");
  assert.match(next.audit.at(-1).action, /committed → paid/);
  assert.throws(() => transitionSpending(budget, bill.id, "invoice"));
});

test("all category totals sum to the same whole-budget figures", () => {
  const budget = exampleBudget();
  const rows = budget.categories.map(c => totals(budget, c.id));
  for (const field of ["approved", "paid", "committed", "planned", "forecast", "headroom", "left"]) {
    assert.equal(rows.reduce((sum, row) => sum + row[field], 0), totals(budget)[field]);
  }
});

test("over-budget spending stays visible as negative headroom, never silently clamped", () => {
  const budget = exampleBudget();
  budget.spending[0].amount = 600000;
  assert.equal(totals(budget).left, -141150);
  assert.equal(totals(budget).headroom, -155150);
});

test("Markdown round-trips records, notes, links, leading-zero GL codes and audit events", () => {
  const budget = exampleBudget();
  budget.categories[0].glCode = "001230";
  budget.notes.push({ id: "n2", target: "budget", date: "2026-11-19", text: "# 冬天 🏠\n[[Home]] **important**\n\n<!-- /note -->\n\n## Knowledge notes\n\n```json\n{\"hello\":true}\n```\n" });
  assert.deepEqual(fromMarkdown(toMarkdown(budget)), budget);
  assert.match(toMarkdown(budget), /# 冬天 🏠/);
  assert.match(financeCsv(budget), /001230/);
});

test("corrupt saved data is rejected instead of replacing it with sample data", () => {
  assert.throws(() => fromMarkdown("garbage"));
  const budget = exampleBudget();
  budget.total = -1;
  assert.throws(() => fromMarkdown(toMarkdown(budget)), /invalid/);
});

test("CSV protects category formulas and quotes", () => {
  const budget = exampleBudget();
  budget.categories[0].name = '=HYPERLINK("bad")';
  assert.match(financeCsv(budget), /"'=HYPERLINK\(""bad""\)"/);
});

test("CSV keeps negative financial values numeric while protecting text", () => {
  const budget = exampleBudget();
  budget.categories[0].name = "-unsafe text";
  budget.categories[0].glCode = "+formula";
  budget.spending[0].amount = 600000;
  const csv = financeCsv(budget);
  assert.match(csv, /"'-unsafe text","2200","6000","85","-3885"/);
  assert.match(csv, /"'\+formula"/);
  assert.match(csv, /"TOTAL","4800","6126.5","85","-1411.5","140","6351.5","-1551.5"/);
  assert.doesNotMatch(csv, /"'-\d/);
});

test("currency rounds once into integer cents and rejects invalid values", () => {
  assert.equal(cents("0.29"), 29);
  assert.equal(cents("126.50"), 12650);
  assert.equal(cents("1.005"), 101);
  assert.throws(() => cents(-1));
  assert.throws(() => cents(Infinity));
});
