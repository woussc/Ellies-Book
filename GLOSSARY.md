# Ellie's Book — Ubiquitous Language & Domain Glossary

This glossary is the single source of truth for domain terminology in **Ellie's Book** (evolving from *Function Budget Studio 2.0* and the *Graph-led Purchase List V1 Contract*). All code modules, database tables, graph node types, exports, and agent specifications must use these exact terms.

---

## 1. Core Product Pillars

- **Ellie's Book**: A unified business management, project management, and budget-versus-expenditure platform that aligns **Plan** and **Reality**. Designed for rapid adoption by non-finance and non-MBA users through visual node workflows and Obsidian-style bidirectional knowledge linking, while maintaining 100% auditable, modular relational tables and charts across desktop and mobile.
- **Graph-to-Table Equivalence Rule**: The interactive node graph, the on-screen relational tables/charts, and the exported multi-sheet workbook are **three synchronized projections of one governed data model**. The graph is never a separate unstructured canvas or black box.
  - **Collapsed Node**: A summary projection of multiple underlying records (e.g., a Work Package or Project summary roll-up).
  - **Expanded Node**: Exactly one governed record, equivalent to one relational table row.
  - **Node Type**: Maps 1:1 to a canonical relational table/sheet.
  - **Typed Edge**: Maps 1:1 to a relational foreign key or join record (`ContainmentEdge`, `PurchaseLink`, `LifecycleTransition`, `KnowledgeBacklink`). Untyped or freehand financial edges are prohibited.
  - **Canvas View State**: Node `(x, y)` coordinates, zoom level, collapse state, and focus state are view metadata only; dragging or rearranging nodes never alters financial calculations or accounting relationships.

---

## 2. Three Connected Perspectives on Every Spend Record

Every financial requirement and transaction line preserves three linked views simultaneously:
1. **Operational View**: What is being built or purchased, in plain domain language (item specification, quantity, unit price, vendor, warehouse, country, deliverable, timeline milestone).
2. **Managerial View**: Why the resource is allocated (project/initiative, work package, accountable owner, decision assumptions, expected outcome/KPI, and evidence strength).
3. **Accounting View**: How Finance officially classifies, posts, and reconciles the record (`glCode` preserved as string with leading zeros such as `"001230"`, cost center, fiscal period/quarter, and mapping confirmation status).

---

## 3. Canonical Domain Entities (`[Fact]` — Verified Baseline + Graph V1 Contract)

| Entity | Identifier | Definition |
| :--- | :--- | :--- |
| **`BusinessFunction`** | `function_id` | Controlled organizational unit (e.g., Marketing & Brand, Technology / IT, Retail Operations) with governed starter presets, currency, and fiscal calendar settings. |
| **`Project`** (or **Operational Cost Pool**) | `record_id` (immutable UUID/internal ID) + `project_id` (replaceable metadata-generated code, e.g., `GUC-MU+FRAG-0001`) | The primary unit of planning, timeline tracking, budget authorization, deliverable ownership, and expenditure reconciliation. |
| **`WorkPackage`** | `work_package_id` | A structural phase, deliverable group, or sub-stream inside a `Project`. Every project starts with a `General` work package that can be renamed or supplemented. |
| **`BudgetVersion`** | `version_id` | An immutable snapshot of a project's budget plan with sequence number, version type (`Original` or `Adjustment`), authorization state (`Proposed` or `Approved`), predecessor reference, reason, and total. Only the latest `Approved` version forms the effective approved baseline. |
| **`PurchaseItem`** (`ProjectSpendLine`) | `spending_line_id` | A logical requirement inside a `WorkPackage` with description, specification, unit of measure, required quantity, base unit price, active quarters (`Q1`–`Q4`), and linked `SpendingItemDefinition`. |
| **`SourcingAllocation`** | `allocation_id` | An optional split of a `PurchaseItem` across specific vendors, warehouses, countries, currencies, or sourcing methods (`quantity * unitPrice + additionalCostEstimate`). When allocations exist on a `PurchaseItem`, the sum of allocations replaces the parent estimate (never double-counted). |
| **`LifecycleRecord`** (`SpendDocument`) | `document_id` | A procurement or financial document header: `Quotation`, `Purchase order`, `Invoice`, or `Actual` Finance posting. |
| **`LifecycleLine`** (`DocumentLine`) | `document_line_id` | An individual line item on a `LifecycleRecord` carrying native amount, currency, quantity, spend quarter, and source document reference. |
| **`PurchaseLink`** | `purchase_link_id` | A typed attribution link connecting a `LifecycleLine` to a `PurchaseItem` or `SourcingAllocation` with attributed quantity and amount. |
| **`LifecycleTransition`** | `transition_id` | A typed conversion link tracking commitment progression (`Quotation -> PO -> Invoice -> Actual`). Reduces open commitment on upstream PO lines so converted commitments are never double-counted. |
| **`OutcomeDefinition` & `ProjectOutcome`** | `outcome_id` | A non-composite, domain-specific KPI or deliverable result linked to a project, recording baseline, target, measurement window, evidence source, and evidence strength without forcing a synthetic single ROI score. |
| **`KnowledgeNote` & `Backlink`** | `note_id` / `link_id` | Obsidian-compatible Markdown notes (`[[wikilinks]]` + YAML frontmatter) attached to any `Project`, `WorkPackage`, `PurchaseItem`, `LifecycleRecord`, or `Outcome` for narrative context, meeting decisions, and deliverable evidence. |
| **`AuditEvent`** | `audit_id` | Append-only provenance record capturing actor/owner, timestamp, action type, before/after delta, reason, and source document reference for any material change. |

---

## 4. Invariant Financial Rules

1. **No Double Counting of Allocations**:
   - Without allocations: $\text{Requirement Total} = \text{Quantity} \times \text{Unit Price}$
   - With allocations: $\text{Requirement Total} = \sum (\text{Allocation Quantity} \times \text{Allocation Unit Price} + \text{Additional Cost Estimate})$
2. **Quantity Reconciliation**:
   - $\text{Unallocated Quantity} = \max(0, \text{Requirement Quantity} - \sum \text{Allocation Quantity})$
   - Over-allocation ($\sum \text{Allocation Quantity} > \text{Requirement Quantity}$) is blocked by validation.
3. **No Double Counting of Converted Commitments**:
   - $\text{Open Commitment (PO Line)} = \max(0, \text{PO Line Reporting Amount} - \sum \text{Linked Invoice/Actual Reporting Amounts})$
4. **Core Headroom Equations**:
   - $\text{Available to Commit} = \text{Approved Budget} - \text{Actuals} - \text{Open Commitments}$
   - $\text{Forecast Spend} = \text{Actuals} + \text{Open Commitments} + \text{Uncommitted Planned/Proposed Cost}$
   - $\text{Projected Headroom} = \text{Approved Budget} - \text{Forecast Spend}$
5. **Authorization Boundary**:
   - A `Proposed` budget or `Proposed` adjustment never increases `Approved Budget` or `Available to Commit` until explicitly transitioned to `Approved`.
   - AI recommendations (OCR extraction, GL code matching, duplicate detection) carry confidence scores and source provenance; they never auto-approve budgets or accounting classifications without human confirmation.
