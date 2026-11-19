"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import {
  advanceExpense,
  blankBudget,
  csvText,
  editCategory,
  editBudgetDetails,
  exampleBudget,
  localDate,
  money,
  profiles,
  parseBook,
  serializeBook,
  reportText,
  round,
  totals,
} from "./model.mjs";
import { useBook } from "./use-book";
import { renderMarkdownDocument } from "../markdown-render";
import type { Budget, Category, Expense, Profile } from "./model.mjs";
type Page = "start" | "plan" | "spend" | "home" | "report";
type ToastKind = "success" | "error" | "info";
const pages: { id: Page; label: string; short: string; icon: string }[] = [
  { id: "start", label: "My budget", short: "Budget", icon: "book" },
  { id: "plan", label: "Plan by category", short: "Plan", icon: "plan" },
  { id: "spend", label: "Log spending", short: "Log", icon: "plus" },
  { id: "home", label: "Where I stand", short: "Overview", icon: "home" },
  { id: "report", label: "Share a report", short: "Share", icon: "share" },
];
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    book: (
      <>
        <path d="M12 5C8 2 4 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-7-2-10 1v15" />
        <path d="m16 9 2 2 3-4" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7" />
      </>
    ),
    plan: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h4M8 16h7" />
      </>
    ),
    plus: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8m-4-4h8" />
      </>
    ),
    share: (
      <>
        <path d="M12 15V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
      </>
    ),
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    error: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6m0 3h.01" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7h.01M12 11v6" />
      </>
    ),
    leaf: (
      <>
        <path d="M19 3C8 2 2 9 6 16s15 3 13-13Z" />
        <path d="M4 21 15 8" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    flow: (
      <>
        <rect x="8" y="2" width="8" height="5" rx="1" />
        <rect x="1" y="17" width="8" height="5" rx="1" />
        <rect x="15" y="17" width="8" height="5" rx="1" />
        <path d="M12 7v5M5 17v-5h14v5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.plan}
    </svg>
  );
}
function download(content: string, name: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function CategoryInput({
  onCommit,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "onKeyDown"
> & { onCommit: (value: string) => void }) {
  // Keep the in-progress text in the field; only a finished edit reaches the
  // saved book and audit trail. The caller keys by saved value for restores.
  return (
    <input
      {...props}
      onBlur={(event) => onCommit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
export default function BudgetApp() {
  const { budget, setBudget, removeExample, status, error, legacy, recovery } =
    useBook();
  const [activePage, setPage] = useState<Page | null>(null);
  const page = activePage ?? (budget.created ? "home" : "start");
  const [toast, setToast] = useState<{ text: string; kind: ToastKind } | null>(null);
  const storageError = status === "error";
  const [view, setView] = useState("categories");
  const [focus, setFocus] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [draft, setDraft] = useState({
    description: "",
    amount: "",
    categoryId: "",
    status: "paid",
    date: localDate(),
  });
  const [showNote, setShowNote] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const followedCategory =
    budget.categories.find((category) => category.id === focus) ?? budget.categories[0];
  const t = totals(budget);
  const allocated = budget.categories.reduce((s, c) => s + c.amount, 0);
  const unassigned = round(budget.total - allocated);
  const notify = (text: string, kind: ToastKind = "success") =>
    setToast({ text, kind });
  useEffect(() => {
    if (!toast) return;
    if (toast.kind === "error") return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  function change(next: Budget, action: string) {
    return setBudget({
      ...next,
      events: [...next.events, { text: action, at: new Date().toISOString() }],
    });
  }
  function go(next: Page) {
    setPage(next);
    window.scrollTo({ top: 0 });
    setTimeout(() => titleRef.current?.focus(), 0);
  }
  function updateCategory(id: string, patch: Partial<Category>) {
    setBudget((b) => editCategory(b, id, patch));
  }
  function create(
    details: Pick<Budget, "name" | "total" | "profile" | "period">,
  ) {
    const saved = setBudget(editBudgetDetails(budget, details));
    notify(
      saved
        ? "Budget details saved. Let’s give it a plan."
        : "Budget details are not saved. Download a book backup before leaving.",
      saved ? "success" : "error",
    );
    go("plan");
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Choose an Ellie’s Book backup smaller than 5 MB.");
      const restored = parseBook(await file.text());
      if (
        (budget.created || recovery) &&
        !window.confirm(
          "Restore this book in place of the current one? Download a backup first if you want to keep both.",
        )
      )
        return;
      const saved = setBudget(restored, true);
      go(restored.created ? "home" : "start");
      notify(
        saved
          ? "Book opened. Check the save status before leaving."
          : "Book opened on this page only. Download a book backup before leaving.",
        saved ? "success" : "error",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not open this backup.",
        "error",
      );
    }
  }
  const backup = () => download(serializeBook(budget), "ellies-book.md");
  function addExpense(e: FormEvent) {
    e.preventDefault();
    const amount = round(draft.amount);
    if (!(amount > 0)) return;
    const categoryId = budget.categories.some((c) => c.id === draft.categoryId)
      ? draft.categoryId
      : budget.categories[0]?.id;
    if (!categoryId) return;
    const expense: Expense = {
      ...draft,
      categoryId,
      status: draft.status as Expense["status"],
      amount,
      id: crypto.randomUUID(),
      history: [draft.status],
    };
    const saved = change(
      { ...budget, expenses: [...budget.expenses, expense] },
      `Added ${expense.description} · ${expense.status} · ${money(amount)}`,
    );
    setDraft({ ...draft, description: "", amount: "" });
    notify(
      saved
        ? `${expense.description} saved as ${expense.status}.`
        : `${expense.description} added on this page only. Download a book backup before leaving.`,
      saved ? "success" : "error",
    );
  }
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: budget.name, text: reportText(budget) });
        notify("Report shared.");
      } else {
        await navigator.clipboard.writeText(reportText(budget));
        notify("Report copied. Paste it into a message or email.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        download(reportText(budget), "budget-report.md");
        notify("Your report was downloaded instead.");
      }
    }
  }
  const header = (title: string, subtitle: string, action?: ReactNode) => (
    <header className="page-heading">
      <div>
        <h1 tabIndex={-1} ref={titleRef}>
          {title}
        </h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>
  );
  const needsBudget = !budget.created && page !== "start";
  return (
    <div className="app-shell" inert={status === "loading" ? true : undefined}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => go(budget.created ? "home" : "start")}
        >
          <Icon name="book" size={34} />
          <span>
            ellie’s book<span>A little more clarity.</span>
          </span>
        </button>
        <div className="workspace">
          <span className="workspace-mark">
            {budget.profile === "Team"
              ? "T"
              : budget.profile === "Just me"
                ? "M"
                : "H"}
          </span>
          <div>
            <strong>{budget.name || "Your next chapter"}</strong>
            <span>{budget.profile} budget</span>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {pages.map((p) => (
            <button
              key={p.id}
              className={page === p.id ? "nav-item active" : "nav-item"}
              aria-current={page === p.id ? "page" : undefined}
              onClick={() => go(p.id)}
            >
              <Icon name={p.icon} />
              <span>{p.label}</span>
              {page === p.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Icon name="leaf" size={28} />
          <p>
            Make room for
            <br />
            <em>what matters.</em>
          </p>
          <span>Your budget. Your pace.</span>
          <small>
            Saved only in this browser.
            <br />
            No bank account connected.
          </small>
        </div>
      </aside>
      <div className="main-column">
        <div className="topbar">
          <span className="mobile-brand">
            <Icon name="book" size={25} />
            ellie’s book
          </span>
          <span className="desktop-crumb">
            Your money, a little clearer <span>/</span>{" "}
            {pages.find((p) => p.id === page)?.label}
          </span>
          <span className="save-status">
            <span />
            {status === "loading"
              ? "Opening book…"
              : storageError
                ? "Not saved"
                : "Saved on this device"}
          </span>
        </div>
        <main id="main" tabIndex={-1}>
          {budget.sample && (
            <div className="sample-banner">
              <span>
                You’re exploring an example. It’s not your real budget.
              </span>
              <button
                onClick={() => {
                  try {
                    const personal = removeExample();
                    go(personal.created ? "home" : "start");
                    notify(
                      "Example removed. Your own budget is right where you left it.",
                    );
                  } catch {
                    notify(
                      "Could not open your own book. Keep the saved copy before restoring a backup.",
                      "error",
                    );
                  }
                }}
              >
                Remove example <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {storageError && (
            <div className="error" role="alert">
              <p>{error}</p>
              <button className="text-button" onClick={backup}>
                Download current book
              </button>
              {recovery && (
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      recovery,
                      "ellies-book-saved-copy.json",
                      "application/json",
                    )
                  }
                >
                  Download saved copy
                </button>
              )}
            </div>
          )}
          {needsBudget ? (
            <>
              {header(
                "A fresh start, just for you.",
                "Create your budget first. Everything else follows from there.",
              )}
              <button className="primary" onClick={() => go("start")}>
                Start my budget <Icon name="arrow" />
              </button>
            </>
          ) : (
            <>
              {page === "start" && (
                <>
                  {header(
                    budget.created
                      ? "Make it your own."
                      : "Good things start with a plan.",
                    budget.created
                      ? "Your budget can change as life does."
                      : "A home for your money. A little space to breathe.",
                  )}
                  {legacy && (
                    <div className="legacy-notice">
                      <p>
                        Your earlier Function Budget Studio data is still on
                        this device. It stays unchanged while you start your new
                        book.
                      </p>
                      <button
                        className="text-button"
                        onClick={() =>
                          download(
                            legacy,
                            "ellies-book-earlier-data.json",
                            "application/json",
                          )
                        }
                      >
                        Download earlier data <Icon name="download" size={16} />
                      </button>
                    </div>
                  )}
                  <div className="start-grid">
                    <BudgetForm
                      key={budget.id}
                      initialBudget={budget}
                      onSave={create}
                    />
                    <aside className="start-aside">
                      <div className="intro-note">
                        <div className="book-art" aria-hidden="true">
                          <Icon name="book" size={82} />
                          <span className="book-flower">
                            <Icon name="leaf" size={32} />
                          </span>
                        </div>
                        <h2>
                          Life beyond
                          <br />spreadsheets.
                        </h2>
                        <p>
                          Set a little aside for the everyday.
                          <br />
                          Make room for the someday.
                          <br />
                          Keep it all in one place.
                        </p>
                        <div className="small-rule" />
                        <p className="note-foot">
                          Start simple.
                          <br />
                          The details can come later.
                        </p>
                      </div>
                      <div className="example-choice">
                        <div>
                          <strong>Want to look around first?</strong>
                          <p>Try a household example. Remove it anytime.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            if (!setBudget(exampleBudget())) {
                              notify(
                                "Could not open the example. Keep this page open and download a book backup before leaving.",
                                "error",
                              );
                              return;
                            }
                            go("home");
                            notify(
                              "Example loaded. You can remove it at the top.",
                            );
                          }}
                        >
                          Explore an example <Icon name="arrow" size={18} />
                        </button>
                      </div>
                    </aside>
                  </div>
                  <details className="book-backup">
                    <summary>Keep a copy of your book</summary>
                    <p>
                      Download a Markdown backup to keep your categories,
                      spending, notes and activity together. Restore it on
                      another device or in this browser.
                    </p>
                    <button className="secondary" onClick={backup}>
                      Download book backup <Icon name="download" size={18} />
                    </button>
                    <label className="restore-book">
                      Restore a book (.md)
                      <input
                        type="file"
                        accept=".md,text/markdown"
                        onChange={(e) => {
                          void restore(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </details>
                </>
              )}
              {page === "plan" && (
                <>
                  {header(
                    "A place for every plan.",
                    "Give each category one amount. You can adjust it anytime.",
                  )}
                  <div className="content-grid">
                    <section className="paper plan-paper">
                      <div className="section-heading">
                        <h2>Your categories</h2>
                        <span>{budget.period}</span>
                      </div>
                      <div className="plan-col-head">
                        <span>What’s it for?</span>
                        <span>Planned amount</span>
                      </div>
                      {budget.categories.map((c, i) => (
                        <div className="category-editor" key={c.id}>
                          <div className="category-main">
                            <span className="category-symbol">
                              <Icon
                                name={
                                  i === 0 ? "home" : i === 3 ? "leaf" : "plan"
                                }
                                size={22}
                              />
                            </span>
                            <label
                              className="category-name"
                              htmlFor={`category-name-${c.id}`}
                            >
                              <span className="sr-only">
                                Category name {i + 1}
                              </span>
                              <CategoryInput
                                id={`category-name-${c.id}`}
                                key={c.name}
                                required
                                maxLength={50}
                                aria-label={`Category name ${i + 1}`}
                                defaultValue={c.name}
                                onCommit={(name) =>
                                  updateCategory(c.id, { name })
                                }
                              />
                            </label>
                            <label
                              className="amount-field"
                              htmlFor={`category-amount-${c.id}`}
                            >
                              <span>$</span>
                              <CategoryInput
                                id={`category-amount-${c.id}`}
                                key={c.amount}
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="1000000000"
                                step="0.01"
                                aria-label={`${c.name} planned amount`}
                                defaultValue={c.amount || ""}
                                placeholder="0"
                                onCommit={(value) =>
                                  updateCategory(c.id, {
                                    amount: Math.max(0, round(value)),
                                  })
                                }
                              />
                            </label>
                            <button
                              className="icon-button"
                              aria-label={`Remove ${c.name}`}
                              disabled={budget.expenses.some(
                                (e) => e.categoryId === c.id,
                              )}
                              title={
                                budget.expenses.some(
                                  (e) => e.categoryId === c.id,
                                )
                                  ? "This category has spending and cannot be removed."
                                  : "Remove category"
                              }
                              onClick={() =>
                                change({
                                  ...budget,
                                  categories: budget.categories.filter(
                                    (item) => item.id !== c.id,
                                  ),
                                }, `Removed category ${c.name} · ${money(c.amount)} planned`)
                              }
                            >
                              <Icon name="close" size={17} />
                            </button>
                          </div>
                          <details className="advanced">
                            <summary>Advanced</summary>
                            <div className="form-pair">
                              <label
                                className="field"
                                htmlFor={`category-owner-${c.id}`}
                              >
                                Owner / vendor
                                <CategoryInput
                                  id={`category-owner-${c.id}`}
                                  key={c.owner}
                                  defaultValue={c.owner}
                                  onCommit={(owner) =>
                                    updateCategory(c.id, {
                                      owner,
                                    })
                                  }
                                  placeholder="Optional"
                                />
                              </label>
                              <label
                                className="field"
                                htmlFor={`category-code-${c.id}`}
                              >
                                Finance code
                                <CategoryInput
                                  id={`category-code-${c.id}`}
                                  key={c.glCode}
                                  defaultValue={c.glCode}
                                  onCommit={(glCode) =>
                                    updateCategory(c.id, {
                                      glCode,
                                    })
                                  }
                                  placeholder="e.g. 001230"
                                />
                              </label>
                            </div>
                            <p className="hint">
                              Use these optional details to make the category
                              easier to trace. Finance codes keep leading zeros.
                            </p>
                          </details>
                        </div>
                      ))}
                      <form
                        className="add-category"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!newCategory.trim()) return;
                          change({
                            ...budget,
                            categories: [
                              ...budget.categories,
                              {
                                id: crypto.randomUUID(),
                                name: newCategory.trim(),
                                amount: 0,
                                owner: "",
                                glCode: "",
                              },
                            ],
                          }, `Added category ${newCategory.trim()}`);
                          setNewCategory("");
                        }}
                      >
                        <input
                          aria-label="New category name"
                          maxLength={50}
                          placeholder="A new category…"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                        />
                        <button type="submit" className="text-button">
                          <Icon name="plus" size={19} />
                          Add category
                        </button>
                      </form>
                      <div className="plan-total">
                        <span>Total planned</span>
                        <strong>{money(allocated)}</strong>
                      </div>
                      <button
                        className="primary"
                        onClick={() => {
                          const saved = change(budget, "Confirmed category plan");
                          notify(
                            saved
                              ? "Your category plan is saved."
                              : "Your plan is not saved. Download a book backup before leaving.",
                            saved ? "success" : "error",
                          );
                          go("home");
                        }}
                      >
                        Save my plan
                        <Icon name="check" size={19} />
                      </button>
                    </section>
                    <aside className="summary-aside">
                      <h2>A little breathing room.</h2>
                      <p>Your total budget</p>
                      <strong className="aside-total">
                        {money(budget.total)}
                      </strong>
                      <div className="budget-track">
                        <span
                          style={{
                            width: `${Math.min(100, (allocated / (budget.total || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="split-line">
                        <span>Planned so far</span>
                        <strong>{money(allocated)}</strong>
                      </div>
                      <div
                        className={`split-line ${unassigned < 0 ? "negative" : ""}`}
                      >
                        <span>
                          {unassigned < 0
                            ? "Over your budget"
                            : "Still to give a home"}
                        </span>
                        <strong>{money(Math.abs(unassigned))}</strong>
                      </div>
                      <p className="aside-tip">
                        {unassigned < 0
                          ? "Your plan is higher than your total. Trim a category or update your budget before you spend."
                          : "You don’t have to plan it all. A little unassigned is a good cushion."}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => go("start")}
                      >
                        Edit total budget <Icon name="arrow" size={17} />
                      </button>
                    </aside>
                  </div>
                </>
              )}
              {page === "spend" && (
                <>
                  {header(
                    "The little things add up.",
                    "An idea, a bill, or a payment. Keep it all in one simple place.",
                  )}
                  <div className="content-grid spend-grid">
                    <form className="paper spending-form" onSubmit={addExpense}>
                      <h2>Log spending</h2>
                      <label className="field">
                        What’s it for?
                        <input
                          required
                          maxLength={100}
                          placeholder="e.g. Weekly grocery shop"
                          value={draft.description}
                          onChange={(e) =>
                            setDraft({ ...draft, description: e.target.value })
                          }
                        />
                      </label>
                      <div className="form-pair">
                        <label className="field">
                          Amount
                          <span className="input-wrap">
                            <span>$</span>
                            <input
                              aria-label="Spending amount"
                              type="number"
                              min="0.01"
                              max="1000000000"
                              step="0.01"
                              inputMode="decimal"
                              required
                              placeholder="0.00"
                              value={draft.amount}
                              onChange={(e) =>
                                setDraft({ ...draft, amount: e.target.value })
                              }
                            />
                            <small>USD</small>
                          </span>
                        </label>
                        <label className="field">
                          Category
                          <select
                            required
                            value={
                              draft.categoryId || budget.categories[0]?.id || ""
                            }
                            onChange={(e) =>
                              setDraft({ ...draft, categoryId: e.target.value })
                            }
                          >
                            {budget.categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <fieldset className="status-field">
                        <legend>Where is it at?</legend>
                        {[
                          {
                            id: "planned",
                            title: "Planned",
                            desc: "Just an idea. No money committed.",
                          },
                          {
                            id: "committed",
                            title: "Committed",
                            desc: "Agreed or billed, but not paid yet.",
                          },
                          {
                            id: "paid",
                            title: "Paid",
                            desc: "Money has left your account.",
                          },
                        ].map((s) => (
                          <label
                            key={s.id}
                            className={
                              draft.status === s.id
                                ? "status-option selected"
                                : "status-option"
                            }
                          >
                            <input
                              type="radio"
                              name="status"
                              value={s.id}
                              checked={draft.status === s.id}
                              onChange={() =>
                                setDraft({ ...draft, status: s.id })
                              }
                            />
                            <span>
                              <strong>{s.title}</strong>
                              <small>{s.desc}</small>
                            </span>
                            {draft.status === s.id && (
                              <Icon name="check" size={19} />
                            )}
                          </label>
                        ))}
                      </fieldset>
                      <label className="field date-field">
                        Date
                        <input
                          type="date"
                          required
                          value={draft.date}
                          onChange={(e) =>
                            setDraft({ ...draft, date: e.target.value })
                          }
                        />
                      </label>
                      {!budget.categories.length && (
                        <p className="error">
                          Add a category in your plan before logging spending.
                        </p>
                      )}
                      <button
                        className="primary full"
                        disabled={!budget.categories.length}
                        type="submit"
                      >
                        Save spending <Icon name="check" size={19} />
                      </button>
                    </form>
                    <section className="recent-spending">
                      <div className="section-heading">
                        <h2>In your book</h2>
                        <span>
                          {budget.expenses.length}{" "}
                          {budget.expenses.length === 1 ? "entry" : "entries"}
                        </span>
                      </div>
                      {!budget.expenses.length ? (
                        <div className="empty-state">
                          <Icon name="book" size={40} />
                          <h3>Your first entry starts here.</h3>
                          <p>
                            Big purchases, small coffees, future plans. They all
                            belong.
                          </p>
                        </div>
                      ) : (
                        [...budget.expenses].reverse().map((e) => (
                          <article className="expense-row" key={e.id}>
                            <div className="expense-top">
                              <strong>{e.description}</strong>
                              <strong>{money(e.amount)}</strong>
                            </div>
                            <div className="expense-meta">
                              <span>
                                {
                                  budget.categories.find(
                                    (c) => c.id === e.categoryId,
                                  )?.name
                                }{" "}
                                · {e.date.slice(5).replace("-", "/")}
                              </span>
                              <span className={`status-label ${e.status}`}>
                                {e.status}
                              </span>
                            </div>
                            {e.status !== "paid" && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  const saved = change(
                                    advanceExpense(budget, e.id),
                                    `${e.description} marked ${e.status === "planned" ? "committed" : "paid"}`,
                                  );
                                  notify(
                                    saved
                                      ? "Updated. Your totals now reflect the new status."
                                      : "Updated on this page only. Download a book backup before leaving.",
                                    saved ? "success" : "error",
                                  );
                                }}
                              >
                                {e.status === "planned"
                                  ? "Mark as committed"
                                  : "Mark as paid"}
                                <Icon name="arrow" size={15} />
                              </button>
                            )}
                          </article>
                        ))
                      )}
                      <p className="hint recent-hint">
                        Only paid entries count as spent. A bill stays “still to
                        pay” until you mark it paid.
                      </p>
                    </section>
                  </div>
                </>
              )}
              {page === "home" && (
                <>
                  {header(
                    "Room for what matters.",
                    `${budget.name} · ${budget.period}`,
                    <button
                      className="primary heading-action"
                      onClick={() => go("spend")}
                    >
                      <Icon name="plus" size={19} />
                      Log spending
                    </button>,
                  )}
                  <section className="overview-summary">
                    <div className="left-amount">
                      <span>
                        {t.left < 0 ? "Over budget" : "Left to spend"}
                      </span>
                      <strong className={t.left < 0 ? "negative" : ""}>
                        {money(Math.abs(t.left))}
                        <span>USD</span>
                      </strong>
                      <p>After what you’ve paid and what’s still to pay.</p>
                    </div>
                    <div className="overview-numbers">
                      <div>
                        <span>Total budget</span>
                        <strong>{money(budget.total)}</strong>
                      </div>
                      <div>
                        <span>Planned</span>
                        <strong>{money(t.plan)}</strong>
                      </div>
                      <div>
                        <span>
                          Spent <small>· paid</small>
                        </span>
                        <strong>{money(t.spent)}</strong>
                      </div>
                      <div>
                        <span>Still to pay</span>
                        <strong>{money(t.committed)}</strong>
                      </div>
                    </div>
                  </section>
                  <div className="overview-grid">
                    <section className="paper category-overview">
                      <div className="section-heading">
                        <h2>Your money, at a glance</h2>
                        <button
                          className="text-button"
                          onClick={() => go("plan")}
                        >
                          Edit plan <Icon name="arrow" size={16} />
                        </button>
                      </div>
                      <div className="segmented" aria-label="Overview view">
                        <button
                          aria-pressed={view === "categories"}
                          className={view === "categories" ? "selected" : ""}
                          onClick={() => setView("categories")}
                        >
                          <Icon name="plan" size={17} />
                          By category
                        </button>
                        <button
                          aria-pressed={view === "flow"}
                          className={view === "flow" ? "selected" : ""}
                          onClick={() => setView("flow")}
                        >
                          <Icon name="flow" size={18} />
                          Money flow
                        </button>
                      </div>
                      {view === "categories" ? (
                        <div className="category-list">
                          {budget.categories.map((c) => {
                            const s = totals(budget, c.id);
                            return (
                              <article key={c.id} className="category-budget">
                                <div className="category-budget-head">
                                  <strong>{c.name}</strong>
                                  <span
                                    className={s.left < 0 ? "negative" : ""}
                                  >
                                    {money(s.left)} left
                                  </span>
                                </div>
                                <div className="category-track">
                                  <span
                                    className="paid-fill"
                                    style={{
                                      width: `${Math.min(100, (s.spent / (c.amount || 1)) * 100)}%`,
                                    }}
                                  />
                                  <span
                                    className="committed-fill"
                                    style={{
                                      width: `${Math.min(Math.max(0, 100 - (s.spent / (c.amount || 1)) * 100), (s.committed / (c.amount || 1)) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <div className="category-values">
                                  <span>
                                    Planned <strong>{money(c.amount)}</strong>
                                  </span>
                                  <span>
                                    Spent <strong>{money(s.spent)}</strong>
                                  </span>
                                  <span>
                                    Still to pay{" "}
                                    <strong>{money(s.committed)}</strong>
                                  </span>
                                </div>
                              </article>
                            );
                          })}
                          <div className="chart-key">
                            <span>
                              <i className="paid-key" />
                              Paid
                            </span>
                            <span>
                              <i className="committed-key" />
                              Still to pay
                            </span>
                            <span>
                              <i />
                              Available
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="money-flow">
                          <label className="field">
                            Follow a category
                            <select
                              value={followedCategory?.id ?? ""}
                              onChange={(e) => setFocus(e.target.value)}
                            >
                              {budget.categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flow-root">
                            <Icon name="book" size={22} />
                            <div>
                              <small>Budget</small>
                              <strong>{budget.name}</strong>
                            </div>
                            <b>{money(budget.total)}</b>
                          </div>
                          <div className="flow-branch">
                            <span className="edge-label">contains</span>
                            {budget.categories
                              .filter(
                                (c) =>
                                  c.id === followedCategory?.id,
                              )
                              .map((c) => (
                                <div key={c.id}>
                                  <div className="flow-category">
                                    <span>
                                      <small>Category plan</small>
                                      <strong>{c.name}</strong>
                                    </span>
                                    <b>{money(c.amount)}</b>
                                  </div>
                                  <div className="flow-expenses">
                                    {budget.expenses
                                      .filter((e) => e.categoryId === c.id)
                                      .map((e) => (
                                        <div className="flow-leaf" key={e.id}>
                                          <span className="edge-label">
                                            {e.history.length > 1
                                              ? e.history.join(" → ")
                                              : "attributed to"}
                                          </span>
                                          <div>
                                            <span>
                                              <strong>{e.description}</strong>
                                              <small>
                                                {e.status === "committed"
                                                  ? "Invoice · unpaid"
                                                  : e.status === "paid"
                                                    ? "Actual · paid"
                                                    : "Purchase item · planned"}
                                              </small>
                                            </span>
                                            <b>{money(e.amount)}</b>
                                          </div>
                                        </div>
                                      ))}
                                    {!budget.expenses.some(
                                      (e) => e.categoryId === c.id,
                                    ) && (
                                      <p className="hint">
                                        No spending here yet. Your plan is
                                        ready.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                          <p className="hint">
                            One connected trail, the same numbers. Paid entries
                            replace unpaid commitments — they’re never counted
                            twice.
                          </p>
                        </div>
                      )}
                    </section>
                    <aside className="overview-aside">
                      <section className="notes-panel">
                        <div className="section-heading">
                          <h2>A note for later</h2>
                          <Icon name="leaf" size={22} />
                        </div>
                        <p>The why behind the numbers.</p>
                        {!showNote && (
                          <>
                            <label className="sr-only" htmlFor="budget-note">
                              Budget notes
                            </label>
                            <textarea
                              id="budget-note"
                              placeholder="A reminder, an intention, a decision…"
                              value={budget.notes}
                              onChange={(e) =>
                                setBudget({ ...budget, notes: e.target.value })
                              }
                              rows={7}
                            />
                          </>
                        )}
                        {showNote && (
                          <div
                            className="markdown-preview"
                            role="region"
                            aria-label="Budget notes preview"
                          >
                            {budget.notes ? (
                              renderMarkdownDocument(budget.notes, {
                                onWikilink: (target) => {
                                  const category = budget.categories.find(
                                    (c) =>
                                      c.id === target ||
                                      c.name.toLowerCase() ===
                                        target.toLowerCase(),
                                  );
                                  const expense = budget.expenses.find(
                                    (e) =>
                                      e.id === target ||
                                      e.description.toLowerCase() ===
                                        target.toLowerCase(),
                                  );
                                  if (category || expense) {
                                    setFocus(
                                      category?.id ?? expense!.categoryId,
                                    );
                                    setView("flow");
                                  } else
                                    notify(
                                      `No category or spending entry named “${target}” yet.`,
                                      "info",
                                    );
                                },
                                onTag: (tag) =>
                                  notify(`This note is tagged #${tag}.`, "info"),
                              })
                            ) : (
                              <p>No note yet.</p>
                            )}
                          </div>
                        )}
                        <div className="notes-bottom">
                          <span>
                            {storageError
                              ? "Not saved"
                              : "Saved on this device"}
                          </span>
                          <button
                            className="text-button"
                            onClick={() => {
                              setShowNote(!showNote);
                              if (showNote) {
                                setTimeout(
                                  () => document.getElementById("budget-note")?.focus(),
                                  0,
                                );
                              }
                            }}
                          >
                            {showNote ? "Edit note" : "Preview"}
                          </button>
                        </div>
                        <button
                          className="text-button note-download"
                          onClick={() =>
                            download(
                              `---\nbudget: ${JSON.stringify(budget.name)}\nprofile: ${budget.profile}\n---\n\n${budget.notes}`,
                              "budget-notes.md",
                            )
                          }
                        >
                          Save Markdown copy <Icon name="download" size={16} />
                        </button>
                      </section>
                      <section className="quiet-next">
                        <h3>A good plan is a living thing.</h3>
                        <p>
                          Check in, make a change, and keep going. Your budget
                          is here to help, not to judge.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => go("report")}
                        >
                          Share where you stand
                          <Icon name="arrow" size={17} />
                        </button>
                      </section>
                      <details className="audit" open={!budget.events.length}>
                        <summary>Activity & audit trail</summary>
                        {budget.events.length ? (
                          [...budget.events].reverse().map((ev, i) => (
                            <p key={i}>
                              {ev.text}
                              <small>{new Date(ev.at).toLocaleString()}</small>
                            </p>
                          ))
                        ) : (
                          <p>No changes recorded yet.</p>
                        )}
                      </details>
                    </aside>
                  </div>
                </>
              )}
              {page === "report" && (
                <>
                  {header(
                    "A story worth sharing.",
                    "The big picture, in words everyone can understand.",
                    <button className="primary heading-action" onClick={share}>
                      <Icon name="share" size={19} />
                      Share report
                    </button>,
                  )}
                  <div className="report-layout">
                    <article className="paper report-paper">
                      <div className="report-brand">
                        <Icon name="book" size={24} />
                        ellie’s book<span>Budget check-in</span>
                      </div>
                      <h2>{budget.name}</h2>
                      <p className="report-period">
                        {budget.period} · {budget.profile}
                      </p>
                      <p className="report-story">
                        We’re working with{" "}
                        <strong>{money(budget.total)}</strong>. So far, we’ve
                        paid <strong>{money(t.spent)}</strong>, with{" "}
                        <strong>{money(t.committed)}</strong> still to pay.
                      </p>
                      <div className="report-left">
                        <span>
                          {t.left < 0
                            ? "That puts us over by"
                            : "That leaves us"}
                        </span>
                        <strong>{money(Math.abs(t.left))}</strong>
                        <span>
                          {t.left < 0
                            ? "after existing commitments."
                            : "after existing commitments."}
                        </span>
                      </div>
                      <h3>Here’s how it breaks down</h3>
                      <div className="report-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Planned</th>
                              <th>Spent</th>
                              <th>Left</th>
                            </tr>
                          </thead>
                          <tbody>
                            {budget.categories.map((c) => {
                              const s = totals(budget, c.id);
                              return (
                                <tr key={c.id}>
                                  <th scope="row">{c.name}</th>
                                  <td>{money(c.amount)}</td>
                                  <td>{money(s.spent)}</td>
                                  <td className={s.left < 0 ? "negative" : ""}>
                                    {money(s.left)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="report-footnote">
                        Spent means paid. Left includes bills still to pay.{" "}
                        {money(Math.abs(unassigned))}{" "}
                        {unassigned < 0
                          ? "is planned above the total budget."
                          : "of the total budget is not assigned to categories."}
                      </p>
                      <h3>What we want to remember</h3>
                      <div className="report-notes">
                        {budget.notes
                          ? renderMarkdownDocument(budget.notes)
                          : <p>No notes added yet.</p>}
                      </div>
                      <footer>
                        Left = budget − paid − still to pay.
                        <br />
                        Prepared with Ellie’s Book · Saved locally, shared by
                        you.
                      </footer>
                    </article>
                    <aside className="report-actions">
                      <h2>Keep everyone in the loop.</h2>
                      <p>
                        Send this check-in to your partner, your team, or your
                        future self.
                      </p>
                      <button
                        className="secondary full"
                        onClick={() => {
                          window.print();
                        }}
                      >
                        Print / save as PDF
                        <Icon name="download" size={18} />
                      </button>
                      <button
                        className="secondary full"
                        onClick={() => {
                          download(reportText(budget), "budget-report.md");
                          notify("Report downloaded.");
                        }}
                      >
                        Download report
                        <Icon name="download" size={18} />
                      </button>
                      <div className="finance-export">
                        <h3>Need the numbers?</h3>
                        <p>
                          A category summary with paid amounts and open
                          commitments.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => {
                            download(
                              csvText(budget),
                              "budget-finance.csv",
                              "text/csv;charset=utf-8",
                            );
                            notify("Finance CSV exported.");
                          }}
                        >
                          Export for finance <Icon name="download" size={17} />
                        </button>
                      </div>
                      <div className="finance-export">
                        <h3>Your whole book, safely kept.</h3>
                        <p>
                          A Markdown backup includes every entry, its history
                          and your notes. Restore it from My budget.
                        </p>
                        <button className="text-button" onClick={backup}>
                          Download book backup{" "}
                          <Icon name="download" size={17} />
                        </button>
                      </div>
                      <p className="hint">
                        This shares a snapshot, not a live link. Your private
                        notes are included.
                      </p>
                    </aside>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>Small steps. A clearer picture.</span>
            <span>Ellie’s Book</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {pages.map((p) => (
          <button
            key={p.id}
            aria-current={page === p.id ? "page" : undefined}
            className={page === p.id ? "active" : ""}
            onClick={() => go(p.id)}
          >
            <Icon name={p.icon} />
            <span>{p.short}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div
          className={`toast toast-${toast.kind}`}
          role={toast.kind === "error" ? "alert" : "status"}
        >
          <Icon name={toast.kind === "success" ? "check" : toast.kind} size={18} />
          {toast.text}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function BudgetForm({
  initialBudget,
  onSave,
}: {
  initialBudget: Budget;
  onSave: (
    details: Pick<Budget, "name" | "total" | "period" | "profile">,
  ) => void;
}) {
  // Editing details is a draft: only the explicit Save confirms the baseline.
  const [budget, setBudget] = useState(initialBudget);
  function create(event: FormEvent) {
    event.preventDefault();
    onSave({
      name: budget.name.trim(),
      total: budget.total,
      period: budget.period.trim(),
      profile: budget.profile,
    });
  }
  return (
    <form className="paper start-form" onSubmit={create}>
      <h2>
        {budget.created ? "Your budget details" : "Let’s start your budget"}
      </h2>
      <fieldset className="profile-field">
        <legend>Who are you planning for?</legend>
        <div className="profile-options">
          {(Object.keys(profiles) as Profile[]).map((p, i) => (
            <label
              key={p}
              className={budget.profile === p ? "profile selected" : "profile"}
            >
              <input
                type="radio"
                name="profile"
                value={p}
                checked={budget.profile === p}
                onChange={() =>
                  setBudget((b) => ({
                    ...b,
                    profile: p,
                    categories: b.created
                      ? b.categories
                      : blankBudget(p).categories,
                  }))
                }
              />
              <Icon name={["home", "person", "people"][i]} />
              <span>{p}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        Give your budget a name
        <input
          required
          pattern=".*\S.*"
          maxLength={70}
          placeholder="e.g. Our November"
          value={budget.name}
          onChange={(e) => setBudget({ ...budget, name: e.target.value })}
        />
      </label>
      <div className="form-pair">
        <label className="field">
          Total budget{" "}
          <span className="input-wrap">
            <span>$</span>
            <input
              aria-label="Total budget"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="1000000000"
              step="0.01"
              required
              placeholder="5,000"
              value={budget.total || ""}
              onChange={(e) =>
                setBudget({
                  ...budget,
                  total: round(e.target.value),
                })
              }
            />
            <small>USD</small>
          </span>
        </label>
        <label className="field">
          Budget period
          <input
            required
            pattern=".*\S.*"
            maxLength={60}
            placeholder="e.g. November 2026"
            value={budget.period}
            onChange={(e) => setBudget({ ...budget, period: e.target.value })}
          />
        </label>
      </div>
      <p className="hint">
        This is the amount you’re happy to work within. You’re in charge.
      </p>
      <button className="primary full" type="submit">
        {budget.created ? "Save budget details" : "Create my budget"}
        <Icon name="arrow" size={19} />
      </button>
    </form>
  );
}
