import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CANONICAL_TABLE_NAMES,
  allocatedQuantity,
  allocationSubtotal,
  allocationTotal,
  buildBacklinkIndex,
  buildProjectGraphProjection,
  computeLifecycleLineage,
  createBudgetVersion,
  effectiveApprovedBudget,
  extractWikilinks,
  formatCanonicalTableDelimited,
  formatCanonicalTableMarkdown,
  matchDefinition,
  parseObsidianVaultBundle,
  requirementTotal,
  safeSpreadsheetText,
  serializeProjectToObsidianVault,
  buildHybridSyncReceipt,
  unallocatedQuantity,
  validateRequirementAllocations,
} from "../app/budget-domain.mjs";

const posm = {
  id: "spend-line-posm",
  spendingItemId: "spend-posm",
  itemNameSnapshot: "Shelf tester unit",
  specification: "A4 350 gsm countertop tester stand",
  unitOfMeasure: "unit",
  quantity: 1200,
  unitPrice: 0,
  unitCurrency: "USD",
  quarters: ["Q1", "Q2"],
  workPackageId: "wp-general",
  glCode: "001230",
  allocations: [
    { id: "alloc-1", vendorOrWarehouse: "Shenzhen Print Co", sourceCountry: "CN", sourceType: "External vendor", quantity: 600, unitPrice: 10, additionalCostEstimate: 500, currency: "USD", quarter: "Q1" },
    { id: "alloc-2", vendorOrWarehouse: "Milan Display Hub", sourceCountry: "IT", sourceType: "External vendor", quantity: 400, unitPrice: 11, additionalCostEstimate: 300, currency: "USD", quarter: "Q1" },
    { id: "alloc-3", vendorOrWarehouse: "Singapore Regional Warehouse", sourceCountry: "SG", sourceType: "Internal warehouse", quantity: 200, unitPrice: 2, additionalCostEstimate: 0, currency: "USD", quarter: "Q2" },
  ],
};

test("POSM allocations replace the parent requirement total and reconcile quantity", () => {
  assert.equal(allocationSubtotal(posm.allocations[0]), 6500);
  assert.equal(allocationSubtotal(posm.allocations[1]), 4700);
  assert.equal(allocationSubtotal(posm.allocations[2]), 400);
  assert.equal(allocationTotal(posm.allocations), 11600);
  assert.equal(requirementTotal(posm), 11600);
  assert.equal(allocatedQuantity(posm.allocations), 1200);
  assert.equal(unallocatedQuantity(posm), 0);
  assert.equal(unallocatedQuantity({ ...posm, allocations: posm.allocations.slice(0, 2) }), 200);
});

test("legacy requirements still use quantity multiplied by unit price", () => {
  assert.equal(requirementTotal({ quantity: 10, unitPrice: 25, allocations: [] }), 250);
});

test("definition matching includes aliases and source wording", () => {
  const definition = { name: "Paper table-top stand", aliases: ["POSM stand"], sourceText: "A4 350 gsm" };
  assert.equal(matchDefinition(definition, "posm"), true);
  assert.equal(matchDefinition(definition, "350 gsm"), true);
  assert.equal(matchDefinition(definition, "warehouse"), false);
});

test("spreadsheet formula prefixes are neutralized", () => {
  for (const value of ["=SUM(A1:A2)", "+1", "-1", "@user"]) assert.equal(safeSpreadsheetText(value), `'${value}`);
  assert.equal(safeSpreadsheetText("001230"), "001230");
});

test("validateRequirementAllocations supports partial and exact allocations and blocks over-allocation", () => {
  const partial = validateRequirementAllocations({
    ...posm,
    allocations: posm.allocations.slice(0, 2),
  });
  assert.equal(partial.valid, true);
  assert.equal(partial.allocated, 1000);
  assert.equal(partial.unallocated, 200);
  assert.equal(partial.overAllocatedAmount, 0);
  assert.equal(partial.status, "partial");

  const exact = validateRequirementAllocations(posm);
  assert.equal(exact.valid, true);
  assert.equal(exact.allocated, 1200);
  assert.equal(exact.unallocated, 0);
  assert.equal(exact.overAllocatedAmount, 0);
  assert.equal(exact.status, "exact");

  const overAllocated = validateRequirementAllocations({
    ...posm,
    allocations: [
      ...posm.allocations,
      { id: "alloc-4", quantity: 150, unitPrice: 5, additionalCostEstimate: 0 },
    ],
  });
  assert.equal(overAllocated.valid, false);
  assert.equal(overAllocated.allocated, 1350);
  assert.equal(overAllocated.unallocated, 0);
  assert.equal(overAllocated.overAllocatedAmount, 150);
  assert.equal(overAllocated.status, "over-allocated");
});

test("createBudgetVersion and effectiveApprovedBudget enforce immutable baseline and proposed adjustment boundaries", () => {
  const v1 = createBudgetVersion({
    versionId: "ver-1",
    projectId: "GUC-MU+FRAG-0001",
    sequence: 1,
    versionType: "Original",
    authorizationState: "Approved",
    reason: "Initial POSM rollout baseline",
    purchaseItems: [posm],
  });

  assert.equal(v1.total, 11600);
  assert.equal(v1.versionType, "Original");
  assert.equal(v1.authorizationState, "Approved");
  assert.equal(Object.isFrozen(v1), true);

  const v2Proposed = createBudgetVersion(
    {
      versionId: "ver-2",
      projectId: "GUC-MU+FRAG-0001",
      versionType: "Adjustment",
      authorizationState: "Proposed",
      reason: "Proposed air-freight expedited batch",
      total: 14200,
    },
    [v1],
  );

  assert.equal(v2Proposed.sequence, 2);
  assert.equal(v2Proposed.predecessorId, "ver-1");

  const stateWithProposed = effectiveApprovedBudget([v1, v2Proposed]);
  assert.equal(stateWithProposed.approvedTotal, 11600);
  assert.equal(stateWithProposed.baselineVersionId, "ver-1");
  assert.equal(stateWithProposed.proposedTotal, 14200);
  assert.equal(stateWithProposed.pendingDelta, 2600);

  const v2Approved = createBudgetVersion(
    {
      ...v2Proposed,
      versionId: "ver-3",
      authorizationState: "Approved",
      reason: "Finance approved expedited batch adjustment",
    },
    [v1, v2Proposed],
  );

  const stateAfterApproval = effectiveApprovedBudget([v1, v2Proposed, v2Approved]);
  assert.equal(stateAfterApproval.approvedTotal, 14200);
  assert.equal(stateAfterApproval.baselineVersionId, "ver-3");
  assert.equal(stateAfterApproval.latestProposedVersion, null);
  assert.equal(stateAfterApproval.pendingDelta, 0);
});

test("computeLifecycleLineage converts commitments across Quotation -> PO -> Invoice -> Actual without double counting", () => {
  const poLines = [
    { id: "po-line-1", stage: "PO", amount: 6500, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-1" },
    { id: "po-line-2", stage: "PO", amount: 4700, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-2" },
  ];
  const lifecycleLines = [
    { id: "quote-line-1", stage: "Quotation", amount: 6800, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-1" },
    ...poLines,
    { id: "inv-line-1", stage: "Invoice", amount: 6500, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-1" },
    { id: "inv-line-2", stage: "Invoice", amount: 2000, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-2" },
    { id: "act-line-1", stage: "Actual", amount: 6500, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-1" },
  ];
  const transitions = [
    { id: "tr-1", fromLineId: "quote-line-1", toLineId: "po-line-1", transitionType: "Quotation->PO", convertedAmount: 6500 },
    { id: "tr-2", fromLineId: "po-line-1", toLineId: "inv-line-1", transitionType: "PO->Invoice", convertedAmount: 6500 },
    { id: "tr-3", fromLineId: "inv-line-1", toLineId: "act-line-1", transitionType: "Invoice->Actual", convertedAmount: 6500 },
    { id: "tr-4", fromLineId: "po-line-2", toLineId: "inv-line-2", transitionType: "PO->Invoice", convertedAmount: 2000 },
  ];

  const lineage = computeLifecycleLineage({
    poLines,
    transitions,
    lifecycleLines,
    approvedBudget: 11600,
  });

  // po-line-1 (6500) is fully converted to inv-line-1 (6500) -> act-line-1 (6500): open commitment on po-line-1 is 0
  // po-line-2 (4700) has 2000 converted to inv-line-2: remaining open PO commitment on po-line-2 is 2700
  const po1 = lineage.poLineStatus.find((line) => line.lineId === "po-line-1");
  const po2 = lineage.poLineStatus.find((line) => line.lineId === "po-line-2");
  assert.equal(po1.openCommitment, 0);
  assert.equal(po2.openCommitment, 2700);
  assert.equal(lineage.quotationTotal, 6800);
  assert.equal(lineage.grossPoTotal, 11200);
  assert.equal(lineage.openPoCommitmentTotal, 2700);
  assert.equal(lineage.openInvoiceTotal, 2000);
  assert.equal(lineage.openCommitmentTotal, 4700);
  assert.equal(lineage.actualTotal, 6500);
  assert.equal(lineage.totalRecognizedExposure, 11200);
  assert.equal(lineage.availableToCommit, 400);
});

test("extractWikilinks and buildBacklinkIndex parse [[TargetID|Label]], [[TargetID]], and #tags bidirectionally", () => {
  const note1 = {
    id: "note-sourcing-decision",
    title: "Q1 POSM Sourcing Decision",
    content: [
      "---",
      "author: Planner",
      "status: confirmed",
      "---",
      "Approved [[GUC-MU+FRAG-0001|Gucci Launch Project]] shelf units under [[spend-line-posm]].",
      "Primary vendor batch assigned to [[alloc-1|Shenzhen 600u Batch]] with #posm and #q1-launch tags.",
    ].join("\n"),
  };
  const note2 = {
    id: "note- customs-clearance",
    title: "Milan Customs Update",
    content: "Tracking [[alloc-2]] and [[spend-line-posm|POSM Requirement]] for #posm delivery.",
  };

  const parsed1 = extractWikilinks(note1.content);
  assert.equal(parsed1.frontmatter.author, "Planner");
  assert.equal(parsed1.wikilinks.length, 3);
  assert.deepEqual(
    parsed1.wikilinks.map((link) => ({ target: link.target, label: link.label })),
    [
      { target: "GUC-MU+FRAG-0001", label: "Gucci Launch Project" },
      { target: "spend-line-posm", label: "spend-line-posm" },
      { target: "alloc-1", label: "Shenzhen 600u Batch" },
    ],
  );
  assert.deepEqual(parsed1.tags, ["posm", "q1-launch"]);

  const backlinks = buildBacklinkIndex([note1, note2]);
  assert.equal(backlinks.byTarget["spend-line-posm"].length, 2);
  assert.equal(backlinks.byTarget["GUC-MU+FRAG-0001"].length, 1);
  assert.equal(backlinks.byTarget["alloc-1"][0].label, "Shenzhen 600u Batch");
  assert.equal(backlinks.byTag["posm"].length, 2);
});

test("buildProjectGraphProjection maintains Graph-to-Table equivalence and coordinate invariance", () => {
  const baseProjectData = {
    project: {
      recordId: "proj-rec-1",
      id: "GUC-MU+FRAG-0001",
      name: "Gucci Beauty Counter Launch",
      functionId: "fn-marketing",
      period: "FY27",
      currency: "USD",
      approvedAmount: 11600,
    },
    workPackages: [{ id: "wp-general", name: "General", description: "Default work package" }],
    budgetVersions: [
      createBudgetVersion({
        versionId: "ver-1",
        projectId: "GUC-MU+FRAG-0001",
        sequence: 1,
        versionType: "Original",
        authorizationState: "Approved",
        purchaseItems: [posm],
      }),
    ],
    purchaseItems: [posm],
    lifecycleRecords: [
      { id: "doc-po-1", type: "Purchase order", reference: "PO-2026-001", vendor: "Shenzhen Print Co", date: "2026-10-01", status: "Approved" },
      { id: "doc-inv-1", type: "Invoice", reference: "INV-2026-001", vendor: "Shenzhen Print Co", date: "2026-10-15", status: "Posted" },
    ],
    lifecycleLines: [
      { id: "po-line-1", documentId: "doc-po-1", stage: "PO", amount: 6500, quantity: 600, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-1", spendQuarter: "Q1" },
      { id: "inv-line-1", documentId: "doc-inv-1", stage: "Invoice", amount: 6500, quantity: 600, currency: "USD", spendingLineId: "spend-line-posm", allocationId: "alloc-1", spendQuarter: "Q1" },
    ],
    purchaseLinks: [
      { id: "plink-1", documentLineId: "po-line-1", spendingLineId: "spend-line-posm", allocationId: "alloc-1", attributedQuantity: 600, attributedAmount: 6500, currency: "USD" },
    ],
    lifecycleTransitions: [
      { id: "tr-1", fromLineId: "po-line-1", toLineId: "inv-line-1", transitionType: "PO->Invoice", convertedAmount: 6500, currency: "USD" },
    ],
    knowledgeNotes: [
      { id: "note-1", title: "Launch Note", content: "Linked to [[spend-line-posm|POSM Stand]] and [[alloc-1]] #posm" },
    ],
    auditEvents: [
      { id: "audit-1", actor: "Planner", timestamp: "2026-10-20T00:00:00Z", action: "APPROVE_VERSION", targetId: "ver-1", reason: "Baseline approved" },
    ],
    viewState: {
      "wp-general": { x: 100, y: 120, collapsed: false },
      "spend-line-posm": { x: 320, y: 120, collapsed: false },
    },
  };

  const expandedProjection = buildProjectGraphProjection(baseProjectData);

  // Verify canonical tables match records 1:1
  assert.equal(expandedProjection.tables.Project.length, 1);
  assert.equal(expandedProjection.tables.Work_Packages.length, 1);
  assert.equal(expandedProjection.tables.Budget_Versions.length, 1);
  assert.equal(expandedProjection.tables.Purchase_Items.length, 1);
  assert.equal(expandedProjection.tables.Sourcing_Allocations.length, 3);
  assert.equal(expandedProjection.tables.Lifecycle_Records.length, 2);
  assert.equal(expandedProjection.tables.Lifecycle_Lines.length, 2);
  assert.equal(expandedProjection.tables.Purchase_Links.length, 1);
  assert.equal(expandedProjection.tables.Lifecycle_Transitions.length, 1);
  assert.equal(expandedProjection.tables.Knowledge_Notes.length, 1);
  assert.equal(expandedProjection.tables.Audit_Events.length, 1);

  // Verify all 4 typed edge families are generated
  const edgeTypes = new Set(expandedProjection.edges.map((edge) => edge.type));
  assert.equal(edgeTypes.has("containment"), true);
  assert.equal(edgeTypes.has("purchase_link"), true);
  assert.equal(edgeTypes.has("lifecycle_transition"), true);
  assert.equal(edgeTypes.has("knowledge_backlink"), true);

  // Collapse work package and drag nodes to completely different (x, y) coordinates
  const movedAndCollapsedProjection = buildProjectGraphProjection({
    ...baseProjectData,
    viewState: {
      "wp-general": { x: 9999, y: -4500, collapsed: true },
      "spend-line-posm": { x: 1234, y: 5678, collapsed: true },
    },
  });

  const wpNode = movedAndCollapsedProjection.nodes.find((n) => n.recordId === "wp-general");
  assert.equal(wpNode.mode, "collapsed");
  assert.equal(wpNode.x, 9999);
  assert.equal(wpNode.y, -4500);
  assert.equal(wpNode.financials.plannedTotal, 11600);

  // Prove that changing node coordinates and collapse state NEVER changes financial totals or canonical table rows
  assert.deepEqual(movedAndCollapsedProjection.summary, expandedProjection.summary);
  assert.deepEqual(movedAndCollapsedProjection.tables.Project, expandedProjection.tables.Project);
  assert.deepEqual(movedAndCollapsedProjection.tables.Purchase_Items, expandedProjection.tables.Purchase_Items);
  assert.deepEqual(movedAndCollapsedProjection.tables.Sourcing_Allocations, expandedProjection.tables.Sourcing_Allocations);
  assert.equal(expandedProjection.tables.Purchase_Items[0].gl_code, "001230");
  assert.equal(expandedProjection.tables.Lifecycle_Lines[0].open_commitment, 0);
  assert.equal(expandedProjection.tables.Lifecycle_Lines[1].open_commitment, 6500);
  assert.equal(
    movedAndCollapsedProjection.visibleNodes.some((n) => n.recordId === "spend-line-posm"),
    false,
  );
});

test("db/schema.ts defines all canonical Drizzle SQLite tables from GLOSSARY.md", async () => {
  const schemaSource = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(schemaSource, /from "drizzle-orm\/sqlite-core"/);
  const expectedTables = [
    "businessFunctions",
    "projects",
    "workPackages",
    "budgetVersions",
    "purchaseItems",
    "sourcingAllocations",
    "lifecycleRecords",
    "lifecycleLines",
    "purchaseLinks",
    "lifecycleTransitions",
    "knowledgeNotes",
    "auditEvents",
    "outcomeDefinitions",
    "projectOutcomes",
  ];
  for (const tableName of expectedTables) {
    assert.match(
      schemaSource,
      new RegExp(`export const ${tableName}\\s*=\\s*sqliteTable\\(`),
      `Missing Drizzle sqliteTable definition: ${tableName}`,
    );
  }
});

test("CANONICAL_TABLE_NAMES and canonical table export helpers format Excel-safe TSV, CSV, and Markdown across all 11 tables", () => {
  assert.equal(CANONICAL_TABLE_NAMES.length, 11);
  assert.deepEqual(CANONICAL_TABLE_NAMES, [
    "Project",
    "Work_Packages",
    "Budget_Versions",
    "Purchase_Items",
    "Sourcing_Allocations",
    "Lifecycle_Records",
    "Lifecycle_Lines",
    "Purchase_Links",
    "Lifecycle_Transitions",
    "Knowledge_Notes",
    "Audit_Events",
  ]);

  const projection = buildProjectGraphProjection({
    project: {
      id: "MKT-003",
      name: "FY27 Launch Campaign",
      functionId: "Marketing & Brand",
      period: "FY2027",
      currency: "USD",
      approvedAmount: 11600,
    },
    workPackages: [{ id: "wp-general", name: "=SUM(A1:A2) WP" }],
    purchaseItems: [{ ...posm, glCode: "001230" }],
    lifecycleLines: [
      {
        id: "po-1",
        documentId: "doc-po-1",
        spendingLineId: "spend-line-posm",
        allocationId: "alloc-1",
        stage: "PO",
        amount: 6500,
        currency: "USD",
        spendQuarter: "Q1",
      },
    ],
    knowledgeNotes: [
      {
        id: "note-1",
        projectId: "MKT-003",
        title: "Sourcing Memo",
        content: "Linked to [[spend-line-posm|Shelf tester]] #posm",
      },
    ],
  });

  const tsvSingle = formatCanonicalTableDelimited(
    projection.tables,
    "Purchase_Items",
    "\t",
  );
  assert.match(tsvSingle, /Purchase_Items/);
  assert.match(tsvSingle, /001230/);
  assert.match(tsvSingle, /11600/);

  const csvAll = formatCanonicalTableDelimited(projection.tables, "ALL", ",");
  for (const tableName of CANONICAL_TABLE_NAMES) {
    assert.match(csvAll, new RegExp(tableName));
  }
  // Formula-injection prefix is neutralized with leading apostrophe
  assert.match(csvAll, /'=SUM\(A1:A2\) WP/);

  const mdSingle = formatCanonicalTableMarkdown(
    projection.tables,
    "Sourcing_Allocations",
  );
  assert.match(mdSingle, /## Sourcing_Allocations/);
  assert.match(mdSingle, /Shenzhen Print Co/);
  assert.match(mdSingle, /6500/);
});

test("ElliesBookWorkbench and app/page.tsx wire Dual-Mode Node Graph, Obsidian Vault, 11 Canonical Tables, and 390px-1440px Command Bar without violating rendered-html guards", async () => {
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  // Verify ElliesBookWorkbench is imported and mounted in app/page.tsx
  assert.match(pageSource, /ElliesBookWorkbench/);

  // Verify strict negative regex guards from tests/rendered-html.test.mjs
  for (const src of [pageSource, workbenchSource]) {
    assert.doesNotMatch(src, /Project Items/);
    assert.doesNotMatch(
      src,
      /ProjectTypeDefinition|indicative unit cost|Eligibility|Source route/,
    );
    assert.doesNotMatch(
      src,
      /Your site is taking shape|codex-preview|react-loading-skeleton/i,
    );
  }
  assert.doesNotMatch(workbenchSource, /profile-function/);

  // Verify Wave 2 & Wave 3 architectural pillars in app/ellies-book-workbench.tsx
  assert.match(workbenchSource, /buildProjectGraphProjection/);
  assert.match(workbenchSource, /extractWikilinks/);
  assert.match(workbenchSource, /buildBacklinkIndex/);
  assert.match(workbenchSource, /computeLifecycleLineage/);
  assert.match(workbenchSource, /effectiveApprovedBudget/);
  assert.match(workbenchSource, /CANONICAL_TABLE_NAMES/);
  // Plain-language user journey (approachability redesign): 4 steps a non-finance user can read.
  // Per ADR 0002 the Visual Workflow Map leads the journey, so Overview follows it.
  for (const label of ["1. Workflow map", "2. Overview", "3. Notes", "4. Reports &amp; export", "Quick actions"]) {
    assert.ok(workbenchSource.includes(label), `missing journey label: ${label}`);
  }
  // Developer jargon must not leak into visible UI copy
  assert.doesNotMatch(workbenchSource, /Mode A ·|Mode B ·|Financial Lineage DAG|On-the-Fly Command Bar|Canonical relational table switcher|Attach \[\[Note\]\]/);
  assert.match(workbenchSource, /1\. Operational/);
  assert.match(workbenchSource, /2\. Managerial/);
  assert.match(workbenchSource, /3\. Accounting/);

  // Verify responsive CSS breakpoints and flat hairline KPI strip in app/globals.css
  assert.match(cssSource, /\.eb-workbench/);
  assert.match(cssSource, /\.eb-kpi-strip/);
  assert.match(cssSource, /\.eb-graph-workspace/);
  assert.match(cssSource, /\.eb-command-bar/);
});

test("ElliesBookWorkbench opens on the Visual Workflow Map (graph) as the default landing surface per ADR 0002 (W7-T1), not the Overview table", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  // Graph-first landing surface: the initial journeyStep must be the graph canvas.
  // A regression back to overview-first landing fails this gate.
  assert.match(workbenchSource, /useState<JourneyStep>\("graph"\)/);
  assert.doesNotMatch(workbenchSource, /useState<JourneyStep>\("overview"\)/);
  // The Workflow map must lead the plain-language journey (step 1) and Overview follow (step 2).
  assert.ok(workbenchSource.includes("1. Workflow map"), "Workflow map must be the first journey step");
  assert.ok(workbenchSource.includes("2. Overview"), "Overview must follow the Workflow map");
  // All four surfaces stay reachable in the journey nav.
  for (const label of ["3. Notes", "4. Reports &amp; export"]) {
    assert.ok(workbenchSource.includes(label), `missing journey label: ${label}`);
  }
});

test("serializeProjectToObsidianVault and parseObsidianVaultBundle deterministically round-trip interlinked Obsidian Markdown vault files with 001230 GL codes, [[wikilinks]], #tags, and canonical tables", () => {
  const sampleProjectData = {
    project: {
      recordId: "proj-rec-posm",
      id: "MKT-003",
      name: "FY27 Launch Campaign",
      functionId: "Marketing & Brand",
      period: "FY2027",
      currency: "USD",
      approvedAmount: 11600,
    },
    workPackages: [
      {
        id: "wp-general",
        name: "POSM Production",
        description: "Print and finish countertop stands",
      },
    ],
    purchaseItems: [{ ...posm, glCode: "001230" }],
    lifecycleRecords: [
      {
        id: "doc-po-1",
        type: "Purchase order",
        reference: "PO-2026-001",
        vendor: "Shenzhen Print Co",
        date: "2026-10-01",
        status: "Open commitment",
      },
      {
        id: "doc-inv-1",
        type: "Invoice",
        reference: "INV-2026-001",
        vendor: "Shenzhen Print Co",
        date: "2026-10-15",
        status: "Posted",
      },
    ],
    lifecycleLines: [
      {
        id: "po-line-1",
        documentId: "doc-po-1",
        stage: "PO",
        amount: 6500,
        quantity: 600,
        currency: "USD",
        spendingLineId: "spend-line-posm",
        allocationId: "alloc-1",
        spendQuarter: "Q1",
      },
      {
        id: "inv-line-1",
        documentId: "doc-inv-1",
        stage: "Invoice",
        amount: 6500,
        quantity: 600,
        currency: "USD",
        spendingLineId: "spend-line-posm",
        allocationId: "alloc-1",
        spendQuarter: "Q1",
      },
    ],
    lifecycleTransitions: [
      {
        id: "tr-1",
        fromLineId: "po-line-1",
        toLineId: "inv-line-1",
        transitionType: "PO->Invoice",
        convertedAmount: 6500,
        currency: "USD",
      },
    ],
    knowledgeNotes: [
      {
        id: "note-posm-sourcing",
        projectId: "MKT-003",
        title: "POSM Multi-Country Split Decision",
        attachedToType: "Purchase_Items",
        attachedToId: "spend-line-posm",
        updatedAt: "2026-10-19T10:30:00Z",
        content: [
          "---",
          "author: Visual merchandising lead",
          "status: confirmed",
          "---",
          "Split [[spend-line-posm|Shelf tester unit]] across [[alloc-1|Shenzhen 600u]] and [[alloc-2|Milan 400u]] under [[wp-general|POSM Production]].",
          "#posm #sourcing-split #gl-001230",
        ].join("\n"),
      },
    ],
  };

  const vault = serializeProjectToObsidianVault(sampleProjectData);
  const filePaths = Object.keys(vault);

  assert.equal(filePaths.includes("00_Project_Overview.md"), true);
  assert.equal(filePaths.includes("WorkPackages/wp-general.md"), true);
  assert.equal(filePaths.includes("PurchaseItems/spend-line-posm.md"), true);
  assert.equal(filePaths.includes("Documents/doc-po-1.md"), true);
  assert.equal(filePaths.includes("Documents/doc-inv-1.md"), true);
  assert.equal(filePaths.includes("Notes/note-posm-sourcing.md"), true);

  // Verify 00_Project_Overview.md frontmatter, tables, and [[wikilinks]]
  const overviewMd = vault["00_Project_Overview.md"];
  assert.match(overviewMd, /^---\n[\s\S]*project_id: MKT-003[\s\S]*approved_budget: 11600[\s\S]*---/);
  assert.match(overviewMd, /\[\[wp-general\|POSM Production\]\]/);
  assert.match(overviewMd, /\[\[spend-line-posm\|Shelf tester unit\]\]/);
  assert.match(overviewMd, /\[\[doc-po-1\|PO-2026-001\]\]/);
  assert.match(overviewMd, /\[\[note-posm-sourcing\|POSM Multi-Country Split Decision\]\]/);

  // Verify PurchaseItems/spend-line-posm.md preserves GL code "001230" and 3 perspectives + allocations table
  const itemMd = vault["PurchaseItems/spend-line-posm.md"];
  assert.match(itemMd, /gl_code: "001230"/);
  assert.match(itemMd, /001230/);
  assert.match(itemMd, /Operational View/);
  assert.match(itemMd, /Managerial View/);
  assert.match(itemMd, /Accounting View/);
  assert.match(itemMd, /Shenzhen Print Co/);
  assert.match(itemMd, /\[\[alloc-1\|Shenzhen Print Co\]\]/);

  // Round-trip parse via parseObsidianVaultBundle
  const parsedBundle = parseObsidianVaultBundle(vault);
  assert.equal(parsedBundle.project.id, "MKT-003");
  assert.equal(parsedBundle.project.approvedBudget, 11600);
  assert.equal(parsedBundle.purchaseItems.length, 1);
  assert.equal(parsedBundle.purchaseItems[0].glCode, "001230");
  assert.equal(parsedBundle.knowledgeNotes.length, 1);

  const roundTrippedNote = parsedBundle.knowledgeNotes[0];
  assert.equal(roundTrippedNote.id, "note-posm-sourcing");
  assert.equal(roundTrippedNote.title, "POSM Multi-Country Split Decision");
  assert.equal(roundTrippedNote.attachedToId, "spend-line-posm");
  assert.equal(roundTrippedNote.frontmatter.author, "Visual merchandising lead");
  assert.equal(
    roundTrippedNote.targets.includes("spend-line-posm") &&
      roundTrippedNote.targets.includes("alloc-1") &&
      roundTrippedNote.targets.includes("wp-general"),
    true,
  );
  assert.equal(roundTrippedNote.tags.includes("posm"), true);
  assert.equal(roundTrippedNote.tags.includes("gl-001230"), true);
  assert.equal(
    parsedBundle.backlinkIndex.byTarget["spend-line-posm"].length >= 1,
    true,
  );
});

test("buildHybridSyncReceipt and /api/sync route normalize 11 canonical tables, validate allocations, and return deterministic sync receipts", async () => {
  const payload = {
    project: {
      recordId: "proj-rec-posm",
      id: "MKT-003",
      name: "FY27 Launch Campaign",
      functionId: "Marketing & Brand",
      period: "FY2027",
      currency: "USD",
      approvedAmount: 11600,
    },
    workPackages: [{ id: "wp-general", name: "General" }],
    purchaseItems: [{ ...posm, glCode: "001230" }],
    knowledgeNotes: [
      {
        id: "note-1",
        projectId: "MKT-003",
        title: "Sync Note",
        content: "Linked to [[spend-line-posm]] #sync",
      },
    ],
    viewState: {
      "wp-general": { x: 120, y: 200, collapsed: false },
    },
  };

  const receipt1 = buildHybridSyncReceipt(payload, {
    timestamp: "2026-10-20T08:00:00.000Z",
  });
  const receipt2Moved = buildHybridSyncReceipt(
    {
      ...payload,
      viewState: {
        "wp-general": { x: 8888, y: -3333, collapsed: true },
      },
    },
    {
      timestamp: "2026-10-20T08:00:00.000Z",
    },
  );

  assert.equal(receipt1.ok, true);
  assert.equal(receipt1.mode, "local-first-verified");
  assert.equal(receipt1.timestamp, "2026-10-20T08:00:00.000Z");
  assert.equal(typeof receipt1.checksum, "string");
  assert.equal(receipt1.checksum.length >= 8, true);
  // Checksum is invariant to canvas (x, y) coordinates and collapse state
  assert.equal(receipt1.checksum, receipt2Moved.checksum);

  for (const tableName of CANONICAL_TABLE_NAMES) {
    assert.equal(typeof receipt1.rowCounts[tableName], "number");
  }
  assert.equal(receipt1.rowCounts.Project, 1);
  assert.equal(receipt1.rowCounts.Purchase_Items, 1);
  assert.equal(receipt1.rowCounts.Sourcing_Allocations, 3);
  assert.equal(receipt1.allAllocationsValid, true);

  // Over-allocated requirement fails validation in sync receipt
  const invalidReceipt = buildHybridSyncReceipt({
    ...payload,
    purchaseItems: [
      {
        ...posm,
        quantity: 500, // less than 1200 allocated
      },
    ],
  });
  assert.equal(invalidReceipt.ok, false);
  assert.equal(invalidReceipt.allAllocationsValid, false);
  assert.equal(invalidReceipt.status, "validation-error");

  // Verify app/api/sync/route.ts contract and ElliesBookWorkbench Vault & Sync controls
  const syncRouteSource = await readFile(
    new URL("../app/api/sync/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(syncRouteSource, /export async function GET/);
  assert.match(syncRouteSource, /export async function POST/);
  assert.match(syncRouteSource, /buildProjectGraphProjection/);
  assert.match(syncRouteSource, /validateRequirementAllocations/);
  assert.match(syncRouteSource, /buildHybridSyncReceipt/);
  assert.match(syncRouteSource, /getDb/);

  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workbenchSource, /serializeProjectToObsidianVault/);
  assert.match(workbenchSource, /parseObsidianVaultBundle/);
  assert.match(workbenchSource, /buildHybridSyncReceipt/);
  assert.match(workbenchSource, /\/api\/sync/);
  assert.match(workbenchSource, /00_Project_Overview\.md/);
  // W8-B re-anchor: the "Hybrid Sync Snapshot" phrasing only survives in a code
  // comment now (W7-T5 replaced the visible copy with a plain-language sync
  // affordance), so matching it proved nothing user-facing. Anchor instead to a
  // currently-VISIBLE sync-affordance state string so this guard still fails if
  // the hybrid-sync surface is removed from the UI.
  assert.match(workbenchSource, /Saved here and backed up to the cloud/);
});

test("the Visual Workflow Map exposes a clearly-labeled plain-language dual-mode link lens with an active state and a view-only overlay (W7-T2)", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );

  // The dual-mode lens must exist as pure view state (ADR 0002 Coordinate
  // Invariance): a boolean that only toggles which links the map draws.
  assert.match(workbenchSource, /const \[showNoteLinks, setShowNoteLinks\] = useState<boolean>/);

  // The control must be a labeled, discoverable group with plain-language
  // option labels (one for the structured spending flow, one for the spending
  // flow plus the linked-notes overlay).
  assert.ok(
    workbenchSource.includes("Show on map"),
    "the link lens must carry a plain-language group label",
  );
  assert.ok(
    workbenchSource.includes("Spending flow"),
    "the structured-flow option must use plain language",
  );
  assert.ok(
    workbenchSource.includes("Spending flow + notes"),
    "the knowledge-overlay option must use plain language",
  );

  // A clear active/selected state must be wired for the toggle.
  assert.match(workbenchSource, /className=\{!showNoteLinks \? "is-active" : ""\}/);
  assert.match(workbenchSource, /className=\{showNoteLinks \? "is-active" : ""\}/);
  assert.match(workbenchSource, /aria-pressed=\{!showNoteLinks\}/);

  // The overlay is a lens: the knowledge backlink links render only when on.
  assert.match(workbenchSource, /edge\.type === "knowledge_backlink"[\s\S]*!showNoteLinks/);

  // Developer / finance jargon must NOT leak into the new visible copy.
  assert.doesNotMatch(
    workbenchSource,
    /Mode A ·|Mode B ·|Financial Lineage DAG|On-the-Fly Command Bar|Canonical relational table switcher|Attach \[\[Note\]\]|wikilink overlay|force layout|freeform overlay/,
  );
});

test("residual 'open PO' accounting jargon stays out of the visible chart copy and uses plain language instead (W7-T4)", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );

  // These are the specific UI-chrome strings (inspector label, chart heading,
  // chart legend, aria-label) where "open PO" leaked into primary visible copy.
  // They must be gone. We assert the exact chrome strings rather than a bare
  // global /open PO/ so the guard never trips on the legitimate seed KnowledgeNote
  // content ("...tracked under open PO [[doc-line-po-vn|...]]."), which is in-domain
  // note text a user wrote, not UI chrome.
  //
  // 1. Inspector detail label.
  assert.doesNotMatch(workbenchSource, /label: "Open PO commitment"/);
  // 2. Chart heading visible text.
  assert.doesNotMatch(workbenchSource, /actuals &amp; open PO\b/);
  // 3. Chart legend visible label (plain text node between the swatch and </span>).
  assert.doesNotMatch(workbenchSource, /eb-swatch-open" \/>\s*\n\s*Open PO\b/);
  // 4. aria-label (accessibility copy is user-visible).
  assert.doesNotMatch(workbenchSource, /aria-label="[^"]*Open POs?"/);

  // The plain-language replacements established elsewhere in the app must be present.
  assert.ok(
    workbenchSource.includes('label: "Ordered, not yet paid"'),
    "inspector must use the plain-language label 'Ordered, not yet paid'",
  );
  assert.ok(
    workbenchSource.includes("actuals &amp; ordered, not"),
    "chart heading must use plain-language 'ordered, not yet paid' wording",
  );
  assert.match(
    workbenchSource,
    /aria-label="[^"]*ordered but not yet paid"/,
    "chart aria-label must use plain-language wording",
  );

  // The precise accounting term stays available to auditors in a title/tooltip
  // attribute only (not primary visible text).
  assert.match(workbenchSource, /title: "Open PO commitment"/);
  assert.match(workbenchSource, /title="Open PO"/);

  // The legitimate seed KnowledgeNote content on line 679 must be left intact:
  // it is in-domain note text, not UI chrome.
  assert.match(workbenchSource, /tracked under open PO \[\[doc-line-po-vn\|PO-POSM-2026-01\]\]/);
});

test("the inspector 'Knowledge backlinks' detail row follows the 'Show on map' lens so the drill-down matches the map (W7-T2 consistency)", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );

  // The inspector backlink row must be conditionally included on showNoteLinks,
  // so turning the linked-notes overlay off also removes the backlink count from
  // the drill-down. Pure view state; no financial value changes.
  assert.match(
    workbenchSource,
    /showNoteLinks[\s\S]{0,120}label: "Knowledge backlinks"/,
  );
});

test("the hybrid backup surface shows a plain-language local-vs-cloud affordance (Decision 1 / W7-T5) without finance/dev jargon leaking into the visible copy", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  // Decision 1 is local-first + cloud. The backup surface must carry a view-state
  // flag that distinguishes "saved on this device" from "backed up to the cloud".
  assert.match(
    workbenchSource,
    /useState<"local" \| "cloud" \| "working">/,
  );

  // The plain-language affordance and its three states must be present.
  assert.ok(
    workbenchSource.includes('className="eb-sync-affordance"'),
    "the persistent local-vs-cloud affordance must be rendered",
  );
  assert.ok(
    workbenchSource.includes("Saved on this device"),
    "the local-first state must read in plain language",
  );
  assert.ok(
    workbenchSource.includes("Saved here and backed up to the cloud"),
    "the cloud-synced state must read in plain language",
  );
  assert.ok(
    cssSource.includes(".eb-sync-affordance"),
    "the affordance must be styled so it reads from 390px to 1440px",
  );

  // Raw checksum / snapshot jargon must not appear as primary visible copy.
  // (The accounting-grade term "Hybrid Sync Snapshot" stays in a code comment
  // only; "checksum" surfaces to the user as the plain word "Reference".)
  assert.doesNotMatch(
    workbenchSource,
    /Checksum <code>|Hybrid Sync Snapshot verified/,
  );
});

test("the Overview plan table collapses to a labeled stacked-card layout on small screens (W8-A, ADR 0002 Pillar 3)", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  // Every plan-table cell must carry a plain-language data-label so the
  // card-mode ::before pseudo-element has a label to render. These labels match
  // the column headers; they are view metadata, not financial values.
  for (const label of [
    'data-label="Item"',
    'data-label="Supplier"',
    'data-label="Quarter"',
    'data-label="Quantity × price"',
    'data-label="Total"',
    'data-label="Status"',
  ]) {
    assert.ok(
      workbenchSource.includes(label),
      `plan-table cell is missing ${label} for the card-mode label`,
    );
  }

  // The card-mode layout must exist at the mobile breakpoint: each cell becomes
  // a labeled line built from its data-label, and the now-redundant header row
  // is hidden. This guard fails if a regression drops the mobile layout.
  assert.match(cssSource, /@media \(max-width: 680px\)/);
  assert.match(cssSource, /\.eb-plan-table td::before\s*\{[\s\S]*?content:\s*attr\(data-label\)/);
  // The redundant header row must be visually removed in card mode.
  assert.match(cssSource, /\.eb-plan-table thead\s*\{[\s\S]*?(position:\s*absolute|display:\s*none)/);
});

test("Wave 10 WS-A: the hidden sample/practice toggle is removed, a left-rail Sample data / Developer button loads the sample dataset, and the default landing is blank (ADR 0006 Decision 5)", async () => {
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  // Training-mode plumbing must be gone from app/page.tsx: no Mode type, no
  // training localStorage keys, no TrainingScreen, no setTrainingData state.
  assert.doesNotMatch(pageSource, /type Mode =/);
  assert.doesNotMatch(pageSource, /TRAINING_KEY|LEGACY_TRAINING_KEY/);
  assert.doesNotMatch(pageSource, /TrainingScreen|setTrainingData|trainingData/);
  assert.doesNotMatch(pageSource, /mode === "training"/);

  // The default landing is a clean blank workspace built from blankData(), and
  // the workbench mounts the working data only (no mode prop, no training
  // dataset switch).
  assert.match(pageSource, /useState<StudioData>\(blankData\)/);
  assert.doesNotMatch(pageSource, /<ElliesBookWorkbench[\s\S]*?\bmode=\{/);

  // The Sample data / Developer loader exists and seeds the existing sampleData().
  assert.match(pageSource, /const loadSampleData = \(\) => \{[\s\S]*?setData\(sampleData\(\)\)/);
  assert.match(pageSource, /onLoadSampleData=\{loadSampleData\}/);

  // The workbench accepts the loader prop and renders ONE clearly-labelled
  // left-rail button that calls it.
  assert.match(workbenchSource, /onLoadSampleData\?: \(\) => void/);
  assert.ok(
    workbenchSource.includes("Sample data / Developer"),
    "the left rail must carry the Sample data / Developer button",
  );
  assert.match(workbenchSource, /onLoadSampleData\(\)/);

  // The workbench no longer takes a `mode` prop, so the sidebar footer must not
  // print "· {mode} mode" anymore; the plain device-save state stays.
  assert.doesNotMatch(workbenchSource, /\{mode\} mode/);
  assert.ok(
    workbenchSource.includes("Saved on this device"),
    "the sidebar footer must keep the plain-language saved state",
  );

  // ADR 0006 Decision 1 & 2: the palette and type tokens live in :root as the
  // single source of truth.
  for (const token of [
    "--eb-ground:",
    "--eb-sheet:",
    "--eb-surface:",
    "--eb-ink:",
    "--eb-muted:",
    "--eb-line:",
    "--eb-accent:",
    "--eb-accent-ink:",
    "--eb-step-small:",
    "--eb-step-body:",
    "--eb-step-lead:",
    "--eb-step-h1:",
  ]) {
    assert.ok(cssSource.includes(token), `globals.css :root is missing ${token}`);
  }

  // ADR 0006 Decision 5: "Start a new project" is a discoverable primary action.
  assert.ok(
    workbenchSource.includes("Start a new project"),
    "the workspace must surface a dominant 'Start a new project' action",
  );

  // The guarded plain-language journey labels and order stay intact.
  for (const label of ["1. Workflow map", "2. Overview", "3. Notes", "4. Reports &amp; export"]) {
    assert.ok(workbenchSource.includes(label), `missing journey label: ${label}`);
  }
});

test("Wave 12 WS-A: the ADR 0008 dark --eb-* token set + the interaction model live in the shell (dark ground, status + canvas tokens, raised active-space marker, reusable top in-surface tab-row scaffold)", async () => {
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );

  // ADR 0008 Decision 1: the dark ground ramp is the single source of truth.
  // --eb-ground must be the near-black value, not the old light #f6f7f8.
  assert.match(cssSource, /--eb-ground:\s*#060910/);
  assert.doesNotMatch(cssSource, /--eb-ground:\s*#f6f7f8/);
  // A soft near-white ink, never pure #fff (dark legibility rule).
  assert.match(cssSource, /--eb-ink:\s*#e8ecf4/);

  // ADR 0008 Decision 1/3: the status semantics + canvas-only luminous tokens
  // are DEFINED in :root for WS-B to consume. (Defining them here does not
  // apply them to any shell chrome.)
  for (const token of [
    "--eb-raised:",
    "--eb-status-go:",
    "--eb-status-alert:",
    "--eb-status-warn:",
    "--eb-status-idle:",
    "--eb-node-glow:",
    "--eb-edge-go:",
    "--eb-edge-alert:",
    "--eb-edge-idle:",
  ]) {
    assert.ok(cssSource.includes(token), `globals.css :root is missing the ADR 0008 token ${token}`);
  }

  // ADR 0008 Decision 2: the type scale is unchanged (13/16/20/24).
  assert.match(cssSource, /--eb-step-small:\s*0\.8125rem/);
  assert.match(cssSource, /--eb-step-body:\s*1rem/);
  assert.match(cssSource, /--eb-step-lead:\s*1\.25rem/);
  assert.match(cssSource, /--eb-step-h1:\s*1\.5rem/);

  // ADR 0008 Decision 8 / interaction-spec §2.2: the active SPACE marker is a
  // raised brightness step, not a glow/gradient.
  assert.match(cssSource, /\.eb-nav-item\.is-active\s*\{[\s\S]*?background:\s*var\(--eb-raised\)/);

  // ADR 0008 Decision 8 / interaction-spec §2.1-§2.2: a reusable TOP in-surface
  // tab-row scaffold exists for surfaces with sub-views, with ONE 2px accent
  // underline as the active marker (WS-C wires the Reports switcher to it).
  assert.ok(cssSource.includes(".eb-surface-tabs"), "globals.css must provide the .eb-surface-tabs scaffold");
  assert.match(
    cssSource,
    /\.eb-surface-tab\.is-active\s*\{[\s\S]*?border-bottom-color:\s*var\(--accent\)/,
  );

  // The shell chrome stays frozen for B/C/D: the graph-first default and the
  // guarded shell CSS classes survive the re-theme.
  assert.match(workbenchSource, /useState<JourneyStep>\("graph"\)/);
  for (const klass of [".eb-workbench", ".eb-kpi-strip", ".eb-graph-workspace", ".eb-command-bar"]) {
    assert.match(cssSource, new RegExp(klass.replace(".", "\\.")));
  }
});

test("Wave 12 WS-B: the dark node-graph canvas hero — status node cards + badges, status gradient flow edges, right-docked controls, and a bottom-right mini-map — is wired without touching node geometry or the domain engine (ADR 0008 Decisions 3/4/6/7/8, ADR 0002 Coordinate Invariance)", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const directionSource = await readFile(
    new URL("../.taste-skill/direction.json", import.meta.url),
    "utf8",
  );
  const engineSource = await readFile(
    new URL("../app/budget-domain.mjs", import.meta.url),
    "utf8",
  );

  // ADR 0008 Decision 3: node status is DERIVED from projection financials for
  // DISPLAY only (never a new domain field). The derivation maps to the four
  // status roles; idle is the resting state, not green.
  assert.match(workbenchSource, /function deriveNodeStatus\(/);
  assert.match(workbenchSource, /type CanvasStatus = "go" \| "alert" \| "warn" \| "idle"/);
  // The derivation reads values already on the node, never mutates them.
  assert.match(workbenchSource, /node\.financials/);
  assert.match(workbenchSource, /eb-node-status-badge/);
  assert.match(workbenchSource, /data-status=\{nodeStatus\}/);

  // ADR 0008 Decision 1/3: the node card is the dark luminous card carrying the
  // canvas-only glow token + a muted subtitle, and the status badge rides the
  // status hue (idle is the grey resting state, never green).
  assert.match(cssSource, /\.eb-graph-node\s*\{[\s\S]*?box-shadow:\s*var\(--eb-node-glow\)/);
  assert.match(cssSource, /\.eb-node-subtitle\s*\{/);
  assert.match(cssSource, /\.eb-node-status-badge-go\s*\{[\s\S]*?background:\s*var\(--eb-status-go\)/);
  assert.match(cssSource, /\.eb-node-status-badge-idle\s*\{[\s\S]*?background:\s*var\(--eb-status-idle\)/);

  // ADR 0008 Decision 4: edges are status-coloured gradient ribbons; the per-edge
  // stroke is a status gradient derived from the target node (the money flows in).
  assert.match(workbenchSource, /linearGradient[\s\S]*?id="eb-edge-grad-go"/);
  assert.match(workbenchSource, /stroke=\{`url\(#eb-edge-grad-\$\{edgeStatus\}\)`\}/);
  assert.match(workbenchSource, /deriveNodeStatus\(targetNode\)/);
  // The bezier geometry stays computed from node pixel coordinates (view state).
  assert.match(workbenchSource, /const pathD\s*=/);
  // The knowledge_backlink overlay STAYS gated on showNoteLinks (lens unchanged).
  assert.match(
    workbenchSource,
    /edge\.type === "knowledge_backlink" &&\s*!showNoteLinks/,
  );

  // ADR 0008 Decision 8: the control cluster re-docks to the RIGHT edge as a
  // vertical stack, keeping the existing zoom/fit/reset actions.
  assert.match(cssSource, /\.eb-canvas-controls\s*\{[\s\S]*?position:\s*absolute[\s\S]*?flex-direction:\s*column/);
  for (const action of ["Fit to selected", "Fit to all", "Reset view"]) {
    assert.ok(workbenchSource.includes(action), `the right-docked controls must keep "${action}"`);
  }

  // ADR 0008 Decision 8 / UI-spec §2.4: a NEW bottom-right mini-map with a
  // viewport rectangle + a scale slider, driven by pure view state (pan/zoom).
  assert.match(workbenchSource, /className="eb-minimap"/);
  assert.match(workbenchSource, /eb-minimap-viewport/);
  assert.match(workbenchSource, /centerPanOnMinimapPoint/);
  assert.match(cssSource, /\.eb-minimap\s*\{[\s\S]*?position:\s*absolute[\s\S]*?bottom:\s*14px[\s\S]*?right:\s*14px/);
  // The mini-map writes PAN only; it never writes node x/y.
  assert.match(workbenchSource, /setPan\(\{\s*x: vw \/ 2 - worldX \* zoom/);

  // ADR 0008 Decision 7 (THE CRUX): the scoped canvas allow-list is committed
  // and waives exactly the four canvas rules; the data surfaces run NO waivers.
  const direction = JSON.parse(directionSource);
  assert.equal(direction.kind, "app");
  assert.deepEqual(
    [...direction.allow].sort(),
    ["glass", "gradient", "heavy-shadow", "icon-chips"],
  );

  // ADR 0002 Coordinate Invariance: the re-theme is view/presentation only. The
  // pure domain engine carries NO status-badge/gradient/mini-map presentation.
  assert.doesNotMatch(engineSource, /deriveNodeStatus|eb-node-status|eb-minimap|eb-edge-grad/);
});

test("Wave 12 WS-D: Setup + Notes on the dark theme — common business intent as the dominant element over flat per-team definition panels, a calm document reading pane (16px/1.6/~70ch) with accent-lift wikilink/tag pills that keep their jump/filter behaviour, and NO glow/gradient on any Setup or notes class (ADR 0008 Decision 5, UI-spec Stage-3/Stage-5)", async () => {
  const pageSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  const markdownSource = await readFile(
    new URL("../app/markdown-render.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const engineSource = await readFile(
    new URL("../app/budget-domain.mjs", import.meta.url),
    "utf8",
  );

  // UI-spec Stage-5: Setup states ONE common business intent as the dominant
  // element at the top; per-team tailored definitions read as flat panels
  // beneath. The dominant intent is a single h1 on a capped measure.
  assert.match(pageSource, /className="setup-intent"/);
  assert.match(pageSource, /Common business intent/);
  assert.match(pageSource, /className="setup-intent-fact"/);
  assert.match(cssSource, /\.setup-intent h1\s*\{[\s\S]*?font-size:\s*var\(--eb-step-h1\)/);
  assert.match(cssSource, /\.setup-intent-lead\s*\{[\s\S]*?max-width:\s*70ch/);
  // The per-team tailored definitions are flat tone-step panels, no shadow.
  assert.match(cssSource, /\.definition-card[\s\S]*?background:\s*var\(--eb-sheet\)/);

  // ADR 0008 Decision 5 (Setup forms): real form fields KEEP borders and read
  // on dark (a bordered surface field, never a hardcoded light fill), and the
  // focus ring is the accent (the global focus-visible rule).
  assert.match(cssSource, /input, select, textarea \{[\s\S]*?border:\s*1px solid var\(--line-strong\)[\s\S]*?background:\s*var\(--surface\)/);
  assert.doesNotMatch(
    cssSource.match(/\.choice-card\s*\{[^}]*\}/)?.[0] ?? "",
    /background:\s*white/,
    "Setup field classes must not carry a hardcoded white fill on dark",
  );

  // UI-spec Stage-3: the Notes reading pane renders authored markdown as a
  // DOCUMENT (not a raw dump). The render path stays in markdown-render.tsx and
  // the inline parsing stays in the PURE engine (extractWikilinks UNCHANGED).
  assert.match(workbenchSource, /renderMarkdownDocument\(/);
  assert.match(workbenchSource, /className="eb-md-document"/);
  assert.match(markdownSource, /export function renderMarkdownDocument/);
  assert.match(engineSource, /export function extractWikilinks/);
  assert.doesNotMatch(markdownSource, /function extractWikilinks/); // not re-defined outside the engine

  // Stage-3: body 16px / 1.6 leading, measure capped ~70ch, ink on --eb-sheet.
  assert.match(cssSource, /\.eb-markdown-preview\s*\{[\s\S]*?font-size:\s*var\(--eb-step-body\)[\s\S]*?line-height:\s*1\.6/);
  assert.match(cssSource, /\.eb-md-document\s*\{[\s\S]*?max-width:\s*70ch/);
  // Headings collapse onto 24/20/16, never a fifth reading size.
  assert.match(cssSource, /\.eb-md-h1\s*\{[\s\S]*?font-size:\s*var\(--eb-step-h1\)/);
  assert.match(cssSource, /\.eb-md-h2\s*\{[\s\S]*?font-size:\s*var\(--eb-step-lead\)/);
  assert.match(cssSource, /\.eb-md-h3\s*\{[\s\S]*?font-size:\s*var\(--eb-step-body\)/);

  // Stage-3 / UI-spec §2.3: the wikilink/tag pills are the ONLY colour in the
  // calm document; they LIFT to the full accent on hover/focus and KEEP their
  // jump (jumpToNode) / tag-filter behaviour (onClick wiring, CSS-only lift).
  assert.match(markdownSource, /className="eb-wikilink-pill"[\s\S]*?onClick=\{\(\) => handlers\.onWikilink\(target\)\}/);
  assert.match(markdownSource, /className="eb-tag-pill"[\s\S]*?onClick=\{\(\) => handlers\.onTag\(tag\)\}/);
  assert.match(workbenchSource, /onWikilink:\s*\(target\) => jumpToNode\(target\)/);
  assert.match(cssSource, /\.eb-wikilink-pill:hover,\s*\.eb-wikilink-pill:focus-visible\s*\{[\s\S]*?background:\s*var\(--accent\)/);
  assert.match(cssSource, /\.eb-tag-pill:hover,\s*\.eb-tag-pill:focus-visible\s*\{[\s\S]*?background:\s*var\(--accent\)/);

  // ADR 0008 Decision 5 (THE CRUX): Setup + Notes run inspect.mjs --app with NO
  // waivers, so NO glow/gradient/resting-shadow/glass on ANY Setup or notes
  // class. Scan the owned class families and assert none carries a banned prop.
  const wsdClassBlocks = cssSource.match(
    /\.(?:setup-intent[a-z- .:>()]*|definition-[a-z-]+|tag-(?:board|column[a-z- .:>()]*|picker[a-z- .:>()]*|option[a-z- .:]*)|library-[a-z-]+|eb-md-[a-z-]+|eb-markdown-[a-z-]+|eb-vault-[a-z-]+|eb-wikilink-pill[a-z- .:,]*|eb-tag-pill[a-z- .:,]*|status-(?:positive|negative|pending|muted))\s*\{[^}]*\}/g,
  ) || [];
  assert.ok(wsdClassBlocks.length > 0, "WS-D Setup/notes CSS blocks must exist to scan");
  for (const block of wsdClassBlocks) {
    assert.doesNotMatch(block, /linear-gradient|radial-gradient/, `WS-D Setup/notes class must carry no gradient: ${block.slice(0, 60)}`);
    assert.doesNotMatch(block, /box-shadow\s*:(?!\s*none)/, `WS-D Setup/notes class must carry no resting shadow: ${block.slice(0, 60)}`);
    assert.doesNotMatch(block, /backdrop-filter/, `WS-D Setup/notes class must carry no glass blur: ${block.slice(0, 60)}`);
  }
});

test("Wave 12 WS-C: the data-surface legibility pass — KPI big-number + micro-sparkline (never a tinted icon tile), dark-legible tables (no zebra, tabular right-aligned, pale-tint status pills, lightness-step hover/selection), and the Reports switcher wired to the WS-A .eb-surface-tabs top tab row — adds NO glow/gradient to any data class (ADR 0008 Decision 5, UI-spec Stage-2/Stage-4)", async () => {
  const workbenchSource = await readFile(
    new URL("../app/ellies-book-workbench.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const engineSource = await readFile(
    new URL("../app/budget-domain.mjs", import.meta.url),
    "utf8",
  );

  // ADR 0008 Decision 5: each KPI reads as a BIG NUMBER + tiny label + optional
  // micro-sparkline. The sparkline carries data (per-quarter series); it is NOT
  // a tinted icon tile. The markup + its data classes must exist.
  assert.match(workbenchSource, /renderSparkline\(/);
  assert.match(workbenchSource, /className="eb-sparkline"/);
  assert.match(workbenchSource, /eb-sparkline-bar/);
  assert.match(cssSource, /\.eb-sparkline\s*\{/);
  assert.match(cssSource, /\.eb-sparkline-bar\s*\{/);
  // The sparkline series are PRESENTATION views of already-computed quarter
  // figures; the pure engine must NOT learn any KPI-sparkline presentation.
  assert.doesNotMatch(engineSource, /eb-sparkline|renderSparkline|kpiSpendSeries|kpiRemainingSeries/);

  // ADR 0008 Decision 5 / UI-spec Stage-2: the ONE headline figure leads at the
  // h1/lead scale; KPI figures are right-aligned tabular numbers (16-40px, so
  // the lead figure uses the 24px h1 step, never a >=48px display size).
  assert.match(cssSource, /\.eb-kpi-lead \.eb-kpi-figure\s*\{[\s\S]*?font-size:\s*var\(--eb-step-h1\)/);
  assert.match(cssSource, /\.eb-kpi-figure\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums[\s\S]*?text-align:\s*right/);

  // UI-spec §2.3 / Stage-2: table row hover is ONE lightness step (surface-2),
  // never a fill flip; the selected row takes the quiet accent fill, so hover
  // and selection never collide.
  assert.match(cssSource, /\.eb-clickable-row:hover\s*\{[\s\S]*?background:\s*var\(--surface-2\)/);
  assert.match(cssSource, /\.eb-clickable-row\.is-selected[\s\S]*?background:\s*var\(--eb-accent-soft\)/);
  assert.match(workbenchSource, /selectedNodeId === row\.id \? "is-selected" : ""/);

  // ADR 0008 Decision 5: table status pills are a PALE TINT of the status hue,
  // scoped to the data tables, with readable hue-tinted text. No full-saturation
  // fills on the data surface.
  assert.match(cssSource, /\.eb-plan-table \.status-positive,[\s\S]*?background:\s*rgba\(34, 197, 94/);
  assert.match(cssSource, /\.eb-plan-table \.status-negative,[\s\S]*?background:\s*rgba\(239, 68, 68/);

  // ADR 0008 Decision 8 / UI-spec §2.1-§2.2 (Stage-4): the Reports canonical-
  // table switcher is wired to the WS-A .eb-surface-tabs top tab row (ONE 2px
  // accent underline), so picking a table is one obvious click.
  assert.match(workbenchSource, /className="eb-surface-tabs eb-table-switcher"/);
  assert.match(workbenchSource, /className=\{`eb-surface-tab eb-table-tab \$\{activeTable === tName \? "is-active" : ""\}`\}/);

  // ADR 0008 Decision 5 (THE CRUX for data): NO glow/gradient/resting shadow on
  // ANY WS-C data class, so the data surfaces pass inspect.mjs --app with NO
  // waivers. Assert the WS-C data-class block carries none of the banned props.
  const dataClassBlocks = cssSource.match(
    /\.eb-(?:kpi-[a-z-]*|sparkline[a-z-]*|plan-table[a-z- .:>()]*|relational-table[a-z- .:>()]*|table-switcher|clickable-row[a-z- .:]*)\s*\{[^}]*\}/g,
  ) || [];
  assert.ok(dataClassBlocks.length > 0, "WS-C data-class CSS blocks must exist to scan");
  for (const block of dataClassBlocks) {
    assert.doesNotMatch(block, /linear-gradient|radial-gradient/, `WS-C data class must carry no gradient: ${block.slice(0, 60)}`);
    assert.doesNotMatch(block, /box-shadow\s*:(?!\s*none)/, `WS-C data class must carry no resting shadow: ${block.slice(0, 60)}`);
    assert.doesNotMatch(block, /backdrop-filter/, `WS-C data class must carry no glass blur: ${block.slice(0, 60)}`);
  }
});

