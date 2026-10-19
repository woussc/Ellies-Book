---
type: project-handoff
project: Function Based Budget Tracker
product-name: Function Budget Studio
status: active-prototype
owner: Chen Shuaizhou
handoff-date: 2026-08-17
current-prototype-version: "2.0"
current-source-commit: df422fd38392b3f5e60053e530af6ef746b45137
---

# Codex Handoff — Business Function Budget Tracker

## 1. Purpose of this handoff

This document gives a Codex agent on another device enough verified context to continue the Business Function Budget Tracker without replaying the original chats or reinterpreting settled product decisions.

Evidence language used here:

- **Confirmed** means established in the project brief, current source, Git history, or completed prototype verification.
- **Proposed** means discussed as a possible next step but not yet part of the product contract.
- **Unknown** means the next agent must inspect or ask before acting.

Do not convert a proposed idea into a confirmed requirement without Chen Shuaizhou's approval.

## 2. First actions on the new device

1. Open the vault at `D:\MyVault\MyVault-Open`.
2. Read the repository operating contract: `D:\MyVault\MyVault-Open\AGENTS.md`.
3. Read the project-folder guide: `D:\MyVault\MyVault-Open\.codex\vault-guides\01_project.md`.
4. Read this handoff and then the authoritative brief: `Business Function Budget Tracker Project Brief.md`.
5. Treat `portal-prototype` as a nested, independent Git repository. Check its Git status before changing anything.
6. Inspect the current commit and working tree before installing, editing, committing, pulling, or publishing.

Recommended PowerShell orientation commands:

```powershell
Set-Location 'D:\MyVault\MyVault-Open\01_project\Business Function Budget Tracker\portal-prototype'
git status --short --branch
git log -5 --oneline
git remote -v
git rev-parse HEAD
```

Expected source baseline at handoff:

```text
Branch: main, tracking origin/main
Commit: df422fd38392b3f5e60053e530af6ef746b45137
Subject: Build project-led budgeting workflow
```

If the new device shows a different commit, do not assume either copy is authoritative. Compare the branch, remote, commit history, deployment version, and uncommitted work first.

## 3. Problem and product purpose

The original business problem came from Visual Merchandising but the intended product is company-wide.

Business functions describe spending through operational language, purpose, timing, projects, items, services, vendors, and outcomes. Finance records the same transactions through a smaller controlled accounting structure. One physical item can legitimately receive different Finance treatment depending on its purpose, timing, transaction context, or lifecycle. When only the Finance code survives, the company loses the operational meaning needed for later analysis, price comparison, forecasting, and knowledge transfer.

The product is therefore a controlled translation and decision-support layer between business intent and official Finance reporting. It is not a replacement ledger. Finance remains the system of record.

The tool should document money:

- already spent;
- expected or committed to be spent; and
- available or authorized to be spent;

while preserving accounting, managerial, and operational perspectives on the same underlying records.

## 4. Confirmed product decisions

### 4.1 User-facing structure

Use these three primary work views:

1. **Planning & Budgeting** — what funding is proposed or approved and what the function plans to do with it.
2. **Spend & Commitments** — quotations, purchase orders, invoices, commitments, and actual expenditure linked to their business context.
3. **Monitor & Decide** — budget, commitment, actual, forecast, headroom, sourcing, outcome, and governance views over the same data.

The current prototype also uses Profile and Function Library surfaces to support the three work views.

### 4.2 Financial control semantics

- Budget authorization states are only `Proposed` and `Approved`.
- `Original` and `Adjustment` are version properties, not approval states.
- A proposed adjustment must not increase effective approved funding until it is approved.
- Commitments converted into actuals must not be counted twice.
- Finance codes and mappings must be preserved, including leading zeros.
- Finance mapping depends on transaction context. An item-level Finance code is precedent or suggestion, not universal truth.
- Ambiguous or changed mappings require human review.

Core calculations:

```text
current available-to-commit = approved budget - actuals - open commitments
forecast spend = actuals + open commitments + proposed cost
projected headroom = approved budget - forecast spend
```

### 4.3 Context and data model

- Capture business context during planning or requisition, not only after the invoice arrives.
- Preserve one shared governed data model rather than three disconnected sheets or ledgers.
- Keep accounting, managerial, and operational classifications as separate linked dimensions.
- Use stable internal IDs and retain original source wording and snapshots.
- Preserve historical links when a reusable definition is renamed, merged, retained as project-only, or retired.
- Project-created terminology does not automatically become company terminology.
- Human curation is required to promote, merge, retire, or confirm Finance mappings.

### 4.4 Project-led library growth

The operating model is:

> Minimum controlled metadata + optional mature-team starter library + project-led item and outcome creation + sourcing-level detail + later human curation.

Confirmed implications:

- A team can begin planning without first building complete spending-item and outcome catalogues.
- Mature teams may apply reusable starter definitions.
- New terms can be created inside a project as `Project-only` definitions.
- Project-only terms create curation candidates; they are not automatically promoted.
- Reusable/project-only and lifecycle values are metadata states, not budget states.
- Deterministic assistance is labelled `Suggested match` or `Recommendation`, not represented as live AI.

### 4.5 Work packages, requirements, and sourcing

- Every project starts with a `General` work package, which may be renamed or supplemented.
- A spending requirement can be split across multiple vendors, warehouses, countries, or sourcing methods.
- Partial allocations may be saved, but unallocated quantity must be prominently flagged.
- If a requirement has allocations, only allocation totals count; the parent requirement must not be counted again.

```text
Without allocations:
requirement total = requirement quantity x requirement unit price

With allocations:
requirement total = sum(allocation quantity x allocation unit price
                        + allocation additional estimated cost)
```

- Freight, duty, and tax are not a detailed calculation engine in this prototype. Capture price basis and an optional additional-cost estimate.
- Planning imports enter a staging review. Unconfirmed rows must not affect the budget.
- Quotation, PO, and invoice lines may link to an individual sourcing allocation.

Relationship model:

```text
Project
  -> Work package
    -> Spending requirement
      -> Sourcing allocation
        -> Quotation / PO / invoice line
```

### 4.6 Outcomes and economic-return evidence

- Each function may maintain its own outcome/evidence terminology and precision.
- Show expected contribution, evidence source, evidence strength, owner, baseline, target, and measurement window where relevant.
- Keep financial control and outcome evidence separate.
- Do not calculate a universal composite ROI score.
- Do not claim causal impact without adequate evidence.

### 4.7 AI boundary

The future product may use AI to extract invoice or planning information, suggest matches, identify duplicates, and prepare reviewable data. AI must provide source traceability and confidence/reasoning and must not silently approve budgets, promote terms, merge records, or confirm Finance treatment.

The current prototype does **not** use live AI.

## 5. Current implemented prototype — confirmed

The current source and deployed prototype are **Function Budget Studio 2.0**.

Source:

```text
Repository: portal-prototype
Branch: main
Commit: df422fd38392b3f5e60053e530af6ef746b45137
Schema version: 2
```

Private deployment:

- URL: https://function-budget-studio.chenshuaizhou832501.chatgpt.site
- Sites project ID: `appgprj_6a7800bf43108191b82c9c96ce74b9a9`
- Saved version ID: `appgprj_6a7800bf43108191b82c9c96ce74b9a9~appgver_6ff4f93c0c088191b1d6cc7f2abc6108`
- Deployment ID: `appgdep_6a800bd232e08191b20adbc1eee3c3c2`
- Access boundary at publication: private/owner-only.

Implemented in 2.0:

- project-led planning without mandatory catalogues;
- optional controlled function presets;
- default and custom work packages;
- reusable and project-only definitions;
- definition lifecycle and curation inbox;
- sourcing allocations with quantity reconciliation;
- planning-import staging and human confirmation;
- historical aliases and original source wording;
- allocation-linked document lines;
- budget, sourcing, and governance review panels;
- rules-based recommendations and Finance-review metadata;
- saved-data normalization from earlier records;
- device-local working/training data isolation;
- normalized Markdown, TSV, and CSV exports with leading-zero preservation and spreadsheet-formula neutralization.

The synthetic POSM scenario contains:

```text
Project: MKT-003 / FY27 Launch Campaign
Requirement: Paper table-top stand, A4, 350 gsm
Required quantity: 1,200 units

China vendor:       600 x USD 10 + USD 500 = USD 6,500
Vietnam vendor:     400 x USD 11 + USD 300 = USD 4,700
European warehouse: 200 x USD  2           = USD   400
Total:                                      USD 11,600
Unallocated quantity: 0
```

This scenario is the primary deterministic reference for allocation calculations and cross-function review.

## 6. Current technical architecture

The prototype is intentionally bounded:

- single-route responsive web application;
- React 19 and Vinext/Vite toolchain;
- client-side data and browser local storage;
- pure budget-domain helpers in `app/budget-domain.mjs`;
- main application interface and most state management in `app/page.tsx`;
- generated static/worker output for private Sites hosting;
- no production database or server-side business workflow.

Important files:

```text
Business Function Budget Tracker Project Brief.md  Domain and scope source of truth
Codex Handoff - Business Function Budget Tracker.md This operational handoff
portal-prototype/.openai/hosting.json                Existing Sites identity
portal-prototype/app/page.tsx                       Main application and interface
portal-prototype/app/budget-domain.mjs              Pure domain calculations/matching
portal-prototype/app/globals.css                    Responsive visual system
portal-prototype/tests/budget-domain.test.mjs       Domain tests
portal-prototype/tests/rendered-html.test.mjs       Built-output contract tests
portal-prototype/package.json                       Commands and dependencies
portal-prototype/pnpm-lock.yaml                     Preferred dependency lock
```

`README.md` is still largely a generic Vinext starter and is not authoritative for product semantics.

## 7. Set up and verify on another device

Requirements:

- Windows PowerShell or an equivalent shell;
- Git access to the existing nested repository;
- Node.js `>=22.13.0`;
- pnpm compatible with `pnpm-lock.yaml`;
- Codex signed into an account authorized to access the existing private Sites project if deployment work is needed.

Do not copy short-lived repository credentials or deployment tokens from another device. Generate fresh authorized credentials through Sites when publishing.

Dependencies and generated folders were deliberately removed from the current local project to reduce the folder from roughly 403 MB to roughly 1.6 MB. They are reproducible and must not be treated as source.

Setup and verification:

```powershell
Set-Location 'D:\MyVault\MyVault-Open\01_project\Business Function Budget Tracker\portal-prototype'

node --version
pnpm --version
pnpm install --frozen-lockfile

node --test tests/budget-domain.test.mjs
pnpm run lint
pnpm run build
node --test tests/rendered-html.test.mjs
git diff --check
git status --short --branch
```

If `pnpm install --frozen-lockfile` fails, inspect the Node/pnpm version and lockfile mismatch before using a command that rewrites either lockfile. Do not silently normalize or delete `pnpm-lock.yaml` or `package-lock.json`.

`pnpm run test` builds the project and runs the rendered-output test. It does not currently include `tests/budget-domain.test.mjs`, so run the domain test separately.

For browser verification, perform one bounded pass:

1. Start working mode with an empty catalogue and confirm project planning is available after core profile setup.
2. Create an unsaved project draft and confirm it is not added to shared data before saving.
3. Confirm the draft contains a `General` work package and first save is `Original / Proposed`.
4. Trigger and recover from one validation error.
5. Open the isolated POSM training scenario and verify USD 11,600 and zero unallocated quantity.
6. Check Spend & Commitments allocation links.
7. Check Monitor & Decide budget, sourcing, and governance panels.
8. Check a 390 px viewport for page-level horizontal overflow.
9. Reconcile UI totals with Markdown/TSV/CSV output and preserve Finance code `001230`.

Fix only failures against the confirmed contract, then recheck the failed cases once.

## 8. Publishing contract

This project contains `.openai/hosting.json`, so use the installed Sites building and hosting workflows for any deployment task.

- Read and reuse the existing `project_id`; never create a replacement site for this prototype.
- Push the exact verified source commit before saving a Sites version.
- Package and save that exact commit, then deploy the saved version privately.
- Confirm the final deployment reaches a successful terminal state.
- Open the production URL for one final render/error check.
- Remove temporary package archives after successful publication.
- Do not include `node_modules`, `dist`, `.vinext`, `.next`, `.wrangler`, preview logs, secrets, or temporary archives in commits.
- Preserve private/owner-only access unless Chen Shuaizhou explicitly changes the access requirement.

## 9. Pre-existing working-tree state at handoff

At the source device on 2026-08-17, the nested repository had these uncommitted changes after commit `df422fd`:

```text
M README.md
D dev.stderr.log
D dev.stdout.log
```

These changes pre-dated this handoff and were deliberately excluded from the 2.0 product commit. Do not discard, restore, include, or commit them automatically. Inspect ownership and intent first. A fresh clone may not reproduce this dirty state.

The following large generated directories were absent by design after cleanup:

```text
node_modules
dist
.vinext
.next
.wrangler
```

Regenerate them locally when needed; do not transfer them between devices.

## 10. Known limitations and open risks

### Confirmed limitations

- Synthetic, device-local demonstrator only.
- No authentication or production authorization workflow.
- No server persistence or multi-user collaboration.
- No real AI, OCR, invoice extraction, or document ingestion.
- No ERP/SAP or Finance-ledger integration.
- No live FX feed or detailed freight/duty/tax engine.
- No automatic Finance approval, term promotion, or record merging.
- Uploaded PDF/image processing is not implemented; references require manual confirmation.
- Current state logic is concentrated in a large `app/page.tsx`, which will become a maintenance risk if the prototype expands without modularization.

### Documentation/state issues to resolve deliberately

- The project brief frontmatter says priority `medium`, while its body says `High`. This is a metadata conflict, not permission to choose one silently.
- The project brief and log may not yet describe every 2.0 implementation detail. Update them only as an explicit bounded documentation task.
- The generic README does not reflect the current product and is already modified in the source-device worktree.
- Both pnpm and npm lockfiles exist. pnpm is the working convention, but lockfile consolidation has not been approved.

## 11. Proposed ideas not yet approved for implementation

The following were discussed after 2.0 as a possible later change plan. They are **not** current requirements:

- metadata-coded visible project IDs with governed code priority;
- immutable generated-ID snapshots and function-wide sequences;
- a controlled team-member roster and multi-owner projects;
- versioned static FX assumptions and converted reporting-currency snapshots;
- inline editing of one project card at a time;
- expanded field-level revision history and mandatory adjustment comments;
- multi-line financial documents spanning projects and spending lines;
- quarter-phased approved budgets and a formal YTG calculation;
- separate utilization and allocation bars.

These ideas require a new user decision before execution and should be checked against the project brief, current schema migration risk, and the prototype's bounded purpose.

## 12. Recommended continuation order

1. Re-establish the verified 2.0 baseline on the new device and run the deterministic and browser checks.
2. Confirm the live Sites version still corresponds to `df422fd` before any new deployment.
3. Reconcile the brief's stale sections and priority conflict as a separate documentation decision.
4. Ask which proposed product batch, if any, is now authorized.
5. For implementation, preserve IDs, saved-data normalization, exports, allocation arithmetic, Finance-code formatting, and human-review boundaries.
6. Build, run deterministic checks, perform one bounded browser smoke pass, fix contract failures, recheck once, and stop.

Do not begin production architecture, database design, ERP integration, or live AI ingestion merely because those are long-term ambitions. Each materially expands the current scope and requires an explicit decision.

## 13. Definition of a safe handoff completion

The new agent is ready to continue when it can state, with evidence:

- which vault and nested repository it is operating in;
- the current branch, commit, remote, and working-tree state;
- the difference between Finance authority and business-context classification;
- the difference between budget state, version property, definition scope, and definition lifecycle;
- the current prototype's technical and AI boundaries;
- the deployed Sites project/version it intends to preserve;
- which requested change is confirmed versus merely proposed;
- which tests and browser checks will prove the change did not break the control model.

## 14. Provenance

Prepared on 2026-08-17 from:

- the current project brief;
- current nested-repository source and Git state;
- the completed prototype build/publish task history;
- confirmed product decisions from the Business Function Budget Tracker discussions;
- the verified Function Budget Studio 2.0 deployment record.

No credentials, private tokens, dependency folders, build output, or temporary deployment archives are included in this handoff.
