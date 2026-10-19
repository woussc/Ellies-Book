# Ticket W2-T1 & W3-T1: Dual-Mode Node Workflow + Obsidian Knowledge Canvas, Modular Table Workbench & Plan-vs-Reality Charts

- **Wave**: Wave 2 & Wave 3 (UI Surface & Synchronized Projections)
- **Status**: `completed`
- **Blocked By**: `W1-domain-and-schema.md`

---

## 1. Objective

Integrate the three core differentiating pillars of **Ellie's Book** into the interactive application (`app/page.tsx` + modular sub-surfaces and `app/globals.css`) while preserving 100% of existing Function Budget Studio 2.0 tests (`tests/rendered-html.test.mjs` and `tests/budget-domain.test.mjs`):

1. **Pillar 1 — Dual-Mode Node Workflow & Obsidian Knowledge Graph Surface (`Graph & Knowledge Canvas`)**:
   - **Structured Financial DAG Mode**: Visual node-based workflow (`Project -> Work Package -> Purchase Item -> Sourcing Allocation -> Quotation / PO / Invoice / Actual`) with collapsible summary nodes, expandable row nodes, distinct edge styling for containment vs. document lineage, and interactive Node Inspector drawer.
   - **Obsidian Knowledge Overlay**: Attach Markdown notes with `[[wikilinks]]` and `#tags` to any node, visualize bidirectional backlinks on the graph, and click any `[[wikilink]]` to jump directly to the linked financial or project node.
2. **Pillar 2 — Auditable Modular Table Explorer & Clear Plan-vs-Reality Charts (`Modular Tables & Audit`)**:
   - **Canonical Table Switcher**: Inspect and filter every underlying relational table (`Projects`, `Work_Packages`, `Purchase_Items`, `Sourcing_Allocations`, `Budget_Versions`, `Lifecycle_Records`, `Lifecycle_Lines`, `Purchase_Links`, `Lifecycle_Transitions`, `Knowledge_Notes`, `Audit_Events`) directly on screen with zero black-box hidden state.
   - **Clear Visual Charts**: Quarter-by-quarter Plan-vs-Commitment-vs-Actual burn chart, Sourcing Allocation breakdown, and Headroom waterfall alongside the existing `FinancialBar`.
3. **Pillar 3 — Mobile & Desktop On-the-Fly Command Bar (`390px`–`1440px`)**:
   - Responsive mobile bottom/quick-action bar and collapsible outline fallback for the graph canvas so non-finance users and team leads can review approvals, log expenses, and inspect node lineage on phone (`390px`) or desktop (`1440px`) with zero horizontal overflow.
