"use client";
import {suggestStatementCategory} from './auto-sort-model.mjs';
/* Source previews are temporary blob URLs, never remote image-optimizer inputs. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { money } from "./model.mjs";
import { periodId } from "./repeat-model.mjs";
import {
  statementAccounts,
  reviewStatement,
  type StatementRow,
  type StatementRequest,
  type StatementBatch,
} from "./statement-model.mjs";
import {
  inspectCsv,
  parseStatementCsv,
  extractStatementLines,
  type StatementOptions,
} from "./statement-parse.mjs";
import type { StatementSource, ImageCrop } from "./statement-reader";
import type { useBook } from "./use-book";
import "./statement-import.css";
type Book = ReturnType<typeof useBook>;
type Shot = { id: string; file: File; url: string };
const blankCrop: ImageCrop = { x: 0, y: 0, width: 100, height: 100, turns: 0 };
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Could not finish. Try again; nothing was imported.";
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
function PaidSummary({
  added,
  matched,
  linked,
  amount,
}: {
  added: number;
  matched: number;
  linked: number;
  amount: number;
}) {
  return (
    <>
      <p>
        {plural(added, "new Paid entry", "new Paid entries")} ·{" "}
        {plural(
          matched,
          "existing bill marked Paid",
          "existing bills marked Paid",
        )}{" "}
        · {linked} linked to Paid
      </p>
      <p>
        Newly recorded as Paid:{" "}
        <span className="statement-money">{money(amount)}</span>
      </p>
    </>
  );
}
function CropControls({
  apply,
}: {
  apply: (crop: ImageCrop) => Promise<void>;
}) {
  const [crop, setCrop] = useState(blankCrop),
    [busy, setBusy] = useState(false);
  return (
    <details className="statement-crop">
      <summary>Crop edges</summary>
      <p className="hint">
        Percent of the image to keep. Remove names or balances if they get in
        the way.
      </p>
      <div className="statement-fields">
        {(["x", "y", "width", "height"] as const).map((k) => (
          <label className="field" key={k}>
            {{ x: "Left", y: "Top", width: "Width", height: "Height" }[k]} (%)
            <input
              type="number"
              min={0}
              max={100}
              value={crop[k]}
              onChange={(e) =>
                setCrop({ ...crop, [k]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await apply(crop);
          } finally {
            setBusy(false);
          }
        }}
      >
        Apply crop
      </button>
    </details>
  );
}
export function StatementImportHistory({ book }: { book: Book }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const batches =
    book.budget.statementImports?.batches
      .filter((b) => !b.undone)
      .slice(-10)
      .reverse() ?? [];
  if (!batches.length) return null;
  return (
    <details className="paper statement-history">
      <summary>Recent statement imports</summary>
      <p className="hint">
        Undo removes new entries and restores matched bills. Later changes are
        protected.
      </p>
      {batches.map((batch) => (
        <div className="statement-history-row" key={batch.id}>
          <span>
            {
              book.budget.statementImports?.accounts.find(
                (a) => a.id === batch.accountId,
              )?.label
            }{" "}
            · {plural(batch.items.length, "payment", "payments")}
            <br />
            <small>
              {new Date(batch.at).toLocaleDateString()} · {batch.period}
            </small>
          </span>
          <button
            className="secondary"
            disabled={!!busy}
            onClick={async () => {
              setBusy(batch.id);
              setError("");
              try {
                await book.undoStatement(book.budget.id, batch.id);
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy("");
              }
            }}
          >
            Undo import
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
export default function StatementImport({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const { budget, library } = book,
    accounts = statementAccounts(library, budget.id);
  const [step, setStep] = useState<
    "choose" | "images" | "reading" | "columns" | "rows" | "review" | "done"
  >("choose");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "new"),
    [accountLabel, setAccountLabel] = useState(""),
    [newAccountId] = useState(() => crypto.randomUUID());
  const [batchId] = useState(() => crypto.randomUUID()),
    [sources, setSources] = useState<StatementSource[]>([]),
    [shots, setShots] = useState<Shot[]>([]),
    [rows, setRows] = useState<StatementRow[]>([]),
    [index, setIndex] = useState(0),
    [group, setGroup] = useState("needs"),
    [page, setPage] = useState(0);
  const [options, setOptions] = useState<StatementOptions>({
    sourceId: "",
    dateOrder: "DMY",
    decimal: ".",
    outSign: "negative",
    currencyCode: "USD",
    date: 0,
    description: 1,
    amount: 2,
    out: 2,
    in: undefined,
    amountFromEnd: 0,
  });
  const [split, setSplit] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<StatementBatch | null>(null);
  const [unlock, setUnlock] = useState<{
      wrong: boolean;
      resolve: (s: string | null) => void;
    } | null>(null),
    [password, setPassword] = useState("");
  const work = useRef<AbortController | null>(null),
    urls = useRef(new Set<string>()),
    pendingPassword = useRef<((s: string | null) => void) | null>(null),
    saving = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    passwordField = useRef<HTMLInputElement>(null),
    inputs = useRef<(HTMLInputElement | null)[]>([]);
  const account =
    accountId === "new"
      ? { id: newAccountId, label: accountLabel.trim() }
      : accounts.find((a) => a.id === accountId)!;
  const destination =
    library.books.find((b) => b.projects.some((p) => p.id === budget.id))
      ?.name ?? "Example book";
  const request: StatementRequest = {
    id: batchId,
    projectId: budget.id,
    period: periodId(budget),
    account,
    rows,
  };
  const review = reviewStatement(library, request),
    counts = Object.fromEntries(
      ["ready", "needs", "already", "left"].map((k) => [
        k,
        review.filter((r) => r.state === k).length,
      ]),
    );
  const selected = rows[index],
    checked = review[index],
    csv = sources.find((s) => s.kind === "csv"),
    headers = csv ? inspectCsv(csv.csv!).headers : [];
  function clearUrls() {
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current.clear();
  }
  function url(blob: Blob) {
    const u = URL.createObjectURL(blob);
    urls.current.add(u);
    return u;
  }
  useEffect(
    () => () => {
      work.current?.abort();
      pendingPassword.current?.(null);
      for (const u of urls.current) URL.revokeObjectURL(u);
    },
    [],
  );
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => {
    if (unlock) passwordField.current?.focus();
  }, [unlock]);
  function patch(patch: Partial<StatementRow>) {
    setRows((current) =>
      current.map((r, i) =>
        i === index ? suggestStatementCategory(budget, r, {...patch, checked: false}) : r,
      ),
    );
    setError("");
  }
  function leave() {
    work.current?.abort();
    pendingPassword.current?.(null);
    setPassword("");
    clearUrls();
    onClose();
  }
  async function read(files: File[]) {
    if (!account.label) {
      setError(
        "First name this account, so repeat imports are checked together.",
      );
      return;
    }
    if (files.length > 1 && files.some((f) => /\.csv$/i.test(f.name))) {
      setError("Read one CSV at a time. PDFs or screenshots can be grouped.");
      return;
    }
    const controller = new AbortController();
    work.current = controller;
    setError("");
    setStep("reading");
    try {
      const { readStatementFiles } = await import("./statement-reader");
      const readSources = await readStatementFiles(files, {
        signal: controller.signal,
        url,
        progress: setProgress,
        password: (wrong) =>
          new Promise((resolve) => {
            pendingPassword.current = resolve;
            setPassword("");
            setUnlock({ wrong, resolve });
          }),
      });
      if (controller.signal.aborted) return;
      for (const source of readSources) if (source.csv) inspectCsv(source.csv);
      setSources(readSources);
      setShots([]);
      setStep("columns");
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(
          "Could not read this file. " +
            message(e) +
            " You can try screenshots, a smaller export, or add entries by hand.",
        );
        setStep("choose");
      }
    } finally {
      pendingPassword.current = null;
      setUnlock(null);
      setPassword("");
    }
  }
  function choose(files: File[]) {
    setError("");
    if (!files.length) return;
    if (!account.label) {
      setError("First name this account.");
      return;
    }
    if (
      files.length > 8 ||
      files.some((f) => f.size > 10 * 1024 * 1024) ||
      files.reduce((s, f) => s + f.size, 0) > 30 * 1024 * 1024
    ) {
      setError(
        "Choose up to 8 files, each under 10 MB and under 30 MB together.",
      );
      return;
    }
    if (files.every((f) => /\.(png|jpe?g)$/i.test(f.name))) {
      setShots(
        files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          url: url(file),
        })),
      );
      setStep("images");
    } else void read(files);
  }
  async function editShot(shot: Shot, crop: ImageCrop) {
    setError("");
    try {
      const { prepareStatementImage } = await import("./statement-reader"),
        blob = await prepareStatementImage(shot.file, crop);
      setShots((current) =>
        current.map((s) =>
          s.id === shot.id
            ? {
                ...s,
                file: new File(
                  [blob],
                  shot.file.name.replace(/\.[^.]+$/, ".png"),
                  { type: "image/png" },
                ),
                url: url(blob),
              }
            : s,
        ),
      );
    } catch (e) {
      setError(message(e));
    }
  }
  function buildRows() {
    try {
      let draft = sources.flatMap((s, i) =>
        s.kind === "csv"
          ? parseStatementCsv(s.csv!, {
              ...options,
              sourceId: s.hash,
              sourceIndex: i,
              ...(split
                ? {
                    amount: undefined,
                    out: options.out,
                    in: options.in,
                  }
                : { out: undefined, in: undefined }),
            })
          : s.pages.flatMap((p) =>
              extractStatementLines(p.lines, {
                ...options,
                sourceId: s.hash,
                sourceIndex: i,
                page: p.number,
              }).map((r) => ({
                ...r,
                sourceId: `${s.hash}:${p.number * 10000 + Number(r.sourceId.split(":").at(-1))}`,
              })),
            ),
      );
      if (draft.length > 1000)
        throw new Error(
          "Read up to 1,000 payment rows at a time. Choose a smaller statement.",
        );
      draft = draft.map((r) => suggestStatementCategory(budget, {
        ...r,
        categoryId: budget.categories[0]?.id ?? "",
      }));
      setRows(draft);
      setIndex(0);
      setStep("rows");
      setError(
        draft.length
          ? ""
          : "No payment rows were found. Add a row below, or try clearer screenshots.",
      );
    } catch (e) {
      setError(message(e));
    }
  }
  function nextRow(skip = false) {
    setRows((current) =>
      current.map((r, i) =>
        i === index
          ? {
              ...r,
              checked: true,
              ...(skip ? { decision: "skip" as const } : {}),
            }
          : r,
      ),
    );
    if (index < rows.length - 1) setIndex(index + 1);
    else {
      setStep("review");
      setGroup("needs");
      setPage(0);
    }
  }
  async function confirm() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await book.importStatement(request),
        p =
          next.books
            .flatMap((b) => b.projects)
            .find((p) => p.id === budget.id) ?? next.example,
        batch = p?.statementImports?.batches.find((b) => b.id === batchId);
      if (!batch)
        throw new Error(
          "Could not find the saved import. Reopen Entries to check.",
        );
      setResult(batch);
      setSources([]);
      setRows([]);
      clearUrls();
      setStep("done");
    } catch (e) {
      setError(message(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function manual() {
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        sourceId: `manual:${batchId}:${current.length + 1}`,
        date: "",
        description: "",
        amount: 0,
        currency: "USD",
        direction: "unknown",
        checked: false,
        categoryId: budget.categories[0]?.id ?? "",
        decision: "new",
        sourceIndex: 0,
        page: 1,
        raw: "Added by hand. Check against your statement.",
      },
    ]);
    setIndex(rows.length);
    setStep("rows");
  }
  const changeOption = (key: keyof StatementOptions, value: string) =>
    setOptions({ ...options, [key]: value });
  const column = (
    title: string,
    k: "date" | "description" | "amount" | "out" | "in" | "currency" | "bankId" | "payee",
    optional = false,
  ) => (
    <label className="field">
      {title}
      <select
        value={
          options[k] !== undefined && options[k]! < headers.length
            ? options[k]
            : ""
        }
        onChange={(e) =>
          setOptions({
            ...options,
            [k]: e.target.value === "" ? undefined : Number(e.target.value),
          })
        }
      >
        <option value="">
          {optional ? "Not in this file" : "Choose a column"}
        </option>
        {headers.map((h, i) => (
          <option value={i} key={i}>
            {i + 1}. {h || "Unnamed column"}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="statement-flow" aria-label="Import statement">
      <div className="statement-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            {step === "done"
              ? "Statement imported"
              : unlock
                ? "Open your statement"
                : step === "rows"
                  ? "Check the reading"
                  : step === "review"
                    ? "Review payments"
                    : "Import statement"}
          </h1>
          <p className="hint">
            {budget.profile} · {destination} / {budget.name} ·{" "}
            {periodId(budget)} · USD
          </p>
        </div>
        <button className="secondary" disabled={busy} onClick={leave}>
          {step === "done" ? "View entries" : "Cancel import"}
        </button>
      </div>
      {error && (
        <p className="statement-error" role="alert">
          {error}
        </p>
      )}
      {step === "choose" && (
        <>
          <div className="paper statement-destination">
            <h2>
              {accounts.length
                ? "Choose the bank account"
                : "Name the bank account"}
            </h2>
            {accounts.length > 0 && (
              <label className="field">
                Bank account
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                  <option value="new">Name a new account</option>
                </select>
              </label>
            )}
            {accountId === "new" && (
              <label className="field">
                Account label
                <input
                  maxLength={80}
                  value={accountLabel}
                  placeholder="e.g. Joint checking"
                  aria-label="Account label"
                  onChange={(e) => setAccountLabel(e.target.value)}
                />
                <small>
                  A nickname, not your account number. Use the same label next
                  time.
                </small>
              </label>
            )}
          </div>
          <div
            className="paper statement-source-list"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose([...e.dataTransfer.files]);
            }}
          >
            <h2>Choose a statement</h2>
            <p>
              Bring in payments with less typing. Nothing saves until you check
              and confirm.
            </p>
            {!account.label && (
              <p className="hint">
                First, name the account above to enable file choices.
              </p>
            )}
            <p className="hint">
              Drop files here, or choose below. Up to 8 files; 10 MB each, 30 MB
              together.
            </p>
            {[
              {
                title: "CSV file",
                copy: "A bank table with dates and amounts.",
                accept: ".csv",
                many: false,
              },
              {
                title: "PDF statement",
                copy: "Including password-protected or scanned pages.",
                accept: ".pdf",
                many: true,
              },
              {
                title: "Screenshots",
                copy: "PNG or JPG. Check, crop and order them first.",
                accept: ".png,.jpg,.jpeg",
                many: true,
              },
            ].map((s, i) => (
              <div className="statement-source" key={s.title}>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.copy}</p>
                </div>
                <button
                  type="button"
                  className="secondary"
                  disabled={!account.label}
                  onClick={() => inputs.current[i]?.click()}
                >
                  Choose{" "}
                  {s.title === "CSV file"
                    ? "CSV"
                    : s.title === "PDF statement"
                      ? "PDF"
                      : "images"}
                </button>
                <input
                  hidden
                  ref={(e) => {
                    inputs.current[i] = e;
                  }}
                  aria-label={"Choose " + s.title}
                  type="file"
                  accept={s.accept}
                  multiple={s.many}
                  onChange={(e) => {
                    choose([...(e.target.files ?? [])]);
                    e.target.value = "";
                  }}
                />
              </div>
            ))}
          </div>
          <p className="hint">
            Destination dates: {budget.startDate ?? budget.period} –{" "}
            {budget.endDate ?? budget.period}. To change the destination, cancel
            and open it in Books first. Read on this device only. No bank login,
            cloud reading, or saved passwords. Source pages are discarded when
            you leave. Only reviewed spending and its duplicate-check history
            are saved. USD spending only; income, refunds and transfers stay
            out.
          </p>
        </>
      )}
      {step === "images" && (
        <>
          <p>
            Put the screenshots in reading order. Overlapping payments will be
            checked again. Reading works best with clear English text and
            numeric dates.
          </p>
          <div className="statement-shots">
            {shots.map((shot, i) => (
              <div className="paper statement-shot" key={shot.id}>
                <h2>Image {i + 1}</h2>
                <img src={shot.url} alt={"Statement image " + (i + 1)} />
                <div className="statement-actions">
                  <button
                    className="secondary"
                    disabled={!i}
                    onClick={() =>
                      setShots((current) => {
                        const next = [...current];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return next;
                      })
                    }
                  >
                    Move up
                  </button>
                  <button
                    className="secondary"
                    disabled={i === shots.length - 1}
                    onClick={() =>
                      setShots((current) => {
                        const next = [...current];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        return next;
                      })
                    }
                  >
                    Move down
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      void editShot(shot, { ...blankCrop, turns: 1 })
                    }
                  >
                    Rotate right
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      setShots((current) =>
                        current.filter((s) => s.id !== shot.id),
                      )
                    }
                  >
                    Remove image
                  </button>
                </div>
                <CropControls apply={(crop) => editShot(shot, crop)} />
              </div>
            ))}
          </div>
          <div className="statement-actions">
            <button
              className="primary"
              disabled={!shots.length}
              onClick={() => void read(shots.map((s) => s.file))}
            >
              Read these images
            </button>
            <button
              className="secondary"
              onClick={() => {
                setShots([]);
                clearUrls();
                setStep("choose");
              }}
            >
              Choose other files
            </button>
          </div>
        </>
      )}
      {step === "reading" &&
        (unlock ? (
          <form
            className="paper statement-unlock"
            onSubmit={(e) => {
              e.preventDefault();
              const answer = password;
              setPassword("");
              pendingPassword.current = null;
              unlock.resolve(answer);
              setUnlock(null);
            }}
          >
            <h2>This PDF has a password</h2>
            <p>
              Use the password your bank gave you. It opens this file only and
              is never saved or backed up.
            </p>
            {unlock.wrong && (
              <p role="alert">
                That password did not open the PDF. Try again, or cancel and use
                screenshots.
              </p>
            )}
            <label className="field">
              PDF password
              <input
                ref={passwordField}
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="primary" type="submit">
              Open PDF
            </button>
          </form>
        ) : (
          <div className="paper statement-progress" role="status">
            <h2>Reading on this device</h2>
            <p>{progress}</p>
            <p className="hint">
              Nothing has been added. You can cancel at any time.
            </p>
          </div>
        ))}
      {step === "columns" && (
        <div className="paper statement-columns">
          <h2>
            {csv ? "Check your columns" : "How does your bank write payments?"}
          </h2>
          <p>
            These choices affect every row. You’ll check each payment against
            its source next.
          </p>
          <div className="statement-fields">
            <label className="field">
              Date order
              <select
                value={options.dateOrder}
                onChange={(e) => changeOption("dateOrder", e.target.value)}
              >
                <option value="DMY">Day / month / year</option>
                <option value="MDY">Month / day / year</option>
                <option value="YMD">Year / month / day</option>
              </select>
            </label>
            <label className="field">
              Decimal mark
              <select
                value={options.decimal}
                onChange={(e) => changeOption("decimal", e.target.value)}
              >
                <option value=".">Point: 1,234.56</option>
                <option value=",">Comma: 1.234,56</option>
              </select>
            </label>
            <label className="field">
              Spending amounts are
              <select
                value={options.outSign}
                onChange={(e) => changeOption("outSign", e.target.value)}
              >
                <option value="negative">Negative (−24.90)</option>
                <option value="positive">Positive (24.90)</option>
              </select>
            </label>
            <label className="field">
              Currency
              <input value="USD — US dollars" readOnly />
            </label>
          </div>
          {csv ? (
            <>
              <label className="statement-check">
                <input
                  type="checkbox"
                  checked={split}
                  onChange={(e) => setSplit(e.target.checked)}
                />
                My file has separate money-out and money-in columns
              </label>
              <div className="statement-fields">
                {column("Date column", "date")}
                {column("Description column", "description")}
                {column("Payee column (optional)", "payee", true)}
                {split ? (
                  <>
                    {column("Money out column", "out")}
                    {column("Money in column", "in", true)}
                  </>
                ) : (
                  column("Amount column", "amount")
                )}
                {column("Currency column", "currency", true)}
                {column("Bank transaction ID column", "bankId", true)}
              </div>
              <details>
                <summary>See the first rows</summary>
                <pre className="statement-raw">
                  {inspectCsv(csv.csv!)
                    .records.slice(0, 3)
                    .map((r) => r.join(" · "))
                    .join("\n")}
                </pre>
              </details>
            </>
          ) : (
            <>
              <label className="field">
                Payment amount, counting from the right
                <select
                  value={options.amountFromEnd}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      amountFromEnd: Number(e.target.value),
                    })
                  }
                >
                  <option value={0}>Last amount</option>
                  <option value={1}>Second last (balance is last)</option>
                  <option value={2}>Third last</option>
                </select>
              </label>
              <p className="hint">
                Balances can look like payments. Look at the statement and
                choose the payment column, then check every row. Unclear rows
                can be corrected or left out. English recognition; other text
                may need manual entry.
              </p>
              {sources[0]?.pages[0]?.preview && (
                <img
                  className="statement-page-small"
                  src={sources[0].pages[0].preview}
                  alt="First page to check the payment column"
                />
              )}
            </>
          )}
          <button className="primary" onClick={buildRows}>
            Check extracted rows
          </button>
        </div>
      )}
      {step === "rows" && (
        <>
          {!selected ? (
            <div className="paper">
              <h2>No rows to check yet</h2>
              <p>Add the payments by hand or choose another file.</p>
              <button className="secondary" onClick={manual}>
                Add a row by hand
              </button>
            </div>
          ) : (
            <>
              <div className="statement-row-nav">
                <strong>
                  Row {index + 1} of {rows.length}
                </strong>
                <div className="statement-actions">
                  <button
                    className="secondary"
                    disabled={!index}
                    onClick={() => setIndex(index - 1)}
                  >
                    Previous row
                  </button>
                  <button
                    className="secondary"
                    disabled={index === rows.length - 1}
                    onClick={() => setIndex(index + 1)}
                  >
                    Next row
                  </button>
                </div>
              </div>
              <div className="statement-reading-grid">
                <aside className="paper statement-source-preview">
                  <h2>On your statement</h2>
                  <p className="hint">
                    {sources[selected.sourceIndex ?? 0]?.name ?? "Statement"} ·
                    Page {selected.page ?? 1}
                  </p>
                  {sources[selected.sourceIndex ?? 0]?.pages.find(
                    (p) => p.number === selected.page,
                  )?.preview && (
                    <a
                      href={
                        sources[selected.sourceIndex ?? 0].pages.find(
                          (p) => p.number === selected.page,
                        )!.preview
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open full source image
                    </a>
                  )}
                  {sources[selected.sourceIndex ?? 0]?.pages.find(
                    (p) => p.number === selected.page,
                  )?.preview && (
                    <img
                      src={
                        sources[selected.sourceIndex ?? 0].pages.find(
                          (p) => p.number === selected.page,
                        )!.preview
                      }
                      alt="Source statement page for this row"
                    />
                  )}
                  <pre className="statement-raw">{selected.raw}</pre>
                  <p className="hint">
                    Check the payment amount, not the running balance. Source
                    files and images are not kept after this import.
                  </p>
                </aside>
                <div className="paper statement-row-editor">
                  <h2>
                    {selected.checked
                      ? "Checked reading"
                      : "Does this look right?"}
                  </h2>
                  <p className="hint">{checked.reason}</p>
                  <label className="field">
                    Bank wording
                    <input
                      maxLength={100}
                      value={selected.description}
                      onChange={(e) => patch({ description: e.target.value })}
                    />
                  </label>
                  <div className="statement-fields">
                    <label className="field">Payee (optional)<input maxLength={100} value={selected.payee??selected.description} onChange={e=>patch({payee:e.target.value})}/></label>
                    <label className="field">
                      Payment date
                      <input
                        type="date"
                        value={selected.date}
                        onChange={(e) => patch({ date: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Payment amount (USD)
                      <input
                        inputMode="decimal"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="1000000000"
                        value={selected.amount || ""}
                        onChange={(e) =>
                          patch({ amount: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="field">
                      Currency
                      <input
                        maxLength={3}
                        value={selected.currency}
                        onChange={(e) =>
                          patch({ currency: e.target.value.toUpperCase() })
                        }
                      />
                    </label>
                    <label className="field">
                      This row is
                      <select
                        value={selected.direction}
                        onChange={(e) =>
                          patch({
                            direction: e.target
                              .value as StatementRow["direction"],
                          })
                        }
                      >
                        <option value="unknown">Choose money direction</option>
                        <option value="out">Spending — money out</option>
                        <option value="in">Income or refund — leave out</option>
                        <option value="transfer">Transfer — leave out</option>
                      </select>
                    </label>
                    <label className="field">
                      Category
                      <select
                        value={selected.categoryId}
                        onChange={(e) => patch({ categoryId: e.target.value })}
                      >
                        <option value="">Choose a category</option>
                        {budget.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {selected.decision==='new'&&selected.suggestedBy&&<p className="auto-sort-suggestion">Suggested by your {selected.suggestedBy} rule. The category stays editable; check the reading before including this row.</p>}
                  {checked.candidates.length > 0 && (
                    <div className="statement-matches">
                      <h3>Could one of these be this payment?</h3>
                      <p className="hint">
                        A match marks an open bill Paid. An existing Paid
                        payment is linked, never added again.
                      </p>
                      {checked.candidates.slice(0, 12).map((c) => (
                        <div
                          className="statement-match"
                          key={c.projectId + c.period + c.id}
                        >
                          <span>
                            <strong>{c.description}</strong>
                            <br />
                            {money(c.amount)} · {c.status} · {c.date} ·{" "}
                            {c.period}
                          </span>
                          <button
                            className="secondary"
                            disabled={
                              !c.exactAmount ||
                              (c.status !== "paid" &&
                                (c.projectId !== budget.id ||
                                  c.period !== periodId(budget)))
                            }
                            onClick={() =>
                              patch({
                                decision:
                                  c.status === "paid" ? "link" : "match",
                                matchId: c.id,
                                matchProjectId: c.projectId,
                                matchPeriod: c.period,
                              })
                            }
                          >
                            {!c.exactAmount
                              ? "Amount differs"
                              : selected.matchId === c.id
                                ? "Selected"
                                : c.status === "paid"
                                  ? "Same Paid payment"
                                  : "Mark this bill Paid"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="statement-check">
                    <input
                      type="checkbox"
                      checked={!!selected.separate}
                      onChange={(e) =>
                        patch({
                          separate: e.target.checked,
                          decision: "new",
                          matchId: undefined,
                          matchProjectId: undefined,
                          matchPeriod: undefined,
                        })
                      }
                    />
                    This is a separate purchase, even if another payment looks
                    the same.
                  </label>
                  <div className="statement-actions">
                    <button className="primary" onClick={() => nextRow()}>
                      Checked,{" "}
                      {index === rows.length - 1
                        ? "review payments"
                        : "next row"}
                    </button>
                    <button className="secondary" onClick={() => nextRow(true)}>
                      Leave row out
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="statement-actions">
            <button className="secondary" onClick={manual}>
              Add a row by hand
            </button>
            <button
              className="secondary"
              onClick={() => {
                setStep("review");
                setGroup("needs");
                setPage(0);
              }}
            >
              Review all payments
            </button>
          </div>
        </>
      )}
      {step === "review" && (
        <>
          <p>
            Nothing is saved yet. Resolve every row that needs a look, or leave
            it out.
          </p>
          <div
            className="statement-groups"
            role="group"
            aria-label="Payment review groups"
          >
            {[
              ["ready", "Ready"],
              ["needs", "Needs a look"],
              ["already", "Already here"],
              ["left", "Left out"],
            ].map(([id, label]) => (
              <button
                className="secondary"
                aria-pressed={group === id}
                key={id}
                onClick={() => {
                  setGroup(id);
                  setPage(0);
                }}
              >
                {label} <strong>{counts[id]}</strong>
              </button>
            ))}
          </div>
          <div className="paper statement-review-list">
            <h2>
              {
                {
                  ready: "Ready",
                  needs: "Needs a look",
                  already: "Already here",
                  left: "Left out",
                }[group]
              }
            </h2>
            {!counts[group] && <p>No payments in this group.</p>}
            {rows
              .map((r, i) => ({ r, i, review: review[i] }))
              .filter((x) => x.review.state === group)
              .slice(page * 10, page * 10 + 10)
              .map(({ r, i, review: v }) => (
                <div className="statement-review-row" key={r.id}>
                  <div>
                    <h3>{r.description || "Unreadable payment"}</h3>
                    <p>
                      {r.date || "Check date"} ·{" "}
                      <span className="statement-money">{money(r.amount)}</span>{" "}
                      {r.currency}
                    </p>
                    <p className="hint">{v.reason}</p>
                    {r.decision==='new'&&r.suggestedBy&&<p className="hint">{budget.categories.find(c=>c.id===r.categoryId)?.name} · Suggested by your {r.suggestedBy} rule</p>}
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      setIndex(i);
                      if (r.decision === "skip")
                        setRows((current) =>
                          current.map((v, j) =>
                            j === i
                              ? { ...v, decision: "new", checked: false }
                              : v,
                          ),
                        );
                      setStep("rows");
                    }}
                  >
                    Check row {i + 1}
                  </button>
                </div>
              ))}
            {counts[group] > 10 && (
              <div className="statement-actions">
                <button
                  className="secondary"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Previous payments
                </button>
                <span>
                  {page + 1} / {Math.ceil(counts[group] / 10)}
                </span>
                <button
                  className="secondary"
                  disabled={(page + 1) * 10 >= counts[group]}
                  onClick={() => setPage(page + 1)}
                >
                  Next payments
                </button>
              </div>
            )}
          </div>
          <div className="paper statement-confirm">
            <h2>Bring these payments home</h2>
            <PaidSummary
              added={
                rows.filter(
                  (r, i) => review[i].state === "ready" && r.decision === "new",
                ).length
              }
              matched={
                rows.filter(
                  (r, i) =>
                    review[i].state === "ready" && r.decision === "match",
                ).length
              }
              linked={
                rows.filter(
                  (r, i) =>
                    review[i].state === "ready" && r.decision === "link",
                ).length
              }
              amount={
                rows
                  .filter(
                    (r, i) =>
                      review[i].state === "ready" && r.decision !== "link",
                  )
                  .reduce((n, r) => n + Math.round(r.amount * 100), 0) / 100
              }
            />
            <p className="hint">
              {counts.left} left out · {counts.already} already imported.
              Approved Budget, carryover settings and future repeating bills
              stay as they are. The whole batch saves together; you can undo it
              in Entries.
            </p>
            {counts.needs > 0 && (
              <p role="status">
                {plural(
                  counts.needs,
                  "row still needs a look.",
                  "rows still need a look.",
                )}
              </p>
            )}
            <button
              className="primary"
              disabled={busy || counts.needs > 0 || !counts.ready}
              onClick={() => void confirm()}
            >
              {busy
                ? "Saving together…"
                : `Confirm ${plural(counts.ready, "payment", "payments")}`}
            </button>
          </div>
        </>
      )}
      {step === "done" && result && (
        <div className="paper statement-complete">
          <h2>Your payments are in place.</h2>
          <PaidSummary
            added={result.items.filter((i) => i.kind === "new").length}
            matched={result.items.filter((i) => i.kind === "match").length}
            linked={result.items.filter((i) => i.kind === "link").length}
            amount={
              result.items
                .filter((i) => i.kind !== "link")
                .reduce((n, i) => n + Math.round(i.after.amount * 100), 0) / 100
            }
          />
          <p>
            No source pages or passwords were saved. Your account nickname and
            minimal payment references keep future imports safe.
          </p>
          <div className="statement-actions">
            <button className="primary" onClick={leave}>
              View entries
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await book.undoStatement(budget.id, result.id);
                  leave();
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Undo import
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
