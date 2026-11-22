import test from 'node:test';
import assert from 'node:assert/strict';
import {blankBudget,totals,serializeBook,parseBook} from '../app/book/model.mjs';
import {openPeriod} from '../app/book/repeat-model.mjs';
import {previewBudgetStart,confirmBudgetStart} from '../app/book/carryover-model.mjs';
import {carryoverStatus} from '../app/book/carryover-model.mjs';
import {emptyLibrary,changeLibrary,serializeLibrary,parseLibrary,activeBudget} from '../app/book/library-model.mjs';
import {prepareRepeats} from '../app/book/repeat-model.mjs';

function fixture(profile='Household') {
 const b={...blankBudget(profile),name:'Everyday',created:true,period:'2026-11',startDate:'2026-11-01',endDate:'2026-11-30',total:3200,
 categories:['Home','Groceries','Getting around','Everyday'].map((name,i)=>({id:'c'+i,name,amount:[1500,600,300,600][i],owner:'Alex',glCode:'001230'})),
 expenses:[['paid',1500,0],['paid',420,1],['committed',80,1],['paid',340,2],['paid',90,3],['committed',60,3],['planned',500,1]].map(([status,amount,i],j)=>({id:'e'+j,categoryId:'c'+i,description:'November entry '+j,amount,status,history:[status],date:'2026-11-10',notes:'Preserve me'}))};
 return openPeriod(b,'2026-12',{startDate:'2026-12-01',endDate:'2026-12-31'});
}
const draft=p=>({revision:p.revision,baseTotal:p.baseTotal,baseAmounts:Object.fromEntries(p.rows.map(r=>[r.category.id,r.base])),carryIds:[]});

test('start from previous month is a review, not an approval; signed room excludes Planned',()=>{
 const b=fixture(),before=structuredClone(b),p=previewBudgetStart(b,'2026-12-01');
 assert.deepEqual(p.rows.map(r=>r.room),[0,100,-40,450]);assert.equal(p.baseTotal,3200);
 assert.deepEqual(b,before);assert.equal(b.budgetSet,false);assert.deepEqual(draft(p).carryIds,[]);
 const next=confirmBudgetStart(b,{...draft(p),carryIds:['c1','c2']},'2026-12-01');
 assert.equal(next.total,3260);assert.deepEqual(next.categories.map(c=>c.amount),[1500,700,260,600]);
 assert.equal(totals(next).left,3260);assert.equal(next.budgetSet,true);
 assert.deepEqual(next.periods,b.periods);assert.deepEqual(next.expenses,b.expenses);
 assert.deepEqual(parseBook(serializeBook(next)),next);
});

for(const mode of ['Household','Just me','Team'])test(mode+': copy ahead with carryover off; later approval supersedes rather than adds twice',()=>{
 const b=fixture(mode),p=previewBudgetStart(b,'2026-11-22');
 assert.equal(p.available,false);
 assert.throws(()=>confirmBudgetStart(b,{...draft(p),carryIds:['c1']},'2026-11-22'),/available after/);
 const copied=confirmBudgetStart(b,draft(p),'2026-11-22');
 assert.equal(copied.total,3200);assert.equal(copied.categories[1].amount,600);
 const p2=previewBudgetStart(copied,'2026-12-01');
 const carried=confirmBudgetStart(copied,{...draft(p2),carryIds:['c1','c2']},'2026-12-01');
 const immutable=structuredClone(carried.budgetOrigins);
 const again=confirmBudgetStart(carried,{...draft(previewBudgetStart(carried,'2026-12-01')),carryIds:['c1','c2']},'2026-12-01');
 assert.equal(again.total,3260);assert.deepEqual(again.categories.map(c=>c.amount),[1500,700,260,600]);
 assert.deepEqual(again.budgetOrigins.slice(0,-1),immutable);
 assert.equal(again.total-again.categories.reduce((s,c)=>s+c.amount,0),200);
 assert.equal(again.categories[1].owner,'Alex');assert.equal(again.categories[1].glCode,'001230');
 const removed=confirmBudgetStart(again,draft(previewBudgetStart(again,'2026-12-01')),'2026-12-01');
 assert.equal(removed.total,3200);assert.equal(removed.budgetOrigins.length,4);
});

test('source changes require another review and never silently rewrite an approved month',()=>{
 const b=fixture(),p=previewBudgetStart(b,'2026-12-01');
 const changed=structuredClone(b);changed.periods[0].expenses[1].amount=430;
 assert.throws(()=>confirmBudgetStart(changed,draft(p),'2026-12-01'),/changed/);
 const approved=confirmBudgetStart(b,{...draft(p),carryIds:['c1','c2']},'2026-12-01');
 const old=structuredClone(approved);approved.periods[0].expenses[1].amount=430;
 assert.equal(carryoverStatus(approved).changed,true);assert.equal(approved.total,3260);
 const adjusted=confirmBudgetStart(approved,{...draft(previewBudgetStart(approved,'2026-12-01')),carryIds:['c1','c2']},'2026-12-01');
 assert.equal(adjusted.total,3250);assert.equal(adjusted.categories[1].amount,690);
 assert.deepEqual(adjusted.budgetOrigins[0],old.budgetOrigins[0]);assert.equal(carryoverStatus(adjusted).changed,false);
 const targetChange=structuredClone(b);targetChange.categories[0].amount=1;
 assert.throws(()=>confirmBudgetStart(targetChange,draft(p),'2026-12-01'),/changed/);
 assert.throws(()=>confirmBudgetStart(approved,{...draft(p),carryIds:['c1']},'2026-12-01'),/changed/);
});

test('negative allocations, non-cents, malformed choices and excessive allocations cannot be approved',()=>{
 const b=fixture(),p=previewBudgetStart(b,'2026-12-01'),d=draft(p);
 for(const patch of [{baseTotal:1},{baseTotal:NaN},{baseTotal:1e9+1},{baseTotal:3000.123},{carryIds:['c1','c1']},{carryIds:['missing']},{baseAmounts:{...d.baseAmounts,c0:-1}},{baseAmounts:{...d.baseAmounts,c0:1.001}},{baseAmounts:{...d.baseAmounts,c2:10},carryIds:['c2']}])
  assert.throws(()=>confirmBudgetStart(b,{...d,...patch},'2026-12-01'));
 const noApproval=structuredClone(b);noApproval.periods[0].budgetSet=false;assert.throws(()=>previewBudgetStart(noApproval),/Approved Budget/);
 const overlap=structuredClone(b);overlap.startDate='2026-11-30';assert.throws(()=>previewBudgetStart(overlap),/dates/);
 assert.throws(()=>previewBudgetStart({...b,periodConfirmed:false}),/dates/);
 const noSource=structuredClone(b);noSource.periods=[];assert.throws(()=>previewBudgetStart(noSource),/previous month/);
 const distant=structuredClone(b);distant.startDate='2027-01-01';distant.endDate='2027-01-31';assert.throws(()=>previewBudgetStart(distant),/previous month/);
});

test('entry history and repeat identities survive carryover, switching and whole-library restore',()=>{
 const source=openPeriod(fixture(),'2026-11');
 const entry=source.expenses[0];entry.repeatId='rent';entry.occurrenceDate=entry.date;
 source.repeatRules=[{id:'rent',frequency:'monthly',startDate:entry.date,description:'Rent',amount:1500,categoryId:'c0',skipped:[]}];
 const b=openPeriod(prepareRepeats(source),'2026-12'),p=previewBudgetStart(b,'2026-12-01');
 const expenses=structuredClone(b.expenses),prior=structuredClone(b.periods);
 let next=confirmBudgetStart(b,{...draft(p),carryIds:['c1','c2']},'2026-12-01');
 assert.equal(next.expenses.length,1);assert.equal(next.expenses[0].status,'planned');assert.equal(totals(next).forecast,1500);
 assert.deepEqual(next.expenses,expenses);assert.deepEqual(next.periods,prior);
 const savedOrigins=structuredClone(next.budgetOrigins);
 next=openPeriod(openPeriod(next,'2026-11'),'2026-12');
 assert.deepEqual(next.budgetOrigins,savedOrigins);assert.equal(next.expenses.length,1);
 const lib=changeLibrary(emptyLibrary(),{type:'book',name:'Home',project:next});
 const restored=activeBudget(parseLibrary(serializeLibrary(lib)));
 assert.deepEqual(restored,next);assert.equal(carryoverStatus(restored).amount,60);
 assert.deepEqual(restored.periods.find(p=>p.period==='2026-11').expenses,source.expenses);
 const invalid=structuredClone(next);invalid.budgetOrigins[0].rows[1].carryover=999;
 assert.throws(()=>serializeBook(invalid),/carryover approvals/);
});

test('an already approved target keeps its own bases; year boundary and cent amounts work',()=>{
 const b=fixture();b.budgetSet=true;b.total=1000;b.categories.forEach(c=>c.amount=200);
 const p=previewBudgetStart(b,'2026-12-01');assert.equal(p.adjustment,true);assert.equal(p.baseTotal,1000);assert.equal(p.rows[0].base,200);
 const next=confirmBudgetStart(b,{...draft(p),carryIds:['c1','c2']},'2026-12-01');assert.equal(next.total,1060);assert.equal(next.categories[1].amount,300);
 const dec=openPeriod(fixture(),'2026-11');dec.period='2026-12';dec.periodId='2026-12';dec.startDate='2026-12-01';dec.endDate='2026-12-31';dec.periods=[];
 dec.categories[1].amount=600.03;dec.expenses[1].amount=420.01;
 const jan=openPeriod(dec,'2027-01',{startDate:'2027-01-01',endDate:'2027-01-31'}),jp=previewBudgetStart(jan,'2027-01-01');
 assert.equal(jp.rows[1].room,100.02);
 const n=confirmBudgetStart(jan,{...draft(jp),carryIds:['c1']},'2027-01-01');assert.equal(n.total,3300.02);assert.equal(n.categories[1].amount,700.05);
});

test('large historical exposure does not block an unselected category; converted paid history stays one exposure',()=>{
 const b=fixture();b.periods[0].expenses.push({...b.periods[0].expenses[0],id:'large',amount:1e9});
 const p=previewBudgetStart(b,'2026-12-01');
 assert.equal(p.rows[0].paid,1000001500);assert.equal(p.rows[0].room,-1e9);
 const n=confirmBudgetStart(b,draft(p),'2026-12-01');assert.equal(n.total,3200);assert.deepEqual(parseBook(serializeBook(n)),n);
 const lineage=fixture();lineage.periods[0].expenses[3].history=['planned','committed','paid'];
 assert.equal(previewBudgetStart(lineage,'2026-12-01').rows[2].room,-40);
});

test('existing target payments and commitments survive approval; approval history belongs to its period only',()=>{
 const b=fixture();b.expenses=[{...b.periods[0].expenses[0],id:'already-paid',date:'2026-12-01',amount:50},{...b.periods[0].expenses[2],id:'already-committed',date:'2026-12-01',amount:30}];
 const p=previewBudgetStart(b,'2026-12-01'),n=confirmBudgetStart(b,{...draft(p),carryIds:['c1','c2']},'2026-12-01');
 assert.deepEqual(n.expenses,b.expenses);assert.equal(totals(n).left,3180);
 const prior=openPeriod(n,'2026-11');assert.equal(prior.budgetOrigins,undefined);
 const third=openPeriod(n,'2027-01',{startDate:'2027-01-01',endDate:'2027-01-31'});assert.equal(third.budgetOrigins,undefined);
 const restored=openPeriod(parseBook(serializeBook(third)),'2026-12');assert.deepEqual(restored.budgetOrigins,n.budgetOrigins);assert.deepEqual(restored.expenses,n.expenses);
});
