import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { advanceExpense, blankBudget, csvText, editCategory, exampleBudget, persistBudget, readStoredBudget, reportText, totals } from "../app/look-a-preview/model.mjs";

test("an unpaid invoice is a commitment, not actual spent", () => {
  const b = blankBudget(); b.total = 1000; b.categories[0].amount = 500;
  b.expenses.push({id:"invoice",categoryId:b.categories[0].id,description:"Internet",amount:85,status:"committed",history:["committed"]});
  assert.deepEqual(totals(b), {plan:500,spent:0,committed:85,left:915,forecast:500});
  const paid = advanceExpense(b,"invoice");
  assert.deepEqual(totals(paid), {plan:500,spent:85,committed:0,left:915,forecast:500});
  assert.equal(totals(paid,b.categories[0].id).left,415);
  assert.equal(advanceExpense(paid,"invoice").expenses[0].history.length,2);
});
test("planned -> committed -> paid keeps one exposure and an auditable trail", () => {
  const b = blankBudget(); b.total = 100; b.categories[0].amount = 100;
  b.expenses.push({id:"idea",categoryId:b.categories[0].id,description:"Dinner",amount:40,status:"planned",history:["planned"]});
  assert.equal(totals(b).left,100);
  const committed = advanceExpense(b,"idea"); assert.equal(totals(committed).committed,40);
  const paid = advanceExpense(committed,"idea"); assert.equal(totals(paid).spent,40); assert.equal(totals(paid).committed,0); assert.equal(totals(paid).left,60);
  assert.deepEqual(paid.expenses[0].history,["planned","committed","paid"]);
});
test("fresh budgets have no sample and examples never contaminate a fresh start", () => {
  const demo = exampleBudget(); assert.equal(demo.sample,true); assert.equal(totals(demo).spent,1726.5);
  assert.equal(totals(demo).committed,65); assert.equal(totals(demo).left,3208.5);
  const empty = blankBudget("Team"); assert.equal(empty.sample,false); assert.equal(empty.expenses.length,0); assert.equal(totals(empty).plan,0);
});
test("saved Markdown, notes, report and finance export preserve the same numbers", () => {
  const b = exampleBudget(); b.notes = "## Keep this\nA decision about [[Home & bills]].";
  const restored = JSON.parse(JSON.stringify(b)); assert.equal(restored.notes,b.notes);
  assert.match(reportText(restored),/\$1,726\.50/); assert.match(reportText(restored),/\$65/); assert.match(reportText(restored),/Keep this/);
  assert.match(csvText(restored),/"Home & bills","2000","1600","65","335"/);
  b.categories[0].name = "=danger"; assert.match(csvText(b),/"'=danger"/);
});
test("exploring and removing an example preserves the personal budget across refresh", () => {
  const map = new Map();
  const storage = { getItem:key => map.get(key), setItem:(key,value) => map.set(key,value), removeItem:key => map.delete(key) };
  const personal = blankBudget(); personal.name = "My real budget"; personal.notes = "Keep my real note"; personal.total = 750;
  persistBudget(storage, personal); persistBudget(storage, exampleBudget());
  assert.equal(readStoredBudget(storage).sample,true);
  assert.deepEqual(readStoredBudget(storage,false),personal);
  persistBudget(storage,readStoredBudget(storage,false));
  assert.deepEqual(readStoredBudget(storage),personal);
});
test("category changes preserve before/after values in the audit trail", () => {
  const b = exampleBudget(); const id = b.categories[0].id;
  const edited = editCategory(b,id,{amount:2100,glCode:"001230"});
  assert.equal(edited.categories[0].amount,2100); assert.equal(b.categories[0].amount,2000);
  assert.equal(edited.events.at(-1).before.amount,2000); assert.equal(edited.events.at(-1).after.amount,2100);
  assert.match(edited.events.at(-1).text,/2000 → 2100/); assert.match(edited.events.at(-1).text,/001230/);
  assert.equal(editCategory(edited,id,{amount:2100}),edited);
});
test("spending date uses the local day rather than the UTC day", () => {
  const result = spawnSync(process.execPath,["--input-type=module","-e",`import { localDate } from './app/look-a-preview/model.mjs'; console.log(localDate(new Date('2026-11-19T01:00:00Z')));`],{env:{...process.env,TZ:"America/Los_Angeles"},encoding:"utf8"});
  assert.equal(result.status,0); assert.equal(result.stdout.trim(),"2026-11-18");
});
