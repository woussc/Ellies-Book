'use client';
/* Local blob URLs must not pass through an image optimizer or remote service. */
/* eslint-disable @next/next/no-img-element */

import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {Budget, Expense} from './model.mjs';
import {MAX_RECEIPTS, entryReceiptHistory, earlierEntryStages, type ReceiptAsset} from './receipt-model.mjs';
import {checkReceiptBytes, type LocalReceipt} from './receipt-files.mjs';
import {prepareReceipt, readReceipt} from './receipt-storage';
import './receipt-photos.css';

export type ReceiptDraft = {ids: string[]; assets: LocalReceipt[]};
export const emptyReceiptDraft = (): ReceiptDraft => ({ids: [], assets: []});
const added = (value: string) => new Date(value).toLocaleString(undefined, {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'});
const addedDate = (value: string) => new Date(value).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
function ReceiptGlyph({kind}: {kind: 'phone' | 'plus' | 'expand' | 'history' | 'photo' | 'check'}) {
 const paths = {phone: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></>, plus: <path d="M12 5v14M5 12h14"/>, expand: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>, history: <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l4 2"/>, photo: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m4 18 5-5 4 3 3-5 5 7"/></>, check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>};
 return <svg className="receipt-glyph" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
function LocalOnly() {
 return <p className="receipt-local"><ReceiptGlyph kind="phone"/><span className="receipt-phone-copy">Only on this phone. Not shared.</span><span className="receipt-device-copy">Only on this device. Not shared.</span></p>;
}

function usePhoto(meta: ReceiptAsset, local?: Blob) {
 const {id, sha256, size} = meta;
 const [attempt, retry] = useState(0);
 const [photo, setPhoto] = useState<{id: string; url?: string; error?: string}>({id: meta.id});
 useEffect(() => {
   let stopped = false, url = '';
   void (async () => {
     try {
       const blob = local ?? await readReceipt(id);
       await checkReceiptBytes({size, sha256}, blob);
       if (stopped) return;
       url = URL.createObjectURL(blob); setPhoto({id, url});
     } catch {if (!stopped) setPhoto({id, error: 'Photo unavailable on this device. Restore a full backup to open it.'});}
   })();
   return () => {stopped = true; if (url) URL.revokeObjectURL(url);};
 }, [id, sha256, size, local, attempt]);
 return {...(photo.id === meta.id ? photo : {id: meta.id}), retry: () => retry(n => n + 1)};
}
function PhotoDialog({title, children, onClose}: {title: string; children: ReactNode; onClose: () => void}) {
 const dialog = useRef<HTMLDialogElement>(null);
 useEffect(() => {
   const trigger = document.activeElement as HTMLElement | null, previous = document.body.style.overflow;
   document.body.style.overflow = 'hidden'; dialog.current?.showModal();
   return () => {document.body.style.overflow = previous; if (trigger?.isConnected) trigger.focus({preventScroll: true});};
 }, []);
 return <dialog ref={dialog} className="receipt-dialog" aria-labelledby="receipt-dialog-title" onClose={onClose}>
   <header><h2 id="receipt-dialog-title">{title}</h2><button type="button" className="outline-button" onClick={() => dialog.current?.close()}>Back</button></header>
   {children}
 </dialog>;
}
function PhotoViewer({meta, local, onClose, actions}: {meta: ReceiptAsset; local?: Blob; onClose: () => void; actions?: ReactNode}) {
 const photo = usePhoto(meta, local), [zoom, setZoom] = useState(false);
 return <PhotoDialog title={actions ? 'Check your photo' : 'Receipt photo'} onClose={onClose}>
   <LocalOnly/>
   {/* The scroll region must be keyboard-focusable at full-size zoom. */}
   {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
   <section className={'receipt-photo-stage' + (zoom ? ' is-zoomed' : '')} tabIndex={0} aria-label="Receipt preview, scroll to inspect when zoomed">
     {photo.url ? <img src={photo.url} alt="Your complete receipt" /> : <p role="status">{photo.error ?? 'Opening photo…'}</p>}
   </section>
   <div className="receipt-actions"><button type="button" className="outline-button" disabled={!photo.url} aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? 'Fit photo' : 'Zoom'}</button>{photo.error && <button type="button" className="outline-button" onClick={photo.retry}>Try again</button>}</div>
   {actions}
 </PhotoDialog>;
}
function PhotoCard({meta, local, number, children}: {meta: ReceiptAsset; local?: Blob; number: number; children?: ReactNode}) {
 const photo = usePhoto(meta, local), [open, setOpen] = useState(false);
 return <article className="receipt-card">
   <button type="button" className="receipt-thumbnail" aria-label={`Open photo ${number}`} onClick={() => setOpen(true)}>
     {photo.url ? <img src={photo.url} alt={`Receipt ${number}`} /> : <span>{photo.error ? 'Photo unavailable' : 'Opening photo…'}</span>}
   </button>
   <div className="receipt-card-content"><div className="receipt-card-label"><h4>Receipt {number}</h4><p>{local ? 'Ready to attach. Save the entry to keep it.' : `Added ${addedDate(meta.addedAt)}`}</p></div>
     {photo.error && <p className="error">{photo.error}</p>}
     <div className="receipt-actions"><button type="button" className="outline-button" onClick={() => setOpen(true)}><ReceiptGlyph kind="expand"/>Open photo</button>{children}</div>
   </div>
   {open && <PhotoViewer meta={meta} local={local} onClose={() => setOpen(false)} />}
 </article>;
}
export function ReceiptCount({entry}: {entry: Expense}) {
 const count = entry.receiptIds?.length ?? 0;
 return count ? <span className="receipt-count">{count} {count === 1 ? 'photo' : 'photos'}</span> : null;
}
export function RemovedEntryReceipts({budget}: {budget: Budget}) {
 const entries = new Set([budget, ...(budget.periods ?? [])].flatMap(b => b.expenses).map(e => e.id));
 const archived = [...new Set(budget.receiptData?.assets.filter(a => !entries.has(a.entryId)).map(a => a.entryId) ?? [])];
 if (!archived.length) return null;
 return <details className="receipt-history"><summary>Photos from removed entries · {archived.length}</summary><p>These entries no longer count in totals. Their original photos stay in your audit trail and full backups.</p>
   {archived.map(id => {
     const before = budget.events.map(e => e.before).find(e => e && typeof e === 'object' && 'id' in e && e.id === id) as Partial<Expense> | undefined;
     return <section className="receipt-section" key={id}><h3>{typeof before?.description === 'string' ? before.description : 'Removed entry'}</h3>
       {budget.receiptData?.assets.filter(a => a.entryId === id).map((a, i) => <PhotoCard key={a.id} meta={a} number={i + 1}/>)}</section>;
   })}
 </details>;
}
function ReceiptHistory({budget, entryId, ids, restore, earlierOnly = false}: {budget: Budget; entryId: string; ids: string[]; restore?: (id: string) => void; earlierOnly?: boolean}) {
 const history = budget.receiptData?.events.filter(e => e.entryId === entryId) ?? [];
 const earlier = budget.receiptData?.assets.filter(a => a.entryId === entryId && !ids.includes(a.id)) ?? [];
 if (!history.length || (earlierOnly && !earlier.length)) return null;
 return <details className="receipt-history"><summary>{earlierOnly ? `Earlier receipt photos · ${earlier.length}` : `Entry photo history · ${history.length}`}</summary>
   <p>Removing a photo keeps it here. Earlier photos are never overwritten.</p>
   {!earlierOnly && <ol>{history.map((e, i) => <li key={i}>Photo {e.action} · <time dateTime={e.at}>{added(e.at)}</time></li>)}</ol>}
   {earlier.map((a, i) => <PhotoCard key={a.id} meta={a} number={i + 1}>{restore && <button type="button" className="outline-button" disabled={ids.length >= MAX_RECEIPTS} onClick={() => restore(a.id)}>Restore to entry</button>}</PhotoCard>)}
 </details>;
}
export function SavedReceipts({budget, entry, onAdd, history = true}: {budget: Budget; entry: Expense; onAdd?: () => void; history?: boolean}) {
 const ids = entry.receiptIds ?? [];
 return <section className="receipt-section" aria-label="Receipt photos">
   <div className="receipt-heading"><h3>Receipt photos</h3><ReceiptCount entry={entry}/></div>
   {ids.length ? ids.map((id, i) => {const meta = budget.receiptData?.assets.find(a => a.id === id); return meta ? <PhotoCard key={id} meta={meta} number={i + 1}/> : null;}) : <p>No photos attached yet.</p>}
   <LocalOnly/>
   {onAdd && <button type="button" className="outline-button receipt-add" onClick={onAdd}><ReceiptGlyph kind="plus"/>Add photo</button>}
   <p className="receipt-backup-hint">Keep photos safe with a full book backup.</p>
   {history && <ReceiptHistory budget={budget} entryId={entry.id} ids={ids}/>}
 </section>;
}
export function ReceiptEntryDetail({budget, entry, onEdit, children}: {budget: Budget; entry: Expense; onEdit: () => void; children: ReactNode}) {
 const history = entryReceiptHistory(budget, entry);
 const earlierStages = earlierEntryStages(budget, entry);
 const historyRef = useRef<HTMLDetailsElement>(null);
 useEffect(() => {
   const media = window.matchMedia('(min-width: 641px)');
   const sync = () => {if (historyRef.current) historyRef.current.open = media.matches;};
   sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync);
 }, []);
 return <div className="receipt-entry-detail">
   <SavedReceipts budget={budget} entry={entry} onAdd={onEdit} history={false}/>
   <div className="receipt-detail-context">
     <section className="receipt-entry-note" aria-label="Entry note"><h3>Entry note</h3>{children}</section>
     <div className="receipt-entry-actions"><button type="button" className="outline-button receipt-mobile-edit" onClick={onEdit}>Edit entry</button>
       <details ref={historyRef} className="receipt-entry-history"><summary><ReceiptGlyph kind="history"/>Entry history<span aria-hidden="true">⌄</span></summary>
         <div className="receipt-timeline">
           {history.length > 0 && <ol>{history.map((event, i) => <li key={i}><ReceiptGlyph kind={event.kind === 'photo' ? 'photo' : 'check'}/><div><strong>{event.label}</strong><time dateTime={event.at}>{added(event.at)}</time></div></li>)}</ol>}
           {earlierStages.length > 0 && <p>Earlier entry stages: {earlierStages.map(s => s[0].toUpperCase() + s.slice(1)).join(' → ')}. Dates were not recorded for these stages.</p>}
           <p>Photos stay with this entry’s history.</p>
           <ReceiptHistory budget={budget} entryId={entry.id} ids={entry.receiptIds ?? []} earlierOnly/>
         </div>
       </details>
     </div>
     <p className="receipt-detail-help">Adding a photo does not change your amount, category or payment status.</p>
   </div>
 </div>;
}
export default function ReceiptEditor({budget, entryId, value, onChange, onBusy}: {budget: Budget; entryId?: string; value: ReceiptDraft; onChange: (value: ReceiptDraft) => void; onBusy: (busy: boolean) => void}) {
 const picker = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null), alive = useRef(true);
 const [source, setSource] = useState(false), [pending, setPending] = useState<LocalReceipt | null>(null), [preparing, setPreparing] = useState(false), [error, setError] = useState('');
 const [removing, setRemoving] = useState<string | null>(null);
 useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
 const choose = (capture = false) => {setSource(false); (capture ? camera : picker).current?.click();};
 const add = () => {if (window.matchMedia('(max-width: 640px)').matches) setSource(true); else choose();};
 async function selected(file?: File) {
   if (!file) return;
   setError(''); setPreparing(true); onBusy(true);
   try {const photo = await prepareReceipt(file); if (alive.current) setPending(photo);}
   catch (error) {if (alive.current) setError(error instanceof Error ? error.message : 'Could not open this photo. Try another.');}
   finally {if (alive.current) {setPreparing(false); onBusy(false);}}
 }
 return <section className="receipt-section" aria-label="Receipt photos">
   <div className="receipt-heading"><h3>Receipt photos <span>(optional)</span></h3><span>{value.ids.length} / {MAX_RECEIPTS}</span></div>
   <LocalOnly/>
   {!value.ids.length && <p>Keep the little proof of a purchase beside its entry.</p>}
   {value.ids.map((id, i) => {
     const local = value.assets.find(a => a.meta.id === id), meta = local?.meta ?? budget.receiptData?.assets.find(a => a.id === id);
     return meta ? <PhotoCard key={id} meta={meta} local={local?.blob} number={i + 1}>
       <button type="button" className="outline-button" onClick={() => setRemoving(id)}>Remove from entry</button>
     </PhotoCard> : null;
   })}
   {removing && <div className="receipt-remove" role="group" aria-label="Remove photo confirmation"><p>This photo will stay in the entry’s history after you save. An unsaved photo is just discarded.</p><div className="receipt-actions"><button type="button" className="outline-button" onClick={() => setRemoving(null)}>Keep photo</button><button type="button" className="outline-button" onClick={() => {onChange({ids: value.ids.filter(id => id !== removing), assets: value.assets.filter(a => a.meta.id !== removing)}); setRemoving(null);}}>Yes, remove photo</button></div></div>}
   <button type="button" className="outline-button receipt-add" onClick={add} disabled={preparing || value.ids.length >= MAX_RECEIPTS}><ReceiptGlyph kind="plus"/>{preparing ? 'Preparing photo…' : 'Add photo'}</button>
   <p className="hint">{value.ids.length >= MAX_RECEIPTS ? 'Five photos per entry. Remove one before adding another.' : 'Up to 5 photos · 15 MB each · JPEG, PNG or WebP. HEIC where supported.'}</p>
   {!!value.assets.length && <p role="status">Not saved yet. Save the entry to keep your photos.</p>}
   {error && <p className="error" role="alert">{error}</p>}
   <input ref={picker} hidden type="file" aria-label="Choose receipt photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e => {void selected(e.target.files?.[0]); e.target.value = '';}}/>
   <input ref={camera} hidden type="file" aria-label="Take receipt photo" accept="image/*" capture="environment" onChange={e => {void selected(e.target.files?.[0]); e.target.value = '';}}/>
   {source && <PhotoDialog title="Add a receipt photo" onClose={() => setSource(false)}><LocalOnly/><div className="receipt-source-actions"><button type="button" className="primary" onClick={() => choose(true)}>Take photo</button><button type="button" className="outline-button" onClick={() => choose()}>Choose from photos</button></div><p className="hint">Camera unavailable or permission denied? Choose from photos instead. Nothing changes until you save.</p></PhotoDialog>}
   {pending && <PhotoViewer key={pending.meta.id} meta={pending.meta} local={pending.blob} onClose={() => setPending(null)} actions={<>{error && <p className="error" role="alert">{error}</p>}<div className="receipt-actions receipt-preview-actions"><button type="button" className="outline-button" disabled={preparing} onClick={() => choose()}>{preparing ? 'Preparing photo…' : 'Choose another'}</button><button type="button" className="primary" disabled={preparing || value.ids.length >= MAX_RECEIPTS} onClick={() => {onChange({ids: [...value.ids, pending.meta.id], assets: [...value.assets, pending]}); setError('');setPending(null);}}>Use photo</button></div></>}/>}
   {entryId && <ReceiptHistory budget={budget} entryId={entryId} ids={value.ids} restore={id => onChange({...value, ids: [...value.ids, id]})}/>}
 </section>;
}
