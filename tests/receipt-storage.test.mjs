import {mock,test} from 'node:test';
import assert from 'node:assert/strict';
import {receiptHash,blobBase64} from '../app/book/receipt-files.mjs';
const files=new Map();let failWrite=false,unreadable=false;
mock.module('@capacitor/core',{namedExports:{Capacitor:{isNativePlatform:()=>true}}});
mock.module('@capacitor/filesystem',{namedExports:{Directory:{Data:'DATA'},Filesystem:{
 mkdir:async()=>{},
 readdir:async()=>({files:[...files.keys()].map(name=>({name:name.slice('receipts/'.length)}))}),
 readFile:async({path,directory})=>{assert.equal(directory,'DATA');if(unreadable||!files.has(path))throw Error('unavailable');return {data:files.get(path)};},
 writeFile:async({path,directory,data})=>{assert.equal(directory,'DATA');if(failWrite)throw Error('disk full');files.set(path,data);},
}}});
const {readReceipt,writeReceipts,receiptAssetsForSave}=await import('../app/book/receipt-storage.ts');
test('native receipt files are private, verified and immutable; failures retain original evidence',async()=>{
 const blob=new Blob([new Uint8Array([255,216,255,224,0,1,2,3])],{type:'image/jpeg'});
 const id='b2ef0b72-62c7-48ba-9aac-b78314795946',meta={id,entryId:'entry',name:'Receipt',type:'image/jpeg',size:blob.size,sha256:await receiptHash(blob),addedAt:'2026-11-21T10:48:00.000Z'};
 failWrite=true;await assert.rejects(writeReceipts([{meta,blob}]),/disk full/);assert.equal(files.size,0);
 failWrite=false;await writeReceipts([{meta,blob}]);assert.equal(await blobBase64(await readReceipt(id)),await blobBase64(blob));
 const original=files.get(`receipts/${id}.jpg`);
 const other=new Blob([new Uint8Array([255,216,255,224,0,1,2,4])],{type:'image/jpeg'});
 await assert.rejects(writeReceipts([{meta:{...meta,sha256:await receiptHash(other)},blob:other}]),/damaged/);
 assert.equal(files.get(`receipts/${id}.jpg`),original);
 unreadable=true;await assert.rejects(writeReceipts([{meta,blob}]),/unavailable/);assert.equal(files.get(`receipts/${id}.jpg`),original);
 await assert.rejects(readReceipt('../outside'),/not valid/);
});
test('reattaching historical photos requires verified local bytes, not just Markdown metadata',async()=>{
 files.clear();failWrite=false;unreadable=false;
 const blob=new Blob([new Uint8Array([255,216,255,224,0,1,2,3])],{type:'image/jpeg'});
 const meta={id:'b2ef0b72-62c7-48ba-9aac-b78314795946',entryId:'entry',name:'Receipt',type:'image/jpeg',size:blob.size,sha256:await receiptHash(blob),addedAt:'2026-11-21T10:48:00.000Z'};
 const budget={expenses:[{id:'entry',receiptIds:[]}],receiptData:{assets:[meta],events:[]}},before=structuredClone(budget);
 await assert.rejects(receiptAssetsForSave(budget,'entry',[meta.id],[]),/Restore a full backup/);
 assert.deepEqual(budget,before);
 await writeReceipts([{meta,blob}]);
 const assets=await receiptAssetsForSave(budget,'entry',[meta.id],[]);
 assert.equal(assets.length,1);assert.deepEqual(assets[0].meta,meta);
 assert.equal(await blobBase64(assets[0].blob),await blobBase64(blob));
 files.set(`receipts/${meta.id}.jpg`,await blobBase64(new Blob(['damaged'])));
 await assert.rejects(receiptAssetsForSave(budget,'entry',[meta.id],[]),/Restore a full backup/);
 assert.deepEqual(budget,before);
});
