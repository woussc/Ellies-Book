# ADR 0001: Hybrid Local-First + Cloud Sync Architecture and Dual-Mode Graph Canvas

- **Status**: Accepted
- **Date**: 2026-10-20
- **Decider**: **SHUAI** (`Chen Shuaizhou`)

---

## 1. Context

**Ellie's Book** must serve non-finance and non-MBA users through an intuitive visual node workflow and Obsidian-like interlinked knowledge graph while providing 100% auditable, modular relational tables and charts across both desktop and mobile devices.

Three foundational architectural questions were framed at the Wave 1 gate:
1. Persistence and commercial deployment topology;
2. Node graph canvas interaction paradigm;
3. Multi-model execution orchestration using the Pro plan's Gemini (Argon High / Pro / Flash) and Claude models.

---

## 2. Decisions (`[Fact]`)

### Decision 1: Hybrid Local-First + Cloud Drizzle SQLite/D1 Persistence
- **Client Layer**: Local-first state persisted in browser storage (`IndexedDB` / `localStorage`) with deterministic import/export of Obsidian-compatible Markdown folders (YAML frontmatter + `[[wikilinks]]`) and normalized multi-sheet workbooks.
- **Server / Cloud Sync Layer**: Canonical relational schema defined in `db/schema.ts` using Drizzle ORM (`drizzle-orm/sqlite-core`) targeting SQLite / Cloudflare D1, allowing instant offline work on desktop or phone with authenticated cloud synchronization across devices.

### Decision 2: Dual-Mode Graph Canvas (Structured Financial DAG + Obsidian Knowledge Overlay)
- **Mode A — Structured Financial Lineage DAG**: Auto-laid-out hierarchical flow (`Project -> WorkPackage -> PurchaseItem -> SourcingAllocation -> LifecycleLine [Quotation / PO / Invoice / Actual]`) where node positions are computed deterministically or adjusted purely as view state, enforcing the **Graph-to-Table Equivalence Rule**.
- **Mode B — Obsidian Knowledge Graph Overlay**: Bidirectional `[[wikilink]]` and `#tag` connections linking Markdown `KnowledgeNote` entities directly to any `Project`, `WorkPackage`, `PurchaseItem`, `LifecycleRecord`, or `Outcome`.
- **Mobile Adaptation (`390px–768px`)**: Automatically adapts the graph into a touch-friendly Collapsible Neighbourhood & Outline Deck with 1-tap drill-down and quick expense/approval actions.

### Decision 3: Pro-Plan Multi-Model Orchestration (Gemini 4 Argon High + Claude + Pro/Flash Subagents)
- **Gemini 4 Argon (High)** acts as Lead Architect, Spec/Ticket Generator, and Post-Ticket Refiner.
- **Claude (via Antigravity Pro Plan Model Selector)** and **Definitive Implementer Subagents** execute vertical-slice TDD tickets (`W1`–`W4`) against explicit seam contracts in `.scratch/tickets/`.
- **Checkpoint Handoff**: Every ticket completion updates `.scratch/HANDOFF-STATE.md` so switching the active model in the Antigravity UI between **Gemini 4 Argon (High)** and **Claude** preserves 100% of architectural state and test verification.
