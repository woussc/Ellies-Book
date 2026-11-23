import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exampleBudget,serializeBook,parseBook} from '../app/book/model.mjs';
import {changeLibrary,emptyLibrary,restoreLibrary,activeBudget,serializeLibrary,LIBRARY_KEY} from '../app/book/library-model.mjs';
import {setEntryReceipts,receiptManifest} from '../app/book/receipt-model.mjs';
import {createReceiptBackup,parseReceiptBackup,receiptHash} from '../app/book/receipt-files.mjs';
import {commitReceiptLibrary} from '../app/book/receipt-transaction.mjs';
const id='b2ef0b72-62c7-48ba-9aac-b78314795946';
const blob=new Blob([new Uint8Array([255,216,255,224,0,1,2,3])],{type:'image/jpeg'});
async function fixture(profile='Household') {
 let budget=exampleBudget();budget.sample=false;budget.profile=profile;
 const meta={id,entryId:budget.expenses[0].id,name:'Receipt photo',size:blob.size,type:'image/jpeg',sha256:await receiptHash(blob),addedAt:'2026-11-21T10:48:00.000Z'};
 budget=setEntryReceipts(budget,meta.entryId,[id],[meta]);
 return {library:changeLibrary(emptyLibrary(),{type:'book',name:'November',project:budget}),meta};
}
for(const profile of ['Household','Just me','Team'])test(`full backup restores active and historical photos independently in ${profile}`,async()=>{
 const {library}=await fixture(profile),original=activeBudget(library);
 const historical=setEntryReceipts(original,original.expenses[0].id,[]);
 const l=changeLibrary(library,{type:'update',project:historical});
 const portable=await createReceiptBackup(l,async()=>blob),parsed=await parseReceiptBackup(portable);
 const restored=restoreLibrary(library,parsed.markdown),copy=activeBudget(restored);
 assert.notEqual(copy.id,original.id);assert.deepEqual(copy.receiptData,historical.receiptData);
 assert.deepEqual(copy.expenses,historical.expenses);assert.equal(parsed.assets.length,1);
 assert.deepEqual(new Uint8Array(await parsed.assets[0].blob.arrayBuffer()),new Uint8Array(await blob.arrayBuffer()));
 assert.equal(receiptManifest(restored).length,1);
});
test('a full backup never silently omits missing or damaged historical assets',async()=>{
 const {library}=await fixture();
 await assert.rejects(createReceiptBackup(library,async()=>{throw Error('missing');}),/unavailable/);
 await assert.rejects(createReceiptBackup(library,async()=>new Blob(['wrong'])),/unavailable/);
 const full=JSON.parse(await createReceiptBackup(library,async()=>blob));
 for(const edit of [a=>a.assets.splice(0),a=>a.assets.push(a.assets[0]),a=>a.assets[0].id='../private',a=>a.assets[0].bytes='not base64',a=>a.assets[0].bytes='//j/4AABAgQ=']){
   const bad=structuredClone(full);edit(bad);await assert.rejects(parseReceiptBackup(JSON.stringify(bad)));
 }
 await assert.rejects(parseReceiptBackup('{broken'),/Could not read/);
});
test('old Markdown books without photos still restore; references never become inline note bytes',()=>{
 const b=exampleBudget(),note='\n## Receipt\n[[Groceries]]\n';b.expenses[0].notes=note;
 const copy=activeBudget(restoreLibrary(emptyLibrary(),serializeBook(b)));
 assert.equal(copy.expenses[0].notes,note);assert.equal(copy.receiptData,undefined);
 assert.equal(parseBook(serializeBook(copy)).expenses[0].notes,note);
});
test('asset write failure, metadata quota failure and concurrent edits never publish references',async()=>{
 const {library}=await fixture();let raw=serializeLibrary(library),writes=0,fail=false;
 const before=raw,storage={getItem:()=>raw,setItem:(_key,v)=>{if(fail)throw Error('quota');raw=v;writes++;}};
 const lock=async work=>work();
 const change=l=>({...l,profile:{name:'After'}});
 await assert.rejects(commitReceiptLibrary(storage,async()=>{throw Error('disk full');},[],change,lock),/disk full/);
 assert.equal(raw,before);assert.equal(writes,0);
 fail=true;await assert.rejects(commitReceiptLibrary(storage,async()=>{},[],change,lock),/storage is full/);assert.equal(raw,before);
 fail=false;const concurrent=serializeLibrary({...library,profile:{name:'Another tab'}});
 await assert.rejects(commitReceiptLibrary(storage,async()=>{raw=concurrent;},[],change,lock),/changed while/);assert.equal(raw,concurrent);
 const successful=await commitReceiptLibrary(storage,async()=>{},[],change,lock);
 assert.equal(successful.profile.name,'After');assert.equal(writes,1);assert.equal(storage.getItem(LIBRARY_KEY),serializeLibrary(successful));
});
