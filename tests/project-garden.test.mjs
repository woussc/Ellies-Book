import assert from 'node:assert/strict';
import test from 'node:test';
import {exampleBudget, serializeBook, parseBook, editExpense, editBudgetDetails, totals, money, validateBudget} from '../app/book/model.mjs';
import {gardenView,resizeGarden,gardenLinks} from '../app/book/garden-model.mjs';
import {changeBoard} from '../app/book/board-model.mjs';

test('project-first summary separates planned estimates from category allocation', () => {
  const b=exampleBudget(), view=gardenView(b);
  assert.equal(view.summary.planned,180);
  assert.equal(view.summary.left,3208.5);
  assert.equal(view.summary.plan,4500);
  assert.equal(view.summary.forecast,1971.5);
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

test('allocation links use row rails above staggered categories, never another category interior', () => {
  const rects={project:{x:350,y:0,w:210,h:210},budget:{x:200,y:280,w:480,h:400}};
  const categories=Array.from({length:5},(_,i)=>'category:'+i);
  categories.forEach((id,i)=>{rects[id]={x:50+(i%3)*300,y:800+Math.floor(i/3)*350+(i%3)*32,w:210,h:210,rowY:800+Math.floor(i/3)*350};});
  for(const {key,path} of gardenLinks(rects,categories,[])) {
    const points=[];let x=0,y=0;
    for(const part of path.matchAll(/([MHV])([\d.]+)(?: ([\d.]+))?/g)) {
      if(part[1]==='M'){x=Number(part[2]);y=Number(part[3]);}
      else {const nx=part[1]==='H'?Number(part[2]):x,ny=part[1]==='V'?Number(part[2]):y;points.push([x,y,nx,ny]);x=nx;y=ny;}
    }
    for(const id of categories.filter(id=>!key.endsWith('>'+id))) {
      const r=rects[id];
      for(const [x1,y1,x2,y2] of points) {
        assert.equal(x1===x2?x1>r.x&&x1<r.x+r.w&&Math.max(y1,y2)>r.y&&Math.min(y1,y2)<r.y+r.h:y1>r.y&&y1<r.y+r.h&&Math.max(x1,x2)>r.x&&Math.min(x1,x2)<r.x+r.w,false,`${key} must avoid ${id}: ${path}`);
      }
    }
  }
});

test('a focused category keeps the allocation connector off the central trail heading', () => {
  const rects={budget:{x:0,y:0,w:296,h:400},'category:one':{x:46,y:520,w:204,h:204,rowY:520}};
  const [link]=gardenLinks(rects,['category:one'],[]);
  assert.equal(link.path,'M148 400V424H4V500H148V520');
});
