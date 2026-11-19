# Wave 12 Review v2 — Qwen (Kaggle), full-file run + Jinggru triage

- **Date**: 10 Nov 2026, ran 17:12–18:53 SGT (1h 41m)
- **Reviewer model**: Qwen3.5-27B abliterated GGUF Q4_K_M, Ollama 0.40.16, Kaggle GPU T4 x2
- **Repo HEAD reviewed**: `110e2fd` (Wave 12 merged; NOT the working tree with W13 changes)
- **Method (the fix over run 1)**: full files, split into ≤20,000-char chunks at line boundaries with exact starting line numbers; one Ollama call per chunk (temp 0.2, num_predict 3000, think off, num_ctx 16384). 32 chunks: globals.css 4, workbench 10, page.tsx 15 (page.tsx is ~244 KB — very long lines), budget-domain.mjs 3. All 32 calls succeeded; 24 chunks BLOCKED, 8 PASS.
- **Verification (mandatory)**: every parsed finding's cited fragment was grepped in the real file and had to occur at or within 5 lines of the cited line. Parsed: 241. Verified: 143 (36 blockers, 107 polish). **Dropped as unverified: 98** (81 fragment not found anywhere, 14 too short/generic to check, 3 wrong line). Of the dropped, 21 were labelled BLOCKER.
- **Model's gate**: BLOCKED — 36 verified blockers.
- **Jinggru triage (same day, local clone at 110e2fd)**: the gate does NOT survive triage. I checked the 13 most alarming findings against the code; 12 are refuted outright and 1 is downgraded. See § Triage. No demonstrated crash was found. The remaining items are logic questions and polish, not proven defects.
- **Full file**: `/kaggle/working/w12-review-v2.md` (222,470 chars) + 32 raw outputs + review2_verified.json + review2_calls.jsonl + review2_plan.json — in the still-running Kaggle session ONLY. The 107 polish findings are not copied here; they live in that file.
- **Persistence correction**: "Files only" persistence kept NOTHING. `/kaggle/working` was empty at session start; the weights were re-downloaded (49.4 s) and run 1's files (w12-review.md, clone, Modelfile) were all gone. This contradicts the 4:20 PM note that "from then on, they stay". Also the Kaggle editor showed "Failed to save draft" all session — notebook cells may not be saved as a draft. Restart cost remains: re-download + Ollama reinstall every session.

## Per-file verdicts (model)

- app/globals.css — PASS: 0 blockers, 14 polish, 17 dropped.
- app/ellies-book-workbench.tsx — BLOCKED: 7 blockers, 25 polish, 46 dropped.
- app/page.tsx — BLOCKED: 24 blockers, 57 polish, 34 dropped.
- app/budget-domain.mjs — BLOCKED: 5 blockers, 11 polish, 1 dropped.

## The 36 verified blockers (verbatim from the model)

1. workbench:1183 — `requirementTotal(enrichedItems[0] || {})` — empty array → `undefined`, `|| {}` handles it, but if `requirementTotal` expects specific properties missing in the fallback, silent data loss / errors possible. Safer to check length explicitly.
2. workbench:1139 — `(candidate) => candidate.id === line.sourceDocumentLineId` — `find` returns `undefined` if no match; `upstream?.stage` uses optional chaining (correct). "The logic holds" if the id is null/undefined (filtered line 1136). Issue only if a valid string fails to match (type mismatch) or `projectDocLines` is empty. Explicit handling of `undefined` upstream in `fromStage` is good practice.
3. workbench:1473 — `mutateStudioAndProject` signature: `updater: ( project: WorkbenchProject, docs: WorkbenchDocument[], ) => { project: WorkbenchProject, docs: WorkbenchDocument[]; }` — claimed incorrect arrow return-type syntax / malformed parameter list. Should be `updater: (project: WorkbenchProject, docs: WorkbenchDocument[]) => { project: WorkbenchProject; docs: WorkbenchDocument[] }` or a tuple.
4. workbench:2510 (actual 2511) — project `<select>` has `aria-label="Select active project"` but the parent `<label>` text "Active project" is not associated via `htmlFor`/`id`. Suggest adding `id="active-project-select"` + `htmlFor`.
5. workbench:3906 — `className={`eb-minimap-node eb-node-status-${node.nodeType === "Knowledge_Notes" ? "idle" : ns}`}` — inline ternary in template literal hurts readability; extract to a helper/`const statusClass`.
6. workbench:4729 — clickable table rows: `onClick={() => jumpToNode(rowId)}` on `tr` — not keyboard-focusable, no `role`/`tabIndex`/`onKeyDown`. Suggest `tabIndex={0}`, `role="row"`, Enter/Space handler.
7. workbench:4728 — `key={rowId + "-" + rIdx}` — `rIdx` guarantees uniqueness, but if `filteredTableRows` is unstable/unsorted, index-dependent keys can cause re-renders / state desync. Ensure `rowId` globally unique or `filteredTableRows` stable.
8. page:103 — `const profile = { ...emptyProfile, ...(raw?.profile ?? {}) };` — if `raw?.profile` is missing/incomplete, `plannerName` is empty and `defaultMembers(profile)` returns [], so the primary planner may not be added to `teamMembers`.
9. page:115 — `const match = String(project.id ?? "").match(/(\d{4})$/);` — regex expects id to end in exactly 4 digits; `newId` (line 51) produces UUIDs, so `match` is null, `Number(match[1])` undefined, `maxSequence` defaults to 0, `nextProjectSequence` resets to 1 for UUID projects.
10. page:150 — `quarterAmount`: `base = Math.floor(cents / max(1, len)); remainder = cents - (base * max(1, len - 1));` — remainder is `base + (cents % len)`; last quarter gets `base + remainder` double-counted / total incorrect. Fix: `remainder = cents % len; last gets base + remainder`.
11. page:166 (actual 164) — `rekeyProjectIdentifiers` `while (!available()) { sequence += 1; ... }` — could loop long if `nextSequence` starts high / dense id block; hard to verify edge cases.
12. page:250 — planner-name update: only adds a member if the name does not exist; updating a name to an existing member's name leaves `teamMembers` unchanged while `profile` changes → state inconsistency.
13. page:261 — `if (has && label.startsWith("Project metadata tags") && family.id === "tag-business-intent") return;` — prevents deselecting a tag; if the family is multi-select this locks the tag in.
14. page:325 — `next.generatedId = `${idPrefix(data, patch.tagIds)}-${...}`;` — uses `patch.tagIds`; if undefined the prefix may be wrong. Should use `next.tagIds`.
15. page:328 — `const item = data.library.spendingItems[0];` — empty library → `undefined`, `item?.id` handled, but new line gets empty `spendingItemId`, possibly invalid per schema.
16. page:329 — `const outcome = data.library.outcomes[0];` — same for outcomes; empty `outcomeDefinitionId` may fail validation.
17. page:356 — `const sequence = projectSequence(draft) ?? data.settings.nextProjectSequence;` — passes stale `draft` prop instead of `next`; sequence may be wrong if `projectSequence` reads patched fields.
18. page:340 (actual 341) — `addLine`: `const item = data.library.spendingItems[0];` — if `data.library` missing or `spendingItems` not an array, silent failures. Suggest `const items = data.library?.spendingItems ?? [];`.
19. page:341 (actual 342) — `addOutcome`: same pattern for outcomes; empty library blocks adding an outcome.
20. page:372 — `updateLine(existing.id, { allocations: [...lineAllocations(existing), allocation] })` — `lineAllocations` is not defined in scope of `confirmStaged`; likely should be `existing.allocations`. Will cause `ReferenceError` at runtime.
21. page:372 — `review.suggestedAllocation.vendorOrWarehouse ?? ""` — "the logic holds" if checked, but `allocation` is `undefined` if `suggestedAllocation` is falsy while `updateLine` assumes it defined; construction is complex.
22. page:376 — `{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}` — key is the currency value; duplicates / reorder could desync DOM. Use unique codes.
23. page:390 — `const original = data.projects.find((project) => project.id === draft.id);` — save uses `id` but `removeProject`/`PlanView` use `recordId` as the stable key; if `id` changes, lookup fails, `original` undefined, no `BudgetRevision` created. Fix: look up by `recordId`.
24. page:393 (actual 389) — save update: `return { ...draft, revisions: ..., currentRevisionId: ... };` — `draft` may lack `recordId`/immutable fields present on original `project`; they may be lost. Explicitly preserve `recordId: project.recordId`.
25. page:389 — `removeProject`: filters projects by `recordId` but document lines by `projectId` (`line.projectId !== project.id`); if lines link by `recordId`, they won't be removed. Likely should be `line.projectId !== project.recordId`.
26. page:412 — `JSON.stringify({...before, adjustmentComment: undefined}) !== JSON.stringify({...line, adjustmentComment: undefined})` — property-order sensitive, `undefined` vs `null` edge cases, no circular refs. Use a deep-equal utility.
27. page:447 (actual 442) — `const totals = spendMetrics(data);` — called with only `data`, but elsewhere invoked with project/line ids; single-arg call likely yields `undefined` totals. Align with `SpendView` usage or handle single-arg.
28. page:468 — `FinancialBar`: opening `<div className="financial-bar-block">` never closed; final `</div>` closes an inner div. Unclosed root → runtime crash / render failure. Add a final `</div>`.
29. page:485 — `attentionItems`: no return type, body does not explicitly return `items` before the closing brace → returns `undefined`, crashes `AttentionPanel`. Add `: AttentionItem[]` and ensure `return items;`.
30. page:482 — `validateLibrary`: relies on `data.library.tagFamilies`/`spendingItems`/`outcomes` being arrays; if `data.library` undefined, `.forEach` throws. Add optional chaining or guarantee initialization.
31. page:555 — `openAttention` scroll: `window.setTimeout(..., 180)` — arbitrary delay may be too short for the target to mount; `getElementById` returns null, scroll/focus skipped. Use `requestAnimationFrame` or `useEffect`.
32. domain:263 — `availableToCommit = approvedBudget - actualTotal - openCommitmentTotal` — 11,681-char finding, repetitive, ends mid-sentence (hit the 3000-token cap). Repeatedly concludes the calculation "is logically consistent" / "is correct"; concern is about `lineage` vs `projectedHeadroom` naming/interpretation, not a demonstrated error.
33. domain:578 — `String(item.workPackageId || item.work_package_id || workPackages[0].id)` — empty `workPackages` → `workPackages[0]` is `undefined` → `.id` throws TypeError, crashes the projection build. Use `workPackages?.[0]?.id` or a fallback.
34. domain:607 — same pattern in the `Purchase_Items` table construction; same crash if `workPackages` is empty.
35. domain:1428 — `if (filePath === "00_Project_Overview.md" || fm.entity_type === "Project")` — `project` is initialized with defaults (line 1384) and only updated inside the loop on a match; no match → returns the generic default, possibly missing `approvedBudget`/`currency`.
36. domain:1562 — `const rawItems = Array.isArray(projectData.purchaseItems || rawProject.purchaseItems || rawProject.lines)` — assumes those keys; different nesting → empty array → `allocationValidations` empty and `allAllocationsValid` true by default, masking missing data.

## Jinggru triage — checked against the code at 110e2fd

| # | Verdict | Why |
|---|---|---|
| 3 | REFUTED | The signature IS valid TypeScript: arrow type with an object return type (`=> { project: X; docs: Y[] }`), trailing comma in params is legal. |
| 9 | DOWNGRADED to weak | `match ? Number(match[1]) : 0` — the null guard IS present, so no crash. Ids are generated by `nextProjectId` with a 4-digit suffix by design, so the regex matches in the normal path. |
| 10 | REFUTED | The math is correct: `remainder = cents - base*(len-1) = base + (cents % len)`; last quarter gets base + leftover, total = cents. The model's "fix" is mathematically identical to the code. |
| 20 | REFUTED | `lineAllocations` IS defined: `function lineAllocations(line: ProjectSpendLine) { return line.allocations ?? []; }` at page.tsx:139. The model couldn't see it — its chunk started after line 139. Grep verification only checked the cited fragment, not whether the identifier is defined elsewhere. |
| 23 | REFUTED | `beginEdit` sets `draft = clone(project)`; `draft.id` is the original id, so the `find` by id succeeds. Nothing in the edit path changes `id`. |
| 24 | REFUTED | Same: `draft` is a full clone, so `recordId` and all immutable fields are preserved in `{ ...draft, ... }`. |
| 25 | REFUTED | Consistent, not mismatched: document lines link by `project.id` (table rows use `project_id: project.id`), and `removeProject` filters lines by `project.id`. Projects are filtered by `recordId` in their own collection. |
| 28 | REFUTED | Counted the FinancialBar return: 4 `<div` opens, 4 `</div>` closes. Balanced. |
| 29 | REFUTED | The function DOES end with `return items;` — visible in the file. The model's chunk cut off before it. |
| 32 | NOT A FINDING | The model's own text repeatedly says the calculation "is logically consistent" / "is correct"; it rambles for 11,681 chars and ends mid-sentence at the token cap. No demonstrated error. |
| 33, 34 | REFUTED as a crash | The access sits INSIDE `workPackages.map(...)` over the same array — if the array is empty, the body never runs and `workPackages[0]` is never touched. Structurally unreachable. |
| 2, 21 | SELF-CONTRADICTORY | Both say "the logic holds" and still flag it as a blocker. At most a "consider an explicit guard" polish note. |
| 4, 5, 6, 7, 22, 26, 31 | POLISH, not blockers | Real observations (a11y label association, keyboard rows, key style, JSON.stringify compare, timeout) but none is a crash or data-loss defect. |
| 1, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 27, 30, 35, 36 | PLAUSIBLE LOGIC QUESTIONS, unchecked | Each needs a human/agy read of the surrounding code to decide whether it is real. None was demonstrated to crash. The most worth checking: #27 (`spendMetrics(data)` single-arg), #17 (`projectSequence(draft)` vs `next`), #13 (tag-business-intent early return), #15/#16/#18/#19 (empty-library edges). |

**Net**: the v2 run is a real improvement over v1 (grounded citations, 98 unverified findings dropped), but the model's severity labels are still unreliable — it calls style, a11y, and speculative "potential" issues blockers, and its chunk boundaries hide definitions and returns that sit outside the chunk. Wave 12 is NOT shown to be broken by this review. The correct next step is a triage pass over the 15 plausible items, not a blanket fix of 36.
