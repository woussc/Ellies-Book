# ADR 0002: Graph-First Interaction Model & Adaptive Surface Protocol

- **Status**: Accepted
- **Decider**: SHUAI (`Chen Shuaizhou`)
- **Date**: 2026-10-20
- **Scope**: Frontend Architecture, UX Hierarchy, Mobile vs. Desktop Interaction Model

---

## 1. Context & Business Intent

Ellie's Book is designed to rival tools like Notion and Obsidian while bridging the gap to formal accounting.
Most project tools rely on static forms or flat lists, leaving budgets disconnected from physical work.
**The key commercial selling point and fundamental user experience of Ellie's Book is its interactive node graph.** Non-finance operators, creative directors, and project leads understand and navigate projects as a visual network of deliverables, items, sourcing partners, commitments, and attached notes.

---

## 2. Architectural Decisions

### 2.1 Visual Canvas Map as the Primary Fundamental Workspace
- The **Visual Canvas Map** is the default landing surface when entering any project.
- It displays the full living hierarchy:
  $$\text{Project} \longrightarrow \text{Work Packages} \longrightarrow \text{Purchase Items} \longrightarrow \text{Sourcing Allocations} \longrightarrow \text{Quotes / POs / Invoices}$$
  interlinked with bidirectional Obsidian `[[Knowledge Notes]]`.
- Tables and Document views are not disconnected silos; they are **synchronized lenses** of the exact same underlying projection.

### 2.2 Adaptive Inspector Model: Side Drawer vs. Full Screen
- **Desktop & Large Tablets ($\ge 960\text{px}$)**:
  - Tapping or clicking any node opens a **Slide-Over Inspector Drawer** from the right edge ($420\text{px}$ width).
  - The Canvas Map remains visible, interactive, and active in the background, maintaining spatial context.
  - The drawer exposes three tabs:
    1. **Operational**: Deliverable specs, quantities, vendor details, and attached Obsidian field notes.
    2. **Managerial**: Plan vs. Reality status, open PO balances, and budget headroom.
    3. **Accounting**: Double-entry GL codes (`001230`), tax/freight breakdown, and audit lineage.
- **Mobile & Mini-Tablets ($< 960\text{px}$)**:
  - Inspector opens as an adaptive full-screen sheet or elevated bottom sheet to prevent viewport distortion.

### 2.3 Mobile-First Interaction Protocol: Zero Frustration on Small Screens
- **No Complex Drag-and-Drop on Phones**: Touch manipulation of node coordinates is disabled or strictly minimized on phone screens ($390\text{px}$–$680\text{px}$) to avoid accidental layout corruption and touch fatigue.
- **The 3 Mobile Priorities**:
  1. **Quick Capture**: 1-tap capture actions floating at the base of the screen:
     - `+ Log Quote / PO / Invoice` (with progressive disclosure).
     - `+ Add Field Note` (with voice or quick Markdown).
     - `+ Add Deliverable / Purchase Item`.
  2. **Insight Gathering**: Instant 3-second budget health check (`Left to Spend`, `Paid & Ordered`, and remaining cash headroom).
  3. **1-Tap Approvals**: Fast controller queue to approve or reject pending proposed budget changes or purchase commitments on the fly.
- **Mobile Canvas Representation**: Mobile presents a streamlined touch-first tree/neighbourhood feed where tapping an entity opens its full-screen inspector, while desktop preserves the full 2D Bezier canvas.

---

## 3. Technical Invariants

1. **Coordinate Invariance**: Node coordinates $(x, y)$ are strictly visual layout metadata. Changing or dragging a node on desktop never alters financial totals, GL codes, or relational table records.
2. **Graph-to-Table Equivalence**: Every node on the canvas maps 1:1 to a row in the 11 canonical relational tables (`Projects`, `Work_Packages`, `Purchase_Items`, `Sourcing_Allocations`, `Lifecycle_Records`, `Lifecycle_Lines`, `Purchase_Links`, `Lifecycle_Transitions`, `Knowledge_Notes`, `Audit_Events`).
3. **Bidirectional Knowledge Linking**: Obsidian notes can be attached to any node and cross-referenced via `[[TargetID|Label]]` syntax without breaking financial integrity.

---

## 4. Consequences & Migration Roadmap

- **Positive**:
  - Positions the visual graph front and center as the primary product identity and differentiator.
  - Eliminates context-switching between disconnected tabs.
  - Keeps mobile focused on high-frequency field tasks (capture, insights, approvals) rather than desktop-centric canvas layout editing.
- **Next Steps**:
  - Re-align `app/ellies-book-workbench.tsx` so the Visual Canvas Map with the persistent desktop Inspector Drawer is the default primary surface.
  - Ensure the Quick Capture bottom sheet and 1-tap Approval queue dominate the mobile viewport.
  - Present this plan for Gemini 4 Argon review.
