// Budget approval provenance only. Carryover is never a spending line or income.
import {localDate,round,totals,validateBudget} from './model.mjs';
import {periodId,validRepeatDate} from './repeat-model.mjs';

const sum=values=>round(values.reduce((a,b)=>a+b,0));
const monthBefore=date=>{const d=new Date(date.slice(0,7)+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);};
export const budgetMonth=period=>new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(period.startDate+'T00:00:00Z'));
export function previousBudgetPeriod(budget) {
 if(!validRepeatDate(budget.startDate))return null;
 return (budget.periods??[]).find(p=>p.endDate?.slice(0,7)===monthBefore(budget.startDate))??null;
}
function sourceSignature(source) {
 return JSON.stringify([periodId(source),source.startDate,source.endDate,source.total,source.budgetSet,
  source.categories.map(c=>[c.id,c.name,c.amount,c.owner,c.glCode,totals(source,c.id).spent,totals(source,c.id).committed])]);
}
export function carryoverStatus(budget) {
 const approval=budget.budgetOrigins?.at(-1);if(!approval)return null;
 const source=(budget.periods??[]).find(p=>periodId(p)===approval.source.periodId);
 return {source:approval.source,amount:sum(approval.rows.map(r=>r.carryover)),changed:!source||sourceSignature(source)!==approval.source.signature,at:approval.at};
}
export function previewBudgetStart(budget,today=localDate()) {
 const source=previousBudgetPeriod(budget);
 if(!source)throw new Error('Open the previous month in this book and confirm its dates first.');
 if(!validRepeatDate(today))throw new Error('Choose a valid review date.');
 if([source,budget].some(p=>!validRepeatDate(p.startDate)||!validRepeatDate(p.endDate)||p.startDate>p.endDate||p.periodConfirmed===false||p.startDate.slice(0,7)!==p.endDate.slice(0,7))||source.endDate>=budget.startDate)
  throw new Error('Confirm non-overlapping monthly dates before starting from the previous month.');
 if([budget,...(budget.periods??[])].filter(p=>periodId(p)!==periodId(budget)).some(p=>p.startDate<=budget.endDate&&p.endDate>=budget.startDate))throw new Error('These dates overlap another period. Confirm separate dates first.');
 if(source.budgetSet===false||source.total<=0)throw new Error('Set the previous month’s Approved Budget first.');
 const adjustment=budget.budgetSet!==false;
 const previous=budget.budgetOrigins?.at(-1);
 const oldRows=new Map((previous?.rows??[]).map(r=>[r.categoryId,r]));
 const categories=[...budget.categories,...source.categories.filter(c=>!budget.categories.some(t=>t.id===c.id))];
 const rows=categories.map(category=>{
  const from=source.categories.find(c=>c.id===category.id),target=budget.categories.find(c=>c.id===category.id);
  const t=from?totals(source,from.id):{spent:0,committed:0,left:0};
  return {category:target??category,sourceAllocation:from?.amount??0,paid:t.spent,committed:t.committed,room:t.left,
   base:adjustment?round((target?.amount??0)-(oldRows.get(category.id)?.carryover??0)):from?.amount??0,
   selected:adjustment?(oldRows.get(category.id)?.selected??false):false};
 });
 const baseTotal=adjustment?round(budget.total-sum((previous?.rows??[]).map(r=>r.carryover))):source.total;
 return {source,rows,baseTotal,adjustment,available:today>source.endDate,changed:carryoverStatus(budget)?.changed??false,
  revision:JSON.stringify([sourceSignature(source),periodId(budget),budget.startDate,budget.endDate,budget.periodConfirmed,budget.budgetSet,budget.total,budget.categories,budget.expenses,previous?.id])};
}
function validMoney(value,signed=false) {
 return typeof value==='number'&&Number.isFinite(value)&&value>=(signed?-1e9:0)&&value<=1e9&&Math.abs(value-round(value))<1e-7;
}
const validBalance=(value,signed=false)=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER/100&&(signed||value>=0)&&Math.abs(value-round(value))<1e-7;
export function confirmBudgetStart(budget,draft,today=localDate()) {
 const preview=previewBudgetStart(budget,today);
 if(draft.revision!==preview.revision)throw new Error('This month or the previous month changed. Cancel and open the review again.');
 if(!validMoney(draft.baseTotal)||draft.baseTotal<=0||!draft.baseAmounts||!Array.isArray(draft.carryIds)||new Set(draft.carryIds).size!==draft.carryIds.length)throw new Error('Use valid budget amounts with at most two decimal places.');
 const ids=new Set(preview.rows.map(r=>r.category.id));
 if(draft.carryIds.some(id=>!ids.has(id))||Object.keys(draft.baseAmounts).some(id=>!ids.has(id)))throw new Error('A category changed. Open the review again.');
 if(draft.carryIds.length&&!preview.available)throw new Error('Final carryover is available after '+preview.source.endDate+'. You can copy base amounts now.');
 const rows=preview.rows.map(r=>{
  const base=draft.baseAmounts[r.category.id],selected=draft.carryIds.includes(r.category.id);
  if(!validMoney(base))throw new Error('Each category needs a non-negative base with at most two decimal places.');
  const carryover=selected?r.room:0,amount=round(base+carryover);
  if(!validMoney(amount))throw new Error(r.category.name+' would have a negative or too large allocation. Change its base or turn carryover off.');
  return {categoryId:r.category.id,name:r.category.name,sourceAllocation:r.sourceAllocation,paid:r.paid,committed:r.committed,room:r.room,base,selected,carryover};
 });
 if(sum(rows.map(r=>r.base))>draft.baseTotal)throw new Error('Category bases exceed the base budget. Increase the budget or lower an allocation.');
 const total=round(draft.baseTotal+sum(rows.map(r=>r.carryover)));
 if(!validMoney(total)||total<=0)throw new Error('The proposed Approved Budget must be above zero and at most $1,000,000,000.');
 const source=preview.source,at=new Date().toISOString();
 const approval={id:crypto.randomUUID(),at,source:{periodId:periodId(source),period:source.period,startDate:source.startDate,endDate:source.endDate,total:source.total,signature:sourceSignature(source)},baseTotal:draft.baseTotal,total,rows};
 const next={...budget,total,budgetSet:true,categories:preview.rows.map((r,i)=>({...r.category,amount:round(rows[i].base+rows[i].carryover)})),
  budgetOrigins:[...(budget.budgetOrigins??[]),approval],events:[...budget.events,{at,text:`${preview.adjustment?'Approved budget adjustment':'Set budget'} from ${budgetMonth(source)}: base ${draft.baseTotal.toFixed(2)} USD; carryover ${sum(rows.map(r=>r.carryover)).toFixed(2)} USD; Approved Budget ${total.toFixed(2)} USD. Spending entries unchanged.`,after:approval}]};
 return validateBudget(next);
}

export function validateCarryoverData(budget) {
 if(budget.budgetOrigins===undefined)return;
 const bad=()=>{throw new Error('Could not read budget carryover approvals in this backup.');};
 if(!Array.isArray(budget.budgetOrigins)||budget.budgetOrigins.length>10000)bad();
 const ids=new Set();
 for(const a of budget.budgetOrigins) {
  if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||typeof a.at!=='string'||!Number.isFinite(Date.parse(a.at))||!validMoney(a.baseTotal)||!validMoney(a.total)||!a.source||typeof a.source.periodId!=='string'||typeof a.source.period!=='string'||typeof a.source.signature!=='string'||!validRepeatDate(a.source.startDate)||!validRepeatDate(a.source.endDate)||a.source.startDate>a.source.endDate||!validMoney(a.source.total)||!Array.isArray(a.rows))bad();
  ids.add(a.id);const cats=new Set();
  for(const r of a.rows) {
   if(!r||typeof r.categoryId!=='string'||cats.has(r.categoryId)||typeof r.name!=='string'||typeof r.selected!=='boolean'||!['sourceAllocation','base'].every(k=>validMoney(r[k]))||!['paid','committed'].every(k=>validBalance(r[k]))||!validBalance(r.room,true)||!validMoney(r.carryover,true)||r.room!==round(r.sourceAllocation-r.paid-r.committed)||r.carryover!==(r.selected?r.room:0)||!validMoney(round(r.base+r.carryover)))bad();
   cats.add(r.categoryId);
  }
  if(sum(a.rows.map(r=>r.base))>a.baseTotal||a.total!==round(a.baseTotal+sum(a.rows.map(r=>r.carryover))))bad();
 }
}
