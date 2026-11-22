"use client";

import {useState,type FormEvent} from 'react';
import {money,round,type Budget} from './model.mjs';
import {budgetMonth,previewBudgetStart,type BudgetStartDraft,type BudgetStartPreview} from './carryover-model.mjs';
import {BudgetStatus,NodeGlyph} from './project-garden';
import {displayDate} from './repeat-entry';
import './carryover.css';

const signed=(n:number)=>(n<0?'−':'+')+money(Math.abs(n));
type Props={budget:Budget;onCancel:()=>void;onConfirm:(draft:BudgetStartDraft)=>string|null};
export default function BudgetStartReview(props:Props) {
 let preview:BudgetStartPreview;
 try {preview=previewBudgetStart(props.budget);}
 catch(error){return <section className="carryover-unavailable paper"><h2>A little more setup first</h2><p role="alert">{error instanceof Error?error.message:'Could not open this review.'}</p><button className="outline-button" onClick={props.onCancel}>Back to board</button></section>;}
 return <Review {...props} preview={preview}/>;
}
function Review({budget,preview,onCancel,onConfirm}:Props&{preview:BudgetStartPreview}) {
 const [review,setReview]=useState(preview);
 const [baseTotal,setBaseTotal]=useState(String(preview.baseTotal));
 const [bases,setBases]=useState<Record<string,string>>(()=>Object.fromEntries(preview.rows.map(r=>[r.category.id,String(r.base)])));
 const [selected,setSelected]=useState<string[]>(()=>preview.rows.filter(r=>r.selected).map(r=>r.category.id));
 const [error,setError]=useState('');
 const old=preview.revision!==review.revision;
 const base=round(baseTotal),carry=round(review.rows.filter(r=>selected.includes(r.category.id)).reduce((s,r)=>s+r.room,0));
 const proposed=round(base+carry),allocated=round(review.rows.reduce((s,r)=>s+round(bases[r.category.id]||0)+(selected.includes(r.category.id)?r.room:0),0));
 const sourceName=budgetMonth(review.source),targetName=budgetMonth(budget);
 const large=[base,carry,proposed,allocated,...review.rows.flatMap(r=>[r.room,r.sourceAllocation,r.paid,r.committed,round(bases[r.category.id]||0),round(round(bases[r.category.id]||0)+(selected.includes(r.category.id)?r.room:0))])].some(n=>money(n).length>13);
 const action=review.adjustment?'Approve budget adjustment':`${budget.profile==='Team'?'Approve':'Set'} ${targetName.replace(/ \d{4}$/,'')} budget`;
 function submit(event:FormEvent) {
  event.preventDefault();
  const problem=onConfirm({revision:review.revision,baseTotal:Number(baseTotal),baseAmounts:Object.fromEntries(Object.entries(bases).map(([id,value])=>[id,Number(value)])),carryIds:selected});
  if(problem){setError(problem);requestAnimationFrame(()=>document.getElementById('carryover-error')?.focus());}
 }
 function reload() {setReview(preview);setBaseTotal(String(preview.baseTotal));setBases(Object.fromEntries(preview.rows.map(r=>[r.category.id,String(r.base)])));setSelected(preview.rows.filter(r=>r.selected).map(r=>r.category.id));setError('');}
 return <div className="carryover-workspace">
  <aside className="carryover-context"><div className="carryover-book"><NodeGlyph kind="project"/><h2>{budget.name}</h2><span>{budget.profile} · USD</span></div><div className="carryover-stem"/><article className="garden-budget garden-node"><BudgetStatus budget={budget}/></article><p>{review.adjustment?'Your approved amounts stay unchanged until you approve an adjustment.':'This stays Not set until you confirm your new budget.'}</p></aside>
  <form className={`carryover-review${large?' has-large-money':''}`} onSubmit={submit}>
   <header className="carryover-heading"><div><h2>{review.adjustment?'Review your carryover':'Make this month your own'}</h2><span>Review & {budget.profile==='Team'?'approve':'set budget'}</span></div><p>{review.adjustment?'Review a new approved adjustment. Earlier approvals stay in your book.':'Reuse your category amounts. Choose what to carry over, then confirm your new budget.'}</p><div className="carryover-periods"><div><strong>{sourceName}</strong><span>{displayDate(review.source.startDate!)} – {displayDate(review.source.endDate!)}</span></div><span aria-hidden="true">→</span><div><strong>{targetName}</strong><span>{displayDate(budget.startDate!)} – {displayDate(budget.endDate!)}</span></div></div></header>
   <section className="carryover-body" aria-labelledby="carryover-categories"><div className="carryover-section-heading"><h2 id="carryover-categories">Carryover by category</h2><span>Optional · {selected.length} selected</span></div><p className="carryover-explainer">Previous room = allocation − Paid − open Committed.<br/>Nothing carries over unless you choose it.</p>
    {!review.available&&<p className="carryover-notice" role="status">Final carryover is available after {displayDate(review.source.endDate!)}. Copy base amounts now; review carryover in Budget details later.</p>}
    {review.changed&&<p className="carryover-notice">{sourceName} changed. Review these balances; your approved budget has not changed.</p>}
    {old&&<div className="carryover-notice" role="alert"><p>This month or the previous month changed. Reload the amounts before confirming.</p><button className="outline-button" type="button" onClick={reload}>Review latest amounts</button></div>}
    <div className="carryover-columns" aria-hidden="true"><span>Category · previous spending</span><span>New base</span><span>Previous room</span><span>Carry over</span><span>New total</span></div>
    {review.rows.map(r=>{const id=r.category.id,on=selected.includes(id),result=round(round(bases[id]||0)+(on?r.room:0));return <section className="carryover-row" key={id} aria-label={r.category.name}>
     <div className="carryover-source"><h3>{r.category.name}</h3><p>Previous allocation <span className="money">{money(r.sourceAllocation)}</span></p><p>Paid <span className="money">{money(r.paid)}</span><span className="carryover-source-divider"> · </span><span>Committed <span className="money">{money(r.committed)}</span></span></p>{budget.profile==='Team'&&<p>{r.category.owner?`Owner: ${r.category.owner}`:'No owner'}{r.category.glCode?` · Finance code ${r.category.glCode}`:''}</p>}</div>
     <label className="carryover-base"><span>New base<span className="sr-only"> for {r.category.name}</span></span><input className="money" type="number" inputMode="decimal" required min="0" max="1000000000" step="0.01" value={bases[id]} onChange={e=>setBases({...bases,[id]:e.target.value})}/></label>
     <div className={`carryover-room ${r.room<0?'negative':''}`}><span className="carryover-mobile-label">Previous room</span><strong className="money">{r.room===0?money(0):signed(r.room)}</strong>{r.room<0&&<small>Overspent</small>}</div>
     {r.room===0?<span className="carryover-no-change">No change</span>:<button className={`outline-button carryover-toggle${on?' is-on':''}`} type="button" aria-label={`Carry over ${r.category.name}`} aria-pressed={on} disabled={!review.available||old} onClick={()=>setSelected(on?selected.filter(c=>c!==id):[...selected,id])}><span aria-hidden="true" className="carryover-check">{on?'✓':''}</span>{on?'On':'Off'}</button>}
     <div className={`carryover-result ${result<0?'negative':''}`}><span className="carryover-mobile-label">New total</span><strong className="money">{money(result)}</strong></div>
    </section>;})}
    <p className="carryover-explainer carryover-footnote"><NodeGlyph kind="planned"/><span>Planned estimates are not deducted. Previous entries stay in their month; this month’s repeats stay Planned.</span></p>
   </section>
   <section className="carryover-summary" aria-label="Proposed budget"><div className="carryover-equation"><label><span>{review.adjustment?'Base before carryover':'Base budget'}<span className="sr-only"> USD</span></span><input className="money" type="number" inputMode="decimal" min="0.01" max="1000000000" step="0.01" required value={baseTotal} onChange={e=>setBaseTotal(e.target.value)}/></label><span aria-hidden="true">+</span><div><span>Selected carryover</span><strong className="money">{signed(carry)}</strong></div><span aria-hidden="true">=</span><div className="carryover-final"><span>Budget to {budget.profile==='Team'||review.adjustment?'approve':'set'}</span><strong className="money">{money(proposed)}</strong></div></div><p>{money(allocated)} allocated. <span className={proposed<allocated?'negative':''}>{money(round(proposed-allocated))} unallocated.</span></p></section>
   <footer className="carryover-confirm"><p>{review.adjustment?'Approving this replaces the earlier carryover, not adds it twice.':'Confirming this sets this month’s Approved Budget.'} {sourceName} stays unchanged.</p>{error&&<p className="form-error" role="alert" id="carryover-error" tabIndex={-1}>{error}</p>}<div><button className="outline-button" type="button" onClick={onCancel}>Cancel</button><button className="primary" type="submit" disabled={old}>{action}<span aria-hidden="true">→</span></button></div></footer>
  </form>
 </div>;
}
