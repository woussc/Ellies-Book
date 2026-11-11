# Wave 13 (Part 2): Cloudflare D1 Multi-Tenant Schema, Idempotent Upsert/Pull Sync & Auth Boundary (`ROADMAP W4-T2` / `W8-candidate-C` Part 2)

- **Wave**: Wave 13
- **Status**: `proposed`
- **Blocked By**:
  - `W13-D1`: Done 10 Nov 2026 (migration executed clean in real SQLite: 16 tables, index present, `ws-local-default` default verified).
  - `W13-D2`: Done 10 Nov 2026 (gate 27/27; semantics verified in real SQLite).
  - `W13-D3`: Done 10 Nov 2026 (gate 28/28; no GET/restore call exists in the workbench, so none was invented).
  - `W13-D4` (`[DEFERRED / EXTERNAL INFRA]`): Blocked by missing Cloudflare account / D1 database UUIDs and sandbox network restrictions (`[Unknown]`).
- **Governing ADRs**: **ADR 0001 (Decision 1: Hybrid Local-First + Cloud Drizzle SQLite/D1 Persistence)**, **ADR 0002 (Coordinate Invariance — mandatory guard on every slice)**, ADR 0003 (Kiro-native team + verification gate).
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (**25/25** baseline + 1 new test per slice -> **28/28** after `D1..D3`).

> `[Context]` `ROADMAP.md` Wave 4 `W4-T2` ("Hybrid Persistence Layer: Local-First Vault + Drizzle D1 / SQLite Sync") and `W8-candidate-C` Part 2 require wiring `db/schema.ts` and `app/api/sync/route.ts` so Ellie's Book operates seamlessly as either a local-first application (zero-login instant device storage + Obsidian Markdown export/import) OR a cloud-synced workspace with multi-tenant isolation and authentication.

---

## Clear Frontier Boundary: What is Sequenced for Wave 13 vs. Deferred

### 1. Genuinely Sequenced in Wave 13 (`W13-D1` -> `W13-D2` -> `W13-D3`, In-Repo Testable)
1. **`W13-D1` — Multi-Tenant Workspace & Auth Schema in `db/schema.ts` + Migration SQL**:
   - Add `workspaces` and `workspaceMembers` (or `workspaceTokens`) tables to `db/schema.ts`, plus nullable-defaulted `workspaceId` (`default("ws-local-default")`) on `businessFunctions` and `projects` so single-user local-first mode remains 100% backwards-compatible while enabling strict tenant scoping in D1.
   - Generate deterministic SQLite/D1 DDL migration file (`db/migrations/0001_canonical_and_workspaces.sql`) verified by unit test in `tests/budget-domain.test.mjs`.
2. **`W13-D2` — Optional Workspace Auth & Upsert/Pull Sync Engine in `app/api/sync/route.ts`**:
   - Extract a pure request-context resolver in `app/api/sync/route.ts` supporting **anonymous local-first fallback** (when no auth header or `DB` binding is present) AND **authenticated workspace context** (via Bearer token / Cloudflare Access JWT header, per SHUAI Decision Gate 2).
   - Upgrade `POST /api/sync` from `.onConflictDoNothing()` (which silently drops edits to existing projects/items) to **tenant-scoped idempotent upserts** (`.onConflictDoUpdate()`) gated by `project.recordId` + `workspaceId`.
   - Upgrade `GET /api/sync?projectId=...` so that when `DB` is available and a workspace is authenticated, it hydrates and returns the saved project graph from D1 (falling back to `DEFAULT_SYNC_PROJECT` in local-only mode).
3. **`W13-D3` — Workbench Optional Workspace Credential & Cloud Pull/Push Wiring (`app/ellies-book-workbench.tsx`)**:
   - Wire optional workspace sync headers/status into the existing `.eb-sync-affordance` surface without forcing a login wall on local-first users and without changing any guarded plain-language strings (`"Saved on this device"`, `"Backing up to the cloud…"`, `"Saved here and backed up to the cloud"`).

### 2. Explicitly Deferred to Post-Wave-13 (`W13-D4` — External Infrastructure & Live Cloud Cutover)
- `[Unknown]` **Missing Evidence Blocking In-Sandbox Execution of `W13-D4`**:
  1. Neither `wrangler.jsonc` / `wrangler.toml` exists in the repository (`[Fact]`). (`.openai/hosting.json` exists and is referenced in `db/index.ts` line 8, but it is not a Wrangler binding.)
  2. Cloudflare `account_id`, D1 `database_id`, and production custom domain / Pages project names are not recorded in the repo (`[Unknown]`).
  3. The sandbox blocks external network access (`HTTP 403`), so `wrangler d1 create`, `wrangler d1 migrations apply --remote`, and OAuth callback testing cannot run here (`[Fact]`).
- Therefore, **`W13-D4` is scoped as an explicit external-cutover runbook ticket** that waits for SHUAI to provide the Cloudflare D1 binding identifiers and runs in CI / SHUAI's host terminal.

> `[Hard Guardrail — ADR 0002 Coordinate Invariance]`
> Every ticket in this file (`W13-D1`, `W13-D2`, `W13-D3`, `W13-D4`) MUST preserve **Coordinate Invariance (ADR 0002)**:
> - **Do NOT touch `app/budget-domain.mjs`** (`buildProjectGraphProjection`, `buildHybridSyncReceipt`, `computeLifecycleLineage`, `effectiveApprovedBudget`, `validateRequirementAllocations`).
> - Node `(x, y)` coordinates and `collapsed` flags remain pure view state; they must NEVER alter financial totals, canonical table rows, or the `receipt.checksum`.
> - Do NOT touch `worker/index.ts`, `vite.config.ts`, `vite.config.pages.ts`, `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, or `AGENTS.md` §2. Do NOT touch PR #4.

---

## Sequencing & File Ownership Map

| Slice | Objective | PRIMARY files it edits | Prerequisite |
| :-- | :-- | :-- | :-- |
| **W13-D1** | Multi-tenant workspace schema (`workspaces`, `workspaceMembers`, `workspaceId` scoping) + SQLite/D1 DDL migration | `db/schema.ts`, `db/migrations/0001_canonical_and_workspaces.sql`, `tests/budget-domain.test.mjs` | SHUAI Decision Gate 2 |
| **W13-D2** | Tenant-scoped auth resolver + idempotent `.onConflictDoUpdate()` POST + hydrated D1 GET in `/api/sync` | `app/api/sync/route.ts`, `tests/budget-domain.test.mjs` | `W13-D1` + SHUAI Decision Gates 2 & 3 |
| **W13-D3** | Optional workspace sync credential & pull/push header wiring in workbench (preserving zero-login local-first default) | `app/ellies-book-workbench.tsx`, `tests/budget-domain.test.mjs` | `W13-D2` |
| **W13-D4** (`[DEFERRED]`) | Live Cloudflare D1 provisioning (`wrangler.jsonc` binding + remote migration apply + E2E smoke test) | `wrangler.jsonc` (when authorized by SHUAI outside sandbox) | `W13-D1..D3` + `[Unknown]` Cloudflare account/D1 IDs from SHUAI |

---

## W13-D1 — Multi-Tenant Workspace Schema & Deterministic D1 Migration (`db/schema.ts`) `[done]` `[Gates 2 & 3 approved 10 Nov 2026]`

- **Objective**: Extend `db/schema.ts` with multi-tenant workspace and membership/token tables plus backwards-compatible `workspaceId` scoping on `businessFunctions` and `projects`, and commit a deterministic SQLite/D1 migration file.
- **Steps**:
  1. In `db/schema.ts`, keep all 14 existing `sqliteTable` exports intact (preserving test #10 in `tests/budget-domain.test.mjs` lines 340-366).
  2. Add two new Drizzle SQLite tables to `db/schema.ts`:
     - `workspaces = sqliteTable("workspaces", { workspaceId: text("workspace_id").primaryKey(), name: text("name").notNull(), slug: text("slug").notNull(), planTier: text("plan_tier").notNull().default("local-hybrid"), createdAt: text("created_at").notNull().default(sql\`CURRENT_TIMESTAMP\`) })`
     - `workspaceMembers = sqliteTable("workspace_members", { memberId: text("member_id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.workspaceId), actorEmail: text("actor_email").notNull(), role: text("role").notNull().default("editor"), tokenHash: text("token_hash").notNull().default(""), createdAt: text("created_at").notNull().default(sql\`CURRENT_TIMESTAMP\`) })`
  3. Add `workspaceId: text("workspace_id").notNull().default("ws-local-default")` to `businessFunctions` and `projects` in `db/schema.ts` so existing single-tenant calls work without breaking while multi-tenant queries filter by `workspaceId`.
  4. Author `db/migrations/0001_canonical_and_workspaces.sql` with `CREATE TABLE IF NOT EXISTS` statements matching all 16 tables in `db/schema.ts` plus an index on `projects(workspace_id, record_id)`.
  5. Add a unit test in `tests/budget-domain.test.mjs` asserting that `db/schema.ts` exports `workspaces` and `workspaceMembers`, defines `workspace_id` on `projects` and `businessFunctions`, and that `db/migrations/0001_canonical_and_workspaces.sql` contains matching `CREATE TABLE IF NOT EXISTS` DDL for all 16 tables.
- **HARD Guardrail (ADR 0002 Coordinate Invariance)**: Do NOT touch `app/budget-domain.mjs`. `CANONICAL_TABLE_NAMES` (the 11 domain export tables) and `buildHybridSyncReceipt` checksum calculation remain 100% unchanged.
- **Touches**: `db/schema.ts`, `db/migrations/0001_canonical_and_workspaces.sql`, `tests/budget-domain.test.mjs`.
- **Acceptance criteria**:
  - `node --test tests/budget-domain.test.mjs` passes **26/26**.
  - All 14 original canonical table exports in `db/schema.ts` plus `workspaces` and `workspaceMembers` are present and verified by test.
  - `app/budget-domain.mjs` has 0 lines changed.
- **Verification**: `node --test tests/budget-domain.test.mjs`.

---

## W13-D2 — Authenticated Workspace Context, Idempotent D1 Upsert (`POST`) & Tenant-Scoped Hydration (`GET`) in `app/api/sync/route.ts` `[done]` `[Gates 2 & 3 approved 10 Nov 2026]`

- `[Fact]` **Done 10 Nov 2026**: `resolveSyncContext` (Access email + Bearer + `X-Ellie-Workspace-Id`, local-anonymous fallback), 403 tenant guard, 409 `If-Match-Checksum` guard against the stored snapshot, 10 mutable tables on `onConflictDoUpdate`, `budgetVersions` + `auditEvents` kept append-only, fresh SYNC audit row per write with the payload checksum as `sourceRef`, GET hydrates from D1 by `workspaceId` + `projectId` with default fallback. Gate 27/27 green; TS parses clean; upsert/guard/append-only semantics verified against real SQLite.
- `[Correction to this ticket's step 2]` The draft step 2 listed `budgetVersions` among the tables to upsert. Gate 3 (approved) says the opposite — `budgetVersions` and `auditEvents` stay append-only/immutable — and that is what was implemented.
- `[Unknown / deferred to D4]` Bearer-token validation against `workspace_members.token_hash` needs a token-issuance flow to define the hash first; the resolver accepts the Bearer header as workspace context but does not validate it against D1. Likewise `REQUIRE_WORKSPACE_AUTH` is read defensively (`process` does not exist in the Workers runtime), so in production the enforcement point is edge Access policy, not this flag.

- **Objective**: Upgrade `app/api/sync/route.ts` so that:
  1. Unauthenticated / offline calls continue to succeed in `local-first-verified` mode (preserving ADR 0001 Decision 1 local-first guarantee and existing test #15 in `tests/budget-domain.test.mjs`);
  2. Authenticated calls resolve a `workspaceId` + `actor` from request headers (`Cf-Access-Authenticated-User-Email` / `Authorization: Bearer <token>` / `X-Ellie-Workspace-Id` per SHUAI Decision Gate 2) and forbid cross-workspace writes (`403` on tenant mismatch);
  3. `POST /api/sync` uses idempotent upserts (`.onConflictDoUpdate()`) instead of `.onConflictDoNothing()` so subsequent syncs update modified amounts, allocations, lifecycle lines, and notes in D1;
  4. `GET /api/sync` accepts `?workspaceId=...&projectId=...` and reads the persisted project rows from D1 when `db` is available, falling back to `DEFAULT_SYNC_PROJECT` when D1 is unavailable or empty.
- **Steps**:
  1. In `app/api/sync/route.ts`, add `resolveSyncContext(request?: Request)` that extracts `{ workspaceId, actor, authenticatedMode }` with a safe fallback to `{ workspaceId: "ws-local-default", actor: "Local Operator", authenticatedMode: "local-anonymous" }` when no auth headers are supplied (unless strict cloud auth enforcement is enabled via env `REQUIRE_WORKSPACE_AUTH === "true"`).
  2. In `POST(request: Request)`:
     - Ensure default `workspaces` row (`workspaceId`) is upserted first.
     - Replace `.onConflictDoNothing()` on `projects`, `workPackages`, `budgetVersions`, `purchaseItems`, `sourcingAllocations`, `lifecycleRecords`, `lifecycleLines`, `purchaseLinks`, `lifecycleTransitions`, and `knowledgeNotes` with `.onConflictDoUpdate({ target: ..., set: ... })` scoped to the resolved `workspaceId` / `projectRecordId`.
     - Append an `auditEvents` entry recording the `SYNC` action with the resolved `actor` and `receipt.checksum` as `sourceRef`.
     - Preserve the exact return shape `{ ...receipt, workspaceId, vaultFiles: Object.keys(vault) }` and status `200` / `422`.
  3. In `GET(request?: Request)`:
     - Keep `export async function GET(request?: Request)` signature compatible with zero-arg callers.
     - When `db` is available, query `projects` for the requested `workspaceId` / `projectId`; if found, reconstruct the payload from D1 tables before running `buildProjectGraphProjection` and `buildHybridSyncReceipt`. If `db` is unavailable or no rows exist yet, fall back to `DEFAULT_SYNC_PROJECT`.
  4. Add a deterministic test in `tests/budget-domain.test.mjs` verifying the `resolveSyncContext` contract, `.onConflictDoUpdate` presence across editable tables in `app/api/sync/route.ts`, `workspaceId` scoping, and Coordinate Invariance of the returned `receipt.checksum`.
- **HARD Guardrail (ADR 0002 Coordinate Invariance)**:
  - `app/api/sync/route.ts` MUST compute projections and receipts exclusively via `buildProjectGraphProjection(payload)` and `buildHybridSyncReceipt(payload, { d1Synced })` from `app/budget-domain.mjs`.
  - Node `(x, y)` coordinates and `collapsed` state are never stored in relational financial columns and never affect `receipt.checksum`.
- **Touches**: `app/api/sync/route.ts`, `tests/budget-domain.test.mjs`.
- **Acceptance criteria**:
  - `node --test tests/budget-domain.test.mjs` passes **27/27**.
  - Existing test #15 (`buildHybridSyncReceipt and /api/sync route normalize 11 canonical tables...`) stays 100% green without modification.
  - `app/budget-domain.mjs` is untouched.
- **Verification**: `node --test tests/budget-domain.test.mjs`.

---

## W13-D3 — Workbench Optional Workspace Sync Credential & Cloud Pull/Push Wiring (`app/ellies-book-workbench.tsx`) `[done]` `[W13-D2 done 10 Nov 2026]`

- `[Fact]` **Done 10 Nov 2026**: optional workspace id state (empty = this device only), persisted in `localStorage` under `ellies-book-workspace-sync-v1`, with a plain-language field beside the backup button; `triggerHybridSync` sends `X-Ellie-Workspace-Id` when set and `Authorization: Bearer …` only when a token is present in `sessionStorage`; all three guarded sync strings verbatim; no auth/dev jargon in the new visible copy. Gate 28/28 green.
- `[Fact]` **Scope note**: no GET/restore call exists in the workbench (the only `/api/sync` call is the POST in `triggerHybridSync`), so there was no restore path to wire — a restore UI is a future slice, not invented here. Likewise no UI sets the bearer token yet; token entry + issuance is a D4 follow-up.

- **Objective**: Connect the workbench's hybrid sync controls to the multi-tenant `/api/sync` contract while keeping local-first usage frictionless (zero login wall) and preserving all ADR 0008 dark-surface legibility rules and guarded plain-language strings.
- **Congress steps**: FRAME (Sync bar answers "is my work saved on this device or also backed up to our team workspace?"); GROUND (ADR 0001 Decision 1 + ADR 0008 Decision 5 dark data surface); CRAFT (impeccable quiet inline credential/workspace popover, zero glow); VERIFY (`node --test tests/budget-domain.test.mjs` + CI `inspect.mjs --app` with NO waivers).
- **Steps**:
  1. In `app/ellies-book-workbench.tsx`, add optional client view-state for `workspaceId` (default `""` / local device) persisted in `localStorage` under `ellies-book-workspace-sync-v1` (storing only non-sensitive workspace slug + optional header token in memory/sessionStorage).
  2. When triggering cloud backup (`POST /api/sync`) or cloud restore (`GET /api/sync`), pass `X-Ellie-Workspace-Id` (and `Authorization: Bearer ...` if configured by the user).
  3. Keep the three guarded plain-language sync affordance strings in `.eb-sync-affordance` **100% verbatim**:
     - `"Saved on this device"`
     - `"Backing up to the cloud…"`
     - `"Saved here and backed up to the cloud"`
  4. Do NOT introduce developer/auth jargon (`JWT`, `OAuth`, `D1`, `tenant`, `Bearer`, `checksum`) into visible UI copy (keep technical details in `title` tooltips only, per `tests/budget-domain.test.mjs` jargon guards).
  5. Add a test in `tests/budget-domain.test.mjs` verifying that `app/ellies-book-workbench.tsx` wires `X-Ellie-Workspace-Id` into `/api/sync` requests while keeping all plain-language sync and jargon guards green.
- **HARD Guardrail (ADR 0002 Coordinate Invariance)**: Syncing or switching workspace credentials must never mutate node `(x, y)` geometry or financial calculations in `app/budget-domain.mjs`.
- **Touches**: `app/ellies-book-workbench.tsx`, `tests/budget-domain.test.mjs`.
- **Acceptance criteria**:
  - `node --test tests/budget-domain.test.mjs` passes **28/28**.
  - Zero jargon-guard regressions; zero glow/gradient/shadow added to `.eb-sync-affordance` (ADR 0008 Decision 5).
- **Verification**: `node --test tests/budget-domain.test.mjs`; CI `inspect.mjs --app`.

---

## W13-D4 — Live Cloudflare D1 Binding, Remote Migration & Production Cutover (`[DEFERRED / EXTERNAL INFRA]`)

- **Status**: `deferred` — **Cannot be executed inside the offline sandbox.**
- `[Unknown]` **Missing Evidence Required from SHUAI Before Execution**:
  1. **Cloudflare Account & D1 Database Identity**: What are the target `account_id`, `database_name`, and `database_id` for the `DB` binding in `wrangler.jsonc` / Cloudflare Workers settings?
  2. **Production Domain & Cloudflare Access Policy**: If using Cloudflare Access (Option 2A), what is the Team Domain and Application Audience (`AUD`) tag?
  3. **Hard Boundary Release**: Creating `wrangler.jsonc` or editing `.github/workflows/ci.yml` / `pages.yml` requires SHUAI's explicit authorization outside the current planning boundary.
- **Steps (when unblocked in SHUAI's host environment / CI)**:
  1. Run `pnpm wrangler d1 create ellies-book-prod` and record the returned `database_id` in `wrangler.jsonc` under `d1_databases` with `binding = "DB"`.
  2. Apply `db/migrations/0001_canonical_and_workspaces.sql` locally (`pnpm wrangler d1 migrations apply ellies-book-prod --local`) and remotely (`--remote`).
  3. Deploy Worker (`pnpm run deploy`) and verify `GET /api/sync` returns `mode: "hybrid-d1-synced"` and `POST /api/sync` persists POSM USD 11,600 rows across all canonical tables in D1 with identical `checksum`.
