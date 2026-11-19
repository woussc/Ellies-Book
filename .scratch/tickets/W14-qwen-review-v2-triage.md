# Wave 14: Triage of the Qwen Wave 12 Review v2 Findings

- **Wave**: Wave 14 (triage only — no implementation in this step)
- **Status**: `proposed`
- **Source**: Qwen Wave 12 review v2, 10 Nov 2026 (`/kaggle/working/w12-review-v2.md`; local record `.scratch/reviews/W12-qwen-review-v2.md`)
- **Reviewed code**: `main` @ `110e2fd` (Wave 12 merged). Not the W13 working tree.
- **Governing ADRs**: ADR 0001 (hybrid + dual-mode), ADR 0002 (graph-first + Coordinate Invariance), ADR 0003 (verification gate), ADR 0008 (dark canvas re-theme).
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (**25/25** on `main` @ `110e2fd`; **28/28** in the local clone with uncommitted W13). `pnpm run lint`, `pnpm run build`, `tests/rendered-html.test.mjs`, `inspect.mjs --app`, and Playwright are **CI-only** in this sandbox (ADR 0003).

> `[Context]` The v2 review ran the full files in 32 chunks with a grep check on every finding. It parsed 241 findings, verified 143 (36 blockers, 107 polish), and dropped 98 as unverified. The model's gate said BLOCKED. Jinggru then checked the 15 plausible logic questions against the code at `110e2fd`. This ticket records one triage per item. `[Fact]` Net result: **zero confirmed defects**. Four items are refuted outright. Eleven are dropped (dead code, intended behavior, or unreachable in the app). Three optional polish notes remain. No implementation is recommended from this ticket.

> `[Hard guardrail, all tickets in this file]` Do NOT touch `app/budget-domain.mjs`, `db/schema.ts`, `app/api/sync/route.ts`, `worker/index.ts`, `vite.config.ts`, `vite.config.pages.ts`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, or `AGENTS.md` §2. Do NOT touch PR #4. Preserve Coordinate Invariance (ADR 0002). Two items below (W14-14, W14-15) concern `app/budget-domain.mjs` code; both are dropped, so no exception is needed.

---

## Triage method

- `[Fact]` Each item was checked by reading the cited code at `110e2fd` plus its callers, its live/dead status in the render path, and any validation that already covers the case.
- `[Fact]` "Live" means reachable from `Home` (`app/page.tsx` line 541): profile tab renders `ProfileScreen`, library tab renders `LibraryScreen`, plan tab renders `PlanView`, spend tab renders `SpendView`, monitor tab renders `MonitorView`.
- `[Fact]` `void X;` lines in `app/page.tsx` (lines 422–426, 445, 466) mark kept-but-unused Legacy components: `PlanViewLegacy`, `ProfileScreenLegacy`, `ProjectEditorLegacy`, `ProjectCardLegacy`, `LegacySpendView`, `SpendViewLegacy`. Findings in those components cannot affect the running app.
- Verdicts: **REFUTED** (the claim is false against the code), **DROPPED — dead code** (the code never runs), **DROPPED — intended** (the behavior is deliberate), **DROPPED — unreachable** (the precondition cannot occur in the app), **CONFIRMED** (a real defect; none in this ticket).

---

## W14-1 — Workbench `requirementTotal(enrichedItems[0] || {})` (`app/ellies-book-workbench.tsx:1183`) — DROPPED — intended

- **Claim**: An empty `enrichedItems` array makes `enrichedItems[0]` `undefined`. The `|| {}` fallback may not match the expected schema, so silent data loss or errors are possible.
- **Evidence**: `[Fact]` `total: activeProject.approvedAmount || requirementTotal(enrichedItems[0] || {})` (workbench line 1181–1183). `[Fact]` `requirementTotal` (`app/budget-domain.mjs:15`) reads `requirement.allocations || []`, then returns `0` when the list is empty (`Number(undefined || 0) * Number(undefined || 0)`).
- **Reproduction**: `[Fact]` `requirementTotal({})` returns `0`. No throw. No missing property is read.
- **Verdict**: DROPPED — intended. `[Inference]` A `0` total for an empty project with no approved amount is the correct value, not data loss.
- **Recommendation**: No fix. Optional polish: an explicit `enrichedItems.length ? ... : 0` would read clearer, but it changes no behavior.

## W14-2 — Empty profile leaves the planner out of the team (`app/page.tsx:103`) — DROPPED — intended

- **Claim**: If `raw?.profile` is missing, `plannerName` is empty and `defaultMembers(profile)` returns `[]`, so the primary planner is not added to `teamMembers`.
- **Evidence**: `[Fact]` `defaultMembers` (line 60) returns `[]` when `plannerName` is falsy. `[Fact]` `normalizeData` (lines 103, 112) merges `raw?.profile` over `blankData()` (empty strings) and adds default members only when a name exists. `[Fact]` `validateProfile` (line 480) flags an empty planner name: `"Add the planner name."` `[Fact]` `attentionItems` treats `profile.*` errors as Blocking.
- **Reproduction**: `[Fact]` An unconfigured profile has an empty team, and the app shows a Blocking error that tells SHUAI to add the planner name. Members already in `rawSettings.teamMembers` are preserved.
- **Verdict**: DROPPED — intended. `[Inference]` An empty planner name correctly yields no default member. The gap is surfaced by validation, not silent.
- **Recommendation**: No fix.

## W14-3 — `rekeyProjectIdentifiers` while loop (`app/page.tsx:164–166`) — REFUTED

- **Claim**: The `while (!available()) { sequence += 1; ... }` loop could run long if `nextSequence` starts high or ids form a dense block.
- **Evidence**: `[Fact]` `available()` is `!used.has(candidate) && (candidate === project.id || !originalIds.has(candidate))`. `[Fact]` Each pass increments `sequence` by 1 and rebuilds `candidate` from it. `[Fact]` `used` and `originalIds` are finite sets.
- **Reproduction**: `[Fact]` As `sequence` grows, `candidate` eventually misses both finite sets, so the loop ends. `[Inference]` Worst case per project is bounded by the number of existing ids plus one. No infinite loop exists.
- **Verdict**: REFUTED.
- **Recommendation**: No fix. Optional polish: one comment line stating the bound.

## W14-4 — Planner rename leaves a stale member (`app/page.tsx:250`) — DROPPED — dead code

- **Claim**: Renaming the planner adds no new member when the name already exists, while the profile changes, so profile and roster disagree.
- **Evidence**: `[Fact]` The cited `update` sits in `ProfileScreenLegacy` (line 249). `[Fact]` `void ProfileScreenLegacy;` (line 424) marks it unused. `[Fact]` `Home` renders the live `ProfileScreen` (line 255), whose `update` only sets profile fields and never touches `teamMembers`. The roster is managed separately in `TeamRoster`.
- **Reproduction**: `[Fact]` The cited code never runs in the app.
- **Verdict**: DROPPED — dead code. `[Inference]` The live screen deliberately decouples the profile name from the roster.
- **Recommendation**: No fix. `[Fact]` Observation, not a defect: within one session, a newly typed planner name joins the roster only after reload (`normalizeData` adds it then). If SHUAI wants live auto-add, that is a product decision for a separate ticket, not a bug fix here.

## W14-5 — Business-intent tag cannot be deselected (`app/page.tsx:261`) — DROPPED — intended

- **Claim**: The early return blocks deselecting the tag. If the family is multi-select, the tag locks in once chosen.
- **Evidence**: `[Fact]` The family `tag-business-intent` is `selection: "single"` in the shipped library (`starterLibrary`, line 69). `[Fact]` New projects default to the intent tag (`addProject`, line 415). `[Fact]` `validateCoreSetup` requires the intent family to keep at least one value (line 481).
- **Reproduction**: `[Fact]` In the shipped configuration the family is single-select, so the model's "if multi-select" condition does not occur. The guard keeps a mandatory metadata tag set.
- **Verdict**: DROPPED — intended.
- **Recommendation**: No fix. Optional polish: the picker label says "single-select; click again to clear", which over-promises for this family. Revisit the early return only if the family is ever switched to multi-select.

## W14-6 — `idPrefix(data, patch.tagIds)` in the Legacy editor (`app/page.tsx:325`) — REFUTED

- **Claim**: `patch.tagIds` may be undefined, so the prefix may be wrong. Use `next.tagIds` instead.
- **Evidence**: `[Fact]` The call sits inside `if (patch.tagIds) { ... }`, so `patch.tagIds` is defined at the call. `[Fact]` In that branch `next = { ...draft, ...patch }`, so `next.tagIds === patch.tagIds`.
- **Reproduction**: `[Fact]` The suggested fix changes nothing. The two expressions are identical where the call runs.
- **Verdict**: REFUTED.
- **Recommendation**: No fix.

## W14-7 — Empty library, first spending item (`app/page.tsx:328`) — DROPPED — dead code

- **Claim**: `data.library.spendingItems[0]` is `undefined` on an empty library, so a new line gets an empty `spendingItemId`, possibly invalid.
- **Evidence**: `[Fact]` The cited `addLine` sits in `ProjectEditorLegacy` (line 324). `[Fact]` `void ProjectEditorLegacy;` (line 426) marks it unused.
- **Reproduction**: `[Fact]` The code never runs in the app.
- **Verdict**: DROPPED — dead code. See W14-10 for the live editor, which has no `[0]`-based line creation.
- **Recommendation**: No fix.

## W14-8 — Empty library, first outcome (`app/page.tsx:329`) — DROPPED — dead code

- **Claim**: Same pattern as W14-7 for `data.library.outcomes[0]` and an empty `outcomeDefinitionId`.
- **Evidence**: `[Fact]` Same location (`ProjectEditorLegacy`), same `void` marker (line 426).
- **Verdict**: DROPPED — dead code. See W14-11 for the live editor, which guards the lookup.
- **Recommendation**: No fix.

## W14-9 — `projectSequence(draft)` instead of `projectSequence(next)` (`app/page.tsx:356`) — REFUTED

- **Claim**: The V2 editor `update` passes the stale `draft` prop instead of the updated `next`, so the sequence may be wrong.
- **Evidence**: `[Fact]` `projectSequence` (line 163) reads only `${project.generatedId || project.id}` and extracts the trailing `-(\d{3,})$`. `[Fact]` The branch runs only when `patch.tagIds` is set, and tag ids cannot change `generatedId` or `id`.
- **Reproduction**: `[Fact]` `projectSequence(draft) === projectSequence(next)` in this branch. The two calls return the same number.
- **Verdict**: REFUTED.
- **Recommendation**: No fix.

## W14-10 — `addLine` reads `spendingItems[0]` (`app/page.tsx:341`) — DROPPED — dead code

- **Claim**: Same empty-library pattern as W14-7, in the non-Legacy `ProjectEditor`.
- **Evidence**: `[Fact]` `ProjectEditor` (line 337) is rendered only by `ProjectCardLegacy` (line 380). `[Fact]` `void ProjectCardLegacy;` (line 422) marks it unused. `[Fact]` The live plan tab renders `PlanView` → `ProjectCard` → `ProjectEditorV2`, which has no `[0]`-based `addLine`. Lines there are created by `createProjectItem`, which creates the item first (line 362).
- **Reproduction**: `[Fact]` The code never runs in the app.
- **Verdict**: DROPPED — dead code.
- **Recommendation**: No fix.

## W14-11 — `addOutcome` reads `outcomes[0]` (`app/page.tsx:342`) — DROPPED — dead code

- **Claim**: Same empty-library pattern as W14-8, in the non-Legacy `ProjectEditor`.
- **Evidence**: `[Fact]` Same render chain as W14-10. `[Fact]` The live V2 `addOutcome` (line 365) looks the outcome up by id and returns early when it is missing: `if (!outcome) return;`.
- **Verdict**: DROPPED — dead code.
- **Recommendation**: No fix.

## W14-12 — `spendMetrics(data)` with one argument (`app/page.tsx:447`) — REFUTED

- **Claim**: The call passes only `data`, but other call sites pass project and line ids, so the totals are likely `undefined`.
- **Evidence**: `[Fact]` `spendMetrics` (line 193) declares `projectId?`, `spendingLineId?`, `quarter?` as optional. `[Fact]` Its filter is `(!projectId || line.projectId === projectId) && (!spendingLineId || ...) && (!quarter || ...)`. `[Fact]` With no ids it aggregates every document line, which is what the totals header shows.
- **Reproduction**: `[Fact]` The single-argument call is the correct "all documents" form. The model did not read the function body.
- **Verdict**: REFUTED.
- **Recommendation**: No fix.

## W14-13 — `validateLibrary` assumes `data.library` exists (`app/page.tsx:482`) — DROPPED — unreachable

- **Claim**: If `data.library` is undefined, the `.forEach` calls throw.
- **Evidence**: `[Fact]` The only caller is line 547, on App state `data`. `[Fact]` `data` starts as `blankData()`, whose `library` is `blankLibrary()` (three empty arrays). `[Fact]` Every load passes through `normalizeData`, which builds `library` with `?? []` fallbacks (lines 105, 110). `[Fact]` No other caller exists (workbench: zero hits).
- **Reproduction**: `[Fact]` The precondition cannot occur through the app. `data.library` and its three arrays always exist.
- **Verdict**: DROPPED — unreachable.
- **Recommendation**: No fix. A defensive guard would be dead code.

## W14-14 — Default project returned when no vault file matches (`app/budget-domain.mjs:1428`) — DROPPED — unreachable in-app

- **Claim**: `parseObsidianVaultBundle` returns a generic default project (zeros, "Untitled Project") when no file matches, possibly missing `approvedBudget` and `currency`.
- **Evidence**: `[Fact]` The caller is the workbench line 1265, on `obsidianVaultFiles`. `[Fact]` `obsidianVaultFiles` is generated by `serializeProjectToObsidianVault` (workbench line 1259), which always writes `00_Project_Overview.md` (domain lines 1037, 1069). `[Fact]` The serialize/parse round-trip is covered by a domain test.
- **Reproduction**: `[Fact]` Through the app's own round-trip the overview file is always present, so the no-match branch cannot run. No consumer checks the `PROJ-0001` sentinel, because no path reaches it.
- **Verdict**: DROPPED — unreachable in-app. `[Inference]` The default is a correct defensive fallback for a parser.
- **Recommendation**: No fix. `[Projection]` If an external vault import ever lands, the UI should detect the `PROJ-0001` sentinel and say "no project file found" instead of showing zeros. That is future work, not this ticket. `[Fact]` Any fix inside `app/budget-domain.mjs` would need a separate explicit exception to the do-not-touch rule; none is requested here.

## W14-15 — `buildHybridSyncReceipt` item-shape ambiguity (`app/budget-domain.mjs:1562`) — DROPPED — intended

- **Claim**: `rawItems` falls back to `[]` when the input shape varies, and `[].every(...)` is `true`, so `allAllocationsValid` can mask missing data.
- **Evidence**: `[Fact]` Every real caller path carries `purchaseItems` as an array: the workbench payload sets `purchaseItems: enrichedItems` (line 1233), and the sync route passes the same payload through (`triggerHybridSync` sends `JSON.stringify(projectPayload)`, line 1293). `[Fact]` `rawProject.lines` is the fallback for the alternate shape. `[Fact]` `validateRequirementAllocations` defaults missing fields to `0`.
- **Reproduction**: `[Fact]` In the real paths `rawItems` is populated. `[Inference]` An empty array means zero allocations, and zero violations is the correct answer for an empty set — vacuous truth is semantically right here, not a mask.
- **Verdict**: DROPPED — intended. The branching is defensive, not a live bug.
- **Recommendation**: No fix. Optional polish: one comment naming the canonical payload shape (`purchaseItems` top-level, `project.lines` fallback) would help future readers.

---

## Triage summary

| Verdict | Items | IDs |
| :-- | :-- | :-- |
| REFUTED | 4 | W14-3, W14-6, W14-9, W14-12 |
| DROPPED — dead code | 5 | W14-4, W14-7, W14-8, W14-10, W14-11 |
| DROPPED — intended | 4 | W14-1, W14-2, W14-5, W14-15 |
| DROPPED — unreachable | 2 | W14-13, W14-14 |
| CONFIRMED | 0 | — |

- `[Fact]` **Confirmed fixes: none.** No code change is recommended from this ticket.
- `[Fact]` **Optional polish notes (not defects, SHUAI's call)**: (a) W14-1 — explicit length check in the workbench fallback; (b) W14-3 — one comment stating the loop bound; (c) W14-5 — fix the "click again to clear" label for the intent family; (d) W14-15 — one comment naming the canonical receipt payload shape; (e) W14-4 observation — a newly typed planner name joins the roster only after reload.
- `[Fact]` The 107 polish findings from the v2 review were not triaged here. They live only in `/kaggle/working/w12-review-v2.md` in the still-running Kaggle session. If SHUAI wants them kept, they must be pulled into the repo before that session ends.

---

## Decision gate for SHUAI

- **Option A (Recommended — close Wave 14 as triaged, zero fixes)**: Accept this triage. No implementation follows. The v2 review is closed as "checked, no defect found".
- **Option B (Take up the optional polish notes)**: Pick any of the five polish notes above and run them as a small Wave 14 implementation slice with the domain gate green after each change.
- **Option C (Second opinion)**: Send the five dropped-as-intended items (W14-1, W14-2, W14-5, W14-14, W14-15) to agy (Gemini 4 Argon, plan mode) for an independent read before closing.

---

## Second opinion — agy Gemini 4 Argon (11 Nov 2026, plan mode, read-only)

- `[Fact]` Run via the no-permission route: Jinggru extracted the cited code at `110e2fd` into `.scratch/reviews/W14-agy-input-110e2fd.md` (65 KB, 14 excerpts, line numbers verified) and agy read only files — no shell, no permission flag. Prompt at `.scratch/reviews/W14-agy-second-opinion-prompt2.md`. Verdict saved at `.scratch/reviews/W14-agy-second-opinion.md` (15,437 bytes). Run time ~3m35s.
- `[Fact]` **Agy's verdicts: AGREE 4 of 5, DISAGREE 1 of 5.** W14-1 AGREE, W14-2 AGREE, W14-5 DISAGREE (should-fix, or polish if the family is locked to single-select), W14-14 AGREE, W14-15 AGREE. `[Inference]` None of the five is a blocker.
- `[Fact]` **W14-5 flips to a real defect.** The `TagPicker.toggle` early return (`page.tsx:261`) fires whenever the clicked value is already selected, with no check on `family.selection`. `MetadataBoard.updateFamily` (`page.tsx:266`) lets a user switch `tag-business-intent` to `selection: "multi"` at runtime, after which no selected intent tag can ever be deselected in the picker. The caption "single-select; click again to clear" is false for this family in both modes. Jinggru verified both claims against `110e2fd` after the verdict: toggle verbatim, selection control verbatim.
- `[Fact]` **Two errors in Jinggru's W14-5 triage, corrected by the second opinion.** (a) "In the shipped configuration the family is single-select, so the multi-select condition does not occur" is wrong — the runtime switch exists. (b) `validateCoreSetup` was cited as the project-level guard; it checks only that the *library family* has values (`!intentFamily?.values.length`). The project-level guard is in `PlanView.save` (`page.tsx:412`): a project cannot save without an intent tag. Jinggru verified the save guard verbatim.
- `[Fact]` **W14-1 nuance agy found, verified by Jinggru.** When `approvedAmount` is 0 and the project has multiple items, the baseline version's stored `total` counts only the first item (`requirementTotal(enrichedItems[0])`, workbench:1181-1183), while the same version's `purchaseItems` hold all items. `createBudgetVersion` (`domain:78`) recomputes a total from all items only when `params.total` is undefined — but the workbench always passes a defined `total`. So the baseline total undercounts multi-item unapproved projects. Not a crash; should-fix/polish. Same file region as W14-5's fix would not cover it (workbench, not page.tsx).
- `[Fact]` **W14-2 nuance, verified.** On a fresh workspace, typing the planner name in `ProfileScreen.update` (`page.tsx:256`, profile fields only) does not populate `settings.teamMembers` until reload, so a project created before reload gets `ownerIds: []`. The save guard ("Select at least one person in charge") catches it at save, so the gap is UX, not data loss. Also `defaultMembers` checks `plannerName` without `.trim()` while `validateProfile` uses `.trim()`. Polish.
- `[Fact]` **W14-14 extra, verified.** Qwen's sub-claim that the default project is "possibly missing approvedBudget and currency" is false: the default initializes `currency: "USD"` and `approvedBudget: 0`.
- `[Fact]` **W14-15 nuance, verified.** `Array.isArray(projectData.purchaseItems || rawProject.purchaseItems || rawProject.lines)` short-circuits on the first truthy operand, so a truthy non-array first key would skip the later keys. Live callers pass arrays, so this is latent, not live. `POST /api/sync` is an HTTP endpoint reachable beyond `triggerHybridSync` (W13-D2 auth guards apply). No change — both files are guardrailed.
- `[Fact]` **Agy's proposed W14-5 fix (page.tsx only, no guardrailed file):** in `TagPicker.toggle`, block deselection only when the clicked value is the *last* selected tag in `tag-business-intent`; relabel the family caption from "click again to clear" to "required".
- `[Projection]` **Close-out options for SHUAI:** (A) take W14-5 (and optionally the W14-1 baseline total) as a small fix slice, then close Wave 14; (B) close Wave 14 with zero fixes and record W14-5 + W14-1 as deferred polish.

---

## Implementation slice — W14-F1 + W14-F2 (approved by SHUAI 11 Nov 2026 00:48)

- **Status**: `[done]` 11 Nov 2026. One small slice, local clone, uncommitted, nothing pushed (same as Wave 13). Gate **30/30** green (28/28 at slice start + 2 new guard tests).
- **Source**: agy second opinion (`.scratch/reviews/W14-agy-second-opinion.md`) + Jinggru verification against `110e2fd`.
- **Mandatory gate**: `node --test tests/budget-domain.test.mjs` green after each fix (28/28 at slice start, plus one new guard test per fix).

> `[Hard guardrail]` Do NOT touch `app/budget-domain.mjs`, `db/schema.ts`, `app/api/sync/route.ts`, `worker/index.ts`, `vite.config.ts`, `vite.config.pages.ts`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, or `AGENTS.md` §2. Do NOT touch PR #4. Both fixes below touch only `app/page.tsx` and `app/ellies-book-workbench.tsx` plus guard tests in `tests/budget-domain.test.mjs`.

### W14-F1 — TagPicker: let a Business intent tag be deselected unless it is the last one (W14-5 fix)

- **Objective**: `[Fact]` Fix the defect agy confirmed: `TagPicker.toggle` blocks deselection of a `tag-business-intent` value unconditionally, even after the family is switched to multi-select at runtime.
- **Steps**:
  1. In `app/page.tsx` `TagPicker.toggle`, compute `const selectedInFamily = selected.filter((id) => tagValueFor(data, id)?.family.id === family.id);` and change the early return to fire only when the value is the last selected tag in the family: `if (has && label.startsWith("Project metadata tags") && family.id === "tag-business-intent" && selectedInFamily.length <= 1) return;`
  2. Change the family caption so `tag-business-intent` shows "required" instead of "single-select; click again to clear" when it is the intent family.
  3. Add a guard test in `tests/budget-domain.test.mjs` asserting the toggle source contains the `selectedInFamily.length <= 1` guard and the "required" caption for the intent family.
- **Touches**: `app/page.tsx` (toggle + caption only), `tests/budget-domain.test.mjs` (one new test).
- **Acceptance criteria**:
  - `[Fact]` A selected intent tag can be deselected when 2+ intent tags are selected (multi mode) or when another intent tag remains.
  - `[Fact]` The last selected intent tag in the "Project metadata tags" picker still cannot be deselected (the project-level save guard at `page.tsx:412` stays the backstop).
  - `[Fact]` The caption no longer promises "click again to clear" for the intent family.
- **Verification**: domain gate green after the change.

### W14-F2 — Baseline version total sums all items (W14-1 fix)

- **Objective**: `[Fact]` Fix the undercount agy found and Jinggru verified: for a multi-item project with `approvedAmount` 0 and no revisions, the baseline version's stored `total` counts only the first item (`requirementTotal(enrichedItems[0] || {})`) while the version's `purchaseItems` hold all items.
- **Steps**:
  1. In `app/ellies-book-workbench.tsx`, replace `requirementTotal(enrichedItems[0] || {})` with `enrichedItems.reduce((sum, item) => sum + requirementTotal(item), 0)`, keeping the `activeProject.approvedAmount ||` fallback. Empty `enrichedItems` still yields 0 via the reduce.
  2. Add a guard test in `tests/budget-domain.test.mjs` asserting the workbench source contains the reduce form and no longer contains `requirementTotal(enrichedItems[0]`.
- **Touches**: `app/ellies-book-workbench.tsx` (one expression), `tests/budget-domain.test.mjs` (one new test).
- **Acceptance criteria**:
  - `[Fact]` Baseline total equals the sum of all items' requirement totals when `approvedAmount` is 0.
  - `[Fact]` Empty project still yields total 0. Approved amount still wins when set.
- **Verification**: domain gate green after the change. (`createBudgetVersion` recomputes from all items only when `params.total` is undefined; the workbench always passes a defined total, so the workbench expression is the correct place to fix.)

### Close-out

- `[Fact]` **Wave 14 CLOSED 11 Nov 2026.** W14-F1 (TagPicker guard + "required" caption) and W14-F2 (baseline total sums all items) both implemented in the local clone with one guard test each; domain gate **30/30** green after each fix (29/29 after F1, 30/30 after F2). Nothing committed, nothing pushed. Remaining frontier stays W13-T3 (CI-only) and W13-D4 (deferred).
