# ADR 0004: Cloud Deployment Target and Multi-Tenant Workspace Authentication

- **Status**: Proposed (awaiting SHUAI inputs — see §8)
- **Decider**: SHUAI (`Chen Shuaizhou`)
- **Date**: 2026-10-22
- **Scope**: W8-C deployment frontier (ROADMAP §4 `W4-T2` + ROADMAP §5 next step).
- **Reaffirms**: ADR 0001 (Decision 1 hybrid persistence), ADR 0002 (graph-first + Coordinate Invariance), ADR 0003 (Kiro-native team + verification gate).
- **Does not supersede**: any prior ADR. This ADR only adds the deployment and tenancy layer.

> This is a PLANNING ADR. It records the decision and the options. It does NOT
> implement auth, tenant scoping, or a live deployment. Implementation lands
> later as the atomic tickets in `.scratch/tickets/W8C-cloud-deployment.md`,
> gated on the SHUAI inputs in §8.

---

## 1. Context

`[Fact]` ADR 0001 Decision 1 locked a HYBRID Local-First + Cloud D1/SQLite
persistence model. Waves 1-7 realized the domain engine, the dual-mode graph,
the Obsidian vault round-trip, and the plain-language hybrid-sync affordance in
the UI. The cloud side of Decision 1 is wired but not yet deployed.

`[Fact]` The current cloud seam that already exists on `main` (SHA `0f9958e`):
- `db/schema.ts` — Drizzle `sqlite-core` schema, ~14 tables; 11 are the canonical
  projection tables (`Project`, `Work_Packages`, `Budget_Versions`,
  `Purchase_Items`, `Sourcing_Allocations`, `Lifecycle_Records`,
  `Lifecycle_Lines`, `Purchase_Links`, `Lifecycle_Transitions`,
  `Knowledge_Notes`, `Audit_Events`), plus `outcome_definitions` and
  `project_outcomes`. No table has a tenant / workspace column.
- `db/index.ts` — `getDb()` returns `drizzle(env.DB, { schema })` and throws when
  the `DB` binding is absent.
- `app/api/sync/route.ts` — `GET` and `POST /api/sync`. `POST` runs the pure
  domain projection, validates allocations, and (when `env.DB` is bound) inserts
  all canonical rows with `onConflictDoNothing()`. Both verbs return a
  deterministic hybrid-sync receipt (`buildHybridSyncReceipt`).
- `app/budget-domain.mjs` — the pure, dependency-free domain engine. The receipt
  carries `mode: "local-first-verified" | "cloud-d1-synced"`, `rowCounts`,
  `totalRows`, and a deterministic checksum `eb-v1-<hex16>` computed by
  `computeDeterministicChecksum` over the canonical payload.
- `worker/index.ts` — Cloudflare Worker entry; `Env` already declares
  `DB: D1Database`.
- `vite.config.ts` — uses `@cloudflare/vite-plugin`; `localBindingConfig` reads
  `d1` / `r2` binding names from `.openai/hosting.json` (currently
  `{ "d1": null, "r2": null }`), so no D1 binding is attached today.
- `drizzle.config.ts` — drizzle-kit, `dialect: "sqlite"`, `out: "./drizzle"`,
  `schema: "./db/schema.ts"`. `pnpm run db:generate` runs `drizzle-kit generate`.
  The `./drizzle` directory holds no generated SQL migrations yet.
- `package.json` — pins `wrangler@4.92.0` as a devDependency.
- `.github/workflows/ci.yml` — install + lint + domain gate + `vinext build` +
  rendered-HTML + Playwright at 1440 / 768 / 390 px. No deploy step.

`[Fact]` There is NO `wrangler.toml` in the repo. The Cloudflare plugin derives
its local config object from `vite.config.ts` for `pnpm run dev` (Miniflare
emulation), but a cloud deploy needs an explicit `wrangler.toml` with a real D1
`database_id`.

`[Fact]` The sandbox where this plan was authored cannot install dependencies,
build, or reach Cloudflare (HTTP 403 to the registry; no external network). So
this ADR cannot be validated against a live Cloudflare account here. The only
local gate is `node --test tests/budget-domain.test.mjs` (19/19 on `main`).

`[Inference]` To realize Decision 1 end-to-end, three things are missing: (1) a
deploy-ready Cloudflare config + generated migrations, (2) a tenant / workspace
boundary in the schema and the sync route, and (3) a minimal authentication path
that maps a signed-in user to a workspace. None of these should change the pure
domain engine or the existing receipt behavior.

---

## 2. Decision

### Decision A: Target platform — Cloudflare Workers + D1

`[Fact]` Adopt **Cloudflare Workers + D1 (SQLite)** as the cloud target.

`[Inference]` Rationale (grounded in the existing stack, not a new preference):
- The Worker entry (`worker/index.ts`), the Cloudflare Vite plugin, the pinned
  `wrangler` devDependency, and `getDb()` built on `drizzle-orm/d1` already point
  at Workers + D1. Any other target (e.g. Postgres on a container host) would
  discard working code and contradict ADR 0001's explicit "Cloudflare D1" wording.
- D1 is SQLite, which matches `drizzle.config.ts` (`dialect: "sqlite"`) and the
  local Miniflare emulation used by `pnpm run dev`, so local and cloud share one
  schema and one migration set.
- `[Projection]` For a solo / small-team product this keeps ops near zero: no
  server to manage, generous free tier, edge latency, and one `wrangler deploy`.

`[Assumption]` R2 (object storage) is NOT required for V1. The vault bundle is
generated deterministically from D1 rows + local state; large-blob attachments
are out of scope. `r2` stays `null` in `.openai/hosting.json` until a concrete
attachment feature needs it.

### Decision B: Hybrid model end-to-end (local-first ⇄ cloud D1 of record)

`[Fact]` Keep the existing two-layer model from ADR 0001:
- **Local-first layer**: browser storage (IndexedDB / localStorage) + the
  Obsidian vault export/import. The app MUST stay fully usable offline and
  unauthenticated against local state. This is non-negotiable (ADR 0001).
- **Cloud layer**: D1 is the cross-device **record of reference** for a signed-in
  workspace. `POST /api/sync` pushes the canonical projection into D1; `GET`
  reports the sync mode.

`[Fact]` **Conflict / merge stance for V1 = Last-Writer-Wins (LWW) + checksum
receipt.** The client pushes its canonical projection; the server upserts
(`onConflictDoNothing` today, moving to an explicit upsert keyed on primary key +
workspace in W8C-T2). The deterministic checksum `eb-v1-<hex16>` already returned
by `buildHybridSyncReceipt` is the integrity witness: identical canonical
payloads produce identical checksums, so client and server can confirm a push
round-tripped without a diff protocol.

`[Inference]` What the sync contract guarantees under this stance:
1. A push is **validated** before it touches D1 (allocations must satisfy
   `validateRequirementAllocations`; an invalid payload returns 422 and writes
   nothing).
2. A push is **deterministic**: the same project state always yields the same
   `rowCounts`, `totalRows`, and `checksum`.
3. A push is **idempotent at the row level** (upsert keyed on primary key within
   a workspace; re-pushing the same state is a no-op).
4. The receipt reports `mode: "cloud-d1-synced"` only when the D1 write actually
   succeeded; otherwise `mode: "local-first-verified"` and the app keeps working
   from local state.

`[Projection]` LWW is deliberately the simplest correct stance for a
single-editor-per-workspace V1. Field-level merge / CRDTs are explicitly a
future ADR, not V1 scope. The checksum receipt gives SHUAI a cheap "did my push
land intact" signal without that complexity.

### Decision C: Multi-tenant model

`[Fact]` A **workspace** is the tenant boundary. One workspace owns a set of
Projects and everything beneath them (work packages, purchase items, allocations,
lifecycle records, notes, audit events, outcomes).

`[Fact]` Isolation strategy for V1 = **shared D1 database with a mandatory
`workspace_id` scope column** on every tenant-owned table (pool model), NOT a
database-per-tenant. Rationale:
- D1 bills and provisions per database; a database-per-tenant model multiplies
  `wrangler` provisioning and migration work and does not fit a solo / small-team
  product.
- A single scope column plus a disciplined "every read and write filters by
  `workspace_id`" rule is the smallest change that gives real isolation and keeps
  one migration set.

`[Inference]` Schema shape (to be implemented in W8C-T2, not here):
- Add a `workspaces` table (`workspace_id` PK, `name`, `created_at`).
- Add a non-null `workspace_id` column (FK → `workspaces.workspace_id`) to each
  tenant-owned table. `business_functions` and every table under it carry it.
- All `/api/sync` reads and writes filter / stamp `workspace_id`. The pure domain
  projection does NOT learn about tenancy; scoping is applied at the route /
  persistence seam only, so the engine stays pure (see Decision D).

`[Fact]` **Minimum viable AUTH — options and recommendation:**

| Option | What it is | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **A. Cloudflare Access (Zero Trust)** `[Recommended for V1]` | Identity enforced at the edge in front of the Worker; the Worker reads a verified `Cf-Access-Jwt-Assertion` header. | No password/session code to own; MFA + SSO handled by Cloudflare; fastest path on the chosen platform; keeps secrets out of app code. | Requires a Cloudflare Zero Trust configuration (SHUAI-gated); a user ↔ workspace mapping table still needed in D1. |
| **B. Self-hosted session / token** | Worker issues a signed session cookie / JWT after a login route verifies a credential. | Full control; no external identity dependency; works on any host. | We own password hashing, session rotation, and token-secret handling — more code and more ways to get security wrong in a V1. |
| **C. Third-party auth provider** (e.g. an OAuth / hosted-auth service) | Delegate login to an external provider; map the provider identity to a workspace. | Mature flows; social login. | Adds an external dependency + its own secrets/billing; heavier than a solo product needs for V1. |

`[Inference]` **Recommendation: Option A (Cloudflare Access) for V1**, because it
is consistent with the Workers + D1 target, removes the riskiest code (credential
and session handling) from our surface, and is the lightest lift for a solo /
small-team product. The only app-side work is (1) a `users` ↔ `workspace`
membership table in D1 and (2) a server guard that resolves the verified Access
identity to a `workspace_id` and rejects requests with no membership.

`[Assumption]` Local-first use stays **unauthenticated**: when no cloud identity
is present, the app runs entirely on local state and `/api/sync` returns
`mode: "local-first-verified"`. Auth is required ONLY to read/write the cloud D1
of reference. This preserves ADR 0001's offline-first promise.

`[Unknown]` The final auth choice (A vs B vs C) is SHUAI's to confirm; it depends
on whether SHUAI wants a Cloudflare Zero Trust setup. Flagged in §8.

### Decision D: Invariants that MUST NOT change

`[Fact]` The deployment and tenancy work MUST preserve:
1. **ADR 0002 Coordinate Invariance** — node geometry and financial totals stay
   pure and view-independent. Tenancy is a persistence concern, not a geometry or
   total concern; `app/budget-domain.mjs` must not gain a `workspace_id`
   parameter in any total/geometry function.
2. **The dependency-free, unit-testable domain engine** — `app/budget-domain.mjs`
   stays pure and runnable under raw `node --test`. Tenant scoping lives at the
   route / DB seam (`app/api/sync/route.ts`, `db/`), never in the engine.
3. **The existing sync receipt / checksum behavior** — `eb-v1-<hex16>` must stay
   byte-stable for the same canonical payload. Tests that pin a known checksum
   must keep passing. Adding `workspace_id` to DB rows must NOT change the
   canonical payload the checksum is computed over (the checksum is over the
   domain projection, not over DB columns).

### Decision E: Secrets handling

`[Fact]` Rules for providing D1 IDs and auth secrets WITHOUT committing real
values:
- `wrangler.toml` is committed with a **placeholder** `database_id`
  (`<YOUR_D1_DATABASE_ID>`); the real value is supplied per environment, never in
  git. `.openai/hosting.json` stays `{ "d1": null, "r2": null }` in git and is set
  to the binding name (`DB`) only in the deploy environment.
- Deploy credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) and any
  auth secret live in **GitHub Actions secrets** (or the Cloudflare dashboard),
  referenced as `${{ secrets.* }}` in the deploy workflow. They are never echoed.
- **CI safety rule**: pipeline files MUST NOT dump the environment (`env`, `set`,
  `printenv`) or log secret values. The existing `ci.yml` already avoids this; the
  new `deploy.yml` (W8C-T4) must follow the same rule and run only on controlled
  triggers (merge to `main` / a release tag) via PR review, never on untrusted
  forks.
- `.gitignore` already excludes `.env*`, `/.wrangler/`, and `/dist/`; real local
  secrets go in an ignored `.env` and never in `wrangler.toml`.

An illustrative (template, do-not-commit-real-values) `wrangler.toml`:

```toml
# TEMPLATE — placeholders only. Replace <...> in a real environment.
name = "ellies-book"
main = "./worker/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"                       # matches worker Env.DB and getDb()
database_name = "ellies-book-d1"
database_id = "<YOUR_D1_DATABASE_ID>"  # SHUAI-provided; never a real id in git
```

---

## 3. Options considered and rejected

- `[Inference]` **Database-per-tenant on D1** — rejected for V1: multiplies
  provisioning and migrations; disproportionate for solo / small-team scale. May
  be revisited if a single large tenant needs hard isolation.
- `[Inference]` **Cloud-only (no local-first)** — rejected: contradicts ADR 0001
  Decision 1 and the Wave 7 local-first affordance.
- `[Inference]` **CRDT / field-level merge for V1** — deferred: unneeded for a
  single-editor-per-workspace V1; LWW + checksum is sufficient and far simpler.
- `[Inference]` **Non-Cloudflare host (container + Postgres)** — rejected:
  discards the working Worker/D1/Drizzle seam and contradicts ADR 0001.

---

## 4. Consequences

- **Positive**: Realizes ADR 0001 Decision 1 end-to-end with the smallest schema
  and code change; keeps one migration set; keeps the domain engine pure; keeps
  local-first offline use intact; keeps secrets out of git.
- **Trade-off**: `[Inference]` LWW can silently overwrite a concurrent edit from a
  second device in the same workspace. Accepted for V1 (single editor per
  workspace assumed); the checksum receipt makes a clobbered push detectable.
- **Trade-off**: `[Inference]` A shared-DB scope column means every query MUST
  filter by `workspace_id`; a missed filter is a cross-tenant leak. Mitigation: a
  single scoping helper at the DB seam + deterministic isolation tests (W8C-T2).
- **Dependency**: `[Fact]` Nothing deploys until SHUAI provides a Cloudflare
  account, a created D1 database (real `database_id`), and the auth choice (§8).

---

## 5. Verification

`[Fact]` Every W8C ticket keeps `node --test tests/budget-domain.test.mjs` green
(19/19 baseline) and relies on CI (`ci.yml`) for lint / build / rendered-HTML /
visual, per ADR 0003. Tenant-isolation logic (W8C-T2) adds NEW deterministic
tests proving a workspace cannot read another workspace's rows, written as pure
functions so they run under the dependency-free gate.

---

## 6. Relationship to tickets

`[Fact]` This ADR is decomposed into atomic tracer-bullet slices in
`.scratch/tickets/W8C-cloud-deployment.md` (W8C-T1 … W8C-T5). Each slice is
independently shippable and leaves the domain gate green.

---

## 7. Status

`[Fact]` **Proposed.** The architecture is settled enough to decompose into
tickets, but implementation is blocked on the SHUAI inputs in §8. No production
code changes land with this ADR.

---

## 8. SHUAI-gated external inputs required before implementation

`[Fact]` These CANNOT be produced in the sandbox and MUST be supplied by SHUAI
before W8-C implementation begins. They must NOT be faked or guessed:

1. **Cloudflare account access** — an account the deploy can target, plus a scoped
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` stored as GitHub Actions
   secrets (not in git).
2. **A created D1 database** — run `wrangler d1 create ellies-book-d1` in the real
   account and provide the resulting `database_id` for `wrangler.toml` (kept out of
   git via placeholder + environment injection).
3. **Auth provider decision** — confirm Option A (Cloudflare Access, recommended),
   Option B (self-hosted session/token), or Option C (third-party provider). The
   W8C-T3 shape depends on this choice.
4. `[Assumption to confirm]` R2 not needed for V1 (keep `r2: null`). Confirm or
   correct.

`[Projection]` Once 1-3 are provided, W8C-T1 → W8C-T5 can proceed in order, each
as an atomic, domain-gate-green slice through the coder subagent.
