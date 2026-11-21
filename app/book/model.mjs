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
  const validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if ((b?.startDate !== undefined || b?.endDate !== undefined) &&
      (!validDate(b.startDate) || !validDate(b.endDate) || b.startDate > b.endDate))
    throw new Error("Choose a valid start and end date. End must not precede start.");
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
  if (b.board !== undefined) {
    const modules = ["budget", "committed", "paid", "notes"];
    const ids = (v) => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
    if (!object(b.board) || !ids(b.board.order) || b.board.order.length !== 4 ||
      !b.board.order.every((id) => modules.includes(id)) || !object(b.board.sizes) ||
      !Object.entries(b.board.sizes).every(([id, size]) => modules.includes(id) && ["compact", "regular", "wide"].includes(size)) ||
      !ids(b.board.expanded) || !ids(b.board.nodeOrder)) {
      throw new Error("Could not read the board layout in this backup.");
    }
    if (b.board.canvas !== undefined) {
      const canvas = b.board.canvas;
      const coordinate = (value) => Number.isFinite(value) && Math.abs(value) <= 1000000;
      if (!object(canvas) || !object(canvas.positions) || !object(canvas.sizes) || !object(canvas.viewport) ||
          !Object.values(canvas.positions).every(point => object(point) && coordinate(point.x) && coordinate(point.y) && point.x >= 0 && point.y >= 0) ||
          !Object.entries(canvas.sizes).every(([id, size]) => ["small", "medium", "large"].includes(size) && !(size === "small" && (id === "budget" || id.startsWith("category:")))) ||
          !coordinate(canvas.viewport.x) || !coordinate(canvas.viewport.y) || !Number.isFinite(canvas.viewport.zoom) || canvas.viewport.zoom < 0.05 || canvas.viewport.zoom > 1.8) {
        throw new Error("Could not read the canvas layout in this backup.");
      }
      const validView = view => object(view) && object(view.positions) && object(view.viewport) &&
        Object.values(view.positions).every(p => object(p) && coordinate(p.x) && coordinate(p.y) && p.x >= 0 && p.y >= 0) &&
        coordinate(view.viewport.x) && coordinate(view.viewport.y) && Number.isFinite(view.viewport.zoom) && view.viewport.zoom >= 0.05 && view.viewport.zoom <= 1.8;
      if (canvas.scenes !== undefined && (!object(canvas.scenes) || !Object.entries(canvas.scenes).every(([key, view]) =>
        ["overview", "budget", "committed", "paid", "notes"].includes(key) && validView(view))))
        throw new Error("Could not read the widget cluster layout in this backup.");
      if (canvas.dimensions !== undefined && (!object(canvas.dimensions) || !Object.entries(canvas.dimensions).every(([id, size]) => {
        const minWidth = id === "budget" ? 138 : id.startsWith("category:") ? 128 : 104;
        const minHeight = id === "budget" ? 104 : id.startsWith("category:") ? 88 : 64;
        return object(size) && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width >= minWidth && size.height >= minHeight && size.width <= 560 && size.height <= 560;
      }))) throw new Error("Could not read the widget dimensions in this backup.");
    }
  }
  if (
    !b.expenses.every(
      (e) =>
        object(e) &&
        text(e.id) &&
        e.id &&
        text(e.description) &&
        (e.notes === undefined || (text(e.notes) && e.notes.length <= 50000)) &&
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    startDate: "2026-11-01",
    endDate: "2026-11-30",
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
  const allocation = categoryId
    ? budget.categories.find((c) => c.id === categoryId)?.amount || 0
    : budget.categories.reduce((s, c) => s + c.amount, 0);
  const baseline = categoryId ? allocation : budget.total;
  const lineage = computeBudgetSummary({
    ...lifecycle(expenses),
    approvedBudget: baseline,
    uncommittedProposedCost: expenses.filter((e) => e.status === "planned").reduce((s, e) => s + e.amount, 0),
  });
  return {
    plan: round(allocation),
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
// Corrections replace the current financial projection, not the audit record.
// In particular, correcting Paid back to Committed must not leave an Actual
// in the active lineage. The complete prior lineage remains in event.before.
export function editExpense(budget, id, patch) {
  const before = budget.expenses.find((e) => e.id === id);
  if (!before) return budget;
  const labels = { description: "Description", amount: "Amount", categoryId: "Category", status: "Status", date: "Date", notes: "Note" };
  const after = { ...before };
  for (const key of Object.keys(labels)) {
    if (Object.hasOwn(patch, key)) after[key] = patch[key];
  }
  if (typeof after.description !== "string" || !after.description.trim() || after.description.length > 100)
    throw new Error("Give this entry a description of up to 100 characters.");
  after.description = after.description.trim();
  if (typeof after.amount !== "number" || !Number.isFinite(after.amount) || after.amount <= 0 || after.amount > 1e9)
    throw new Error("Enter an amount between $0.01 and $1,000,000,000.");
  after.amount = round(after.amount);
  const changed = Object.keys(labels).filter((key) => before[key] !== after[key]);
  if (!changed.length) return budget;
  const states = ["planned", "committed", "paid"];
  if (before.status !== after.status) {
    after.history = [...before.history.filter((s) => states.indexOf(s) < states.indexOf(after.status)), after.status];
  }
  const value = (key, entry) => key === "amount" ? money(entry[key])
    : key === "categoryId" ? budget.categories.find((c) => c.id === entry[key])?.name ?? entry[key]
    : entry[key];
  const next = {
    ...budget,
    expenses: budget.expenses.map((e) => e.id === id ? after : e),
    events: [...budget.events, {
      text: `Corrected ${before.description}: ${changed.map((key) => `${labels[key]}: ${value(key, before)} → ${value(key, after)}`).join("; ")}`,
      at: new Date().toISOString(),
      before,
      after,
    }],
  };
  validateBudget(next);
  return next;
}
export function removeExpense(budget, id) {
  const before = budget.expenses.find((e) => e.id === id);
  if (!before) return budget;
  const category = budget.categories.find((c) => c.id === before.categoryId)?.name;
  return {
    ...budget,
    expenses: budget.expenses.filter((e) => e.id !== id),
    events: [...budget.events, {
      text: `Removed ${before.description} · ${money(before.amount)} · ${before.status} · ${category} · ${before.date}. Kept in the audit trail, excluded from totals.`,
      at: new Date().toISOString(),
      before,
      after: null,
    }],
  };
}
export function editBudgetDetails(budget, details) {
  const labels = { name: "Name", total: "Budget total", profile: "Profile", period: "Period", startDate: "Start date", endDate: "End date" };
  const before = Object.fromEntries(Object.keys(labels).filter(key=>budget[key]!==undefined).map((key) => [key, budget[key]]));
  const after = Object.fromEntries(Object.keys(labels).map((key) => [key, Object.hasOwn(details, key) ? details[key] : budget[key]]).filter(([,value])=>value!==undefined));
  const changed = Object.keys(labels).filter((key) => before[key] !== after[key]);
  if (budget.created && !changed.length) return budget;
  const value = (key, data) => key === "total" ? money(data[key]) : data[key];
  const next = {
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
  return validateBudget(next);
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
  return `# ${budget.name}\n${budget.period} · ${budget.profile}${budget.startDate ? ` · ${budget.startDate} — ${budget.endDate}` : ''}\n\nOur approved budget is ${money(budget.total)}. We've allocated ${money(t.plan)} by category.\n\nWe've paid ${money(t.spent)}, with ${money(t.committed)} still to pay. That leaves ${money(t.left)} available after those commitments.\n\n## By category\n${budget.categories
    .map((c) => {
      const s = totals(budget, c.id);
      return `- ${c.name}: ${money(c.amount)} allocated, ${money(s.spent)} paid, ${money(s.committed)} still to pay, ${money(s.left)} left.`;
    })
    .join(
      "\n",
    )}\n\n## Entry notes\n${budget.expenses.filter(e=>e.notes).map(e=>`### ${e.description}\n${e.notes}`).join('\n\n') || 'No entry notes yet.'}\n\n## Notes\n${budget.notes || "No notes yet."}\n\nLeft = budget − paid − still to pay. Planned entries are ideas, not payments.\n`;
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
      "Allocation USD",
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
