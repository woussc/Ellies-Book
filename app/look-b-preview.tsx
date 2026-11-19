import { cloneElement, isValidElement, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { renderMarkdownDocument, type MarkdownHandlers } from "./markdown-render";
import {
  blankBudget, canRemoveCategory, cents, exampleBudget, financeCsv, fromMarkdown, money, newCategories,
  periodDates, persistSnapshot, reportText, STORAGE_KEY, today, toMarkdown, totals, transitionSpending, uid,
} from "./look-b-model.mjs";

type Budget = ReturnType<typeof blankBudget>;
type Category = Budget["categories"][number];
type Spending = Budget["spending"][number];
type Screen = "start" | "plan" | "log" | "stand" | "report";
type Update = (next: Budget, message?: string) => boolean;
function staticMarkdown(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(staticMarkdown);
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (node.type === "button") return <span key={node.key} className="md-reference">{staticMarkdown(node.props.children)}</span>;
  return cloneElement(node, undefined, staticMarkdown(node.props.children));
}
function MarkdownBody({ markdown, readOnly = false, ...handlers }: { markdown: string; readOnly?: boolean } & MarkdownHandlers) {
  const rendered = renderMarkdownDocument(markdown, handlers);
  return <div className="markdown-body">{readOnly ? staticMarkdown(rendered) : rendered}</div>;
}
const routes: { id: Screen; title: string; short: string; icon: string }[] = [
  { id: "start", title: "Start my budget", short: "Budget", icon: "book" },
  { id: "plan", title: "Plan by category", short: "Plan", icon: "plan" },
  { id: "log", title: "Log spending", short: "Log", icon: "plus" },
  { id: "stand", title: "Where I stand", short: "Overview", icon: "chart" },
  { id: "report", title: "Share a report", short: "Report", icon: "report" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    book: <><path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z" /><path d="M8 4v16M12 8h4M12 12h4" /></>,
    plan: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 4v16" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    chart: <><path d="M4 4v16h16M8 15v-4M13 15V7M18 15v-6" /></>,
    report: <><path d="M14 3H5v18h14V8l-5-5Z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    down: <path d="m5 9 7 7 7-7" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    share: <><path d="M12 15V3m-4 4 4-4 4 4M5 11v10h14V11" /></>,
    graph: <><rect x="8" y="2" width="8" height="5" rx="1" /><rect x="2" y="17" width="8" height="5" rx="1" /><rect x="14" y="17" width="8" height="5" rx="1" /><path d="M12 7v5M6 17v-5h12v5" /></>,
    note: <><path d="M4 3h16v13l-5 5H4V3ZM15 21v-5h5M8 8h8M8 12h5" /></>,
    home: <><path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7" /></>,
    person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3" /></>,
    team: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a4 4 0 0 1 0 8M22 21v-3a7 7 0 0 0-4-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.book}</svg>;
}

function Heading({ number, title, children, action }: { number: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <header className="page-heading"><div><div className="eyebrow">YOUR BUDGET / {number}</div><h1 tabIndex={-1}>{title}</h1><p>{children}</p></div>{action}</header>;
}

function download(content: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initialSnapshot() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return { model: raw ? fromMarkdown(raw) : blankBudget(), raw, error: "" };
  } catch {
    return { model: blankBudget(), raw, error: "Your saved budget could not be read. The original is still on this device. Download a backup before starting over." };
  }
}

export default function LookBPreview() {
  const [initial] = useState(initialSnapshot);
  const [model, setModel] = useState<Budget>(initial.model);
  const savedSnapshot = useRef(initial.raw);
  const [error, setError] = useState(initial.error);
  const [toast, setToast] = useState("");
  const [screen, setScreen] = useState<Screen>(() => {
    const requested = location.hash.slice(1) as Screen;
    return initial.model.created && routes.some(r => r.id === requested) ? requested : initial.model.created ? "stand" : "start";
  });
  const [remove, setRemove] = useState(false);
  const main = useRef<HTMLElement>(null);
  const confirmation = useRef<HTMLDivElement>(null);

  function navigate(next: Screen) {
    setScreen(next); location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => main.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true }));
  }
  useEffect(() => {
    const onHash = () => {
      const next = location.hash.slice(1) as Screen;
      if (routes.some(r => r.id === next) && (model.created || next === "start")) setScreen(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [model.created]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (remove) {
      confirmation.current?.focus({ preventScroll: true });
      confirmation.current?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [remove]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if ((event.key === STORAGE_KEY || event.key === null) && localStorage.getItem(STORAGE_KEY) !== savedSnapshot.current) {
        setError("This budget changed in another tab. Refresh before editing again. Unsaved changes in this tab will not overwrite the saved budget.");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update: Update = (next, message = "Saved on this device") => {
    try {
      savedSnapshot.current = persistSnapshot(localStorage, savedSnapshot.current, toMarkdown(next));
      setModel(next); setError(""); setToast(message); return true;
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("This budget changed") ? e.message : "Not saved. Your browser storage may be full or unavailable. Download a Markdown backup before leaving this page.");
      return false;
    }
  };
  function reset() {
    try { savedSnapshot.current = persistSnapshot(localStorage, savedSnapshot.current, null); setModel(blankBudget()); setRemove(false); setError(""); navigate("start"); setToast("Budget removed. A clean start."); }
    catch (e) { setError(e instanceof Error && e.message.startsWith("This budget changed") ? e.message : "Your browser could not remove the saved budget."); }
  }
  const summary = totals(model);
  return <div className="look-b-app">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">
      <a className="brand" href="#start" onClick={() => navigate("start")} aria-label="Ellie's Book, budget setup"><span className="brand-mark">e.</span><span>Ellie’s Book<small>A clear plan. Every dollar.</small></span></a>
      <div className="workspace-label">WORKSPACE <span>LOOK B</span></div>
      <div className="workspace-name"><span className="workspace-dot" />{model.created ? model.name : "A fresh start"}</div>
      <nav aria-label="Budget flows">{routes.map((r, i) => <button key={r.id} type="button" onClick={() => navigate(r.id)} disabled={!model.created && r.id !== "start"} aria-current={screen === r.id ? "page" : undefined} className={screen === r.id ? "nav-item active" : "nav-item"}><Icon name={r.icon} /><span className="nav-full">{r.title}</span><span className="nav-short">{r.short}</span><small className="nav-number">0{i + 1}</small></button>)}</nav>
      <div className="sidebar-bottom"><div className="local-info"><Icon name="lock" size={16} /><span>Private to this browser<small>No account. No cloud sync.</small></span></div><div className="preview-label">DESIGN PREVIEW <span>V1 / B</span></div><a href="https://app.devin.ai/sessions/e5ef4ac200074996b5e7fac57e44c3a3" target="_blank" rel="noreferrer">Give feedback <Icon name="arrow" size={16} /></a></div>
    </aside>
    <div className="app-body">
      <div className="topbar"><div className="topbar-path">Personal workspace <span>/</span> <strong>{model.created ? model.profile : "New budget"}</strong></div><div className={`save-state ${error ? "save-error" : ""}`}><span className="status-dot" />{error ? "Needs attention" : "On this device"}</div></div>
      <main id="main" ref={main}>
        {error && <div className="error-banner" role="alert">{error}<button className="text-button" onClick={() => download(localStorage.getItem(STORAGE_KEY) || toMarkdown(model), "ellies-book-backup.md", "text/markdown")}>Download backup <Icon name="download" size={16} /></button></div>}
        {model.example && <div className="example-banner"><span><strong>Example budget</strong><span className="example-description"> · Try things out. This is not your data.</span></span><button onClick={() => setRemove(true)}>Remove example <Icon name="close" size={16} /></button></div>}
        {remove && <div className="confirm-panel" role="alert" ref={confirmation} tabIndex={-1}><div><strong>Remove {model.example ? "the example" : "this budget"}?</strong><p>This removes this preview’s budget, spending and notes from this browser.</p></div><div className="button-row"><button onClick={() => setRemove(false)} className="button secondary">Keep it</button><button onClick={reset} className="button danger">Remove budget</button></div></div>}
        {screen === "start" && <StartBudget key={`${model.created}-${model.example}`} model={model} update={update} onNext={() => navigate("plan")} onExample={() => { if (update(exampleBudget(), "Example opened. Remove it whenever you like.")) navigate("stand"); }} onRemove={() => setRemove(true)} />}
        {screen === "plan" && <PlanBudget key={model.name + model.profile} model={model} update={update} onNext={() => navigate("log")} />}
        {screen === "log" && <LogSpending model={model} update={update} onNext={() => navigate("stand")} />}
        {screen === "stand" && <Stand model={model} update={update} onLog={() => navigate("log")} onReport={() => navigate("report")} />}
        {screen === "report" && <Report model={model} notify={setToast} />}
        <footer className="page-footer"><span>Ellie’s Book <span className="footer-divider">/</span> A little clarity goes a long way.</span><span>USD{model.created && <> <span className="footer-divider">·</span> {money(summary.approved)} budget</>}</span></footer>
      </main>
    </div>
    <div className="toast" role="status" aria-live="polite">{toast && <><Icon name="check" size={18} />{toast}</>}</div>
  </div>;
}

function StartBudget({ model, update, onNext, onExample, onRemove }: { model: Budget; update: Update; onNext: () => void; onExample: () => void; onRemove: () => void }) {
  const [profile, setProfile] = useState(model.profile);
  const [name, setName] = useState(model.name);
  const [amount, setAmount] = useState(model.total ? String(model.total / 100) : "");
  const [period, setPeriod] = useState(model.period);
  const [start, setStart] = useState(model.start);
  const [end, setEnd] = useState(model.end);
  const [error, setError] = useState("");
  function changePeriod(value: string) {
    setPeriod(value);
    if (value !== "Custom") { const dates = periodDates(value); setStart(dates.start); setEnd(dates.end); }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const total = cents(amount);
    if (!name.trim() || total <= 0) { setError("Give your budget a name and an amount above zero."); return; }
    if (end < start) { setError("The end date must be on or after the start date."); return; }
    if (model.created && total < totals(model).allocated) { setError("This total is below your category plan. Reduce the category amounts first."); return; }
    const next = { ...model, name: name.trim(), profile, total, period, start, end, created: true,
      categories: model.created ? model.categories : newCategories(profile),
      audit: [...model.audit, { id: uid(), date: new Date().toISOString(), action: model.created ? "Budget settings updated" : "Budget created; total confirmed" }] };
    if (update(next, model.created ? "Budget settings saved" : "Your budget is ready. Give every category a limit.")) onNext();
  }
  return <>
    <Heading number="01" title={model.created ? "Your budget, your rules." : "Start with a clear limit."}>A name, a number, a little intention. That’s all you need.</Heading>
    <div className="setup-layout">
      <form className="panel setup-form" onSubmit={submit}>
        <fieldset className="profile-field"><legend>Who is this budget for?</legend><div className="profile-options">{[
          ["Household", "home", "Life, together"], ["Just me", "person", "Your own rhythm"], ["Team", "team", "Work, aligned"],
        ].map(([value, icon, sub]) => <button type="button" className={profile === value ? "profile-option selected" : "profile-option"} aria-pressed={profile === value} onClick={() => setProfile(value)} key={value}><span className="profile-icon"><Icon name={icon} size={23} />{profile === value && <Icon name="check" size={16} />}</span><strong>{value}</strong><small>{sub}</small></button>)}</div></fieldset>
        <label className="field">Budget name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder={profile === "Household" ? "e.g. November at home" : profile === "Team" ? "e.g. Product launch" : "e.g. A calmer November"} /></label>
        <label className="field">Total budget<span className="amount-field"><span>$</span><input aria-label="Total budget in USD" inputMode="decimal" type="number" min="0.01" max="999999999" step="0.01" required placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /><small>USD</small></span><small>The most you want to spend in this period.</small></label>
        <label className="field">Budget period<select value={period} onChange={e => changePeriod(e.target.value)}><option>Monthly</option><option>Quarterly</option><option>Yearly</option><option>Custom</option></select></label>
        <div className="field-grid"><label className="field">From<input type="date" required value={start} onChange={e => setStart(e.target.value)} /></label><label className="field">To<input type="date" required min={start} value={end} onChange={e => setEnd(e.target.value)} /></label></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><span><Icon name="lock" size={16} /> Yours. Saved on this device.</span><button className="button primary" type="submit">{model.created ? "Save budget" : "Create my budget"}<Icon name="arrow" size={18} /></button></div>
      </form>
      <aside className="setup-aside"><div className="side-kicker">LESS ADMIN. MORE CLARITY.</div><h2>One plan.<br />The whole picture.</h2><ol className="promise-list"><li><span>01</span><div><strong>Give your money a job</strong><p>Simple category limits, without the spreadsheet setup.</p></div></li><li><span>02</span><div><strong>Keep reality connected</strong><p>Planned, committed or paid. One place to log it all.</p></div></li><li><span>03</span><div><strong>Know what’s still possible</strong><p>See what’s left, follow the money, share the story.</p></div></li></ol>
        {!model.created ? <div className="example-choice"><Icon name="book" size={24} /><h3>Just looking around?</h3><p>Open a household example. It’s separate from your own budget, and easy to remove.</p><button type="button" className="text-button" onClick={onExample}>Explore an example <Icon name="arrow" size={18} /></button></div> : <div className="example-choice"><h3>A portable, open notebook.</h3><p>Your records and notes are stored as Markdown in this browser. Download a copy whenever you need it.</p><button className="text-button" onClick={() => download(toMarkdown(model), "ellies-book.md", "text/markdown")}>Download Markdown <Icon name="download" size={16} /></button><button className="text-button muted" onClick={onRemove}>Remove {model.example ? "example" : "budget"}</button></div>}
      </aside>
    </div>
  </>;
}

function PlanBudget({ model, update, onNext }: { model: Budget; update: Update; onNext: () => void }) {
  const [categories, setCategories] = useState(model.categories);
  const [error, setError] = useState("");
  const total = categories.reduce((s, c) => s + c.amount, 0);
  const remaining = model.total - total;
  const setCategory = (id: string, patch: Partial<Category>) => setCategories(list => list.map(c => c.id === id ? { ...c, ...patch } : c));
  const changeAmount = (id: string, value: string) => {
    try { setCategory(id, { amount: cents(value) }); setError(""); }
    catch (e) { setError((e as Error).message); }
  };
  function save(e: FormEvent) {
    e.preventDefault();
    if (remaining < 0) { setError(`Your plan is ${money(-remaining)} over the total budget. Lower a category amount to continue.`); return; }
    if (!categories.length || categories.some(c => !c.name.trim())) { setError("Add at least one named category."); return; }
    if (new Set(categories.map(c => c.name.trim().toLowerCase())).size !== categories.length) { setError("Use a different name for each category."); return; }
    if (update({ ...model, categories: categories.map(c => ({ ...c, name: c.name.trim() })), audit: [...model.audit, { id: uid(), date: new Date().toISOString(), action: `Category plan confirmed: ${money(total)}` }] }, "Category plan saved and confirmed")) onNext();
  }
  return <><Heading number="02" title="Give every dollar a direction.">Set one amount per category. Keep a little unassigned, if you like.</Heading>
    <div className="plan-summary"><div><span>Total budget</span><strong>{money(model.total)}</strong></div><div><span>Planned in categories</span><strong>{money(total)}</strong></div><div className={remaining < 0 ? "negative" : ""}><span>Still to assign</span><strong>{money(remaining)}</strong></div></div>
    <form onSubmit={save} className="panel category-form"><div className="section-heading"><h2>Your categories</h2><span>{model.profile} profile · USD</span></div><div className="category-labels"><span>CATEGORY</span><span>PLANNED LIMIT</span><span /></div>
      {categories.map((c, i) => <div className="category-editor" key={c.id}><div className="category-line"><span className="row-index">{String(i + 1).padStart(2, "0")}</span><input className="category-name" aria-label={`Category ${i + 1} name`} required maxLength={60} value={c.name} placeholder="Category name" onChange={e => setCategory(c.id, { name: e.target.value })} /><span className="category-amount"><span>$</span><input type="number" inputMode="decimal" min="0" max="999999999" step="0.01" aria-label={`${c.name || `Category ${i + 1}`} planned amount`} value={c.amount / 100 || ""} placeholder="0" onChange={e => changeAmount(c.id, e.target.value)} /></span><button type="button" className="icon-button" aria-label={`Remove ${c.name || "category"}`} disabled={!canRemoveCategory(model, c.id)} title={canRemoveCategory(model, c.id) ? "Remove category" : "A category with saved spending or notes cannot be removed"} onClick={() => setCategories(list => list.filter(x => x.id !== c.id))}><Icon name="close" size={16} /></button></div>
        <details className="advanced"><summary>Advanced <Icon name="down" size={14} /></summary><div className="advanced-fields"><label className="field">{model.profile === "Team" ? "Accountable owner" : "Who is responsible?"}<input maxLength={80} value={c.owner} onChange={e => setCategory(c.id, { owner: e.target.value })} placeholder="Optional" /></label><label className="field">GL code <span className="optional">(for finance)</span><input maxLength={40} value={c.glCode} onChange={e => setCategory(c.id, { glCode: e.target.value })} placeholder="e.g. 001230" /></label><label className="field full-width">Planning details<textarea rows={2} maxLength={1000} value={c.details} onChange={e => setCategory(c.id, { details: e.target.value })} placeholder="Quantities, unit prices, vendor or assumptions. Optional." /></label></div></details>
      </div>)}
      <button type="button" className="text-button add-category" onClick={() => setCategories(list => [...list, { id: uid(), name: "", amount: 0, owner: "", glCode: "", details: "" }])}><Icon name="plus" size={18} /> Add a category</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><span>Saving confirms these limits as your plan.</span><button type="submit" className="button primary">Save my plan <Icon name="arrow" size={18} /></button></div>
    </form><div className="quiet-callout"><Icon name="note" /><p><strong>Plans can change.</strong> You can edit your limits any time. Categories with saved spending or notes stay connected and cannot be removed.</p></div>
  </>;
}

function LogSpending({ model, update, onNext }: { model: Budget; update: Update; onNext: () => void }) {
  const [editId, setEditId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(model.categories[0]?.id || "");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<Spending["status"]>("paid");
  const [error, setError] = useState("");
  function clear() { setEditId(""); setAmount(""); setDescription(""); setStatus("paid"); setError(""); }
  function edit(s: Spending) { setEditId(s.id); setAmount(String(s.amount / 100)); setDescription(s.description); setCategoryId(s.categoryId); setDate(s.date); setStatus(s.status); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || !categoryId || cents(amount) <= 0) { setError("Add an amount, a description and a category."); return; }
    const item: Spending = { id: editId || uid(), amount: cents(amount), description: description.trim(), categoryId, date, status };
    const transitioned = editId ? transitionSpending(model, editId, status) : model;
    const next = { ...transitioned, spending: editId ? transitioned.spending.map(s => s.id === editId ? item : s) : [...model.spending, item],
      audit: [...transitioned.audit, { id: uid(), date: new Date().toISOString(), action: `${editId ? "Updated" : "Logged"} ${item.description}: ${money(item.amount)} · ${status}` }] };
    if (update(next, `${money(item.amount)} saved as ${status}`)) clear();
  }
  const selected = totals(model, categoryId);
  return <><Heading number="03" title="Real life. One quick entry." action={<button className="button secondary" onClick={onNext}>See where I stand <Icon name="arrow" size={18} /></button>}>A small purchase or a big commitment. Keep it in the same place.</Heading>
    <div className="log-layout"><form className="panel spend-form" onSubmit={submit}><div className="section-heading"><h2>{editId ? "Update spending" : "Log spending"}</h2>{editId && <button type="button" className="text-button" onClick={clear}>Cancel edit</button>}<span>USD</span></div>
      <label className="field spend-amount-label">Amount<span className="amount-field large"><span>$</span><input autoComplete="off" type="number" min="0.01" max="999999999" step="0.01" required inputMode="decimal" aria-label="Spending amount in USD" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></span></label>
      <label className="field">What is it for?<input required maxLength={100} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Weekly groceries at the market" /></label>
      <div className="field-grid"><label className="field">Category<select value={categoryId} required onChange={e => setCategoryId(e.target.value)}>{model.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label className="field">Date<input type="date" value={date} required onChange={e => setDate(e.target.value)} /></label></div>
      <fieldset className="status-field"><legend>Where is this spending now?</legend><div className="spend-status-options">{(["planned", "committed", "paid"] as const).map(s => <button key={s} type="button" className={status === s ? "selected" : ""} aria-pressed={status === s} onClick={() => setStatus(s)}><span className={`state-symbol ${s}`} />{s[0].toUpperCase() + s.slice(1)}{status === s && <Icon name="check" size={16} />}</button>)}</div><p className="status-explanation">{status === "paid" ? "Money has left your account. Counts as spent." : status === "committed" ? "You’ve agreed to pay, but haven’t paid yet. Reserved, not spent." : "An idea or estimate. No money reserved or spent yet."}</p></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><span>One record. No double counting.</span><button type="submit" className="button primary">{editId ? "Save changes" : "Save spending"} <Icon name="check" size={18} /></button></div></form>
      <aside className="spend-aside"><div className="category-context"><div className="eyebrow">CATEGORY CHECK</div><h2>{model.categories.find(c => c.id === categoryId)?.name || "Your category"}</h2><strong className={selected.left < 0 ? "context-number negative" : "context-number"}>{money(selected.left)}</strong><p>left to commit</p><div className="context-breakdown"><div><span>Category plan</span><span>{money(selected.approved)}</span></div><div><span>Paid so far</span><span>− {money(selected.paid)}</span></div><div><span>Committed, not paid</span><span>− {money(selected.committed)}</span></div></div></div><div className="side-note"><Icon name="graph" /><h3>The story stays connected.</h3><p>When a bill is paid, edit its status here. Don’t add it again. Your overview, report and money flow all update together.</p></div></aside>
    </div>
    <section className="recent-section"><div className="section-heading"><h2>Spending log</h2><span>{model.spending.length} records</span></div>{!model.spending.length ? <div className="empty-state"><Icon name="plus" /><p>Your first entry starts the story.<small>Save an amount above. It will appear here.</small></p></div> : <div className="spend-list">{[...model.spending].reverse().map(s => <div className="spend-row" key={s.id}><span className={`state-symbol ${s.status}`} /><div className="spend-description"><strong>{s.description}</strong><small>{model.categories.find(c => c.id === s.categoryId)?.name} · {s.date}</small></div><span className={`status-text ${s.status}`}>{s.status}</span><strong className="numeric">{money(s.amount)}</strong><button className="text-button" onClick={() => edit(s)} aria-label={`Edit ${s.description}`}>Edit</button></div>)}</div>}</section>
  </>;
}

function CategoryTable({ model, light = false }: { model: Budget; light?: boolean }) {
  const unassigned = totals(model).unassigned;
  return <div className={light ? "category-table report-table" : "category-table"} role="table" aria-label="Category plan, spending and remaining budget"><div className="table-head" role="row"><span role="columnheader">Category</span><span role="columnheader">Planned</span><span role="columnheader">Spent</span><span role="columnheader">Left</span></div>{model.categories.map(c => {
    const t = totals(model, c.id);
    return <div className="table-row" role="row" key={c.id}><div role="cell"><strong>{c.name}</strong>{!light && <div className="mini-track"><span style={{ width: `${c.amount ? Math.min(100, t.paid / c.amount * 100) : 0}%` }} /><i style={{ width: `${c.amount ? Math.min(100 - Math.min(100, t.paid / c.amount * 100), t.committed / c.amount * 100) : 0}%` }} /></div>}{t.committed > 0 && <small>{money(t.committed)} committed</small>}</div><span role="cell">{money(c.amount)}</span><span role="cell">{money(t.paid)}</span><strong role="cell" className={t.left < 0 ? "negative" : ""}>{money(t.left)}</strong></div>;
  })}{unassigned > 0 && <div className="table-row unassigned-row" role="row"><div role="cell"><strong>Unassigned</strong><small>Kept in reserve</small></div><span role="cell">{money(unassigned)}</span><span role="cell">{money(0)}</span><strong role="cell">{money(unassigned)}</strong></div>}</div>;
}

function Stand({ model, update, onLog, onReport }: { model: Budget; update: Update; onLog: () => void; onReport: () => void }) {
  const [tab, setTab] = useState("overview");
  const t = totals(model);
  const used = Math.min(100, (t.paid + t.committed) / model.total * 100);
  return <><Heading number="04" title="The whole picture. No guesswork." action={<button className="button primary" onClick={onLog}><Icon name="plus" size={18} /> Log spending</button>}>{model.name} <span className="inline-separator">/</span> {model.start} — {model.end}</Heading>
    <div className="overview-hero"><div className="balance"><div className="eyebrow">LEFT TO COMMIT</div><strong className={t.left < 0 ? "negative" : ""}>{money(t.left)}</strong><p>{t.left < 0 ? "You’re over the limit. Review your plan before committing more." : "Still available, after paid and committed spending."}</p></div><div className="balance-breakdown"><div><span>Your budget</span><strong>{money(t.approved)}</strong></div><div><span><i className="legend-line paid" />Spent · paid</span><strong>{money(t.paid)}</strong></div><div><span><i className="legend-line committed" />Committed · not paid</span><strong>{money(t.committed)}</strong></div><div className="budget-track"><span style={{ width: `${Math.min(100, t.paid / model.total * 100)}%` }} /><i style={{ width: `${Math.max(0, used - Math.min(100, t.paid / model.total * 100))}%` }} /></div><small>{Math.round(used)}% of your budget paid or committed</small></div></div>
    <div className="view-tabs" role="tablist" aria-label="Budget view">{[["overview", "chart", "By category"], ["flow", "graph", "Money flow"], ["notes", "note", `Notes${model.notes.length ? ` (${model.notes.length})` : ""}`]].map(([id, icon, label]) => <button id={`tab-${id}`} key={id} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}><Icon name={icon} size={18} />{label}</button>)}</div>
    <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="view-panel">
      {tab === "overview" && <><div className="section-heading"><h2>Room in every category</h2><span>One shared set of numbers</span></div><CategoryTable model={model} /><div className="table-note"><p>Left = planned limit − spent − committed.<br />Planned spending is an estimate, not money spent.</p><button className="text-button" onClick={onReport}>Share the bigger picture <Icon name="arrow" size={18} /></button></div><div className="forecast-strip"><span>Looking ahead</span><p>{money(t.planned)} in uncommitted plans <span>·</span> {money(t.forecast)} forecast spend <span>·</span> {money(t.headroom)} projected headroom</p></div></>}
      {tab === "flow" && <MoneyFlow model={model} update={update} />}
      {tab === "notes" && <Notes model={model} update={update} />}
    </section>
  </>;
}

function MoneyFlow({ model, update }: { model: Budget; update: Update }) {
  const [categoryId, setCategoryId] = useState(model.categories[0]?.id || "");
  const [selectedId, setSelectedId] = useState("");
  const category = model.categories.find(c => c.id === categoryId);
  const spending = model.spending.filter(s => s.categoryId === categoryId);
  const selected = spending.find(s => s.id === selectedId);
  const target = selected?.id || categoryId;
  return <><div className="section-heading flow-heading"><div><h2>Follow the money</h2><p>A readable trail, one category at a time. Tap a record for its story.</p></div><label className="flow-select">Category<select value={categoryId} onChange={e => { setCategoryId(e.target.value); setSelectedId(""); }}>{model.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    <div className="flow-layout"><div className="flow-canvas"><div className="graph-node root-node"><span>Budget · confirmed limit</span><strong>{model.name}</strong><b>{money(model.total)}</b></div><div className="graph-connector"><span>contains category</span></div><button className={`graph-node category-node ${!selected ? "node-selected" : ""}`} onClick={() => setSelectedId("")}><span>Category · planned limit</span><strong>{category?.name}</strong><b>{money(category?.amount)}</b></button><div className="graph-connector"><span>contains spending records</span></div><div className="graph-children">{spending.map(s => <button key={s.id} className={`graph-node spend-node ${selectedId === s.id ? "node-selected" : ""}`} onClick={() => setSelectedId(s.id)}><span className={`status-text ${s.status}`}><i className={`state-symbol ${s.status}`} />{s.status}</span><strong>{s.description}</strong><b>{money(s.amount)}</b></button>)}</div>{!spending.length && <p className="graph-empty">No spending connected yet. Log an entry in this category to grow the trail.</p>}<div className="graph-caption"><Icon name="graph" size={16} /> Each node is a record. Each line is a real link.</div></div>
      <aside className="flow-inspector"><div className="eyebrow">{selected ? "SPENDING RECORD" : "CATEGORY RECORD"}</div><h3>{selected?.description || category?.name}</h3><strong className="inspector-amount">{money(selected?.amount ?? category?.amount)}</strong><dl><div><dt>Status</dt><dd>{selected?.status || "Confirmed plan"}</dd></div><div><dt>Connected to</dt><dd>{category?.name}</dd></div>{selected && <div><dt>Date</dt><dd>{selected.date}</dd></div>}{category?.owner && <div><dt>Owner</dt><dd>{category.owner}</dd></div>}</dl><p className="inspector-help">{selected?.status === "committed" ? "Reserved, not spent. Update this same record to paid when money leaves your account." : selected?.status === "paid" ? "Counted once as spent. This amount is not also an open commitment." : selected?.status === "planned" ? "An estimate only. It is included in forecast spend, not in paid or committed totals." : "A category limit is part of your budget, not an expense."}</p>{category?.details && <p>{category.details}</p>}<Notes key={target} model={model} update={update} target={target} compact /></aside>
    </div><details className="audit-trail"><summary>Audit trail <span>{model.audit.length} events</span><Icon name="down" size={16} /></summary><ol>{[...model.audit].reverse().map(a => <li key={a.id}><time dateTime={a.date}>{new Date(a.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time><span>{a.action}</span></li>)}</ol></details>
  </>;
}

function Notes({ model, update, target = "budget", compact = false }: { model: Budget; update: Update; target?: string; compact?: boolean }) {
  const [text, setText] = useState("");
  const [targetId, setTargetId] = useState(target);
  const [editing, setEditing] = useState("");
  const [error, setError] = useState("");
  const [linkedName, setLinkedName] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const linked = model.categories.find(c => c.name.toLowerCase() === linkedName.toLowerCase()) || model.spending.find(s => s.description.toLowerCase() === linkedName.toLowerCase());
  const notes = model.notes.filter(n => (!compact || n.target === target) && (!activeTag || n.text.toLowerCase().includes(`#${activeTag}`)));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setError("Write a note before saving."); return; }
    const note = { id: editing || uid(), target: targetId, text: text.trim(), date: today() };
    if (update({ ...model, notes: editing ? model.notes.map(n => n.id === editing ? note : n) : [...model.notes, note], audit: [...model.audit, { id: uid(), date: new Date().toISOString(), action: `${editing ? "Updated" : "Saved"} a note` }] }, "Note saved as Markdown on this device")) { setText(""); setEditing(""); setError(""); }
  }
  const targetName = (id: string) => model.categories.find(c => c.id === id)?.name || model.spending.find(s => s.id === id)?.description || model.name;
  return <div className={compact ? "notes compact-notes" : "notes"}><div className="section-heading"><div><h2>{compact ? "Connected notes" : "Keep the why, not just the number."}</h2>{!compact && <p>Decisions, reminders, a little context. Saved as Markdown.</p>}</div>{!compact && <button className="text-button" onClick={() => download(toMarkdown(model), "ellies-book.md", "text/markdown")}>Download Markdown <Icon name="download" size={16} /></button>}</div>
    <form className="note-form" onSubmit={submit}><label className="field">{editing ? "Edit note" : "Add a note"}<textarea required maxLength={10000} rows={compact ? 3 : 4} value={text} onChange={e => setText(e.target.value)} placeholder="What should you remember about this money?" /></label>{!compact && <label className="field note-target">Attach to<select value={targetId} onChange={e => setTargetId(e.target.value)}><option value="budget">Whole budget</option>{model.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}{model.spending.map(s => <option key={s.id} value={s.id}>{s.description}</option>)}</select></label>}<div className="note-actions"><small>Markdown supported · **bold**, lists, [[links]]</small><div className="button-row">{editing && <button type="button" className="button secondary" onClick={() => { setText(""); setEditing(""); }}>Cancel</button>}<button className="button primary" type="submit">Save note <Icon name="check" size={16} /></button></div></div>{error && <p className="form-error" role="alert">{error}</p>}</form>
    {linkedName && <div className="linked-note-record" role="status"><span>[[{linkedName}]]</span><strong>{linked ? money(linked.amount) : "No matching record yet"}</strong><small>{linked ? ("status" in linked ? `Spending · ${linked.status}` : "Category · confirmed limit") : "This reference stays in your Markdown."}</small><button className="text-button" onClick={() => setLinkedName("")}>Close reference</button></div>}
    {activeTag && <button className="text-button" onClick={() => setActiveTag("")}>Showing #{activeTag} · Clear filter <Icon name="close" size={14} /></button>}
    <div className="saved-notes">{notes.length ? notes.map(n => <article className="saved-note" key={n.id}><div className="note-meta"><span><Icon name="note" size={15} />{targetName(n.target)}</span><span>{n.date}</span></div><MarkdownBody markdown={n.text} onWikilink={name => setLinkedName(name)} onTag={tag => setActiveTag(tag)} /><button className="text-button" onClick={() => { setText(n.text); setEditing(n.id); setTargetId(n.target); }} aria-label={`Edit note for ${targetName(n.target)}`}>Edit note</button></article>) : <p className="empty-notes">{compact ? "No notes on this record yet." : "No notes yet. Save the thinking behind your plan."}</p>}</div>
  </div>;
}

function Report({ model, notify }: { model: Budget; notify: (text: string) => void }) {
  const t = totals(model);
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: model.name, text: reportText(model) }); notify("Report shared"); }
      else { await navigator.clipboard.writeText(reportText(model)); notify("Report copied. Paste it into a message or email."); }
    } catch (e) {
      if ((e as Error).name !== "AbortError") { download(reportText(model), "ellies-book-report.txt"); notify("Report downloaded. Ready to share."); }
    }
  }
  return <><Heading number="05" title="Numbers tell part of the story.">Share the whole thing. A clear report, in words anyone can follow.</Heading><div className="report-toolbar"><div className="report-ready"><Icon name="check" size={18} /><span>Ready to share <small>Live totals from your budget</small></span></div><div className="button-row"><button className="button secondary" onClick={() => window.print()}><Icon name="download" size={18} /> Print / PDF</button><button className="button primary" onClick={share}><Icon name="share" size={18} /> Share report</button></div></div>
    <article className="report-paper"><header className="report-header"><span className="report-brand">e. <strong>Ellie’s Book</strong></span><span>BUDGET REPORT <span>/</span> USD</span></header><div className="report-title"><span>{model.profile} · {model.start} — {model.end}</span><h2>{model.name}</h2><p>Here’s where things stand.</p></div><div className="report-narrative">We set aside <strong>{money(t.approved)}</strong>.<br />So far, we’ve spent <strong>{money(t.paid)}</strong> and committed <strong>{money(t.committed)}</strong>.<br />That leaves <strong>{money(t.left)}</strong> for what’s next.</div><p className="report-explainer">Committed means agreed, but not yet paid. It’s already reserved in what’s left.</p><CategoryTable model={model} light /><div className="report-outlook"><h3>Looking ahead</h3><p>There’s {money(t.planned)} in planned spending that isn’t committed yet. If it all goes ahead, we expect to spend {money(t.forecast)}, leaving {money(t.headroom)} of the budget.</p></div><section className="report-notes"><h3>The context behind the numbers</h3>{model.notes.length ? model.notes.map(n => <div key={n.id}><MarkdownBody readOnly markdown={n.text} onWikilink={() => {}} onTag={() => {}} /></div>) : <p>No notes added yet.</p>}</section><footer><span>Prepared {today()} · Ellie’s Book</span><span>Left = budget − spent − committed</span></footer></article>
    <div className="finance-export"><div><h3>Need the numbers for finance?</h3><p>Category totals, actuals, open commitments and forecasts. CSV is separate from your report.</p></div><button className="button secondary" onClick={() => { download(financeCsv(model), "ellies-book-finance.csv", "text/csv;charset=utf-8"); notify("Finance CSV exported"); }}><Icon name="download" size={18} /> Export for finance</button></div>
  </>;
}
