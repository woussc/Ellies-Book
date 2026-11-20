import { boardLayout, noteConnections } from "./board-model.mjs";

export function canvasLayout(budget) {
  return (
    budget.board?.canvas ?? {
      positions: {},
      sizes: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    }
  );
}

export function recoverCanvasViewport(nodes, viewport, frame) {
  if (!frame.width || !frame.height || !nodes.length) return viewport;
  const hasReadableNode = nodes.some(
    (node) =>
      node.x * viewport.zoom + viewport.x >= 16 &&
      node.y * viewport.zoom + viewport.y >= 16 &&
      (node.x + node.width) * viewport.zoom + viewport.x <= frame.width - 16 &&
      (node.y + node.height) * viewport.zoom + viewport.y <= frame.height - 16,
  );
  if (hasReadableNode) return viewport;
  const root = nodes.find((node) => node.kind === "budget") ?? nodes[0];
  const zoom = Math.max(
    0.2,
    Math.min(
      1,
      (frame.width - 40) / root.width,
      (frame.height - 40) / root.height,
    ),
  );
  return {
    zoom,
    x: (frame.width - root.width * zoom) / 2 - root.x * zoom,
    y: 20 - root.y * zoom,
  };
}

export function canvasGraph(
  budget,
  layout = canvasLayout(budget),
  condensed = false,
  phone = false,
) {
  const nodes = [],
    edges = [];
  function add(id, kind, title, recordId, x, y, categoryId, status) {
    const requested = layout.sizes[id] ?? "medium";
    const size =
      requested === "small" && ["budget", "category"].includes(kind)
        ? "medium"
        : requested;
    const width =
      kind === "budget"
        ? size === "large"
          ? 336
          : 300
        : size === "large"
          ? 316
          : size === "small"
            ? 220
            : 280;
    const height = condensed
      ? 146
      : size === "small"
        ? 148
        : size === "large"
          ? 372
          : kind === "budget"
            ? 278
            : kind === "category"
              ? 254
              : 240;
    const point = layout.positions[id] ?? { x, y };
    nodes.push({
      id,
      kind,
      title,
      recordId,
      categoryId,
      status,
      size,
      ...point,
      width,
      height,
    });
  }
  add(
    "budget",
    "budget",
    "Budget",
    budget.id,
    phone ? 20 : 40,
    phone ? 36 : 64,
  );
  let y = 40;
  for (const category of budget.categories) {
    const id = `category:${category.id}`;
    add(
      id,
      "category",
      category.name,
      category.id,
      phone ? 34 : 440,
      phone ? y + 360 : y,
      category.id,
    );
    edges.push({
      from: "budget",
      to: id,
      type: "allocation",
      label: "allocates",
    });
    const entries = budget.expenses.filter(
      (expense) => expense.categoryId === category.id,
    );
    entries.forEach((entry, i) => {
      const entryId = `entry:${entry.id}`;
      add(
        entryId,
        "expense",
        entry.description,
        entry.id,
        phone ? 440 : 840,
        y + i * 414 + (phone ? 360 : 0),
        category.id,
        entry.status,
      );
      edges.push({ from: id, to: entryId, type: "entry", label: entry.status });
    });
    y += Math.max(414, entries.length * 414);
  }
  // Notes are always reachable so a first Markdown relationship has a home.
  add(
    "notes",
    "notes",
    "Notes & connections",
    "notes",
    phone ? 440 : 40,
    phone ? 36 : 530,
  );
  for (const record of noteConnections(budget).resolved) {
    const target = nodes.find(
      (node) =>
        node.recordId === record.id &&
        ["category", "expense"].includes(node.kind),
    );
    if (target)
      edges.push({
        from: "notes",
        to: target.id,
        type: "note",
        label: "note link",
      });
  }
  return {
    nodes,
    edges,
    width: Math.max(...nodes.map((node) => node.x + node.width)) + 80,
    height: Math.max(...nodes.map((node) => node.y + node.height)) + 80,
  };
}

export function changeCanvas(budget, action) {
  const layout = canvasLayout(budget);
  let canvas;
  if (action.type === "viewport") {
    if (
      ![action.x, action.y, action.zoom].every(Number.isFinite) ||
      Math.abs(action.x) > 1000000 ||
      Math.abs(action.y) > 1000000 ||
      action.zoom < 0.2 ||
      action.zoom > 1.5
    )
      return budget;
    canvas = {
      ...layout,
      viewport: { x: action.x, y: action.y, zoom: action.zoom },
    };
  } else if (action.type === "auto") {
    canvas = { ...layout, positions: {} };
  } else {
    const node = canvasGraph(budget, layout).nodes.find(
      (node) => node.id === action.id,
    );
    if (!node) return budget;
    if (action.type === "size") {
      if (
        !["small", "medium", "large"].includes(action.size) ||
        (action.size === "small" && ["budget", "category"].includes(node.kind))
      )
        return budget;
      canvas = {
        ...layout,
        sizes: { ...layout.sizes, [node.id]: action.size },
      };
    } else if (action.type === "position") {
      if (
        ![action.x, action.y].every(Number.isFinite) ||
        action.x < 0 ||
        action.y < 0 ||
        action.x > 1000000 ||
        action.y > 1000000
      )
        return budget;
      canvas = {
        ...layout,
        positions: {
          ...layout.positions,
          [node.id]: { x: action.x, y: action.y },
        },
      };
    } else return budget;
  }
  return { ...budget, board: { ...boardLayout(budget), canvas } };
}
