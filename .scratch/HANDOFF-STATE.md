# Context Checkpoint & Handoff State — Ellie's Book

| Field | Status |
| :--- | :--- |
| **Objective** | Establish the `Ellies-Book` repository from the verified `Business Function Budget Tracker` v2.0 + `GRAPH-PURCHASE-LIST-CONTRACT.md` baseline, vendor the 5 external skill suites, and align the multi-model roadmap (`Argon High` + `Claude` + specialist subagents). |
| **Established Facts** | 1. Audited `portal-prototype` (Function Budget Studio 2.0, commit `df422fd`) and `source-recovery/portal-prototype-v12/GRAPH-PURCHASE-LIST-CONTRACT.md`.<br>2. Vendored 44 agent skills into `.agent/skills/` (`mattpocock/skills`, `Leonxlnx/taste-skill` v2 with `--app` & `scenes`, `morluto/rea`, `zhaoxuya520/reverse-skill`, and preserved full local `imagegen`/`brandkit` skills).<br>3. Authored `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`, and `docs/ROADMAP.md`. |
| **Active Assumptions** | 1. `Ellies-Book` repository is hosted privately under `woussc/Ellies-Book` on GitHub.<br>2. Original vault folder `d:\MyVault\MyVault-Open\01_project\Business Function Budget Tracker` remains untouched as read-only provenance. |
| **Open Issues / Decisions Needed** | **Decision Gate 1**: Persistence architecture (Hybrid Local-First + Cloud D1/SQLite vs. Cloud-Only vs. Desktop Vault-First).<br>**Decision Gate 2**: Graph Canvas interaction mode (Structured DAG + Obsidian Overlay vs. Freeform Infinite Canvas).<br>**Decision Gate 3**: Local Claude CLI installation/invocation setup on this Windows workstation. |
| **Next Step** | Receive SHUAI's selection on the 3 Decision Gates, then execute **Wave 1 (`W1-T1` Deep Module Extraction & `W1-T2` Graph V1 Relational Entities)**. |
