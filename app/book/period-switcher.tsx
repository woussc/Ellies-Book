"use client";

import {useEffect,useRef,useState} from 'react';
import type {Budget} from './model.mjs';
import {nextPeriodId,periodId,periodRange,type BudgetPeriod} from './repeat-model.mjs';
import {displayDate} from './repeat-entry';
import {budgetMonth,previousBudgetPeriod} from './carryover-model.mjs';

function monthName(id:string) {
  return /^\d{4}-\d{2}$/.test(id)?new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(id+'-01T00:00:00Z')):id;
}
export default function PeriodSwitcher({budget,onOpen,onSettings,onStart}:{budget:Budget;onOpen:(id:string,dates?:{startDate:string;endDate:string})=>boolean;onSettings:()=>void;onStart:()=>void}) {
  const [pending,setPending]=useState<BudgetPeriod|null>(null);
  let upcoming:string|null=null;try {upcoming=nextPeriodId(budget);}catch{/* Old undated books keep their date-confirmation path. */}
  const options=[{...budget,periodId:periodId(budget)},...(budget.periods??[])].sort((a,b)=>(a.startDate??a.period).localeCompare(b.startDate??b.period));
  const source=previousBudgetPeriod(budget);
  function select(id:string) {
    const period=options.find(p=>p.periodId===id);
    if(!period||period.periodConfirmed===false) {
      setPending(period??{periodId:id,period:id,...periodRange(id),total:0,categories:[],expenses:[]});return;
    }
    onOpen(id);
  }
  return <section className="period-switcher" aria-label="Budget period navigation">
    <div className="period-controls"><label className="field">Viewing period<select aria-label="Viewing period" value={periodId(budget)} onChange={e=>select(e.target.value)}>{options.map(p=><option key={p.periodId} value={p.periodId}>{monthName(p.period)}{p.periodConfirmed===false?' · Planned ahead':''}</option>)}</select></label>
    {upcoming?<button className="outline-button" onClick={()=>select(upcoming)}>Next period <span aria-hidden="true">→</span></button>:<button className="outline-button" onClick={onSettings}>Confirm period dates</button>}</div>
    {budget.budgetSet===false&&<div className="period-budget-notice"><p>{source?'A new month, a familiar starting point. Reuse the previous month’s amounts, or start fresh.':'Planned ahead. Set this period’s budget and category allocations before using Room left.'} This period’s Approved Budget is Not set.</p><div className="carryover-actions"><button className="outline-button" onClick={onSettings}>{source?'Start fresh':'Set period budget'}</button>{source&&<button className="primary" onClick={onStart}>Start from {budgetMonth(source).replace(/ \d{4}$/,'')}</button>}</div></div>}
    {pending&&<ConfirmPeriod key={pending.periodId} period={pending} onClose={()=>setPending(null)} onOpen={(dates)=>{if(onOpen(pending.periodId,dates))setPending(null);}}/>}
  </section>;
}
function ConfirmPeriod({period,onClose,onOpen}:{period:BudgetPeriod;onClose:()=>void;onOpen:(dates:{startDate:string;endDate:string})=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [startDate,setStartDate]=useState(period.startDate??''),[endDate,setEndDate]=useState(period.endDate??'');
  useEffect(()=>{const trigger=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.showModal();return()=>{document.body.style.overflow=overflow;trigger?.focus({preventScroll:true});};},[]);
  return <dialog className="garden-dialog repeat-period-dialog" ref={dialog} aria-labelledby="repeat-period-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><h1 id="repeat-period-title">Open {monthName(period.period)}?</h1><button className="outline-button" onClick={onClose}>Cancel</button></header>
    <form className="garden-dialog-body" onSubmit={e=>{e.preventDefault();onOpen({startDate,endDate});}}>
      <p>Confirm the next period’s dates. This does not extend your current budget or copy its approved limit. Repeating bills appear as Planned; previous payments stay in their period.</p>
      <div className="form-pair budget-dates"><label className="field">Period starts<input required type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="field">Period ends<input required type="date" min={startDate} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div>
      <p className="hint">{startDate&&endDate?`${displayDate(startDate)} — ${displayDate(endDate)}`:'Choose both dates.'}</p><button className="primary" type="submit">Open planned period</button>
    </form>
  </dialog>;
}
