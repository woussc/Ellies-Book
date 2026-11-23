import type {Budget} from './model.mjs';
export function dismissPayeeOffer(storage:Pick<Storage,'setItem'>,budget:Budget,payee:string):void;
export function isPayeeOfferDismissed(storage:Pick<Storage,'getItem'>,budget:Budget,payee:string):boolean;
