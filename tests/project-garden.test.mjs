import assert from 'node:assert/strict';
import test from 'node:test';
import {exampleBudget, serializeBook, parseBook, editExpense, editBudgetDetails, totals, money, validateBudget} from '../app/book/model.mjs';
import {gardenView,resizeGarden} from '../app/book/garden-model.mjs';
import {changeBoard} from '../app/book/board-model.mjs';

test('project-first summary separates planned estimates from category allocation', () => {
  const b=exampleBudget(), view=gardenView(b);
  assert.equal(view.summary.planned,180);
  assert.equal(view.summary.left,3208.5);
  assert.equal(view.category,null);
  assert.equal(view.entries.length,0);
});
test('focus keeps four entries at most, pages the same category, and scopes all figures to its project', () => {
  const b=exampleBudget(); b.expenses=Array.from({length:7},(_,i)=>({...b.expenses[0],id:'e'+i}));
  const a=gardenView(b,b.categories[0].id), next=gardenView(b,b.categories[0].id,1);
  assert.equal(a.entries.length,4);assert.equal(next.entries.length,3);
  assert.equal(new Set([...a.entries,...next.entries].map(e=>e.id)).size,7);
  assert.equal(gardenView(b,'missing').entries.length,0);
});
test('modular sizes and category shuffling are view metadata only and survive Markdown', () => {
  const b=exampleBudget();
  const next=changeBoard(resizeGarden(b,'category:category-0','large'),{type:'node',id:'category-1',before:'category-0'});
  assert.deepEqual(totals(next),totals(b));
  assert.deepEqual(next.expenses,b.expenses);
  assert.equal(gardenView(parseBook(serializeBook(next))).categories[0].id,'category-1');
  assert.equal(parseBook(serializeBook(next)).board.canvas.sizes['category:category-0'],'large');
});

test('exact money always preserves currency, separators and cents', () => {
  assert.equal(money(5000), '$5,000.00');
  assert.equal(money(-12.5), '-$12.50');
});
test('entry-owned Markdown survives corrections and backup without changing money', () => {
  const b=exampleBudget();
  const next=editExpense(b, 'rent', {notes: '## Receipt\n[[Home & bills]] #home'});
  assert.equal(parseBook(serializeBook(next)).expenses[0].notes, '## Receipt\n[[Home & bills]] #home');
  assert.deepEqual(totals(next), totals(b));
  assert.equal(next.events.at(-1).before.notes, undefined);
  assert.equal(next.events.at(-1).after.notes, next.expenses[0].notes);
});
test('explicit budget dates validate and legacy undated budgets remain readable', () => {
  const b=exampleBudget();
  const next=editBudgetDetails(b,{name:b.name,total:b.total,profile:b.profile,period:'Winter',startDate:'2026-11-21',endDate:'2027-02-01'});
  assert.equal(parseBook(serializeBook(next)).endDate, '2027-02-01');
  assert.throws(()=>validateBudget({...next,endDate:'2026-11-20'}));
  assert.throws(()=>validateBudget({...next,startDate:'2026-02-30'}));
  const legacy={...b};delete legacy.startDate;delete legacy.endDate;
  assert.equal(parseBook(serializeBook(legacy)).startDate, undefined);
});
