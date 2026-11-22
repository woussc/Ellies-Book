"use client";

import {repeatDates,repeatTiming,type RepeatOptions,type RepeatRule} from './repeat-model.mjs';
import type {Budget,Expense} from './model.mjs';
import './repeat-entry.css';

export function displayDate(date:string) {
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));
}
export function RepeatTiming({budget,entry}:{budget:Budget;entry:Expense}) {
  const timing=repeatTiming(budget,entry);if(!timing)return null;
  return <span className="repeat-timing">
    <span className="repeat-cadence"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/></svg>Repeats {timing.frequency}</span>
    <span className="repeat-dates">
      <span><small>Amount starts</small><time dateTime={timing.startDate}>{displayDate(timing.startDate)}</time></span>
      <span><small>Next bill</small>{timing.nextDate?<time dateTime={timing.nextDate}>{displayDate(timing.nextDate)}</time>:<span>No further bills</span>}</span>
      <span><small>Ends</small>{timing.endDate?<time dateTime={timing.endDate}>{displayDate(timing.endDate)}</time>:<span>No end date</span>}</span>
    </span>
  </span>;
}
export function RepeatEditor({value,onChange,date,rule}:{value:RepeatOptions;onChange:(next:RepeatOptions)=>void;date:string;rule?:RepeatRule}) {
  const locked=!!rule&&value.scope!=='future';
  let nextDate:string|undefined;
  if(value.frequency!=='none'&&date) {
    const preview={id:'preview',frequency:value.frequency,startDate:date,...(value.endDate?{endDate:value.endDate}:{}),skipped:[]};
    nextDate=repeatDates(preview,date,'9999-12-31',2).find(d=>d>date);
  }
  return <fieldset className="repeat-editor"><legend>Repeat this entry</legend>
    {rule&&<label className="field">Apply changes to<select value={value.scope??'this'} onChange={e=>onChange({...value,scope:e.target.value as 'this'|'future'})}><option value="this">This entry only</option><option value="future">This and future repeats</option></select></label>}
    {locked?<p className="hint">Repeats {rule.frequency}. Changes here affect this entry only. Choose “This and future repeats” to change the amount or schedule going forward.</p>:<>
      <div className="form-pair repeat-pair"><label className="field">Repeat<select value={value.frequency} onChange={e=>onChange({...value,frequency:e.target.value as RepeatOptions['frequency']})}>
        {!rule&&<option value="none">Does not repeat</option>}<option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
      </select></label>
      {value.frequency!=='none'&&<label className="field">End repeat<select value={value.endDate===undefined?'date':value.endDate?'date':'never'} onChange={e=>onChange({...value,endDate:e.target.value==='never'?'':undefined})}><option value="never">No end date</option><option value="date">On a date</option></select></label>}</div>
      {value.frequency!=='none'&&value.endDate!==''&&<label className="field repeat-end-date">Last bill date<input required type="date" min={date} value={value.endDate??''} onChange={e=>onChange({...value,endDate:e.target.value})}/></label>}
      {value.frequency!=='none'&&<div className="repeat-preview"><strong>{nextDate?`Next: ${displayDate(nextDate)} · Planned`:'No further bills after this entry.'}</strong><p>The amount starts on this entry’s date. Future repeats start as Planned, not Paid. Each period has its own budget to confirm. Receipt notes stay with this entry.</p></div>}
    </>}
  </fieldset>;
}
