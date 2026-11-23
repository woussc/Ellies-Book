// Pure, book-scoped import transactions. Sources/passwords never enter this model.
import { validateBudget } from "./model.mjs";
import { periodId, periodRange, validRepeatDate } from "./repeat-model.mjs";
const text = (s, n = 200) =>
  typeof s === "string" && s.length > 0 && s.length <= n;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cents = (n) => Math.round(n * 100);
const exactAmount = (n) =>
  typeof n === "number" &&
  Number.isFinite(n) &&
  n > 0 &&
  n <= 1e9 &&
  Math.abs(n * 100 - Math.round(n * 100)) < 0.0001;
const normalize = (s) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const key = (r) =>
  `${r.date}|${cents(r.amount)}|${r.currency}|${normalize(r.description)}`;
const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
function scope(library, id) {
  const book = library.books.find((b) => b.projects.some((p) => p.id === id));
  if (book)
    return {
      projects: book.projects,
      project: book.projects.find((p) => p.id === id),
    };
  if (library.example?.id === id)
    return { projects: [library.example], project: library.example };
  throw new Error(
    "This project is no longer available. Open it again before importing.",
  );
}
function pool(projects) {
  return projects.flatMap((p) =>
    [
      p,
      ...(p.periods ?? []).filter((v) => periodId(v) !== periodId(p)),
    ].flatMap((v) =>
      v.expenses.map((e) => ({ ...e, projectId: p.id, period: periodId(v) })),
    ),
  );
}
function activeBatches(projects) {
  return projects.flatMap((p) =>
    (p.statementImports?.batches ?? []).filter((b) => !b.undone),
  );
}
function putProject(library, project) {
  return library.example?.id === project.id
    ? { ...library, example: project }
    : {
        ...library,
        books: library.books.map((b) => ({
          ...b,
          projects: b.projects.map((p) => (p.id === project.id ? project : p)),
        })),
      };
}
export function statementAccounts(library, projectId) {
  const { projects } = scope(library, projectId);
  return [
    ...new Map(
      projects
        .flatMap((p) => p.statementImports?.accounts ?? [])
        .map((a) => [a.id, a]),
    ).values(),
  ];
}
export function reviewStatement(library, request) {
  const { projects, project } = scope(library, request.projectId),
    entries = pool(projects),
    batches = activeBatches(projects),
    refs = batches.flatMap((b) =>
      b.items.map((i) => ({ ...i, accountId: b.accountId })),
    );
  const range =
    project.startDate && project.endDate
      ? project
      : /^\d{4}-\d{2}$/.test(project.period)
        ? periodRange(project.period)
        : null;
  return request.rows.map((r) => {
    const candidates = [];
    const result = (state, reason) => ({ id: r.id, state, reason, candidates });
    if (
      validRepeatDate(r.date) &&
      exactAmount(r.amount) &&
      text(r.description, 100)
    )
      for (const e of entries) {
        const near = validRepeatDate(e.date) && days(e.date, r.date) <= 7;
        if (
          near &&
          (cents(e.amount) === cents(r.amount) ||
            normalize(e.description) === normalize(r.description))
        )
          candidates.push({
            ...e,
            exactAmount: cents(e.amount) === cents(r.amount),
          });
      }
    if (r.decision === "skip") return result("left", "Left out by you");
    if (!r.checked)
      return result("needs", "Check this row against the statement.");
    if (r.direction === "in")
      return result("left", "Income or refund; spending only.");
    if (r.direction === "transfer")
      return result("left", "Transfer; not spending.");
    if (
      !validRepeatDate(r.date) ||
      !exactAmount(r.amount) ||
      !text(r.description, 100) ||
      r.currency !== "USD" ||
      r.direction !== "out"
    )
      return result(
        "needs",
        "Check the date, description, exact amount, currency and direction.",
      );
    if (!range || r.date < range.startDate || r.date > range.endDate)
      return result(
        "needs",
        "This date is outside the destination period. Fix it or leave the row out.",
      );
    const sourceRefs = refs.filter(
      (i) =>
        i.accountId === request.account.id &&
        (i.sourceId === r.sourceId || (r.bankId && i.bankId === r.bankId)),
    );
    if (sourceRefs.length) {
      if (sourceRefs.some((i) => i.key !== key(r)))
        return result(
          "needs",
          "This bank reference already has different details. Check the earlier import.",
        );
      return result("already", "Already imported from this account.");
    }
    const others = request.rows.filter(
      (o) =>
        o.id !== r.id &&
        o.decision !== "skip" &&
        o.direction === "out" &&
        validRepeatDate(o.date) &&
        exactAmount(o.amount) &&
        key(o) === key(r),
    );
    if (
      r.bankId &&
      request.rows.some(
        (o) => o.id !== r.id && o.decision !== "skip" && o.bankId === r.bankId,
      )
    )
      return result(
        "needs",
        "This bank transaction ID appears twice. Leave one copy out.",
      );
    if (
      request.rows.some(
        (o) =>
          o.id !== r.id && o.decision !== "skip" && o.sourceId === r.sourceId,
      )
    )
      return result(
        "needs",
        "This source row was selected more than once. Leave one copy out.",
      );
    if (r.decision === "match" || r.decision === "link") {
      const selected = candidates.find(
        (e) =>
          e.id === r.matchId &&
          e.projectId === r.matchProjectId &&
          e.period === r.matchPeriod,
      );
      if (!selected || !selected.exactAmount)
        return result(
          "needs",
          "The selected entry changed. Choose a same-amount match again.",
        );
      if (
        r.decision === "match" &&
        (selected.projectId !== project.id ||
          selected.period !== periodId(project) ||
          selected.status === "paid")
      )
        return result(
          "needs",
          "Only an open entry in this destination period can be marked Paid.",
        );
      if (r.decision === "link" && selected.status !== "paid")
        return result(
          "needs",
          "Choose a Paid entry, or match an open bill in this period.",
        );
      if (
        request.rows.some(
          (o) =>
            o.id !== r.id &&
            o.decision !== "skip" &&
            o.matchId === r.matchId &&
            o.matchProjectId === r.matchProjectId &&
            o.matchPeriod === r.matchPeriod,
        )
      )
        return result(
          "needs",
          "Two rows point to the same entry. Leave one out or confirm separate purchases.",
        );
      return result(
        "ready",
        r.decision === "link"
          ? "Link to the existing Paid entry."
          : `${selected.status === "planned" ? "Planned" : "Committed"} → Paid; no second entry.`,
      );
    }
    if ((candidates.length || others.length) && !r.separate)
      return result(
        "needs",
        others.length
          ? "These rows look alike. Same payment or separate purchases?"
          : "This may be a payment already in your book.",
      );
    if (!project.categories.some((c) => c.id === r.categoryId))
      return result("needs", "Choose a category.");
    if (r.decision !== "new")
      return result("needs", "Choose what should happen to this payment.");
    return result("ready", "New Paid entry.");
  });
}
export function applyStatement(library, request) {
  const { projects, project } = scope(library, request.projectId);
  if (
    !text(request.id) ||
    !text(request.account?.id) ||
    !text(request.account?.label, 80) ||
    !Array.isArray(request.rows) ||
    request.rows.length > 1000 ||
    new Set(request.rows.map((r) => r.id)).size !== request.rows.length
  )
    throw new Error("This import is not valid. Review the statement again.");
  if (activeBatches(projects).some((b) => b.id === request.id)) return library;
  if (
    projects.some((p) =>
      p.statementImports?.batches.some((b) => b.id === request.id),
    )
  )
    throw new Error(
      "That import was undone. Start a new import to add it again.",
    );
  if (
    library.activeProjectId !== (project.sample ? "example" : project.id) ||
    periodId(project) !== request.period
  )
    throw new Error(
      "Your destination changed. Open it and review the import again.",
    );
  const known = statementAccounts(library, project.id);
  if (
    known.some(
      (a) =>
        (a.id === request.account.id && a.label !== request.account.label) ||
        (a.label.toLowerCase() === request.account.label.toLowerCase() &&
          a.id !== request.account.id),
    )
  )
    throw new Error(
      "Use the existing account label to keep duplicate checks together.",
    );
  const review = reviewStatement(library, request);
  if (review.some((r) => r.state === "needs"))
    throw new Error(
      "Some payments need another look. Review them before importing.",
    );
  const ready = request.rows.filter((r, i) => review[i].state === "ready");
  if (!ready.length)
    throw new Error("No new or matched payments to import. Nothing changed.");
  if (
    ready.some(
      (r) =>
        !text(r.sourceId, 150) ||
        !/^([a-f0-9]{64}|manual:[a-zA-Z0-9-]+):\d+$/.test(r.sourceId) ||
        (r.bankId !== undefined && !text(r.bankId, 150)),
    )
  )
    throw new Error("A source reference is missing. Read the statement again.");
  const entries = pool(projects),
    expenses = [...project.expenses],
    items = [];
  for (const r of ready) {
    const before =
      r.decision === "new"
        ? null
        : entries.find(
            (e) =>
              e.id === r.matchId &&
              e.projectId === r.matchProjectId &&
              e.period === r.matchPeriod,
          );
    const cleanBefore = before
      ? Object.fromEntries(
          Object.entries(before).filter(
            ([k]) => !["projectId", "period"].includes(k),
          ),
        )
      : null;
    const after =
      r.decision === "link"
        ? cleanBefore
        : r.decision === "match"
          ? {
              ...cleanBefore,
              status: "paid",
              date: r.date,
              history: [
                ...cleanBefore.history.filter((s) => s !== "paid"),
                "paid",
              ],
            }
          : {
              id: crypto.randomUUID(),
              description: r.description.trim(),
              amount: r.amount,
              status: "paid",
              history: ["paid"],
              date: r.date,
              categoryId: r.categoryId,
              notes: "",
            };
    if (r.decision === "match") {
      const i = expenses.findIndex((e) => e.id === after.id);
      expenses[i] = after;
    } else if (r.decision === "new") expenses.push(after);
    items.push({
      entryId: after.id,
      projectId: before?.projectId ?? project.id,
      period: before?.period ?? request.period,
      sourceId: r.sourceId,
      ...(r.bankId ? { bankId: r.bankId } : {}),
      key: key(r),
      bankDescription: r.originalDescription ?? r.description,
      kind: r.decision,
      before: structuredClone(cleanBefore),
      after: structuredClone(after),
    });
  }
  const batch = {
    id: request.id,
    accountId: request.account.id,
    period: request.period,
    at: new Date().toISOString(),
    items,
    dependsOn: activeBatches(projects)
      .filter((b) =>
        b.items.some((i) =>
          items.some(
            (j) =>
              j.entryId === i.entryId &&
              j.projectId === i.projectId &&
              j.period === i.period,
          ),
        ),
      )
      .map((b) => b.id),
    excluded: review.filter((r) => r.state === "left").length,
    undone: false,
  };
  const metadata = project.statementImports ?? { accounts: [], batches: [] };
  const next = {
    ...project,
    // Legacy periods use their editable label as identity until first import.
    // Anchor it before storing references so later label edits stay harmless.
    periodId: periodId(project),
    expenses,
    statementImports: {
      accounts: metadata.accounts.some((a) => a.id === request.account.id)
        ? metadata.accounts
        : [...metadata.accounts, request.account],
      batches: [...metadata.batches, batch],
    },
    events: [
      ...project.events,
      {
        text: `Statement import: ${items.filter((i) => i.kind === "new").length} entries added, ${items.filter((i) => i.kind === "match").length} marked Paid, ${items.filter((i) => i.kind === "link").length} linked to Paid.`,
        at: batch.at,
      },
    ],
  };
  validateBudget(next);
  return putProject(library, next);
}
export function undoStatement(library, projectId, batchId) {
  const { projects, project } = scope(library, projectId),
    batch = project.statementImports?.batches.find((b) => b.id === batchId);
  if (!batch || batch.undone)
    throw new Error("This import was already undone or is not available.");
  const entries = pool(projects);
  for (const item of batch.items) {
    // A Paid link adds only provenance. Removing it does not edit the payment,
    // so older imports (or later edits to that payment) cannot block unlinking.
    if (item.kind === "link") continue;
    const current = entries.find(
      (e) =>
        e.id === item.entryId &&
        e.projectId === item.projectId &&
        e.period === item.period,
    );
    const clean = current
      ? Object.fromEntries(
          Object.entries(current).filter(
            ([k]) => !["projectId", "period"].includes(k),
          ),
        )
      : null;
    if (!same(clean, item.after))
      throw new Error(
        "An imported entry was edited or removed later. Review that entry before undoing; nothing changed.",
      );
    if (
      activeBatches(projects).some(
        (b) =>
          b.id !== batch.id &&
          (b.dependsOn === undefined || b.dependsOn.includes(batch.id)) &&
          b.items.some(
            (i) =>
              i.entryId === item.entryId &&
              i.projectId === item.projectId &&
              i.period === item.period,
          ),
      )
    )
      throw new Error(
        "A later import uses these entries. Undo the later import first; nothing changed.",
      );
  }
  const update = (period) => ({
    ...period,
    expenses: period.expenses.flatMap((e) => {
      const item = batch.items.find(
        (i) =>
          i.entryId === e.id &&
          i.projectId === projectId &&
          i.period === periodId(period),
      );
      return !item || item.kind === "link"
        ? [e]
        : item.before
          ? [item.before]
          : [];
    }),
  });
  const next = {
    ...update(project),
    ...(project.periods ? { periods: project.periods.map(update) } : {}),
    statementImports: {
      ...project.statementImports,
      batches: project.statementImports.batches.map((b) =>
        b.id === batch.id ? { ...b, undone: true } : b,
      ),
    },
    events: [
      ...project.events,
      {
        text: `Undid statement import from ${batch.at}. Restored entries and duplicate references.`,
        at: new Date().toISOString(),
      },
    ],
  };
  validateBudget(next);
  return putProject(library, next);
}
export function validateStatementData(budget) {
  const data = budget.statementImports;
  if (data === undefined) return;
  const fail = () => {
    throw new Error(
      "Could not read the statement-import history in this backup.",
    );
  };
  if (
    !data ||
    !Array.isArray(data.accounts) ||
    !Array.isArray(data.batches) ||
    data.accounts.length > 1000 ||
    data.batches.length > 10000 ||
    new Set(data.accounts.map((a) => a?.id)).size !== data.accounts.length ||
    new Set(data.batches.map((b) => b?.id)).size !== data.batches.length
  )
    fail();
  for (const a of data.accounts)
    if (!a || !text(a.id) || !text(a.label, 80)) fail();
  for (const b of data.batches) {
    if (
      !b ||
      !text(b.id) ||
      !data.accounts.some((a) => a.id === b.accountId) ||
      !text(b.period) ||
      !Number.isFinite(Date.parse(b.at)) ||
      typeof b.undone !== "boolean" ||
      !Array.isArray(b.items) ||
      !b.items.length ||
      b.items.length > 1000 ||
      !Number.isInteger(b.excluded) ||
      b.excluded < 0 ||
      (b.dependsOn !== undefined &&
        (!Array.isArray(b.dependsOn) ||
          b.dependsOn.some((id) => !text(id) || id === b.id)))
    )
      fail();
    for (const i of b.items)
      if (
        !i ||
        !text(i.entryId) ||
        !text(i.projectId) ||
        !text(i.period) ||
        !text(i.sourceId, 150) ||
        !text(i.key, 400) ||
        !["new", "match", "link"].includes(i.kind) ||
        !i.after ||
        i.after.id !== i.entryId ||
        (i.kind !== "new" && !i.before) ||
        (i.kind === "new" && i.before !== null)
      )
        fail();
  }
}
