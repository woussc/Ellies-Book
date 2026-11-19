# QA1 — QA baseline money and data findings (F1–F5)

Source: QA Bot baseline run on `main` (five money/data findings). Scope: fix only logic the v1 rebuild keeps (`app/budget-domain.mjs` and what PR 15/16 previews import from it). Legacy Studio (`app/page.tsx`) and workbench screens are replaced by the rebuild.

| Finding | Root cause | Kept logic? | Action |
| :--- | :--- | :--- | :--- |
| F1 payment reduces an unrelated order | [Fact] `computeLifecycleLineage` applied any `LifecycleTransition`, even from a PO line on another spending line. The workbench quick invoice links to the first open PO line. | Yes (PR 15 imports `computeLifecycleLineage`) | Fixed: a transition between two different spending lines does not reduce Open Commitment. Regression test `QA baseline F1`. |
| F2 over-allocation shrinks the plan | [Fact] `validateRequirementAllocations` already returns `over-allocated`; the Studio detailed-planning save does not block on it. | No | Left (legacy Studio). |
| F3 Proposed raise shown as approved | [Fact] Studio editor writes `approvedAmount` directly and `approvedReporting` reads it. `effectiveApprovedBudget` keeps Proposed out of `approvedTotal`. | No | Left (legacy Studio). |
| F4 category names replaced by "Shelf tester unit" | [Fact] Studio detailed-planning requirement picker/sample library (`app/page.tsx`). Domain uses `itemNameSnapshot`. | No | Left (legacy Studio). |
| F5 Monitor forecast leaves out uncommitted plan | [Fact] Studio `projectMonitor` uses `actual + open`. Domain `buildProjectGraphProjection` forecast includes uncommitted planned cost (Reports shows the correct value). | No | Left (legacy Studio). |

[Inference] PR 16 `app/look-b-model.mjs` `totals().forecast` adds only `planned` spending records, so unspent category plan money is not in its forecast. It lives in PR 16, not `main`; fix it in PR 16.
