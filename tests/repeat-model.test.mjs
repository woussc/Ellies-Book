import test from 'node:test';
import assert from 'node:assert/strict';
import {blankBudget, serializeBook, parseBook, totals, advanceExpense} from '../app/book/model.mjs';
import {saveRepeatingEntry, openPeriod,repeatDates,repeatTiming,skipOccurrence,stopRepeating} from '../app/book/repeat-model.mjs';
import {emptyLibrary,changeLibrary,serializeLibrary,parseLibrary,activeBudget} from '../app/book/library-model.mjs';

function book(profile='Household') {
  const b=blankBudget(profile); b.created=true;b.period='2026-11';b.startDate='2026-11-01';b.endDate='2026-11-30';b.total=2000;b.categories[0].amount=2000;
  return b;
}
const rent=b=>({id:'rent',description:'Rent',amount:1450,categoryId:b.categories[0].id,status:'paid',date:'2026-11-01',notes:'Receipt only for November',history:['paid']});
test('a paid monthly bill prepares one Planned occurrence in the next period, without copying a payment',()=>{
  for(const mode of ['Household','Just me','Team']) {
    const b=book(mode); const saved=saveRepeatingEntry(b,rent(b),{frequency:'monthly',startDate:'2026-11-01',endDate:''});
    assert.equal(totals(saved).spent,1450);
    const december=openPeriod(parseBook(serializeBook(saved)),'2026-12');
    assert.equal(december.profile,mode); assert.equal(december.expenses.length,1);
    assert.equal(december.expenses[0].status,'planned'); assert.equal(december.expenses[0].notes,'');
    assert.deepEqual(december.expenses[0].history,['planned']);
    assert.equal(totals(december).spent,0);assert.equal(totals(december).committed,0);assert.equal(totals(december).forecast,1450);
    assert.equal(december.budgetSet,false);assert.equal(december.total,0);
    assert.equal(openPeriod(openPeriod(december,'2026-11'),'2026-12').expenses.length,1);
    const paid=advanceExpense(advanceExpense(december,december.expenses[0].id),december.expenses[0].id);
    assert.equal(totals(paid).spent,1450);assert.equal(totals(paid).committed,0);assert.equal(totals(paid).forecast,1450);
  }
});

test('calendar repeats clamp to month end and return to the original day; end is inclusive',()=>{
  const rule={id:'a',frequency:'monthly',startDate:'2026-01-31',skipped:[]};
  assert.deepEqual(repeatDates(rule,'2026-01-01','2026-04-30'),['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
  assert.deepEqual(repeatDates({...rule,endDate:'2026-03-31'},'2026-01-01','2026-12-31'),['2026-01-31','2026-02-28','2026-03-31']);
  assert.deepEqual(repeatDates({...rule,frequency:'yearly',startDate:'2024-02-29'},'2025-01-01','2028-12-31'),['2025-02-28','2026-02-28','2027-02-28','2028-02-29']);
  assert.deepEqual(repeatDates({...rule,frequency:'weekly',startDate:'2026-12-28'},'2026-12-01','2027-01-15'),['2026-12-28','2027-01-04','2027-01-11']);
});
test('skip persists through full library restore; stopping keeps paid history and removes later Planned repeats',()=>{
  const b=book();let next=saveRepeatingEntry(b,rent(b),{frequency:'monthly',endDate:'2027-03-01'});
  next=openPeriod(next,'2026-12'); const id=next.expenses[0].id;
  assert.deepEqual(repeatTiming(next,next.expenses[0]),{frequency:'monthly',startDate:'2026-11-01',nextDate:'2027-01-01',endDate:'2027-03-01'});
  next=skipOccurrence(next,id);
  const library=changeLibrary(emptyLibrary(),{type:'book',name:'Home',project:next});
  next=activeBudget(parseLibrary(serializeLibrary(library)));
  next=openPeriod(openPeriod(next,'2026-11'),'2026-12');assert.equal(next.expenses.length,0);
  next=openPeriod(next,'2027-01');next=advanceExpense(advanceExpense(next,next.expenses[0].id),next.expenses[0].id);
  next=stopRepeating(next,next.expenses[0].id);
  assert.equal(next.expenses[0].status,'paid');assert.equal(repeatTiming(next,next.expenses[0]).nextDate,null);
  assert.equal(openPeriod(next,'2027-02').expenses.length,0);
  assert.equal(openPeriod(next,'2026-11').expenses[0].status,'paid');
});
test('this entry only is default; future amount edits preserve earlier records and paid future occurrences',()=>{
  const b=book();let next=saveRepeatingEntry(b,rent(b),{frequency:'monthly'});
  next=openPeriod(next,'2027-01');next=advanceExpense(advanceExpense(next,next.expenses[0].id),next.expenses[0].id);
  next=openPeriod(next,'2026-12');const december=next.expenses[0];
  next=saveRepeatingEntry(next,{...december,amount:1300},{frequency:'monthly'});
  assert.equal(next.expenses[0].amount,1300);assert.equal(openPeriod(next,'2027-01').expenses[0].amount,1450);
  next=saveRepeatingEntry(next,{...december,amount:1500},{frequency:'monthly',scope:'future'});
  assert.equal(next.expenses[0].id,december.id);assert.equal(next.expenses[0].amount,1500);
  assert.equal(openPeriod(next,'2026-11').expenses[0].amount,1450);
  const jan=openPeriod(next,'2027-01');assert.equal(jan.expenses.length,1);assert.equal(jan.expenses[0].amount,1450);assert.equal(jan.expenses[0].status,'paid');
  const feb=openPeriod(jan,'2027-02');assert.equal(feb.expenses.length,1);assert.equal(feb.expenses[0].amount,1500);assert.equal(feb.expenses[0].status,'planned');
});
test('legacy Markdown books are unchanged and malformed repeat backups are rejected',()=>{
  const b=book();assert.deepEqual(parseBook(serializeBook(b)),b);
  const saved=saveRepeatingEntry(b,rent(b),{frequency:'monthly'});
  for(const mutate of [x=>x.repeatRules[0].startDate='2026-02-30',x=>x.repeatRules[0].frequency='daily',x=>x.expenses[0].repeatId='missing',x=>x.periods.push(structuredClone(x.periods[0]))]) {
    const invalid=structuredClone(saved);mutate(invalid);assert.throws(()=>serializeBook(invalid));
  }
});
