// Receipt references are entry-owned. Immutable image bytes live off the money
// model; the manifest and append-only history travel with the Markdown book.
import {periodId} from './repeat-model.mjs';

export const MAX_RECEIPTS = 5;
export const MAX_RECEIPT_BYTES = 15_000_000;
export const receiptId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
export function validateReceiptAsset(a) {
 if (!a || !receiptId(a.id) || typeof a.entryId !== 'string' || !a.entryId ||
     typeof a.name !== 'string' || !a.name || a.name.length > 100 || a.type !== 'image/jpeg' ||
     !Number.isSafeInteger(a.size) || a.size < 1 || a.size > MAX_RECEIPT_BYTES ||
     typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256) || !date(a.addedAt))
   throw new Error('Could not read a receipt photo in this backup.');
 return a;
}
export function validateReceiptData(budget) {
 const data = budget.receiptData;
 if (data !== undefined && (!data || !Array.isArray(data.assets) || !Array.isArray(data.events)))
   throw new Error('Could not read receipt history in this backup.');
 const assets = data?.assets ?? [], ids = new Set();
 for (const a of assets) {
   validateReceiptAsset(a);
   if (ids.has(a.id)) throw new Error('A receipt photo is duplicated in this backup.');
   ids.add(a.id);
 }
 for (const e of [budget, ...(budget.periods ?? [])].flatMap(p => p.expenses ?? [])) {
   if (e.receiptIds === undefined) continue;
   if (!Array.isArray(e.receiptIds) || e.receiptIds.length > MAX_RECEIPTS ||
       new Set(e.receiptIds).size !== e.receiptIds.length ||
       !e.receiptIds.every(id => assets.some(a => a.id === id && a.entryId === e.id)))
     throw new Error('An entry has an unreadable receipt reference.');
 }
 for (const e of data?.events ?? []) {
   if (!e || !['attached', 'removed', 'restored'].includes(e.action) || !date(e.at) ||
       !assets.some(a => a.id === e.receiptId && a.entryId === e.entryId))
     throw new Error('Could not read a receipt history event.');
 }
}
export function setEntryReceipts(budget, entryId, receiptIds, additions = [], at = new Date().toISOString()) {
 const before = budget.expenses.find(e => e.id === entryId);
 if (!before) throw new Error('This entry is no longer available. Your photo has not been attached.');
 const previous = before.receiptIds ?? [], known = budget.receiptData?.assets ?? [];
 const incoming = additions.filter(a => !known.some(old => old.id === a.id));
 if (additions.some(a => a.entryId !== entryId || !receiptIds.includes(a.id) || known.some(old => old.id === a.id && JSON.stringify(old) !== JSON.stringify(a))))
   throw new Error('A receipt photo does not belong to this entry.');
 const changes = [
   ...previous.filter(id => !receiptIds.includes(id)).map(receiptId => ({receiptId, entryId, action: 'removed', at})),
   ...receiptIds.filter(id => !previous.includes(id)).map(receiptId => ({receiptId, entryId, action: known.some(a => a.id === receiptId) ? 'restored' : 'attached', at})),
 ];
 if (!changes.length && !incoming.length) return budget;
 const next = {
   ...budget,
   expenses: budget.expenses.map(e => e.id === entryId ? {...e, receiptIds: [...receiptIds]} : e),
   receiptData: {assets: [...known, ...incoming], events: [...(budget.receiptData?.events ?? []), ...changes]},
   events: [...budget.events, ...changes.map(e => ({text: `Receipt photo ${e.action} · ${before.description}. Earlier photos stay in history.`, at,
     before: {entryId, receiptIds: previous}, after: {entryId, receiptIds}}))],
 };
 validateReceiptData(next);
 return next;
}
export function receiptManifest(library) {
 const assets = new Map();
 for (const project of [...library.books.flatMap(b => b.projects), ...(library.example ? [library.example] : [])]) {
   for (const a of project.receiptData?.assets ?? []) {
     validateReceiptAsset(a);
     const old = assets.get(a.id);
     if (old && (old.sha256 !== a.sha256 || old.size !== a.size)) throw new Error('Two receipt photos have the same identity. Keep the original backups.');
     assets.set(a.id, a);
   }
 }
 return [...assets.values()];
}
function entryTransitions(budget, entry) {
 const manual = budget.events.filter(e => e.after?.id === entry.id && typeof e.after.status === 'string');
 const period = periodId(budget);
 const imported = (budget.statementImports?.batches ?? []).flatMap(batch => batch.undone ? [] :
   batch.items.filter(item => item.kind === 'match' && item.entryId === entry.id &&
     item.projectId === budget.id && item.period === period && item.after.status === 'paid')
     .map(item => ({before: item.before, after: item.after, at: batch.at})));
 return [...manual, ...imported];
}
// Present only timestamps actually recorded in the audit trail; old stage
// arrays have no dates and are kept separately by the view, never invented.
export function earlierEntryStages(budget, entry) {
 const first = entryTransitions(budget, entry).sort((a, b) => a.at.localeCompare(b.at))[0];
 if (!first) return entry.history;
 return first.before?.id === entry.id && Array.isArray(first.before.history) ? first.before.history : [];
}
export function entryReceiptHistory(budget, entry) {
 const assets = (budget.receiptData?.assets ?? []).filter(a => a.entryId === entry.id);
 const photos = (budget.receiptData?.events ?? []).filter(e => e.entryId === entry.id).map(e => ({
   label: `Receipt ${assets.findIndex(a => a.id === e.receiptId) + 1} ${e.action}`, at: e.at, kind: 'photo',
 }));
 const entries = entryTransitions(budget, entry).map(e => ({
   label: e.before?.id && e.before.status === e.after.status ? 'Entry updated' : `Entry saved as ${e.after.status[0].toUpperCase()}${e.after.status.slice(1)}`,
   at: e.at, kind: 'entry',
 }));
 return [...entries, ...photos].sort((a, b) => b.at.localeCompare(a.at));
}
