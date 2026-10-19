# Ticket W1-T1 & W1-T2: Deep Domain Module Extraction, Graph V1 Relational Core & Drizzle Schema

- **Wave**: Wave 1 (Foundational Relational & Graph Engine)
- **Status**: `completed`
- **Blocked By**: None
- **Unblocks**: `W2-T1` (Dual-Mode Node Graph & Obsidian Canvas), `W3-T1` (Modular Table Explorer & Time-Series Charts)

---

## 1. Objective

Transform the existing `app/budget-domain.mjs` and monolithic state logic into a deep, modular domain engine (`app/budget-domain.mjs` + `db/schema.ts`) that implements the full **Graph-led Purchase List V1 Contract** (`docs/foundation/GRAPH-PURCHASE-LIST-CONTRACT.md`) and **ADR 0001**:

1. **Preserve 100% Backwards Compatibility**: Keep all existing exports in `app/budget-domain.mjs` (`allocationSubtotal`, `allocationTotal`, `requirementTotal`, `allocatedQuantity`, `unallocatedQuantity`) passing existing tests.
2. **Add Graph V1 & Obsidian Knowledge Domain Engine (`app/budget-domain.mjs`)**:
   - **Blocking Over-Allocation Validation**: `validateRequirementAllocations(requirement)` returning `{ valid, allocated, unallocated, overAllocatedAmount, status }` and blocking `allocated > quantity`.
   - **Immutable `BudgetVersion` State Machine**: `createBudgetVersion(...)` and `effectiveApprovedBudget(versions)` enforcing that only the latest `Approved` version sets the baseline, while `Proposed` `Original`/`Adjustment` versions remain pending without altering available funding.
   - **Commitment Conversion & No-Double-Counting Engine**: `computeLifecycleLineage(poLines, transitions, lifecycleLines)` calculating exact converted amounts via `LifecycleTransition` (`Quotation -> PO -> Invoice -> Actual`) and open commitment headroom.
   - **Graph-to-Table Projection Engine (`buildProjectGraphProjection`)**: Deterministic projection that maps `Project`, `WorkPackage`, `PurchaseItem`, `SourcingAllocation`, `LifecycleRecord`, `PurchaseLink`, `LifecycleTransition`, and `KnowledgeNote` into:
     - Typed Graph Nodes (`collapsed` summary roll-up vs `expanded` row projection);
     - Typed Graph Edges (`containment`, `purchase_link`, `lifecycle_transition`, `knowledge_backlink`);
     - Canonical Relational Table Rows (`Project`, `Budget_Versions`, `Purchase_Items`, `Sourcing_Allocations`, `Lifecycle_Records`, `Lifecycle_Lines`, `Purchase_Links`, `Lifecycle_Transitions`, `Knowledge_Notes`, `Audit_Events`).
   - **Obsidian `[[Wikilink]]` & YAML Frontmatter Parser (`extractWikilinks`, `buildBacklinkIndex`)**: Parses `[[target|alias]]` and `#tags` from Markdown notes and builds a bidirectional backlink index connecting notes to financial records.
3. **Populate Canonical Drizzle SQLite/D1 Schema (`db/schema.ts`)**:
   - Replace the empty `export {};` in `db/schema.ts` with the full Drizzle SQLite schema covering `businessFunctions`, `projects`, `workPackages`, `budgetVersions`, `purchaseItems`, `sourcingAllocations`, `lifecycleRecords`, `lifecycleLines`, `purchaseLinks`, `lifecycleTransitions`, `knowledgeNotes`, and `auditEvents`.

---

## 2. Public Seam & Verification Tests

- Extend `tests/budget-domain.test.mjs` with comprehensive red-green unit tests covering:
  1. POSM USD 11,600 deterministic scenario (`600 * 10 + 500`, `400 * 11 + 300`, `200 * 2`);
  2. Over-allocation rejection (`allocated > required`);
  3. Immutable `BudgetVersion` baseline calculation (`Original/Approved` vs `Adjustment/Proposed` vs `Adjustment/Approved`);
  4. `LifecycleTransition` PO $\rightarrow$ Invoice $\rightarrow$ Actual open-commitment reduction without double counting;
  5. `buildProjectGraphProjection` Graph-to-Table equivalence (collapsed vs expanded nodes, typed edges, coordinate changes never altering financial totals);
  6. `extractWikilinks` and `buildBacklinkIndex` bidirectional Obsidian linking.
