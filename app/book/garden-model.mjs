import { boardLayout, orderedNodes } from './board-model.mjs';
import { round, totals } from './model.mjs';

export function gardenView(budget, categoryId = null, page = 0) {
  const categories = orderedNodes(budget.categories, boardLayout(budget));
  const category = categories.find(c => c.id === categoryId) ?? null;
  const entries = category ? budget.expenses.filter(e => e.categoryId === category.id)
    .sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) : [];
  const offset = Math.max(0, Math.min(Math.floor(page), Math.max(0, Math.ceil(entries.length / 4) - 1))) * 4;
  return {
    categories, category, entries: entries.slice(offset, offset + 4), count: entries.length, offset,
    summary: {...totals(budget), planned: round(budget.expenses.filter(e => e.status === 'planned').reduce((sum,e)=>sum+e.amount,0))},
  };
}

export function resizeGarden(budget, id, size) {
  if (!['medium','large'].includes(size) || !['project','budget', ...budget.categories.map(c=>'category:'+c.id), ...budget.expenses.map(e=>'entry:'+e.id)].includes(id)) return budget;
  const board=boardLayout(budget), canvas=board.canvas ?? {positions:{},sizes:{},viewport:{x:0,y:0,zoom:1}};
  return {...budget, board:{...board, canvas:{...canvas,sizes:{...canvas.sizes,[id]:size}}}};
}

export function gardenLinks(rects, categoryIds, entries) {
  const links=[];
  function link(from,to,entry=false) {
    const a=rects[from],b=rects[to];if(!a||!b)return;
    const ax=a.x+a.w/2,ay=a.y+a.h,bx=b.x+b.w/2;
    const path=entry
      ? `M${ax} ${ay}V${ay+20}H${b.x-20}V${b.y+b.h/2}H${b.x}`
      : to.startsWith('category:') && categoryIds.length>1
        ? `M${ax} ${ay}V${ay+24}H4V${(b.rowY??b.y)-20}H${bx}V${b.y}`
        : `M${ax} ${ay}V${ay+24}H${bx}V${b.y}`;
    links.push({key:from+'>'+to,path});
  }
  link('project','budget');
  categoryIds.forEach(id=>link('budget',id));
  entries.forEach(e=>link('category:'+e.categoryId,'entry:'+e.id,true));
  return links;
}
