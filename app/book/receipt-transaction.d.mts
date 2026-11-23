import type {Library} from './library-model.mjs';
import type {LocalReceipt} from './receipt-files.mjs';
export function commitReceiptLibrary(storage: Storage, write: (assets: LocalReceipt[]) => Promise<void>, assets: LocalReceipt[], change: (library: Library) => Library, lock: (work: () => Promise<Library>) => Promise<Library>, recovery?: Library): Promise<Library>;
