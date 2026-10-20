# Ticket W4-T1 & W4-T2: Hybrid Local-First + Drizzle D1/SQLite Sync API & Obsidian Markdown Vault Bundle Engine

- **Wave**: Wave 4 (Hybrid Persistence, Obsidian Vault Import/Export & Cloud Sync API)
- **Status**: `completed`
- **Blocked By**: `W1-domain-and-schema.md`, `W2-dual-mode-graph-and-obsidian-ui.md`

---

## 1. Objective

Implement the **Hybrid Local-First + Cloud Drizzle SQLite/D1 Persistence** and **Obsidian Vault Bidirectional Sync** defined in **ADR 0001** (`docs/adr/0001-hybrid-architecture-and-dual-graph.md`):

1. **Obsidian Markdown Vault Serializer & Parser (`app/budget-domain.mjs`)**:
   - `serializeProjectToObsidianVault(projectData)`: Deterministically generates a virtual folder of interlinked Obsidian Markdown files (`.md`) with YAML frontmatter, `[[wikilinks]]`, `#tags`, and embedded canonical tables:
     - `00_Project_Overview.md` (Project metadata, financial headroom summary, links to all Work Packages, Purchase Items, Lifecycle Documents, and Knowledge Notes)
     - `WorkPackages/<wp_id>.md`
     - `PurchaseItems/<spending_line_id>.md` (with Operational, Managerial, and Accounting views + GL code `"001230"` + allocations table)
     - `Documents/<document_id>.md` (Quotation / PO / Invoice / Actual lineage)
     - `Notes/<note_id>.md` (User Markdown notes with `[[wikilinks]]`)
   - `parseObsidianVaultBundle(vaultFiles)`: Reconstructs `KnowledgeNote` records and frontmatter metadata from a set of Markdown files while preserving backlink integrity.
2. **Cloudflare D1 / Drizzle Sync API Endpoint (`app/api/sync/route.ts`)**:
   - Provides `GET /api/sync` and `POST /api/sync` endpoints that normalize a project's 11 canonical tables (`buildProjectGraphProjection(payload).tables`), validate allocations (`validateRequirementAllocations`), and persist/retrieve state via Drizzle D1 (`getDb()`) when `env.DB` is bound, or return a verified deterministic sync receipt (`mode: "local-first-verified" | "cloud-d1-synced"`, `checksum`, `rowCounts`, `timestamp`) when running in local-first mode.
3. **Interactive Hybrid Sync & Obsidian Vault Controls in `ElliesBookWorkbench` (`app/ellies-book-workbench.tsx`)**:
   - Add a **Vault & Cloud Sync** drawer/panel inside `ElliesBookWorkbench` allowing SHUAI to:
     - Inspect every generated Obsidian `.md` file (`00_Project_Overview.md`, `PurchaseItems/*.md`, `Notes/*.md`) with YAML frontmatter and `[[wikilinks]]`;
     - Download or copy the full Obsidian Vault Markdown bundle;
     - Trigger a 1-click **Hybrid Sync Snapshot** (persisting to local storage + `/api/sync` validation receipt with row counts across all 11 canonical tables).

---

## 2. Public Seam & Verification Tests

- Extend `tests/budget-domain.test.mjs` with red-green unit tests verifying:
  1. `serializeProjectToObsidianVault` generates valid YAML frontmatter, preserves `"001230"` GL codes, and creates `[[wikilink]]` edges across `00_Project_Overview.md`, `PurchaseItems/`, `Documents/`, and `Notes/`.
  2. `parseObsidianVaultBundle` round-trips Markdown notes and frontmatter without data loss.
  3. `/api/sync` route contract and `ElliesBookWorkbench` Vault & Sync controls pass all source/SSR guards.
