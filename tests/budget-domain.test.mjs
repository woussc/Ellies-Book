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

test("W13-D1: db/schema.ts adds multi-tenant workspace tables + workspace_id scoping, and the D1 migration covers all 16 tables", async () => {
  const schemaSource = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  // The two new workspace tables must be exported Drizzle tables.
  for (const tableName of ["workspaces", "workspaceMembers"]) {
    assert.match(
      schemaSource,
      new RegExp(`export const ${tableName}\\s*=\\s*sqliteTable\\(`),
      `Missing Drizzle sqliteTable definition: ${tableName}`,
    );
  }
  assert.match(schemaSource, /sqliteTable\("workspaces"/);
  assert.match(schemaSource, /sqliteTable\("workspace_members"/);
  assert.match(schemaSource, /references\(\(\) => workspaces\.workspaceId\)/);
  // workspace_id scoping must exist on exactly businessFunctions + projects,
  // defaulted so local-first single-user rows keep working unchanged.
  const scopedColumns = schemaSource.match(
    /workspaceId: text\("workspace_id"\)\.notNull\(\)\.default\("ws-local-default"\)/g,
  ) ?? [];
  assert.equal(scopedColumns.length, 2, "workspace_id must scope businessFunctions and projects");

  // The migration must carry CREATE TABLE IF NOT EXISTS for all 16 tables
  // plus the tenant-scoped project index, so a fresh D1 apply matches the schema.
  const migration = await readFile(
    new URL("../db/migrations/0001_canonical_and_workspaces.sql", import.meta.url),
    "utf8",
  );
  for (const tableName of [
    "business_functions",
    "projects",
    "work_packages",
    "budget_versions",
    "purchase_items",
    "sourcing_allocations",
    "lifecycle_records",
    "lifecycle_lines",
    "purchase_links",
    "lifecycle_transitions",
    "knowledge_notes",
    "audit_events",
    "outcome_definitions",
    "project_outcomes",
    "workspaces",
    "workspace_members",
  ]) {
    assert.match(
      migration,
      new RegExp(`CREATE TABLE IF NOT EXISTS \`${tableName}\``),
      `Migration is missing CREATE TABLE for: ${tableName}`,
    );
  }
  assert.match(migration, /CREATE INDEX IF NOT EXISTS `projects_workspace_id_record_id_idx`/);
});

test("W13-D2: /api/sync resolves workspace context, upserts idempotently, guards tenant + checksum, and hydrates GET from D1", async () => {
  const routeSource = await readFile(
    new URL("../app/api/sync/route.ts", import.meta.url),
    "utf8",
  );

  // Gate 2: the resolver reads all three auth inputs and falls back to the
  // local default workspace — no login wall for local-first use.
  assert.match(routeSource, /export function resolveSyncContext\(request\?: Request\)/);
  assert.match(routeSource, /Cf-Access-Authenticated-User-Email/);
  assert.match(routeSource, /X-Ellie-Workspace-Id/);
  assert.match(routeSource, /Authorization/);
  assert.match(routeSource, /workspaceId: "ws-local-default"/);
  assert.match(routeSource, /authenticatedMode: "local-anonymous"/);
  assert.match(routeSource, /REQUIRE_WORKSPACE_AUTH/);

  // Gate 2: a project id owned by another workspace is refused, not overwritten.
  assert.match(routeSource, /error: "workspace-mismatch"/);
  assert.match(routeSource, /status: 403/);

  // Gate 3: checksum-guarded optimistic upsert — If-Match-Checksum is checked
  // against the stored snapshot, and a mismatch returns 409 + server checksum.
  assert.match(routeSource, /If-Match-Checksum/);
  assert.match(routeSource, /error: "checksum-mismatch"/);
  assert.match(routeSource, /serverChecksum/);
  assert.match(routeSource, /status: 409/);

  // Exactly the 10 mutable tables upsert; the workspace row, budget versions,
  // and both audit-event inserts stay onConflictDoNothing (append-only).
  const upserts = routeSource.match(/\.onConflictDoUpdate\(/g) ?? [];
  assert.equal(upserts.length, 10, "exactly 10 mutable tables must upsert");
  const doNothings = routeSource.match(/\.onConflictDoNothing\(/g) ?? [];
  assert.equal(doNothings.length, 4, "workspaces + budgetVersions + 2 audit inserts must not upsert");
  assert.match(
    routeSource,
    /\.insert\(projects\)[\s\S]{0,1200}?\.onConflictDoUpdate\(/,
  );
  assert.match(
    routeSource,
    /\.insert\(purchaseItems\)[\s\S]{0,1200}?\.onConflictDoUpdate\(/,
  );
  assert.doesNotMatch(
    routeSource,
    /\.insert\(budgetVersions\)[\s\S]{0,1200}?\.onConflictDoUpdate\(/,
  );
  assert.doesNotMatch(
    routeSource,
    /\.insert\(auditEvents\)[\s\S]{0,1200}?\.onConflictDoUpdate\(/,
  );

  // Every sync writes under the resolved workspace, and each sync appends one
  // fresh SYNC audit row carrying the payload checksum as its source ref.
  assert.match(routeSource, /workspaceId: ctx\.workspaceId/);
  assert.match(routeSource, /action: "SYNC"/);
  assert.match(routeSource, /sourceRef: preReceipt\.checksum/);
  assert.match(routeSource, /crypto\.randomUUID\(\)/);

  // GET hydrates from D1 when a stored project matches workspace + record id,
  // and falls back to the default project otherwise.
  assert.match(routeSource, /export async function GET\(request\?: Request\)/);
  assert.match(routeSource, /searchParams\.get\("workspaceId"\)/);
  assert.match(routeSource, /searchParams\.get\("projectId"\)/);
  assert.match(routeSource, /loadStoredProjectPayload\(db, workspaceId, recordId\)/);
  assert.match(routeSource, /hydrated/);

  // Coordinate Invariance (ADR 0002): projections and receipts still come
  // only from the pure domain engine, never from stored coordinates.
  assert.match(routeSource, /buildProjectGraphProjection\(payload\)/);
  assert.match(routeSource, /buildHybridSyncReceipt\(payload/);
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

  // Verify the unchanged server-side sync contract (no v1 cloud UI).
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

});

test("QA baseline F1: a LifecycleTransition never reduces the Open Commitment of a PO line on a different spending line", () => {
  const lineage = computeLifecycleLineage({
    approvedBudget: 24000,
    lifecycleLines: [
      { id: "po-groceries", stage: "PO", amount: 380, spendingLineId: "line-groceries" },
      { id: "act-utilities", stage: "Actual", amount: 120, spendingLineId: "line-utilities" },
    ],
    transitions: [
      { id: "tr-wrong", fromLineId: "po-groceries", toLineId: "act-utilities", transitionType: "PO->Actual", convertedAmount: 120 },
    ],
  });

  const groceries = lineage.poLineStatus.find((line) => line.lineId === "po-groceries");
  assert.equal(groceries.openCommitment, 380);
  assert.equal(groceries.status, "open");
  assert.equal(lineage.actualTotal, 120);
  assert.equal(lineage.openCommitmentTotal, 380);
  // Available to Commit = Approved Budget - Actuals - Open Commitments
  assert.equal(lineage.availableToCommit, 24000 - 120 - 380);
});
