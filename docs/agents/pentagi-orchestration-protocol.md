# PentAGI Multi-Agent Orchestration Protocol for Ellie's Book

Derived from [`vxcontrol/pentagi`](https://github.com/vxcontrol/pentagi) (`backend/pkg/templates/prompts/*.tmpl`) and integrated with Matt Pocock's `implement-spec` / `to-tickets` workflow.

---

## 1. Three-Tier Execution Hierarchy (`Flow -> Wave -> Vertical-Slice Ticket`)

1. **Generator Phase (`Argon High` + `/to-tickets`)**:
   - Decomposes each product specification into a bounded backlog of tracer-bullet vertical-slice tickets (maximum 15 tickets per wave).
   - Every ticket specifies:
     - Public seam to test;
     - Input/output data contract (`GLOSSARY.md` entities);
     - Explicit `Blocked by` dependencies;
     - Verification commands (`node --test`, `pnpm run build`, `inspect.mjs`).
2. **Primary Orchestrator (`Argon High`)**:
   - Dispatches unblocked frontier tickets to specialist agents (**Claude** for definitive coding/refactoring; **Gemini Pro/Flash** subagents for parallel research, code review, and browser inspection).
   - Passes **compact context pointers** (file paths, ADR links, Evidence IDs) + structured delegation payloads rather than dumping raw chat history.
3. **Post-Ticket Refiner (`Refiner Agent` Loop)**:
   - Runs **immediately after every completed ticket**.
   - Compares actual implementation outcomes against the wave objective to prune obsolete tickets, split newly discovered edge cases, or update `.scratch/HANDOFF-STATE.md`.
4. **Reflector & Schema Gate (`Reflector Agent` Pattern)**:
   - Any agent output that omits required epistemic tags (`[Fact]`, `[Inference]`, `[Assumption]`, `[Unknown]`), skips seam tests, or breaks spreadsheet/GL-code invariants (`"001230"`, zero double-counting) is rejected before merge.

---

## 2. Hard Operational Guardrails

- **3-Strike Pivot Rule**: Limit repeated attempts to **3 maximum** for any single implementation or debugging approach. If an approach fails 3 times, the subagent must halt, write a diagnostic note to `.scratch/HANDOFF-STATE.md`, and escalate to the Lead Architect (`Argon High`).
- **Evidence Ledger Traceability (`morluto/rea` + `reverse-skill`)**: Whenever reverse-engineering reference software (e.g., Notion table views, Obsidian graph physics, Linear keyboard navigation), store concrete observations in `docs/evidence/` with stable Evidence IDs (`E-001`, `E-002`) before translating them into implementation tickets.
