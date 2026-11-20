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
  changeCanvas,
  recoverCanvasViewport,
} from "../app/book/canvas-model.mjs";

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

test("canvas projects governed category, entry and Markdown relationships", () => {
  const budget = exampleBudget();
  budget.notes = `See [[${budget.expenses[0].id}|Venue]] #studio`;
  const graph = canvasGraph(budget);
  assert.equal(
    graph.nodes.length,
    2 + budget.categories.length + budget.expenses.length,
  );
  assert.equal(
    graph.edges.filter((e) => e.type === "allocation").length,
    budget.categories.length,
  );
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
  assert.equal(canvasGraph(arranged).nodes[0].x, 40);
  assert.deepEqual(arranged.board.order, b.board.order);
});
