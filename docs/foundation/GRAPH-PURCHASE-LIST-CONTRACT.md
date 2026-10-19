# Graph-led Purchase List — V1 information contract

Status: approved working contract for the first implementation pass

This contract keeps the graph, the on-screen table and exported workbook as three views of the same governed records. The graph is the primary create/edit/navigate surface; it is not a second database.

## Scope

V1 covers one business function and one project through:

1. project setup and controlled metadata;
2. a graph-led purchase list;
3. numeric planning and sourcing allocations;
4. immutable Original / Adjustment versions with Proposed / Approved authorization states;
5. quotation → purchase order → invoice → actual lineage;
6. line-level attribution and reconciliation; and
7. normalized Excel-compatible export.

Multi-function funding, cross-project split funding, live Finance/ERP integration, server persistence, authentication, production AI/OCR and non-finance-user validation are outside this pass.

## Graph-to-table rule

| Graph concept | Canonical meaning |
|---|---|
| Collapsed large node | A summary projection of many records |
| Expanded node | One record, equivalent to one spreadsheet row |
| Node type | A table/sheet of records |
| Edge | A typed relationship/link record |
| Coordinates, collapse state and focus | View state only; never financial data |

No untyped or freehand financial edges are allowed. Containment edges are visually distinct from document lineage edges.

## Records and stable identifiers

- `BusinessFunction`: `function_id`, name, status.
- `Project`: stable `record_id`, display `project_id`, name, function, period, owner, status, currency.
- `BudgetVersion`: immutable header with sequence, `Original` or `Adjustment`, `Proposed` or `Approved`, predecessor, reason and full resulting total.
- `PurchaseItem`: stable logical item with work package, description, specification, unit, quantity and planning fields.
- `SourcingAllocation`: optional partial split by vendor, warehouse, country or sourcing method.
- `LifecycleRecord`: quotation, purchase order, invoice or actual header.
- `LifecycleLine`: original line-level amount, quantity and reference.
- `PurchaseLink`: typed link from a lifecycle line to a purchase item or sourcing allocation, including attributed quantity/amount.
- `LifecycleTransition`: conversion link such as PO line → invoice line or invoice line → actual posting.
- `AuditEvent`: owner, timestamp, action, reason and source reference for material changes.

Stable IDs are separate from display and Finance codes. Codes are text so values such as `001230` remain unchanged. Blank and zero are distinct.

## State and calculation rules

- Every project starts with a `General` work package; it may be renamed or supplemented.
- A saved version is a full purchase-list snapshot. Approved versions are immutable; an edit creates a new proposed adjustment.
- Only the latest approved version is the effective approved baseline. A proposed adjustment never silently changes it.
- If a purchase item has allocations, allocation totals replace the parent estimate; the parent is not counted twice.
- Partial allocations may be saved and are prominently flagged. Over-allocation is blocked.
- Converted commitments are reduced by exact transition links; PO, invoice and actual values are not double-counted.
- Downstream-linked records are retired, reversed or replaced rather than silently deleted.
- V1 uses one project reporting currency. Currency is still retained on amount-bearing records for future expansion.

## Interaction contract

Users may create and edit through node actions: create project, add purchase item, add allocation, propose adjustment, approve/withdraw version, create lifecycle record, assign a line, split an attribution, and export. Selecting any node opens an inspector with source fields, derived totals, status and lineage. Dragging a node only changes layout; it never changes financial relationships.

The graph must always provide a keyboard-readable outline/table fallback and remain usable at narrow widths.

## Export contract

The primary export is a normalized workbook. The current prototype keeps its existing descriptive sheet names so prior exports remain recognizable: `Function budget`, `Projects`, `Work packages`, `Budget and allocation lines`, `Sourcing allocations`, `Budget revisions`, `Spend documents`, `Spend document lines`, `Purchase links`, `Lifecycle transitions` and `Reconciliation`, with the controlled metadata sheets alongside them. These correspond to the logical contract tables `Project`, `Purchase_Items`, `Sourcing_Allocations`, `Budget_Versions`, `Lifecycle_Records`, `Lifecycle_Lines`, `Purchase_Links` and `Lifecycle_Transitions`; future revisions may rename sheets without changing their stable IDs or columns.

Amounts are numeric, currencies are separate fields, IDs and relationship columns are explicit, ISO dates are used, and spreadsheet-formula text is neutralized. Existing Markdown, TSV and CSV exports remain available.

## Deterministic acceptance scenario

For the synthetic POSM project, one purchase item of 1,200 units is allocated 600 / 400 / 200 across three sourcing routes. The resulting plan is USD 11,600 with zero unallocated quantity. A later adjustment must be visible as a new version, and a PO → invoice → actual conversion must reduce open commitment without double counting.
