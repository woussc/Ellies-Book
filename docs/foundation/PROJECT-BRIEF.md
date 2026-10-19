---
project: Function Based Budget Tracker
type: project
status: planning
priority: medium
start: 2026-08-04
deadline:
completed:
owner: Chen Shuaizhou
stakeholders: []
domain:
  - Finance
tags:
  - project
---


> **One-line brief:** 
> *An AI-assisted financial control and decision-support tool that connects business intent and domain-specific spending data to official accounting records, enabling traceable planning, expenditure analysis, and evidence-based evaluation of economic return.*

**Owner:** Chen Shuaizhou
**Start:** 2026-08-04  
**Deadline:**   
**Status:** Planning  
**Priority:** High

---

## 01 | Goal & Success

**Project Goal**

Design and validate a company-wide, AI-assisted financial control and decision-support application that records the full lifecycle of in-scope expenditure: proposed and approved budget, original and adjusted budget versions, forecast spend, commitments, actual expenditure, available balance, and realised business outcomes.

The application will use three primary views over one shared data model:

- **Planning & Budgeting:** projects, campaigns, initiatives, and operational cost pools; their proposed or approved budgets, assumptions, expected outcomes, owners, and controller approvals.
- **Spend & Commitments:** proposed purchases, quotations, purchase orders, receipts, invoices, Finance postings, and other commitments or expenditure, linked at line level to the relevant plan.
- **Monitor & Decide:** budget-versus-commitment-versus-actual-versus-forecast performance, available and projected headroom, exceptions, risks, reallocations, and outcome progress.

Each spend line should preserve three connected views:

- **Accounting view:** how the transaction is officially classified, posted, and reconciled by Finance.
- **Managerial view:** why the money is being allocated, the expected economic or operational return, the accountable owner, and the decision assumptions.
- **Operational view:** what was purchased, for which initiative or beneficiary, in what quantity, at what price, and under which domain-specific terminology.

The application should use AI agents to extract structured data from invoices, purchase orders, quotations, and related documents; recommend classifications and mappings; detect missing or inconsistent information; and route exceptions for human review. AI output must remain traceable to the source document and must not replace accountable human approval for accounting treatment, budget allocation, or investment decisions.

The resulting governed dataset should reduce administrative reporting effort and support future tracking, forecasting, cross-functional resource allocation, and analysis of how financial resources contribute to business outcomes. Business context should be captured at initiative planning or requisition, then inherited by the PO and invoice; users should not be required to reconstruct the original purpose after the invoice arrives.

The application should contribute a management view of company financial health without claiming to replace statutory accounts, cash-flow analysis, or the official Finance system of record. A budget that is fully spent is not automatically a successful investment; financial control and outcome performance must remain visible as separate dimensions.

**Prototype interpretation**

The first implementation is a private, single-route prototype called **Function Budget Studio**. It demonstrates the information architecture, data relationships, calculations, workflow controls, and export shape using synthetic client-side data. It is deliberately not a production Finance ledger: it does not yet provide real document uploads or extraction, live AI agents, ERP/Finance integration, server persistence, authentication, or multi-user collaboration. Those remain production-stage capabilities subject to separate security, integration, governance, and operating-model decisions.

**Success Metrics**

> Targets below are provisional and should be confirmed after establishing the current baseline and selecting a pilot function.

| Metric | Initial Target | Measurement Method |
|--------|----------------|-------------------|
| Spend-lifecycle coverage | 100% of in-scope pilot expenditure is represented through the applicable proposed/approved budget, forecast, commitment, actual, and available-balance states | Reconcile the initiative register, budget versions, open commitments, and Finance actuals |
| Finance reconciliation | >=99% of imported actual expenditure reconciles to the official Finance source total | Compare reporting-period totals and investigate all differences |
| Multi-axis classification | >=95% of material spend lines contain valid accounting, managerial, and operational classifications | Run required-field and controlled-taxonomy validation |
| Mapping quality | <=5% of spend value remains in unresolved or miscellaneous categories at reporting close | Review the exception queue by count, value, age, and owner |
| AI document extraction | >=95% validated accuracy for required fields on the agreed pilot document set | Compare extracted fields with a human-reviewed sample by document type |
| Commitment visibility | >=90% of approved purchase commitments are recorded before the related invoice is posted | Compare commitment creation dates with invoice posting dates |
| Decision-case coverage | 100% of material budget proposals above the agreed threshold include business intent, operational drivers, outcome hypothesis, assumptions, accountable owner, and measurement window | Review budget-gate completeness before approval |
| Scenario readiness | 100% of material proposals include a base case and a documented downside or release condition where demand is uncertain | Review approved budget scenarios and decision gates |
| Outcome closure | >=90% of material initiatives complete an outcome review within the agreed measurement window | Compare completed outcome reviews with the closed-initiative register |
| Reporting efficiency | Reduce preparation time for budget-versus-forecast-versus-commitment-versus-actual reporting by >=50% | Compare baseline and post-pilot preparation time |
| Traceability | 100% of classification overrides, forecast changes, budget reallocations, and approvals retain an owner, timestamp, reason, and source reference | Review the audit log |
| Forecast reliability | Forecast error is measured consistently and improves across comparable reporting cycles | Compare forecast versions with final actual expenditure and operational drivers |
| Pilot adoption | >=80% of designated users complete required updates by the reporting deadline | Review user activity and reporting-completion records |
| Prototype contract coverage | 100% of agreed prototype acceptance checks pass before each published version | Run production build, deterministic calculation/export checks, and bounded desktop/mobile browser smoke tests |

**Out of Scope**

- Replacing the company's ERP, procurement platform, or official Finance system of record.
- Changing the corporate chart of accounts solely to support individual business-function terminology.
- Autonomously approving accounting treatment, budgets, payments, invoices, or purchase orders.
- Acting as a statutory accounting, tax, treasury, or financial-consolidation system.
- Producing a complete view of company financial health without the necessary revenue, margin, cash-flow, balance-sheet, and operational outcome data.
- Claiming causal economic return where the evidence supports only correlation, contribution, risk reduction, or a qualitative strategic outcome.
- Forcing every business function into a direct-revenue ROI model when its value is better represented through service, compliance, capability, risk, or operational measures.
- Automatically ranking all initiatives by a single ROI score before the outcome library and evidence standards have been validated.
- Production-grade document upload, OCR/extraction, live AI classification, ERP/Finance integration, server-side persistence, authentication, and multi-user collaboration in the prototype phase.
- Treating the private synthetic prototype as evidence that the production operating model, security model, or accounting integration is complete.
- Providing unrestricted user-defined categories that cannot be mapped to a governed reporting structure.
- Launching across the entire company before the model has been tested and validated through a limited pilot.
- Historical data migration beyond the period required to test reporting, mapping, and reconciliation.

---

## 02 | Assumptions & Constraints

**Assumptions**

- [ ] Finance remains the official system of record; this application operates as a controlled planning, classification, reconciliation, and analytical layer.
- [ ] The three primary views will read and write to one governed data model rather than maintaining separate page-specific ledgers.
- [ ] The prototype can use synthetic, device-local data to validate the user workflow and data relationships before production persistence and integrations are approved.
- [ ] Source documents and Finance extracts provide sufficient line-level detail and stable references to connect requisitions, purchase orders, receipts, invoices, postings, budgets, and initiatives.
- [ ] Business functions and Finance will agree on a minimum common classification model while retaining function-specific terminology through governed mappings.
- [ ] Materiality thresholds can be defined so that control and analytical value justify the effort required to capture additional context.
- [ ] Business users can provide purpose, beneficiary, initiative, operational driver, and expected outcome information at planning or requisition, where it is known, rather than attempting to infer it from an invoice alone.
- [ ] Initiative and operational cost-pool context can be inherited through the purchasing lifecycle and corrected through controlled exceptions.
- [ ] Finance and each participating function will appoint accountable owners for master data, mapping rules, exceptions, forecasts, and outcome reviews.
- [ ] Economic return can be evaluated using an evidence hierarchy appropriate to the decision: direct revenue or margin where measurable; otherwise cost avoidance, risk reduction, service level, capability, or another explicit outcome measure.
- [ ] Functions can define their own outcome and value terminology through an open library, while agreeing to minimum metadata and transparent evidence-strength labels.
- [ ] Normal users select from controlled business-function presets; adding or changing presets is an administrator/configuration responsibility and requires real authentication in a production system.
- [ ] AI-assisted extraction and classification can meet agreed accuracy, security, privacy, retention, and auditability requirements on the selected document types.
- [ ] Low-confidence, high-value, novel, or policy-sensitive AI recommendations will receive human review before becoming approved records.
- [ ] The pilot will provide enough historical and current transactions to test ambiguous classifications, forecasting drivers, mapping rules, and post-spend analysis.

**Constraints**

- Existing ERP and Finance reporting codes may be too broad to preserve business context, and system integration or API access may be limited.
- The first release will be a bounded pilot; company-wide applicability is a target state, not an assumption that every function can be modelled immediately.
- The published prototype is synthetic and device-local; its local autosave and reset controls are demonstrations, not durable enterprise persistence.
- The prototype uses synthetic document records and line-level lifecycle links; real PDF/image upload, OCR, extraction, vendor storage, and automatic AI processing remain outside the current implementation boundary.
- The prototype is private and owner-only; it does not demonstrate production role-based access, segregation of duties, or administrator controls.
- Invoice and PO formats, descriptions, languages, currencies, units of measure, and levels of detail will vary by vendor and business function.
- AI extraction and classification are probabilistic; confidence scores and human exception handling are mandatory controls, not optional features.
- Information required for managerial classification or economic-return analysis may not exist in the financial document and must be captured earlier in the planning or requisition process.
- Some recurring expenditure will not belong to a named project or campaign and must be captured through governed operational cost pools.
- Historical data may be incomplete, inconsistently classified, duplicated, or unavailable at line level, limiting back-testing and forecast comparability.
- Direct economic attribution may be difficult where several functions, campaigns, external conditions, or long time lags contribute to the same outcome.
- A company-wide taxonomy can become too complex for routine use; the minimum mandatory fields and controlled extension process must limit user burden.
- A small user-facing budget state model will require technical version and lifecycle metadata to prevent superseded or withdrawn proposals from being mistaken for current approvals.
- User-facing navigation should remain simple, but the system must support direct attention links, edit-mode context, stable internal record IDs, and replaceable generated project IDs without losing history.
- Security, confidentiality, access control, data residency, document retention, and segregation-of-duties requirements will constrain the choice of application and AI architecture.
- Taxonomy, mapping rules, model prompts, extraction logic, and integrations require continuing ownership and maintenance after launch.
- Initial delivery capacity, budget, platform access, and stakeholder availability are not yet confirmed; the first implementation must therefore remain a bounded pilot.

**Dependencies**

- Executive sponsorship and agreement between Finance, business-function leaders, Procurement, IT, Security, Legal/Privacy, and Internal Audit where applicable.
- Selection of a pilot function, materiality threshold, document types, reporting period, and representative historical transaction sample.
- Access to approved Finance extracts, source documents, chart-of-accounts definitions, cost centres, project codes, vendor master data, and fiscal-calendar rules.
- A governed master-data model covering items/services, initiatives, business intent, operational purpose, beneficiaries, vendors, units of measure, and Finance mappings.
- A shared identifier and inheritance design linking initiatives or cost pools to budget versions, requisitions, PO lines, invoice lines, and Finance postings.
- Defined RACI and decision rights for budget ownership, forecast updates, mapping approval, exception resolution, reallocation, and outcome review.
- A versioned classification dictionary and mapping decision table created from real ambiguous transactions.
- Agreement on proposed/approved budget authorization, original/adjusted versioning, controller approval routing, outcome measures, evidence strength, scenario assumptions, approval thresholds, and post-spend review timing.
- An initial outcome and value evidence library with function-defined terms, minimum metadata, and a transparent precision/evidence scale.
- Technical selection and validation of the application platform, document storage, AI models, integration method, identity/access management, and audit logging.
- A labelled validation dataset and human-review process for measuring AI extraction and classification accuracy by document type.
- Baseline measurements for reporting effort, classification quality, unresolved miscellaneous spend, forecast error, and current decision-cycle time.
- A production security and identity design before enabling administrator-managed function presets, shared persistence, or multi-user workflows.

---

## 03 | Fragility Flags

🔴 **High fragility**

- **Unreconcilable source grain:** If Finance data or source documents cannot be connected reliably at PO/invoice-line level, the tool may produce a persuasive operational view that cannot be proven against official records.
- **Unowned governance:** Without named owners and decision rights, taxonomy and mapping rules will drift into another collection of local conventions and miscellaneous buckets.
- **AI treated as authority:** Automated extraction or classification errors could be reproduced at scale if recommendations are accepted without confidence thresholds, source evidence, and human review.
- **False ROI precision:** Requiring every function to produce a direct financial return may reward optimistic assumptions and political modelling rather than better capital allocation.
- **Shadow-ledger conflict:** If users treat this application as an alternative accounting truth instead of a reconciled control layer, disputes with Finance will increase rather than decrease.
- **Company-wide design before pilot evidence:** Attempting to model every function and exception from the beginning could create an unusable taxonomy, excessive data-entry burden, and low adoption.
- **Context captured too late:** If users only provide purpose and business intent after an invoice arrives, the application will reproduce the existing reconstruction problem rather than solve it.
- **Prototype-to-production leap:** A successful synthetic, device-local demonstrator may create false confidence if its calculations and workflow are mistaken for integrated accounting control.
- **Uncontrolled administrator boundary:** Treating configuration-level function presets as if they were secure administrator-managed master data would create a governance and access-control gap.

🟡 **Watch**

- Growth of unresolved `miscellaneous` classifications or repeated manual overrides.
- Duplicate counting as commitments become invoices and actuals without reliable status transitions.
- Inconsistent item specifications or units of measure creating misleading unit-price and vendor comparisons.
- Campaign timing being used as a proxy for business purpose when the actual initiative relationship remains valid outside the launch window.
- Business cases being completed as approval paperwork but not updated when retailer demand, scope, price, or timing changes.
- Economic outcomes being measured selectively, too late, or without a credible baseline and counterfactual.
- AI performance degrading when new vendors, layouts, languages, tax treatments, or document types are introduced.
- Sensitive invoice, vendor, employee, or commercial data being exposed to an unsuitable model, environment, or user role.
- Manual review workload becoming a hidden bottleneck if exception volume remains high.
- Platform or model dependency making mappings, audit history, or extracted data difficult to migrate.
- Budget pages, spend pages, and dashboards becoming separate manual ledgers that disagree with one another.
- Confusion between original budget, current approved budget, pending proposed adjustment, available-to-commit balance, and projected headroom.
- Outcome libraries filling with synonymous, vague, or non-comparable terms that make cross-function analysis impossible.
- Users interpreting synthetic document records, fixed illustrative FX rates, or local autosave as live Finance data.
- Generated project IDs being treated as immutable display text even though ID-affecting metadata can change and linked references must be updated atomically.
- Native confirmation dialogs or browser-specific behaviour making destructive-action cancellation insufficiently testable.

⚠️ **Key assumptions to verify**

- [ ] Line-level Finance exports and stable PO/invoice/posting references are accessible for the pilot.
- [ ] Two independent reviewers can apply the proposed taxonomy to historical transactions with an acceptable level of agreement.
- [ ] Users can provide the missing business context through a short workflow without recreating the administrative burden the tool is intended to remove.
- [ ] Retailer commitment, demand, revenue/margin, service, risk, or other outcome data can be linked to material budget proposals at an appropriate level of confidence.
- [ ] The organisation will accept staged budget release, scenario-based planning, and post-spend outcome review rather than treating the annual budget as an unconditional entitlement.
- [ ] AI accuracy and exception rates are economically better than the current manual process after including review, correction, security, and maintenance costs.
- [ ] A limited common taxonomy can serve multiple functions while governed extensions preserve necessary domain detail.
- [ ] The user-facing budget states can remain limited to Proposed and Approved while version type, approval history, and record lifecycle remain available for audit and reporting.
- [ ] Proposed budget adjustments will not be treated as available funding until all required controller approvals are recorded.
- [ ] A future production document-ingestion design can preserve source evidence, vendor grouping, line-level lineage, confidence, and human review without exposing sensitive files to an unsuitable model or storage layer.

---

## 04 | Tasks

```dataview
TASK
FROM "01_project/Business Function Budget Tracker"
WHERE !completed
SORT priority DESC
```

### Task List
<!-- Add tasks here as - [ ] items. Dataview above renders them live. -->

**Phase 1 — Discover and define**
- [ ] Select the pilot function, operational cost pool, materiality threshold, reporting period, and representative historical transaction sample.
- [ ] Map the current requisition-to-PO-to-invoice-to-Finance process and identify where business context is currently lost.
- [ ] Define the shared data dictionary, stable identifiers, line-level grain, context inheritance rules, and exception process.
- [ ] Define the proposed/approved budget authorization model, original/adjusted versioning, controller approval routing, and technical record lifecycle.
- [ ] Create the first classification dictionary, Finance mapping decision table, and open outcome/value evidence library.
- [ ] Establish baseline measures for reporting effort, classification agreement, unresolved miscellaneous spend, forecast error, and decision-cycle time.

**Phase 2 — Prototype and pilot**
- [x] Build the Planning & Budgeting, Spend & Commitments, and Monitor & Decide views over one shared client-side data model.
- [x] Implement profile setup, controlled function presets, a guided three-module terminology library, project-first planning, and context inheritance within the prototype workflow.
- [x] Implement proposed/approved budget presentation, original/adjusted revision history, approval-oriented controls, and separate financial/outcome panels.
- [x] Implement synthetic quotation, purchase-order, invoice, and actual lifecycle records with line-level project and spending-line links; preserve the no-double-counting rule for converted commitments.
- [x] Implement fixed illustrative FX assumptions, fiscal-year/quarter calculation, quarter phasing, YTG monitoring, overspend/underspend signals, and outcome progress without a composite ROI score.
- [x] Implement local autosave, confirmed working-data reset, normalized Markdown/TSV/CSV exports, leading-zero preservation, and spreadsheet-formula neutralization.
- [x] Verify selection clearing, confirmed removal flows, generated project-ID replacement, linked-reference updates, production build, deterministic checks, and bounded desktop/mobile behaviour.
- [ ] Implement production document upload/OCR/AI extraction, confidence handling, human exception review, Finance integration, and persistent enterprise storage after the production architecture is approved.

**Phase 3 — Validate and prepare scale**
- [ ] Run the prototype through a real pilot reporting cycle using approved source data and review results with Finance and participating functions.
- [ ] Measure success metrics, including reconciliation, AI extraction accuracy, adoption, reporting effort, forecast reliability, and outcome closure.
- [ ] Resolve high-value exceptions, revise mapping rules, and document changes to taxonomy, prompts, workflows, and approval thresholds.
- [ ] Validate security, access control, retention, audit logging, AI data handling, and model/platform migration requirements.
- [ ] Document governance, RACI, support ownership, data-quality routines, and the controlled process for function-specific extensions.
- [ ] Produce a scale/no-scale recommendation based on evidence rather than assumed company-wide readiness.

---

## 05 | Stakeholders & Contacts

<!-- For dissemination: who needs to know what, and when? -->
| Name | Role | Communication Need | Last Contact |
|------|------|--------------------|-------------|
| Chen Shuaizhou |  |  |  |

---

## 06 | Resources & References

**Key Documents**
- [[Business Function Budget Tracker Project Brief]]
- [[portal-prototype/README]]
- Private prototype: [Function Budget Studio](https://function-budget-studio.chenshuaizhou832501.chatgpt.site)
- Prototype source: `01_project/Business Function Budget Tracker/portal-prototype`
- Finance source extracts and representative PO/invoice/quotation documents (to be collected for the pilot)
- Classification dictionary and Finance mapping decision table (to be created)
- Outcome and Value Evidence Library (to be created)

**Relevant Wiki Pages**
- To be identified after the pilot platform and governance model are selected.

**External References**
- Sites deployment is private and owner-only; the prototype contains synthetic, device-local data and is not a Finance system of record.

---

## 07 | Project Log

<!-- Append-only. Newest entry at top. Date every entry. -->

### 2026-08-04 — Project Initiated
- Identified the recurring gap between Finance's broad accounting codes and business functions' need for domain-specific budget, commitment, expenditure, and forecasting context.

### 2026-08-09 — Function Budget Studio v1.1
- Built the first working prototype around a freely navigable function → project/cost-pool → spending-item hierarchy.
- Added a terminology and KPI library so function-specific language is stored as structured metadata rather than only as clustered descriptions.
- Added quarter sorting, function-level and project-level budget views, and normalized export direction.

### 2026-08-10 — Function Budget Studio v1.2
- Reframed onboarding around standalone Training Mode, top-right Profile Setup, guided library modules, and a project-first workspace.
- Established the three workspace views: Plan & Budgeting, Spend & Commitments, and Monitor & Decide.
- Kept the prototype synthetic and device-local; real uploads, extraction, ERP integration, authentication, server persistence, and multi-user collaboration remain excluded.

### 2026-08-12 — Function Budget Studio v1.3–v1.4
- Added the constrained three-module library: Spending items, Project items, and Outcome KPIs, with function-aware starter suggestions and minimum metadata.
- Simplified Planning & Budgeting to proposed and approved planning amounts, with adjustment history separated from the headline amounts.
- Added synthetic quotation → purchase order → invoice → actual lifecycle records, line-level project/spending-line links, open-commitment calculation, and no-double-counting conversion logic.
- Added fixed illustrative FX assumptions, calculated fiscal-year/quarter handling, quarter phasing, YTG monitoring, project exception signals, separate outcome progress, local autosave/reset, and spreadsheet-safe exports.
- Corrected persisted training-sample migration and YTG phase totals after browser verification exposed those issues.

### 2026-08-12 — Function Budget Studio v1.5 / Version 10
- Fixed selection controls so metadata values can be selected, cleared, reselected, and independently removed.
- Added confirmed removal flows for metadata, spending items, outcomes, team members, projects, document lines, and synthetic documents.
- Separated stable internal record IDs from replaceable generated project IDs; ID-affecting metadata changes now update linked document references and preserve history.
- Published the verified private, owner-only version after production build, lint, tests, deterministic checks, and bounded browser validation.

### 2026-08-09 — Scope Consolidated
- Confirmed a company-wide AI-assisted financial control and decision-support application with three primary views: Planning & Budgeting, Spend & Commitments, and Monitor & Decide.
- Confirmed that the views must operate over one governed data model, with accounting, managerial, and operational perspectives linked at spend-line level.
- Confirmed that business context should be captured during initiative planning or requisition and inherited through the purchasing lifecycle.
- Confirmed a small user-facing budget authorization model: Proposed and Approved, with Original or Adjustment as a separate version property and controller approval history retained.
- Confirmed an open, function-definable Outcome and Value Evidence Library with minimum metadata and transparent evidence-strength labels rather than a forced single ROI formula.

### 2026-08-13 — Prototype history consolidated
- Reviewed the scoping and prototype conversations, source history, verification record, and private publication status; merged confirmed decisions and completed prototype changes into this brief.
- Kept unfinished production document ingestion, live AI processing, Finance integration, enterprise persistence, authentication, and multi-user controls explicitly marked as pending rather than treating prototype completion as production readiness.

---

## 08 | Decisions Made

<!-- Record decisions here so the reasoning is not lost.
     Format: decision → rationale → who decided → date -->

| Decision | Rationale | Owner | Date |
|----------|-----------|-------|------|
| Finance remains the official system of record | The application provides a governed management, planning, mapping, reconciliation, and analysis layer without replacing ERP accounting | Chen Shuaizhou | 2026-08-09 |
| Use three primary views over one shared data model | Users need simple modes for planning, spending/commitments, and monitoring, while the data must remain linked rather than duplicated across pages | Chen Shuaizhou | 2026-08-09 |
| Capture business context at planning or requisition | Purpose, beneficiary, initiative, and operational drivers are usually known before the invoice and cannot be reconstructed reliably afterward | Chen Shuaizhou | 2026-08-09 |
| Treat the spending view as Spend & Commitments, not only Invoices | Financial exposure begins before the invoice through quotations, approvals, POs, contracts, and other commitments | Chen Shuaizhou | 2026-08-09 |
| Limit user-facing budget authorization states to Proposed and Approved | A small state model keeps the workflow understandable while controller-level approvals and technical lifecycle metadata preserve control | Chen Shuaizhou | 2026-08-09 |
| Represent Original and Adjustment as budget version properties | Approved budgets must not be overwritten; each adjustment must reference the version it changes and remain auditable | Chen Shuaizhou | 2026-08-09 |
| Use AI for extraction and recommendations with human approval | AI can reduce document-processing and classification effort, but accounting treatment, budget authorization, and investment decisions require accountable review | Chen Shuaizhou | 2026-08-09 |
| Establish an open Outcome and Value Evidence Library | Functions need domain-appropriate terminology and precision, while minimum metadata and evidence levels prevent vague or incomparable business cases | Chen Shuaizhou | 2026-08-09 |
| Do not force every function into a direct-revenue ROI model | Some value is best represented as operational performance, capability, risk reduction, compliance, or cost avoidance; evidence strength must remain visible | Chen Shuaizhou | 2026-08-09 |
| Treat proposed adjustments as pending until controller approval | Proposed money should not increase available funding or be presented as an approved commitment | Chen Shuaizhou | 2026-08-09 |
| Use one shared data model behind the three prototype workspace views | Planning, document lineage, and monitoring must reconcile to the same records rather than becoming separate manual ledgers | Chen Shuaizhou | 2026-08-09 |
| Make Training Mode a standalone utility | Synthetic exploration and reset must not overwrite or appear as working records | Chen Shuaizhou | 2026-08-10 |
| Keep Profile Setup limited to function preset, planner name, and team | Profile should identify the working context; fiscal and currency settings belong to function budgeting, not personal identity | Chen Shuaizhou | 2026-08-10 |
| Treat business functions as controlled presets | Normal users should select a governed preset; adding or editing presets requires administrator configuration and production identity controls | Chen Shuaizhou | 2026-08-10 |
| Use a guided three-module terminology library | Spending items, Project items, and Outcome KPIs reduce the burden of inventing a schema while preserving function-specific language | Chen Shuaizhou | 2026-08-10 |
| Make projects or operational cost pools the primary planning unit | Budget decisions, spending lines, outcome assignments, and document links need a stable unit of context | Chen Shuaizhou | 2026-08-10 |
| Keep Planning & Budgeting focused on proposed and approved amounts | Commitments, actuals, and rehearsal details belong in Spend & Commitments or Monitor & Decide; adjustment history remains accessible but does not become a third headline amount | Chen Shuaizhou | 2026-08-10 |
| Capture spend through quotation → PO → invoice → actual lineage | Exposure begins before invoices and exact line links prevent converted commitments from being counted twice | Chen Shuaizhou | 2026-08-10 |
| Use fixed illustrative FX rates and calculated fiscal periods in the prototype | A stable reporting basis is needed for cross-currency totals and quarter phasing; live market feeds are outside the prototype boundary | Chen Shuaizhou | 2026-08-12 |
| Monitor YTG and quarter phasing separately from outcome progress | Financial control should identify over/underspend and adjustment signals without collapsing outcomes into a composite ROI score | Chen Shuaizhou | 2026-08-12 |
| Preserve stable internal IDs while allowing generated project IDs to be replaced | ID-affecting metadata can change; linked references and history must update atomically without losing record identity | Chen Shuaizhou | 2026-08-12 |
| Require confirmed removal actions | Created metadata, project, document, and line records need reversible-by-confirmation deletion behaviour to prevent accidental loss | Chen Shuaizhou | 2026-08-12 |
| Publish the prototype privately and owner-only | The current implementation contains synthetic data and device-local state, so broad access would misrepresent its production readiness | Chen Shuaizhou | 2026-08-12 |

---

## 09 | End State & Handoff

<!-- Complete this section when the project closes.
     This is what gets archived and shared. -->

**What was delivered:**

**What was learned:**

**What was not completed and why:**

**Handoff notes for next person / next project:**

---

*Project file: `01_project/Business Function Budget Tracker/Business Function Budget Tracker Project Brief.md`*
*Generated: 2026-08-04 10:14*
