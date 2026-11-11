# Wave 12 Review — Qwen (Kaggle) + Jinggru Verification

- **Date**: 10 Nov 2026
- **Reviewer model**: Qwen3.5-27B abliterated GGUF Q4_K_M, via Ollama 0.40.16 on Kaggle GPU T4 x2
- **Repo HEAD reviewed**: `110e2fd` (Wave 12 merged)
- **Method**: 4 focused single-shot calls, one per file, each prompt carrying ~13–14k chars of excerpts with file line labels. The model did NOT see the full files (workbench is 4,852 lines; excerpts were samples).
- **Raw outputs**: Kaggle session only — `/kaggle/working/w12-review.md` + `review_raw_1_css.txt` … `review_raw_4_domain.txt`. That session dies with its 12h limit; this file is the durable local copy.
- **Model's gate**: BLOCKED — 11 blocker findings, 31 polish findings.
- **Jinggru's verification (same day, local clone at 110e2fd)**: NONE of the 11 blockers holds up against the actual code. See § Verification. The review does NOT establish a ship block on Wave 12.

---

## Model's 11 blocker findings (verbatim from the model)

1. `app/globals.css` L27-L30 — SEVERITY: BLOCKER. The `--eb-accent-ink` token (`#04140d`) may fail WCAG AA contrast on the `--eb-accent` background (`#35c08a`) for small text/icons. Fix: verify the ratio; if below 4.5:1, lighten `--eb-accent-ink` to `#021a10` or darken `--eb-accent`.
2. `app/ellies-book-workbench.tsx` L1542-L1548 — Severity: BLOCKER. `handleCanvasPointerMove` / `handleCanvasPointerUp` assume `canvasViewportRef.current` is non-null; `clientToWorld` does not verify the ref before `getBoundingClientRect`. Evidence: `const rect = canvasViewportRef.current?.getBoundingClientRect(); const originX = rect.left + rect.width / 2;` — `rect` will be `undefined` if the ref is null → `TypeError`. Fix: null check at the top of both handlers.
3. `app/ellies-book-workbench.tsx` L1568-L1601 — Severity: BLOCKER. `handleCanvasPointerMove` performs multiple `useState` updates (`setPan`, `setZoom`, `setCursorStyle`, `setDraggedNodeId`, `setNodePosition`, `setDropTarget`, `setDropParentId`) on every pointer move without throttling → excessive re-renders / UI lag. Fix: throttle with `requestAnimationFrame` or debounce to ~60 FPS, batch updates.
4. `app/page.tsx` L53 — SEVERITY: BLOCKER. `formatMoney` uses `parseFloat` on BigInt-like monetary values (`amountCents / 100`) → floating-point errors above 2^53 and bad rounding (`0.145.toFixed(2)` → `0.14`). Fix: cents-based formatting (`Intl.NumberFormat`, strict integer handling), avoid `parseFloat`.
5. `app/page.tsx` L101-L107 — SEVERITY: BLOCKER. `normalizeData` does not validate incoming data shape; if `data.budget` is not an array or has malformed entries, it fails silently or produces wrong state. Evidence: `budget: Array.isArray(data.budget) ? data.budget.map((item: any) => ({ id: item.id || newId(), name: item.name || 'Unnamed', amount: parseFloat(item.amount) || 0 })) : [],` Fix: validate entries, throw/log instead of hiding bugs with defaults.
6. `app/budget-domain.mjs` L2 — SEVERITY: BLOCKER. `newId()` uses `Date.now().toString(36)` — not collision-safe; two calls in the same millisecond produce identical ids. Evidence: `export function newId() { return 'n' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); }` Fix: counter suffix or `crypto.randomUUID()`.
7. `app/budget-domain.mjs` L7 — SEVERITY: BLOCKER. `isMoney` only checks finite number, not integer cents; `10.5` would pass as money but be treated as integer cents. Evidence: `export function isMoney(v) { return typeof v === 'number' && Number.isFinite(v); }` Fix: `Number.isInteger(v) && Number.isFinite(v)`.
8. `app/budget-domain.mjs` L12 — SEVERITY: BLOCKER. `fmtMoney` divides cents by 100 then `toFixed(2)` → binary float errors. Evidence: `export function fmtMoney(cents) { if (!isMoney(cents)) return '—'; return '$' + (Math.trunc(cents) / 100).toFixed(2); }` Fix: integer arithmetic (`Math.floor(Math.abs(cents) / 100) + '.' + String(Math.abs(cents) % 100).padStart(2, '0')`, handle negatives).
9. `app/budget-domain.mjs` L19 — SEVERITY: BLOCKER. `todayStr` uses `toISOString()` (UTC) while other date functions use local-time methods → timezone boundary errors. Fix: one consistent timezone strategy, document the `toISODate` contract.
10. `app/budget-domain.mjs` L23 — SEVERITY: BLOCKER. `toDateInputValue` uses `new Date(v)` without validity check; invalid input → `Invalid Date`, `.getFullYear()` → `NaN` used silently. Fix: guard `if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';`.
11. `app/budget-domain.mjs` L50 — SEVERITY: BLOCKER. `normalizeData` uses `Math.random()` for new budget-item ids, no duplicate check. Fix: monotonic id generator or `crypto.randomUUID()`.

## Model's 31 polish findings (summary as reported)

- **globals.css (10)**: L16-L20 ground-ramp tokens lack documented contrast ratios; L40-L43 canvas tokens hard-code hex/RGBA duplicating semantic tokens (re-derive via `var(--eb-accent)` / `var(--eb-status-go)`); L54-L61 aliases overlap `--eb-*` tokens (consolidate/document); L62-L63 `--line-strong` / `--rule` hard-coded hex; L74-L77 `--warning-soft` / `--danger-soft` hard-coded (derive via `color-mix`); L99 suggestions surface opaque dark `#1c2536` (make translucent); L101-L104 hard-coded `rgba(0,0,0,0.5)` in `.node-context-menu` / `.glass-button`; L138-L139 `.eb-debug-chip` plain hex; L146-L148 `input[type='password']` box-shadow hard-coded hex; L177-L183 mixed naming (`.eb-debug-chip` vs `.eb-debug`, `.text-*`, `--eb-*`, Tailwind `from-cyan-400`).
- **Workbench (8)**: L1542 document `wheelDeltaY` clamp bounds; L1553 add pointer capture on pointerdown; L1553-L1556 add role/aria-label/tabIndex (canvas mouse-only, no keyboard handlers); L1559 document `will-change: transform, opacity`, gate to drag states; L1566-L1567 `touch-action: none` disables native scrolling (show a hint); L1602-L1616 throttle `renderLoop`; L1660 replace `text-cyan-200` / `outline-cyan-400` with `--eb-accent`; L1727 `place-content: center` may distort overflow layout.
- **page.tsx (8)**: L51 `typeof crypto !== 'undefined'` fallback guard for `crypto` use in `newId()`; L63 bundle cached `fxRates` fallback for network failure; L65-L92 split the over-broad `useEffect`; L23-L24 setup state type cannot capture progress (add derived state / `status` field); L30 `BudgetSettings` optional fields have no validation; L54 notes panel relies on `flex-1 min-h-0 overflow-y-auto`; L55 notes list `min-h-[180px]` not responsive; L56 notes input uses Enter-to-submit (add explicit Submit button).
- **budget-domain.mjs (5)**: L125 `mergeBudgets` mutates via `push` on `out` (use `concat`); L131 `setBudgetFlag` mutates in place (return new object); L103/L105 `mv` / `updateMoney` call `fmtMoney` (returns `$`-prefixed string) as if numeric; L433-L434 `toISODate` / `toDateInputValue` don't guard invalid Dates; L1596 `normalizeData` only checks `Array.isArray`, not nested fields.

## Model's area verdicts (verbatim)

- globals.css: cohesive dark palette, "not safe to ship as-is because of the unvalidated contrast around the accent pair and several maintenance risks from hard-coded values."
- Workbench: "safe with only polish fixes, provided the BLOCKER issues regarding the clientToWorld null-check and the unthrottled handleCanvasPointerMove are addressed immediately."
- page.tsx: "not safe to ship as-is because of two BLOCKER issues: the inconsistent currency formatting in formatMoney and the complete absence of state validation in normalizeData."
- budget-domain.mjs: "currently BLOCKED for Wave 12 shipment. The primary risk lies in the pervasive use of native JavaScript floating-point arithmetic for monetary values… The secondary risk is the use of Date.now() as a surrogate for a primary key."

---

## Jinggru verification — per-finding verdicts (10 Nov 2026, local clone at 110e2fd)

Method: read the cited code in the local clone (same HEAD and file sizes as the Kaggle clone) and checked each quoted evidence string with grep.

| # | Verdict | Evidence |
|---|---|---|
| 1 (CSS contrast) | **FALSE POSITIVE** | Computed WCAG ratio `#35c08a` on `#04140d` = **8.15:1**, well above AA 4.5:1. The model only said "may fail" and asked to verify. Verified: passes. |
| 2 (null rect) | **FALSE — already guarded** | `clientToWorld` (workbench L1590-1597) uses `rect?.left ?? 0` / `rect?.top ?? 0`. The cited `rect.left` dereference does not exist in the file. |
| 3 (pointermove throttle) | **FALSE premise** | `handleCanvasPointerMove` (L1629-1655) does at most ONE `setState` per move (`setNodeViewState` on drag, `setPan` on pan). `setCursorStyle`, `setDropTarget`, `setDropParentId`, `setNodePosition` do not exist anywhere in the file. |
| 4 (`formatMoney`) | **FALSE — evidence doesn't exist** | `page.tsx` `formatMoney` already uses `Intl.NumberFormat` with `style: "currency"`. No `parseFloat` / `amountCents` anywhere in `page.tsx`. |
| 5 (`normalizeData`) | **FALSE — evidence doesn't exist** | The quoted `data.budget` / `parseFloat(item.amount)` code does not exist in `page.tsx`; `StudioData` has no `budget` field. |
| 6 (`newId`) | **MISATTRIBUTED** | No `newId` in `budget-domain.mjs`. The similar helper is `makeId` in the **workbench** (L823-825): `` `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` `` — real, but view code, not the domain engine; cited code is a mutated paraphrase. |
| 7 (`isMoney`) | **NO SUCH FUNCTION** | `isMoney` exists nowhere in `app/` or `db/` (only an unrelated `isMoneyCol` boolean in the workbench). |
| 8 (`fmtMoney`) | **NO SUCH FUNCTION** | `fmtMoney` exists nowhere in `app/` or `db/`. |
| 9 (`todayStr`) | **NO SUCH FUNCTION** | `todayStr` exists nowhere in `app/` or `db/`. |
| 10 (`toDateInputValue`) | **NO SUCH FUNCTION** | `toDateInputValue` exists nowhere in `app/` or `db/`. |
| 11 (`normalizeData` ids) | **NO SUCH FUNCTION in that file** | No `normalizeData` in `budget-domain.mjs`. `page.tsx` `normalizeData` does call `newId()` for missing ids — but `page.tsx` `newId` prefers `crypto.randomUUID()` when available. |

**Polish spot-checks**: the `:root` token-architecture observations (ground ramp, canvas tokens, aliases, hard-coded `--line-strong` / `--rule` / `--warning-soft` / `--danger-soft`) match real code. Later-file citations I checked do NOT exist: `.eb-debug-chip`, `from-cyan-400`, `text-cyan-200`, suggestions surface `#1c2536`, `rgba(0,0,0,0.5)`, `input[type='password']` box-shadow, `place-content`, `will-change`, `renderLoop`, `wheelDeltaY`, `mergeBudgets`, `setBudgetFlag`, `mv` / `updateMoney`. `touch-action: none` does exist (globals.css L1057). `page.tsx` L51's crypto guard is already present (`typeof crypto !== "undefined"` in `newId`).

**Pattern**: the model saw ~13–14k-char excerpts, not full files. Findings grounded in the excerpt's visible region check out; findings citing code beyond it are unreliable. The domain-engine "cluster" (6 blockers) is the most consistent-sounding part of the review and the least grounded — it describes a money/date/id module that does not exist in this repo.

## Credible residue (what is actually worth doing)

1. **Token hygiene (CSS polish)**: document or consolidate the `:root` aliases and hard-coded hex (`--line-strong`, `--rule`, `--warning-soft`, `--danger-soft`) — small, real.
2. **Workbench `makeId` (L825)**: `Date.now()` + `Math.random()` ids for view/node ids — real but minor; a monotonic counter or `crypto.randomUUID()` would close it. View code only; the domain engine is untouched by this.
3. **`touch-action: none`** (globals.css L1057): real rule; whether it needs a user hint is a UX judgment, not a bug.

None of these blocks Wave 12. No fix touches `app/budget-domain.mjs` (hard guardrail) — and no fix there is needed, because the cited functions do not exist.

## Session note (Kaggle)

Weights did NOT persist across sessions: the 16.5 GB GGUF was gone at restart (only `.virtual_documents/` in `/kaggle/working`), re-downloaded in ~1 min; Ollama was also gone, reinstalled (0.40.16, was 0.40.15). Restart = re-download + reinstall, not resume. Session was still running at report time; nothing was pushed, no repo file edited (read-only review).
