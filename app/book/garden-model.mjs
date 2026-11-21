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
