import { boardLayout, noteConnections } from "./board-model.mjs";
import { money, totals } from "./model.mjs";

export function canvasVisibleEdges(edges, visibleIds) {
  return edges.filter((e) => visibleIds.has(e.from) || visibleIds.has(e.to));
}

export function canvasNodeInfo(budget, node) {
  const entry = budget.expenses.find(
    (e) => node.kind === "expense" && e.id === node.recordId,
  );
  const category = budget.categories.find((c) => c.id === node.categoryId);
  const t = totals(budget);
  if (node.kind === "notes")
    return {
      value: String(noteConnections(budget).resolved.length),
      caption: "Linked records",
      full: `${noteConnections(budget).resolved.length} linked records`,
    };
  const amount =
    entry?.amount ??
    (node.id === "committed"
      ? t.committed
      : node.id === "paid"
        ? t.spent
        : node.id === "left"
          ? t.left
          : node.kind === "category"
            ? (category?.amount ?? 0)
            : budget.total);
  return {
    value: money(node.id === "left" && amount < 0 ? -amount : amount),
    full: money(amount),
    negative: amount < 0,
    caption: entry
      ? entry.status[0].toUpperCase() + entry.status.slice(1)
      : node.id === "budget"
        ? "Approved"
        : node.id === "left"
          ? amount < 0
            ? "Over budget"
            : "Available to commit"
          : node.kind === "category"
            ? "Budget"
            : node.id === "paid"
              ? "Paid"
              : "Still to pay",
  };
}

export function minimumCanvasSize(node) {
  return {
    width: Math.max(
      node.kind === "budget" ? 138 : node.kind === "category" ? 128 : 104,
      node.minimumWidth ?? 0,
    ),
    height: Math.max(
      ["budget"].includes(node.kind) ||
        ["standard", "wide", "circle"].includes(node.shape)
        ? 104
        : node.shape === "pill"
          ? 64
          : 88,
      node.minimumHeight ?? 0,
    ),
  };
}

export function canvasHitBounds(node, zoom) {
  const width = Math.max(node.width, 44 / zoom);
  const height = Math.max(node.height, 44 / zoom);
  return {
    left: (node.width - width) / 2,
    top: (node.height - height) / 2,
    width,
    height,
  };
}

export function canvasContentMetrics(node, value, zoom) {
  const roomy = ["standard", "wide"].includes(node.shape);
  const titleSize = Math.max(12, (roomy ? 13 : 12) * zoom) / zoom;
  const amountSize = Math.max(20, (roomy ? 24 : 20) * zoom) / zoom;
  const titleWidth = [...node.title].reduce(
    (w, char) => w + titleSize * (char.codePointAt(0) > 255 ? 1 : 0.55),
    0,
  );
  const lines = Math.max(1, Math.ceil(titleWidth / (node.width - 24)));
  const available = node.height - (node.shape === "pill" ? 16 : 24) - 2;
  const titleHeight = titleSize * 1.35 * (roomy ? lines : 1);
  const contentHeight = titleHeight + amountSize * 1.2 + 4;
  const marker =
    zoom < 0.6 ||
    (node.width - 24) * zoom < value.length * 12 ||
    contentHeight > available;
  return {
    marker,
    titleSize,
    amountSize,
    markerLines: Math.max(
      1,
      Math.min(2, lines, Math.floor(available / (titleSize * 1.35))),
    ),
    caption:
      !marker &&
      zoom >= 0.9 &&
      node.shape !== "pill" &&
      contentHeight + 4 + 12 * 1.3 <= available,
  };
}

export function canvasLayout(budget) {
  return (
    budget.board?.canvas ?? {
      positions: {},
      sizes: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    }
  );
}

export function recoverCanvasViewport(nodes, viewport, frame, previousFrame) {
  if (!frame.width || !frame.height || !nodes.length) return viewport;
  if (viewport.zoom < 0.5 || viewport.zoom > 1.8)
    viewport = {
      ...viewport,
      zoom: Math.max(0.5, Math.min(1.8, viewport.zoom)),
    };
  const wasFitted =
    previousFrame &&
    nodes.every(
      (node) =>
        node.x * viewport.zoom + viewport.x >= 15.9 &&
        node.y * viewport.zoom + viewport.y >= 15.9 &&
        (node.x + node.width) * viewport.zoom + viewport.x <=
          previousFrame.width - 15.9 &&
        (node.y + node.height) * viewport.zoom + viewport.y <=
          previousFrame.height - 15.9,
    );
  if (
    wasFitted &&
    (previousFrame.width !== frame.width ||
      previousFrame.height !== frame.height)
  )
    return fitCanvasViewport(nodes, frame).viewport;
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
    0.5,
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

export function fitCanvasViewport(nodes, frame) {
  if (!nodes.length || !frame.width || !frame.height)
    return { viewport: { x: 0, y: 0, zoom: 1 }, complete: false };
  const minX = Math.min(...nodes.map((n) => n.x)),
    minY = Math.min(...nodes.map((n) => n.y));
  const width = Math.max(...nodes.map((n) => n.x + n.width)) - minX,
    height = Math.max(...nodes.map((n) => n.y + n.height)) - minY;
  const zoom = Math.max(
    0.5,
    Math.min(1, (frame.width - 32) / width, (frame.height - 32) / height),
  );
  const complete =
    width * zoom <= frame.width - 31.9 && height * zoom <= frame.height - 31.9;
  if (!complete) {
    const root = nodes.find((n) => n.id === "budget") ?? nodes[0];
    const localZoom = Math.max(
      0.5,
      Math.min(
        1,
        (frame.width - 32) / root.width,
        (frame.height - 32) / root.height,
      ),
    );
    return {
      viewport: {
        zoom: localZoom,
        x: 16 - root.x * localZoom,
        y: 16 - root.y * localZoom,
      },
      complete: false,
    };
  }
  return {
    viewport: {
      zoom,
      x: (frame.width - width * zoom) / 2 - minX * zoom,
      y: (frame.height - height * zoom) / 2 - minY * zoom,
    },
    complete,
  };
}

export function settleCanvasNodes(nodes, anchorId) {
  const gap = nodes[0]?.clearance ?? 24;
  const placed = [],
    result = new Map();
  const ordered = [...nodes].sort(
    (a, b) => Number(b.id === anchorId) - Number(a.id === anchorId),
  );
  for (const source of ordered) {
    const node = { ...source };
    if (placed.some((other) => overlaps(node, other, gap))) {
      const candidates = placed
        .flatMap((other) => [
          { x: other.x + other.width + gap, y: node.y },
          { x: other.x - node.width - gap, y: node.y },
          { x: node.x, y: other.y + other.height + gap },
          { x: node.x, y: other.y - node.height - gap },
        ])
        .filter(
          (p) => p.x >= 0 && p.y >= 0 && p.x <= 1000000 && p.y <= 1000000,
        );
      candidates.sort(
        (a, b) =>
          Math.hypot(a.x - node.x, a.y - node.y) -
          Math.hypot(b.x - node.x, b.y - node.y),
      );
      const point = candidates.find(
        (p) =>
          !placed.some((other) =>
            overlaps({ ...node, ...p }, other, gap - 0.01),
          ),
      );
      if (point) Object.assign(node, point);
      else {
        node.y = Math.max(...placed.map((n) => n.y + n.height)) + gap;
        if (node.y > 1000000) {
          Object.assign(node, { x: 16, y: 16 });
          while (placed.some((other) => overlaps(node, other, gap)))
            node.y += Math.max(...placed.map((n) => n.height)) + gap;
        }
      }
    }
    placed.push(node);
    result.set(node.id, node);
  }
  return nodes.map((n) => result.get(n.id));
}

function widgetSize(node, size, width, index) {
  if (size === "large") return { width: 208, height: 136, shape: "wide" };
  if (size === "small") return { width: 104, height: 88, shape: "signal" };
  if (node.id === "committed")
    return {
      width: Math.max(164, Math.min(176, width - 124)),
      height: 64,
      shape: "pill",
    };
  if (node.id === "paid") return { width: 104, height: 104, shape: "circle" };
  if (node.id === "left") return { width: 104, height: 88, shape: "signal" };
  if (node.kind === "expense" || node.kind === "notes")
    return { width: 128, height: 88, shape: "compact" };
  if (node.kind === "category" && index % 2)
    return {
      width: 128,
      height: node.title.length > 12 ? 112 : 88,
      shape: "compact",
    };
  return {
    width: Math.max(138, Math.min(160, (width - 44) / 2)),
    height: 104,
    shape: "standard",
  };
}

function packOverview(nodes, width) {
  const gap = nodes[0]?.clearance ?? 24;
  const ordered = [...nodes].sort(
    (a, b) => Number(b.id === "paid") - Number(a.id === "paid"),
  );
  const budget = ordered.findIndex((n) => n.id === "budget");
  ordered.unshift(...ordered.splice(budget, 1));
  let y = 16,
    first = null;
  for (const node of ordered) {
    if (first && first.width + node.width + gap <= width - 32) {
      node.x = width - 16 - node.width;
      node.y = y + 16;
      y = Math.max(first.y + first.height, node.y + node.height) + gap;
      first = null;
    } else {
      if (first) y = first.y + first.height + gap;
      node.x = 16;
      node.y = y;
      first = node;
    }
  }
}

function overlaps(a, b, gap = 20) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

function packGroup(nodes, x, y) {
  if (!nodes.length) return;
  Object.assign(nodes[0], { x, y });
  const placed = [nodes[0]];
  nodes.slice(1).forEach((node, i) => {
    let angle = i * 2.399963,
      radius = 210 * Math.sqrt(i + 1);
    do {
      node.x = x + Math.cos(angle) * radius;
      node.y = y + Math.sin(angle) * radius;
      angle += 0.31;
      radius += 5;
    } while (placed.some((other) => overlaps(node, other)));
    placed.push(node);
  });
  const dx = Math.max(0, 24 - Math.min(...nodes.map((n) => n.x))),
    dy = Math.max(0, 24 - Math.min(...nodes.map((n) => n.y)));
  for (const node of nodes) {
    node.x += dx;
    node.y += dy;
  }
}

export function canvasGraph(
  budget,
  layout = canvasLayout(budget),
  _condensed,
  phone,
  scene = "all",
  frameWidth = phone ? 390 : 780,
  context,
) {
  const nodes = [],
    edges = [];
  function add(id, kind, title, recordId, group, categoryId, status) {
    const requested = layout.sizes[id] ?? "medium";
    const size =
      requested === "small" && ["budget", "category"].includes(kind)
        ? "medium"
        : requested;
    const node = {
      id,
      kind,
      title,
      recordId,
      group,
      categoryId,
      status,
      size,
      clearance: phone && scene === "overview" ? 12 : 24,
      x: 0,
      y: 0,
    };
    Object.assign(
      node,
      widgetSize(
        node,
        size,
        phone ? frameWidth : 390,
        nodes.filter((n) => n.kind === "category").length,
      ),
      layout.dimensions?.[id],
    );
    const info = canvasNodeInfo(budget, node),
      required =
        Math.ceil(
          (info.value.length *
            (["standard", "wide"].includes(node.shape) ? 14 : 12) +
            24) /
            4,
        ) * 4;
    if (kind !== "notes" && required > node.width) {
      const wide = ["standard", "wide"].includes(node.shape) || required > 176;
      Object.assign(node, {
        width: wide
          ? Math.max(208, Math.ceil((info.value.length * 14 + 24) / 4) * 4)
          : required,
        height: Math.max(wide ? 104 : 88, node.height),
        shape: wide ? "wide" : node.shape === "circle" ? "compact" : node.shape,
      });
    }
    const titleLines = Math.ceil(
      [...node.title].reduce(
        (width, char) => width + (char.codePointAt(0) > 255 ? 13 : 7),
        0,
      ) /
        (node.width - 24),
    );
    if (kind === "category" && titleLines > 1) {
      node.minimumHeight = Math.ceil((titleLines * 18 + 32 + 16 + 30) / 4) * 4;
      node.height = Math.max(node.height, node.minimumHeight);
    }
    node.minimumWidth =
      Math.ceil(
        (info.value.length *
          (["standard", "wide"].includes(node.shape) ? 14 : 12) +
          24) /
          4,
      ) * 4;
    nodes.push(node);
  }
  add("budget", "budget", "Budget", budget.id, "budget");
  add(
    "committed",
    "cluster",
    "Committed",
    "committed",
    "committed",
    undefined,
    "committed",
  );
  add("paid", "cluster", "Paid", "paid", "paid", undefined, "paid");
  add(
    "left",
    "balance",
    totals(budget).left < 0 ? "Over by" : "Room left",
    budget.id,
    "budget",
  );
  add("notes", "notes", "Notes", "notes", "notes");
  for (const category of budget.categories) {
    const id = `category:${category.id}`;
    add(id, "category", category.name, category.id, "budget", category.id);
    edges.push({
      from: "budget",
      to: id,
      type: "allocation",
      label: "Budget category",
    });
  }
  for (const entry of budget.expenses) {
    const id = `entry:${entry.id}`;
    add(
      id,
      "expense",
      entry.description,
      entry.id,
      entry.status === "planned" ? "budget" : entry.status,
      entry.categoryId,
      entry.status,
    );
    edges.push({
      from: `category:${entry.categoryId}`,
      to: id,
      type: "entry",
      label: entry.status,
    });
    if (entry.status !== "planned")
      edges.push({
        from: entry.status,
        to: id,
        type: "membership",
        label: `Included in ${entry.status === "paid" ? "Paid" : "Committed"}`,
      });
  }
  for (const record of noteConnections(budget).resolved) {
    const target = nodes.find(
      (n) =>
        n.recordId === record.id && ["category", "expense"].includes(n.kind),
    );
    if (target)
      edges.push({
        from: "notes",
        to: target.id,
        type: "note",
        label: "note link",
      });
  }
  let shown =
    scene === "all"
      ? nodes
      : scene === "overview"
        ? [
            ...nodes.slice(0, 4),
            ...nodes.filter((n) => n.kind === "category").slice(0, 2),
            ...nodes.filter((n) => n.kind === "expense").slice(0, 2),
          ]
        : scene === "notes"
          ? nodes.filter(
              (n) =>
                n.id === "notes" ||
                edges.some((e) => e.from === "notes" && e.to === n.id),
            )
          : nodes.filter((n) => n.group === scene);
  if (!shown.length) shown = nodes.slice(0, 4);
  if (scene === "overview") {
    packOverview(shown, phone ? frameWidth : 480);
    const owner = nodes.find(
      (n) => n.id === context && ["category", "cluster"].includes(n.kind),
    );
    if (owner) {
      const extra = nodes.filter(
        (n) =>
          n.kind === "expense" &&
          (owner.kind === "category"
            ? n.categoryId === owner.recordId
            : n.status === owner.status) &&
          !shown.includes(n),
      );
      for (const [i, n] of extra.entries())
        Object.assign(n, {
          x: Math.max(16, owner.x + (i % 2 ? owner.width + 24 : -n.width - 24)),
          y: owner.y + owner.height + 24 + Math.floor(i / 2) * 128,
        });
      shown.push(...extra);
    }
  } else if (scene === "all") {
    const planned = nodes.filter((n) => n.group === "budget");
    packGroup(planned, 500, 380);
    const bottom = Math.max(...planned.map((n) => n.y + n.height)) + 180;
    const committed = nodes.filter((n) => n.group === "committed");
    packGroup(committed, 360, bottom + 260);
    const left = Math.max(...committed.map((n) => n.x + n.width)) + 300;
    packGroup(
      nodes.filter((n) => n.group === "paid"),
      left,
      bottom + 260,
    );
    const notes = nodes.find((n) => n.id === "notes");
    notes.x = Math.max(...planned.map((n) => n.x + n.width)) + 180;
    notes.y = 100;
  } else packGroup(shown, 380, 380);
  const positions =
    scene === "all"
      ? layout.positions
      : (layout.scenes?.[scene]?.positions ?? {});
  for (const node of shown) Object.assign(node, positions[node.id] ?? {});
  shown = settleCanvasNodes(shown);
  const ids = new Set(shown.map((n) => n.id));
  return {
    nodes: shown,
    edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
    width: Math.max(...shown.map((n) => n.x + n.width)) + 40,
    height: Math.max(...shown.map((n) => n.y + n.height)) + 40,
  };
}

function sceneLayout(layout, scene) {
  return scene === "all"
    ? layout
    : (layout.scenes?.[scene] ?? {
        positions: {},
        viewport: { x: 0, y: 0, zoom: 1 },
      });
}

function withScene(layout, scene, patch) {
  return scene === "all"
    ? { ...layout, ...patch }
    : {
        ...layout,
        scenes: {
          ...layout.scenes,
          [scene]: { ...sceneLayout(layout, scene), ...patch },
        },
      };
}

export function changeCanvas(budget, action) {
  const layout = canvasLayout(budget),
    scene = action.scene ?? "all";
  if (
    !["all", "overview", "budget", "committed", "paid", "notes"].includes(scene)
  )
    return budget;
  let canvas;
  if (action.type === "viewport") {
    if (
      ![action.x, action.y, action.zoom].every(Number.isFinite) ||
      Math.abs(action.x) > 1000000 ||
      Math.abs(action.y) > 1000000 ||
      action.zoom < 0.5 ||
      action.zoom > 1.8
    )
      return budget;
    canvas = withScene(layout, scene, {
      viewport: { x: action.x, y: action.y, zoom: action.zoom },
    });
  } else if (action.type === "auto") {
    canvas = withScene(layout, scene, { positions: {} });
  } else {
    const node = canvasGraph(
      budget,
      layout,
      false,
      action.phone,
      "all",
      action.frameWidth,
    ).nodes.find((n) => n.id === action.id);
    if (!node) return budget;
    if (action.type === "size") {
      if (
        !["small", "medium", "large"].includes(action.size) ||
        (action.size === "small" && ["budget", "category"].includes(node.kind))
      )
        return budget;
      const dimensions = { ...layout.dimensions };
      delete dimensions[node.id];
      canvas = {
        ...layout,
        dimensions,
        sizes: { ...layout.sizes, [node.id]: action.size },
      };
    } else if (action.type === "resize") {
      const min = minimumCanvasSize(node);
      if (
        ![action.width, action.height].every(Number.isFinite) ||
        action.width < min.width ||
        action.height < min.height ||
        action.width > 560 ||
        action.height > 560
      )
        return budget;
      canvas = {
        ...layout,
        dimensions: {
          ...layout.dimensions,
          [node.id]: { width: action.width, height: action.height },
        },
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
      canvas = withScene(layout, scene, {
        positions: {
          ...sceneLayout(layout, scene).positions,
          [node.id]: { x: action.x, y: action.y },
        },
      });
    } else return budget;
    const visible = canvasGraph(
      budget,
      canvas,
      false,
      action.phone,
      scene,
      action.frameWidth,
      action.context,
    ).nodes;
    if (action.type === "position")
      Object.assign(visible.find((n) => n.id === node.id) ?? {}, {
        x: action.x,
        y: action.y,
      });
    const settled = settleCanvasNodes(visible, node.id);
    canvas = withScene(canvas, scene, {
      positions: Object.fromEntries(
        settled.map((n) => [n.id, { x: n.x, y: n.y }]),
      ),
    });
  }
  return { ...budget, board: { ...boardLayout(budget), canvas } };
}
