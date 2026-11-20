import test from "node:test";
import assert from "node:assert/strict";
import {
  exampleBudget,
  parseBook,
  serializeBook,
  totals,
} from "../app/book/model.mjs";
import {
  canvasGraph,
  canvasLayout,
  changeCanvas,
  fitCanvasViewport,
  recoverCanvasViewport,
  canvasNodeInfo,
  canvasHitBounds,
} from "../app/book/canvas-model.mjs";

test("semantic hit bounds keep every widget tappable without growing its visible role shape", () => {
  const graph = canvasGraph(
    exampleBudget(),
    undefined,
    false,
    true,
    "overview",
    390,
  );
  const before = structuredClone(graph.nodes);
  const pill = graph.nodes.find((node) => node.id === "committed");
  assert.equal(pill.height, 64);
  assert.deepEqual(canvasHitBounds(pill, 0.5), {
    left: 0,
    top: -12,
    width: 176,
    height: 88,
  });
  for (const zoom of [0.5, 0.75, 1, 1.8]) {
    const targets = graph.nodes.map((node) => {
      const bounds = canvasHitBounds(node, zoom);
      assert.ok(bounds.width * zoom >= 44);
      assert.ok(bounds.height * zoom >= 44);
      assert.equal(bounds.left + bounds.width / 2, node.width / 2);
      assert.equal(bounds.top + bounds.height / 2, node.height / 2);
      return { ...bounds, x: node.x + bounds.left, y: node.y + bounds.top };
    });
    targets.forEach((a, i) =>
      targets.slice(i + 1).forEach((b) => {
        assert.equal(
          a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y,
          false,
        );
      }),
    );
  }
  assert.deepEqual(graph.nodes, before);
});

test("Fennuma keeps money exact, uses role shapes, and exposes four financial summaries with local records", () => {
  const b = exampleBudget();
  const graph = canvasGraph(b, undefined, false, true, "overview", 390);
  assert.equal(graph.nodes.length, 8);
  assert.deepEqual(
    graph.nodes.slice(0, 4).map((n) => n.id),
    ["budget", "committed", "paid", "left"],
  );
  const budget = graph.nodes[0],
    committed = graph.nodes[1];
  assert.deepEqual(
    [budget.width, budget.height, budget.shape],
    [160, 104, "standard"],
  );
  assert.deepEqual(
    [committed.width, committed.height, committed.shape],
    [176, 64, "pill"],
  );
  assert.equal(canvasNodeInfo(b, graph.nodes[2]).value, "$1,726.50");
  assert.equal(canvasNodeInfo(b, graph.nodes[3]).value, "$3,208.50");
  assert.ok(
    !graph.edges.some(
      (e) => e.from === "budget" && e.to.startsWith("category:"),
    ),
  );
  const distant = { ...graph.nodes[0], id: "distant", x: 8000, y: 8000 };
  const fitted = fitCanvasViewport([...graph.nodes, distant], {
    width: 358,
    height: 520,
  });
  assert.equal(fitted.complete, false);
  assert.ok(fitted.viewport.zoom >= 0.5);
});

test("selecting a category discloses its records without moving the resting overview", () => {
  const b = exampleBudget(),
    before = structuredClone(b);
  const rest = canvasGraph(b, undefined, false, true, "overview", 390);
  const category = rest.nodes.find((n) => n.kind === "category");
  const expanded = canvasGraph(
    b,
    undefined,
    false,
    true,
    "overview",
    390,
    category.id,
  );
  for (const n of rest.nodes) {
    const same = expanded.nodes.find((c) => c.id === n.id);
    assert.deepEqual([same.x, same.y], [n.x, n.y]);
  }
  for (const entry of b.expenses.filter(
    (e) => e.categoryId === category.recordId,
  ))
    assert.ok(
      expanded.nodes.some(
        (n) => n.kind === "expense" && n.recordId === entry.id,
      ),
    );
  assert.deepEqual(b, before);
});

test("large amounts and long names enlarge their representation, never abbreviate money", () => {
  const b = exampleBudget();
  b.total = 1234567890.12;
  b.categories[0].name =
    "A very long category name that needs more than one line";
  const graph = canvasGraph(b);
  const root = graph.nodes.find((n) => n.id === "budget");
  assert.equal(canvasNodeInfo(b, root).value, "$1,234,567,890.12");
  assert.equal(root.shape, "wide");
  assert.ok(root.width >= 208);
  const named = graph.nodes.find((n) => n.recordId === b.categories[0].id);
  assert.ok(named.height > 104);
  b.total = 100;
  const deficit = canvasGraph(b).nodes.find((n) => n.id === "left");
  assert.equal(deficit.title, "Over by");
  assert.ok(canvasNodeInfo(b, deficit).negative);
  assert.ok(!canvasNodeInfo(b, deficit).value.includes("-"));
});

test("an offscreen saved viewport recovers a readable Budget without moving records", () => {
  const budget = exampleBudget(),
    before = structuredClone(budget);
  const nodes = canvasGraph(budget).nodes;
  const lost = { x: 6, y: -1606, zoom: 1 };
  const recovered = recoverCanvasViewport(nodes, lost, {
    width: 518,
    height: 600,
  });
  const root = nodes[0];
  assert.ok(root.x * recovered.zoom + recovered.x >= 16);
  assert.ok((root.x + root.width) * recovered.zoom + recovered.x <= 502);
  assert.ok(root.y * recovered.zoom + recovered.y >= 16);
  assert.ok((root.y + root.height) * recovered.zoom + recovered.y <= 584);
  assert.equal(
    recoverCanvasViewport(nodes, recovered, { width: 518, height: 600 }),
    recovered,
  );
  const narrow = recoverCanvasViewport(nodes, lost, {
    width: 280,
    height: 560,
  });
  assert.ok(root.width * narrow.zoom < 280);
  assert.deepEqual(budget, before);
  assert.equal(
    recoverCanvasViewport(nodes, lost, { width: 0, height: 0 }),
    lost,
  );
});

test("free movement repels widgets without a grid, while each cluster keeps its own layout", () => {
  const b = exampleBudget(),
    before = structuredClone(b);
  const plannedBefore = canvasGraph(b, undefined, false, true, "budget").nodes;
  const scene = "overview";
  let next = changeCanvas(b, {
    type: "position",
    scene,
    id: "budget",
    x: 198.25,
    y: 64.75,
  });
  const nodes = canvasGraph(next, undefined, false, true, scene).nodes;
  assert.equal(nodes[0].x, 198.25);
  assert.equal(nodes[0].y, 64.75);
  for (const [i, a] of nodes.entries())
    for (const c of nodes.slice(i + 1))
      assert.ok(
        a.x + a.width <= c.x ||
          c.x + c.width <= a.x ||
          a.y + a.height <= c.y ||
          c.y + c.height <= a.y,
      );
  assert.deepEqual(
    canvasGraph(next, undefined, false, true, "budget").nodes,
    plannedBefore,
  );
  next = changeCanvas(next, {
    type: "resize",
    scene,
    id: "budget",
    width: 203,
    height: 177,
  });
  assert.equal(
    canvasGraph(next, undefined, false, true, scene).nodes[0].width,
    203,
  );
  assert.equal(
    canvasGraph(next, undefined, false, true, scene).nodes[0].height,
    177,
  );
  assert.equal(
    changeCanvas(next, {
      type: "resize",
      id: "budget",
      width: 100,
      height: 100,
    }),
    next,
  );
  assert.deepEqual(parseBook(serializeBook(next)), next);
  assert.deepEqual(totals(next), totals(before));
  const balanced = changeCanvas(next, { type: "auto", scene });
  assert.deepEqual(canvasLayout(balanced).scenes.overview.positions, {});
  delete next.board;
  assert.deepEqual(next, before);
});

test("a fitted phone overview stays fitted on resize without resetting an intentional close-up", () => {
  const nodes = canvasGraph(
    exampleBudget(),
    undefined,
    false,
    true,
    "overview",
  ).nodes;
  const wide = { width: 342, height: 480 },
    narrow = { width: 272, height: 420 };
  const fitted = fitCanvasViewport(nodes, wide).viewport;
  const resized = recoverCanvasViewport(nodes, fitted, narrow, wide);
  for (const n of nodes) {
    assert.ok(n.x * resized.zoom + resized.x >= 15.9);
    assert.ok((n.x + n.width) * resized.zoom + resized.x <= 256.1);
  }
  const root = nodes[0];
  const closeup = { zoom: 1.5, x: 16 - root.x * 1.5, y: 16 - root.y * 1.5 };
  assert.equal(recoverCanvasViewport(nodes, closeup, narrow, wide), closeup);
});

test("Fit reports whether every widget is really inside the frame, including distant layouts", () => {
  const nodes = canvasGraph(
    exampleBudget(),
    undefined,
    false,
    true,
    "overview",
  ).nodes;
  const frame = { width: 272, height: 420 };
  const fitted = fitCanvasViewport(nodes, frame);
  assert.equal(fitted.complete, true);
  for (const n of nodes) {
    assert.ok(n.x * fitted.viewport.zoom + fitted.viewport.x >= 15.9);
    assert.ok(
      (n.x + n.width) * fitted.viewport.zoom + fitted.viewport.x <= 256.1,
    );
    assert.ok(n.y * fitted.viewport.zoom + fitted.viewport.y >= 15.9);
    assert.ok(
      (n.y + n.height) * fitted.viewport.zoom + fitted.viewport.y <= 404.1,
    );
  }
  const distant = [...nodes, { ...nodes[0], id: "far", x: 1000000 }];
  assert.equal(fitCanvasViewport(distant, frame).complete, false);
});

test("canvas projects governed category, entry and Markdown relationships", () => {
  const budget = exampleBudget();
  budget.notes = `See [[${budget.expenses[0].id}|Venue]] #studio`;
  const graph = canvasGraph(budget);
  assert.equal(
    graph.nodes.length,
    5 + budget.categories.length + budget.expenses.length,
  );
  assert.equal(graph.edges.filter((e) => e.type === "allocation").length, 0);
  assert.equal(
    graph.edges.filter((e) => e.type === "entry").length,
    budget.expenses.length,
  );
  assert.equal(graph.edges.filter((e) => e.type === "note").length, 1);
  for (const edge of graph.edges)
    assert.ok(
      graph.nodes.some((n) => n.id === edge.from) &&
        graph.nodes.some((n) => n.id === edge.to),
    );
});

test("minimum sizes and different densities persist without changing money or records", () => {
  const budget = exampleBudget(),
    original = structuredClone(budget);
  const before = canvasGraph(budget),
    category = before.nodes.find((n) => n.kind === "category");
  assert.equal(
    changeCanvas(budget, { type: "size", id: "budget", size: "small" }),
    budget,
  );
  assert.equal(
    changeCanvas(budget, { type: "size", id: category.id, size: "small" }),
    budget,
  );
  let next = changeCanvas(budget, {
    type: "size",
    id: category.id,
    size: "large",
  });
  next = changeCanvas(next, {
    type: "position",
    id: category.id,
    x: 880,
    y: 144,
  });
  next = changeCanvas(next, { type: "viewport", x: -500, y: 200, zoom: 0.8 });
  assert.ok(
    canvasGraph(next).nodes.find((n) => n.id === category.id).height >
      category.height,
  );
  assert.equal(
    canvasGraph(next).nodes.find((n) => n.id === category.id).x,
    880,
  );
  assert.deepEqual(parseBook(serializeBook(next)), next);
  assert.deepEqual(totals(next), totals(original));
  delete next.board;
  assert.deepEqual(next, original);
});

test("invalid targets and nonfinite coordinates cannot corrupt a saved layout", () => {
  const b = exampleBudget();
  assert.equal(
    changeCanvas(b, { type: "position", id: "missing", x: 2, y: 5 }),
    b,
  );
  assert.equal(
    changeCanvas(b, { type: "position", id: "budget", x: NaN, y: 5 }),
    b,
  );
  assert.equal(changeCanvas(b, { type: "viewport", x: 0, y: 0, zoom: 0 }), b);
  const saved = changeCanvas(b, {
    type: "position",
    id: "budget",
    x: 32,
    y: 32,
  });
  assert.throws(() =>
    parseBook(serializeBook(saved).replace('"x":32', '"x":"bad"')),
  );
});

test("auto-arrange clears positions but retains density and the older board metadata", () => {
  let b = changeCanvas(exampleBudget(), {
    type: "position",
    id: "budget",
    x: 900,
    y: 100,
  });
  b = changeCanvas(b, { type: "size", id: "budget", size: "large" });
  const arranged = changeCanvas(b, { type: "auto" });
  assert.equal(canvasGraph(arranged).nodes[0].size, "large");
  assert.deepEqual(arranged.board.canvas.positions, {});
  assert.deepEqual(arranged.board.order, b.board.order);
});

test("phone overview exposes scoped widgets and lifecycle clusters retain exact governed entries", () => {
  const b = exampleBudget();
  const overview = canvasGraph(b, undefined, false, true, "overview");
  assert.deepEqual(
    overview.nodes.slice(0, 4).map((n) => n.id),
    ["budget", "committed", "paid", "left"],
  );
  assert.ok(overview.nodes.every((n) => n.width <= 208 && n.height <= 176));
  for (const status of ["committed", "paid"]) {
    const cluster = canvasGraph(b, undefined, false, true, status);
    assert.equal(cluster.nodes[0].id, status);
    assert.deepEqual(
      cluster.nodes
        .filter((n) => n.kind === "expense")
        .map((n) => n.recordId)
        .sort(),
      b.expenses
        .filter((e) => e.status === status)
        .map((e) => e.id)
        .sort(),
    );
    assert.ok(
      cluster.edges.every(
        (e) =>
          cluster.nodes.some((n) => n.id === e.from) &&
          cluster.nodes.some((n) => n.id === e.to),
      ),
    );
  }
});

test("larger books and old overlapping layouts keep every widget separate and selectable", () => {
  const b = exampleBudget();
  b.categories = Array.from({ length: 24 }, (_, i) => ({
    ...b.categories[0],
    id: `c${i}`,
    name: `Category ${i}`,
  }));
  b.expenses = Array.from({ length: 42 }, (_, i) => ({
    ...b.expenses[0],
    id: `e${i}`,
    categoryId: `c${i % 24}`,
    status: ["planned", "committed", "paid"][i % 3],
  }));
  b.board = {
    canvas: {
      positions: Object.fromEntries(
        ["budget", "committed", "paid", "notes"].map((id) => [
          id,
          { x: 120, y: 120 },
        ]),
      ),
      sizes: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
  for (const scene of ["all", "overview", "budget", "committed", "paid"]) {
    const nodes = canvasGraph(b, undefined, false, true, scene).nodes;
    for (const [i, a] of nodes.entries())
      for (const c of nodes.slice(i + 1))
        assert.ok(
          a.x + a.width <= c.x ||
            c.x + c.width <= a.x ||
            a.y + a.height <= c.y ||
            c.y + c.height <= a.y,
          `${scene}: ${a.id} overlaps ${c.id}`,
        );
  }
});

test("custom dimensions and cluster cameras reject malformed backups", () => {
  let b = changeCanvas(exampleBudget(), {
    type: "resize",
    scene: "overview",
    id: "budget",
    width: 191,
    height: 185,
  });
  b = changeCanvas(b, {
    type: "viewport",
    scene: "overview",
    x: -32,
    y: 18,
    zoom: 0.6,
  });
  assert.deepEqual(parseBook(serializeBook(b)), b);
  const markdown = serializeBook(b);
  assert.throws(() => parseBook(markdown.replace('"width":191', '"width":1')));
  assert.throws(() =>
    parseBook(markdown.replace('"zoom":0.6', '"zoom":"bad"')),
  );
});
