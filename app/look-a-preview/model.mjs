// Comparison-only adapter. The canonical financial engine remains unchanged.
import { computeLifecycleLineage, safeSpreadsheetText } from "../budget-domain.mjs";

export const STORAGE_KEY = "ellies-book:look-a:v1";
export const profiles = {
  Household: ["Home & bills", "Food & groceries", "Getting around", "Family & fun", "A little extra"],
  "Just me": ["Home & bills", "Food & groceries", "Getting around", "Life & leisure", "A little extra"],
  Team: ["People", "Tools & software", "Travel", "Events", "A little extra"],
};
export const round = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
export const money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);
export function blankBudget(profile = "Household") {
  return { id: crypto.randomUUID(), name: "", profile, total: 0, period: "November 2026", created: false, sample: false,
    categories: profiles[profile].map((name, i) => ({ id: `category-${i}`, name, amount: 0, owner: "", glCode: "" })),
    expenses: [], notes: "", events: [] };
}
export function exampleBudget() {
  const b = blankBudget();
  return { ...b, name: "Our November", total: 5000, created: true, sample: true,
    categories: b.categories.map((c, i) => ({ ...c, amount: [2000, 900, 450, 650, 500][i] })),
    expenses: [
      { id: "rent", categoryId: "category-0", description: "November rent", amount: 1600, status: "paid", date: "2026-11-01", history: ["paid"] },
      { id: "shop", categoryId: "category-1", description: "Weekly grocery shop", amount: 126.5, status: "paid", date: "2026-11-16", history: ["paid"] },
      { id: "internet", categoryId: "category-0", description: "Internet bill", amount: 65, status: "committed", date: "2026-11-20", history: ["committed"] },
      { id: "weekend", categoryId: "category-3", description: "Weekend at the lake", amount: 180, status: "planned", date: "2026-11-28", history: ["planned"] },
    ], notes: "## A small November intention\nKeep room for a weekend together.\n\nInternet bill is due on the 20th. [[Home & bills]]", events: [] };
}
export function lifecycle(expenses) {
  const lifecycleLines = [], transitions = [];
  for (const e of expenses) {
    let prev;
    for (const status of e.history || [e.status]) {
      if (status === "planned") continue;
      const id = `${e.id}-${status}`;
      lifecycleLines.push({ id, amount: e.amount, stage: status === "paid" ? "Actual" : "Invoice" });
      if (prev) transitions.push({ fromLineId: prev, toLineId: id, convertedAmount: e.amount });
      prev = id;
    }
  }
  return { lifecycleLines, transitions };
}
export function totals(budget, categoryId) {
  const expenses = budget.expenses.filter(e => !categoryId || e.categoryId === categoryId);
  const plan = categoryId ? budget.categories.find(c => c.id === categoryId)?.amount || 0 : budget.categories.reduce((s, c) => s + c.amount, 0);
  const baseline = categoryId ? plan : budget.total;
  const lineage = computeLifecycleLineage({ ...lifecycle(expenses), approvedBudget: baseline });
  return { plan: round(plan), spent: round(lineage.actualTotal), committed: round(lineage.openCommitmentTotal),
    left: round(lineage.availableToCommit), forecast: round(Math.max(plan, lineage.actualTotal + lineage.openCommitmentTotal + expenses.filter(e => e.status === "planned").reduce((s, e) => s + e.amount, 0))) };
}
export function advanceExpense(budget, id) {
  return { ...budget, expenses: budget.expenses.map(e => e.id !== id || e.status === "paid" ? e : { ...e, status: e.status === "planned" ? "committed" : "paid", history: [...e.history, e.status === "planned" ? "committed" : "paid"] }) };
}
export function reportText(budget) {
  const t = totals(budget);
  return `# ${budget.name}\n${budget.period} · ${budget.profile}\n\nOur budget is ${money(budget.total)}. We've planned ${money(t.plan)} by category.\n\nWe've paid ${money(t.spent)}, with ${money(t.committed)} still to pay. That leaves ${money(t.left)} available after those commitments.\n\n## By category\n${budget.categories.map(c => { const s = totals(budget, c.id); return `- ${c.name}: ${money(c.amount)} planned, ${money(s.spent)} paid, ${money(s.committed)} still to pay, ${money(s.left)} left.`; }).join("\n")}\n\n## Notes\n${budget.notes || "No notes yet."}\n\nLeft = budget − paid − still to pay. Planned entries are ideas, not payments.\n`;
}
export function csvText(budget) {
  const cell = v => `"${safeSpreadsheetText(String(v)).replaceAll('"', '""')}"`;
  return [["Category", "Planned USD", "Paid USD", "Open commitments USD", "Available USD"], ...budget.categories.map(c => { const t = totals(budget,c.id); return [c.name,c.amount,t.spent,t.committed,t.left]; })].map(row => row.map(cell).join(",")).join("\r\n");
}
