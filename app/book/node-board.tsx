"use client";

import { useEffect, useRef, useState, type PointerEvent, type SetStateAction } from "react";
import type { BoardModule, BoardSize, Budget, Expense } from "./model.mjs";
import { money, totals } from "./model.mjs";
import { boardLayout, changeBoard, noteConnections, orderedNodes, resolveNoteLink, type BoardAction } from "./board-model.mjs";
import { renderMarkdownDocument } from "../markdown-render";

const titles: Record<BoardModule, string> = { budget: "Budget & plans", committed: "Committed", paid: "Paid", notes: "Notes & connections" };
const sizes: BoardSize[] = ["compact", "regular", "wide"];

function BoardIcon({ type }: { type: "move" | "shrink" | "grow" | "up" | "down" }) {
  const paths = { move: <><path d="M8 4h8M8 10h8M8 16h8" /><path d="M4 4h.01M4 10h.01M4 16h.01" /></>, shrink: <path d="M3 9h6V3m12 12h-6v6M9 9 3 3m12 12 6 6" />, grow: <path d="M3 9V3h6m6 18h6v-6M3 3l6 6m12 12-6-6" />, up: <path d="m6 14 6-6 6 6" />, down: <path d="m6 10 6 6 6-6" /> };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

export default function NodeBoard({ budget, setBudget, onPlan, onSpend, onExpense, onReport, onBackup, storageError }: {
  budget: Budget;
  setBudget: (next: SetStateAction<Budget>) => boolean;
  onPlan: () => void;
  onSpend: (categoryId?: string) => void;
  onExpense: (expense: Expense) => void;
  onReport: () => void;
  onBackup: () => void;
  storageError: boolean;
}) {
  const layout = boardLayout(budget);
  const summary = totals(budget);
  const connections = noteConnections(budget);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState("");
  const [noteTag, setNoteTag] = useState("");
  const [writing, setWriting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [dragging, setDragging] = useState<BoardModule | null>(null);
  const [dropBefore, setDropBefore] = useState<BoardModule | null | undefined>(undefined);
  const drag = useRef<{ id: BoardModule; startX: number; startY: number; x: number; y: number; active: boolean; before?: BoardModule | null } | null>(null);
  const dragFrame = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [destination, setDestination] = useState<{ id: string; module?: boolean } | null>(null);
  useEffect(() => () => { if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current); }, []);
  useEffect(() => {
    if (dragging) boardRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [dragging]);
  useEffect(() => {
    if (!destination) return;
    const frame = requestAnimationFrame(() => {
      const node = Array.from(boardRef.current?.querySelectorAll<HTMLElement>(destination.module ? "[data-board-module]" : "[data-board-node]") ?? []).find(el => (destination.module ? el.dataset.boardModule : el.dataset.boardNode) === destination.id);
      if (!node) return;
      node.focus({ preventScroll: true });
      node.scrollIntoView({ block: destination.module ? "start" : "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [destination]);
  const selected = budget.categories.find(c => c.id === category);
  const update = (action: BoardAction, text: string) => {
    const saved = setBudget(b => changeBoard(b, action));
    setAnnouncement(saved ? `${text} Layout saved.` : `${text} Not saved. Download a book backup before leaving.`);
  };
  function follow(id: string) {
    setNoteTag("");
    if (!id) {
      setCategory("");
      setAnnouncement("Showing all connections.");
      return;
    }
    const record = resolveNoteLink(budget, id);
    if (!record) return;
    setCategory(record.categoryId);
    update({ type: "reveal", id: record.id }, `Opened ${record.label}. Related nodes are highlighted.`);
    setDestination({ id: record.id });
  }
  function followLink(target: string) {
    const link = resolveNoteLink(budget, target);
    if (link) follow(link.id);
    else setAnnouncement(`No record named “${target}” yet. The note is kept as written.`);
  }
  const matched = (id: string) => category ? id === category : noteTag ? connections.resolved.some(r => r.categoryId === id) : true;
  function moveModule(id: BoardModule, direction: -1 | 1) {
    const index = layout.order.indexOf(id);
    const other = layout.order[index + direction];
    if (!other) return;
    update(direction === -1 ? { type: "move", id, before: other } : { type: "move", id: other, before: id }, `${titles[id]} moved ${direction === -1 ? "earlier" : "later"}.`);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (current.active || Math.hypot(current.x - current.startX, current.y - current.startY) < 8) return;
    current.active = true;
    setDragging(current.id);
    dragFrame.current = requestAnimationFrame(dragTick);
  }
  function dragTick() {
    const current = drag.current;
    if (!current?.active) return;
    const cards = Array.from(boardRef.current?.querySelectorAll<HTMLElement>("[data-board-module]") ?? []);
    const others = cards.filter(el => el.dataset.boardModule !== current.id);
    const boardRect = boardRef.current?.getBoundingClientRect();
    const target = others.reduce<HTMLElement | undefined>((nearest, card) => {
      const distance = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return Math.abs(current.y - (r.top + r.height / 2)); };
      return !nearest || distance(card) < distance(nearest) ? card : nearest;
    }, undefined);
    if (target && boardRect && current.x >= boardRect.left - 44 && current.x <= boardRect.right + 44) {
      const rect = target.getBoundingClientRect();
      const index = others.indexOf(target);
      current.before = current.y > rect.top + rect.height / 2 ? others[index + 1]?.dataset.boardModule as BoardModule ?? null : target.dataset.boardModule as BoardModule;
    } else current.before = undefined;
    setDropBefore(current.before);
    if (current.y > window.innerHeight - 140) window.scrollBy(0, 12);
    else if (current.y < 90) window.scrollBy(0, -12);
    dragFrame.current = requestAnimationFrame(dragTick);
  }
  function pointerEnd(cancelled = false) {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    if (!cancelled && drag.current && drag.current.before !== undefined) {
      update({ type: "move", id: drag.current.id, before: drag.current.before }, `${titles[drag.current.id]} moved.`);
      setDestination({ id: drag.current.id, module: true });
    }
    drag.current = null;
    setDragging(null);
    setDropBefore(undefined);
  }
  function nodeTools(id: string, name: string, rows: { id: string }[]) {
    const index = rows.findIndex(r => r.id === id);
    return editing ? <div className="board-node-tools" aria-label={`Arrange ${name}`}>
      <button disabled={index === 0} aria-label={`Move ${name} up`} onClick={() => update({ type: "node", id, before: rows[index - 1].id }, `${name} moved up.`)}><BoardIcon type="up" /></button>
      <button disabled={index === rows.length - 1} aria-label={`Move ${name} down`} onClick={() => update({ type: "node", id: rows[index + 1].id, before: id }, `${name} moved down.`)}><BoardIcon type="down" /></button>
    </div> : null;
  }
  function expenseNode(e: Expense, rows: Expense[]) {
    const c = budget.categories.find(c => c.id === e.categoryId)!;
    const expanded = layout.expanded.includes(e.id);
    return <article data-board-node={e.id} tabIndex={-1} aria-label={`${e.description} record`} className={`board-node expense-node ${matched(c.id) ? "" : "unrelated"} ${category === c.id ? "connected" : ""}`} key={e.id}>
      <button className="node-summary" aria-expanded={expanded} onClick={() => update({ type: "expand", id: e.id }, `${e.description} ${expanded ? "collapsed" : "expanded"}.`)}>
        <span>{e.description}</span><strong>{money(e.amount)}</strong><span className="node-disclosure" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <button className="node-relationship" aria-label={`Follow ${c.name} from ${e.description}`} onClick={() => follow(c.id)}><span aria-hidden="true">↳</span> {c.name}</button>
      {expanded && <div className="node-details"><p>{e.date} · {e.status === "committed" ? "Still to pay" : e.status === "paid" ? "Already paid" : "An idea, not a commitment"}</p><p className="node-trail">Budget → {c.name} → {e.history.join(" → ")}</p><button className="text-button" onClick={() => onExpense(e)}>Edit entry & history</button></div>}
      {nodeTools(e.id, e.description, rows)}
    </article>;
  }
  const categoryRows = orderedNodes(budget.categories, layout);
  const planned = orderedNodes(budget.expenses.filter(e => e.status === "planned"), layout);
  return <section className={`node-workspace ${editing ? "layout-editing" : ""}`} aria-label="Your connected money board">
    <div className="board-root">
      <div><span>{summary.left < 0 ? "Over budget" : "Left to spend"}</span><strong className={summary.left < 0 ? "negative" : ""}>{money(Math.abs(summary.left))}</strong><span>After paid + committed</span></div>
      <div className="board-root-facts"><span>Budget <b>{money(budget.total)}</b></span><span>Paid <b>{money(summary.spent)}</b></span><span>Committed <b>{money(summary.committed)}</b></span></div>
    </div>
    <div className="board-toolbar">
      <label>Follow a category<select value={category} onChange={e => follow(e.target.value)}><option value="">All connections</option>{budget.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <button className={editing ? "primary" : "secondary"} aria-pressed={editing} onClick={() => setEditing(!editing)}>{editing ? "Done arranging" : "Arrange board"}</button>
      {editing && <button className="text-button" onClick={() => update({ type: "reset" }, "Original layout restored.")}>Reset layout</button>}
    </div>
    {editing ? <p className="board-guidance">Drag a handle to see a short-card overview. Release at the green line, or use the move buttons. Small shows a summary, Medium a preview, Large the full card on your phone.</p> : <p className="board-guidance">Tap a node to open it. Follow a link to open and find its record.</p>}
    {(category || noteTag) && <div className="board-connection-trail"><span>{noteTag ? `Notes tagged #${noteTag}` : `${selected?.name ?? "Category"}: budget → committed → paid`}</span><button className="text-button" onClick={() => { follow(""); setNoteTag(""); }}>Clear focus</button></div>}
    <div className={`money-board ${dragging ? "board-dragging" : ""}`} ref={boardRef}>
      {layout.order.map((id, index) => {
        const size = layout.sizes[id] ?? (id === "notes" ? "wide" : "regular");
        const expenses = orderedNodes(budget.expenses.filter(e => e.status === id), layout);
        const amount = id === "budget" ? budget.total : id === "committed" ? summary.committed : summary.spent;
        const count = id === "budget" ? categoryRows.length : expenses.length;
        const contents = id === "notes" ? "note & connections" : id === "budget" ? `${count} categories${planned.length ? ` + ${planned.length} ideas` : ""}` : `${count} entries`;
        return <section key={id} tabIndex={-1} data-board-module={id} className={`board-module module-${id} size-${size} ${dragging === id ? "is-dragging" : ""} ${dropBefore === id ? "drop-before" : ""} ${dropBefore === null && id === layout.order.filter(value => value !== dragging).at(-1) ? "drop-after" : ""}`} aria-labelledby={`module-${id}`}>
          <header className="board-module-heading"><h2 id={`module-${id}`}>{titles[id]}</h2>{id !== "notes" && <span className="board-module-count">{id === "budget" ? budget.categories.length : expenses.length}</span>}</header>
          {editing && <div className="board-module-tools" aria-label={`Arrange ${titles[id]}`}>
            <button className="board-drag-handle" aria-label={`Drag ${titles[id]}`} onPointerDown={e => { if (!e.isPrimary || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false }; }} onPointerMove={pointerMove} onPointerUp={() => pointerEnd()} onPointerCancel={() => pointerEnd(true)} onLostPointerCapture={() => pointerEnd(true)}><BoardIcon type="move" /></button>
            <button disabled={index === 0} aria-label={`Move ${titles[id]} earlier`} onClick={() => moveModule(id, -1)}><BoardIcon type="up" /></button>
            <button disabled={index === layout.order.length - 1} aria-label={`Move ${titles[id]} later`} onClick={() => moveModule(id, 1)}><BoardIcon type="down" /></button>
            <span className="board-size-label">{size === "regular" ? "Medium" : size === "wide" ? "Large" : "Small"}</span>
            <button disabled={size === "compact"} aria-label={`Shrink ${titles[id]}`} onClick={() => update({ type: "size", id, size: sizes[sizes.indexOf(size) - 1] }, `${titles[id]} made smaller.`)}><BoardIcon type="shrink" /></button>
            <button disabled={size === "wide"} aria-label={`Enlarge ${titles[id]}`} onClick={() => update({ type: "size", id, size: sizes[sizes.indexOf(size) + 1] }, `${titles[id]} made larger.`)}><BoardIcon type="grow" /></button>
          </div>}
          {id !== "notes" && <div className="module-total"><strong>{money(amount)}</strong><span>{id === "budget" ? "Confirmed to work with" : id === "committed" ? "Still to pay · not paid twice" : "Already spent"}</span></div>}
          <p className="module-phone-summary">{id === "notes" ? (budget.notes ? `${connections.resolved.length} linked records · saved note` : "No notes yet") : contents}</p>
          {id === "budget" ? <>
            <p className={`board-plan-balance ${summary.plan > budget.total ? "negative" : ""}`}>{money(Math.abs(budget.total - summary.plan))} {summary.plan > budget.total ? "over-assigned in your plan" : "still to assign to categories"}</p>
            <div className="board-node-list">{categoryRows.map(c => {
              const s = totals(budget, c.id);
              const expanded = layout.expanded.includes(c.id);
              const linked = budget.expenses.filter(e => e.categoryId === c.id);
              return <article key={c.id} data-board-node={c.id} tabIndex={-1} aria-label={`${c.name} category`} className={`board-node category-node ${matched(c.id) ? "" : "unrelated"} ${category === c.id ? "connected" : ""}`}>
                <button className="node-summary" aria-expanded={expanded} onClick={() => update({ type: "expand", id: c.id }, `${c.name} ${expanded ? "collapsed" : "expanded"}.`)}><span>{c.name}</span><strong>{money(c.amount)}</strong><span className="node-disclosure" aria-hidden="true">{expanded ? "−" : "+"}</span></button>
                <div className="board-node-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (s.spent + s.committed) / (c.amount || 1) * 100)}%` }} /></div>
                <button className="node-relationship" onClick={() => follow(c.id)}>{linked.length} linked {linked.length === 1 ? "entry" : "entries"} <span aria-hidden="true">→</span></button>
                {expanded && <div className="node-details"><p className={s.left < 0 ? "negative" : ""}>{money(s.left)} left in this category</p><p>Paid {money(s.spent)} · Committed {money(s.committed)}</p>{c.owner && <p>Owner: {c.owner}</p>}<button className="text-button" onClick={() => onSpend(c.id)}>Add a linked entry</button></div>}
                {nodeTools(c.id, c.name, categoryRows)}
              </article>;
            })}</div>
            {planned.length > 0 && <div className="planned-nodes"><h3>Ideas · not committed</h3><p>These affect your forecast, not your left-to-spend amount.</p>{planned.map(e => expenseNode(e, planned))}</div>}
            <button className="text-button module-action" onClick={onPlan}>Adjust category plan <span aria-hidden="true">→</span></button>
          </> : id === "notes" ? <>
            <div className="board-notes-heading"><p>The why behind the numbers.</p><button className="text-button" onClick={() => setWriting(!writing)}>{writing ? "Read note" : "Edit note"}</button></div>
            {writing ? <label className="board-note-editor">Budget notes<textarea value={budget.notes} placeholder="A decision about [[Home & bills]]… Add #tags or YAML tags." onChange={e => setBudget(b => ({ ...b, notes: e.target.value }))} rows={7} /></label> : <div className="markdown-preview board-note-preview" role="region" aria-label="Budget notes preview">{budget.notes ? renderMarkdownDocument(budget.notes, { onWikilink: followLink, onTag: tag => { setCategory(""); setNoteTag(tag); setAnnouncement(`Showing note connections tagged #${tag}.`); } }) : <p>No note yet. Add the story behind a decision, then link it to a category with [[double brackets]].</p>}</div>}
            {(connections.tags.length > 0 || connections.resolved.length > 0) && <div className="board-note-links" aria-label="Markdown relationships">{connections.tags.map(tag => <button aria-pressed={noteTag === tag} key={tag} onClick={() => { setCategory(""); setNoteTag(noteTag === tag ? "" : tag); }}>#{tag}</button>)}{connections.resolved.map(link => <button key={link.id} onClick={() => follow(link.id)}>↗ {link.label}</button>)}</div>}
            {connections.unresolved.length > 0 && <p className="board-note-unresolved">Not linked yet: {connections.unresolved.join(", ")}. Your note is kept as written.</p>}
            <p className="board-note-save">{storageError ? "Not saved · download a book backup" : "Markdown + YAML · saved on this device"}</p>
          </> : <>
            <div className="board-node-list">{expenses.length ? expenses.map(e => expenseNode(e, expenses)) : <div className="board-empty"><p>{id === "paid" ? "Nothing paid yet." : "No commitments yet."}</p><span>{id === "paid" ? "Paid entries will connect back to their category here." : "Add a bill or promise before you pay it."}</span></div>}</div>
            <button className="text-button module-action" onClick={() => onSpend()}>Log spending <span aria-hidden="true">→</span></button>
          </>}
          {(size === "compact" || (size === "regular" && (count > 2 || id === "notes" || (id === "budget" && planned.length > 0)))) && <button className={`text-button module-expand ${size === "regular" ? "module-expand-medium" : ""}`} onClick={() => update({ type: "size", id, size: "wide" }, `${titles[id]} opened in full.`)}>{id === "notes" ? "Open full note & connections" : `Show all ${contents}`} →</button>}
        </section>;
      })}
    </div>
    <footer className="board-footer"><p>One book. Connected views. Moving a card never moves your money.</p><div><button className="text-button" onClick={onBackup}>Download book backup</button><button className="text-button" onClick={onReport}>Share where you stand →</button></div></footer>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </section>;
}
