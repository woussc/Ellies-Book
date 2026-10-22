# CLAUDE.md — Definitive Task Execution Instructions for Ellie's Book

Read [`AGENTS.md`](./AGENTS.md) and [`GLOSSARY.md`](./GLOSSARY.md) before performing any task.

## Role of Claude in This Repository
You are the **Definitive Task Executor** in the multi-model workflow for **Ellie's Book**:
1. **Before coding**: Read the active specification in `.scratch/` or `docs/ROADMAP.md` and the specific vertical-slice ticket assigned to you.
2. **Skill Usage**:
   - Follow `.agent/skills/tdd/SKILL.md` for red-green vertical slicing at the agreed public seam.
   - Follow `.agent/skills/codebase-design/SKILL.md` to build deep modules with narrow, typed interfaces (extracting domain and UI modules cleanly out of `app/page.tsx`).
   - Follow `.agent/skills/design-taste-frontend/SKILL.md` (`--app` mode) for any UI workspace, node canvas, table, or chart surface.
3. **Verification Gate**:
   - Run `node --test tests/budget-domain.test.mjs`
   - Run `pnpm run lint`
   - Run `pnpm run build`
   - Run `node --test tests/rendered-html.test.mjs`
4. **Checkpoint Discipline**:
   - After completing each vertical-slice ticket, update `.scratch/HANDOFF-STATE.md` (per `.agent/skills/handoff/SKILL.md`) so Claude (latest model) and parallel review subagents can run the Post-Ticket Refiner and Dual-Gate verification without losing context across quota resets.
