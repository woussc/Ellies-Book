import {LIBRARY_KEY,readLibrary,parseLibrary,serializeLibrary} from './library-model.mjs';

// Called inside the import Web Lock. Compare against the exact bytes parsed,
// not a second read taken after a potentially expensive library parse.
export function saveStatement(storage,change){
 const raw=storage.getItem(LIBRARY_KEY),fresh=raw===null?readLibrary(storage):parseLibrary(raw);
 const next=change(fresh),markdown=serializeLibrary(next);
 if(storage.getItem(LIBRARY_KEY)!==raw)throw new Error('Your book changed in another tab. Review again before importing.');
 try{storage.setItem(LIBRARY_KEY,markdown);}catch{throw new Error('Device storage is full or unavailable. Nothing was imported. Download your books before trying again.');}
 return next;
}
