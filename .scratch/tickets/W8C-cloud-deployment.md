# Wave 8-C: Cloud Deployment & Multi-Tenant Workspace Authentication

- **Wave**: Wave 8-C (deployment frontier) — realizes ADR 0001 Decision 1 end-to-end.
- **Status**: `proposed` / `not-started`
- **Governing ADRs**: ADR 0004 (cloud deployment + multi-tenant auth), ADR 0001 (hybrid persistence), ADR 0002 (graph-first + Coordinate Invariance), ADR 0003 (Kiro-native team + gate).
- **Mandatory gate for every ticket**: `node --test tests/budget-domain.test.mjs` stays green (baseline **19/19** on `main` HEAD `0f9958e`). lint / build / rendered-HTML / visual are CI-only in this sandbox (ADR 0003, enforced by `.github/workflows/ci.yml`).
- **Blocked by (external, SHUAI-gated)**: Cloudflare account + scoped API token/account id; a created D1 database (real `database_id`); the auth-provider decision. See ADR 0004 §8. **No W8C implementation starts until these land.**

> `[Context]` This backlog decomposes ADR 0004 into atomic, independently
> shippable, test-green vertical slices (tracer bullets). Each slice names its
> objective, scope (files), verification, and acceptance criteria. Tickets are
> ordered by dependency. Where a ticket needs SHUAI input, it is tagged
> `[Decision for SHUAI]` and must NOT be implemented until the input is provided.

---

## Dependency order

`[Inference]` `W8C-T1` (config + migrations) → `W8C-T2` (tenant scoping) →
`W8C-T3` (auth) → `W8C-T4` (deploy workflow) → `W8C-T5` (docs). T1 is the only
slice that MAY land scaffolding before the auth decision, because it changes no
runtime behavior. T2 is independent of the auth choice. T3 and T4 depend on the
SHUAI inputs in ADR 0004 §8.

---

## W8C-T1 — Wrangler config + migrations wiring `[proposed]` `[partially SHUAI-gated]`

- **Objective**: Make the project deploy-ready as config only, with NO runtime
  behavior change. Add a committed `wrangler.toml` (placeholder `database_id`),
  generate the Drizzle migration SQL into `./drizzle`, and confirm the `DB`
  binding name lines up across `wrangler.toml`, `worker/index.ts` (`Env.DB`),
  `db/index.ts` (`getDb()` → `env.DB`), and `.openai/hosting.json`.
- **Scope (files)**:
  - NEW `wrangler.toml` at repo root — `name`, `main = "./worker/index.ts"`,
    `compatibility_flags = ["nodejs_compat"]`, a `[[d1_databases]]` block with
    `binding = "DB"`, `database_name = "ellies-book-d1"`, and
    `database_id = "<YOUR_D1_DATABASE_ID>"` (placeholder — NEVER a real id).
  - `./drizzle/` — generated SQL migration(s) from `pnpm run db:generate`
    (`drizzle-kit generate` against `db/schema.ts`). Currently empty of SQL.
  - DO NOT change `.openai/hosting.json` in git (stays `{ "d1": null, "r2": null }`);
    document that the deploy environment sets `d1: "DB"`.
  - DO NOT modify `vite.config.ts`, `worker/index.ts`, `db/index.ts`,
    `db/schema.ts`, or `app/api/sync/route.ts` (read-only alignment check).
- **Test / verification**:
  - `node --test tests/budget-domain.test.mjs` green (config-only change does not
    touch the domain gate; still 19/19).
  - CI: `pnpm run build` must still pass (the new `wrangler.toml` must not break
    the Cloudflare Vite plugin). Rendered-HTML + visual jobs unchanged.
  - Static check: binding name `DB` matches in all four places listed above.
- **Acceptance criteria**:
  1. `wrangler.toml` exists, is statically valid, and contains only placeholder
     ids (no real `database_id`, no secrets).
  2. `./drizzle` contains generated migration SQL for the current schema that
     `drizzle-kit` can apply to a fresh D1.
  3. Domain gate 19/19; CI build stays green.
  4. No runtime behavior change: `/api/sync` and the UI behave exactly as before.
- **SHUAI gate**: `[Decision for SHUAI]` — the real `database_id` is NOT part of
  this ticket (placeholder only). The scaffolding MAY land before SHUAI provides
  the real id; applying migrations to a live D1 happens in W8C-T4.

---

## W8C-T2 — Tenant / workspace scoping in schema + sync route `[proposed]`

- **Objective**: Introduce the workspace tenant boundary. Add a `workspaces`
  table and a non-null `workspace_id` scope column to every tenant-owned table;
  scope all `/api/sync` reads and writes by `workspace_id`; prove isolation with
  NEW deterministic tests. Keep the domain engine pure (scoping lives at the
  route / DB seam only).
- **Scope (files)**:
  - `db/schema.ts` — add `workspaces` table; add `workspaceId`
    (`text("workspace_id").notNull().references(...)`) to each tenant-owned table
    (`business_functions`, `projects`, `work_packages`, `budget_versions`,
    `purchase_items`, `sourcing_allocations`, `lifecycle_records`,
    `lifecycle_lines`, `purchase_links`, `lifecycle_transitions`,
    `knowledge_notes`, `audit_events`, `outcome_definitions`,
    `project_outcomes`).
  - `app/api/sync/route.ts` — resolve a `workspace_id` (from the auth context in
    T3; until then from an explicit request field / default for local-first),
    stamp it on every insert, and filter every read by it. Move
    `onConflictDoNothing()` to an explicit upsert keyed on `(primary key,
    workspace_id)` so re-push is idempotent within a workspace (LWW per ADR 0004
    Decision B).
  - NEW migration via `pnpm run db:generate` into `./drizzle`.
  - A NEW pure scoping helper module (e.g. `app/tenant-scope.mjs`) holding the
    deterministic workspace-filter logic so it is unit-testable under raw
    `node --test`.
  - `tests/budget-domain.test.mjs` (or a new pure-module test file wired into the
    gate) — NEW deterministic tests.
  - DO NOT add `workspace_id` to any function in `app/budget-domain.mjs` that
    computes totals or node geometry (ADR 0002 Coordinate Invariance; ADR 0004
    Decision D).
- **Test / verification**:
  - NEW tests prove: (a) rows stamped with workspace A are NOT returned when
    scoping by workspace B; (b) the same project state yields the same
    `rowCounts` / `totalRows` / `checksum` regardless of `workspace_id` (the
    checksum is over the domain projection, not DB columns — must stay
    byte-stable); (c) an upsert re-push within one workspace is a no-op.
  - `node --test tests/budget-domain.test.mjs` green with the new tests (count
    goes up from 19).
  - CI build + rendered-HTML stay green.
- **Acceptance criteria**:
  1. Every tenant-owned table has a non-null `workspace_id` FK.
  2. `/api/sync` stamps and filters `workspace_id` on all reads/writes.
  3. Deterministic isolation tests pass and would fail if the scope filter were
     removed.
  4. The existing checksum behavior is unchanged (a pinned-checksum assertion
     stays green).
  5. `app/budget-domain.mjs` total/geometry functions are untouched.

---

## W8C-T3 — Minimal auth / session: login → workspace `[proposed]` `[Decision for SHUAI]`

- **Objective**: Add the minimum viable authentication so a signed-in identity
  resolves to a `workspace_id`, protect the cloud sync routes, and keep
  local-first use working **unauthenticated**.
- **Scope (files)** (exact shape depends on the ADR 0004 §8 auth choice):
  - `db/schema.ts` — NEW `users` table and a `workspace_members` mapping
    (`user_id` ↔ `workspace_id`, role). NEW migration into `./drizzle`.
  - `app/api/sync/route.ts` — a server guard that resolves the verified identity
    to a `workspace_id` and returns 401 when a cloud operation has no membership;
    unauthenticated requests fall back to `mode: "local-first-verified"` and
    local state (no 401 for local-first).
  - If **Option A (Cloudflare Access, recommended)**: read and verify the
    `Cf-Access-Jwt-Assertion` header in the Worker; map the Access identity to a
    `workspace_members` row. No password/session code owned by us.
  - If **Option B (self-hosted session/token)**: NEW login route +
    signed-session issuance + session verification; secret from env, never git.
  - If **Option C (provider)**: provider callback route + identity mapping.
  - NEW pure, dependency-free unit tests for the identity→workspace resolution
    logic (keep it in a pure helper so it runs under the domain gate).
- **Test / verification**:
  - Pure resolver tests: a known identity maps to the expected `workspace_id`; an
    unknown identity is rejected; a local-first (no-identity) request is allowed
    and returns `local-first-verified`.
  - `node --test tests/budget-domain.test.mjs` green; CI build/lint green.
  - CI (manual/integration, build-capable env): a signed-in request reads/writes
    only its workspace; an unauthenticated request still works offline.
- **Acceptance criteria**:
  1. A cloud `/api/sync` write requires a resolved workspace membership.
  2. Local-first use works with no auth and no regression to the Wave 7 sync
     affordance.
  3. No secret is committed; any token secret comes from env / Actions secrets.
  4. Identity→workspace resolution is covered by deterministic tests.
- **SHUAI gate**: `[Decision for SHUAI]` — **blocked until SHUAI confirms the auth
  option (A/B/C) in ADR 0004 §8.** Do NOT implement before the decision.

---

## W8C-T4 — Deploy workflow (`.github/workflows/deploy.yml`) `[proposed]` `[Decision for SHUAI]`

- **Objective**: Add a GitHub Actions workflow that deploys the Worker + applies
  D1 migrations via `wrangler`, gated behind the existing CI build passing, with
  secrets from GitHub Actions secrets and NO env dumping.
- **Scope (files)**:
  - NEW `.github/workflows/deploy.yml`:
    - Triggers on push to `main` (and/or a release tag) only; never on fork PRs.
    - `needs:` the `build-and-test` job (or runs the same gate) so deploy only
      runs when lint + domain gate + build + rendered-HTML pass.
    - Steps: checkout → setup pnpm/Node 22 → `pnpm install --frozen-lockfile` →
      `pnpm run build` → `wrangler d1 migrations apply ellies-book-d1 --remote` →
      `wrangler deploy`.
    - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` from
      `${{ secrets.* }}`. The real D1 `database_id` injected via environment, not
      committed.
    - MUST NOT echo env / run `printenv` / log secret values (ADR 0004 Decision E).
  - DO NOT modify `.github/workflows/ci.yml`.
- **Test / verification**:
  - YAML lints / parses; `node --test tests/budget-domain.test.mjs` unaffected
    (19/19 or current).
  - A dry-run / first real deploy against the SHUAI-provided account confirms the
    Worker serves and D1 migrations apply (build-capable env only; cannot run in
    sandbox).
- **Acceptance criteria**:
  1. `deploy.yml` runs only after CI passes and only on controlled triggers.
  2. No secret or env dump appears in workflow logs.
  3. Deploy applies migrations then publishes the Worker.
- **SHUAI gate**: `[Decision for SHUAI]` — **blocked on Cloudflare account + token
  + account id + real `database_id`** (ADR 0004 §8). The workflow file MAY be
  authored with placeholders, but it cannot be exercised until secrets exist.

---

## W8C-T5 — Deployment docs (local → cloud story) `[proposed]`

- **Objective**: Document the end-to-end local-first → cloud deployment path so a
  new operator can take Ellie's Book from `pnpm run dev` to a live Cloudflare
  deployment.
- **Scope (files)**:
  - NEW `docs/DEPLOYMENT.md` — the full story: create the D1 database, set
    `wrangler.toml` `database_id` / the deploy environment, store the Cloudflare
    secrets in GitHub Actions, run migrations, deploy, and the workspace / auth
    setup (per the chosen option). Explicit "never commit real secrets / ids".
  - UPDATE `docs/DEVELOPMENT.md` §4 — add a pointer to `docs/DEPLOYMENT.md` for the
    cloud path; keep the local-only / no-account story intact.
  - Cross-link ADR 0004.
- **Test / verification**:
  - Docs-only; `node --test tests/budget-domain.test.mjs` unaffected.
  - A human follows `docs/DEPLOYMENT.md` end-to-end in a build-capable env and
    reaches a live deployment (validation step, not sandbox-runnable).
- **Acceptance criteria**:
  1. `docs/DEPLOYMENT.md` covers D1 creation, secrets, migrations, deploy, and
     workspace/auth setup, with placeholders for all ids/secrets.
  2. `docs/DEVELOPMENT.md` links to it without breaking the local-only guidance.

---

## Sequencing & SHUAI-input summary

`[Inference]` Shippable without the auth decision: **W8C-T1** (config scaffolding,
placeholders only) and **W8C-T2** (tenant scoping + isolation tests — pure logic,
no auth needed). These leave the domain gate green and change no live deployment.

`[Fact]` Blocked until SHUAI provides the ADR 0004 §8 inputs:
- **W8C-T3** — needs the **auth-provider decision** (A/B/C).
- **W8C-T4** — needs the **Cloudflare account + API token + account id + real D1
  `database_id`**.
- **W8C-T5** — can be drafted anytime but is only verifiable end-to-end once T3/T4
  land.

`[Reminder]` No real secrets, account ids, or D1 database ids go into git at any
point. Use placeholders (`<YOUR_D1_DATABASE_ID>`, `${{ secrets.* }}`).
