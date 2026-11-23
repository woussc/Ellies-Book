import type {Library} from './library-model.mjs';
import type {ReceiptAsset} from './receipt-model.mjs';
export type LocalReceipt = {meta: ReceiptAsset; blob: Blob};
export function receiptHash(blob: Blob): Promise<string>;
export function checkReceiptBytes(asset: Pick<ReceiptAsset, 'size' | 'sha256'>, blob: Blob): Promise<Blob>;
export function blobBase64(blob: Blob): Promise<string>;
export function base64Blob(encoded: string): Blob;
export function createReceiptBackup(library: Library, read: (id: string) => Promise<Blob>): Promise<string>;
export function parseReceiptBackup(text: string): Promise<{markdown: string; assets: LocalReceipt[]}>;
