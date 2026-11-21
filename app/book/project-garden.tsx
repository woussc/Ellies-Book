"use client";

import {useEffect, useRef, useState, type SetStateAction, type ReactNode} from "react";
import {money, totals, type Budget, type Expense} from "./model.mjs";
import {changeBoard, resolveNoteLink} from "./board-model.mjs";
import {gardenView, resizeGarden, gardenLinks, type GardenRect} from "./garden-model.mjs";
import {renderMarkdownDocument} from "../markdown-render";
import "./project-garden.css";

const marks: Record<string,ReactNode> = {
  project:<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>,
  category:<>{[[3,3],[14,3],[3,14],[14,14]].map(([x,y])=><rect key={`${x}:${y}`} x={x} y={y} width="7" height="7" rx="1.8"/>)}</>,
  budget:<><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M17 13h4v4h-4a2 2 0 0 1 0-4Z"/></>,
  entry:<path d="M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 8h6M9 12h6"/>,
  note:<path d="M5 3h9l5 5v13H5ZM14 3v5h5M8 12h8M8 16h6"/>,
  planned:<><circle cx="12" cy="12" r="9" strokeDasharray="2.5 3.2"/><path d="M9 12h6"/></>,
  committed:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  paid:<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  alert:<path d="M10.3 4.4a2 2 0 0 1 3.4 0l7.5 13A2 2 0 0 1 19.5 20h-15a2 2 0 0 1-1.7-2.6ZM12 9v4M12 16h.01"/>,
};
export function NodeGlyph({kind}:{kind:string}) {
  return <svg className="node-glyph" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={['planned','paid','committed','alert'].includes(kind)?2:1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{marks[kind]}</svg>;
}
function Stage({value}:{value:string}) {
  return <span className={`garden-stage ${value}`}><NodeGlyph kind={value}/>{value[0].toUpperCase()+value.slice(1)}</span>;
}
function BudgetStatus({budget}:{budget:Budget}) {
  const t=gardenView(budget).summary;
  const large=[budget.total,t.planned,t.spent,t.committed,t.left].some(v=>money(v).length>11);
  return <>
    <h2><NodeGlyph kind="budget"/>Budget status</h2>
    <p className="garden-period">{budget.startDate && budget.endDate ? `${budget.startDate} — ${budget.endDate}` : `${budget.period} · Dates need confirmation`}<span>USD</span></p>
    <div className="garden-approved"><span>Approved Budget</span><strong className="money">{money(budget.total)}</strong></div>
    <dl className={`garden-metrics${large?' has-large-money':''}`}>
      <div><dt><Stage value="planned"/></dt><dd className="money">{money(t.planned)}</dd></div>
      <div><dt><Stage value="paid"/></dt><dd className="money">{money(t.spent)}</dd></div>
      <div><dt><Stage value="committed"/></dt><dd className="money">{money(t.committed)}</dd></div>
      <div className={t.left<0?'negative':''}><dt><NodeGlyph kind={t.left<0?'alert':'budget'}/>{t.left<0?'Over by':'Room left'}</dt><dd className="money">{money(Math.abs(t.left))}</dd></div>
    </dl>
  </>;
}
type Props = {
  budget: Budget; scope: string; storageError: boolean;
  setBudget: (next: SetStateAction<Budget>)=>boolean;
  onPlan:()=>void; onSettings:()=>void; onSpend:(id?:string)=>void;
  onExpense:(entry:Expense)=>void; onReport:()=>void; onBackup:()=>void;
};
export default function ProjectGarden({budget,scope,setBudget,onPlan,onSettings,onSpend,onExpense,onReport,onBackup,storageError}:Props) {
  const [categoryId,setCategoryId]=useState<string|null>(null), [page,setPage]=useState(0);
  const [detail,setDetail]=useState<string|null>(null), [legend,setLegend]=useState(false);
  const [arrange,setArrange]=useState(false), [message,setMessage]=useState("");
  const view=gardenView(budget,categoryId,page), canvas=useRef<HTMLDivElement>(null);
  const [lines,setLines]=useState<{key:string;path:string}[]>([]);
  const drag=useRef<{id:string;x:number;y:number;button:HTMLElement}|null>(null);
  const [dragId,setDragId]=useState<string|null>(null);
  const displayed=view.category?[view.category]:view.categories;
  function focus(id:string|null) {setCategoryId(id);setPage(0);setArrange(false);}
  function save(next:Budget) {const ok=setBudget(next);setMessage(ok?'Arrangement saved. Money is unchanged.':'Arrangement is not saved. Download a backup before leaving.');}
  function size(id:string) {save(resizeGarden(budget,id,budget.board?.canvas?.sizes[id]==='large'?'medium':'large'));}
  function reorder(id:string,before:string) {save(changeBoard(budget,{type:'node',id,before}));}
  function localControls(id:string, index?:number) {
    return <div className="garden-local-controls">
      <button className="outline-button" aria-label={`Resize ${id.replace('category:','')}`} onClick={()=>size(id)}>{budget.board?.canvas?.sizes[id]==='large'?'Smaller':'Larger'}</button>
      {index!==undefined && <>
        <button className="outline-button" disabled={index===0} aria-label="Move category earlier" onClick={()=>reorder(id.slice(9),view.categories[index-1].id)}>Earlier</button>
        <button className="outline-button" disabled={index===view.categories.length-1} aria-label="Move category later" onClick={()=>{const next=view.categories[index+1];reorder(next.id,id.slice(9));}}>Later</button>
        <button className="outline-button garden-drag" aria-label="Drag category to shuffle" onPointerDown={e=>{
          e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:id.slice(9),x:e.clientX,y:e.clientY,button:e.currentTarget};setDragId(id.slice(9));
        }} onPointerMove={e=>{
          if (!drag.current) return;
          const el=drag.current.button.closest<HTMLElement>('.garden-branch');
          if (el) el.style.transform=`translate(${e.clientX-drag.current.x}px, ${e.clientY-drag.current.y}px)`;
        }} onPointerUp={e=>{
          const active=drag.current;if(!active)return;
          const el=active.button.closest<HTMLElement>('.garden-branch');if(el)el.style.transform='';
          const target=document.elementsFromPoint(e.clientX,e.clientY).map(n=>n.closest<HTMLElement>('[data-category-id]')).find(n=>n?.dataset.categoryId!==active.id);
          if(target?.dataset.categoryId)reorder(active.id,target.dataset.categoryId);
          drag.current=null;setDragId(null);
        }} onPointerCancel={()=>{const el=drag.current?.button.closest<HTMLElement>('.garden-branch');if(el)el.style.transform='';drag.current=null;setDragId(null);}}>Drag</button>
      </>}
    </div>;
  }
  useEffect(()=>{
    const root=canvas.current;if(!root)return;
    function measure() {
      if(!root)return;const origin=root.getBoundingClientRect();
      const rects:Record<string,GardenRect>={};
      root.querySelectorAll<HTMLElement>('[data-garden-node]').forEach(el=>{
        const r=el.getBoundingClientRect(),branch=el.closest('.garden-branch')?.getBoundingClientRect();
        rects[el.dataset.gardenNode!]={x:r.x-origin.x+root.scrollLeft,y:r.y-origin.y+root.scrollTop,w:r.width,h:r.height,rowY:branch?branch.y-origin.y+root.scrollTop:undefined};
      });
      setLines(gardenLinks(rects,displayed.map(c=>'category:'+c.id),view.entries));
    }
    const ro=new ResizeObserver(measure);ro.observe(root);root.querySelectorAll('[data-garden-node]').forEach(n=>ro.observe(n));
    let alive=true;void document.fonts.ready.then(()=>{if(alive)measure();});measure();
    return ()=>{alive=false;ro.disconnect();};
  // The signature tracks layout changes, not the identities of the projected arrays.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[budget,categoryId,page,arrange]);
  return <div className="project-garden">
    <div className="garden-scope"><button className="outline-button" onClick={()=>setDetail('project')}><NodeGlyph kind="project"/>{scope}</button><span>USD</span></div>
    <div className="garden-toolbar" role="group" aria-label="Board controls">
      {view.category && <button className="outline-button" onClick={()=>focus(null)}>Show categories</button>}
      <button className="outline-button" aria-pressed={arrange} onClick={()=>{setArrange(!arrange);setMessage('');}}>{arrange?'Done arranging':'Arrange'}</button>
      <button className="outline-button" onClick={()=>setLegend(true)}>Legend</button>
      <button className="outline-button" onClick={onReport}>Report</button>
      <button className="outline-button" onClick={onBackup}>Backup</button>
    </div>
    <div role="status" className="garden-feedback">{message || (arrange?'Resize each module or shuffle categories. Financial records stay unchanged.':'')}</div>
    <div ref={canvas} className={`garden-canvas${view.category?' is-focused':''}${arrange?' is-arranging':''}`} aria-label="Project budget and category map">
      <svg className="garden-links" aria-hidden="true">{!arrange && lines.map(e=><path key={e.key} data-relationship={e.key} d={e.path}/>)}</svg>
      <div className={`garden-project-block ${budget.board?.canvas?.sizes.project==='large'?'is-large':''}`}>
        <button data-garden-node="project" className="garden-project garden-node" onClick={()=>setDetail('project')}>
          <h2><NodeGlyph kind="project"/>{budget.name}</h2><span>{view.categories.length} categories</span>
        </button>
        {arrange && localControls('project')}
      </div>
      <div className={`garden-budget-block ${budget.board?.canvas?.sizes.budget==='large'?'is-large':''}`}>
        <article data-garden-node="budget" className="garden-budget garden-node">
          <BudgetStatus budget={budget}/>
          <button className="text-button" onClick={()=>setDetail('budget')}>Open budget details</button>
        </article>
        {arrange && localControls('budget')}
      </div>
      <section className="garden-categories" aria-label={view.category?'Selected category and spending trail':'Category allocations'}>
        <div className="garden-section-label"><h2>{view.category?'Category & spending trail':'Category allocations'}</h2><span>{view.category?'Open focus':'Select to explore'}</span></div>
        <div className={`garden-branches${view.category?' single-branch':''}`}>
          {displayed.map(c=>{
            const count=budget.expenses.filter(e=>e.categoryId===c.id).length;
            const large=budget.board?.canvas?.sizes['category:'+c.id]==='large';
            return <div className={`garden-branch${large?' is-large':''}${dragId===c.id?' is-dragging':''}`} data-category-id={c.id} key={c.id}>
              <button data-garden-node={'category:'+c.id} className={`garden-category garden-node${view.category?' is-selected':''}`} aria-expanded={view.category?.id===c.id} onClick={()=>view.category?setDetail('category:'+c.id):focus(c.id)}>
                <h3><NodeGlyph kind="category"/>{c.name}</h3><strong className="money">{money(c.amount)}</strong><span>Allocation · {count} {count===1?'entry':'entries'}</span>
              </button>
              {arrange && localControls('category:'+c.id,view.categories.findIndex(x=>x.id===c.id))}
              {view.category && <div className="garden-trail">
                {view.entries.map(e=><article className={`garden-entry garden-node ${budget.board?.canvas?.sizes['entry:'+e.id]==='large'?'is-large':''}`} data-garden-node={'entry:'+e.id} key={e.id}>
                  <button className="garden-entry-open" onClick={()=>setDetail('entry:'+e.id)}>
                    <h3><NodeGlyph kind="entry"/>{e.description}</h3><strong className="money">{money(e.amount)}</strong>
                    <span className="garden-entry-meta"><Stage value={e.status}/><time>{e.date}</time></span>
                    {e.notes && <span className="garden-note-mark"><NodeGlyph kind="note"/>Attached note</span>}
                  </button>
                  {arrange && localControls('entry:'+e.id)}
                </article>)}
                {!view.count && <p>No entries in this category yet.</p>}
                <button className="outline-button" onClick={()=>onSpend(c.id)}>Add entry in {c.name}</button>
                {view.count>4 && <div className="garden-paging"><p>Open focus · {view.offset+1}–{view.offset+view.entries.length} of {view.count} entries</p><div><button className="outline-button" disabled={!view.offset} onClick={()=>setPage(p=>p-1)}>Previous 4</button><button className="outline-button" disabled={view.offset+4>=view.count} onClick={()=>setPage(p=>p+1)}>Next 4</button></div></div>}
              </div>}
            </div>;
          })}
        </div>
      </section>
      {view.category && <section className="garden-folded" aria-label="Other category allocations"><h2>Other category allocations</h2>{view.categories.filter(c=>c.id!==view.category?.id).map(c=><button key={c.id} className="outline-button" onClick={()=>focus(c.id)}><NodeGlyph kind="category"/><span>{c.name}<small>Allocation <span className="money">{money(c.amount)}</span> · {budget.expenses.filter(e=>e.categoryId===c.id).length} entries</small></span><span aria-hidden="true">→</span></button>)}</section>}
      {!view.categories.length && <button className="outline-button" onClick={onPlan}>Add category allocations</button>}
    </div>
    {storageError && <p className="error" role="alert">Changes are not saved. Download a backup before leaving.</p>}
    {legend && <GardenDialog title="Node & color legend" onClose={()=>setLegend(false)}>
      <h2>Record types</h2><ul className="garden-legend">{[['project','Project'],['budget','Budget status'],['category','Category allocation'],['entry','Spending entry'],['note','Entry-owned note']].map(([kind,label])=><li key={kind}><NodeGlyph kind={kind}/>{label}</li>)}</ul>
      <h2>Entry stages</h2><ul className="garden-legend"><li><Stage value="planned"/>Uncommitted estimate; included in forecast.</li><li><Stage value="committed"/>Agreed or billed; still to pay.</li><li><Stage value="paid"/>Money already paid.</li></ul>
      <h2>Balances & relationships</h2><p>Room left = Approved Budget − Paid − Committed. Planned estimates do not reduce Room left. Allocation is not planned spending.</p><p><span className="negative"><NodeGlyph kind="alert"/>Over by</span> is an attention condition, not an entry stage. Green marks paid amounts or positive Room left; neutral marks Planned, ochre marks Committed. Words and glyphs always accompany color.</p><p>Sage straight links show project ownership, category allocation and entry membership. Clay marks the selected category. Notes and Markdown links belong to their entry, not a separate Board node.</p>
    </GardenDialog>}
    {detail && <GardenDialog key={detail} title={detail==='project'?budget.name:detail==='budget'?'Budget details':detail.startsWith('entry:')?budget.expenses.find(e=>e.id===detail.slice(6))?.description??'Entry':budget.categories.find(c=>c.id===detail.slice(9))?.name??'Category'} onClose={()=>setDetail(null)}>
      {detail.startsWith('entry:')?(()=>{
        const e=budget.expenses.find(x=>x.id===detail.slice(6));if(!e)return <p>This entry is no longer available.</p>;
        return <><p className="garden-detail-money money">{money(e.amount)}</p><Stage value={e.status}/><p>{budget.categories.find(c=>c.id===e.categoryId)?.name} · {e.date}</p><button className="primary" onClick={()=>{setDetail(null);onExpense(e);}}>Edit entry</button><h2>Entry note</h2>{e.notes?<div className="eb-md garden-note">{renderMarkdownDocument(e.notes, {onWikilink:(target)=>{
          const record=resolveNoteLink(budget,target);if(record)setDetail((budget.categories.some(c=>c.id===record.id)?'category:':'entry:')+record.id);else setMessage(`No record named “${target}” in this project.`);
        },onTag:(tag)=>setMessage(`Tag: #${tag}. This note stays attached to its entry.`)})}</div>:<p>No note attached. Add one in Edit entry.</p>}<h2>Stage history</h2><p>{e.history.join(' → ')}</p><p role="status">{message}</p></>;
      })():detail.startsWith('category:')?(()=>{
        const c=budget.categories.find(x=>x.id===detail.slice(9));if(!c)return null;const t=totals(budget,c.id);
        return <><dl className="garden-detail-metrics"><div><dt>Allocation</dt><dd className="money">{money(c.amount)}</dd></div><div><dt>Paid</dt><dd className="money">{money(t.spent)}</dd></div><div><dt>Committed</dt><dd className="money">{money(t.committed)}</dd></div><div><dt>{t.left<0?'Over by':'Room left'}</dt><dd className={'money'+(t.left<0?' negative':'')}>{money(Math.abs(t.left))}</dd></div></dl>{budget.profile==='Team' && <p>Owner: {c.owner||'Not assigned'} · GL code: {c.glCode||'Not assigned'}</p>}<button className="primary" onClick={()=>{setDetail(null);focus(c.id);}}>Explore category</button><button className="outline-button" onClick={()=>{setDetail(null);onPlan();}}>Edit allocation</button></>;
      })():<><BudgetStatus budget={budget}/><p>Planned is uncommitted spending estimates. It is not the approved limit or category allocation.</p><p>Forecast Spend <span className="money">{money(view.summary.forecast)}</span> · Projected Headroom <span className="money">{money(budget.total-view.summary.forecast)}</span></p><div className="garden-toolbar"><button className="primary" onClick={()=>{setDetail(null);onSettings();}}>Budget settings</button><button className="outline-button" onClick={()=>{setDetail(null);onPlan();}}>Category allocations</button></div></>}
    </GardenDialog>}
  </div>;
}

function GardenDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const trigger=document.activeElement as HTMLElement|null;const previous=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.showModal();return()=>{document.body.style.overflow=previous;trigger?.focus({preventScroll:true});};},[]);
  return <dialog className="garden-dialog" ref={dialog} aria-labelledby="garden-dialog-title" onCancel={e=>{e.preventDefault();onClose();}}><header><h1 id="garden-dialog-title">{title}</h1><button className="outline-button" onClick={onClose}>Close</button></header><div className="garden-dialog-body">{children}</div></dialog>;
}
