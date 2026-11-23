import {Capacitor} from '@capacitor/core';
import {Filesystem, Directory} from '@capacitor/filesystem';
import {receiptId, MAX_RECEIPT_BYTES} from './receipt-model.mjs';
import type {Budget} from './model.mjs';
import {base64Blob, blobBase64, checkReceiptBytes, receiptHash, type LocalReceipt} from './receipt-files.mjs';

let database: Promise<IDBDatabase> | undefined;
function db() {
 if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
   const request = indexedDB.open('fennuma-receipts', 1);
   request.onupgradeneeded = () => request.result.createObjectStore('photos');
   request.onerror = () => { database = undefined; reject(new Error('Photo storage is unavailable. Keep this page open and try again.')); };
   request.onblocked = () => { database = undefined; reject(new Error('Close other Fennuma tabs and try saving again.')); };
   request.onsuccess = () => {const connection = request.result; connection.onversionchange = () => {connection.close(); database = undefined;}; resolve(connection);};
 });
 return database;
}
function path(id: string) {
 if (!receiptId(id)) throw new Error('This receipt reference is not valid.');
 return `receipts/${id}.jpg`;
}
export async function readReceipt(id: string): Promise<Blob> {
 const name = path(id);
 if (Capacitor.isNativePlatform()) {
   const file = await Filesystem.readFile({path: name, directory: Directory.Data});
   return typeof file.data === 'string' ? base64Blob(file.data) : file.data;
 }
 const connection = await db();
 return new Promise((resolve, reject) => {
   const request = connection.transaction('photos', 'readonly').objectStore('photos').get(id);
   request.onsuccess = () => {
     const value = request.result;
     if (value instanceof Blob) resolve(value);
     else if (value instanceof ArrayBuffer) resolve(new Blob([value], {type: 'image/jpeg'}));
     else reject(new Error('Photo unavailable on this device. Restore a full backup to open it.'));
   };
   request.onerror = () => reject(new Error('Could not open this receipt photo. Try again.'));
 });
}
export async function writeReceipts(assets: LocalReceipt[]) {
 let nativeNames: Set<string> | undefined;
 if (assets.length && Capacitor.isNativePlatform()) {
   // A read failure is not proof of absence. Enumerate the private directory
   // before writing so an unreadable old receipt can never be overwritten.
   await Filesystem.mkdir({path: 'receipts', directory: Directory.Data, recursive: true}).catch(() => {});
   nativeNames = new Set((await Filesystem.readdir({path: 'receipts', directory: Directory.Data})).files.map(f => f.name));
 }
 for (const {meta, blob} of assets) {
   const name = path(meta.id);
   await checkReceiptBytes(meta, blob);
   let existing: Blob | undefined;
   if (nativeNames?.has(`${meta.id}.jpg`)) existing = await readReceipt(meta.id);
   else if (!nativeNames) {try { existing = await readReceipt(meta.id); } catch { /* IndexedDB add below is exclusive even if this read fails. */ }}
   if (existing) { await checkReceiptBytes(meta, existing); continue; }
   try {
     if (Capacitor.isNativePlatform()) {
       await Filesystem.writeFile({path: name, directory: Directory.Data, data: await blobBase64(blob), recursive: true});
       nativeNames?.add(`${meta.id}.jpg`);
     } else {
       const connection = await db();
       // ArrayBuffer avoids Safari/WebKit's Blob-backed IndexedDB failures.
       // Prepare bytes before opening the transaction (Safari auto-commits idle
       // transactions across await boundaries).
       const bytes = await blob.arrayBuffer();
       await new Promise<void>((resolve, reject) => {
         const tx = connection.transaction('photos', 'readwrite');
         // add, not put: never overwrite historical bytes, even across tabs.
         tx.objectStore('photos').add(bytes, meta.id);
         tx.oncomplete = () => resolve();
         tx.onabort = tx.onerror = () => reject(new Error('Photo storage is full or unavailable. Your entry was not saved. Try a smaller photo.'));
       });
     }
     await checkReceiptBytes(meta, await readReceipt(meta.id));
   } catch (error) {
     // A simultaneous restore may have inserted the same immutable asset.
     try { await checkReceiptBytes(meta, await readReceipt(meta.id)); }
     catch { throw error instanceof Error ? error : new Error('Could not save this photo. Your entry was not saved.'); }
   }
 }
 // Unreferenced bytes after an interrupted commit are deliberately not deleted:
 // another restored book/tab may share them. Historical photos are never GC'd.
}
// Reattaching an earlier photo is a new reference publication too. A Markdown
// backup may contain its metadata without any bytes on this device.
export async function receiptAssetsForSave(budget: Budget, entryId: string, ids: string[], drafts: LocalReceipt[]): Promise<LocalReceipt[]> {
 const previous = budget.expenses.find(e => e.id === entryId)?.receiptIds ?? [], assets = [...drafts];
 for (const id of ids) {
   if (previous.includes(id) || drafts.some(a => a.meta.id === id)) continue;
   const meta = budget.receiptData?.assets.find(a => a.id === id && a.entryId === entryId);
   try {
     if (!meta) throw new Error('Missing receipt metadata');
     const blob = await readReceipt(id);
     await checkReceiptBytes(meta, blob);
     assets.push({meta, blob});
   } catch {throw new Error('This earlier photo is unavailable on this device. Restore a full backup before attaching it again. Your entry was not saved.');}
 }
 return assets;
}
export async function prepareReceipt(file: File): Promise<LocalReceipt> {
 if (file.size > MAX_RECEIPT_BYTES) throw new Error('Choose a photo smaller than 15 MB.');
 if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type))
   throw new Error('Choose a JPEG, PNG or WebP photo. HEIC works only if this device can open it.');
 const url = URL.createObjectURL(file);
 try {
   const image = new Image();
   await new Promise<void>((resolve, reject) => {image.onload = () => resolve(); image.onerror = () => reject(new Error('This photo could not be opened. Try a JPEG, PNG or WebP copy.')); image.src = url;});
   if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000)
     throw new Error('Choose a smaller photo (up to 40 megapixels).');
   const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
   const canvas = document.createElement('canvas');
   canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
   const context = canvas.getContext('2d');
   if (!context) throw new Error('This device could not prepare the photo. Try again.');
   context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
   // Browser decoding applies EXIF orientation. Re-encoding strips location and
   // camera metadata without transferring the original file anywhere.
   context.drawImage(image, 0, 0, canvas.width, canvas.height);
   const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not prepare this photo. Try another.')), 'image/jpeg', 0.9));
   return {blob, meta: {id: crypto.randomUUID(), entryId: '', name: 'Receipt photo', type: 'image/jpeg', size: blob.size, sha256: await receiptHash(blob), addedAt: new Date().toISOString()}};
 } finally {URL.revokeObjectURL(url);}
}
