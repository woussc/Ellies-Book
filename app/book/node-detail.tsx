"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import { money, totals } from "./model.mjs";
import { noteConnections, resolveNoteLink } from "./board-model.mjs";
import { renderMarkdownDocument } from "../markdown-render";
import type { Budget, Expense } from "./model.mjs";
import type { CanvasNode } from "./canvas-model.mjs";

export default function NodeDetail({
  node,
  budget,
  onClose,
  onBack,
  hasBack,
  onNavigate,
  onPlan,
  onSpend,
  onExpense,
  setBudget,
}: {
  node: CanvasNode;
  budget: Budget;
  onClose: () => void;
  onBack: () => void;
  hasBack: boolean;
  onNavigate: (id: string) => void;
  onPlan: () => void;
  onSpend: (categoryId?: string) => void;
  onExpense: (expense: Expense) => void;
  setBudget: (next: SetStateAction<Budget>) => boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState(node.kind === "notes" ? "Notes" : "Entries");
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(budget.notes);
  const [message, setMessage] = useState("");
  const connections = noteConnections(budget);
  const expense = budget.expenses.find(
    (entry) => node.kind === "expense" && entry.id === node.recordId,
  );
  const category = budget.categories.find(
    (category) => category.id === node.categoryId,
  );
  const summary = totals(
    budget,
    node.kind === "category" ? node.recordId : undefined,
  );
  const amount =
    node.kind === "category" ? (category?.amount ?? 0) : budget.total;
  const entries =
    node.kind === "cluster"
      ? budget.expenses.filter((entry) => entry.status === node.status)
      : node.kind === "category"
        ? budget.expenses.filter((entry) => entry.categoryId === node.recordId)
        : budget.expenses;
  const title = node.kind === "budget" ? budget.name : node.title;
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  function follow(target: string) {
    if (!canLeave()) return;
    const record = resolveNoteLink(budget, target);
    if (!record) {
      setMessage(
        `No record named “${target}” yet. Your note is kept as written.`,
      );
      return;
    }
    onNavigate(
      `${budget.categories.some((c) => c.id === record.id) ? "category" : "entry"}:${record.id}`,
    );
  }
  function canLeave() {
    return (
      !editing ||
      note === budget.notes ||
      window.confirm("Discard these unsaved note edits?")
    );
  }
  function leave(action: () => void) {
    if (canLeave()) action();
  }
  return (
    <dialog
      ref={dialog}
      className="node-detail"
      aria-labelledby="node-detail-title"
      onCancel={(e) => {
        e.preventDefault();
        leave(onClose);
      }}
    >
      <header className="detail-top">
        <div>
          <strong>
            {node.kind === "expense"
              ? "Entry"
              : node.kind === "budget"
                ? "Project budget"
                : node.kind === "category"
                  ? "Category"
                  : node.kind === "balance"
                    ? "Budget summary"
                    : node.kind === "cluster"
                      ? "Lifecycle cluster"
                      : "Note"}{" "}
            details
          </strong>
          <small>
            {budget.name} / {budget.period}
          </small>
        </div>
        <button className="outline-button" onClick={() => leave(onClose)}>
          Close ×
        </button>
      </header>
      <div className="detail-body">
        <button
          className="outline-button detail-back"
          onClick={() => leave(onBack)}
        >
          {hasBack ? "← Back" : "← Back to board"}
        </button>
        <p className="eyebrow">{expense?.status ?? node.status ?? node.kind}</p>
        <h1 id="node-detail-title">{title}</h1>
        {expense ? (
          <>
            <p className="detail-entry-amount">{money(expense.amount)}</p>
            <dl className="entry-facts">
              <div>
                <dt>Category</dt>
                <dd>
                  <button
                    className="outline-button"
                    onClick={() =>
                      leave(() => onNavigate(`category:${expense.categoryId}`))
                    }
                  >
                    {category?.name} ↗
                  </button>
                </dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{expense.date}</dd>
              </div>
              <div>
                <dt>Lifecycle</dt>
                <dd>{expense.history.join(" → ")}</dd>
              </div>
            </dl>
            <p className="hint">
              {expense.status === "planned"
                ? "A planned idea affects forecast, not your money left to commit."
                : expense.status === "committed"
                  ? "Still to pay. This reduces what is available to commit."
                  : "Paid once. This is not also counted as an open commitment."}
            </p>
            <button
              className="primary"
              onClick={() => leave(() => onExpense(expense))}
            >
              Edit this entry
            </button>
          </>
        ) : (
          node.kind !== "notes" && (
            <>
              <p
                className={`detail-entry-amount${summary.left < 0 ? " negative" : ""}`}
              >
                {money(
                  node.kind === "cluster"
                    ? node.status === "paid"
                      ? summary.spent
                      : summary.committed
                    : summary.left,
                )}{" "}
                <span>
                  {node.kind === "cluster"
                    ? node.status === "paid"
                      ? "paid"
                      : "still to pay"
                    : "left to commit"}
                </span>
              </p>
              <dl className="detail-metrics">
                <div>
                  <dt>{node.kind === "category" ? "Allocation" : "Budget"}</dt>
                  <dd>{money(amount)}</dd>
                </div>
                <div>
                  <dt>Committed</dt>
                  <dd>{money(summary.committed)}</dd>
                </div>
                <div>
                  <dt>Paid</dt>
                  <dd>{money(summary.spent)}</dd>
                </div>
              </dl>
              <div className="detail-actions">
                <button
                  className="primary"
                  onClick={() =>
                    leave(() =>
                      onSpend(
                        node.kind === "category" ? node.recordId : undefined,
                      ),
                    )
                  }
                >
                  + Add entry
                </button>
                <button className="secondary" onClick={() => leave(onPlan)}>
                  Edit plan
                </button>
              </div>
            </>
          )
        )}
        <div className="detail-tabs" role="group" aria-label="Detail views">
          {["Entries", "Notes", "Activity"].map((item) => (
            <button
              key={item}
              className="outline-button"
              aria-pressed={tab === item}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {tab === "Entries" && (
          <section aria-label="Entries">
            <h2>
              {node.kind === "cluster"
                ? `${node.title} entries`
                : node.kind === "category"
                  ? "In this category"
                  : "Project entries"}
            </h2>
            {!entries.length ? (
              <p>No entries yet. Your plan has room to grow.</p>
            ) : (
              <div className="detail-entries">
                {entries.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <h3>{entry.description}</h3>
                      <small>
                        {entry.status} · {entry.date}
                      </small>
                    </div>
                    <strong>{money(entry.amount)}</strong>
                    <button
                      className="outline-button"
                      aria-label={`Open ${entry.description}`}
                      onClick={() =>
                        leave(() => onNavigate(`entry:${entry.id}`))
                      }
                    >
                      Open ↗
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "Notes" && (
          <section aria-label="Project notes">
            <div className="detail-section-heading">
              <h2>Project notes</h2>
              {!editing && (
                <button
                  className="outline-button"
                  onClick={() => {
                    setNote(budget.notes);
                    setEditing(true);
                  }}
                >
                  Edit notes
                </button>
              )}
            </div>
            <p className="hint">
              One shared Markdown note for this project. Use [[Category name]]
              or [[entry ID]] to connect it to a node.
            </p>
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const saved = setBudget((b) => ({
                    ...b,
                    notes: note,
                    events: [
                      ...b.events,
                      {
                        text: "Project notes updated",
                        at: new Date().toISOString(),
                      },
                    ],
                  }));
                  setEditing(false);
                  setMessage(
                    saved
                      ? "Notes saved."
                      : "Notes are on this page only. Download all books before leaving.",
                  );
                }}
              >
                <label>
                  Markdown notes
                  <textarea
                    rows={10}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <div className="detail-actions">
                  <button className="primary">Save notes</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="markdown-preview detail-markdown">
                {budget.notes ? (
                  renderMarkdownDocument(budget.notes, {
                    onWikilink: follow,
                    onTag: (tag) =>
                      setMessage(
                        `#${tag} connects this project note to ${connections.resolved.length} linked records.`,
                      ),
                  })
                ) : (
                  <p>No note yet. Add the story behind a decision.</p>
                )}
              </div>
            )}
            {!!connections.resolved.length && (
              <div className="detail-linked">
                <h3>Connected records</h3>
                {connections.resolved.map((record) => (
                  <button
                    className="outline-button"
                    key={record.id}
                    onClick={() => follow(record.id)}
                  >
                    {record.label} ↗
                  </button>
                ))}
              </div>
            )}
            {!!connections.unresolved.length && (
              <p className="hint">
                Not linked yet: {connections.unresolved.join(", ")}. Your note
                is kept as written.
              </p>
            )}
          </section>
        )}
        {tab === "Activity" && (
          <section className="detail-activity" aria-label="Project activity">
            <h2>Project activity</h2>
            <p className="hint">
              Includes changes across this project. Layout changes are separate.
            </p>
            {budget.events.length ? (
              [...budget.events].reverse().map((event, i) => (
                <article key={i}>
                  <p>{event.text}</p>
                  <small>{new Date(event.at).toLocaleString()}</small>
                </article>
              ))
            ) : (
              <p>No changes recorded yet.</p>
            )}
          </section>
        )}
        <p role="status">{message}</p>
      </div>
    </dialog>
  );
}
