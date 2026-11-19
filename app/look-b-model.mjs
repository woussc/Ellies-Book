import { safeSpreadsheetText } from "./budget-domain.mjs";

/** @typedef {{id:string, name:string, amount:number, owner:string, glCode:string, details:string}} Category */
/** @typedef {"planned" | "committed" | "paid"} SpendStatus */
/** @typedef {{id:string, categoryId:string, description:string, amount:number, status:SpendStatus, date:string}} Spending */
/** @typedef {{id:string, target:string, text:string, date:string}} Note */
/** @typedef {{id:string, date:string, action:string}} Audit */
/** @typedef {{version:number, name:string, profile:string, total:number, period:string, start:string, end:string, created:boolean, example:boolean, categories:Category[], spending:Spending[], notes:Note[], audit:Audit[]}} Budget */

export const STORAGE_KEY = "ellies-book-look-b-markdown-v1";

export function persistSnapshot(storage, expected, next) {
  if (storage.getItem(STORAGE_KEY) !== expected) {
    throw new Error("This budget changed in another tab. Your changes were not saved. Refresh before editing again.");
  }
  if (next === null) storage.removeItem(STORAGE_KEY);
  else storage.setItem(STORAGE_KEY, next);
  return next;
}

export const uid = () => globalThis.crypto.randomUUID();
export const today = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const money = (cents = 0) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0,
}).format(cents / 100);

export function cents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999) {
    throw new Error("Enter an amount between 0 and 999,999,999.");
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

/** @returns {Budget} */
export function blankBudget(profile = "Household", date = new Date()) {
  const { start, end } = periodDates("Monthly", date);
  return { version: 1, profile, name: "", total: 0, period: "Monthly", start, end,
    created: false, example: false, categories: [], spending: [], notes: [], audit: [] };
}

export const profileCategories = {
  Household: ["Home", "Food & groceries", "Getting around", "Life & leisure"],
  "Just me": ["Essentials", "Work & tools", "Health", "Good things"],
  Team: ["People", "Tools & services", "Travel", "Operations"],
};

export function newCategories(profile) {
  return (profileCategories[profile] || profileCategories.Household).map((name) => ({
    id: uid(), name, amount: 0, owner: "", glCode: "", details: "",
  }));
}

/** @param {Budget} budget @param {string} id */
export function canRemoveCategory(budget, id) {
  return !budget.spending.some(s => s.categoryId === id) && !budget.notes.some(n => n.target === id);
}

export function periodDates(period, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstMonth = period === "Yearly" ? 0 : period === "Quarterly" ? Math.floor(month / 3) * 3 : month;
  const months = period === "Yearly" ? 12 : period === "Quarterly" ? 3 : 1;
  return {
    start: new Date(Date.UTC(year, firstMonth, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(year, firstMonth + months, 0)).toISOString().slice(0, 10),
  };
}

/** @param {Budget} budget */
export function totals(budget, categoryId = "") {
  const categories = categoryId ? budget.categories.filter(c => c.id === categoryId) : budget.categories;
  const items = budget.spending.filter(s => !categoryId || s.categoryId === categoryId);
  const approved = categoryId ? categories.reduce((sum, c) => sum + c.amount, 0) : budget.total;
  const planned = items.filter(s => s.status === "planned").reduce((sum, s) => sum + s.amount, 0);
  const committed = items.filter(s => s.status === "committed").reduce((sum, s) => sum + s.amount, 0);
  const paid = items.filter(s => s.status === "paid").reduce((sum, s) => sum + s.amount, 0);
  const allocated = categories.reduce((sum, c) => sum + c.amount, 0);
  const uncommittedPlanned = categories.reduce((sum, category) => {
    const records = items.filter(s => s.categoryId === category.id);
    const settled = records.filter(s => s.status !== "planned").reduce((total, s) => total + s.amount, 0);
    const estimates = records.filter(s => s.status === "planned").reduce((total, s) => total + s.amount, 0);
    // Planned entries refine the unspent category plan; they do not add the same cost twice.
    return sum + Math.max(0, category.amount - settled, estimates);
  }, 0);
  const forecast = paid + committed + uncommittedPlanned;
  return { approved, allocated, unassigned: approved - allocated, planned, uncommittedPlanned, committed, paid, left: approved - paid - committed,
    forecast, headroom: approved - forecast };
}

/** @param {Budget} budget @param {string} id @param {SpendStatus} status */
export function transitionSpending(budget, id, status) {
  if (!["planned", "committed", "paid"].includes(status)) throw new Error("Choose a valid status.");
  const item = budget.spending.find(s => s.id === id);
  if (!item) throw new Error("Spending record not found.");
  return { ...budget, spending: budget.spending.map(s => s.id === id ? { ...s, status } : s),
    audit: [...budget.audit, { id: uid(), date: new Date().toISOString(), action: `${item.description}: ${item.status} → ${status}` }] };
}

/** @param {Budget} budget */
export function toMarkdown(budget) {
  const { notes, ...data } = budget;
  return `---\nellies_book_preview: 1\nprofile: ${budget.profile}\ncurrency: USD\n---\n\n# ${budget.name || "Untitled budget"}\n\n## Budget records\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n## Knowledge notes\n\n${notes.map(n => `<!-- note:${JSON.stringify({ id: n.id, target: n.target, date: n.date, length: n.text.length })} -->\n${n.text}`).join("\n\n")}\n`;
}

export function fromMarkdown(markdown) {
  const match = markdown.match(/## Budget records\n\n```json\n([\s\S]*?)\n```/);
  if (!match) throw new Error("This is not an Ellie's Book preview budget.");
  /** @type {Budget} */
  const data = JSON.parse(match[1]);
  if (data.version !== 1 || !Array.isArray(data.categories) || !Array.isArray(data.spending) || !Array.isArray(data.audit) ||
    !Number.isSafeInteger(data.total) || data.total < 0 || typeof data.name !== "string" ||
    data.categories.some(c => !Number.isSafeInteger(c.amount) || c.amount < 0 || typeof c.name !== "string") ||
    data.spending.some(s => !Number.isSafeInteger(s.amount) || s.amount <= 0 || !["planned", "committed", "paid"].includes(s.status) || !data.categories.some(c => c.id === s.categoryId))) {
    throw new Error("This budget's saved records are invalid. Download a backup before starting over.");
  }
  let remaining = markdown.slice(markdown.indexOf("## Knowledge notes\n\n") + 20).trimStart();
  data.notes = [];
  while (remaining.trim()) {
    const note = remaining.match(/^<!-- note:(.*?) -->\n/);
    if (!note) throw new Error("A saved note could not be read.");
    const { length, ...metadata } = JSON.parse(note[1]);
    if (!Number.isSafeInteger(length) || length < 0 || length > remaining.length - note[0].length) throw new Error("A saved note is incomplete.");
    data.notes.push({ ...metadata, text: remaining.slice(note[0].length, note[0].length + length) });
    remaining = remaining.slice(note[0].length + length).trimStart();
  }
  return data;
}

/** @param {Budget} budget */
export function reportText(budget) {
  const t = totals(budget);
  return `${budget.name}\n${budget.profile} budget · ${budget.start} to ${budget.end} · USD\n\nWe set aside ${money(t.approved)}. So far, ${money(t.paid)} has been paid and ${money(t.committed)} is committed but not paid. That leaves ${money(t.left)} available to commit.\n\n${budget.categories.map(c => {
    const row = totals(budget, c.id);
    return `${c.name}: planned ${money(c.amount)} · spent ${money(row.paid)} · committed ${money(row.committed)} · left ${money(row.left)}`;
  }).join("\n")}\n\nStill planned: ${money(t.uncommittedPlanned)}, including ${money(t.planned)} in entries marked Planned. Forecast spend: ${money(t.forecast)}. Projected headroom: ${money(t.headroom)}.\n\nNotes\n${budget.notes.map(n => n.text).join("\n\n") || "No notes added."}\n\nLeft = budget − paid − open commitments. Forecast includes the remaining category plan; planned entries are included, not added twice.\nPrepared with Ellie's Book.`;
}

/** @param {Budget} budget */
export function financeCsv(budget) {
  const cell = value => `"${(typeof value === "number" ? String(value) : safeSpreadsheetText(String(value))).replaceAll('"', '""')}"`;
  const t = totals(budget);
  const rows = [["category", "approved_budget", "actuals", "open_commitments", "available_to_commit", "uncommitted_planned", "forecast_spend", "projected_headroom", "gl_code", "currency"],
    ...budget.categories.map(c => { const t = totals(budget, c.id); return [c.name, c.amount / 100, t.paid / 100, t.committed / 100, t.left / 100, t.uncommittedPlanned / 100, t.forecast / 100, t.headroom / 100, c.glCode, "USD"]; }),
    ...(t.unassigned > 0 ? [["Unassigned", t.unassigned / 100, 0, 0, t.unassigned / 100, 0, 0, t.unassigned / 100, "", "USD"]] : []),
    ["TOTAL", t.approved / 100, t.paid / 100, t.committed / 100, t.left / 100, t.uncommittedPlanned / 100, t.forecast / 100, t.headroom / 100, "", "USD"]];
  return rows.map(row => row.map(cell).join(",")).join("\r\n");
}

export function exampleBudget() {
  const b = { ...blankBudget(), name: "November at home", total: 480000, created: true, example: true };
  b.categories = newCategories("Household").map((c, i) => ({ ...c, amount: [220000, 85000, 45000, 130000][i] }));
  b.spending = [
    { id: uid(), categoryId: b.categories[0].id, description: "November rent", amount: 180000, status: "paid", date: today() },
    { id: uid(), categoryId: b.categories[1].id, description: "Weekly groceries", amount: 12650, status: "paid", date: today() },
    { id: uid(), categoryId: b.categories[0].id, description: "Electricity bill", amount: 8500, status: "committed", date: today() },
    { id: uid(), categoryId: b.categories[2].id, description: "Train pass", amount: 14000, status: "planned", date: today() },
  ];
  b.notes = [{ id: uid(), target: b.categories[0].id, text: "## A little breathing room\nKeep the remaining [[Home]] budget for winter heating. Electricity is committed, not paid yet.", date: today() }];
  b.audit = [{ id: uid(), date: new Date().toISOString(), action: "Example budget opened. You can remove it at any time." }];
  return b;
}
