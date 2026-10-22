# Ellie's Book

> **Aligning Plan and Reality**: A unified project management, node-based workflow, Obsidian-interlinked knowledge graph, and auditable budget-versus-expenditure platform for desktop and mobile.

---

## Core Value Proposition

**Ellie's Book** bridges the gap between how teams actually plan and execute work (projects, timelines, deliverables, notes, vendors) and how Finance governs expenditure (budgets, commitments, purchase orders, invoices, actuals, GL codes).

1. **Intuitive Node Workflow + Obsidian Knowledge Graph**:
   - Built for non-finance and non-MBA users to learn immediately.
   - Visual node-based workflow connecting `Project -> Work Package -> Purchase Item -> Sourcing Allocation -> Quotation / PO / Invoice / Actual`, paired with Obsidian-style `[[wikilinks]]` and Markdown notes.
2. **100% Auditable Modular Tables & Clear Charts (Zero Black Box)**:
   - Every node and edge in the graph is a strict projection of a normalized relational table (`GRAPH-PURCHASE-LIST-CONTRACT.md`).
   - Extractable at any time into formal relational tables, multi-sheet workbooks, and clear Plan-vs-Reality burn and headroom charts.
3. **Desktop + Mobile On-the-Fly Management**:
   - Full-featured split-pane canvas and table workbench on desktop; responsive touch-first project, expense, and approval workspace on phone (`390px+`).

---

## Repository Structure

| Path | Purpose |
| :--- | :--- |
| [`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md) | Multi-model & multi-agent operating contract (Claude (latest model) lead + specialist subagents). |
| [`GLOSSARY.md`](./GLOSSARY.md) | Canonical ubiquitous language, entity definitions, and financial calculation invariants. |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Master product architecture and phased vertical-slice tracer-bullet roadmap. |
| [`docs/foundation/`](./docs/foundation/) | Authoritative project brief, v2.0 handoff contract, and Graph-led Purchase List V1 specification. |
| [`.agent/skills/`](./.agent/skills/) | 44 vendored agent skills from `mattpocock/skills`, `Leonxlnx/taste-skill` (v2 `--app` + `scenes`), `morluto/rea`, and `zhaoxuya520/reverse-skill`. |
| [`app/`](./app/) & [`tests/`](./tests/) | Existing verified Function Budget Studio 2.0 application baseline and deterministic test suite. |
| [`scripts/notify_telegram.py`](./scripts/notify_telegram.py) | Gated Telegram bot notifier (`@Hydrateh_bot`) strictly for key architectural decisions and major feature updates. |

---

## Development & Verification Commands

```powershell
# Run deterministic domain calculation tests
node --test tests/budget-domain.test.mjs

# Run linter
pnpm run lint

# Build production bundle and verify rendered output contract
pnpm run build
node --test tests/rendered-html.test.mjs
```
