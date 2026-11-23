// Local category preferences only. This module never edits entries or money.
export const normalizePayee = (value) => String(value ?? '').trim().replace(/\s+/gu, ' ').toLowerCase();
const validPayee = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
const profiles = ['Household', 'Just me', 'Team'];
export function validateAutoSort(budget) {
  if (budget.autoSortRules === undefined) return;
  const rules = budget.autoSortRules;
  if (!Array.isArray(rules) || rules.length > 1000 || rules.some(r => !r || typeof r.id !== 'string' || !r.id || !validPayee(r.payee) || typeof r.categoryId !== 'string' || !r.categoryId || !profiles.includes(r.profile) || typeof r.paused !== 'boolean') || new Set(rules.map(r => r.id)).size !== rules.length || new Set(rules.map(r => r.profile + ':' + normalizePayee(r.payee))).size !== rules.length) {
    throw new Error('Could not read the auto-sort rules in this backup.');
  }
}
export function payeeRule(budget, payee) {
  return (budget.autoSortRules ?? []).find(r => r.profile === budget.profile && normalizePayee(r.payee) === normalizePayee(payee)) ?? null;
}
export function suggestCategory(budget, payee) {
  const rule = payeeRule(budget, payee);
  return rule && !rule.paused && budget.categories.some(c => c.id === rule.categoryId) ? rule : null;
}
export function shouldOfferRule(budget, entry, categoryChosen) {
  if (!categoryChosen || !validPayee(entry.payee) || !budget.categories.some(c=>c.id===entry.categoryId)) return false;
  const existing=payeeRule(budget,entry.payee);
  return !existing || existing.categoryId!==entry.categoryId || existing.paused;
}
function withRules(budget, rules, text, before, after) {
  const next = {...budget, autoSortRules: rules, events: [...budget.events, {text, at: new Date().toISOString(), before, after}]};
  validateAutoSort(next);
  return next;
}
export function rememberPayee(budget, payee, categoryId) {
  if (!validPayee(payee)) throw new Error('Enter a payee of 1–100 characters.');
  if (!budget.categories.some(c => c.id === categoryId)) throw new Error('Choose a category in this project.');
  const before = payeeRule(budget, payee);
  const after = {id: before?.id ?? crypto.randomUUID(), payee: payee.trim().replace(/\s+/gu, ' '), categoryId, profile: budget.profile, paused: false};
  return withRules(budget, [...(budget.autoSortRules ?? []).filter(r => r.id !== after.id), after], `Remembered auto-sort for ${after.payee}`, before, after);
}
export function changePayeeRule(budget, id, patch) {
  const before = (budget.autoSortRules ?? []).find(r => r.id === id && r.profile === budget.profile);
  if (!before) throw new Error('This rule is no longer available.');
  if (patch.categoryId !== undefined && !budget.categories.some(c => c.id === patch.categoryId)) throw new Error('Choose a category in this project.');
  const after = {...before, ...(patch.categoryId !== undefined ? {categoryId: patch.categoryId} : {}), ...(patch.paused !== undefined ? {paused: patch.paused} : {})};
  return withRules(budget, budget.autoSortRules.map(r => r.id === id ? after : r), `Updated auto-sort for ${before.payee}`, before, after);
}
export function removePayeeRule(budget, id) {
  const before = (budget.autoSortRules ?? []).find(r => r.id === id && r.profile === budget.profile);
  if (!before) throw new Error('This rule is no longer available.');
  return withRules(budget, budget.autoSortRules.filter(r => r.id !== id), `Removed auto-sort for ${before.payee}`, before, null);
}
export function undoPayeeRule(budget, before, after) {
  const current = (budget.autoSortRules ?? []).find(r => r.id === (after?.id ?? before?.id)) ?? null;
  if (JSON.stringify(current) !== JSON.stringify(after) || (before && (budget.autoSortRules ?? []).some(r => r.id !== before.id && r.profile === before.profile && normalizePayee(r.payee) === normalizePayee(before.payee)))) throw new Error('This rule changed since then. Review it in Auto-sort instead.');
  return withRules(budget, [...(budget.autoSortRules ?? []).filter(r => r.id !== current?.id), ...(before ? [before] : [])], 'Undid auto-sort change', after, before);
}
export function suggestStatementCategory(budget, row, patch = {}) {
  const next = {...row, ...patch};
  if (Object.hasOwn(patch, 'categoryId')) return {...next, categorySource: 'manual', suggestedBy: undefined};
  if (next.categorySource === 'manual' || next.decision !== 'new') return {...next, suggestedBy: undefined};
  const rule = suggestCategory(budget, next.payee ?? next.description);
  return {...next, categoryId: rule?.categoryId ?? (next.categorySource === 'rule' ? '' : next.categoryId), categorySource: rule ? 'rule' : undefined, suggestedBy: rule?.payee};
}
