"use client";
import {useEffect, useRef, useState} from 'react';
import type {Budget} from './model.mjs';
import {money} from './model.mjs';
import {rememberPayee, payeeRule, changePayeeRule, removePayeeRule, undoPayeeRule, type PayeeRule} from './auto-sort-model.mjs';
import './auto-sort.css';
export type LearnPayee = {payee:string;categoryId:string;description:string;amount:number};
export default function AutoSort({budget,bookName,offer,onDismiss,save,disabled}:{budget:Budget;bookName:string;offer:LearnPayee|null;onDismiss:()=>void;save:(change:(b:Budget)=>Budget)=>void;disabled:boolean}) {
  const [error,setError]=useState(''),[undo,setUndo]=useState<{before:PayeeRule|null;after:PayeeRule|null;message:string}|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const rules=(budget.autoSortRules??[]).filter(r=>r.profile===budget.profile);
  const existing=offer?payeeRule(budget,offer.payee):null;
  const category=budget.categories.find(c=>c.id===offer?.categoryId);
  useEffect(()=>{if(offer){heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'center',behavior:'instant'});}},[offer]);
  function run(change:(b:Budget)=>Budget,message:string) {
    setError('');
    let before:PayeeRule|null=null,after:PayeeRule|null=null;
    try {
      save(b=>{const next=change(b);const event=next.events.at(-1)!;before=event.before as PayeeRule|null;after=event.after as PayeeRule|null;return next;});
      setUndo({before,after,message});return true;
    } catch(e) {setError(e instanceof Error?e.message:'Could not save this rule. Try again.');return false;}
  }
  return <section className="auto-sort" aria-label="Auto-sort">
    {offer&&category&&<div className="paper auto-sort-offer">
      <p className="hint">Saved · {offer.description} · <span className="auto-sort-money">{money(offer.amount)}</span></p>
      <h2 ref={heading} tabIndex={-1}>{existing?'Update your rule?':`Always put ${offer.payee} in ${category.name}?`}</h2>
      <p>{existing?`Use ${category.name} for ${offer.payee} next time? Your other entries stay as they are.`:'Choose once. Next time, we’ll suggest this category. You can still change it.'}</p>
      <p className="hint">{budget.name} in {bookName} only · Across months</p>
      <div className="auto-sort-actions"><button className="primary" disabled={disabled} onClick={()=>{if(run(b=>rememberPayee(b,offer.payee,offer.categoryId),`Rule saved for ${offer.payee}.`))onDismiss();}}>{existing?'Update rule':'Yes, remember this'}</button><button className="secondary" onClick={()=>{onDismiss();setError('');}}>Not now</button></div>
    </div>}
    {undo&&<div className="auto-sort-feedback" role="status"><p>{undo.message} Saved entries are unchanged.</p><button className="secondary" disabled={disabled} onClick={()=>{try{save(b=>undoPayeeRule(b,undo.before,undo.after));setUndo(null);setError('');}catch(e){setError(e instanceof Error?e.message:'Could not undo this change.');}}}>Undo</button></div>}
    {error&&<p className="error" role="alert">{error}</p>}
    <details className="paper auto-sort-manager"><summary>Auto-sort{rules.length?` · ${rules.length} ${rules.length===1?'rule':'rules'}`:''}</summary>
      <p className="hint">{budget.name} in {bookName} only · Across months. Exact payees, ignoring case and extra spaces. No other books or modes are changed.</p>
      {!rules.length&&<p>No rules yet. Add a payee and choose a category when you save an entry. We’ll offer to remember it.</p>}
      {rules.map(rule=>{const missing=!budget.categories.some(c=>c.id===rule.categoryId);return <div className="auto-sort-rule" key={rule.id}>
        <div><h3>{rule.payee}</h3><p className="hint">{missing?'Paused · Category no longer available':rule.paused?'Paused':'Suggesting this category'}</p></div>
        <label className="field">Category for {rule.payee}<select disabled={disabled} value={rule.categoryId} onChange={e=>run(b=>changePayeeRule(b,rule.id,{categoryId:e.target.value}),`Category changed for ${rule.payee}.`)}>{missing&&<option value={rule.categoryId}>Choose a category</option>}{budget.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="auto-sort-actions"><button className="secondary" disabled={disabled||missing} onClick={()=>run(b=>changePayeeRule(b,rule.id,{paused:!rule.paused}),`${rule.payee} ${rule.paused?'resumed':'paused'}.`)} aria-label={`${rule.paused?'Resume':'Pause'} ${rule.payee} rule`}>{rule.paused?'Resume':'Pause'}</button><button className="secondary" disabled={disabled} aria-label={`Remove ${rule.payee} rule`} onClick={()=>run(b=>removePayeeRule(b,rule.id),`Rule removed for ${rule.payee}.`)}>Remove</button></div>
      </div>;})}
      <p className="hint">Rules only suggest a category. They never add payments, move old entries or change amounts.</p>
    </details>
  </section>;
}
