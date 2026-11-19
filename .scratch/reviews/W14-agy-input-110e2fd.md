# Code excerpts at 110e2fd for the W14 agy second opinion

Commit: 110e2fd (Wave 12 merged). The working tree holds uncommitted Wave 13 changes, so these excerpts are the reviewed code, not the working files. Line numbers are the 110e2fd numbers.

Ticket: .scratch/tickets/W14-qwen-review-v2-triage.md — read it first, then judge each item below on its own from these excerpts.

## W14-1 — workbench fallback total is 0

Claim: total falls back to requirementTotal(enrichedItems[0] || {}). Jinggru says requirementTotal({}) returns 0 safely.

### app/ellies-book-workbench.tsx lines 1170-1195

```tsx
      : [];
    const builtVersions: ReturnType<typeof createBudgetVersion>[] = [];
    if (rawRevs.length === 0) {
      builtVersions.push(
        createBudgetVersion({
          versionId: `ver-${projId}-1`,
          projectId: projId,
          sequence: 1,
          versionType: "Original",
          authorizationState: "Approved",
          reason: "Initial project baseline",
          total:
            activeProject.approvedAmount ||
            requirementTotal(enrichedItems[0] || {}),
          currency,
          purchaseItems: enrichedItems,
        }),
      );
    } else {
      rawRevs.forEach((rev, idx) => {
        const isApproved =
          rev.status === "Approved" ||
          (idx === 0 && activeProject.approvedAmount > 0);
        const v = createBudgetVersion(
          {
            versionId: rev.id || `ver-${projId}-${idx + 1}`,
```

### app/budget-domain.mjs lines 1-30 (requirementTotal)

```js
export function allocationSubtotal(allocation) {
  return Number(allocation.quantity || 0) * Number(allocation.unitPrice || 0) + Number(allocation.additionalCostEstimate || 0);
}

export function allocationTotal(allocations = []) {
  const list = Array.isArray(allocations) ? allocations : (allocations?.allocations || []);
  return list.reduce((total, allocation) => total + allocationSubtotal(allocation), 0);
}

export function allocatedQuantity(allocations = []) {
  const list = Array.isArray(allocations) ? allocations : (allocations?.allocations || []);
  return list.reduce((total, allocation) => total + Number(allocation.quantity || 0), 0);
}

export function requirementTotal(requirement) {
  const allocations = requirement.allocations || [];
  return allocations.length
    ? allocationTotal(allocations)
    : Number(requirement.quantity || 0) * Number(requirement.unitPrice || 0);
}

export function unallocatedQuantity(requirement) {
  return Math.max(0, Number(requirement.quantity || 0) - allocatedQuantity(requirement.allocations || []));
}

export function matchDefinition(definition, search) {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  return [definition.name, definition.sourceText, ...(definition.aliases || [])]
    .filter(Boolean)
```

## W14-2 — empty profile leaves the planner out of the team

Claim: defaultMembers returns [] when plannerName is empty. Jinggru says validateProfile flags the empty name as a Blocking error, so the gap is surfaced, not silent.

### app/page.tsx lines 55-120 (defaultMembers, starterLibrary start, normalizeData)

```tsx
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member"; }
function codeForName(name: string) { const known: Record<string, string> = { Gucci: "GUC", Lancaster: "LNC", Burberry: "BUR", "Make-up": "MU", Perfume: "FRAG" }; if (known[name]) return known[name]; const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? []; return (words.length > 1 ? words.map((word) => word[0]).join("") : (words[0] ?? "TAG").slice(0, 3)).slice(0, 8); }
function blankLibrary(): Library { return { tagFamilies: [], spendingItems: [], outcomes: [] }; }
function usdPerUnit(currency: string) { return ({ USD: 1, SGD: 0.74, EUR: 1.08, GBP: 1.27, AUD: 0.66 } as Record<string, number>)[currency] ?? 1; }
function defaultFxRates(to = "USD") { return CURRENCIES.map((from) => ({ from, to, rate: Number((usdPerUnit(from) / usdPerUnit(to)).toFixed(6)) })); }
function defaultMembers(profile?: Profile) { return profile?.plannerName ? [{ id: `member-${slug(profile.plannerName)}`, name: profile.plannerName, role: "Planner" }] : []; }
function fiscalPeriodForDate(settings: Pick<BudgetSettings, "fiscalYearStartMonth" | "fiscalYearStartYear">, date = new Date()) { const startMonth = Math.min(12, Math.max(1, number(settings.fiscalYearStartMonth) || 6)); const startYear = Math.max(2000, number(settings.fiscalYearStartYear) || date.getFullYear()); const month = date.getMonth() + 1; const year = date.getFullYear(); const fiscalYear = Math.max(startYear + 1, month >= startMonth ? year + 1 : year); const monthsSinceStart = (month - startMonth + 12) % 12; return { fiscalYear: `FY${String(fiscalYear).slice(-2)}`, quarter: `Q${Math.floor(monthsSinceStart / 3) + 1}` as Quarter, label: `${`FY${String(fiscalYear).slice(-2)}`} Q${Math.floor(monthsSinceStart / 3) + 1}` }; }
function nowIso() { return new Date().toISOString(); }
function blankData(): StudioData { const settings = { currency: "USD", fiscalPeriod: "FY2027", currentQuarter: "Q1" as Quarter, fiscalYearStartMonth: 6, fiscalYearStartYear: 2026, fxVersion: "Illustrative fixed rates v1", fxRates: defaultFxRates(), teamMembers: [], nextProjectSequence: 1 }; const calculated = fiscalPeriodForDate(settings); return { schemaVersion: 2, profile: { functionName: "", plannerName: "", team: "" }, settings: { ...settings, fiscalPeriod: calculated.fiscalYear, currentQuarter: calculated.quarter }, library: blankLibrary(), libraryComplete: false, projects: [], documents: [], curationCandidates: [], importReviews: [], recommendations: [] }; }

function starterLibrary(functionName: string): Library {
  const marketing = /marketing|brand|visual merchandising/i.test(functionName);
  return {
    tagFamilies: [
      { id: "tag-business-intent", name: "Business intent", priority: 1, includeInProjectId: true, selection: "single", values: [{ id: "tag-intent-growth", name: "Growth", code: "GROWTH" }, { id: "tag-intent-efficiency", name: "Efficiency", code: "EFF" }, { id: "tag-intent-capability", name: "Capability", code: "CAP" }] },
      { id: "tag-brand-house", name: "Brand house", priority: 2, includeInProjectId: true, selection: "single", values: [{ id: "tag-gucci", name: "Gucci", code: "GUC" }, { id: "tag-lancaster", name: "Lancaster", code: "LNC" }, { id: "tag-burberry", name: "Burberry", code: "BUR" }] },
      { id: "tag-product-category", name: "Product category", priority: 3, includeInProjectId: true, selection: "multi", values: [{ id: "tag-makeup", name: "Make-up", code: "MU" }, { id: "tag-perfume", name: "Perfume", code: "FRAG" }] },
      { id: "tag-project-type", name: "Project type", priority: 4, includeInProjectId: false, selection: "single", values: marketing ? [{ id: "tag-campaign", name: "Campaign", code: "CMP" }, { id: "tag-store", name: "Store activation", code: "STA" }, { id: "tag-ops", name: "Recurring operations", code: "OPS" }] : [{ id: "tag-initiative", name: "Initiative", code: "INI" }, { id: "tag-ops", name: "Recurring operations", code: "OPS" }] },
      { id: "tag-channel", name: "Channel", priority: 5, includeInProjectId: false, selection: "single", values: [{ id: "tag-internal", name: "Internal", code: "INT" }, { id: "tag-external", name: "External", code: "EXT" }] },
    ],
    spendingItems: marketing ? [
      { id: "spend-posm", name: "Shelf tester unit", glCode: "001230", financeDescription: "Illustrative point-of-sale marketing material.", tagIds: ["tag-gucci", "tag-makeup", "tag-internal"], mappingStatus: "Confirmed" },
      { id: "spend-media", name: "Paid media package", glCode: "001245", financeDescription: "Illustrative paid distribution package.", tagIds: ["tag-external"], mappingStatus: "Confirmed" },
      { id: "spend-research", name: "Market research sprint", glCode: "001280", financeDescription: "Illustrative customer or market research service.", tagIds: ["tag-external"], mappingStatus: "Confirmed" },
    ] : [
      { id: "spend-service", name: "Core service package", glCode: "", financeDescription: "Illustrative function service or operating item.", tagIds: ["tag-internal"], mappingStatus: "Needs Finance review" },
      { id: "spend-tool", name: "Function tool subscription", glCode: "", financeDescription: "Illustrative recurring tool or system cost.", tagIds: ["tag-external"], mappingStatus: "Needs Finance review" },
    ],
    outcomes: marketing ? [
      { id: "kpi-pipeline", name: "Qualified pipeline contribution", definition: "Qualified opportunities associated with the project window.", unit: "qualified opportunities", measurementWindow: "Quarterly", tagIds: ["tag-campaign"] },
      { id: "kpi-shelf", name: "Shelf execution coverage", definition: "Share of planned placements installed and checked.", unit: "% of placements", measurementWindow: "At project completion", tagIds: ["tag-store"] },
      { id: "kpi-efficiency", name: "Cost per qualified opportunity", definition: "Project spend divided by qualified opportunities.", unit: "USD / opportunity", measurementWindow: "Monthly", tagIds: ["tag-campaign"] },
    ] : [
      { id: "kpi-service", name: "Service delivery coverage", definition: "Share of function service commitments delivered in the period.", unit: "% delivered", measurementWindow: "Monthly", tagIds: ["tag-ops"] },
      { id: "kpi-capability", name: "Capability adoption", definition: "Share of intended users or teams adopting the capability.", unit: "% adoption", measurementWindow: "Quarterly", tagIds: ["tag-initiative"] },
    ],
  };
}

function normalizeDefinitionBase<T extends DefinitionBase>(definition: T, originProjectId?: string): T {
  return { ...definition, scope: definition.scope ?? "Reusable", lifecycle: definition.lifecycle ?? "Active", originProjectId: definition.originProjectId ?? originProjectId, aliases: definition.aliases ?? [], sourceText: definition.sourceText ?? definition.name ?? "", createdAt: definition.createdAt ?? nowIso() };
}
function defaultWorkPackage(): ProjectWorkPackage { return { id: newId("work-package"), name: "General", description: "General project expenditure", tagIds: [] }; }
function normalizeAllocation(allocation: Partial<SourcingAllocation>, settings: BudgetSettings): SourcingAllocation { return { id: allocation.id ?? newId("allocation"), sourceType: allocation.sourceType ?? "External vendor", vendorOrWarehouse: allocation.vendorOrWarehouse ?? "", sourceCountry: allocation.sourceCountry ?? "", sourceLocation: allocation.sourceLocation ?? "", quantity: number(allocation.quantity ?? 0), unitPrice: number(allocation.unitPrice ?? 0), currency: allocation.currency ?? settings.currency, quarter: QUARTERS.includes(allocation.quarter as Quarter) ? allocation.quarter as Quarter : settings.currentQuarter, priceBasis: allocation.priceBasis ?? "Unit price", additionalCostEstimate: number(allocation.additionalCostEstimate ?? 0), notes: allocation.notes ?? "", financeMappingStatus: allocation.financeMappingStatus ?? "Needs Finance review", suggestedFinanceCode: allocation.suggestedFinanceCode, confirmedFinanceCode: allocation.confirmedFinanceCode, mappingRationale: allocation.mappingRationale ?? "", linkedDocumentId: allocation.linkedDocumentId, linkedDocumentLineId: allocation.linkedDocumentLineId }; }
function normalizeWorkPackages(raw: Partial<Project>): ProjectWorkPackage[] { const packages = (raw.workPackages ?? []).map((workPackage) => ({ id: workPackage.id ?? newId("work-package"), name: workPackage.name ?? "General", description: workPackage.description ?? "", tagIds: workPackage.tagIds ?? [] })); return packages.length ? packages : [defaultWorkPackage()]; }

function normalizeData(raw: Partial<StudioData> | null | undefined): StudioData {
  const base = blankData();
  const profile = { ...base.profile, ...(raw?.profile ?? {}) };
  const rawSettings = raw?.settings ?? {} as BudgetSettings;
  const rawFamilies = raw?.library?.tagFamilies ?? [];
  const tagFamilies: TagFamily[] = rawFamilies.map((family, index) => ({
    id: family.id || newId("family"), name: family.name ?? "", priority: number((family as Partial<TagFamily>).priority ?? (index + 1)), includeInProjectId: Boolean((family as Partial<TagFamily>).includeInProjectId ?? /brand house|product category/i.test(family.name ?? "")), selection: ((family as Partial<TagFamily>).selection ?? (/product category/i.test(family.name ?? "") ? "multi" : "single")) as SelectionMode,
    values: (family.values ?? []).map((value) => ({ id: value.id || newId("tag"), name: value.name ?? "", code: (value as Partial<TagValue>).code || codeForName(value.name ?? "") })),
  }));
  const library: Library = { tagFamilies, spendingItems: (raw?.library?.spendingItems ?? []).map((item) => normalizeDefinitionBase({ ...item, name: item.name ?? "", glCode: item.glCode ?? "", financeDescription: item.financeDescription ?? "", tagIds: item.tagIds ?? [], mappingStatus: item.mappingStatus ?? "Needs Finance review", unitOfMeasure: item.unitOfMeasure ?? "", specification: item.specification ?? "" } as SpendingItemDefinition)), outcomes: (raw?.library?.outcomes ?? []).map((outcome) => normalizeDefinitionBase({ ...outcome, name: outcome.name ?? "", definition: outcome.definition ?? "", unit: outcome.unit ?? "", measurementWindow: outcome.measurementWindow ?? "Monthly", tagIds: outcome.tagIds ?? [], direction: outcome.direction ?? "Increase", expectedEvidenceSource: outcome.expectedEvidenceSource ?? "", effectiveDate: outcome.effectiveDate ?? "" } as OutcomeDefinition)) };
  const members = ((rawSettings as Partial<BudgetSettings>).teamMembers ?? []).map((member) => ({ id: member.id || newId("member"), name: member.name ?? "", role: member.role ?? "Team member" }));
  for (const member of defaultMembers(profile)) if (!members.some((candidate) => candidate.name === member.name)) members.push(member);
  const knownOwnerNames = (raw?.projects ?? []).map((project) => (project as Partial<Project>).legacyOwner ?? (project as Partial<Project> & { owner?: string }).owner ?? "").filter(Boolean);
  for (const name of knownOwnerNames) if (!members.some((member) => member.name === name)) members.push({ id: `member-${slug(name)}`, name, role: "Historical owner" });
  const maxSequence = (raw?.projects ?? []).reduce((max, project) => { const match = String(project.id ?? "").match(/(\d{4})$/); return Math.max(max, match ? Number(match[1]) : 0); }, 0);
  const settings: BudgetSettings = { ...base.settings, ...rawSettings, currency: rawSettings.currency || "USD", fiscalYearStartMonth: number((rawSettings as Partial<BudgetSettings>).fiscalYearStartMonth) || 6, fiscalYearStartYear: number((rawSettings as Partial<BudgetSettings>).fiscalYearStartYear) || 2026, currentQuarter: QUARTERS.includes(rawSettings.currentQuarter as Quarter) ? rawSettings.currentQuarter as Quarter : base.settings.currentQuarter, fxVersion: rawSettings.fxVersion || "Illustrative fixed rates v1", fxRates: rawSettings.fxRates?.length ? rawSettings.fxRates : defaultFxRates(rawSettings.currency || "USD"), teamMembers: members, nextProjectSequence: Math.max(number(rawSettings.nextProjectSequence), maxSequence + 1, 1) };
  const calculatedPeriod = fiscalPeriodForDate(settings);
  settings.fiscalPeriod = calculatedPeriod.fiscalYear;
  settings.currentQuarter = calculatedPeriod.quarter;
  const projects = (raw?.projects ?? []).map((project) => {
```

### app/page.tsx lines 478-500 (validateProfile, validateCoreSetup, attentionItems start)

```tsx
// workspace built from blankData().

function validateProfile(data: StudioData): ValidationError[] { const errors: ValidationError[] = []; if (!data.profile.plannerName.trim()) errors.push({ key: "profile.plannerName", message: "Add the planner name." }); if (!data.profile.team.trim()) errors.push({ key: "profile.team", message: "Add the team or sub-function." }); return errors; }
function validateCoreSetup(data: StudioData): ValidationError[] { const errors: ValidationError[] = [...validateProfile(data)]; const intentFamily = data.library.tagFamilies.find((family) => family.id === "tag-business-intent"); if (!data.profile.functionName.trim()) errors.push({ key: "library.functionPreset", message: "Choose and apply a controlled function preset." }); if (!intentFamily?.values.length) errors.push({ key: "library.businessIntent", message: "Keep a Business intent family with at least one reusable value." }); if (!projectTypeFamily(data)?.values.length) errors.push({ key: "library.projectType", message: "Keep a Project type family with at least one reusable value." }); return errors; }
function validateLibrary(data: StudioData): ValidationError[] { const errors: ValidationError[] = []; data.library.tagFamilies.forEach((family) => { if (!family.name.trim()) errors.push({ key: `family.${family.id}.name`, message: "Name the tag family or remove the empty family." }); if (family.includeInProjectId && family.priority < 1) errors.push({ key: `family.${family.id}.priority`, message: "Use a positive priority for an ID family." }); family.values.forEach((value) => { if (!value.name.trim()) errors.push({ key: `value.${value.id}.name`, message: "Name the reusable tag value or remove the empty value." }); if (family.includeInProjectId && !value.code.trim()) errors.push({ key: `value.${value.id}.code`, message: "Add a short code for this ID-enabled value." }); }); }); data.library.spendingItems.forEach((item) => { if (item.name.trim() && !item.financeDescription.trim()) errors.push({ key: `spend.${item.id}.financeDescription`, message: "Add a Finance description or leave this definition as a project-only draft." }); if (item.mappingStatus === "Confirmed" && !item.glCode.trim()) errors.push({ key: `spend.${item.id}.glCode`, message: "Add the GL code or mark Needs Finance review." }); }); data.library.outcomes.forEach((outcome) => { if (outcome.name.trim() && !outcome.definition.trim()) errors.push({ key: `outcome.${outcome.id}.definition`, message: "Describe the outcome or leave it as a project-only draft." }); }); return errors; }

type AttentionItem = { id: string; severity: "Blocking" | "Warning"; label: string; detail: string; tab: TopTab; target?: string; projectId?: string; librarySection?: "metadata" | "spend" | "outcomes" | "curation" };
function attentionItems(data: StudioData, coreErrors: ValidationError[], libraryWarnings: ValidationError[]) {
  const items: AttentionItem[] = [];
  const profileTargets: Record<string, string> = { "profile.plannerName": "profile-name", "profile.team": "profile-team" };
  coreErrors.filter((error) => error.key.startsWith("profile.")).forEach((error) => items.push({ id: error.key, severity: "Blocking", label: error.key === "profile.plannerName" ? "Planner name" : "Team", detail: error.message, tab: "profile", target: profileTargets[error.key] }));
  coreErrors.filter((error) => error.key.startsWith("library.")).forEach((error) => { const target = error.key === "library.functionPreset" ? "controlled-function-preset" : undefined; const librarySection = error.key === "library.functionPreset" ? undefined : "metadata" as const; items.push({ id: error.key, severity: "Blocking", label: error.key === "library.functionPreset" ? "Function preset" : "Core metadata", detail: error.message, tab: "library", target, librarySection }); });
  libraryWarnings.forEach((error) => { const spend = error.key.match(/^spend\.([^.]+)\.(.+)$/); const outcome = error.key.match(/^outcome\.([^.]+)\.(.+)$/); const spendField = spend ? ({ name: "name", glCode: "gl", financeDescription: "finance" } as Record<string, string>)[spend[2]] ?? spend[2] : undefined; const outcomeField = outcome ? ({ name: "name", definition: "definition", unit: "unit" } as Record<string, string>)[outcome[2]] ?? outcome[2] : undefined; const target = spend ? `item-${spendField}-${spend[1]}` : outcome ? `outcome-${outcomeField}-${outcome[1]}` : undefined; const librarySection = spend ? "spend" as const : outcome ? "outcomes" as const : "metadata" as const; items.push({ id: error.key, severity: "Warning", label: spend ? `Spending item: ${spend[2]}` : outcome ? `Outcome: ${outcome[2]}` : "Function library", detail: error.message, tab: "library", target, librarySection }); });
  data.library.spendingItems.filter((item) => item.mappingStatus === "Needs Finance review").forEach((item) => items.push({ id: `mapping-${item.id}`, severity: "Warning", label: `Finance mapping: ${item.name || "Untitled item"}`, detail: "Confirm the GL mapping or leave it routed to Finance review.", tab: "library", target: `item-mapping-${item.id}`, librarySection: "spend" }));
  data.projects.forEach((project) => { if (!project.name.trim()) items.push({ id: `project-name-${project.recordId}`, severity: "Blocking", label: "Project name", detail: "Add a project name before saving.", tab: "plan", projectId: project.recordId, target: `project-name-v15-${project.id}` }); if (!project.ownerIds.length) items.push({ id: `project-owner-${project.recordId}`, severity: "Blocking", label: `People in charge: ${project.name || "Untitled project"}`, detail: "Select at least one person in charge.", tab: "plan", projectId: project.recordId, target: `project-owner-v15-${project.id}` }); });
  data.documents.filter((document) => document.status === "Needs review").forEach((document) => items.push({ id: `document-${document.id}`, severity: "Warning", label: `Document: ${document.fileName || document.reference}`, detail: "Review the imported document lines and confirm their allocations.", tab: "spend", target: `document-${document.id}` }));
  return items;
}
function AttentionPanel({ items, onOpen }: { items: AttentionItem[]; onOpen: (item: AttentionItem) => void }) { return <section className="attention-panel" aria-label="Needs attention"><div className="attention-heading"><div><span className="panel-caption">Quick links</span><strong>Needs attention</strong><span className="muted">{items.length ? `${items.length} item(s)` : "Nothing is waiting"}</span></div></div>{items.length ? <div className="attention-list">{items.slice(0, 8).map((item) => <button key={item.id} type="button" className="attention-item" onClick={() => onOpen(item)}><span className={`status-pill ${item.severity === "Blocking" ? "status-negative" : "status-pending"}`}>{item.severity}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><span aria-hidden="true">→</span></button>)}</div> : <p className="muted small-copy">Blocking fields, Finance reviews, incomplete projects, and imported documents appear here with direct links.</p>}</section>; }

function SetupCommonIntent({ data, onTab }: { data: StudioData; onTab: (tab: TopTab) => void }) {
  const functionName = data.profile.functionName.trim();
  const teamName = data.profile.team.trim();
```

### app/page.tsx lines 545-560 (validation memos, attentionItems call site)

```tsx
  useEffect(() => { try { const saved = window.localStorage.getItem(WORKING_KEY) ?? window.localStorage.getItem(LEGACY_WORKING_KEY); if (saved) { const parsed = normalizeData(JSON.parse(saved) as Partial<StudioData>); setData(parsed); setActive(parsed.libraryComplete ? "plan" : parsed.profile.functionName ? "library" : "profile"); } } catch { /* local state is optional */ } setHydrated(true); }, []);
  useEffect(() => { if (!hydrated) return; try { window.localStorage.setItem(WORKING_KEY, JSON.stringify(data)); } catch { /* local state is optional */ } }, [data, hydrated]);
  const profileErrors = useMemo(() => validateProfile(data), [data]); const coreErrors = useMemo(() => validateCoreSetup(data), [data]); const libraryErrors = useMemo(() => validateLibrary(data), [data]);
  const resetWorking = () => { if (!window.confirm("Reset all working data saved on this device?")) return; setData(blankData()); setActive("profile"); setErrors([]); setExportStatus(""); try { window.localStorage.removeItem(WORKING_KEY); window.localStorage.removeItem(LEGACY_WORKING_KEY); } catch { /* no-op */ } };
  // Sample data / Developer: loads the complete example project onto the working
  // workspace on demand. This is the single way to get demo data.
  const loadSampleData = () => { setData(sampleData()); setActive("plan"); setErrors([]); setExportStatus(""); };
  const exportData = async (kind: "markdown" | "tsv" | "csv") => { const content = kind === "markdown" ? exportMarkdown(data) : exportDelimited(data, kind === "tsv" ? "\t" : ","); if (kind === "csv") { const blob = new Blob([content], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "function-budget-studio-1-4-export.csv"; anchor.click(); URL.revokeObjectURL(url); setExportStatus("CSV downloaded"); return; } try { await navigator.clipboard.writeText(content); setExportStatus(`${kind === "markdown" ? "Markdown" : "Excel-safe TSV"} copied`); } catch { setExportStatus("Copy was blocked; use CSV download instead."); } };
  const goTab = (tab: TopTab) => { setErrors([]); if (tab === "plan") setData((current) => ({ ...current, libraryComplete: validateCoreSetup(current).length === 0 })); setActive(tab); };
  const items = attentionItems(data, coreErrors, libraryErrors);
  const openAttention = (item: AttentionItem) => { setErrors([]); setFocusProjectId(item.projectId); if (item.librarySection) setLibrarySection(item.librarySection); setActive(item.tab); window.setTimeout(() => { const direct = item.target ? document.getElementById(item.target) : null; const candidates = item.tab === "spend" ? Array.from(document.querySelectorAll<HTMLElement>(".document-card")) : item.tab === "plan" ? Array.from(document.querySelectorAll<HTMLElement>(".project-card")) : item.tab === "library" ? Array.from(document.querySelectorAll<HTMLElement>(".library-section")) : []; const target = direct ?? candidates.find((candidate) => item.projectId ? candidate.textContent?.includes(item.projectId) : item.label.startsWith("Document:") ? candidate.textContent?.includes(item.label.replace("Document: ", "")) : item.tab === "library" ? candidates[0] : false); if (!(target instanceof HTMLElement)) return; target.scrollIntoView({ block: "center", behavior: "smooth" }); const focusable = target.matches("button,input,select,textarea,[tabindex]") ? target : target.querySelector<HTMLElement>("button,input,select,textarea,[tabindex]"); focusable?.focus(); }, 180); };
  const classicStudioSlot = <div className="classic-studio-slot"><SetupCommonIntent data={data} onTab={goTab} /><Header active={active} profile={data.profile} onTab={goTab} onReset={resetWorking} /><div className="studio-main"><AttentionPanel items={items} onOpen={openAttention} />{active === "profile" ? <ProfileScreen data={data} setData={setData} errors={errors.length ? errors : profileErrors} /> : active === "library" ? <LibraryScreen data={data} setData={setData} errors={errors.length ? errors : libraryErrors} focusSection={librarySection} /> : active === "plan" ? <><PlanView data={data} setData={setData} focusProjectId={focusProjectId} />{exportStatus ? <p className="export-status" role="status">{exportStatus}</p> : null}<div className="workspace-export"><AppButton kind="secondary" onClick={() => exportData("markdown")}>Copy Markdown</AppButton><AppButton kind="secondary" onClick={() => exportData("tsv")}>Copy Excel-safe TSV</AppButton><AppButton kind="secondary" onClick={() => exportData("csv")}>Download CSV</AppButton></div></> : active === "spend" ? <SpendView data={data} setData={setData} /> : <MonitorView data={data} />}</div></div>;
  return <div className="studio-app"><ElliesBookWorkbench data={data as unknown as WorkbenchStudioData} setData={setData as unknown as Dispatch<SetStateAction<WorkbenchStudioData>>} classicStudioSlot={classicStudioSlot} onOpenClassicTab={goTab} onLoadSampleData={loadSampleData} attentionCount={items.length} /></div>;
}
```

## W14-5 — business-intent tag cannot be deselected

Claim: the TagPicker toggle early-returns for the tag-business-intent family. Jinggru says the family is single-select in the shipped library, new projects default to the intent tag, and validateCoreSetup requires the family to keep a value — and the MetadataBoard selection control (line 266) lets a user switch the family to multi-select, which is the case to weigh.

### app/page.tsx lines 65-100 (starterLibrary, tag-business-intent family)

```tsx
function starterLibrary(functionName: string): Library {
  const marketing = /marketing|brand|visual merchandising/i.test(functionName);
  return {
    tagFamilies: [
      { id: "tag-business-intent", name: "Business intent", priority: 1, includeInProjectId: true, selection: "single", values: [{ id: "tag-intent-growth", name: "Growth", code: "GROWTH" }, { id: "tag-intent-efficiency", name: "Efficiency", code: "EFF" }, { id: "tag-intent-capability", name: "Capability", code: "CAP" }] },
      { id: "tag-brand-house", name: "Brand house", priority: 2, includeInProjectId: true, selection: "single", values: [{ id: "tag-gucci", name: "Gucci", code: "GUC" }, { id: "tag-lancaster", name: "Lancaster", code: "LNC" }, { id: "tag-burberry", name: "Burberry", code: "BUR" }] },
      { id: "tag-product-category", name: "Product category", priority: 3, includeInProjectId: true, selection: "multi", values: [{ id: "tag-makeup", name: "Make-up", code: "MU" }, { id: "tag-perfume", name: "Perfume", code: "FRAG" }] },
      { id: "tag-project-type", name: "Project type", priority: 4, includeInProjectId: false, selection: "single", values: marketing ? [{ id: "tag-campaign", name: "Campaign", code: "CMP" }, { id: "tag-store", name: "Store activation", code: "STA" }, { id: "tag-ops", name: "Recurring operations", code: "OPS" }] : [{ id: "tag-initiative", name: "Initiative", code: "INI" }, { id: "tag-ops", name: "Recurring operations", code: "OPS" }] },
      { id: "tag-channel", name: "Channel", priority: 5, includeInProjectId: false, selection: "single", values: [{ id: "tag-internal", name: "Internal", code: "INT" }, { id: "tag-external", name: "External", code: "EXT" }] },
    ],
    spendingItems: marketing ? [
      { id: "spend-posm", name: "Shelf tester unit", glCode: "001230", financeDescription: "Illustrative point-of-sale marketing material.", tagIds: ["tag-gucci", "tag-makeup", "tag-internal"], mappingStatus: "Confirmed" },
      { id: "spend-media", name: "Paid media package", glCode: "001245", financeDescription: "Illustrative paid distribution package.", tagIds: ["tag-external"], mappingStatus: "Confirmed" },
      { id: "spend-research", name: "Market research sprint", glCode: "001280", financeDescription: "Illustrative customer or market research service.", tagIds: ["tag-external"], mappingStatus: "Confirmed" },
    ] : [
      { id: "spend-service", name: "Core service package", glCode: "", financeDescription: "Illustrative function service or operating item.", tagIds: ["tag-internal"], mappingStatus: "Needs Finance review" },
      { id: "spend-tool", name: "Function tool subscription", glCode: "", financeDescription: "Illustrative recurring tool or system cost.", tagIds: ["tag-external"], mappingStatus: "Needs Finance review" },
    ],
    outcomes: marketing ? [
      { id: "kpi-pipeline", name: "Qualified pipeline contribution", definition: "Qualified opportunities associated with the project window.", unit: "qualified opportunities", measurementWindow: "Quarterly", tagIds: ["tag-campaign"] },
      { id: "kpi-shelf", name: "Shelf execution coverage", definition: "Share of planned placements installed and checked.", unit: "% of placements", measurementWindow: "At project completion", tagIds: ["tag-store"] },
      { id: "kpi-efficiency", name: "Cost per qualified opportunity", definition: "Project spend divided by qualified opportunities.", unit: "USD / opportunity", measurementWindow: "Monthly", tagIds: ["tag-campaign"] },
    ] : [
      { id: "kpi-service", name: "Service delivery coverage", definition: "Share of function service commitments delivered in the period.", unit: "% delivered", measurementWindow: "Monthly", tagIds: ["tag-ops"] },
      { id: "kpi-capability", name: "Capability adoption", definition: "Share of intended users or teams adopting the capability.", unit: "% adoption", measurementWindow: "Quarterly", tagIds: ["tag-initiative"] },
    ],
  };
}

function normalizeDefinitionBase<T extends DefinitionBase>(definition: T, originProjectId?: string): T {
  return { ...definition, scope: definition.scope ?? "Reusable", lifecycle: definition.lifecycle ?? "Active", originProjectId: definition.originProjectId ?? originProjectId, aliases: definition.aliases ?? [], sourceText: definition.sourceText ?? definition.name ?? "", createdAt: definition.createdAt ?? nowIso() };
}
function defaultWorkPackage(): ProjectWorkPackage { return { id: newId("work-package"), name: "General", description: "General project expenditure", tagIds: [] }; }
function normalizeAllocation(allocation: Partial<SourcingAllocation>, settings: BudgetSettings): SourcingAllocation { return { id: allocation.id ?? newId("allocation"), sourceType: allocation.sourceType ?? "External vendor", vendorOrWarehouse: allocation.vendorOrWarehouse ?? "", sourceCountry: allocation.sourceCountry ?? "", sourceLocation: allocation.sourceLocation ?? "", quantity: number(allocation.quantity ?? 0), unitPrice: number(allocation.unitPrice ?? 0), currency: allocation.currency ?? settings.currency, quarter: QUARTERS.includes(allocation.quarter as Quarter) ? allocation.quarter as Quarter : settings.currentQuarter, priceBasis: allocation.priceBasis ?? "Unit price", additionalCostEstimate: number(allocation.additionalCostEstimate ?? 0), notes: allocation.notes ?? "", financeMappingStatus: allocation.financeMappingStatus ?? "Needs Finance review", suggestedFinanceCode: allocation.suggestedFinanceCode, confirmedFinanceCode: allocation.confirmedFinanceCode, mappingRationale: allocation.mappingRationale ?? "", linkedDocumentId: allocation.linkedDocumentId, linkedDocumentLineId: allocation.linkedDocumentLineId }; }
function normalizeWorkPackages(raw: Partial<Project>): ProjectWorkPackage[] { const packages = (raw.workPackages ?? []).map((workPackage) => ({ id: workPackage.id ?? newId("work-package"), name: workPackage.name ?? "General", description: workPackage.description ?? "", tagIds: workPackage.tagIds ?? [] })); return packages.length ? packages : [defaultWorkPackage()]; }

```

### app/page.tsx lines 245-270 (TagPicker toggle, MetadataBoard updateFamily + selection control)

```tsx
  const nav: Array<[TopTab, string]> = [["profile", "Profile"], ["library", "Function Library"], ["plan", "Plan & Budgeting"], ["spend", "Spend & Commitments"], ["monitor", "Monitor & Decide"]];
  return <><header className="topbar"><div className="brand-lockup"><div className="brand-mark" aria-hidden="true">FB</div><div><p className="brand-name">Function Budget Studio</p><p className="brand-subtitle">Metadata-first function planning rehearsal</p></div></div><div className="topbar-actions"><span className="device-save"><span className="save-dot" aria-hidden="true" />Saved on this device</span><AppButton kind="quiet" onClick={() => onTab("profile")}>{profile.functionName ? "Profile" : "Profile setup"}</AppButton><AppButton kind="quiet" onClick={onReset}>Reset working data</AppButton></div></header><nav className="studio-nav" aria-label="Studio sections"><div className="studio-nav-group"><span>Go to</span><div className="studio-nav-buttons">{nav.map(([tab, label]) => <button key={tab} type="button" className={active === tab ? "is-active" : ""} aria-current={active === tab ? "page" : undefined} onClick={() => onTab(tab)}>{label}</button>)}</div></div></nav></>;
}

function ProfileScreenLegacy({ data, setData, errors }: { data: StudioData; setData: Dispatch<SetStateAction<StudioData>>; errors: ValidationError[] }) {
  const update = (key: keyof Profile, value: string) => setData((current) => { const profile = { ...current.profile, [key]: value }; const teamMembers = key === "plannerName" && value.trim() && !current.settings.teamMembers.some((member) => member.name === value.trim()) ? [...current.settings.teamMembers, { id: `member-${slug(value)}`, name: value.trim(), role: "Planner" }] : current.settings.teamMembers; return { ...current, profile, settings: { ...current.settings, teamMembers } }; });
  const existing = Boolean(data.profile.functionName || data.profile.plannerName || data.profile.team);
  return <section className="screen-card profile-card"><div className="screen-heading"><div><p className="panel-caption">Profile</p><h1>{existing ? "Working profile" : "Set up your working profile"}</h1><p className="lead">Keep this short: identify the function, the planner, and the team. Switch here anytime without leaving your library or workspace.</p></div></div><div className="field-grid two-col profile-grid"><div className="field field-span-2"><label htmlFor="profile-function"><Label example="Example: Marketing & Brand">Business function</Label></label><div className="preset-row">{presets.map((preset) => <button key={preset} type="button" className={`preset ${data.profile.functionName === preset ? "is-selected" : ""}`} onClick={() => update("functionName", preset)}>{preset}</button>)}</div><input id="profile-function" value={data.profile.functionName} onChange={(event) => update("functionName", event.target.value)} placeholder="Choose a function or type one" /><FieldError message={errors.find((error) => error.key === "profile.functionName")?.message} /></div><div className="field"><label htmlFor="profile-name"><Label example="Your name">Planner name</Label></label><input id="profile-name" value={data.profile.plannerName} onChange={(event) => update("plannerName", event.target.value)} placeholder="Name" /><FieldError message={errors.find((error) => error.key === "profile.plannerName")?.message} /></div><div className="field"><label htmlFor="profile-team"><Label example="Example: Growth and visual merchandising">Team</Label></label><input id="profile-team" value={data.profile.team} onChange={(event) => update("team", event.target.value)} placeholder="Team or sub-function" /><FieldError message={errors.find((error) => error.key === "profile.team")?.message} /></div></div><div className="inline-note"><strong>Device-local only:</strong> the profile is saved on this device and has no production authentication or server persistence.</div></section>;
}

function ProfileScreen({ data, setData, errors }: { data: StudioData; setData: Dispatch<SetStateAction<StudioData>>; errors: ValidationError[] }) {
  const update = (key: keyof Profile, value: string) => setData((current) => ({ ...current, profile: { ...current.profile, [key]: value } }));
  return <section className="screen-card profile-card"><div className="screen-heading"><div><p className="panel-caption">Profile</p><h2>Working profile</h2><p className="lead">Set the planner and team once, then return here from the top-right Profile button whenever they change.</p></div></div><div className="field-grid two-col profile-grid"><div className="field"><label htmlFor="profile-name"><Label example="Your name">Planner name</Label></label><input id="profile-name" value={data.profile.plannerName} onChange={(event) => update("plannerName", event.target.value)} placeholder="Name" /><FieldError message={errors.find((error) => error.key === "profile.plannerName")?.message} /></div><div className="field"><label htmlFor="profile-team"><Label example="Example: Growth and visual merchandising">Team</Label></label><input id="profile-team" value={data.profile.team} onChange={(event) => update("team", event.target.value)} placeholder="Team or sub-function" /><FieldError message={errors.find((error) => error.key === "profile.team")?.message} /></div></div><div className="controlled-preset"><span className="panel-caption">Controlled function preset</span><strong>{data.profile.functionName || "Not selected"}</strong><p>Function presets are metadata controls maintained by the administrator. Select and apply one in Function Library; users cannot rename or edit the preset list here.</p></div><div className="inline-note"><strong>Device-local only:</strong> the planner and team roster are saved on this device and have no production authentication or server persistence.</div></section>;
}

function TagPicker({ data, selected, onChange, label, idPrefix }: { data: StudioData; selected: string[]; onChange: (ids: string[]) => void; label: string; idPrefix: string }) {
  const toggle = (family: TagFamily, valueId: string) => { const has = selected.includes(valueId); if (has && label.startsWith("Project metadata tags") && family.id === "tag-business-intent") return; const next = family.selection === "single" ? selected.filter((id) => tagValueFor(data, id)?.family.id !== family.id) : selected.filter((id) => id !== valueId); if (!has) next.push(valueId); onChange(next); };
  return <fieldset className="tag-picker"><legend>{label}</legend>{data.library.tagFamilies.map((family) => <div className="tag-picker-family" key={family.id}><span className="tag-family-label">{family.name} <em>{family.selection === "multi" ? "multi-select" : "single-select; click again to clear"}</em></span><div className="tag-options">{family.values.map((value) => <label className={`tag-option ${selected.includes(value.id) ? "is-selected" : ""}`} key={value.id}><input id={`${idPrefix}-${value.id}`} type="checkbox" name={`${idPrefix}-${family.id}`} checked={selected.includes(value.id)} onChange={() => toggle(family, value.id)} /><span>{value.name}</span><small>{value.code}</small></label>)}</div></div>)}</fieldset>;
}

function MetadataBoard({ data, setData }: { data: StudioData; setData: Dispatch<SetStateAction<StudioData>> }) {
  const updateFamily = (id: string, patch: Partial<TagFamily>) => setData((current) => { const next = { ...current, library: { ...current.library, tagFamilies: current.library.tagFamilies.map((family) => family.id === id ? { ...family, ...patch } : family) } }; const rekeyed = rekeyProjectIdentifiers(next, next.projects); return { ...next, ...rekeyed }; });
  const updateValue = (familyId: string, valueId: string, patch: Partial<TagValue>) => setData((current) => { const next = { ...current, library: { ...current.library, tagFamilies: current.library.tagFamilies.map((family) => family.id === familyId ? { ...family, values: family.values.map((value) => value.id === valueId ? { ...value, ...patch } : value) } : family) } }; const rekeyed = rekeyProjectIdentifiers(next, next.projects); return { ...next, ...rekeyed }; });
  const addFamily = () => setData((current) => ({ ...current, library: { ...current.library, tagFamilies: [...current.library.tagFamilies, { id: newId("family"), name: "", priority: current.library.tagFamilies.length + 1, includeInProjectId: false, selection: "single", values: [] }] } }));
  const addValue = (familyId: string) => setData((current) => ({ ...current, library: { ...current.library, tagFamilies: current.library.tagFamilies.map((family) => family.id === familyId ? { ...family, values: [...family.values, { id: newId("tag"), name: "", code: "" }] } : family) } }));
  const removeFamily = (familyId: string) => { const family = data.library.tagFamilies.find((candidate) => candidate.id === familyId); if (!family || !confirmRemoval(`the ${family.name || "untitled"} tag family and its references`)) return; setData((current) => { const valueIds = new Set(family.values.map((value) => value.id)); const next = { ...current, library: { ...current.library, tagFamilies: current.library.tagFamilies.filter((candidate) => candidate.id !== familyId), spendingItems: current.library.spendingItems.map((item) => ({ ...item, tagIds: item.tagIds.filter((id) => !valueIds.has(id)) })), outcomes: current.library.outcomes.map((outcome) => ({ ...outcome, tagIds: outcome.tagIds.filter((id) => !valueIds.has(id)) })) }, projects: current.projects.map((project) => ({ ...project, tagIds: project.tagIds.filter((id) => !valueIds.has(id)) })) }; const rekeyed = rekeyProjectIdentifiers(next, next.projects); return { ...next, ...rekeyed }; }); };
```

### app/page.tsx lines 408-420 (addProject defaults)

```tsx
  const visible = data.projects.filter((project) => quarterFilter === "All" || project.spendingQuarters.includes(quarterFilter));
  useEffect(() => { if (!focusProjectId) return; const target = data.projects.find((project) => project.recordId === focusProjectId || project.id === focusProjectId); if (!target) return; const timer = window.setTimeout(() => { setQuarterFilter("All"); setEditingId(target.recordId); setDraft(clone(target)); }, 0); return () => window.clearTimeout(timer); }, [focusProjectId, data.projects]);
  const beginEdit = (project: Project) => { setEditingId(project.recordId); setDraft(clone(project)); setErrors([]); };
  const removeProject = (project: Project) => { if (!confirmRemoval(`${project.id} and its linked document lines`)) return; setData((current) => ({ ...current, projects: current.projects.filter((candidate) => candidate.recordId !== project.recordId), documents: current.documents.map((document) => ({ ...document, lines: document.lines.filter((line) => line.projectId !== project.id) })).filter((document) => document.lines.length > 0) })); setEditingId(null); setDraft(null); setErrors([]); };
  const save = () => { if (!draft) return; const original = data.projects.find((project) => project.recordId === draft.recordId); const nextErrors: ValidationError[] = []; if (!draft.name.trim()) nextErrors.push({ key: "project.name", message: "Add a project name before saving." }); if (!draft.ownerIds.length) nextErrors.push({ key: "project.owner", message: "Select at least one person in charge." }); if (!draft.tagIds.some((tagId) => tagValueFor(data, tagId)?.family.id === "tag-business-intent")) nextErrors.push({ key: "project.businessIntent", message: "Choose one Business intent tag before saving the project." }); const changedFields: string[] = []; if (original) { for (const line of draft.lines) { const before = original.lines.find((candidate) => candidate.id === line.id); if (!before || JSON.stringify({ ...before, adjustmentComment: undefined }) !== JSON.stringify({ ...line, adjustmentComment: undefined })) { changedFields.push(`line.${line.id}`); if (!line.adjustmentComment?.trim()) nextErrors.push({ key: `line.${line.id}.comment`, message: "Add an adjustment comment for this changed spending line." }); } } for (const line of original.lines) if (!draft.lines.some((candidate) => candidate.id === line.id)) changedFields.push(`line.${line.id}.removed`); for (const outcome of draft.outcomes) { const before = original.outcomes.find((candidate) => candidate.id === outcome.id); if (!before || JSON.stringify({ ...before, adjustmentComment: undefined }) !== JSON.stringify({ ...outcome, adjustmentComment: undefined })) { changedFields.push(`outcome.${outcome.id}`); if (!outcome.adjustmentComment?.trim()) nextErrors.push({ key: `outcome.${outcome.id}.comment`, message: "Add an adjustment comment for this changed outcome." }); } } if (JSON.stringify(original.workPackages ?? []) !== JSON.stringify(draft.workPackages ?? [])) changedFields.push("workPackages"); if (draft.approvedAmount !== original.approvedAmount || draft.approvedCurrency !== original.approvedCurrency) { changedFields.push("approvedAmount"); if (!draft.approvedAdjustmentComment?.trim()) nextErrors.push({ key: "project.approvedComment", message: "Add an adjustment comment beside the changed approved amount." }); } if (idPrefix(data, draft.tagIds) !== idPrefix(data, original.tagIds)) changedFields.push("projectId"); }
    if (nextErrors.length) { setErrors(nextErrors); return; }
    setData((current) => { const revision: BudgetRevision = { id: newId("revision"), status: "Proposed", versionType: original ? "Adjustment" : "Original", timestamp: nowIso(), comment: original ? "Saved inline project adjustment." : "Original project proposal saved after review.", lines: clone(draft.lines), outcomes: clone(draft.outcomes), approvedAmount: draft.approvedAmount, approvedCurrency: draft.approvedCurrency, approvedComment: draft.approvedAdjustmentComment ?? "", plannedTotal: projectPlannedReporting(current, draft), changedFields }; const projects = original ? current.projects.map((project) => project.recordId === draft.recordId ? { ...draft, revisions: [...project.revisions, revision], currentRevisionId: revision.id } : project) : [...current.projects, { ...draft, revisions: [...draft.revisions, revision], currentRevisionId: revision.id }]; return { ...current, ...rekeyProjectIdentifiers(current, projects) }; }); setEditingId(null); setDraft(null); setErrors([]); };
  const addProject = () => { const intent = data.library.tagFamilies.find((family) => family.id === "tag-business-intent")?.values[0]?.id; const typeTag = projectTypeFamily(data)?.values[0]?.id; const owner = data.settings.teamMembers[0]?.id; const tags = [intent, typeTag].filter(Boolean) as string[]; const generatedId = nextProjectId(data, tags); const project: Project = { id: generatedId, recordId: newId("record"), generatedId, idSnapshot: projectIdSnapshot(data, tags), name: "", purpose: "", description: "", tagIds: tags, period: data.settings.fiscalPeriod, spendingQuarters: [data.settings.currentQuarter], ownerIds: owner ? [owner] : [], workPackages: [defaultWorkPackage()], lines: [], outcomes: [], approvedAmount: 0, approvedCurrency: data.settings.currency, approvedAdjustmentComment: "", revisions: [], currentRevisionId: undefined }; setEditingId(project.recordId); setDraft(project); setErrors([]); };
  const functionPlanned = data.projects.reduce((sum, project) => sum + projectPlannedReporting(data, project), 0); const functionApproved = data.projects.reduce((sum, project) => sum + approvedReporting(data, project), 0);
  const draftIsNew = Boolean(draft && !data.projects.some((project) => project.recordId === draft.recordId));
  const dismissDraft = () => { if (confirmRemoval("this unsaved project draft")) { setEditingId(null); setDraft(null); setErrors([]); } };
  return <div className="workspace-grid"><section className="workspace-card workspace-span-3"><BudgetSettingsPanel data={data} setData={setData} /></section><section className="workspace-card workspace-span-3"><div className="workspace-card-heading"><div><span className="panel-caption">Planning &amp; Budgeting</span><h2>Function budget first, then project budgets</h2><p className="muted">Projects are the working unit. Requirements can be reusable or project-only, then split across work packages and sourcing allocations.</p></div><div className="button-row"><label className="quarter-filter"><span>Filter by quarter</span><select value={quarterFilter} onChange={(event) => setQuarterFilter(event.target.value as Quarter | "All")}><option>All</option>{QUARTERS.map((quarter) => <option key={quarter}>{quarter}</option>)}</select></label><AppButton kind="primary" onClick={addProject} disabled={validateCoreSetup(data).length > 0}>Add project</AppButton></div></div><div className="metric-grid planning-amounts"><Metric label="Function proposed budget" value={formatMoney(functionPlanned, data.settings.currency)} detail="Sum of current project requirement totals" /><Metric label="Function approved budget" value={formatMoney(functionApproved, data.settings.currency)} detail="Sum of whole-project approved amounts" /></div>{validateCoreSetup(data).length ? <div className="blocking-note"><strong>Core setup required before the first project:</strong> planner, team, controlled function preset, Business intent, and Project type. Reusable item and outcome catalogues are optional.</div> : null}<div className="project-list">{draftIsNew && draft ? <div className="project-card-shell"><ProjectCard data={data} project={draft} editing draft={draft} setDraft={setDraft} setData={setData} onEdit={() => undefined} onCancel={() => { setEditingId(null); setDraft(null); setErrors([]); }} onSave={save} onRemove={dismissDraft} errors={errors} onExpand={() => undefined} expanded={false} /></div> : null}{visible.map((project) => <div className="project-card-shell" key={project.recordId}><ProjectCard data={data} project={project} editing={editingId === project.recordId} draft={editingId === project.recordId ? draft : null} setDraft={setDraft} setData={setData} onEdit={() => beginEdit(project)} onCancel={() => { setEditingId(null); setDraft(null); setErrors([]); }} onSave={save} onRemove={() => removeProject(project)} errors={errors} onExpand={() => setExpanded(expanded === project.recordId ? null : project.recordId)} expanded={expanded === project.recordId} /></div>)}</div>{!visible.length && !draftIsNew ? <div className="empty-state"><strong>No projects match this quarter.</strong><span>Complete core setup, then create a project without first building a spending or outcome catalogue.</span></div> : null}</section><section className="workspace-card workspace-span-3"><div className="inline-note"><strong>Planning control:</strong> Proposed and Approved are authorization states. Original and Adjustment are version properties. Project-only and reusable are metadata states.</div></section></div>;
}
```

## W14-14 — vault parser default project when no file matches

Claim: parseObsidianVaultBundle returns a generic default project (PROJ-0001, Untitled Project, zeros) when no file matches. Jinggru says the branch is unreachable in the app because serializeProjectToObsidianVault always writes 00_Project_Overview.md.

### app/budget-domain.mjs lines 1004-1075 (serializeProjectToObsidianVault, overview file writes)

```js
export function serializeProjectToObsidianVault(projectData = {}) {
  const projection = buildProjectGraphProjection(projectData);
  const projectRow = projection.tables.Project[0] || {
    record_id: "proj-rec-default",
    project_id: "PROJ-0001",
    name: "Untitled Project",
    function_id: "fn-default",
    period: "FY27",
    currency: "USD",
    approved_budget: 0,
    planned_total: 0,
    open_commitment: 0,
    actual_total: 0,
    available_to_commit: 0,
    forecast_spend: 0,
    projected_headroom: 0,
  };

  const projectId = String(projectRow.project_id);
  const projectName = String(projectRow.name);
  const currency = String(projectRow.currency || "USD");
  const workPackages = projection.tables.Work_Packages || [];
  const purchaseItems = projection.tables.Purchase_Items || [];
  const sourcingAllocations = projection.tables.Sourcing_Allocations || [];
  const lifecycleRecords = projection.tables.Lifecycle_Records || [];
  const lifecycleLines = projection.tables.Lifecycle_Lines || [];
  const lifecycleTransitions = projection.tables.Lifecycle_Transitions || [];
  const rawNotes = Array.isArray(projectData.knowledgeNotes || projectData.notes)
    ? projectData.knowledgeNotes || projectData.notes
    : [];

  const vaultMap = {};

  // 1. 00_Project_Overview.md
  const wpLinks = workPackages
    .map(
      (wp) =>
        `- [[${wp.work_package_id}|${wp.name}]] — Planned: ${wp.planned_total} ${currency} (${wp.item_count} item(s))`,
    )
    .join("\n");
  const itemLinks = purchaseItems
    .map(
      (item) =>
        `- [[${item.spending_line_id}|${item.description || item.spending_line_id}]] — GL: \`"${String(item.gl_code || "001230")}"\` · Planned: ${item.planned_total} ${currency}`,
    )
    .join("\n");
  const docLinks = lifecycleRecords
    .map(
      (doc) =>
        `- [[${doc.document_id}|${doc.reference || doc.document_id}]] — ${doc.type} (${doc.vendor || "Vendor"} · ${doc.total_amount} ${doc.currency})`,
    )
    .join("\n");
  const noteLinks = rawNotes
    .map((n, idx) => {
      const nId = String(n.id || n.note_id || `note-${idx + 1}`);
      const nTitle = String(n.title || nId);
      const attachedId = String(n.attachedToId || n.attached_to_id || projectId);
      return `- [[${nId}|${nTitle}]] → Attached to [[${attachedId}]]`;
    })
    .join("\n");

  const periodTag = String(projectRow.period || "fy27")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  vaultMap["00_Project_Overview.md"] = [
    "---",
    "entity_type: Project",
    `record_id: ${projectRow.record_id}`,
    `project_id: ${projectId}`,
    `name: "${projectName.replaceAll('"', '\\"')}"`,
    `function_id: "${String(projectRow.function_id).replaceAll('"', '\\"')}"`,
```

### app/budget-domain.mjs lines 1364-1440 (parseObsidianVaultBundle, default project)

```js
export function parseObsidianVaultBundle(vaultFiles = {}) {
  const normalizedFiles = {};
  if (Array.isArray(vaultFiles)) {
    for (const entry of vaultFiles) {
      if (entry && entry.path) {
        normalizedFiles[String(entry.path)] = String(entry.content ?? "");
      }
    }
  } else if (vaultFiles && typeof vaultFiles === "object") {
    const source =
      vaultFiles.files && typeof vaultFiles.files === "object"
        ? vaultFiles.files
        : vaultFiles;
    for (const [k, v] of Object.entries(source)) {
      if (typeof v === "string") {
        normalizedFiles[k] = v;
      }
    }
  }

  let project = {
    id: "PROJ-0001",
    project_id: "PROJ-0001",
    recordId: "proj-rec-default",
    record_id: "proj-rec-default",
    name: "Untitled Project",
    functionId: "fn-default",
    period: "FY27",
    currency: "USD",
    approvedBudget: 0,
    plannedTotal: 0,
    openCommitment: 0,
    actualTotal: 0,
    availableToCommit: 0,
    forecastSpend: 0,
    projectedHeadroom: 0,
    frontmatter: {},
    wikilinks: [],
    targets: [],
    tags: [],
  };

  const workPackages = [];
  const purchaseItems = [];
  const documents = [];
  const knowledgeNotes = [];
  const allVaultNoteRecords = [];

  for (const [filePath, rawContent] of Object.entries(normalizedFiles)) {
    const parsed = extractWikilinks(rawContent);
    const fm = parsed.frontmatter || {};
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    const body = (fmMatch ? rawContent.slice(fmMatch[0].length) : rawContent).trim();
    const baseName = filePath
      .split("/")
      .pop()
      .replace(/\.md$/i, "");

    allVaultNoteRecords.push({
      id: fm.note_id || fm.spending_line_id || fm.work_package_id || fm.document_id || fm.project_id || baseName,
      title: fm.title || fm.description || fm.name || fm.reference || baseName,
      content: rawContent,
    });

    if (filePath === "00_Project_Overview.md" || fm.entity_type === "Project") {
      const pid = String(fm.project_id || fm.id || baseName);
      project = {
        id: pid,
        project_id: pid,
        recordId: String(fm.record_id || fm.recordId || "proj-rec-default"),
        record_id: String(fm.record_id || fm.recordId || "proj-rec-default"),
        name: String(fm.name || "Untitled Project"),
        functionId: String(fm.function_id || "fn-default"),
        period: String(fm.period || "FY27"),
        currency: String(fm.currency || "USD"),
        approvedBudget: Number(fm.approved_budget ?? 0),
        plannedTotal: Number(fm.planned_total ?? 0),
```

### app/ellies-book-workbench.tsx lines 1255-1270 (caller: obsidianVaultFiles into the parser)

```tsx
    () => buildProjectGraphProjection(projectPayload) as GraphProjectionResult,
    [projectPayload],
  );

  const obsidianVaultFiles = useMemo<Record<string, string>>(
    () => serializeProjectToObsidianVault(projectPayload),
    [projectPayload],
  );

  const parsedVaultBundle = useMemo(
    () => parseObsidianVaultBundle(obsidianVaultFiles),
    [obsidianVaultFiles],
  );

  const syncReceipt = useMemo(
    () => buildHybridSyncReceipt(projectPayload),
```

## W14-15 — buildHybridSyncReceipt item-shape fallback

Claim: rawItems falls back to [] when no purchaseItems/lines key is an array, and [].every(...) is true, so allAllocationsValid can be true with zero validations. Jinggru says every real caller carries purchaseItems as an array and the lines fallback covers the alternate shape.

### app/budget-domain.mjs lines 1559-1610 (buildHybridSyncReceipt)

```js
export function buildHybridSyncReceipt(projectData = {}, options = {}) {
  const projection = buildProjectGraphProjection(projectData);
  const rawProject = projectData.project || projectData;
  const rawItems = Array.isArray(projectData.purchaseItems || rawProject.purchaseItems || rawProject.lines)
    ? projectData.purchaseItems || rawProject.purchaseItems || rawProject.lines
    : [];

  const allocationValidations = rawItems.map((item, idx) => {
    const itemId = String(item.id || item.spending_line_id || `item-${idx + 1}`);
    const check = validateRequirementAllocations(item);
    return {
      spendingLineId: itemId,
      ...check,
    };
  });

  const allAllocationsValid = allocationValidations.every((v) => v.valid);

  const rowCounts = {};
  let totalRows = 0;
  for (const tableName of CANONICAL_TABLE_NAMES) {
    const count = Array.isArray(projection.tables[tableName])
      ? projection.tables[tableName].length
      : 0;
    rowCounts[tableName] = count;
    totalRows += count;
  }

  const canonicalPayload = JSON.stringify({
    tables: projection.tables,
    summary: projection.summary,
  });
  const checksum = computeDeterministicChecksum(canonicalPayload);
  const vault = serializeProjectToObsidianVault(projectData);
  const vaultPaths = Object.keys(vault);

  const mode = options.d1Synced ? "cloud-d1-synced" : "local-first-verified";
  const timestamp = String(options.timestamp || new Date().toISOString());

  return {
    ok: allAllocationsValid,
    status: allAllocationsValid ? "synced" : "validation-error",
    mode,
    checksum,
    timestamp,
    projectId: projection.tables.Project[0]?.project_id || "PROJ-0001",
    rowCounts,
    totalRows,
    allocationValidations,
    allAllocationsValid,
    summary: projection.summary,
    tables: projection.tables,
```

### app/ellies-book-workbench.tsx lines 1225-1300 (projectPayload, triggerHybridSync)

```tsx
        id: activeProject.id,
        name: activeProject.name,
        functionId: data?.profile?.functionName || "Marketing & Brand",
        period: activeProject.period || "FY2027",
        currency,
        approvedAmount: activeProject.approvedAmount,
      },
      workPackages: activeProject.workPackages,
      purchaseItems: enrichedItems,
      budgetVersions: builtVersions,
      lifecycleRecords: projectDocs,
      lifecycleLines: projectDocLines,
      purchaseLinks,
      lifecycleTransitions,
      knowledgeNotes: projectNotes,
      auditEvents: projectAudit,
      viewState: nodeViewState,
    };
  }, [
    activeProject,
    effectiveDocuments,
    currency,
    data?.library?.spendingItems,
    data?.profile?.functionName,
    notes,
    auditEvents,
    nodeViewState,
  ]);

  const projection = useMemo<GraphProjectionResult>(
    () => buildProjectGraphProjection(projectPayload) as GraphProjectionResult,
    [projectPayload],
  );

  const obsidianVaultFiles = useMemo<Record<string, string>>(
    () => serializeProjectToObsidianVault(projectPayload),
    [projectPayload],
  );

  const parsedVaultBundle = useMemo(
    () => parseObsidianVaultBundle(obsidianVaultFiles),
    [obsidianVaultFiles],
  );

  const syncReceipt = useMemo(
    () => buildHybridSyncReceipt(projectPayload),
    [projectPayload],
  );

  const [selectedVaultFile, setSelectedVaultFile] = useState<string>(
    "00_Project_Overview.md",
  );
  const [syncMessage, setSyncMessage] = useState<string>("");
  // Plain-language backup status so Decision 1 (local-first + cloud) is legible:
  // "local" = this change is safe on the device; "cloud" = it is also copied to
  // the shared cloud copy; "working" = a cloud backup is in progress.
  const [syncState, setSyncState] = useState<"local" | "cloud" | "working">(
    "local",
  );

  async function triggerHybridSync() {
    setSyncState("working");
    setSyncMessage("Backing up to the cloud…");
    try {
      // Hybrid Sync Snapshot: push the local-first copy to the shared cloud copy.
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectPayload),
      });
      if (res.ok) {
        const json = await res.json();
        setSyncState("cloud");
        setSyncMessage(
          `Backed up to the cloud. Reference ${json?.receipt?.checksum || syncReceipt.checksum}`,
        );
```

### app/api/sync/route.ts lines 95-115 (GET receipt) and 330-350 (POST receipt)

```ts
    if (db) {
      d1Available = true;
    }
  } catch {
    d1Available = false;
  }

  const projection = buildProjectGraphProjection(DEFAULT_SYNC_PROJECT);
  const receipt = buildHybridSyncReceipt(DEFAULT_SYNC_PROJECT, {
    d1Synced: d1Available,
  });

  return Response.json({
    ok: receipt.ok,
    mode: receipt.mode,
    checksum: receipt.checksum,
    timestamp: receipt.timestamp,
    projectId: receipt.projectId,
    canonicalTables: CANONICAL_TABLE_NAMES,
    rowCounts: receipt.rowCounts,
    totalRows: receipt.totalRows,
---
            .onConflictDoNothing();
        }

        d1Synced = true;
      }
    } catch {
      d1Synced = false;
    }
  }

  const receipt = buildHybridSyncReceipt(payload, { d1Synced });
  const vault = serializeProjectToObsidianVault(payload);

  return Response.json(
    {
      ...receipt,
      vaultFiles: Object.keys(vault),
    },
    { status: receipt.ok ? 200 : 422 },
  );
}
```
