// A repeat is a template, never a financial line. Only dated occurrences enter
// the existing lifecycle engine. Inactive periods retain their own budget data.
import {editExpense, removeExpense, validateBudget} from './model.mjs';

const frequencies=['weekly','monthly','yearly'];
const periodFields=['periodId','period','startDate','endDate','total','categories','expenses','board','budgetSet','periodConfirmed'];
export const validRepeatDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value>='0001-01-01' && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const iso=date=>date.toISOString().slice(0,10);
const dayAfter=(date,days=1)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return iso(d);};
const monthIndex=date=>Number(date.slice(0,4))*12+Number(date.slice(5,7))-1;
function monthDate(index,day=1) {
  const year=Math.floor(index/12),month=index%12+1;
  if(year<1||year>9999)throw new Error('This repeat is outside the supported date range.');
  const first=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-01`;
  const end=new Date(first+'T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);
  return first.slice(0,8)+String(Math.min(day,end.getUTCDate())).padStart(2,'0');
}
export function periodRange(month) {
  if(!/^\d{4}-\d{2}$/.test(month)||!validRepeatDate(month+'-01'))throw new Error('Choose a valid month.');
  return {startDate:month+'-01',endDate:monthDate(monthIndex(month),31)};
}
export function periodId(budget) {return budget.periodId??budget.period;}
export function nextPeriodId(budget) {
  const base=budget.endDate??(/^\d{4}-\d{2}$/.test(budget.period)?budget.period+'-01':null);
  if(!validRepeatDate(base))throw new Error('Confirm this period’s dates in Settings first.');
  return monthDate(monthIndex(base)+1).slice(0,7);
}
function bounds(period) {
  return period.startDate&&period.endDate?{startDate:period.startDate,endDate:period.endDate}:/^\d{4}-\d{2}$/.test(period.period)?periodRange(period.period):null;
}
function snapshot(budget) {return Object.fromEntries(periodFields.filter(k=>budget[k]!==undefined).map(k=>[k,budget[k]]));}
function applyPeriod(budget,period) {
  const next={...budget};for(const key of periodFields)delete next[key];return {...next,...period};
}
function freshPeriod(budget,id) {
  return {periodId:id,period:id,...periodRange(id),total:0,budgetSet:false,periodConfirmed:false,
    categories:budget.categories.map(c=>({...c,amount:0})),expenses:[]};
}
export function repeatDates(rule,from,to,limit=40000) {
  const start=from>rule.startDate?from:rule.startDate,end=rule.endDate&&rule.endDate<to?rule.endDate:to;
  if(start>end)return [];
  const anchor=rule.anchorDate??rule.startDate,dates=[],skipped=new Set(rule.skipped??[]);
  let index=rule.frequency==='weekly'?Math.max(0,Math.ceil((Date.parse(start)-Date.parse(anchor))/604800000))
    :rule.frequency==='monthly'?Math.max(0,monthIndex(start)-monthIndex(anchor)):Math.max(0,Number(start.slice(0,4))-Number(anchor.slice(0,4)));
  while(dates.length<limit) {
    let date;
    try { date=rule.frequency==='weekly'?dayAfter(anchor,index*7):monthDate(monthIndex(anchor)+index*(rule.frequency==='yearly'?12:1),Number(anchor.slice(8))); }
    catch {break;}
    if(date>end)break;
    if(date>=start&&!skipped.has(date))dates.push(date);
    index++;
  }
  return dates;
}
export function repeatTiming(budget,entry) {
  const rule=budget.repeatRules?.find(r=>r.id===entry.repeatId);if(!rule)return null;
  const series=(budget.repeatRules??[]).filter(r=>(r.seriesId??r.id)===(rule.seriesId??rule.id));
  const date=entry.occurrenceDate??entry.date;
  const next=date<'9999-12-31'?series.flatMap(r=>repeatDates(r,dayAfter(date),'9999-12-31',1)).sort()[0]??null:null;
  return {frequency:rule.frequency,startDate:rule.startDate,nextDate:next,endDate:series.some(r=>!r.endDate)?null:series.map(r=>r.endDate).sort().at(-1)};
}
function materialize(budget,period) {
  const range=bounds(period);if(!range)return period;
  const expenses=[...period.expenses],categories=[...period.categories],rules=budget.repeatRules??[];
  const identities=new Set(expenses.filter(e=>e.repeatId).map(e=>{
    const rule=rules.find(r=>r.id===e.repeatId);return `${rule?.seriesId??rule?.id}:${e.occurrenceDate}`;
  }));
  for(const rule of rules) {
    const dates=repeatDates(rule,range.startDate,range.endDate);
    if(!dates.length)continue;
    for(const date of dates) {
      const key=`${rule.seriesId??rule.id}:${date}`;
      if(identities.has(key))continue;
      // An existing occurrence may intentionally use a different category.
      // Resolve the template category only when adding a missing date.
      if(!categories.some(c=>c.id===rule.categoryId)) {
        const category=[budget,...(budget.periods??[])].flatMap(p=>p.categories).find(c=>c.id===rule.categoryId);
        if(!category)throw new Error('A repeating bill needs its category. Restore the category before opening this period.');
        categories.push({...category,amount:0});
      }
      expenses.push({id:`repeat:${key}`,repeatId:rule.id,occurrenceDate:date,categoryId:rule.categoryId,
        description:rule.description,amount:rule.amount,status:'planned',history:['planned'],date,notes:''});
      identities.add(key);
    }
  }
  return {...period,categories,expenses};
}
export function prepareRepeats(budget) {
  if(!budget.repeatRules?.length)return budget;
  let next={...budget,...materialize(budget,snapshot(budget)),periods:[...(budget.periods??[])]};
  const id=nextPeriodId(next);
  if(!next.periods.some(p=>periodId(p)===id))next.periods.push(freshPeriod(next,id));
  next.periods=next.periods.map(p=>materialize(next,p));
  return validateBudget(next);
}
export function openPeriod(budget,id,dates) {
  if(id===periodId(budget))return prepareRepeats(budget);
  let target=budget.periods?.find(p=>periodId(p)===id)??freshPeriod(budget,id);
  const beforeTarget=target;
  if(dates) {
    if(!validRepeatDate(dates.startDate)||!validRepeatDate(dates.endDate)||dates.startDate>dates.endDate)throw new Error('Choose valid period dates. End must not precede start.');
    const excluded=target.expenses.filter(e=>e.date<dates.startDate||e.date>dates.endDate);
    if(excluded.some(e=>!e.repeatId||e.status!=='planned'))throw new Error('These dates exclude an existing entry. Keep its date in the period; Committed and Paid records cannot be removed by changing dates.');
    target={...target,...dates,periodConfirmed:true,expenses:target.expenses.filter(e=>!excluded.includes(e))};
  }
  const targetRange=bounds(target);
  if(targetRange&&[budget,...(budget.periods??[])].filter(p=>periodId(p)!==id).some(p=>{
    const range=bounds(p);return range&&targetRange.startDate<=range.endDate&&targetRange.endDate>=range.startDate;
  }))throw new Error('These dates overlap another budget period. Choose dates after the previous period ends.');
  const periods=[...(budget.periods??[]).filter(p=>periodId(p)!==id),{...snapshot(budget),periodId:periodId(budget)}];
  let next=validateBudget({...applyPeriod(budget,target),periods});
  if(dates)next=audit(next,`Confirmed ${target.period} dates: ${dates.startDate} — ${dates.endDate}. Out-of-range Planned drafts kept in the audit trail.`,beforeTarget,target);
  return prepareRepeats(next);
}
const audit=(budget,text,before,after)=>({...budget,events:[...budget.events,{text,at:new Date().toISOString(),before,after}]});
function mapPeriods(budget,fn) {return {...budget,...fn(snapshot(budget)),periods:(budget.periods??[]).map(fn)};}

export function saveRepeatingEntry(budget,entry,options={frequency:'none'}) {
  const before=budget.expenses.find(e=>e.id===entry.id);
  const range=bounds(budget);
  if(range&&(!before||before.date!==entry.date)&&(entry.date<range.startDate||entry.date>range.endDate))throw new Error('Choose an entry date within the viewing period, or open the right period first.');
  let next=before?editExpense(budget,entry.id,entry):{...budget,expenses:[...budget.expenses,entry]};
  if(!before)next=audit(next,`Added ${entry.description} · ${entry.status}`,undefined,entry);
  const old=budget.repeatRules?.find(r=>r.id===before?.repeatId);
  if(old&&options.scope!=='future')return prepareRepeats(validateBudget(next));
  if(options.frequency==='none')return validateBudget(next);
  const startDate=old?entry.date:options.startDate??entry.date;
  if(!validRepeatDate(startDate)||!frequencies.includes(options.frequency)||
    (options.endDate&&(!validRepeatDate(options.endDate)||options.endDate<startDate)))
    throw new Error('Choose a valid repeat start and end date. End must not precede start.');
  if(!old&&entry.date!==startDate)throw new Error('The first bill date must match the repeat start date.');
  const id=crypto.randomUUID(),cutoff=before?.occurrenceDate??entry.date;
  const series=old?.seriesId??old?.id;
  const replaced=new Set(old?(next.repeatRules??[]).filter(r=>(r.seriesId??r.id)===series&&(!r.endDate||r.endDate>=cutoff)).map(r=>r.id):[]);
  const rule={id,seriesId:old?.seriesId??old?.id??id,frequency:options.frequency,startDate,
    anchorDate:old&&old.frequency===options.frequency&&entry.date===before.date?old.anchorDate??old.startDate:startDate,
    ...(options.endDate?{endDate:options.endDate}:{}),description:entry.description.trim(),amount:entry.amount,categoryId:entry.categoryId,
    skipped:old?[...new Set((next.repeatRules??[]).filter(r=>(r.seriesId??r.id)===series).flatMap(r=>r.skipped??[]).filter(d=>d>=startDate))]:[]};
  next={...next,repeatRules:[...(next.repeatRules??[]).map(r=>replaced.has(r.id)?{...r,endDate:dayAfter(cutoff,-1)}:r),rule]};
  const changedOccurrences=[];
  if(old)next=mapPeriods(next,p=>({...p,expenses:p.expenses.flatMap(e=>{
    if(e.id!==entry.id&&next.repeatRules.some(r=>r.id===e.repeatId&&(r.seriesId??r.id)===series)&&e.occurrenceDate===startDate) {
      if(e.status!=='planned')throw new Error('A Committed or Paid repeat already exists on this date. Choose another bill date; its history will stay unchanged.');
      changedOccurrences.push(e);return [];
    }
    if(e.id===entry.id||!replaced.has(e.repeatId)||e.status!=='planned'||e.occurrenceDate<cutoff)return [e];
    changedOccurrences.push(e);
    // Keep occurrence identity and its own receipt note when the date survives.
    // Removed schedule dates remain recoverable in this edit's audit snapshot.
    return repeatDates(rule,e.occurrenceDate,e.occurrenceDate).length
      ?[{...e,repeatId:id,description:rule.description,amount:rule.amount,categoryId:rule.categoryId}]:[];
  })}));
  next={...next,expenses:next.expenses.map(e=>e.id===entry.id?{...e,repeatId:id,occurrenceDate:startDate}:e)};
  return prepareRepeats(audit(next,old?`Updated ${entry.description}: this and future repeats. Earlier records and Committed/Paid entries kept.`:`Repeating ${entry.description} ${rule.frequency}. Future entries start Planned.`,old?{rule:old,occurrences:changedOccurrences}:null,rule));
}
export function skipOccurrence(budget,id) {
  const entry=budget.expenses.find(e=>e.id===id);
  if(!entry?.repeatId||entry.status!=='planned')throw new Error('Only a Planned repeat can be skipped. Correct a Committed or Paid entry instead.');
  return prepareRepeats(removeExpense(budget,id));
}
export function stopRepeating(budget,id) {
  const entry=budget.expenses.find(e=>e.id===id),rule=budget.repeatRules?.find(r=>r.id===entry?.repeatId);
  if(!rule)return budget;
  const cutoff=entry.occurrenceDate??entry.date,series=rule.seriesId??rule.id;
  const ids=new Set(budget.repeatRules.filter(r=>(r.seriesId??r.id)===series).map(r=>r.id));
  let next=mapPeriods(budget,p=>({...p,expenses:p.expenses.filter(e=>!ids.has(e.repeatId)||e.status!=='planned'||e.id===id||e.occurrenceDate<=cutoff)}));
  next={...next,repeatRules:next.repeatRules.map(r=>ids.has(r.id)?{...r,endDate:r.endDate&&r.endDate<cutoff?r.endDate:cutoff}:r)};
  return validateBudget(audit(next,`Stopped repeating ${entry.description} after ${cutoff}. Later Planned entries removed; history kept.`,rule,next.repeatRules.find(r=>r.id===rule.id)));
}

export function validateRepeatData(budget,validatePeriod) {
  const rules=budget.repeatRules??[],periods=budget.periods??[];
  if(!Array.isArray(rules)||!Array.isArray(periods)||rules.length>10000||periods.length>1200)throw new Error('Could not read repeat rules or budget periods.');
  const ids=new Set();
  for(const r of rules) {
    if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||!frequencies.includes(r.frequency)||!validRepeatDate(r.startDate)||
      (r.anchorDate!==undefined&&(!validRepeatDate(r.anchorDate)||r.anchorDate>r.startDate))||
      (r.endDate!==undefined&&!validRepeatDate(r.endDate))||typeof r.description!=='string'||!r.description.trim()||r.description.length>100||
      typeof r.categoryId!=='string'||typeof r.amount!=='number'||!Number.isFinite(r.amount)||r.amount<=0||r.amount>1e9||
      (r.seriesId!==undefined&&(typeof r.seriesId!=='string'||!r.seriesId))||!Array.isArray(r.skipped)||!r.skipped.every(validRepeatDate)||new Set(r.skipped).size!==r.skipped.length)
      throw new Error('Could not read a repeat rule in this backup.');
    ids.add(r.id);
  }
  const keys=new Set([periodId(budget)]),occurrences=new Set();
  for(const period of [budget,...periods]) {
    if(period!==budget) {
      if(!period||typeof period.periodId!=='string'||!period.periodId||keys.has(period.periodId)||Object.keys(period).some(k=>!periodFields.includes(k)))throw new Error('Could not read budget periods in this backup.');
      keys.add(period.periodId);
      const {periods:unused,repeatRules:unusedRules,...base}=budget;void unused;void unusedRules;
      validatePeriod(applyPeriod(base,period));
    }
    if((period.budgetSet!==undefined&&typeof period.budgetSet!=='boolean')||(period.periodConfirmed!==undefined&&typeof period.periodConfirmed!=='boolean'))throw new Error('Could not read period confirmation.');
    for(const e of period.expenses) {
      if(e.repeatId===undefined&&e.occurrenceDate===undefined)continue;
      const rule=rules.find(r=>r.id===e.repeatId),key=`${rule?.seriesId??rule?.id}:${e.occurrenceDate}`;
      if(!rule||!validRepeatDate(e.occurrenceDate)||occurrences.has(key))throw new Error('Could not read a repeating occurrence in this backup.');
      occurrences.add(key);
    }
  }
}
