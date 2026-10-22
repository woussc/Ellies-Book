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
  assert.match(workbenchSource, /Hybrid Sync Snapshot/);
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

