import {parseLibrary, readLibrary, serializeLibrary, LIBRARY_KEY} from './library-model.mjs';

// Publish references only after every byte is durable. A rejected commit leaves
// both persistent Markdown and the React snapshot untouched. Orphans are safe.
export async function commitReceiptLibrary(storage, writeAssets, assets, change, lock, recovery) {
 const raw = storage.getItem(LIBRARY_KEY);
 return lock(async () => {
   await writeAssets(assets);
   if (storage.getItem(LIBRARY_KEY) !== raw) throw new Error('Your books changed while the photo was saving. Nothing was attached. Review the entry and try again.');
   const before = recovery ?? (raw === null ? readLibrary(storage) : parseLibrary(raw));
   const next = change(before), markdown = serializeLibrary(next);
   if (storage.getItem(LIBRARY_KEY) !== raw) throw new Error('Your books changed in another tab. Review and try again.');
   try {
     if (recovery && raw !== null) storage.setItem(`${LIBRARY_KEY}:recovery:${Date.now()}`, raw);
     storage.setItem(LIBRARY_KEY, markdown);
   } catch { throw new Error('Device storage is full or unavailable. Your entry was not saved. Keep this page open and download your books before trying again.'); }
   return next;
 });
}
