import {normalizePayee} from './auto-sort-model.mjs';
const key=(budget,payee)=>'ellies-book:auto-sort-dismissed:'+JSON.stringify([budget.id,budget.profile,normalizePayee(payee)]);
export function dismissPayeeOffer(storage,budget,payee) {
  storage.setItem(key(budget,payee),'yes');
}
export function isPayeeOfferDismissed(storage,budget,payee) {
  return storage.getItem(key(budget,payee))==='yes';
}
