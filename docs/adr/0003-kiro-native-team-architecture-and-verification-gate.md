# ADR 0003: Kiro-Native Team Architecture and Environment-Driven Verification Gate

- **Status**: Accepted
- **Decider**: SHUAI (`Chen Shuaizhou`)
- **Date**: 2026-10-21
- **Supersedes (in part)**: `AGENTS.md` Section 2 (Multi-Model Role Allocation) and Section 4 (Telegram Notification Policy), for execution inside the Kiro environment only.
- **Reaffirms**: ADR 0001 (Decision 1 Hybrid persistence) and ADR 0002 (graph-first + adaptive surfaces).

---

## 1. Context

`[Fact]` `AGENTS.md` prescribes a multi-model operating contract built on external tools: a Lead Architect model (the reference lead-architect model is now Claude's latest model, in place of the earlier Gemini reference), Claude CLI as Definitive Executor, parallel subagents for dual-gate review, and a Telegram bot `@Hydrateh_bot` (via `scripts/notify_telegram.py`) as a human decision gate.

`[Fact]` This work now runs inside the Kiro agent environment. The external models, their CLIs, and the Telegram bot are NOT available here. There is also no external network and no package registry access (`pnpm install` returns HTTP 403 from `registry.npmjs.org`).

`[Inference]` Executing the `AGENTS.md` contract verbatim is impossible in this environment. We must remap the ROLES to Kiro-native agents while preserving the DISCIPLINE the contract encodes.

---

## 2. Decisions

### Decision A: Remap the multi-model roles to Kiro-native agents

`[Fact]` The following mapping is adopted for all work executed inside Kiro:

| `AGENTS.md` role | Kiro-native equivalent | Responsibility |
| :--- | :--- | :--- |
| Claude (latest model) - Lead Architect & Orchestrator | **Orchestrator + Planner (lead architect)** | Strategy, spec, ticket decomposition, routing, final publish (push / PR). |
| Claude CLI - Definitive Executor | **`coder` subagent** | Vertical-slice TDD implementation, one ticket at a time, commits on a feature branch. |
| Parallel subagents - Parallel Dual-Gate Review | **`semantic-reviewer` subagent** | Behavioral + spec review of the diff; writes a review artifact with an explicit verdict. |

`[Inference]` This mapping keeps the two-tier "plan then execute then review" shape of `AGENTS.md` without depending on any unavailable external surface.

`[Fact]` Reference-model update (per SHUAI): the Lead Architect & Orchestrator role is now referenced against **Claude (latest model)** in place of the earlier Gemini reference. This is a reference-model change only; the Kiro-native **Orchestrator + Planner (lead architect)** still fills the role, and no decision in this ADR changes.

### Decision B: Preserve the operating discipline

`[Fact]` The following `AGENTS.md` disciplines remain mandatory and unchanged:

1. Address the user as **SHUAI**.
2. Tag consequential claims with epistemic markers: `[Fact]` / `[Inference]` / `[Assumption]` / `[Projection]` / `[Unknown]`.
3. Use controlled, direct language (~ASD-STE100) for engineering and decisions.
4. Never begin multi-step implementation without a ticket file in `.scratch/tickets/`.
5. Land **atomic, test-green vertical slices**; one coherent unit of work per commit.
6. Write / refresh `.scratch/HANDOFF-STATE.md` at every wave boundary and before any context reset.
7. Apply the **3-strike pivot rule**: after three failed attempts with the same approach, stop, record evidence, and re-plan rather than loop.

### Decision C: Environment-driven verification gate

`[Fact]` In this sandbox, `node_modules` is absent and dependencies cannot be installed, so `pnpm run lint`, `pnpm run build` (`vinext build`), and `tests/rendered-html.test.mjs` (which needs a prior build) CANNOT run.

`[Fact]` The only reliable, dependency-free gate is:

```
node --test tests/budget-domain.test.mjs
```

It currently passes **14/14** (the earlier `HANDOFF-STATE.md` claim of 16 was drift and is corrected). All domain logic lives in pure `.mjs` modules that run under raw `node --test` with no dependencies.

`[Fact]` Therefore the verification contract from `AGENTS.md` ("every slice leaves domain test + lint + build green") is adapted:

- **Mandatory green gate**: `node --test tests/budget-domain.test.mjs`. Any change to domain behavior must add deterministic tests here. The suite also contains source-string guards over `app/ellies-book-workbench.tsx` that enforce plain-language UI copy; those guards must stay green.
- **Best-effort only in this sandbox**: `pnpm run lint`, `pnpm run build`, and `tests/rendered-html.test.mjs`. They are reasoned about statically here and MUST be run in a build-capable environment or CI before the branch is pushed / merged.

#### Decision C addendum: cloud-CI verification tier

`[Fact]` A cloud-CI tier now exists: `.github/workflows/ci.yml` (GitHub Actions) runs `pnpm install --frozen-lockfile` -> lint -> the dependency-free domain gate (`node --test tests/budget-domain.test.mjs`) -> `pnpm run build` (vinext / Vite) -> the rendered-HTML contract (`tests/rendered-html.test.mjs`) on every pull request and push to `main`, plus a Playwright `visual-screenshots` job that captures 1440 / 768 / 390 px full-page screenshots as PR artifacts.

`[Inference]` With CI in place, the items previously marked "best-effort only in this sandbox" (lint, build, rendered-HTML, visual checks) are now ENFORCED on PRs to `main`. The sandbox limitation itself is unchanged: dependencies still cannot install locally, so the dependency-free domain gate remains the only LOCAL gate. Merges are now gated by CI.

`[Inference]` A build-capable local setup (Layer 2) is documented separately in `docs/DEVELOPMENT.md`, which lands with the CI branch (`chore/build-capable-ci-and-dev-env`); it is the companion to this cloud-CI tier.

### Decision D: Telegram notifier out of scope

`[Fact]` `@Hydrateh_bot` and `scripts/notify_telegram.py` require external network and a live bot, neither of which exists in this environment. Decision gates and milestones are recorded in `.scratch/HANDOFF-STATE.md` and ticket files instead of being pushed to Telegram. The Telegram policy in `AGENTS.md` Section 4 is suspended for Kiro-executed work.

---

## 3. Locked Product Decisions Reaffirmed (not a pivot)

`[Fact]` SHUAI reconfirmed the two foundational product decisions. They are consistent with ADR 0001 and ADR 0002 and are treated as settled, not reopened:

- **Decision 1 - Persistence**: HYBRID Local-First + Cloud D1/SQLite (per ADR 0001 Decision 1).
- **Decision 2 - Canvas interaction**: DUAL-MODE graph - a structured auto-layout financial DAG (`Project -> WorkPackage -> PurchaseItem -> SourcingAllocation -> Quotation/PO/Invoice`) PLUS a toggleable force/freeform Obsidian `[[wikilink]]` knowledge overlay (per ADR 0001 Decision 2 and ADR 0002).

---

## 4. Consequences

- **Positive**: Work can proceed inside Kiro with a clear, achievable gate and no dependency on unavailable external tooling. Discipline and auditability are preserved. A fresh session can resume from `.scratch/HANDOFF-STATE.md` with no lost state.
- **Trade-off**: `[Inference]` Because lint / build / rendered-HTML cannot run in the sandbox, there is residual risk that a TypeScript/JSX or build-time error ships undetected. `[Fact]` Mitigation: the orchestrator (or CI) MUST run `pnpm install && pnpm run lint && pnpm run build && node --test tests/rendered-html.test.mjs` on the feature branch before merging.
- **Scope note**: `[Fact]` The planner and coder never push or open PRs; the orchestrator publishes. All in-session work lands as commits on a feature branch off `main`, never on `main` directly.
