import {parseLibrary, serializeLibrary} from './library-model.mjs';
import {receiptManifest, MAX_RECEIPT_BYTES} from './receipt-model.mjs';

export async function receiptHash(blob) {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function checkReceiptBytes(asset, blob) {
 const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
 if (blob.size !== asset.size || blob.size > MAX_RECEIPT_BYTES || signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255 || await receiptHash(blob) !== asset.sha256)
   throw new Error('A receipt photo is missing or damaged. Keep the original backup; no books were added.');
 return blob;
}
export async function blobBase64(blob) {
 const bytes = new Uint8Array(await blob.arrayBuffer()), chunks = [];
 for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
 return btoa(chunks.join(''));
}
export function base64Blob(encoded) {
 if (typeof encoded !== 'string' || !encoded || encoded.length > Math.ceil(MAX_RECEIPT_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
   throw new Error('Could not read a photo in this backup.');
 const bytes = atob(encoded);
 return new Blob([Uint8Array.from(bytes, c => c.charCodeAt(0))], {type: 'image/jpeg'});
}
// A self-contained .fennuma archive: versioned manifest + Markdown + JPEG bytes.
// No server, external image URLs or third-party archive decoder is involved.
export async function createReceiptBackup(library, read) {
 const markdown = serializeLibrary(library), assets = [];
 for (const asset of receiptManifest(library)) {
   let blob;
   try { blob = await read(asset.id); await checkReceiptBytes(asset, blob); }
   catch { throw new Error('A receipt photo is unavailable on this device. A full backup was not downloaded. Restore the original full backup, or download Markdown without photos.'); }
   assets.push({id: asset.id, bytes: await blobBase64(blob)});
 }
 return JSON.stringify({schema: 'fennuma/receipts-v1', markdown, assets});
}
export async function parseReceiptBackup(text) {
 let data;
 try { data = JSON.parse(text); } catch { throw new Error('Could not read this full backup. Choose the original .fennuma file.'); }
 if (data?.schema !== 'fennuma/receipts-v1' || typeof data.markdown !== 'string' || !Array.isArray(data.assets))
   throw new Error('Could not read this full backup. Choose a Fennuma .fennuma or Markdown backup.');
 const library = parseLibrary(data.markdown), manifest = receiptManifest(library);
 if (!library.books.length) throw new Error('This backup has no books to add. Export a full project backup instead.');
 if (data.assets.length !== manifest.length || new Set(data.assets.map(a => a?.id)).size !== manifest.length)
   throw new Error('The receipt photo list is incomplete or duplicated. No books were added.');
 const assets = [];
 for (const a of data.assets) {
   const meta = manifest.find(m => m.id === a?.id);
   if (!meta) throw new Error('This backup has an unexpected receipt photo. No books were added.');
   const blob = base64Blob(a.bytes);
   await checkReceiptBytes(meta, blob);
   assets.push({meta, blob});
 }
 return {markdown: data.markdown, assets};
}
