"use client";

import {
  useImperativeHandle,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type SetStateAction,
} from "react";
import { boardLayout } from "./board-model.mjs";
import {
  canvasGraph,
  canvasVisibleEdges,
  canvasLayout,
  changeCanvas,
  canvasNodeInfo,
  minimumCanvasSize,
  canvasHitBounds,
  canvasContentMetrics,
  fitCanvasViewport,
  recoverCanvasViewport,
} from "./canvas-model.mjs";
import NodeDetail from "./node-detail";
import useCanvasMotion from "./use-canvas-motion";
import useWidgetPositions from "./use-widget-positions";
import type { Budget, CanvasLayout, Expense, NodeSize } from "./model.mjs";
import type { CanvasAction, CanvasNode, CanvasScene } from "./canvas-model.mjs";

const subscribeWidth = (callback: () => void) => {
  const media = matchMedia("(max-width: 640px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const isPhone = () => matchMedia("(max-width: 640px)").matches;
type Viewport = CanvasLayout["viewport"];
const sceneNames: Record<CanvasScene, string> = {
  overview: "Overview",
  budget: "Budget",
  committed: "Committed",
  paid: "Paid",
  notes: "Notes & links",
  all: "All widgets",
};

function Arrow({ angle = 0 }: { angle?: number }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      style={{ transform: `rotate(${angle}deg)` }}
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
function MoveIcon({ resize = false }: { resize?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path
        d={
          resize
            ? "M7 17 17 7M8 7h9v9M5 12v7h7"
            : "M4 12h16M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4M8 8l-4 4 4 4M16 8l4 4-4 4"
        }
      />
    </svg>
  );
}

function widgetInfo(node: CanvasNode, budget: Budget) {
  return canvasNodeInfo(budget, node);
}

function WidgetContent({
  node,
  budget,
  zoom = 1,
}: {
  node: CanvasNode;
  budget: Budget;
  zoom?: number;
}) {
  const info = widgetInfo(node, budget);
  const { marker, titleSize, amountSize, markerLines, caption } =
    canvasContentMetrics(node, info.value, zoom);
  return (
    <>
      <span
        className={`widget-title${marker ? " marker-title" : ""}`}
        style={{
          fontSize: titleSize,
          WebkitLineClamp: marker ? markerLines : undefined,
        }}
      >
        {node.title}
      </span>
      {!marker && (
        <strong
          className={`widget-value${info.negative ? " negative" : ""}`}
          style={{ fontSize: amountSize }}
          title={info.full}
        >
          {info.value}
        </strong>
      )}
      {caption && <span className="widget-caption">{info.caption}</span>}
    </>
  );
}

function edgeBoundary(node: CanvasNode, other: CanvasNode) {
  const x = node.x + node.width / 2,
    y = node.y + node.height / 2;
  const dx = other.x + other.width / 2 - x,
    dy = other.y + other.height / 2 - y;
  const factor =
    node.shape === "circle"
      ? Math.hypot(dx / (node.width / 2), dy / (node.height / 2))
      : Math.max(
          Math.abs(dx) / (node.width / 2),
          Math.abs(dy) / (node.height / 2),
        );
  return { x: x + dx / (factor || 1), y: y + dy / (factor || 1) };
}

function SizeDialog({
  node,
  budget,
  custom,
  onCancel,
  onApply,
}: {
  node: CanvasNode;
  budget: Budget;
  custom: boolean;
  onCancel: () => void;
  onApply: (action: CanvasAction) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState<NodeSize | null>(custom ? null : node.size);
  const [width, setWidth] = useState(Math.round(node.width)),
    [height, setHeight] = useState(Math.round(node.height));
  const min = minimumCanvasSize(node);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function preset(option: NodeSize) {
    setSize(option);
    const projected = canvasGraph(
      changeCanvas(budget, { type: "size", id: node.id, size: option }),
    ).nodes.find((n) => n.id === node.id)!;
    setWidth(projected.width);
    setHeight(projected.height);
  }
  return (
    <dialog
      ref={dialog}
      className="size-dialog"
      aria-labelledby="size-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <header>
        <h2 id="size-title">{node.title} size</h2>
        <button className="outline-button" onClick={onCancel}>
          Close
        </button>
      </header>
      <p>
        Use a preset, adjust either side, or drag the resize corner in Arrange.
      </p>
      <div className="size-options">
        {(["small", "medium", "large"] as NodeSize[]).map((option) => (
          <button
            key={option}
            className="size-option"
            aria-pressed={size === option}
            disabled={
              ["budget", "category"].includes(node.kind) && option === "small"
            }
            onClick={() => preset(option)}
          >
            <strong>{option[0].toUpperCase() + option.slice(1)}</strong>
          </button>
        ))}
      </div>
      {["budget", "category"].includes(node.kind) && (
        <p className="hint">
          Small is unavailable. Budget and Category start at Medium so essential
          money stays visible.
        </p>
      )}
      <div className="widget-size-sliders">
        <label>
          Width <output>{width}px</output>
          <input
            aria-label="Widget width"
            type="range"
            min={min.width}
            max="560"
            step="4"
            value={width}
            onChange={(e) => {
              setWidth(Number(e.target.value));
              setSize(null);
            }}
          />
        </label>
        <label>
          Height <output>{height}px</output>
          <input
            aria-label="Widget height"
            type="range"
            min={min.height}
            max="560"
            step="4"
            value={height}
            onChange={(e) => {
              setHeight(Number(e.target.value));
              setSize(null);
            }}
          />
        </label>
      </div>
      <div className="widget-size-preview">
        <div style={{ width, height }}>
          <WidgetContent node={node} budget={budget} />
        </div>
      </div>
      <div className="size-actions">
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={() =>
            onApply(
              size
                ? { type: "size", id: node.id, size }
                : { type: "resize", id: node.id, width, height },
            )
          }
        >
          Apply size
        </button>
      </div>
    </dialog>
  );
}

export type NodeBoardHandle = { cancelArrange: () => void };

export default function NodeBoard({
  controller,
  budget,
  setBudget,
  onPlan,
  onSpend,
  onExpense,
  onReport,
  onBackup,
  storageError,
  onEditingChange,
  scope,
}: {
  controller: import("react").Ref<NodeBoardHandle>;
  budget: Budget;
  setBudget: (next: SetStateAction<Budget>) => boolean;
  onPlan: () => void;
  onSpend: (categoryId?: string) => void;
  onExpense: (expense: Expense) => void;
  onReport: () => void;
  onBackup: () => void;
  storageError: boolean;
  onEditingChange: (editing: boolean) => void;
  scope?: string;
}) {
  const phone = useSyncExternalStore(subscribeWidth, isPhone, () => false);
  const savedLayout = useMemo(() => canvasLayout(budget), [budget]);
  const [scene, setScene] = useState<CanvasScene>("overview");
  const [arrange, setArrange] = useState<CanvasLayout | null>(null),
    draftRef = useRef<CanvasLayout | null>(null);
  const [view, setView] = useState<Viewport>({ x: 0, y: 0, zoom: 1 }),
    viewRef = useRef(view);
  const [animateCamera, setAnimateCamera] = useState(false);
  const [mode, setMode] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(null),
    [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tools, setTools] = useState(false),
    [finding, setFinding] = useState(false),
    [query, setQuery] = useState("");
  const [links, setLinks] = useState<"selection" | "all" | "hidden">(
    "selection",
  );
  const [sizeId, setSizeId] = useState<string | null>(null),
    [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const windowRef = useRef<HTMLDivElement>(null),
    findRef = useRef<HTMLInputElement>(null);
  const arrangeOrigin = useRef(view),
    [frame, setFrame] = useState({ width: 0, height: 0 });
  const layout = arrange ?? savedLayout;
  const detailOrigin = useRef<{
    viewport: Viewport;
    selected: string | null;
  } | null>(null);
  const graph = useMemo(
    () =>
      canvasGraph(
        budget,
        layout,
        false,
        phone,
        scene,
        frame.width || 390,
        expanded,
      ),
    [budget, layout, phone, scene, frame.width, expanded],
  );
  const allGraph = useMemo(() => canvasGraph(budget, layout), [budget, layout]);
  const latest = useRef({ graph, layout });
  useEffect(() => {
    latest.current = { graph, layout };
  });
  const editing = arrange !== null;
  useEffect(() => {
    onEditingChange(editing);
    return () => onEditingChange(false);
  }, [editing, onEditingChange]);
  useEffect(() => {
    if (finding) findRef.current?.focus();
  }, [finding]);

  function setDraft(next: CanvasLayout | null) {
    draftRef.current = next;
    setArrange(next);
  }
  function editLayout(action: CanvasAction, base = draftRef.current) {
    if (!base) return;
    setDraft(
      canvasLayout(
        changeCanvas(
          { ...budget, board: { ...boardLayout(budget), canvas: base } },
          {
            ...action,
            scene,
            phone,
            frameWidth: frame.width || 390,
            context: expanded,
          },
        ),
      ),
    );
  }
  function updateView(next: Viewport, save = false, animate = false) {
    viewRef.current = next;
    setView(next);
    setAnimateCamera(animate);
    if (save) {
      const action: CanvasAction = { type: "viewport", scene, ...next };
      if (draftRef.current) editLayout(action);
      else setBudget((b) => changeCanvas(b, action));
    }
  }
  const motion = useCanvasMotion({
    windowRef,
    enabled: mode === "map",
    arranging: editing,
    layout,
    getViewport: () => viewRef.current,
    onViewport: updateView,
    onLayout: editLayout,
    onSelect: selectWidget,
    onBeginArrange: () => beginArrange(false),
  });
  const painted = useWidgetPositions(graph.nodes, scene, motion.draggingId);

  useEffect(() => {
    const element = windowRef.current;
    if (!element || mode !== "map") return;
    let first = true;
    let previousFrame: { width: number; height: number } | undefined;
    function resize() {
      const rect = element!.getBoundingClientRect(),
        current = latest.current;
      const nextFrame = { width: rect.width, height: rect.height };
      if (!rect.width || !rect.height) return;
      if (
        !first &&
        previousFrame?.width === rect.width &&
        previousFrame.height === rect.height
      )
        return;
      setFrame(nextFrame);
      const stored =
        scene === "all"
          ? current.layout.viewport
          : current.layout.scenes?.[scene]?.viewport;
      const next = first
        ? stored
          ? recoverCanvasViewport(current.graph.nodes, stored, nextFrame)
          : phone && scene === "overview"
            ? { x: 0, y: 0, zoom: 1 }
            : fitCanvasViewport(current.graph.nodes, nextFrame).viewport
        : recoverCanvasViewport(
            current.graph.nodes,
            viewRef.current,
            nextFrame,
            previousFrame,
          );
      previousFrame = nextFrame;
      first = false;
      viewRef.current = next;
      setView(next);
      setAnimateCamera(false);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [mode, scene, phone]);

  useEffect(() => {
    if (!pendingFocus || !frame.width) return;
    const task = requestAnimationFrame(() => {
      const node = latest.current.graph.nodes.find(
        (n) => n.id === pendingFocus,
      );
      if (!node) return;
      const zoom = Math.min(
        1,
        (frame.width - 32) / node.width,
        (frame.height - 32) / node.height,
      );
      const next = {
        zoom,
        x: (frame.width - node.width * zoom) / 2 - node.x * zoom,
        y: (frame.height - node.height * zoom) / 2 - node.y * zoom,
      };
      viewRef.current = next;
      setView(next);
      setAnimateCamera(true);
      setPendingFocus(null);
    });
    return () => cancelAnimationFrame(task);
  }, [pendingFocus, frame, scene]);

  const selectedNode =
    graph.nodes.find((n) => n.id === selected) ?? graph.nodes[0];
  const inlineResize =
    selectedNode.width * view.zoom >= 104 &&
    selectedNode.height * view.zoom >= 88;
  const openNode = allGraph.nodes.find((n) => n.id === openId),
    sizingNode = allGraph.nodes.find((n) => n.id === sizeId);
  const results = allGraph.nodes
    .filter((n) =>
      `${n.title} ${n.status ?? ""} ${n.kind}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 12);
  const activeId = hovered ?? selected;
  const visibleNodes = painted.filter(
    (n) =>
      n.id === selectedNode.id ||
      ((n.x + n.width) * view.zoom + view.x > -80 &&
        n.x * view.zoom + view.x < frame.width + 80 &&
        (n.y + n.height) * view.zoom + view.y > -80 &&
        n.y * view.zoom + view.y < frame.height + 80),
  );
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = canvasVisibleEdges(graph.edges, visibleIds);
  const inViewIds = new Set(
    painted
      .filter(
        (n) =>
          (n.x + n.width) * view.zoom + view.x > 0 &&
          n.x * view.zoom + view.x < frame.width &&
          (n.y + n.height) * view.zoom + view.y > 0 &&
          n.y * view.zoom + view.y < frame.height,
      )
      .map((n) => n.id),
  );
  const outsideLinks = allGraph.edges.filter(
    (e) =>
      (e.from === selected && !inViewIds.has(e.to)) ||
      (e.to === selected && !inViewIds.has(e.from)),
  ).length;

  function selectWidget(id: string) {
    setSelected(id);
    if (
      ["category", "cluster"].includes(
        allGraph.nodes.find((n) => n.id === id)?.kind ?? "",
      )
    )
      setExpanded(id);
  }

  function chooseScene(next: CanvasScene) {
    setScene(next);
    setExpanded(null);
    setSelected(
      ["budget", "committed", "paid", "notes"].includes(next) ? next : null,
    );
    setHovered(null);
    setTools(false);
    setFinding(false);
    setMessage("");
  }
  function beginArrange(reveal = true) {
    arrangeOrigin.current = viewRef.current;
    setDraft(
      canvasLayout(
        changeCanvas(budget, { type: "viewport", scene, ...viewRef.current }),
      ),
    );
    setMode("map");
    setTools(false);
    setFinding(false);
    if (
      reveal &&
      (selectedNode.width * viewRef.current.zoom < 104 ||
        selectedNode.height * viewRef.current.zoom < 88)
    )
      setPendingFocus(selectedNode.id);
    setMessage("Drag any widget. Neighbours make room. Only layout changes.");
    if (reveal) setSelected(selectedNode.id);
  }
  function finishArrange(save: boolean) {
    if (save && draftRef.current) {
      const draft = draftRef.current;
      const viewport = viewRef.current;
      setBudget((b) =>
        changeCanvas(
          { ...b, board: { ...boardLayout(b), canvas: draft } },
          { type: "viewport", scene, ...viewport },
        ),
      );
      setMessage("Arrangement saved. Money and relationships are unchanged.");
    } else {
      updateView(arrangeOrigin.current, false, true);
      setMessage("Arrangement cancelled.");
    }
    setDraft(null);
    setSizeId(null);
  }
  useImperativeHandle(controller, () => ({
    cancelArrange: () => finishArrange(false),
  }));
  function fit() {
    const fitted = fitCanvasViewport(graph.nodes, frame);
    updateView(fitted.viewport, true, true);
    setMessage(
      fitted.complete
        ? `All ${graph.nodes.length} widgets fit. Zoom in or choose a cluster to read more.`
        : "Readable local view. More widgets are outside it; pan, choose a cluster, or use List.",
    );
  }
  function zoomBy(factor: number) {
    const current = viewRef.current,
      zoom = Math.max(0.5, Math.min(1.8, current.zoom * factor));
    const x = frame.width / 2,
      y = frame.height / 2;
    updateView(
      {
        zoom,
        x: x - ((x - current.x) * zoom) / current.zoom,
        y: y - ((y - current.y) * zoom) / current.zoom,
      },
      true,
      true,
    );
  }
  function openRecord(node: CanvasNode) {
    detailOrigin.current = {
      viewport: { ...viewRef.current },
      selected: graph.nodes.some((n) => n.id === node.id) ? node.id : selected,
    };
    if (graph.nodes.some((n) => n.id === node.id)) setSelected(node.id);
    setOpenId(node.id);
    setHistory([]);
    setFinding(false);
  }
  function navigate(id: string) {
    if (!allGraph.nodes.some((n) => n.id === id)) return;
    if (openId) setHistory((items) => [...items, openId]);
    setOpenId(id);
  }
  function closeDetail() {
    const origin = detailOrigin.current;
    if (origin) {
      updateView(origin.viewport);
      setSelected(origin.selected);
    }
    setHovered(null);
    setOpenId(null);
    setHistory([]);
    requestAnimationFrame(() =>
      (
        windowRef.current?.querySelector<HTMLButtonElement>(
          ".selected-node .widget-face",
        ) ?? windowRef.current
      )?.focus({ preventScroll: true }),
    );
  }
  function moveSelected(dx: number, dy: number) {
    editLayout({
      type: "position",
      id: selectedNode.id,
      x: Math.max(0, selectedNode.x + dx),
      y: Math.max(0, selectedNode.y + dy),
    });
  }
  const directions = [
    ["left", -32, 0, 180],
    ["up", 0, -32, -90],
    ["down", 0, 32, 90],
    ["right", 32, 0, 0],
  ] as const;

  return (
    <section
      className={`canvas-workspace widget-workspace${editing ? " arranging" : ""}`}
      aria-label="Node board"
    >
      <div className="widget-scope">
        <span>{scope ?? budget.name}</span>
        <span>USD</span>
      </div>
      <div className="canvas-toolbar widget-toolbar">
        {editing ? (
          <>
            <strong>Arrange widgets</strong>
            <div>
              <button
                className="outline-button"
                onClick={() => finishArrange(false)}
              >
                Cancel
              </button>
              <button className="primary" onClick={() => finishArrange(true)}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <select
              aria-label="Widget cluster"
              value={scene}
              onChange={(e) => chooseScene(e.target.value as CanvasScene)}
            >
              {Object.entries(sceneNames).map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
            <div>
              <button
                className="outline-button"
                aria-expanded={finding}
                onClick={() => {
                  setFinding(!finding);
                  setTools(false);
                }}
              >
                Find
              </button>
              <button className="outline-button" onClick={() => beginArrange()}>
                Arrange
              </button>
              <button
                className="outline-button"
                aria-label="Board tools"
                aria-expanded={tools}
                onClick={() => {
                  setTools(!tools);
                  setFinding(false);
                }}
              >
                Tools
              </button>
            </div>
          </>
        )}
      </div>
      {tools && (
        <div className="widget-tools" aria-label="Board tools">
          <div role="group" aria-label="Board view">
            {(["map", "list"] as const).map((item) => (
              <button
                key={item}
                className="outline-button"
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
              >
                {item === "map" ? "Map" : "List"}
              </button>
            ))}
          </div>
          {mode === "map" && (
            <>
              <button className="outline-button" onClick={fit}>
                Fit
              </button>
              <button
                className="outline-button"
                aria-pressed={links !== "hidden"}
                onClick={() =>
                  setLinks(
                    links === "hidden"
                      ? selected
                        ? "selection"
                        : "all"
                      : "hidden",
                  )
                }
              >
                {links === "hidden" ? "Show links" : "Hide links"}
              </button>
              <div className="zoom-controls">
                <button
                  className="outline-button"
                  aria-label="Zoom out"
                  disabled={view.zoom <= 0.5}
                  onClick={() => zoomBy(1 / 1.2)}
                >
                  −
                </button>
                <output>{Math.round(view.zoom * 100)}%</output>
                <button
                  className="outline-button"
                  aria-label="Zoom in"
                  disabled={view.zoom >= 1.8}
                  onClick={() => zoomBy(1.2)}
                >
                  +
                </button>
              </div>
              <label>
                Links
                <select
                  aria-label="Relationship links"
                  value={links}
                  onChange={(e) => setLinks(e.target.value as typeof links)}
                >
                  <option value="selection">On interaction</option>
                  <option value="all">All visible links</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <div className="widget-pan" role="group" aria-label="Pan board">
                {directions.map(([name, dx, dy, angle]) => (
                  <button
                    key={name}
                    className="outline-button"
                    aria-label={`Pan board ${name}`}
                    onClick={() =>
                      updateView(
                        {
                          ...viewRef.current,
                          x: viewRef.current.x - dx * 3,
                          y: viewRef.current.y - dy * 3,
                        },
                        true,
                        true,
                      )
                    }
                  >
                    <Arrow angle={angle} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {finding && (
        <section className="canvas-find" aria-label="Find a node">
          <header>
            <label>
              Find a node
              <input
                ref={findRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Category, entry or status"
              />
            </label>
            <button
              className="outline-button"
              onClick={() => setFinding(false)}
            >
              Close Find
            </button>
          </header>
          <div>
            {results.map((node) => (
              <button
                className="outline-button"
                key={node.id}
                aria-label={`Open ${node.title}`}
                onClick={() => openRecord(node)}
              >
                <span>
                  {node.title}
                  <small>
                    {node.kind === "cluster"
                      ? "Lifecycle cluster"
                      : (node.status ?? node.kind)}
                  </small>
                </span>
                Open
              </button>
            ))}
            {!results.length && (
              <p>No matching node. Your records have not changed.</p>
            )}
          </div>
        </section>
      )}
      <p className="canvas-guidance">
        {editing
          ? inlineResize
            ? "Drag to shuffle. Drag the selected corner to resize. Cancel keeps your saved layout."
            : "Drag to shuffle. Use Size, or zoom in for corner resizing. Cancel restores your layout."
          : selected
            ? "Tap again to open. Explore a cluster for its records. USD."
            : "Tap a widget to see its links. All amounts in USD."}
      </p>
      {mode === "map" ? (
        <>
          <div
            ref={windowRef}
            className={`canvas-window${motion.interacting ? " interacting" : ""}${animateCamera ? " animate-camera" : ""}${view.zoom < 0.55 ? " distant-view" : ""}`}
            role="region"
            aria-label={`${sceneNames[scene]} widget map`}
            onPointerDownCapture={motion.onPointerDownCapture}
            onPointerDown={motion.onPointerDown}
            onPointerMove={motion.onPointerMove}
            onPointerUp={motion.onPointerUp}
            onPointerCancel={motion.onPointerCancel}
            onPointerUpCapture={(e) => {
              if (
                !(e.target as Element).closest("button") &&
                motion.isBackgroundTap()
              ) {
                setSelected(null);
                setHovered(null);
                setExpanded(null);
                setLinks("selection");
              }
            }}
          >
            <div
              className="canvas-world"
              style={{
                width: graph.width,
                height: graph.height,
                transform: `translate3d(${view.x}px,${view.y}px,0) scale(${view.zoom})`,
              }}
            >
              <svg
                className="canvas-connectors"
                width={graph.width}
                height={graph.height}
                aria-hidden="true"
              >
                {visibleEdges.map((edge, i) => {
                  const from = painted.find((n) => n.id === edge.from)!,
                    to = painted.find((n) => n.id === edge.to)!;
                  const a = edgeBoundary(from, to),
                    b = edgeBoundary(to, from);
                  const x1 = a.x,
                    y1 = a.y,
                    x2 = b.x,
                    y2 = b.y;
                  const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12,
                    my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
                  return (
                    <g
                      data-link-visible={
                        links !== "hidden" &&
                        (links === "all" ||
                          edge.from === activeId ||
                          edge.to === activeId)
                      }
                      style={{
                        opacity:
                          links !== "hidden" &&
                          (links === "all" ||
                            edge.from === activeId ||
                            edge.to === activeId)
                            ? 1
                            : 0,
                      }}
                      key={`${edge.from}-${edge.to}-${i}`}
                      className={`edge-${edge.type}`}
                    >
                      <path
                        strokeDasharray={
                          edge.type === "membership" ? "5 5" : undefined
                        }
                        d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                      />
                      {view.zoom >= 0.9 && edge.type === "membership" && (
                        <text x={mx} y={my - 7} textAnchor="middle">
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              {visibleNodes.map((node) => (
                <article
                  key={node.id}
                  data-canvas-node={node.id}
                  className={`canvas-node node-${node.kind} shape-${node.shape} density-${node.size}${widgetInfo(node, budget).negative ? " is-negative" : ""}${selected === node.id ? " selected-node" : ""}${motion.draggingId === node.id ? " moving-node" : ""}`}
                  style={{
                    width: node.width,
                    height: node.height,
                    transform: `translate3d(${node.x}px,${node.y}px,0)`,
                  }}
                  aria-label={`${node.title} ${node.kind} node`}
                >
                  <button
                    className="widget-face"
                    style={canvasHitBounds(node, view.zoom)}
                    aria-label={`${editing ? "Drag or select" : "Select"} ${node.title}`}
                    aria-pressed={selected === node.id}
                    onPointerDown={(e) => motion.beginNode(e, node)}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setHovered(node.id);
                    }}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(node.id)}
                    onBlur={() => setHovered(null)}
                    onClick={() => {
                      if (motion.canClick()) {
                        if (
                          !editing &&
                          selected === node.id &&
                          view.zoom >= 0.9
                        )
                          openRecord(node);
                        else {
                          selectWidget(node.id);
                          setLinks("selection");
                        }
                        if (view.zoom < 0.9) setPendingFocus(node.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!editing) {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          openRecord(node);
                        } else if (e.key === " ") {
                          e.preventDefault();
                          selectWidget(node.id);
                          setLinks("selection");
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setSelected(null);
                          setHovered(null);
                          setExpanded(null);
                          setLinks("selection");
                        }
                        return;
                      }
                      const direction = directions.find(
                        ([name]) =>
                          `Arrow${name[0].toUpperCase()}${name.slice(1)}` ===
                          e.key,
                      );
                      if (direction) {
                        e.preventDefault();
                        setSelected(node.id);
                        editLayout({
                          type: "position",
                          id: node.id,
                          x: Math.max(0, node.x + direction[1]),
                          y: Math.max(0, node.y + direction[2]),
                        });
                      }
                    }}
                  >
                    <span
                      className="widget-surface"
                      style={{ height: node.height }}
                    >
                      <WidgetContent
                        node={node}
                        budget={budget}
                        zoom={view.zoom}
                      />
                      {editing && (
                        <span className="widget-grab">
                          <MoveIcon />
                        </span>
                      )}
                    </span>
                  </button>
                  {editing && inlineResize && selectedNode.id === node.id && (
                    <button
                      className="widget-resize"
                      aria-label={`Resize ${node.title}`}
                      style={{ width: 44 / view.zoom, height: 44 / view.zoom }}
                      onPointerDown={(e) => motion.beginResize(e, node)}
                      onClick={() => {
                        if (motion.canClick()) setSizeId(node.id);
                      }}
                    >
                      <MoveIcon resize />
                    </button>
                  )}
                </article>
              ))}
            </div>
            {motion.dropPreview && (
              <div
                className="widget-drop-outline"
                aria-hidden="true"
                style={{
                  width: motion.dropPreview.width,
                  height: motion.dropPreview.height,
                  transform: `translate3d(${motion.dropPreview.x * view.zoom + view.x}px,${motion.dropPreview.y * view.zoom + view.y}px,0) scale(${view.zoom})`,
                }}
              />
            )}
            <span className="widget-map-label">
              {sceneNames[scene]} · {graph.nodes.length} widgets
            </span>
          </div>
          <div className="widget-inspector" aria-label="Selected widget">
            {selected || editing ? (
              <div className="widget-selection">
                <div>
                  <strong>{selectedNode.title}</strong>
                  <span>{widgetInfo(selectedNode, budget).full}</span>
                  {!!outsideLinks && (
                    <small>
                      {outsideLinks} linked{" "}
                      {outsideLinks === 1 ? "item" : "items"} outside this view.{" "}
                      {scene !== selectedNode.group
                        ? "Explore to see them."
                        : "Pan or use Tools → List."}
                    </small>
                  )}
                </div>
                {editing ? (
                  <button
                    className="outline-button"
                    onClick={() => setSizeId(selectedNode.id)}
                  >
                    Size
                  </button>
                ) : (
                  <>
                    <button
                      className="outline-button"
                      aria-label={`Open ${selectedNode.title}`}
                      onClick={() => openRecord(selectedNode)}
                    >
                      Open
                    </button>
                    {["budget", "balance", "cluster", "notes"].includes(
                      selectedNode.kind,
                    ) &&
                      scene !== selectedNode.group && (
                        <button
                          className="outline-button"
                          aria-label={`Explore ${selectedNode.title} cluster`}
                          onClick={() => chooseScene(selectedNode.group)}
                        >
                          Explore
                        </button>
                      )}
                  </>
                )}
              </div>
            ) : (
              <p className="widget-rest-hint">
                Select a widget for its exact amount, links and Open view.
              </p>
            )}
            {editing && (
              <div
                className="widget-movement"
                role="group"
                aria-label="Move selected node"
              >
                {directions.map(([name, dx, dy, angle]) => (
                  <button
                    key={name}
                    className="outline-button"
                    aria-label={`Move ${selectedNode.title} ${name}`}
                    onClick={() => moveSelected(dx, dy)}
                  >
                    <Arrow angle={angle} />
                  </button>
                ))}
                <button
                  className="outline-button"
                  onClick={() => {
                    editLayout({ type: "auto" });
                    setMessage(
                      "Cluster balanced. Done saves; Cancel restores.",
                    );
                  }}
                >
                  Balance cluster
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="canvas-list" aria-label="All board nodes">
          {allGraph.nodes.map((node) => (
            <article key={node.id}>
              <div>
                <small>{node.status ?? node.kind}</small>
                <h3>{node.title}</h3>
                <strong>{widgetInfo(node, budget).full}</strong>
                <p>{widgetInfo(node, budget).caption}</p>
              </div>
              <button
                className="outline-button"
                aria-label={`Open ${node.title}`}
                onClick={() => openRecord(node)}
              >
                Open
              </button>
            </article>
          ))}
        </div>
      )}
      <p className="canvas-status" role="status">
        {storageError
          ? "Not saved. Download all books before leaving."
          : message ||
            `${budget.categories.length} categories · ${budget.expenses.length} entries · saved on this device`}
      </p>
      <footer className="canvas-footer">
        <p>Layout moves. Your numbers stay put.</p>
        <div>
          <button className="outline-button" onClick={onBackup}>
            Download project
          </button>
          <button className="outline-button" onClick={onReport}>
            Share a report
          </button>
        </div>
      </footer>
      {sizingNode && (
        <SizeDialog
          key={sizingNode.id}
          node={graph.nodes.find((n) => n.id === sizeId) ?? sizingNode}
          budget={budget}
          custom={!!layout.dimensions?.[sizingNode.id]}
          onCancel={() => setSizeId(null)}
          onApply={(action) => {
            editLayout(action);
            setSizeId(null);
            setMessage("Size changed. Done saves this arrangement.");
          }}
        />
      )}
      {openNode && (
        <NodeDetail
          key={openNode.id}
          node={openNode}
          budget={budget}
          setBudget={setBudget}
          hasBack={!!history.length}
          onClose={closeDetail}
          onBack={() => {
            if (!history.length) closeDetail();
            else {
              setOpenId(history.at(-1)!);
              setHistory((items) => items.slice(0, -1));
            }
          }}
          onNavigate={navigate}
          onPlan={() => {
            closeDetail();
            onPlan();
          }}
          onSpend={(categoryId) => {
            closeDetail();
            onSpend(categoryId);
          }}
          onExpense={(expense) => {
            closeDetail();
            onExpense(expense);
          }}
        />
      )}
    </section>
  );
}
