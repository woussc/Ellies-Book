"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type SetStateAction,
} from "react";
import { money, totals } from "./model.mjs";
import { boardLayout, noteConnections } from "./board-model.mjs";
import {
  canvasGraph,
  canvasLayout,
  changeCanvas,
  recoverCanvasViewport,
} from "./canvas-model.mjs";
import NodeDetail from "./node-detail";
import type { Budget, CanvasLayout, Expense, NodeSize } from "./model.mjs";
import type { CanvasAction, CanvasNode } from "./canvas-model.mjs";

const subscribeWidth = (callback: () => void) => {
  const media = matchMedia("(max-width: 640px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const isPhone = () => matchMedia("(max-width: 640px)").matches;
type Viewport = CanvasLayout["viewport"];

function NodeContent({
  node,
  budget,
  condensed = false,
}: {
  node: CanvasNode;
  budget: Budget;
  condensed?: boolean;
}) {
  const entry =
    node.kind === "expense"
      ? budget.expenses.find((entry) => entry.id === node.recordId)
      : undefined;
  const category = budget.categories.find(
    (category) => category.id === node.categoryId,
  );
  const t = totals(
    budget,
    node.kind === "category" ? node.recordId : undefined,
  );
  const connections = noteConnections(budget);
  if (condensed || node.size === "small")
    return (
      <p className="node-condensed-amount">
        {node.kind === "notes"
          ? `${connections.resolved.length} linked records`
          : money(entry?.amount ?? t.left)}
        {!entry && node.kind !== "notes" && <small> left</small>}
      </p>
    );
  if (node.kind === "notes")
    return (
      <div className="node-content">
        <p className="node-note-preview">
          {budget.notes
            .replace(/^---[\s\S]*?---\s*/, "")
            .slice(0, node.size === "large" ? 260 : 100) ||
            "The story behind your decisions. Add Markdown links to connect a category or entry."}
        </p>
        <small>
          {connections.resolved.length} linked records
          {connections.tags.length
            ? ` · ${connections.tags.map((tag) => `#${tag}`).join(" ")}`
            : ""}
        </small>
        {node.size === "large" && (
          <ul className="node-preview-list">
            {connections.resolved.slice(0, 3).map((record) => (
              <li key={record.id}>{record.label}</li>
            ))}
          </ul>
        )}
      </div>
    );
  if (entry)
    return (
      <div className="node-content">
        <strong className="node-amount">{money(entry.amount)}</strong>
        <p className="node-caption">
          {entry.date} · {category?.name}
        </p>
        {node.size === "large" && (
          <div className="node-extra">
            <span>History: {entry.history.join(" → ")}</span>
            <p>
              {entry.status === "planned"
                ? "An idea, not yet committed. Does not reduce money left."
                : entry.status === "committed"
                  ? "Still to pay. Included in money in use."
                  : "Paid. Counted once as actual spending."}
            </p>
          </div>
        )}
      </div>
    );
  return (
    <div className="node-content">
      <strong className={`node-amount${t.left < 0 ? " negative" : ""}`}>
        {money(t.left)}
      </strong>
      <span className="node-caption">left to commit</span>
      <dl className="node-money-facts">
        <div>
          <dt>{node.kind === "category" ? "Allocated" : "Budget"}</dt>
          <dd>{money(category?.amount ?? budget.total)}</dd>
        </div>
        <div>
          <dt>In use</dt>
          <dd>{money(t.spent + t.committed)}</dd>
        </div>
      </dl>
      {node.size === "large" && (
        <ul className="node-preview-list">
          {node.kind === "budget"
            ? budget.categories.slice(0, 3).map((category) => (
                <li key={category.id}>
                  <span>{category.name}</span>
                  <b>{money(category.amount)}</b>
                </li>
              ))
            : budget.expenses
                .filter((entry) => entry.categoryId === node.recordId)
                .slice(0, 3)
                .map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.description}</span>
                    <b>{money(entry.amount)}</b>
                  </li>
                ))}
          {node.kind === "category" &&
            !budget.expenses.some(
              (entry) => entry.categoryId === node.recordId,
            ) && <li>No entries yet.</li>}
        </ul>
      )}
    </div>
  );
}

function SizeDialog({
  node,
  budget,
  onApply,
  onCancel,
}: {
  node: CanvasNode;
  budget: Budget;
  onApply: (size: NodeSize) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState(node.size);
  const minimum = ["budget", "category"].includes(node.kind);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
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
        <button
          className="outline-button"
          aria-label="Close size controls"
          onClick={onCancel}
        >
          ×
        </button>
      </header>
      <p>Choose how much this node shows.</p>
      <div className="size-options">
        {(["small", "medium", "large"] as NodeSize[]).map((option) => (
          <button
            key={option}
            className="size-option"
            aria-pressed={size === option}
            disabled={minimum && option === "small"}
            onClick={() => setSize(option)}
          >
            <strong>{option[0].toUpperCase() + option.slice(1)}</strong>
            <span>
              {option === "small"
                ? "Summary + Open"
                : option === "medium"
                  ? "Essential money + Open"
                  : "Essential money + a capped preview"}
            </span>
          </button>
        ))}
      </div>
      {minimum && (
        <p className="hint">
          Small is unavailable. Budget and Category start at Medium so essential
          money stays visible.
        </p>
      )}
      <p className="eyebrow">Content preview · {size}</p>
      <div className={`size-preview size-${size}`}>
        <strong>{node.title}</strong>
        <NodeContent budget={budget} node={{ ...node, size }} />
      </div>
      <div className="size-actions">
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={() => onApply(size)}>
          Apply size
        </button>
      </div>
    </dialog>
  );
}

export default function NodeBoard({
  budget,
  setBudget,
  onPlan,
  onSpend,
  onExpense,
  onReport,
  onBackup,
  storageError,
  onEditingChange,
}: {
  budget: Budget;
  setBudget: (next: SetStateAction<Budget>) => boolean;
  onPlan: () => void;
  onSpend: (categoryId?: string) => void;
  onExpense: (expense: Expense) => void;
  onReport: () => void;
  onBackup: () => void;
  storageError: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const phone = useSyncExternalStore(subscribeWidth, isPhone, () => false);
  const savedLayout = canvasLayout(budget);
  const [arrange, setArrange] = useState<CanvasLayout | null>(null);
  const [view, setView] = useState(savedLayout.viewport);
  const viewRef = useRef(view);
  const [mode, setMode] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState("budget");
  const [menu, setMenu] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [ghost, setGhost] = useState<CanvasNode | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const pointer = useRef<{
    pointerId: number;
    id?: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    origin: Viewport;
  } | null>(null);
  const layout = arrange ?? savedLayout;
  const graph = canvasGraph(budget, layout, !!arrange, phone);
  const nodesRef = useRef(graph.nodes);
  useEffect(() => {
    nodesRef.current = graph.nodes;
  }, [graph.nodes]);
  useEffect(() => {
    const element = windowRef.current;
    if (!element || mode !== "map") return;
    const observer = new ResizeObserver(() => {
      const nextFrame = {
        width: element.clientWidth,
        height: element.clientHeight,
      };
      setFrame(nextFrame);
      const next = recoverCanvasViewport(
        nodesRef.current,
        viewRef.current,
        nextFrame,
      );
      if (next !== viewRef.current) {
        viewRef.current = next;
        setView(next);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode, phone]);
  const visibleNodes = graph.nodes.filter(
    (node) =>
      !frame.width ||
      ((node.x + node.width) * view.zoom + view.x >= 0 &&
        (node.y + node.height) * view.zoom + view.y >= 0 &&
        node.x * view.zoom + view.x <= frame.width &&
        node.y * view.zoom + view.y <= frame.height),
  );
  const openNode = graph.nodes.find((node) => node.id === openId);
  const sizingNode = graph.nodes.find((node) => node.id === sizeId);
  const selectedNode =
    graph.nodes.find((node) => node.id === selected) ?? graph.nodes[0];
  const results = graph.nodes
    .filter((node) =>
      `${node.title} ${node.recordId} ${node.kind === "notes" ? budget.notes : ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .slice(0, 40);

  function changeView(next: Viewport) {
    viewRef.current = next;
    setView(next);
  }
  function saveView(next: Viewport) {
    changeView(next);
    if (arrange)
      setArrange((current) => current && { ...current, viewport: next });
    else setBudget((b) => changeCanvas(b, { type: "viewport", ...next }));
  }
  function editLayout(action: CanvasAction) {
    setArrange(
      (current) =>
        current &&
        changeCanvas(
          { ...budget, board: { ...boardLayout(budget), canvas: current } },
          action,
        ).board!.canvas!,
    );
  }
  function beginArrange(id = "budget", size = false) {
    onEditingChange(true);
    setArrange(structuredClone({ ...savedLayout, viewport: viewRef.current }));
    setSelected(id);
    setMenu(null);
    setMode("map");
    setFinding(false);
    if (size) setSizeId(id);
    setMessage(
      "Layout only. Move with a handle or the arrow buttons. Done saves; Cancel discards.",
    );
  }
  function finishArrange(commit: boolean) {
    onEditingChange(false);
    if (commit && arrange) {
      const saved = setBudget((b) => ({
        ...b,
        board: {
          ...boardLayout(b),
          canvas: { ...arrange, viewport: viewRef.current },
        },
      }));
      setMessage(
        saved
          ? "Layout saved. Your money and relationships are unchanged."
          : "Layout is on this page only. Download all books before leaving.",
      );
    } else {
      changeView(savedLayout.viewport);
      setMessage("Arrangement cancelled. Your saved layout is unchanged.");
    }
    setArrange(null);
    setSizeId(null);
    setGhost(null);
    pointer.current = null;
  }
  function focusNode(node: CanvasNode, open = true) {
    const rect = windowRef.current?.getBoundingClientRect();
    const zoom = Math.max(0.9, Math.min(viewRef.current.zoom, 1.2));
    saveView({
      zoom,
      x: (rect?.width ?? 360) / 2 - (node.x + node.width / 2) * zoom,
      y: 36 - node.y * zoom,
    });
    setSelected(node.id);
    setMenu(null);
    setFinding(false);
    if (open) {
      setOpenId(node.id);
      setHistory([]);
    }
    setMessage(`Located ${node.title}.`);
  }
  function navigate(id: string) {
    const node = graph.nodes.find((node) => node.id === id);
    if (!node) return;
    if (openId) setHistory((items) => [...items, openId]);
    setOpenId(id);
    setSelected(id);
    const rect = windowRef.current?.getBoundingClientRect();
    saveView({
      zoom: 1,
      x: (rect?.width ?? 360) / 2 - node.x - node.width / 2,
      y: 36 - node.y,
    });
  }
  function zoomBy(factor: number) {
    const rect = windowRef.current?.getBoundingClientRect();
    const current = viewRef.current,
      zoom = Math.max(0.2, Math.min(1.5, current.zoom * factor));
    const x = (rect?.width ?? 360) / 2,
      y = (rect?.height ?? 500) / 2;
    saveView({
      zoom,
      x: x - ((x - current.x) * zoom) / current.zoom,
      y: y - ((y - current.y) * zoom) / current.zoom,
    });
  }
  function fit() {
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const minX = Math.min(...graph.nodes.map((node) => node.x)),
      minY = Math.min(...graph.nodes.map((node) => node.y));
    const width =
      Math.max(...graph.nodes.map((node) => node.x + node.width)) - minX;
    const height =
      Math.max(...graph.nodes.map((node) => node.y + node.height)) - minY;
    const zoom = Math.max(
      0.2,
      Math.min(1, (rect.width - 40) / width, (rect.height - 40) / height),
    );
    saveView({
      zoom,
      x: (rect.width - width * zoom) / 2 - minX * zoom,
      y: (rect.height - height * zoom) / 2 - minY * zoom,
    });
    setMessage(
      "Whole board in view. Use Find or List to open a node at a readable size.",
    );
  }
  function moveSelected(dx: number, dy: number) {
    editLayout({
      type: "position",
      id: selectedNode.id,
      x: Math.max(0, selectedNode.x + dx),
      y: Math.max(0, selectedNode.y + dy),
    });
    setMessage(
      `${selectedNode.title} moved. Money and membership are unchanged.`,
    );
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>, node: CanvasNode) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = {
      pointerId: event.pointerId,
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      x: node.x,
      y: node.y,
      origin: viewRef.current,
    };
    setSelected(node.id);
    setGhost(node);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.id) {
      const x = Math.max(
        0,
        Math.round(
          (current.x +
            (event.clientX - current.startX) / viewRef.current.zoom) /
            16,
        ) * 16,
      );
      const y = Math.max(
        0,
        Math.round(
          (current.y +
            (event.clientY - current.startY) / viewRef.current.zoom) /
            16,
        ) * 16,
      );
      editLayout({ type: "position", id: current.id, x, y });
    } else
      changeView({
        ...current.origin,
        x: current.x + event.clientX - current.startX,
        y: current.y + event.clientY - current.startY,
      });
  }
  function stopPointer(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.id && cancel)
      editLayout({
        type: "position",
        id: current.id,
        x: current.x,
        y: current.y,
      });
    if (!current.id) {
      if (cancel) changeView(current.origin);
      else saveView(viewRef.current);
    }
    pointer.current = null;
    setGhost(null);
  }
  return (
    <section className="canvas-workspace" aria-label="Project node board">
      <div className="canvas-toolbar">
        {arrange ? (
          <>
            <div>
              <strong>Arrange your board</strong>
              <span className="layout-badge">Layout only</span>
            </div>
            <div className="toolbar-actions">
              <button
                className="secondary"
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
            <div className="view-switch" role="group" aria-label="Board view">
              <button
                className="outline-button"
                aria-pressed={mode === "map"}
                onClick={() => setMode("map")}
              >
                Map
              </button>
              <button
                className="outline-button"
                aria-pressed={mode === "list"}
                onClick={() => setMode("list")}
              >
                List
              </button>
            </div>
            <div className="toolbar-actions">
              <button
                className="outline-button"
                aria-expanded={finding}
                onClick={() => setFinding(!finding)}
              >
                Find
              </button>
              <button className="outline-button" onClick={() => beginArrange()}>
                Arrange
              </button>
            </div>
          </>
        )}
      </div>
      {finding && (
        <section className="canvas-find" aria-label="Find a node">
          <label>
            Find by name, entry ID or note tag
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a category or entry…"
            />
          </label>
          <div>
            {results.map((node) => (
              <button
                className="outline-button"
                key={node.id}
                onClick={() => {
                  setMode("map");
                  focusNode(node);
                }}
              >
                <span>
                  {node.title}
                  <small>{node.kind}</small>
                </span>
                Open ↗
              </button>
            ))}
            {!results.length && (
              <p>No matching node. Your records have not changed.</p>
            )}
          </div>
        </section>
      )}
      <p className="canvas-guidance">
        {arrange
          ? "Position never changes money or relationships. Select a node, then use its handle or the arrows."
          : "Budget → categories → entries. Dashed links come from your Markdown notes."}
      </p>
      {arrange && (
        <div
          className="move-controls"
          role="group"
          aria-label="Move selected node"
        >
          <span>
            Move <strong>{selectedNode.title}</strong>
          </span>
          {[
            ["←", -48, 0, "left"],
            ["↑", 0, -48, "up"],
            ["↓", 0, 48, "down"],
            ["→", 48, 0, "right"],
          ].map(([label, dx, dy, name]) => (
            <button
              className="outline-button"
              key={name}
              aria-label={`Move ${selectedNode.title} ${name}`}
              onClick={() => moveSelected(Number(dx), Number(dy))}
            >
              {label}
            </button>
          ))}
          <button
            className="outline-button"
            onClick={() => setSizeId(selectedNode.id)}
          >
            Size
          </button>
        </div>
      )}
      {mode === "map" ? (
        <>
          <div className="canvas-map-controls">
            <div className="zoom-controls">
              <button
                className="outline-button"
                aria-label="Zoom out"
                disabled={view.zoom <= 0.2}
                onClick={() => zoomBy(1 / 1.2)}
              >
                −
              </button>
              <output aria-label="Zoom level">
                {Math.round(view.zoom * 100)}%
              </output>
              <button
                className="outline-button"
                aria-label="Zoom in"
                disabled={view.zoom >= 1.5}
                onClick={() => zoomBy(1.2)}
              >
                +
              </button>
              <button className="outline-button" onClick={fit}>
                Fit
              </button>
            </div>
            <button
              className="outline-button"
              onClick={() => {
                if (!arrange) beginArrange();
                editLayout({ type: "auto" });
                if (!arrange)
                  setArrange(
                    (current) => current && { ...current, positions: {} },
                  );
                setMessage(
                  "Auto-arranged. Review, then Done to save or Cancel to keep your layout.",
                );
              }}
            >
              Auto-arrange
            </button>
          </div>
          <div
            className={`canvas-window${arrange ? " arranging" : ""}`}
            ref={windowRef}
            role="region"
            aria-label="Pannable node canvas. Drag the background or use the Pan board buttons. A List view is also available."
            onPointerDown={(e) => {
              if (
                e.button !== 0 ||
                (e.target as HTMLElement).closest(
                  "button,input,textarea,a,[data-canvas-node]",
                )
              )
                return;
              e.currentTarget.setPointerCapture(e.pointerId);
              pointer.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                x: viewRef.current.x,
                y: viewRef.current.y,
                origin: viewRef.current,
              };
            }}
            onPointerMove={pointerMove}
            onPointerUp={(e) => stopPointer(e)}
            onPointerCancel={(e) => stopPointer(e, true)}
          >
            <div
              className="canvas-world"
              style={{
                width: graph.width,
                height: graph.height,
                transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})`,
              }}
            >
              <svg
                className="canvas-connectors"
                width={graph.width}
                height={graph.height}
                aria-hidden="true"
              >
                {graph.edges.map((edge, i) => {
                  const from = graph.nodes.find(
                      (node) => node.id === edge.from,
                    )!,
                    to = graph.nodes.find((node) => node.id === edge.to)!;
                  const vertical =
                    to.x < from.x + from.width + 20 && to.y > from.y;
                  const x1 = vertical
                      ? from.x + from.width / 2
                      : from.x + from.width,
                    y1 = vertical
                      ? from.y + from.height
                      : from.y + from.height / 2,
                    x2 = vertical ? to.x + to.width / 2 : to.x,
                    y2 = vertical ? to.y : to.y + to.height / 2;
                  const bend = vertical ? (y1 + y2) / 2 : (x1 + x2) / 2;
                  return (
                    <g
                      key={`${edge.from}-${edge.to}-${i}`}
                      className={`edge-${edge.type}`}
                    >
                      <path
                        d={
                          vertical
                            ? `M ${x1} ${y1} C ${x1} ${bend}, ${x2} ${bend}, ${x2} ${y2}`
                            : `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}`
                        }
                      />
                      <text
                        x={vertical ? (x1 + x2) / 2 + 12 : bend}
                        y={vertical ? bend : (y1 + y2) / 2 - 8}
                        textAnchor={vertical ? "start" : "middle"}
                      >
                        {edge.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {ghost && (
                <div
                  className="node-placement"
                  aria-hidden="true"
                  style={{
                    left: ghost.x,
                    top: ghost.y,
                    width: ghost.width,
                    height: 146,
                  }}
                >
                  Original position
                </div>
              )}
              {visibleNodes.map((node) => (
                <article
                  key={node.id}
                  data-canvas-node={node.id}
                  className={`canvas-node node-${node.kind} density-${node.size}${selected === node.id ? " selected-node" : ""}${ghost?.id === node.id ? " moving-node" : ""}${menu === node.id ? " menu-open" : ""}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.width,
                    height: node.height,
                  }}
                  aria-label={`${node.title} ${node.kind} node`}
                >
                  <header>
                    <div>
                      <small>
                        {node.status ??
                          (node.kind === "budget"
                            ? "Project budget"
                            : node.kind === "notes"
                              ? "Markdown"
                              : "Category")}
                      </small>
                      <h3>{node.title}</h3>
                    </div>
                    {arrange && (
                      <button
                        className="outline-button node-handle"
                        aria-label={`Drag or select ${node.title}`}
                        aria-pressed={selected === node.id}
                        onPointerDown={(e) => startDrag(e, node)}
                        onClick={() => setSelected(node.id)}
                        onKeyDown={(e) => {
                          const direction: Record<string, [number, number]> = {
                            ArrowLeft: [-48, 0],
                            ArrowRight: [48, 0],
                            ArrowUp: [0, -48],
                            ArrowDown: [0, 48],
                          };
                          if (direction[e.key]) {
                            e.preventDefault();
                            const [x, y] = direction[e.key];
                            editLayout({
                              type: "position",
                              id: node.id,
                              x: Math.max(0, node.x + x),
                              y: Math.max(0, node.y + y),
                            });
                          }
                        }}
                      >
                        ↔
                      </button>
                    )}
                  </header>
                  <NodeContent
                    node={node}
                    budget={budget}
                    condensed={!!arrange}
                  />
                  <div className="node-actions">
                    {arrange ? (
                      <>
                        <button
                          className="outline-button"
                          aria-label={`Size ${node.title}`}
                          onClick={() => {
                            setSelected(node.id);
                            setSizeId(node.id);
                          }}
                        >
                          Size
                        </button>
                        <button
                          className="outline-button"
                          aria-label={`Select ${node.title} to move`}
                          onClick={() => {
                            setSelected(node.id);
                            setMessage(
                              `${node.title} selected. Use the four movement buttons above the canvas.`,
                            );
                          }}
                        >
                          Move
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="outline-button"
                          aria-label={`Open ${node.title}`}
                          onClick={() => focusNode(node)}
                        >
                          Open ↗
                        </button>
                        <button
                          className="outline-button"
                          aria-label={`More options for ${node.title}`}
                          aria-expanded={menu === node.id}
                          onClick={() =>
                            setMenu(menu === node.id ? null : node.id)
                          }
                        >
                          More ···
                        </button>
                      </>
                    )}
                  </div>
                  {menu === node.id && (
                    <div className="node-menu">
                      <button
                        className="outline-button"
                        onClick={() => beginArrange(node.id, true)}
                      >
                        Change size
                      </button>
                      <button
                        className="outline-button"
                        onClick={() => beginArrange(node.id)}
                      >
                        Move this node
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
          <div
            className="canvas-pan-controls"
            role="group"
            aria-label="Pan board"
          >
            <span>Pan board</span>
            {[
              ["←", 80, 0, "left"],
              ["↑", 0, 80, "up"],
              ["↓", 0, -80, "down"],
              ["→", -80, 0, "right"],
            ].map(([label, x, y, name]) => (
              <button
                className="outline-button"
                key={name}
                aria-label={`Pan board ${name}`}
                onClick={() =>
                  saveView({
                    ...viewRef.current,
                    x: viewRef.current.x + Number(x),
                    y: viewRef.current.y + Number(y),
                  })
                }
              >
                {label}
              </button>
            ))}
            <button
              className="outline-button"
              onClick={() => focusNode(graph.nodes[0], false)}
            >
              Budget
            </button>
          </div>
        </>
      ) : (
        <div className="canvas-list" aria-label="All board nodes">
          {graph.nodes.map((node) => (
            <article key={node.id}>
              <div>
                <small>{node.status ?? node.kind}</small>
                <h3>{node.title}</h3>
                {node.kind !== "notes" && (
                  <NodeContent
                    node={{ ...node, size: "small" }}
                    budget={budget}
                  />
                )}
              </div>
              <button
                className="outline-button"
                aria-label={`Open ${node.title}`}
                onClick={() => {
                  setOpenId(node.id);
                  setHistory([]);
                }}
              >
                Open ↗
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
        <p>One project. Connected views. Your numbers stay put.</p>
        <div>
          <button className="outline-button" onClick={onBackup}>
            Download project
          </button>
          <button className="outline-button" onClick={onReport}>
            Share a report ↗
          </button>
        </div>
      </footer>
      {sizingNode && (
        <SizeDialog
          key={sizingNode.id}
          node={sizingNode}
          budget={budget}
          onCancel={() => setSizeId(null)}
          onApply={(size) => {
            editLayout({ type: "size", id: sizingNode.id, size });
            setSizeId(null);
            setMessage(
              `${sizingNode.title} set to ${size}. Done saves this arrangement.`,
            );
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
          onClose={() => {
            setOpenId(null);
            setHistory([]);
          }}
          onBack={() => {
            if (!history.length) setOpenId(null);
            else {
              setOpenId(history.at(-1)!);
              setHistory((items) => items.slice(0, -1));
            }
          }}
          onNavigate={navigate}
          onPlan={onPlan}
          onSpend={onSpend}
          onExpense={onExpense}
        />
      )}
    </section>
  );
}
