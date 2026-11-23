"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  advanceExpense,
  csvText,
  editCategory,
  editBudgetDetails,
  exampleBudget,
  localDate,
  money,
  serializeBook,
  reportText,
  removeExpense,
  round,
  totals,
} from "./model.mjs";
import { useBook } from "./use-book";
import { printReport, saveFile, shareReport, watchNativeKeyboard } from "./platform";
import { buildAiReadyPack } from "./ai-portal.mjs";
import AskAiSheet from "./ask-ai-sheet";
import { registerNativeShare } from "./ai-share";
import ProjectGarden, {Stage} from "./project-garden";
import PeriodSwitcher from './period-switcher';
import BudgetStartReview from './budget-start-review';
import StatementImport,{StatementImportHistory} from './statement-import';
import AutoSort,{type LearnPayee} from './auto-sort';
import {normalizePayee,shouldOfferRule,suggestCategory} from './auto-sort-model.mjs';
import {dismissPayeeOffer,isPayeeOfferDismissed} from './auto-sort-offers.mjs';
import {budgetMonth,carryoverStatus,confirmBudgetStart,previousBudgetPeriod} from './carryover-model.mjs';
import {displayDate,RepeatEditor,RepeatTiming} from './repeat-entry';
import {openPeriod,periodId,repeatTiming,saveRepeatingEntry,skipOccurrence,stopRepeating,type RepeatOptions} from './repeat-model.mjs';
import type {NodeBoardHandle} from "./node-board";
import { BookSetup, BooksPage, ProfilePage } from "./library-pages";
import { serializeLibrary } from "./library-model.mjs";
import "./workspace.css";
import { renderMarkdownDocument } from "../markdown-render";
import type { Budget, Category, Expense, Profile } from "./model.mjs";
type Page = "start" | "settings" | "plan" | "spend" | "home" | "report" | "books" | "profile" | "carryover" | "statement";
type ToastKind = "success" | "error" | "info";
const pages: { id: Page; label: string; short: string; icon: string }[] = [
  { id: "home", label: "Your board", short: "Board", icon: "flow" },
  { id: "spend", label: "Entries", short: "Entries", icon: "plan" },
  { id: "books", label: "Your books", short: "Books", icon: "book" },
  { id: "profile", label: "Your profile", short: "Profile", icon: "person" },
];
function BrandMark({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><path d="M3 27Q10 3 18 20" fill="none" stroke="#28352E" strokeWidth="4" strokeLinecap="round"/><path d="M14 28Q23 6 28 27" fill="none" stroke="#C7D5C0" strokeWidth="4" strokeLinecap="round"/><circle cx="18" cy="6" r="3" fill="#C87963"/></svg>;
}
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
function CategoryInput({
  defaultValue = "",
  onCommit,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "onKeyDown"
> & { onCommit: (value: string) => void }) {
  // Keep drafts local. Reset on commit even if normalization leaves the saved
  // value unchanged and the caller's saved-value key does not remount the input.
  const [draft, setDraft] = useState(defaultValue);
  return (
    <input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={(event) => {
        onCommit(event.currentTarget.value);
        setDraft(defaultValue);
      }}
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
  useEffect(() => watchNativeKeyboard(registerNativeShare), []);
  const book = useBook();
  const [activePage, setPage] = useState<Page | null>(null);
  const [selectedMode, setMode] = useState<Profile | null>(null);
  const [toast, setToast] = useState<{text: string; kind: ToastKind} | null>(null);
  return <ProjectWorkspace key={`${book.budget.id}:${periodId(book.budget)}:${book.budget.startDate}:${book.budget.endDate}`} book={book} mode={selectedMode ?? book.budget.profile} setMode={setMode} activePage={activePage} setPage={setPage} toast={toast} setToast={setToast} />;
}
function ProjectWorkspace({book, mode, setMode, activePage, setPage, toast, setToast}: {
  mode: Profile;
  setMode: (mode: Profile) => void;
  book: ReturnType<typeof useBook>;
  activePage: Page | null;
  setPage: (page: Page | null) => void;
  toast: {text: string; kind: ToastKind} | null;
  setToast: (toast: {text: string; kind: ToastKind} | null) => void;
}) {
  const { budget, library, libraryAction, restoreBooks, setBudget: saveBudget, removeExample, status, error, legacy, recovery } = book;
  function setBudget(next: SetStateAction<Budget>) {
    return saveBudget(next, budget.id,periodId(budget));
  }
  const [setupBookId, setSetupBookId] = useState<string | null>(null);
  const [editingLayout, setEditingLayout] = useState(false);
  const boardController = useRef<NodeBoardHandle>(null);
  const boardScroll = useRef(0);
  const page = activePage ?? (budget.created ? "home" : "start");
  const navigationPage=page==='carryover'?'home':page==='statement'?'spend':page;
  async function download(content: string, name: string, type = "text/markdown") {
    try {
      await saveFile(content, name, type);
      return true;
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        notify("Could not export this file. Please try again.", "error");
      }
      return false;
    }
  }
  const [aiPack, setAiPack] = useState<string | null>(null);
  const storageError = status === "error";
  const [newCategory, setNewCategory] = useState("");
  const [draft, setDraft] = useState({
    payee: "",
    description: "",
    amount: "",
    categoryId: "",
    status: "paid",
    date: budget.startDate && localDate()<budget.startDate?budget.startDate:budget.endDate && localDate()>budget.endDate?budget.endDate:localDate(),
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryManual,setCategoryManual]=useState(false);
  const newCategoryManual=useRef(false);
  const [learnPayee,setLearnPayee]=useState<LearnPayee|null>(null);
  const quietPayees=useRef(new Set<string>());
  const suggestion=!categoryManual&&!editingId?suggestCategory(budget,draft.payee):null;
  const draftCategory=suggestion?.categoryId||draft.categoryId||budget.categories[0]?.id||'';
  const bookName=library.books.find(b=>b.projects.some(p=>p.id===budget.id))?.name??'Example book';
  const [entryFilter, setEntryFilter] = useState("all");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [repeatDraft,setRepeatDraft]=useState<RepeatOptions>({frequency:'none',endDate:'',scope:'this'});
  const [confirmStop,setConfirmStop]=useState(false);
  const newRepeatDraft=useRef(repeatDraft);
  const editingExpense=budget.expenses.find(e=>e.id===editingId);
  const editingRule=budget.repeatRules?.find(r=>r.id===editingExpense?.repeatId);
  const stopHeading=useRef<HTMLHeadingElement>(null);
  const stopTrigger=useRef<HTMLButtonElement>(null);
  const newEntryDraft = useRef(draft);
  const spendingForm = useRef<HTMLFormElement>(null);
  const editingTrigger = useRef<HTMLButtonElement | null>(null);
  const entriesHeading = useRef<HTMLHeadingElement>(null);
  const removalHeading = useRef<HTMLHeadingElement>(null);
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const t = totals(budget);
  const origin=carryoverStatus(budget),sourcePeriod=previousBudgetPeriod(budget);
  const allocated = budget.categories.reduce((s, c) => s + c.amount, 0);
  const unassigned = round(budget.total - allocated);
  const notify = (text: string, kind: ToastKind = "success") =>
    setToast({ text, kind });
  useEffect(() => {
    if (!toast) return;
    if (toast.kind === "error") return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast, setToast]);
  function change(next: Budget, action: string) {
    return setBudget({
      ...next,
      events: [...next.events, { text: action, at: new Date().toISOString() }],
    });
  }
  function go(next: Page) {
    if (editingLayout && next !== "home") {
      if (!window.confirm("Discard this unsaved arrangement? Choose Cancel to return and use Done to save it.")) return;
      boardController.current?.cancelArrange();
      setEditingLayout(false);
    }
    if (next !== "spend" && editingId) closeExpense(false);
    if (page === "home") boardScroll.current = window.scrollY;
    setPage(next);
    window.scrollTo({ top: 0 });
    setTimeout(() => {
      const heading = titleRef.current ?? document.querySelector<HTMLElement>("#main h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({preventScroll:true});
      if (next === "home") window.scrollTo({top: boardScroll.current});
    }, 0);
  }
  function openExpense(expense: Expense, trigger?: HTMLButtonElement) {
    if (editingId === expense.id) {
      spendingForm.current?.scrollIntoView({ block: "start" });
      spendingForm.current?.querySelector("input")?.focus({ preventScroll: true });
      return;
    }
    if (editingId && !window.confirm("Switch entries and discard these unsaved edits?")) return;
    // Opening an entry is not consent to the pending learn offer.
    setLearnPayee(null);
    if (!editingId) {newEntryDraft.current = draft;newRepeatDraft.current=repeatDraft;newCategoryManual.current=categoryManual;}
    editingTrigger.current = trigger ?? null;
    setEditingId(expense.id);
    setConfirmRemoval(false);
    setConfirmStop(false);
    const rule=budget.repeatRules?.find(r=>r.id===expense.repeatId);
    setRepeatDraft({frequency:rule?.frequency??'none',endDate:repeatTiming(budget,expense)?.endDate??'',scope:'this'});
    setDraft({ ...expense, payee:expense.payee??'', amount: String(expense.amount), notes: expense.notes ?? "" });
    setCategoryManual(false);
    requestAnimationFrame(() => {
      spendingForm.current?.scrollIntoView({ block: "start" });
      spendingForm.current?.querySelector("input")?.focus({ preventScroll: true });
    });
  }
  function closeExpense(returnFocus = true) {
    setEditingId(null);
    setConfirmRemoval(false);
    setConfirmStop(false);
    setRepeatDraft(newRepeatDraft.current);
    setDraft(newEntryDraft.current);
    setCategoryManual(newCategoryManual.current);
    if (returnFocus) requestAnimationFrame(() => {
      const target = editingTrigger.current?.isConnected ? editingTrigger.current : entriesHeading.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    });
  }
  function deleteExpense() {
    if (!editingId) return;
    const saved = setBudget((b) => removeExpense(b, editingId));
    closeExpense();
    notify(saved ? "Entry removed. Your totals are up to date; its history stays in the audit trail." : "Entry removed on this page only. Download a book backup before leaving.");
  }
  function updateCategory(id: string, patch: Partial<Category>) {
    setBudget((b) => editCategory(b, id, patch));
  }
  function create(
    details: Pick<Budget, "name" | "total" | "profile" | "period" | "startDate" | "endDate">,
  ) {
    const saved = setBudget(editBudgetDetails(budget, details));
    notify(
      saved
        ? "Budget details saved. Your board is ready."
        : "Budget details are not saved. Download a book backup before leaving.",
      saved ? "success" : "error",
    );
    go("home");
  }
  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Choose an Ellie’s Book backup smaller than 5 MB.");
      if (recovery && !window.confirm("Add these books to a recovered library? Download the saved copy first. The unreadable original will also be retained on this device.")) return;
      const saved = restoreBooks(await file.text());
      go("books");
      notify(
        saved
          ? "Backup added as new books. Your other projects are unchanged."
          : "Backup is not saved. Keep this page open and download all books.",
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
  const backupAll = () => download(serializeLibrary(library), "ellies-book-library.md");
  function newBook(bookId: string | null = null) {
    setSetupBookId(bookId);
    go("start");
  }
  function selectProject(projectId: string) {
    const saved = libraryAction({ type: "select", id: projectId });
    setEditingId(null);
    setDraft({payee:"",description: "", amount: "", categoryId: "", status: "paid", date: localDate(), notes: ""});
    setCategoryManual(false);setLearnPayee(null);
    go("home");
    if (!saved) notify("Project is open on this page only. Download all books before leaving.", "error");
  }
  function addExpense(e: FormEvent) {
    e.preventDefault();
    const amount = round(draft.amount);
    if (!(amount > 0)) return;
    if (!draft.description.trim()) {
      notify("Give this entry a description.");
      return;
    }
    const categoryId = budget.categories.some((c) => c.id === draftCategory)
      ? draftCategory
      : budget.categories[0]?.id;
    if (!categoryId) return;
    if(editingId&&!editingExpense){closeExpense();notify('This entry is no longer available. Choose another entry.','error');return;}
    const expense: Expense = {
      ...editingExpense,
      ...draft,
      categoryId,
      payee:draft.payee.trim(),
      status: draft.status as Expense["status"],
      amount,
      id: editingId??crypto.randomUUID(),
      history: editingExpense?.history??[draft.status],
    };
    let saved;
    try {saved=setBudget(b=>saveRepeatingEntry(b,expense,{...repeatDraft,startDate:draft.date}));}
    catch(error){notify(error instanceof Error?error.message:'Could not save this entry.','error');return;}
    let dismissed=quietPayees.current.has(normalizePayee(expense.payee));
    try {dismissed ||= isPayeeOfferDismissed(sessionStorage,budget,expense.payee??'');} catch {/* Keep the in-page dismissal if session storage is unavailable. */}
    setLearnPayee(saved&&!dismissed&&shouldOfferRule(budget,expense,categoryManual)?{payee:expense.payee!,categoryId,description:expense.description,amount,date:expense.date,status:expense.status}:null);
    if(editingId)closeExpense();
    else {setDraft({...draft,payee:'',description:'',amount:'',notes:'',categoryId:''});setRepeatDraft({frequency:'none',endDate:'',scope:'this'});}
    setCategoryManual(editingId?newCategoryManual.current:false);
    notify(
      saved
        ? `${expense.description} saved as ${expense.status}.${repeatDraft.frequency!=='none'?' Future repeats start Planned.':''}`
        : `${expense.description} added on this page only. Download a book backup before leaving.`,
      saved ? "success" : "error",
    );
  }
  async function share() {
    try {
      if (await shareReport(budget.name, reportText(budget))) {
        notify("Report shared.");
      } else if (navigator.share) {
        await navigator.share({ title: budget.name, text: reportText(budget) });
        notify("Report shared.");
      } else {
        await navigator.clipboard.writeText(reportText(budget));
        notify("Report copied. Paste it into a message or email.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        if (await download(reportText(budget), "budget-report.md")) {
          notify("Your report export is ready instead.");
        }
      }
    }
  }
  const header = (title: string, subtitle: string, action?: ReactNode) => (
    <><header className="page-heading">
      <div>
        <h1 tabIndex={-1} ref={titleRef}>
          {title}
        </h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </header>{budget.created&&['home','spend','plan','settings','report'].includes(page)&&<PeriodSwitcher budget={budget} onSettings={()=>go('settings')} onStart={()=>go('carryover')} onOpen={(id,dates)=>{
      if((editingId||draft.description.trim()||draft.amount||draft.notes.trim())&&!window.confirm('Switch periods and discard these unsaved edits?'))return false;
      try {const saved=setBudget(b=>openPeriod(b,id,dates));if(!saved)notify('This period is open on this page only. Download all books before leaving.','error');return true;}
      catch(error){notify(error instanceof Error?error.message:'Could not open this period.','error');return false;}
    }}/>}</>
  );
  const needsBudget = (!budget.created || budget.profile !== mode) && !["start", "books", "profile"].includes(page);
  const modeLibrary = {...library, books: library.books.map(b=>({...b,projects:b.projects.filter(p=>p.profile===mode)})).filter(b=>b.projects.length)};
  function switchMode(next: Profile) {
    if (next === mode) return;
    if (editingId && !window.confirm("Leave this entry without saving?")) return;
    setMode(next);
    const project=library.books.flatMap(b=>b.projects).find(p=>p.profile===next);
    if (project) selectProject(project.id); else go("books");
  }
  const currentBook = library.books.find(book => book.projects.some(project => project.id === budget.id));
  return (
    <div className={`app-shell project-app-shell${page === "home" ? " board-page" : ""}`} inert={status === "loading" ? true : undefined}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="product-topbar">
        <button
          className="brand"
          onClick={() => go(budget.created ? "home" : "start")}
        >
          <BrandMark size={28} />
          <span>fennuma</span>
        </button>
        <nav aria-label="Main navigation">
          {pages.map((p) => (
            <button
              key={p.id}
              className={navigationPage === p.id ? "nav-item active" : "nav-item"}
              aria-current={navigationPage === p.id ? "page" : undefined}
              onClick={() => go(p.id)}
            >
              <Icon name={p.icon} />
              <span>{p.short}</span>
            </button>
          ))}
        </nav>
        <div className="mode-switch" role="group" aria-label="Budget mode">
          {(["Household","Just me","Team"] as Profile[]).map(m=><button key={m} aria-pressed={mode===m} onClick={()=>switchMode(m)}>{m}</button>)}
        </div>
      </header>
      <div className="main-column">
        {status === "loading" && <p role="status" className="opening-book">Opening book…</p>}
        <main id="main" tabIndex={-1}>
          {budget.sample && (
            <div className="sample-banner">
              <span>
                Example data, not your budget.
              </span>
              <button
                aria-label="Remove example"
                onClick={() => {
                  try {
                    const personal = removeExample();
                    setMode(personal.profile);
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
                Remove <span className="example-remove-full">example</span> <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {storageError && (
            <div className="error" role="alert">
              <p>{error}</p>
              <button className="text-button" onClick={backup}>
                Download current book
              </button>
              <button className="text-button" onClick={backupAll}>Download all books</button>
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
          {legacy && ["start", "books", "profile"].includes(page) && <div className="legacy-notice"><p>Your earlier Function Budget Studio data stays unchanged on this device.</p><button className="secondary" onClick={() => download(legacy,"ellies-book-legacy-copy.json","application/json")}>Download earlier data</button></div>}
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
              {page === "start" && <BookSetup mode={mode} key={`${mode}:${setupBookId || "new-book"}`} book={modeLibrary.books.find(book => book.id === setupBookId)} onCancel={() => go("books")} onExample={() => { setMode("Household"); setBudget(exampleBudget()); go("home"); }} onCreate={(name, project) => {
                const saved = libraryAction(setupBookId ? {type:"project",bookId:setupBookId,project} : {type:"book",name,project});
                setDraft({payee:"",description:"",amount:"",categoryId:"",status:"paid",date:localDate(),notes:""});
                setCategoryManual(false);setLearnPayee(null);
                go("home");
                notify(saved ? "Your project is ready. Welcome to your board." : "Project created on this page only. Download all books before leaving.", saved ? "success" : "error");
              }} />}
              {page === "books" && <BooksPage library={modeLibrary} onNewBook={() => newBook()} onNewProject={id => newBook(id)} onOpen={selectProject} onRestore={restore} onBackup={backupAll} />}
              {page === "profile" && <ProfilePage library={library} onName={name => { const saved = libraryAction({type:"profile", name}); notify(saved ? "Local profile saved." : "Profile is not saved. Download all books before leaving.",saved ? "success":"error"); }} onBackup={backupAll} onProjectBackup={backup} onRestore={restore} onSettings={() => go("settings")} hasProject={budget.created} />}
              {page === 'carryover' && <>{header(budget.budgetSet===false?`Start from ${sourcePeriod?budgetMonth(sourcePeriod).replace(/ \d{4}$/,''):'previous month'}`:'Review carryover',`${budget.name} · ${budgetMonth(budget)} · USD`,<button className="outline-button" onClick={()=>go('home')}>Back to board</button>)}<BudgetStartReview budget={budget} onCancel={()=>go('home')} onConfirm={proposal=>{
                try {const saved=setBudget(b=>confirmBudgetStart(b,proposal));go('home');notify(saved?'Budget approved. Your board is ready.':'Approved on this page only. Download all books before leaving.',saved?'success':'error');return null;}
                catch(error){return error instanceof Error?error.message:'Could not approve this budget.';}
              }}/></>}
              {page === "settings" && (
                <>
                  {header(
                    "Budget settings",
                    `${budget.name} · Approved limit and budget dates`,
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
                      <h2>Category allocations</h2>
                      <p>Allocate this project’s approved limit without creating a second budget.</p>
                      <button className="secondary" onClick={()=>go("plan")}>Edit category allocations</button>
                      {sourcePeriod&&<div className="carryover-actions"><button className="outline-button" onClick={()=>go('carryover')}>{budget.budgetSet===false?'Start from previous month':'Review carryover'}</button></div>}
                      {origin&&<p className="carryover-origin">{origin.changed?`${budgetMonth(origin.source)} changed — review carryover. Approved amounts stay unchanged.`:`Includes ${money(origin.amount)} carryover from ${budgetMonth(origin.source)}. This is a budget adjustment, not income or spending.`}</p>}
                      {budget.notes && <details className="book-backup"><summary>Earlier project notes</summary><p>Preserved from your existing book. Copy relevant details into an entry’s note; nothing has been assigned or removed automatically.</p><div className="markdown-preview">{renderMarkdownDocument(budget.notes)}</div></details>}
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
                    "Category allocations",
                    "Divide the approved budget across categories. Planned spending is entered in Entries.",
                  )}
                  <div className="content-grid">
                    <section className="paper plan-paper">
                      <div className="section-heading">
                        <h2>Your categories</h2>
                        <span>{budget.period}</span>
                      </div>
                      <div className="plan-col-head">
                        <span>What’s it for?</span>
                        <span>Allocation</span>
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
                                aria-label={`${c.name} allocation`}
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
                        <span>Total allocated</span>
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
                        Save allocations
                        <Icon name="check" size={19} />
                      </button>
                    </section>
                    <aside className="summary-aside">
                      <h2>Allocation summary</h2>
                      <p>Approved Budget</p>
                      <strong className="aside-total">
                        {budget.budgetSet===false?'Not set yet':money(budget.total)}
                      </strong>
                      <div className="budget-track">
                        <span
                          style={{
                            width: `${Math.min(100, (allocated / (budget.total || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="split-line">
                        <span>Allocated so far</span>
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
                        onClick={() => go("settings")}
                      >
                        Edit total budget <Icon name="arrow" size={17} />
                      </button>
                    </aside>
                  </div>
                </>
              )}
              {page === 'statement' && <StatementImport key={budget.id+periodId(budget)} book={book} onClose={()=>go('spend')}/>}
              {page === "spend" && (
                <>
                  {header(
                    "Entries",
                    `${budget.name} · Add, correct or change the stage of one entry.`,
                  )}
                  <div className="statement-entry-actions"><button className="secondary" onClick={()=>go('statement')} disabled={storageError}>Import statement</button><p className="hint">CSV, PDF or screenshots. Review before saving as Paid.</p></div>
                  <StatementImportHistory book={book}/>
                  <AutoSort budget={budget} bookName={bookName} offer={learnPayee} onDismiss={quiet=>{if(quiet&&learnPayee){quietPayees.current.add(normalizePayee(learnPayee.payee));try{dismissPayeeOffer(sessionStorage,budget,learnPayee.payee);}catch{/* Optional session-only preference. */}}setLearnPayee(null);requestAnimationFrame(()=>spendingForm.current?.querySelector('input')?.focus({preventScroll:true}));}} save={book.saveAutoSort} disabled={storageError}>{offerContent=>(
                  <div className="content-grid spend-grid">
                    {offerContent || <form ref={spendingForm} className="paper spending-form" onSubmit={addExpense}>
                      <div className="spending-form-heading">
                        <h2>{editingId ? "Edit entry" : "Add entry"}</h2>
                        {editingId && <button type="button" className="text-button" onClick={() => closeExpense()}>Cancel</button>}
                      </div>
                      {editingId && <p className="hint editing-hint">Correct this entry below. Your totals update when you save.</p>}
                      <label className="field">Payee (optional)<input maxLength={100} placeholder="e.g. Netflix" value={draft.payee} onChange={e=>setDraft({...draft,payee:e.target.value})}/></label>
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
                              draftCategory
                            }
                            onChange={(e) =>
                              {setDraft({ ...draft, categoryId: e.target.value });setCategoryManual(true);}
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
                      {suggestion&&<p className="auto-sort-suggestion" role="status">Suggested by your {suggestion.payee} rule. You can choose another category for this entry.</p>}
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
                      <label className="field">Entry note (Markdown)
                        <textarea maxLength={50000} rows={5} value={draft.notes} onChange={e=>setDraft({...draft, notes:e.target.value})} placeholder="Details, receipt reference or [[related entry]]" />
                      </label>
                      <RepeatEditor value={repeatDraft} onChange={setRepeatDraft} date={draft.date} rule={editingRule}/>
                      {editingRule&&<>
                        <div className="repeat-actions">
                          {editingExpense?.status==='planned'&&<button type="button" className="outline-button" onClick={()=>{
                            try {const saved=setBudget(b=>skipOccurrence(b,editingId!));closeExpense();notify(saved?'Occurrence skipped. Other repeats stay scheduled.':'Skipped on this page only. Download all books before leaving.',saved?'success':'error');}catch(error){notify(error instanceof Error?error.message:'Could not skip this occurrence.','error');}
                          }}>Skip this occurrence</button>}
                          <button ref={stopTrigger} type="button" className="outline-button" onClick={()=>{setConfirmStop(true);requestAnimationFrame(()=>stopHeading.current?.focus());}}>Stop repeating</button>
                        </div>
                        {confirmStop&&<section className="repeat-stop-confirmation" aria-labelledby="stop-repeat-title"><h3 id="stop-repeat-title" tabIndex={-1} ref={stopHeading}>Stop after this occurrence?</h3><p>Later Planned repeats will be removed. This entry, past history and any Committed or Paid entries stay unchanged. Unsaved edits above will not be applied.</p><div className="repeat-actions"><button type="button" className="outline-button" onClick={()=>{setConfirmStop(false);requestAnimationFrame(()=>stopTrigger.current?.focus());}}>Keep repeating</button><button type="button" className="outline-button danger-button" onClick={()=>{
                          try {const saved=setBudget(b=>stopRepeating(b,editingId!));closeExpense();notify(saved?'Repeat stopped. Previous entries and history kept.':'Stopped on this page only. Download all books before leaving.',saved?'success':'error');}catch(error){notify(error instanceof Error?error.message:'Could not stop this repeat.','error');}
                        }}>Yes, stop repeating</button></div></section>}
                      </>}
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
                        {editingId ? "Save changes" : "Save entry"} <Icon name="check" size={19} />
                      </button>
                      {editingId && (
                        confirmRemoval ? (
                          <section className="remove-entry-confirmation" aria-labelledby="remove-entry-heading">
                            <h3 id="remove-entry-heading" ref={removalHeading} tabIndex={-1}>Remove “{budget.expenses.find((e) => e.id === editingId)?.description}”?</h3>
                            <p>It will no longer count in your totals or report. The original entry stays in your audit trail.</p>
                            <div className="remove-entry-actions">
                              <button type="button" className="secondary" onClick={() => {
                                setConfirmRemoval(false);
                                requestAnimationFrame(() => removeTrigger.current?.focus());
                              }}>Keep entry</button>
                              <button type="button" className="secondary danger-button" onClick={deleteExpense}>Yes, remove entry</button>
                            </div>
                          </section>
                        ) : (
                          <button ref={removeTrigger} type="button" className="text-button remove-entry" onClick={() => {
                            setConfirmRemoval(true);
                            requestAnimationFrame(() => removalHeading.current?.focus());
                          }}>Remove entry</button>
                        )
                      )}
                    </form>}
                    <section className="recent-spending">
                      <div className="entry-filters" role="group" aria-label="Filter entries">{["all","planned","committed","paid"].map(s=><button key={s} className="outline-button" aria-pressed={entryFilter===s} onClick={()=>setEntryFilter(s)}>{s[0].toUpperCase()+s.slice(1)}</button>)}</div>
                      <div className="section-heading">
                        <h2 ref={entriesHeading} tabIndex={-1}>In your book</h2>
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
                        [...budget.expenses].reverse().filter(e=>entryFilter==="all" || e.status===entryFilter).map((e) => (
                          <article className="expense-row" key={e.id}>
                            <button
                              type="button"
                              className={`expense-edit${editingId === e.id ? " is-editing" : ""}`}
                              aria-label={`Edit ${e.description}, ${money(e.amount)}, ${e.status}`}
                              aria-pressed={editingId === e.id}
                              onClick={(event) => openExpense(e, event.currentTarget)}
                            >
                            <span className="expense-top">
                              <strong>{e.description}</strong>
                              <strong>{money(e.amount)}</strong>
                            </span>
                            <span className="expense-meta">
                              <span>
                                {
                                  budget.categories.find(
                                    (c) => c.id === e.categoryId,
                                  )?.name
                                }{" "}
                                · <time dateTime={e.date}>{displayDate(e.date)}</time>
                              </span>
                              <Stage value={e.status}/>
                            </span>
                            <RepeatTiming budget={budget} entry={e}/>
                            <span className="expense-edit-label">{editingId === e.id ? "Editing entry" : "Edit entry"}<Icon name="arrow" size={15} /></span>
                            </button>
                            {e.status !== "paid" && (
                              <button
                                className="text-button"
                                disabled={editingId === e.id}
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
                  </div>)}</AutoSort>
                </>
              )}
              {budget.created && (
                <section hidden={page !== "home"}>
                  {page === "home" && header(
                    "Board",
                    `${currentBook ? `${currentBook.name} / ` : ""}${budget.name} · ${budget.period}`,
                    <button className="primary heading-action canvas-add-entry" onClick={() => go("spend")}>
                      <Icon name="plus" size={19} /> Add entry
                    </button>,
                  )}
                  <ProjectGarden
                    scope={`${currentBook?.name ? `${currentBook.name} / ` : ""}${budget.name}`}
                    key={`${budget.id}:${periodId(budget)}`}
                    budget={budget}
                    setBudget={setBudget}
                    storageError={storageError}
                    onPlan={() => go("plan")}
                    onSettings={() => go("settings")}
                    onCarryover={() => go('carryover')}
                    onSpend={(categoryId) => {
                      if (categoryId) setDraft(d => ({ ...d, categoryId }));
                      go("spend");
                    }}
                    onExpense={(expense) => { go("spend"); openExpense(expense); }}
                    onReport={() => go("report")}
                    onBackup={backup}
                  />
                  <details className="audit board-audit" open={!budget.events.length}>
                    <summary>Activity & audit trail</summary>
                    {budget.events.length ? [...budget.events].reverse().map((ev, i) => (
                      <p key={i}>{ev.text.split(/(-?\$[\d,]+\.\d{2})/g).map((part,index)=>index%2?<span className="money" key={index}>{part}</span>:part)}<small>{new Date(ev.at).toLocaleString()}</small></p>
                    )) : <p>No changes recorded yet.</p>}
                  </details>
                </section>
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
                        <BrandMark size={24} />
                        fennuma<span>Budget check-in</span>
                      </div>
                      <h2>{budget.name}</h2>
                      <p className="report-period">
                        {budget.period} · {budget.profile}{budget.startDate && <> · {budget.startDate} — {budget.endDate}</>}
                      </p>
                      <p className="report-story">
                        {budget.budgetSet===false?<>This period’s budget is not set yet. So far, we’ve </>:<>We’re working with <strong>{money(budget.total)}</strong>. So far, we’ve </>}
                        paid <strong>{money(t.spent)}</strong>, with{" "}
                        <strong>{money(t.committed)}</strong> still to pay.
                      </p>
                      <div className="report-left">
                        <span>
                          {budget.budgetSet===false?'Room left needs':t.left < 0
                            ? "That puts us over by"
                            : "That leaves us"}
                        </span>
                        <strong>{budget.budgetSet===false?'a budget first':money(Math.abs(t.left))}</strong>
                        <span>
                          {budget.budgetSet===false?'Set this period’s approved limit in Budget settings.':t.left < 0
                            ? "after existing commitments."
                            : "after existing commitments."}
                        </span>
                      </div>
                      <h3>Here’s how it breaks down</h3>
                      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the scrollable table. */}
                      <div className="report-table-wrap" role="region" aria-label="Category budget breakdown" tabIndex={0}>
                        <table>
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Allocation</th>
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
                                  <td>{budget.budgetSet===false?'Not set':money(c.amount)}</td>
                                  <td>{money(s.spent)}</td>
                                  <td className={budget.budgetSet!==false&&s.left < 0 ? "negative" : ""}>
                                    {budget.budgetSet===false?'Not set':money(s.left)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="report-footnote">
                        Spent means paid. Left includes bills still to pay.{" "}
                        {budget.budgetSet===false?'Budget and allocations have not been set.':<>{money(Math.abs(unassigned))}{" "}
                        {unassigned < 0
                          ? "is allocated above the approved budget."
                          : "of the total budget is not assigned to categories."}</>}
                      </p>
                      <h3>Entry notes</h3>
                      {origin&&<p className="carryover-origin">Approved Budget includes {money(origin.amount)} carryover from {budgetMonth(origin.source)}. This is a budget adjustment, not income or spending.{origin.changed?' The previous month changed; review carryover before relying on it.':''}</p>}
                      <div className="report-entry-notes">
                        {budget.expenses.some(e=>e.notes) ? budget.expenses.filter(e=>e.notes).map(e=><section key={e.id} className="report-notes"><h4>{e.description}</h4>{renderMarkdownDocument(e.notes!)}</section>) : <p>No entry notes yet.</p>}
                      </div>
                      <h3>What we want to remember</h3>
                      <div className="report-notes">
                        {budget.notes
                          ? renderMarkdownDocument(budget.notes)
                          : <p>No notes added yet.</p>}
                      </div>
                      <footer>
                        Left = budget − paid − still to pay.
                        <br />
                        Prepared with Fennuma · Saved locally, shared by
                        you.
                      </footer>
                    </article>
                    <aside className="report-actions">
                      <h2>Keep everyone in the loop.</h2>
                      <p>
                        Send this check-in to your partner, your team, or your
                        future self.
                      </p>
                      <button className="secondary full" onClick={() => setAiPack(buildAiReadyPack(budget))}>
                        Ask AI <Icon name="share" size={18} />
                      </button>
                      <button
                        className="secondary full"
                        onClick={async () => {
                          try {
                            await printReport();
                          } catch {
                            notify("Could not open printing. Please try again.", "error");
                          }
                        }}
                      >
                        Print / save as PDF
                        <Icon name="download" size={18} />
                      </button>
                      <button
                        className="secondary full"
                        onClick={async () => {
                          if (await download(reportText(budget), "budget-report.md")) {
                            notify("Report export ready.");
                          }
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
                          className="outline-button"
                          onClick={async () => {
                            if (await download(
                              csvText(budget),
                              "budget-finance.csv",
                              "text/csv;charset=utf-8",
                            )) notify("Finance CSV exported.");
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
                        <button className="secondary" onClick={backup}>
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
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {pages.map((p) => (
          <button
            key={p.id}
            aria-current={navigationPage === p.id ? "page" : undefined}
            className={navigationPage === p.id ? "active" : ""}
            onClick={() => go(p.id)}
          >
            <Icon name={p.icon} />
            <span>{p.short}</span>
          </button>
        ))}
      </nav>
      {aiPack !== null && <AskAiSheet pack={aiPack} book={budget} onClose={() => setAiPack(null)} />}
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
    details: Pick<Budget, "name" | "total" | "period" | "profile" | "startDate" | "endDate">,
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
      startDate: budget.startDate,
      endDate: budget.endDate,
    });
  }
  return (
    <form className="paper start-form" onSubmit={create}>
      <h2>
        {budget.created ? "Your budget details" : "Let’s start your budget"}
      </h2>
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
      <div className="form-pair budget-dates">
        <label className="field">Start date<input required type="date" value={budget.startDate ?? ""} onChange={e=>setBudget({...budget,startDate:e.target.value})} /></label>
        <label className="field">End date<input required type="date" min={budget.startDate} value={budget.endDate ?? ""} onChange={e=>setBudget({...budget,endDate:e.target.value})} /></label>
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
