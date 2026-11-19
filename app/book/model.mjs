// UI/storage adapter. Financial lineage and headroom belong to the canonical engine.
import {
  computeBudgetSummary,
  safeSpreadsheetText,
} from "../budget-domain.mjs";

export const STORAGE_KEY = "ellies-book:book:v1.md";
export const SAMPLE_STORAGE_KEY = "ellies-book:example:v1.md";
const PREVIEW_KEY = "ellies-book:look-a:v1";
const PREVIEW_SAMPLE_KEY = "ellies-book:look-a:example:v1";
const LEGACY_KEYS = [
  "function-budget-studio-v1-4-working",
  "function-budget-studio-v1-3-working",
];
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function readStoredBudget(storage, example = true) {
  for (const key of example
    ? [SAMPLE_STORAGE_KEY, STORAGE_KEY, PREVIEW_SAMPLE_KEY, PREVIEW_KEY]
    : [STORAGE_KEY, PREVIEW_KEY]) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    const b = key.endsWith(".md") ? parseBook(raw) : JSON.parse(raw);
    // Earlier preview revisions used one key for both modes. Never restore
    // an old example as the user's own budget, including on Remove example.
    if ((key === STORAGE_KEY || key === PREVIEW_KEY) && b.sample) continue;
    validateBudget(b);
    return b;
  }
  return blankBudget();
}
export function persistBudget(storage, budget) {
  storage.setItem(
    budget.sample ? SAMPLE_STORAGE_KEY : STORAGE_KEY,
    serializeBook(budget),
  );
  if (!budget.sample) {
    storage.removeItem(SAMPLE_STORAGE_KEY);
    storage.removeItem(PREVIEW_SAMPLE_KEY);
  }
}

// YAML accepts JSON flow mappings. Keep structured records in frontmatter and
// the exact Markdown note in the body, including wikilinks and blank lines.
// Parsing is deliberately limited to our versioned format, never arbitrary YAML.
export function serializeBook(budget) {
  validateBudget(budget);
  const { notes, ...data } = budget;
  return `---\nschema: ellies-book/v1\ndata: ${JSON.stringify(data)}\n---\n${notes}`;
}

export function parseBook(markdown) {
  const match =
    /^---\r?\nschema: ellies-book\/v1\r?\ndata: ([^\r\n]+)\r?\n---\r?\n([\s\S]*)$/.exec(
      markdown,
    );
  if (!match)
    throw new Error(
      "Could not read this book format. Keep a backup and restore an Ellie’s Book .md file.",
    );
  const budget = { ...JSON.parse(match[1]), notes: match[2] };
  validateBudget(budget);
  return budget;
}

export function validateBudget(b) {
  const text = (v) => typeof v === "string";
  const amount = (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e9;
  const object = (v) => v && typeof v === "object" && !Array.isArray(v);
  const unique = (rows) => new Set(rows.map((r) => r.id)).size === rows.length;
  const states = ["planned", "committed", "paid"];
  if (
    !object(b) ||
    !text(b.id) ||
    !b.id ||
    !Object.hasOwn(profiles, b.profile) ||
    !text(b.name) ||
    !text(b.period) ||
    !text(b.notes) ||
    !amount(b.total) ||
    typeof b.created !== "boolean" ||
    typeof b.sample !== "boolean" ||
    !Array.isArray(b.categories) ||
    !Array.isArray(b.expenses) ||
    !Array.isArray(b.events)
  ) {
    throw new Error(
      "Could not read this budget. Keep a backup before restoring another book.",
    );
  }
  if (
    !b.categories.every(
      (c) =>
        object(c) &&
        text(c.id) &&
        c.id &&
        text(c.name) &&
        amount(c.amount) &&
        text(c.owner) &&
        text(c.glCode),
    ) ||
    !unique(b.categories)
  ) {
    throw new Error("Could not read the categories in this backup.");
  }
  const categoryIds = new Set(b.categories.map((c) => c.id));
  if (
    !b.expenses.every(
      (e) =>
        object(e) &&
        text(e.id) &&
        e.id &&
        text(e.description) &&
        amount(e.amount) &&
        e.amount > 0 &&
        categoryIds.has(e.categoryId) &&
        states.includes(e.status) &&
        /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
        Array.isArray(e.history) &&
        e.history.length > 0 &&
        e.history.at(-1) === e.status &&
        e.history.every(
          (s, i) =>
            states.includes(s) &&
            (i === 0 || states.indexOf(s) > states.indexOf(e.history[i - 1])),
        ),
    ) ||
    !unique(b.expenses)
  ) {
    throw new Error("Could not read the spending history in this backup.");
  }
  if (
    !b.events.every(
      (e) =>
        object(e) &&
        text(e.text) &&
        text(e.at) &&
        Number.isFinite(Date.parse(e.at)),
    )
  )
    throw new Error("Could not read the activity in this backup.");
  return b;
}

export function legacyBackup(storage) {
  const records = Object.fromEntries(
    LEGACY_KEYS.map((key) => [key, storage.getItem(key)]).filter(
      ([, raw]) => raw,
    ),
  );
  return Object.keys(records).length ? JSON.stringify(records, null, 2) : "";
}
export const profiles = {
  Household: [
    "Home & bills",
    "Food & groceries",
    "Getting around",
    "Family & fun",
    "A little extra",
  ],
  "Just me": [
    "Home & bills",
    "Food & groceries",
    "Getting around",
    "Life & leisure",
    "A little extra",
  ],
  Team: ["People", "Tools & software", "Travel", "Events", "A little extra"],
};
export const round = (v) =>
  Math.round((Number(v) + Number.EPSILON) * 100) / 100;
export const money = (v) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
  }).format(v);
export function blankBudget(profile = "Household", initial = {}) {
  return {
    id: initial.id ?? crypto.randomUUID(),
    name: "",
    profile,
    total: 0,
    period: initial.period ?? new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date()),
    created: false,
    sample: false,
    categories: profiles[profile].map((name, i) => ({
      id: `category-${i}`,
      name,
      amount: 0,
      owner: "",
      glCode: "",
    })),
    expenses: [],
    notes: "",
    events: [],
  };
}
export function exampleBudget() {
  const b = blankBudget();
  return {
    ...b,
    name: "Our November",
    total: 5000,
    created: true,
    sample: true,
    categories: b.categories.map((c, i) => ({
      ...c,
      amount: [2000, 900, 450, 650, 500][i],
    })),
    expenses: [
      {
        id: "rent",
        categoryId: "category-0",
        description: "November rent",
        amount: 1600,
        status: "paid",
        date: "2026-11-01",
        history: ["paid"],
      },
      {
        id: "shop",
        categoryId: "category-1",
        description: "Weekly grocery shop",
        amount: 126.5,
        status: "paid",
        date: "2026-11-16",
        history: ["paid"],
      },
      {
        id: "internet",
        categoryId: "category-0",
        description: "Internet bill",
        amount: 65,
        status: "committed",
        date: "2026-11-20",
        history: ["committed"],
      },
      {
        id: "weekend",
        categoryId: "category-3",
        description: "Weekend at the lake",
        amount: 180,
        status: "planned",
        date: "2026-11-28",
        history: ["planned"],
      },
    ],
    notes:
      "## A small November intention\nKeep room for a weekend together.\n\nInternet bill is due on the 20th. [[Home & bills]]",
    events: [],
  };
}
export function lifecycle(expenses) {
  const lifecycleLines = [],
    transitions = [];
  for (const e of expenses) {
    let prev;
    for (const status of e.history || [e.status]) {
      if (status === "planned") continue;
      const id = `${e.id}-${status}`;
      lifecycleLines.push({
        id,
        spendingLineId: e.id,
        amount: e.amount,
        stage: status === "paid" ? "Actual" : "Invoice",
      });
      if (prev)
        transitions.push({
          fromLineId: prev,
          toLineId: id,
          convertedAmount: e.amount,
        });
      prev = id;
    }
  }
  return { lifecycleLines, transitions };
}
export function totals(budget, categoryId) {
  const expenses = budget.expenses.filter(
    (e) => !categoryId || e.categoryId === categoryId,
  );
  const plan = categoryId
    ? budget.categories.find((c) => c.id === categoryId)?.amount || 0
    : budget.categories.reduce((s, c) => s + c.amount, 0);
  const baseline = categoryId ? plan : budget.total;
  const lineage = computeBudgetSummary({
    ...lifecycle(expenses),
    approvedBudget: baseline,
    plannedTotal: plan,
    uncommittedProposedCost: expenses.filter((e) => e.status === "planned").reduce((s, e) => s + e.amount, 0),
  });
  return {
    plan: round(plan),
    spent: round(lineage.actualTotal),
    committed: round(lineage.openCommitmentTotal),
    left: round(lineage.availableToCommit),
    forecast: round(lineage.forecastSpend),
  };
}
export function advanceExpense(budget, id) {
  return {
    ...budget,
    expenses: budget.expenses.map((e) =>
      e.id !== id || e.status === "paid"
        ? e
        : {
            ...e,
            status: e.status === "planned" ? "committed" : "paid",
            history: [
              ...e.history,
              e.status === "planned" ? "committed" : "paid",
            ],
          },
    ),
  };
}
export function editBudgetDetails(budget, details) {
  const labels = { name: "Name", total: "Budget total", profile: "Profile", period: "Period" };
  const before = Object.fromEntries(Object.keys(labels).map((key) => [key, budget[key]]));
  const after = Object.fromEntries(Object.keys(labels).map((key) => [key, details[key]]));
  const changed = Object.keys(labels).filter((key) => before[key] !== after[key]);
  if (budget.created && !changed.length) return budget;
  const value = (key, data) => key === "total" ? money(data[key]) : data[key];
  return {
    ...budget,
    ...after,
    categories: !budget.created && budget.profile !== details.profile
      ? blankBudget(details.profile).categories : budget.categories,
    created: true,
    events: [...budget.events, {
      text: budget.created
        ? `Updated budget details: ${changed.map((key) => `${labels[key]}: ${value(key, before)} → ${value(key, after)}`).join("; ")}`
        : "Created and confirmed budget",
      at: new Date().toISOString(),
      before,
      after,
    }],
  };
}
export function editCategory(budget, id, patch) {
  const before = budget.categories.find((c) => c.id === id);
  if (!before) return budget;
  const changes = Object.entries(patch).filter(
    ([key, value]) => before[key] !== value,
  );
  if (!changes.length) return budget;
  const after = { ...before, ...patch };
  const text = `${before.name}: ${changes.map(([key, value]) => `${key} ${JSON.stringify(before[key])} → ${JSON.stringify(value)}`).join(", ")}`;
  return {
    ...budget,
    categories: budget.categories.map((c) => (c.id === id ? after : c)),
    events: [
      ...budget.events,
      { text, at: new Date().toISOString(), before, after },
    ],
  };
}
export function reportText(budget) {
  const t = totals(budget);
  return `# ${budget.name}\n${budget.period} · ${budget.profile}\n\nOur budget is ${money(budget.total)}. We've planned ${money(t.plan)} by category.\n\nWe've paid ${money(t.spent)}, with ${money(t.committed)} still to pay. That leaves ${money(t.left)} available after those commitments.\n\n## By category\n${budget.categories
    .map((c) => {
      const s = totals(budget, c.id);
      return `- ${c.name}: ${money(c.amount)} planned, ${money(s.spent)} paid, ${money(s.committed)} still to pay, ${money(s.left)} left.`;
    })
    .join(
      "\n",
    )}\n\n## Notes\n${budget.notes || "No notes yet."}\n\nLeft = budget − paid − still to pay. Planned entries are ideas, not payments.\n`;
}
export function csvText(budget) {
  const cell = (v) => {
    // Calculated amounts are numbers, not user-authored formula text.
    const value = typeof v === "number" ? String(v) : safeSpreadsheetText(String(v));
    return `"${value.replaceAll('"', '""')}"`;
  };
  return [
    [
      "Category",
      "Planned USD",
      "Paid USD",
      "Open commitments USD",
      "Available USD",
      "Owner / vendor",
      "Finance code",
    ],
    ...budget.categories.map((c) => {
      const t = totals(budget, c.id);
      // Spreadsheet imports otherwise turn a text finance code like 001230
      // into 1230. A text prefix preserves it without exporting a formula.
      const code = /^0\d/.test(c.glCode) ? `'${c.glCode}` : c.glCode;
      return [c.name, c.amount, t.spent, t.committed, t.left, c.owner, code];
    }),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
