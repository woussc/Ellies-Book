# AGENTS.md — Ellie's Book Multi-Model & Multi-Agent Operating Contract

> **Owner & Collaborator**: **SHUAI** (`Chen Shuaizhou`)
> **Repository**: `woussc/Ellies-Book`
> **Canonical Glossary**: [`GLOSSARY.md`](./GLOSSARY.md)
> **Master Roadmap**: [`docs/ROADMAP.md`](./docs/ROADMAP.md)
> **Foundational Contracts**: [`docs/foundation/PROJECT-BRIEF.md`](./docs/foundation/PROJECT-BRIEF.md), [`docs/foundation/CODEX-HANDOFF-V2.md`](./docs/foundation/CODEX-HANDOFF-V2.md), [`docs/foundation/GRAPH-PURCHASE-LIST-CONTRACT.md`](./docs/foundation/GRAPH-PURCHASE-LIST-CONTRACT.md)

---

## 1. Epistemic & Communication Baseline (Mandatory for All Agents)

1. **Always address the user as SHUAI.**
2. **Epistemic Classification**: Explicitly distinguish and tag consequential claims:
   - `[Fact]` — Verified directly from code, tests, git state, or authoritative documentation.
   - `[Inference]` — Logically derived from established facts.
   - `[Assumption]` — Treated as true for planning; must be verified before irreversible execution.
   - `[Projection]` — Forward-looking scenario or estimate.
   - `[Unknown]` — Insufficient evidence; must inspect or ask rather than guess.
3. **Controlled Language (70–80% ASD-STE100)**:
   - Use short, direct sentences, active voice, and stable domain terms from [`GLOSSARY.md`](./GLOSSARY.md).
   - Relax only during divergent UI/product brainstorming; return immediately to controlled language for engineering, verification, and decisions.

---

## 2. Multi-Model Role Allocation & Token Reset Discipline

To maximize token utilization across SHUAI's plans while maintaining strict architectural coherence and zero lost work across quota resets:

| Model Tier / Agent Surface | Primary Responsibility | Mandatory Handoff / Checkpoint Artifact |
| :--- | :--- | :--- |
| **Claude (latest model)** *(Lead Architect & Orchestrator)* | 1. Product & Architecture Strategy (`/wayfinder`, `/grill-with-docs`, `/to-spec`, `/to-tickets`)<br>2. Multi-Agent Frontier Dispatch & Post-Ticket Refiner Loop<br>3. Reference Software Deconstruction (`reverse-engineer-anything`, `js-reverse`)<br>4. Cross-Model Alignment & Final Spec/Visual Gate Verification | Updates `GLOSSARY.md`, `docs/adr/`, `.scratch/<epic>/SPEC.md`, and `.scratch/<epic>/tickets/` before and after every wave. See ADR 0003 (`docs/adr/`) for the Kiro-native role mapping and verification gate. |
| **Claude (Opus / Sonnet / Claude Code)** *(Definitive Task Executor)* | 1. Definitive vertical-slice implementation (`/implement`, `/tdd`)<br>2. Deep module extraction & TypeScript/Drizzle schema engineering (`/codebase-design`)<br>3. Deterministic financial engine & state-machine implementation<br>4. Complex component refactoring (splitting `app/page.tsx` into deep modules) | Commits atomic, test-passing vertical slices on feature/ticket branches and writes `.scratch/checkpoints/checkpoint-<ticket-id>.md`. |
| **Gemini Pro / Flash Subagents** *(Parallel Specialists)* | 1. Parallel Dual-Gate Code Review (`Standards` + `Spec` subagents via `/code-review`)<br>2. Real-browser visual inspection (`taste-skill/scripts/inspect.mjs` at 1440px, 768px, 390px)<br>3. High-volume codebase/web research (`/research`) | Writes structured review and inspection evidence into `.scratch/reviews/`. |

### Quota Reset & Checkpoint Rules
1. **Never start a multi-step implementation without a ticket file in `.scratch/tickets/`**.
2. **Atomic Slice Commits**: Every tracer-bullet ticket must leave `node --test tests/budget-domain.test.mjs`, `pnpm run lint`, and `pnpm run build` green before committing.
3. **Pre-Reset Checkpoint**: Whenever a session approaches token/context limits or completes a ticket wave, run the `/handoff` skill to write `.scratch/HANDOFF-STATE.md` recording:
   - Current git commit SHA and branch;
   - Completed vs. in-progress ticket IDs;
   - Verified `[Fact]` test results;
   - Next unblocked frontier ticket(s).
4. **3-Strike Pivot Rule (from PentAGI)**: If any agent fails to resolve a build, test, or layout failure after 3 attempts using the same approach, it must stop, record the failure evidence, and escalate to the Lead Architect (`Argon High`) to re-plan rather than burning tokens in a loop.

---

## 3. Integrated Skill Routing Table (`.agent/skills/`)

All agents operating in this repository must use the vendored skills in `.agent/skills/`:

### A. Planning, Architecture & TDD (`mattpocock/skills`)
- **Design-Tree Grilling & Ubiquitous Language**: `.agent/skills/grill-with-docs/SKILL.md` + `.agent/skills/grilling/SKILL.md` + `.agent/skills/domain-modeling/SKILL.md`
- **Multi-Session Roadmap & Decision Graph**: `.agent/skills/wayfinder/SKILL.md`
- **Specification Authoring**: `.agent/skills/to-spec/SKILL.md`
- **Tracer-Bullet Vertical Slice Decomposition**: `.agent/skills/to-tickets/SKILL.md`
- **Deep Module Design (Ousterhout Principles)**: `.agent/skills/codebase-design/SKILL.md` + `.agent/skills/improve-codebase-architecture/SKILL.md`
- **Vertical-Slice Red-Green TDD**: `.agent/skills/tdd/SKILL.md` + `.agent/skills/implement/SKILL.md` + `.agent/skills/implement-spec/SKILL.md`
- **Rapid Throwaway UI/Logic Prototypes**: `.agent/skills/prototype/SKILL.md`
- **Parallel Standards + Spec Code Review**: `.agent/skills/code-review/SKILL.md`
- **Session Compaction & Cross-Model Handoff**: `.agent/skills/handoff/SKILL.md`

### B. UI/UX Art Direction & Anti-Slop Verification (`Leonxlnx/taste-skill` v2)
- **App Workspace & Dashboard Art Direction (`--app` mode)**: `.agent/skills/design-taste-frontend/SKILL.md` + `.agent/skills/design-taste-frontend/references/app-screens.md`
- **Public Product / Marketing & Scroll Scenes**: `.agent/skills/design-taste-frontend/references/scenes.md` + `.agent/skills/gpt-tasteskill/SKILL.md`
- **High-Craft Editorial / Minimalist / Brutalist Systems**: `.agent/skills/soft-skill/SKILL.md`, `.agent/skills/minimalist-skill/SKILL.md`, `.agent/skills/brutalist-skill/SKILL.md`, `.agent/skills/stitch-skill/SKILL.md`
- **Visual Asset & Mockup Generation**: `.agent/skills/brandkit/SKILL.md`, `.agent/skills/imagegen-frontend-web/SKILL.md`, `.agent/skills/imagegen-frontend-mobile/SKILL.md`, `.agent/skills/image-to-code-skill/SKILL.md`

### C. Competitor & Reference Software Reverse Engineering (`morluto/rea` + `zhaoxuya520/reverse-skill`)
- **Evidence-Backed Application & Browser Deconstruction**: `.agent/skills/reverse-engineer-anything/SKILL.md`
- **Web Bundle, Canvas/Graph & State Machine Recovery**: `.agent/skills/js-reverse/SKILL.md` + `.agent/skills/competition-bundle-sourcemap-recovery/SKILL.md`
- **Evidence Ledger & Hash Verification Gate**: `.agent/skills/case-review/SKILL.md`

### D. Unified UI/UX Congress Workflow (`taste-skill` + `ui-ux-pro-max` + `impeccable`)
- **Single Entry Point (open FIRST for any UI/UX task)**: `.agent/skills/uiux-congress/SKILL.md` — the congress router that sequences the three member skills below into one craft workflow.
- **Member — Art Direction & Anti-Slop Gate (owns PASS/FAIL)**: `.agent/skills/design-taste-frontend/SKILL.md` — art direction plus the `inspect.mjs --app` verification gate; the taste-skill holds the PASS/FAIL authority (see subsection B for its full routing).
- **Member — Design-Intelligence Library**: `.agent/skills/ui-ux-pro-max/SKILL.md` — styles / 192 palettes / font pairings / 119 UX guidelines / charts / 22 stacks, plus design-system token architecture.
- **Member — Craft → Critique → Polish → Harden Loop**: `.agent/skills/impeccable/SKILL.md` — the craft-floor Operate-mode loop that iterates a surface from craft through critique, polish, and hardening.
- **Binding Precedence**: see [`docs/adr/0007-uiux-congress-design-workflow.md`](./docs/adr/0007-uiux-congress-design-workflow.md). ADR 0006's quiet app-screen `--eb-*` visual system remains binding; the congress is workflow / library only (no re-skin).

---

## 4. Telegram Bot Notification Policy (`@Hydrateh_bot`)

> [!IMPORTANT]
> **Strict Low-Noise Policy**: Do **NOT** send routine commits, minor refactoring logs, or intermediate step outputs to Telegram.

Push notifications to SHUAI's Telegram bot (`@Hydrateh_bot`, via `python scripts/notify_telegram.py`) **ONLY** under two conditions:
1. **Key Decision Gate (`--type decision`)**: An architectural, product-scope, or UX trade-off blocks the frontier and requires SHUAI's explicit choice between clearly framed options.
2. **Major Feature Milestone (`--type milestone`)**: A complete vertical slice or milestone wave has passed all deterministic tests, build checks, and browser inspections, and has been pushed to `woussc/Ellies-Book`.
