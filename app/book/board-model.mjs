import { extractWikilinks } from "../budget-domain.mjs";

const modules = ["budget", "committed", "paid", "notes"];
export function boardLayout(budget) {
  return budget.board ?? { order: [...modules], sizes: {}, expanded: [], nodeOrder: [] };
}

export function orderedNodes(rows, layout) {
  const order = layout?.nodeOrder ?? [];
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
}

export function changeBoard(budget, action) {
  const layout = boardLayout(budget);
  const board = { ...layout };
  if (action.type === "reset") {
    const rest = { ...budget };
    delete rest.board;
    return rest;
  }
  if (action.type === "move") {
    if (!modules.includes(action.id) || !modules.includes(action.before) || action.id === action.before) return budget;
    board.order = layout.order.filter(id => id !== action.id);
    board.order.splice(board.order.indexOf(action.before), 0, action.id);
  } else if (action.type === "size") {
    if (!modules.includes(action.id) || !["compact", "regular", "wide"].includes(action.size)) return budget;
    board.sizes = { ...layout.sizes, [action.id]: action.size };
  } else if (action.type === "expand") {
    if (![...budget.categories, ...budget.expenses].some(r => r.id === action.id)) return budget;
    board.expanded = layout.expanded.includes(action.id)
      ? layout.expanded.filter(id => id !== action.id) : [...layout.expanded, action.id];
  } else if (action.type === "node") {
    const ids = [...budget.categories, ...budget.expenses].map(r => r.id);
    if (!ids.includes(action.id) || !ids.includes(action.before) || action.id === action.before) return budget;
    board.nodeOrder = [...new Set([...layout.nodeOrder.filter(id => ids.includes(id)), ...ids])].filter(id => id !== action.id);
    board.nodeOrder.splice(board.nodeOrder.indexOf(action.before), 0, action.id);
  } else return budget;
  return { ...budget, board };
}

export function noteConnections(budget) {
  const parsed = extractWikilinks(budget.notes);
  const records = [...budget.categories.map(c => ({ ...c, label: c.name, categoryId: c.id })),
    ...budget.expenses.map(e => ({ ...e, label: e.description }))];
  const resolved = [], unresolved = [];
  for (const link of parsed.wikilinks) {
    const record = records.find(r => r.id === link.target || r.label.toLowerCase() === link.target.toLowerCase());
    if (record) {
      if (!resolved.some(r => r.id === record.id)) resolved.push(record);
    } else if (!unresolved.includes(link.target)) unresolved.push(link.target);
  }
  const yamlTags = (parsed.frontmatter.tags ?? "").replace(/[[\]"']/g, "").split(/[,\s]+/).filter(Boolean).map(t => t.replace(/^#/, "").toLowerCase());
  return { resolved, unresolved, tags: [...new Set([...parsed.tags, ...yamlTags])] };
}
