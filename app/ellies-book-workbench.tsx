"use client";

import {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  useMemo,
  useState,
} from "react";
import {
  CANONICAL_TABLE_NAMES,
  allocatedQuantity,
  allocationSubtotal,
  buildBacklinkIndex,
  buildProjectGraphProjection,
  computeLifecycleLineage,
  createBudgetVersion,
  effectiveApprovedBudget,
  extractWikilinks,
  formatCanonicalTableDelimited,
  formatCanonicalTableMarkdown,
  requirementTotal,
  safeSpreadsheetText,
  unallocatedQuantity,
  validateRequirementAllocations,
} from "./budget-domain.mjs";

export type WorkbenchQuarter = "Q1" | "Q2" | "Q3" | "Q4";

export type WorkbenchAllocation = {
  id: string;
  sourceType:
    | "External vendor"
    | "Internal warehouse"
    | "Local replenishment"
    | "Existing inventory"
    | "Other";
  vendorOrWarehouse: string;
  sourceCountry: string;
  sourceLocation: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  quarter: WorkbenchQuarter;
  priceBasis: string;
  additionalCostEstimate: number;
  notes: string;
  financeMappingStatus: "Suggested" | "Confirmed" | "Needs Finance review";
  suggestedFinanceCode?: string;
  confirmedFinanceCode?: string;
  mappingRationale: string;
  linkedDocumentId?: string;
  linkedDocumentLineId?: string;
};

export type WorkbenchSpendLine = {
  id: string;
  spendingItemId: string;
  itemNameSnapshot?: string;
  specification?: string;
  unitOfMeasure?: string;
  sourceText?: string;
  quantity: number;
  unitPrice: number;
  unitCurrency: string;
  quarters: WorkbenchQuarter[];
  workPackageId?: string;
  allocations?: WorkbenchAllocation[];
  adjustmentComment?: string;
  glCode?: string;
};

export type WorkbenchWorkPackage = {
  id: string;
  name: string;
  description?: string;
  tagIds: string[];
};

export type WorkbenchOutcome = {
  id: string;
  outcomeDefinitionId: string;
  outcomeNameSnapshot?: string;
  baseline: string;
  target: string;
  current: string;
  accountableOwner: string;
  adjustmentComment?: string;
};

export type WorkbenchRevision = {
  id: string;
  status: "Proposed" | "Adjusted" | "Approved";
  versionType?: "Original" | "Adjustment";
  timestamp: string;
  comment: string;
  lines: WorkbenchSpendLine[];
  outcomes: WorkbenchOutcome[];
  approvedAmount: number;
  approvedCurrency: string;
  approvedComment: string;
  plannedTotal: number;
  changedFields: string[];
};

export type WorkbenchProject = {
  id: string;
  recordId: string;
  generatedId: string;
  idSnapshot?: string;
  name: string;
  purpose: string;
  description: string;
  tagIds: string[];
  period: string;
  spendingQuarters: WorkbenchQuarter[];
  ownerIds: string[];
  legacyOwner?: string;
  workPackages?: WorkbenchWorkPackage[];
  lines: WorkbenchSpendLine[];
  outcomes: WorkbenchOutcome[];
  approvedAmount: number;
  approvedCurrency: string;
  approvedAdjustmentComment?: string;
  revisions: WorkbenchRevision[];
  currentRevisionId?: string;
};

export type WorkbenchDocumentLine = {
  id: string;
  projectId: string;
  spendingLineId: string;
  allocationId?: string;
  description: string;
  amount: number;
  currency: string;
  spendQuarter: WorkbenchQuarter;
  sourceDocumentId?: string;
  sourceDocumentLineId?: string;
  quantity?: number;
};

export type WorkbenchDocument = {
  id: string;
  type: "Quotation" | "Purchase order" | "Invoice";
  fileName: string;
  reference: string;
  projectId?: string;
  date: string;
  vendor: string;
  status: string;
  source?: "Synthetic" | "Local upload";
  lines: WorkbenchDocumentLine[];
};

export type KnowledgeNoteItem = {
  id: string;
  projectId: string;
  title: string;
  attachedToType: string;
  attachedToId: string;
  content: string;
  updatedAt: string;
};

export type AuditEventItem = {
  id: string;
  projectId: string;
  actor: string;
  timestamp: string;
  action: string;
  targetId: string;
  reason: string;
  sourceRef: string;
};

export type NodeCanvasView = {
  x: number;
  y: number;
  collapsed: boolean;
};

type CanonicalTableName =
  | "Project"
  | "Work_Packages"
  | "Budget_Versions"
  | "Purchase_Items"
  | "Sourcing_Allocations"
  | "Lifecycle_Records"
  | "Lifecycle_Lines"
  | "Purchase_Links"
  | "Lifecycle_Transitions"
  | "Knowledge_Notes"
  | "Audit_Events";

type ProjectedNode = {
  id: string;
  recordId: string;
  nodeType: CanonicalTableName;
  label: string;
  mode: "collapsed" | "expanded";
  x: number;
  y: number;
  hiddenByCollapse?: boolean;
  financials: {
    plannedTotal?: number;
    approvedBudget?: number;
    openCommitment?: number;
    actualTotal?: number;
    childCount?: number;
    allocatedQuantity?: number;
    unallocatedQuantity?: number;
    quantity?: number;
    amount?: number;
  };
};

type ProjectedEdge = {
  id: string;
  type:
    | "containment"
    | "purchase_link"
    | "lifecycle_transition"
    | "knowledge_backlink";
  source: string;
  target: string;
  label: string;
  metadata?: Record<string, unknown>;
};

type GraphProjectionResult = {
  nodes: ProjectedNode[];
  visibleNodes: ProjectedNode[];
  edges: ProjectedEdge[];
  tables: Record<CanonicalTableName, Array<Record<string, unknown>>>;
  summary: {
    plannedTotal: number;
    approvedBudget: number;
    quotationTotal: number;
    grossPoTotal: number;
    openPoCommitmentTotal: number;
    openInvoiceTotal: number;
    openCommitmentTotal: number;
    actualTotal: number;
    availableToCommit: number;
    uncommittedPlannedCost: number;
    forecastSpend: number;
    projectedHeadroom: number;
    currency: string;
  };
  backlinkIndex: {
    byTarget: Record<
      string,
      Array<{
        noteId: string;
        noteTitle: string;
        target: string;
        label: string;
        raw: string;
        tags: string[];
      }>
    >;
    byNote: Record<
      string,
      {
        noteId: string;
        title: string;
        outgoingTargets: string[];
        wikilinks: Array<{ target: string; label: string; raw: string }>;
        tags: string[];
        frontmatter: Record<string, string>;
      }
    >;
    byTag: Record<string, string[]>;
    edges: ProjectedEdge[];
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WorkbenchStudioData = Record<string, any> & {
  profile: { functionName: string; plannerName: string; team: string };
  settings: {
    currency: string;
    fiscalPeriod: string;
    currentQuarter: WorkbenchQuarter;
    teamMembers: Array<{ id: string; name: string; role: string }>;
  };
  library: {
    spendingItems: Array<{
      id: string;
      name: string;
      glCode: string;
      financeDescription: string;
      mappingStatus: "Confirmed" | "Needs Finance review";
      unitOfMeasure?: string;
      specification?: string;
      scope?: string;
    }>;
    outcomes: Array<{
      id: string;
      name: string;
      definition: string;
      unit: string;
      measurementWindow: string;
    }>;
  };
  projects: WorkbenchProject[];
  documents: WorkbenchDocument[];
};

const QUARTERS: WorkbenchQuarter[] = ["Q1", "Q2", "Q3", "Q4"];

const SEED_PROJECTS: WorkbenchProject[] = [
  {
    id: "MKT-003",
    recordId: "record-mkt-003",
    generatedId: "GUC-MU+FRAG-0001",
    idSnapshot: "1:Brand house=Gucci(GUC) | 2:Product category=Make-up(MU)+Perfume(FRAG)",
    name: "FY27 Launch Campaign",
    purpose: "Coordinate a traceable POSM launch across sourcing allocations.",
    description:
      "Synthetic POSM launch scenario: one requirement split across China, Vietnam, and a European warehouse.",
    tagIds: ["tag-intent-growth", "tag-campaign", "tag-gucci", "tag-makeup", "tag-perfume"],
    period: "FY2027",
    spendingQuarters: ["Q1", "Q2"],
    ownerIds: ["member-growth", "member-vm"],
    workPackages: [
      {
        id: "wp-posm-production",
        name: "POSM production",
        description: "Print and finish the paper table-top stands.",
        tagIds: ["tag-gucci"],
      },
      {
        id: "wp-warehouse",
        name: "Warehouse distribution",
        description: "Move finished units into regional stock.",
        tagIds: ["tag-channel"],
      },
      {
        id: "wp-installation",
        name: "Installation and execution",
        description: "Install and verify launch counter units.",
        tagIds: ["tag-store"],
      },
    ],
    lines: [
      {
        id: "line-paper-stand",
        spendingItemId: "spend-project-paper-stand",
        itemNameSnapshot: "Paper table-top stand",
        specification: "A4, 350 gsm FSC countertop stand",
        unitOfMeasure: "units",
        sourceText: "Paper table-top stand A4 350 gsm",
        quantity: 1200,
        unitPrice: 0,
        unitCurrency: "USD",
        quarters: ["Q1", "Q2"],
        workPackageId: "wp-posm-production",
        glCode: "001230",
        allocations: [
          {
            id: "alloc-china",
            sourceType: "External vendor",
            vendorOrWarehouse: "China vendor",
            sourceCountry: "China",
            sourceLocation: "Shenzhen",
            quantity: 600,
            unitPrice: 10,
            currency: "USD",
            quarter: "Q1",
            priceBasis: "Ex works",
            additionalCostEstimate: 500,
            notes: "Batch 1 print run with freight buffer",
            financeMappingStatus: "Confirmed",
            suggestedFinanceCode: "001230",
            confirmedFinanceCode: "001230",
            mappingRationale: "POSM print production GL 001230 confirmed.",
          },
          {
            id: "alloc-vietnam",
            sourceType: "External vendor",
            vendorOrWarehouse: "Vietnam vendor",
            sourceCountry: "Vietnam",
            sourceLocation: "Ho Chi Minh City",
            quantity: 400,
            unitPrice: 11,
            currency: "USD",
            quarter: "Q1",
            priceBasis: "Ex works",
            additionalCostEstimate: 300,
            notes: "Secondary regional batch",
            financeMappingStatus: "Suggested",
            suggestedFinanceCode: "001230",
            mappingRationale: "Rules-based suggestion from POSM precedent.",
          },
          {
            id: "alloc-eu",
            sourceType: "Internal warehouse",
            vendorOrWarehouse: "European warehouse",
            sourceCountry: "Germany",
            sourceLocation: "Dusseldorf",
            quantity: 200,
            unitPrice: 2,
            currency: "USD",
            quarter: "Q2",
            priceBasis: "Transfer price",
            additionalCostEstimate: 0,
            notes: "Internal stock drawdown",
            financeMappingStatus: "Needs Finance review",
            suggestedFinanceCode: "001230",
            mappingRationale: "Internal warehouse handling requires Finance review.",
          },
        ],
        adjustmentComment: "",
      },
    ],
    outcomes: [
      {
        id: "project-kpi-posm",
        outcomeDefinitionId: "kpi-shelf",
        outcomeNameSnapshot: "Shelf execution coverage",
        baseline: "60",
        target: "90",
        current: "78",
        accountableOwner: "Visual merchandising lead",
        adjustmentComment: "",
      },
    ],
    approvedAmount: 11600,
    approvedCurrency: "USD",
    approvedAdjustmentComment: "Initial project approval for synthetic POSM scenario.",
    revisions: [
      {
        id: "ver-posm-1",
        status: "Approved",
        versionType: "Original",
        timestamp: "2026-08-15T09:00:00.000Z",
        comment: "Original approved baseline; allocation totals replace parent estimate.",
        lines: [],
        outcomes: [],
        approvedAmount: 11600,
        approvedCurrency: "USD",
        approvedComment: "Approved baseline.",
        plannedTotal: 11600,
        changedFields: [],
      },
    ],
    currentRevisionId: "ver-posm-1",
  },
  {
    id: "MKT-001",
    recordId: "record-mkt-001",
    generatedId: "MKT-001",
    name: "Q3 Demand Pilot",
    purpose: "Test a focused demand-generation motion with traceable spend.",
    description: "Bounded Q3/Q4 paid media and shelf tester pilot.",
    tagIds: ["tag-intent-growth", "tag-campaign", "tag-gucci"],
    period: "FY2026",
    spendingQuarters: ["Q3", "Q4"],
    ownerIds: ["member-growth"],
    workPackages: [
      {
        id: "wp-demand-media",
        name: "Paid distribution & POSM",
        description: "Campaign media and counter tester deployment.",
        tagIds: [],
      },
    ],
    lines: [
      {
        id: "line-paid",
        spendingItemId: "spend-media",
        itemNameSnapshot: "Paid media package",
        specification: "Q3 social & search flight",
        unitOfMeasure: "package",
        quantity: 1,
        unitPrice: 350,
        unitCurrency: "USD",
        quarters: ["Q3"],
        workPackageId: "wp-demand-media",
        glCode: "001245",
        allocations: [],
      },
      {
        id: "line-posm",
        spendingItemId: "spend-posm",
        itemNameSnapshot: "Shelf tester unit",
        specification: "Countertop acrylic tester",
        unitOfMeasure: "units",
        quantity: 10,
        unitPrice: 100,
        unitCurrency: "USD",
        quarters: ["Q4"],
        workPackageId: "wp-demand-media",
        glCode: "001230",
        allocations: [],
      },
    ],
    outcomes: [
      {
        id: "project-kpi-1",
        outcomeDefinitionId: "kpi-pipeline",
        outcomeNameSnapshot: "Qualified pipeline contribution",
        baseline: "35",
        target: "55",
        current: "46",
        accountableOwner: "Growth lead",
      },
    ],
    approvedAmount: 2250,
    approvedCurrency: "USD",
    revisions: [
      {
        id: "rev-mkt-1",
        status: "Approved",
        versionType: "Original",
        timestamp: "2026-06-10T09:00:00.000Z",
        comment: "Initial approved baseline.",
        lines: [],
        outcomes: [],
        approvedAmount: 2250,
        approvedCurrency: "USD",
        approvedComment: "Approved.",
        plannedTotal: 1100,
        changedFields: [],
      },
      {
        id: "rev-mkt-2",
        status: "Proposed",
        versionType: "Adjustment",
        timestamp: "2026-07-02T09:00:00.000Z",
        comment: "Expanded paid media package after planning review.",
        lines: [],
        outcomes: [],
        approvedAmount: 2250,
        approvedCurrency: "USD",
        approvedComment: "Pending adjustment review.",
        plannedTotal: 1350,
        changedFields: ["line-paid.unitPrice"],
      },
    ],
    currentRevisionId: "rev-mkt-2",
  },
];

const SEED_DOCUMENTS: WorkbenchDocument[] = [
  {
    id: "doc-quote-posm",
    type: "Quotation",
    fileName: "quotation-posm-fy27.pdf",
    reference: "QTE-POSM-2026-01",
    date: "2026-08-18",
    vendor: "China vendor",
    status: "Received",
    source: "Synthetic",
    lines: [
      {
        id: "doc-line-q-paper",
        projectId: "MKT-003",
        spendingLineId: "line-paper-stand",
        allocationId: "alloc-china",
        description: "Paper table-top stand · Shenzhen 600u quote",
        amount: 6500,
        quantity: 600,
        currency: "USD",
        spendQuarter: "Q1",
      },
      {
        id: "doc-line-q-vn",
        projectId: "MKT-003",
        spendingLineId: "line-paper-stand",
        allocationId: "alloc-vietnam",
        description: "Paper table-top stand · Ho Chi Minh 400u quote",
        amount: 4700,
        quantity: 400,
        currency: "USD",
        spendQuarter: "Q1",
      },
    ],
  },
  {
    id: "doc-po-posm",
    type: "Purchase order",
    fileName: "po-posm-fy27.pdf",
    reference: "PO-POSM-2026-01",
    date: "2026-08-25",
    vendor: "China & Vietnam Print Partners",
    status: "Open commitment",
    source: "Synthetic",
    lines: [
      {
        id: "doc-line-po-china",
        projectId: "MKT-003",
        spendingLineId: "line-paper-stand",
        allocationId: "alloc-china",
        description: "PO Batch 1 · Shenzhen 600u",
        amount: 6500,
        quantity: 600,
        currency: "USD",
        spendQuarter: "Q1",
        sourceDocumentId: "doc-quote-posm",
        sourceDocumentLineId: "doc-line-q-paper",
      },
      {
        id: "doc-line-po-vn",
        projectId: "MKT-003",
        spendingLineId: "line-paper-stand",
        allocationId: "alloc-vietnam",
        description: "PO Batch 2 · Ho Chi Minh 400u",
        amount: 4700,
        quantity: 400,
        currency: "USD",
        spendQuarter: "Q1",
        sourceDocumentId: "doc-quote-posm",
        sourceDocumentLineId: "doc-line-q-vn",
      },
    ],
  },
  {
    id: "doc-inv-posm",
    type: "Invoice",
    fileName: "invoice-posm-shenzhen.pdf",
    reference: "INV-POSM-2026-01",
    date: "2026-09-14",
    vendor: "China vendor",
    status: "Posted to Actuals",
    source: "Synthetic",
    lines: [
      {
        id: "doc-line-inv-china",
        projectId: "MKT-003",
        spendingLineId: "line-paper-stand",
        allocationId: "alloc-china",
        description: "Invoice settled · Shenzhen 600u delivered",
        amount: 6500,
        quantity: 600,
        currency: "USD",
        spendQuarter: "Q1",
        sourceDocumentId: "doc-po-posm",
        sourceDocumentLineId: "doc-line-po-china",
      },
    ],
  },
];

const INITIAL_NOTES: KnowledgeNoteItem[] = [
  {
    id: "note-posm-sourcing",
    projectId: "MKT-003",
    title: "POSM Multi-Country Split Decision",
    attachedToType: "Purchase_Items",
    attachedToId: "line-paper-stand",
    updatedAt: "2026-10-19T10:30:00Z",
    content: [
      "---",
      "author: Visual merchandising lead",
      "status: confirmed",
      "gl_precedent: 001230",
      "---",
      "Split [[line-paper-stand|Paper table-top stand (1,200u)]] across three fulfilment nodes under [[wp-posm-production|POSM Production]]:",
      "- Primary print batch: [[alloc-china|Shenzhen Vendor (600u @ $6,500)]] settled via [[doc-line-inv-china|INV-POSM-2026-01]].",
      "- Secondary print batch: [[alloc-vietnam|Vietnam Vendor (400u @ $4,700)]] tracked under open PO [[doc-line-po-vn|PO-POSM-2026-01]].",
      "- Regional buffer: [[alloc-eu|Dusseldorf Warehouse (200u @ $400)]] awaiting Finance GL confirmation.",
      "#posm #sourcing-split #q1-launch #gl-001230",
    ].join("\n"),
  },
  {
    id: "note-customs-audit",
    projectId: "MKT-003",
    title: "Q1 Freight & Customs Reconciliation",
    attachedToType: "Sourcing_Allocations",
    attachedToId: "alloc-vietnam",
    updatedAt: "2026-10-19T14:15:00Z",
    content: [
      "---",
      "author: Marketing operations",
      "status: review",
      "---",
      "Confirmed that [[doc-line-po-china]] converted fully into [[doc-line-inv-china]], leaving $0 open commitment on the China batch.",
      "Remaining open commitment for [[MKT-003|FY27 Launch Campaign]] is $4,700 on [[alloc-vietnam|Ho Chi Minh 400u]].",
      "#audit #commitment-lineage #posm",
    ].join("\n"),
  },
  {
    id: "note-demand-pilot",
    projectId: "MKT-001",
    title: "Q3 Demand Pilot Pacing Memo",
    attachedToType: "Project",
    attachedToId: "MKT-001",
    updatedAt: "2026-10-18T09:00:00Z",
    content: [
      "---",
      "author: Growth lead",
      "status: active",
      "---",
      "Reviewing [[MKT-001|Q3 Demand Pilot]] paid media line [[line-paid]] and counter testers [[line-posm]].",
      "#demand-pilot #q3-review",
    ].join("\n"),
  },
];

const INITIAL_AUDIT_EVENTS: AuditEventItem[] = [
  {
    id: "audit-init-1",
    projectId: "MKT-003",
    actor: "Planner",
    timestamp: "2026-08-15T09:00:00Z",
    action: "APPROVE_BASELINE_VERSION",
    targetId: "ver-posm-1",
    reason: "Approved Original baseline ($11,600.00 USD) across 3 sourcing allocations",
    sourceRef: "QTE-POSM-2026-01",
  },
  {
    id: "audit-init-2",
    projectId: "MKT-003",
    actor: "Finance Controller",
    timestamp: "2026-09-14T16:20:00Z",
    action: "CONVERT_PO_TO_ACTUAL",
    targetId: "doc-line-inv-china",
    reason: "Converted $6,500.00 from PO-POSM-2026-01 to INV-POSM-2026-01 without double counting",
    sourceRef: "INV-POSM-2026-01",
  },
];

function money(value: number, currency = "USD") {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency || "USD"} ${safe.toFixed(2)}`;
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const NODE_TYPE_META: Record<
  CanonicalTableName,
  { badge: string; toneClass: string; columnTitle: string }
> = {
  Project: { badge: "Project", toneClass: "eb-node-project", columnTitle: "1 · Project" },
  Work_Packages: {
    badge: "Work Package",
    toneClass: "eb-node-wp",
    columnTitle: "2 · Work Package",
  },
  Budget_Versions: {
    badge: "Budget Version",
    toneClass: "eb-node-version",
    columnTitle: "Version",
  },
  Purchase_Items: {
    badge: "Purchase Item",
    toneClass: "eb-node-item",
    columnTitle: "3 · Purchase Item",
  },
  Sourcing_Allocations: {
    badge: "Sourcing Allocation",
    toneClass: "eb-node-alloc",
    columnTitle: "4 · Sourcing Split",
  },
  Lifecycle_Records: {
    badge: "Document Header",
    toneClass: "eb-node-doc",
    columnTitle: "Document",
  },
  Lifecycle_Lines: {
    badge: "Lifecycle Line",
    toneClass: "eb-node-lifecycle",
    columnTitle: "5 · Quote / PO / Actual",
  },
  Purchase_Links: {
    badge: "Purchase Link",
    toneClass: "eb-node-link",
    columnTitle: "Attribution Link",
  },
  Lifecycle_Transitions: {
    badge: "Transition",
    toneClass: "eb-node-transition",
    columnTitle: "Conversion",
  },
  Knowledge_Notes: {
    badge: "[[Knowledge Note]]",
    toneClass: "eb-node-note",
    columnTitle: "Obsidian Vault Note",
  },
  Audit_Events: {
    badge: "Audit Event",
    toneClass: "eb-node-audit",
    columnTitle: "Audit Log",
  },
};

export function ElliesBookWorkbench({
  data,
  setData,
  mode,
}: {
  data: WorkbenchStudioData;
  setData: Dispatch<SetStateAction<WorkbenchStudioData>>;
  mode: "working" | "training";
}) {
  // Active Pillar Tab: Surface 1 (Node Graph & Vault) vs Surface 2 (Modular Tables & Charts)
  const [surface, setSurface] = useState<"graph" | "tables">("graph");
  // Within Surface 1: Mode A (Financial DAG) vs Mode B (Obsidian Knowledge Vault)
  const [graphMode, setGraphMode] = useState<"dag" | "obsidian">("dag");
  // Responsive Outline Fallback toggle for mobile (390px) or keyboard accessibility
  const [outlineFallback, setOutlineFallback] = useState<boolean>(false);

  // Active Project Selection
  const effectiveProjects = useMemo<WorkbenchProject[]>(() => {
    if (Array.isArray(data?.projects) && data.projects.length > 0) {
      return data.projects;
    }
    return SEED_PROJECTS;
  }, [data?.projects]);

  const effectiveDocuments = useMemo<WorkbenchDocument[]>(() => {
    if (Array.isArray(data?.documents) && data.documents.length > 0) {
      return data.documents;
    }
    return SEED_DOCUMENTS;
  }, [data?.documents]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("MKT-003");
  const activeProject = useMemo<WorkbenchProject>(() => {
    return (
      effectiveProjects.find(
        (p) => p.id === selectedProjectId || p.recordId === selectedProjectId,
      ) ?? effectiveProjects[0]
    );
  }, [effectiveProjects, selectedProjectId]);

  // View State: Node coordinates (x, y), zoom, pan, and collapse state (strictly view metadata)
  const [nodeViewState, setNodeViewState] = useState<Record<string, NodeCanvasView>>({
    "MKT-003": { x: 28, y: 110, collapsed: false },
    "wp-posm-production": { x: 265, y: 50, collapsed: false },
    "wp-warehouse": { x: 265, y: 205, collapsed: false },
    "wp-installation": { x: 265, y: 340, collapsed: false },
    "line-paper-stand": { x: 510, y: 80, collapsed: false },
    "alloc-china": { x: 760, y: 34, collapsed: false },
    "alloc-vietnam": { x: 760, y: 170, collapsed: false },
    "alloc-eu": { x: 760, y: 306, collapsed: false },
    "doc-line-q-paper": { x: 1020, y: 24, collapsed: false },
    "doc-line-po-china": { x: 1020, y: 126, collapsed: false },
    "doc-line-inv-china": { x: 1020, y: 228, collapsed: false },
    "doc-line-po-vn": { x: 1020, y: 330, collapsed: false },
    "note-posm-sourcing": { x: 510, y: 315, collapsed: false },
    "note-customs-audit": { x: 760, y: 425, collapsed: false },
  });

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Obsidian Knowledge Notes & Audit Trail State
  const [notes, setNotes] = useState<KnowledgeNoteItem[]>(INITIAL_NOTES);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>(INITIAL_AUDIT_EVENTS);

  // Selected Node in Inspector Drawer
  const [selectedNodeId, setSelectedNodeId] = useState<string>("line-paper-stand");
  const [inspectorViewTab, setInspectorViewTab] = useState<
    "operational" | "managerial" | "accounting"
  >("operational");

  // Obsidian Editor Active Note & Tag Filter
  const [activeNoteId, setActiveNoteId] = useState<string>("note-posm-sourcing");
  const [activeTagFilter, setActiveTagFilter] = useState<string>("all");

  // Surface 2: Active Canonical Table & Search Filter
  const [activeTable, setActiveTable] = useState<CanonicalTableName>("Purchase_Items");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [exportBanner, setExportBanner] = useState<string>("");

  // Quick Action Modals / Inline Drawers
  const [quickCaptureOpen, setQuickCaptureOpen] = useState<
    null | "item" | "allocation" | "version" | "note" | "expense"
  >(null);
  const [quickItemName, setQuickItemName] = useState<string>("");
  const [quickItemSpec, setQuickItemSpec] = useState<string>("Counter display unit");
  const [quickItemQty, setQuickItemQty] = useState<number>(200);
  const [quickItemPrice, setQuickItemPrice] = useState<number>(12);
  const [quickItemGl, setQuickItemGl] = useState<string>("001230");

  const [quickAllocVendor, setQuickAllocVendor] = useState<string>("Milan Display Hub");
  const [quickAllocCountry, setQuickAllocCountry] = useState<string>("Italy");
  const [quickAllocQty, setQuickAllocQty] = useState<number>(150);
  const [quickAllocPrice, setQuickAllocPrice] = useState<number>(9.5);
  const [quickAllocExtra, setQuickAllocExtra] = useState<number>(120);

  const [quickVersionReason, setQuickVersionReason] = useState<string>(
    "Air-freight buffer for Q1 store installation",
  );
  const [quickVersionTotal, setQuickVersionTotal] = useState<number>(13400);
  const [quickVersionState, setQuickVersionState] = useState<"Proposed" | "Approved">(
    "Proposed",
  );

  const [quickExpenseStage, setQuickExpenseStage] = useState<
    "Quotation" | "Purchase order" | "Invoice"
  >("Invoice");
  const [quickExpenseVendor, setQuickExpenseVendor] = useState<string>("Vietnam vendor");
  const [quickExpenseAmount, setQuickExpenseAmount] = useState<number>(2000);
  const [quickExpenseQuarter, setQuickExpenseQuarter] = useState<WorkbenchQuarter>("Q1");

  const currency = data?.settings?.currency || activeProject?.approvedCurrency || "USD";

  // Build governed input payload for buildProjectGraphProjection
  const projection = useMemo<GraphProjectionResult>(() => {
    const projId = activeProject.id;
    const projectDocs = effectiveDocuments.filter((doc) =>
      doc.lines.some((line) => line.projectId === projId),
    );
    const projectDocLines = effectiveDocuments.flatMap((doc) =>
      doc.lines
        .filter((line) => line.projectId === projId)
        .map((line) => {
          const isPostedActual =
            doc.type === "Invoice" && /actual|posted|settled/i.test(doc.status || "");
          return {
            id: line.id,
            document_line_id: line.id,
            documentId: doc.id,
            projectId: projId,
            spendingLineId: line.spendingLineId,
            allocationId: line.allocationId,
            stage: isPostedActual
              ? "Actual"
              : doc.type === "Purchase order"
                ? "PO"
                : doc.type,
            description: line.description,
            quantity: line.quantity ?? 1,
            amount: line.amount,
            currency: line.currency || currency,
            spendQuarter: line.spendQuarter || "Q1",
            sourceDocumentId: line.sourceDocumentId,
            sourceDocumentLineId: line.sourceDocumentLineId,
          };
        }),
    );

    const purchaseLinks = projectDocLines.map((line, index) => ({
      id: `plink-${line.id || index + 1}`,
      documentLineId: line.id,
      spendingLineId: line.spendingLineId,
      allocationId: line.allocationId || null,
      attributedQuantity: line.quantity || 1,
      attributedAmount: line.amount,
      currency: line.currency,
    }));

    const lifecycleTransitions = projectDocLines
      .filter((line) => Boolean(line.sourceDocumentLineId))
      .map((line, index) => {
        const upstream = projectDocLines.find(
          (candidate) => candidate.id === line.sourceDocumentLineId,
        );
        const fromStage = upstream?.stage || "PO";
        return {
          id: `tr-${line.id || index + 1}`,
          fromLineId: line.sourceDocumentLineId!,
          toLineId: line.id,
          transitionType: `${fromStage}->${line.stage}`,
          convertedAmount: line.amount,
          currency: line.currency,
        };
      });

    // Enrich purchase items with glCode from library if not directly on line
    const enrichedItems = (activeProject.lines || []).map((line) => {
      const libItem = data?.library?.spendingItems?.find(
        (it) => it.id === line.spendingItemId,
      );
      const allocGl =
        line.allocations?.find((a) => a.confirmedFinanceCode || a.suggestedFinanceCode)
          ?.confirmedFinanceCode ||
        line.allocations?.find((a) => a.suggestedFinanceCode)?.suggestedFinanceCode;
      return {
        ...line,
        glCode: line.glCode || libItem?.glCode || allocGl || "001230",
      };
    });

    // Build canonical BudgetVersion snapshots using createBudgetVersion
    const rawRevs = Array.isArray(activeProject.revisions) ? activeProject.revisions : [];
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
          total: activeProject.approvedAmount || requirementTotal(enrichedItems[0] || {}),
          currency,
          purchaseItems: enrichedItems,
        }),
      );
    } else {
      rawRevs.forEach((rev, idx) => {
        const isApproved =
          rev.status === "Approved" || (idx === 0 && activeProject.approvedAmount > 0);
        const v = createBudgetVersion(
          {
            versionId: rev.id || `ver-${projId}-${idx + 1}`,
            projectId: projId,
            sequence: idx + 1,
            versionType: rev.versionType || (idx === 0 ? "Original" : "Adjustment"),
            authorizationState: isApproved ? "Approved" : "Proposed",
            reason: rev.comment || rev.approvedComment || "Version snapshot",
            total: isApproved
              ? Number(rev.approvedAmount || activeProject.approvedAmount || rev.plannedTotal)
              : Number(rev.plannedTotal || activeProject.approvedAmount),
            currency: rev.approvedCurrency || currency,
            purchaseItems: rev.lines?.length ? rev.lines : enrichedItems,
            createdAt: rev.timestamp,
          },
          builtVersions,
        );
        builtVersions.push(v);
      });
    }

    const projectNotes = notes.filter((n) => n.projectId === projId);
    const projectAudit = auditEvents.filter((ev) => ev.projectId === projId);

    return buildProjectGraphProjection({
      project: {
        recordId: activeProject.recordId,
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
    }) as GraphProjectionResult;
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

  // Budget Version governance state
  const versionGovernance = useMemo(
    () =>
      effectiveApprovedBudget(
        projection.tables.Budget_Versions.map((row) => ({
          versionId: String(row.version_id),
          sequence: Number(row.sequence),
          versionType: String(row.version_type),
          authorizationState: String(row.authorization_state),
          total: Number(row.total),
          reason: String(row.reason),
        })),
      ),
    [projection.tables.Budget_Versions],
  );

  // Selected Node Resolution
  const selectedNode = useMemo<ProjectedNode>(() => {
    return (
      projection.nodes.find(
        (n) => n.id === selectedNodeId || n.recordId === selectedNodeId,
      ) ?? projection.nodes[0]
    );
  }, [projection.nodes, selectedNodeId]);

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    return {
      incoming: projection.edges.filter((e) => e.target === selectedNode.id),
      outgoing: projection.edges.filter((e) => e.source === selectedNode.id),
    };
  }, [projection.edges, selectedNode]);

  // Explicit bidirectional backlink index & commitment lineage check
  const vaultBacklinkIndex = useMemo(
    () =>
      buildBacklinkIndex(
        notes.filter((n) => n.projectId === activeProject.id),
      ),
    [notes, activeProject.id],
  );

  const directLineageCheck = useMemo(
    () =>
      computeLifecycleLineage({
        poLines: projection.tables.Lifecycle_Lines.filter((l) => l.stage === "PO"),
        lifecycleLines: projection.tables.Lifecycle_Lines,
        transitions: projection.tables.Lifecycle_Transitions,
        approvedBudget: projection.summary.approvedBudget,
      }),
    [
      projection.tables.Lifecycle_Lines,
      projection.tables.Lifecycle_Transitions,
      projection.summary.approvedBudget,
    ],
  );

  const selectedNodeBacklinks = useMemo(() => {
    if (!selectedNode) return [];
    return (
      vaultBacklinkIndex.byTarget[selectedNode.id] ??
      projection.backlinkIndex.byTarget[selectedNode.id] ??
      []
    );
  }, [vaultBacklinkIndex.byTarget, projection.backlinkIndex.byTarget, selectedNode]);

  // Active Note for Obsidian Mode B
  const activeNote = useMemo<KnowledgeNoteItem>(() => {
    const projectNotes = notes.filter((n) => n.projectId === activeProject.id);
    return (
      projectNotes.find((n) => n.id === activeNoteId) ??
      projectNotes[0] ?? {
        id: "note-fallback",
        projectId: activeProject.id,
        title: "Project Decision Note",
        attachedToType: "Project",
        attachedToId: activeProject.id,
        content: `---\nauthor: Planner\nstatus: draft\n---\nLinked to [[${activeProject.id}|${activeProject.name}]] #planning`,
        updatedAt: new Date().toISOString(),
      }
    );
  }, [notes, activeProject.id, activeProject.name, activeNoteId]);

  const parsedActiveNote = useMemo(
    () => extractWikilinks(activeNote.content),
    [activeNote.content],
  );

  // Quarter-by-Quarter Plan-vs-Reality Trajectory Data (Q1-Q4)
  const quarterChartRows = useMemo(() => {
    const items = activeProject.lines || [];
    const totalPlanned = Math.max(
      1,
      items.reduce((sum, item) => sum + requirementTotal(item), 0),
    );
    const docLines = projection.tables.Lifecycle_Lines;

    return QUARTERS.map((q) => {
      const plannedInQ = items.reduce((sum, item) => {
        const allocs = item.allocations || [];
        if (allocs.length > 0) {
          return (
            sum +
            allocs
              .filter((a) => a.quarter === q)
              .reduce((aSum, a) => aSum + allocationSubtotal(a), 0)
          );
        }
        if (item.quarters?.includes(q)) {
          return sum + requirementTotal(item) / Math.max(1, item.quarters.length);
        }
        return sum;
      }, 0);

      const approvedPhase =
        projection.summary.approvedBudget * (plannedInQ / totalPlanned);

      const qDocLines = docLines.filter((l) => String(l.spend_quarter) === q);
      const actualInQ = qDocLines
        .filter((l) => l.stage === "Actual" || l.stage === "Invoice")
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);
      const openInQ = qDocLines
        .filter((l) => l.stage === "PO")
        .reduce((sum, l) => sum + Number(l.open_commitment || 0), 0);
      const uncommittedInQ = Math.max(0, plannedInQ - actualInQ - openInQ);
      const forecastInQ = actualInQ + openInQ + uncommittedInQ;

      return {
        quarter: q,
        approved: approvedPhase,
        planned: plannedInQ,
        actual: actualInQ,
        open: openInQ,
        forecast: forecastInQ,
      };
    });
  }, [activeProject.lines, projection.summary.approvedBudget, projection.tables.Lifecycle_Lines]);

  // Helper to ensure seed projects are hydrated into StudioData before mutating
  const mutateStudioAndProject = (
    updater: (project: WorkbenchProject, docs: WorkbenchDocument[]) => {
      project: WorkbenchProject;
      docs: WorkbenchDocument[];
    },
    auditEntry: Omit<AuditEventItem, "id" | "projectId" | "timestamp">,
  ) => {
    setData((current) => {
      const baseProjects =
        Array.isArray(current.projects) && current.projects.length > 0
          ? current.projects
          : SEED_PROJECTS;
      const baseDocs =
        Array.isArray(current.documents) && current.documents.length > 0
          ? current.documents
          : SEED_DOCUMENTS;
      const target =
        baseProjects.find((p) => p.id === activeProject.id) ?? baseProjects[0];
      const { project: updatedProject, docs: updatedDocs } = updater(
        JSON.parse(JSON.stringify(target)) as WorkbenchProject,
        JSON.parse(JSON.stringify(baseDocs)) as WorkbenchDocument[],
      );
      return {
        ...current,
        profile: {
          functionName: current.profile?.functionName || "Marketing & Brand",
          plannerName: current.profile?.plannerName || "Sample planner",
          team: current.profile?.team || "Growth and visual merchandising",
        },
        libraryComplete: true,
        projects: baseProjects.map((p) =>
          p.id === updatedProject.id ? updatedProject : p,
        ),
        documents: updatedDocs,
      };
    });

    setAuditEvents((prev) => [
      {
        id: makeId("audit"),
        projectId: activeProject.id,
        timestamp: new Date().toISOString(),
        ...auditEntry,
      },
      ...prev,
    ]);
  };

  // Toggle collapse state on a node (Graph-to-Table Equivalence: view state only)
  const toggleNodeCollapse = (nodeId: string) => {
    const existing = projection.nodes.find((n) => n.id === nodeId);
    if (!existing) return;
    setNodeViewState((prev) => ({
      ...prev,
      [nodeId]: {
        x: prev[nodeId]?.x ?? existing.x,
        y: prev[nodeId]?.y ?? existing.y,
        collapsed: !(prev[nodeId]?.collapsed ?? existing.mode === "collapsed"),
      },
    }));
  };

  // Nudge or drag node coordinates (proves financial invariance)
  const moveNodeBy = (nodeId: string, dx: number, dy: number) => {
    const existing = projection.nodes.find((n) => n.id === nodeId);
    if (!existing) return;
    setNodeViewState((prev) => ({
      ...prev,
      [nodeId]: {
        x: Math.max(12, (prev[nodeId]?.x ?? existing.x) + dx),
        y: Math.max(12, (prev[nodeId]?.y ?? existing.y) + dy),
        collapsed: prev[nodeId]?.collapsed ?? existing.mode === "collapsed",
      },
    }));
  };

  const handleNodePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    node: ProjectedNode,
  ) => {
    if ((event.target as HTMLElement).closest("button")) return;
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    setDragOffset({
      dx: event.clientX / zoom - node.x,
      dy: event.clientY / zoom - node.y,
    });
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingNodeId) return;
    const nextX = Math.max(12, Math.round(event.clientX / zoom - dragOffset.dx));
    const nextY = Math.max(12, Math.round(event.clientY / zoom - dragOffset.dy));
    setNodeViewState((prev) => ({
      ...prev,
      [draggingNodeId]: {
        x: nextX,
        y: nextY,
        collapsed: prev[draggingNodeId]?.collapsed ?? false,
      },
    }));
  };

  const handleCanvasPointerUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
  };

  // Navigate to any node ID from a [[Wikilink]] or Table Row
  const jumpToNode = (targetId: string) => {
    const cleanId = targetId.trim();
    const matched = projection.nodes.find(
      (n) =>
        n.id.toLowerCase() === cleanId.toLowerCase() ||
        n.recordId.toLowerCase() === cleanId.toLowerCase() ||
        n.label.toLowerCase() === cleanId.toLowerCase(),
    );
    if (matched) {
      // Ensure ancestors are expanded if hidden
      if (matched.hiddenByCollapse) {
        setNodeViewState((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            next[key] = { ...next[key], collapsed: false };
          }
          return next;
        });
      }
      setSelectedNodeId(matched.id);
      setSurface("graph");
    }
  };

  // Quick Action 1: + Add Purchase Item
  const handleAddPurchaseItem = () => {
    const name = quickItemName.trim() || "Acrylic Fragrance Tester Tray";
    const lineId = makeId("line");
    const targetWpId =
      selectedNode?.nodeType === "Work_Packages"
        ? selectedNode.id
        : activeProject.workPackages?.[0]?.id || "wp-general";

    mutateStudioAndProject(
      (proj, docs) => {
        const newLine: WorkbenchSpendLine = {
          id: lineId,
          spendingItemId: "spend-posm",
          itemNameSnapshot: name,
          specification: quickItemSpec.trim() || "Standard specification",
          unitOfMeasure: "units",
          sourceText: name,
          quantity: Math.max(1, Number(quickItemQty) || 1),
          unitPrice: Math.max(0, Number(quickItemPrice) || 0),
          unitCurrency: currency,
          quarters: ["Q1"],
          workPackageId: targetWpId,
          glCode: quickItemGl.trim() || "001230",
          allocations: [],
          adjustmentComment: "Added from Node Graph workbench",
        };
        return {
          project: { ...proj, lines: [...proj.lines, newLine] },
          docs,
        };
      },
      {
        actor: data?.profile?.plannerName || "Planner",
        action: "ADD_PURCHASE_ITEM",
        targetId: lineId,
        reason: `Added requirement "${name}" (${quickItemQty}u @ ${money(quickItemPrice, currency)}) under ${targetWpId}`,
        sourceRef: "Graph Workbench",
      },
    );
    setSelectedNodeId(lineId);
    setQuickItemName("");
    setQuickCaptureOpen(null);
  };

  // Quick Action 2: + Add Sourcing Allocation
  const handleAddAllocation = () => {
    const parentLineId =
      selectedNode?.nodeType === "Purchase_Items"
        ? selectedNode.id
        : activeProject.lines[0]?.id;
    if (!parentLineId) return;

    const allocId = makeId("alloc");
    mutateStudioAndProject(
      (proj, docs) => {
        const nextLines = proj.lines.map((line) => {
          if (line.id !== parentLineId) return line;
          const nextAlloc: WorkbenchAllocation = {
            id: allocId,
            sourceType: "External vendor",
            vendorOrWarehouse: quickAllocVendor.trim() || "Regional vendor",
            sourceCountry: quickAllocCountry.trim() || "Italy",
            sourceLocation: quickAllocCountry.trim() || "Milan",
            quantity: Math.max(1, Number(quickAllocQty) || 1),
            unitPrice: Math.max(0, Number(quickAllocPrice) || 0),
            currency,
            quarter: "Q1",
            priceBasis: "Ex works",
            additionalCostEstimate: Math.max(0, Number(quickAllocExtra) || 0),
            notes: "Added from Node Inspector",
            financeMappingStatus: "Suggested",
            suggestedFinanceCode: line.glCode || "001230",
            mappingRationale: "Contextual allocation inherits GL precedent 001230",
          };
          return {
            ...line,
            allocations: [...(line.allocations || []), nextAlloc],
          };
        });
        return { project: { ...proj, lines: nextLines }, docs };
      },
      {
        actor: data?.profile?.plannerName || "Planner",
        action: "ADD_SOURCING_ALLOCATION",
        targetId: allocId,
        reason: `Allocated ${quickAllocQty}u to ${quickAllocVendor} (${quickAllocCountry}) on ${parentLineId}`,
        sourceRef: parentLineId,
      },
    );
    setSelectedNodeId(allocId);
    setQuickCaptureOpen(null);
  };

  // Quick Action 3: + Propose or Approve Budget Version
  const handleCreateBudgetVersion = () => {
    const verId = makeId("ver");
    const isApproved = quickVersionState === "Approved";
    mutateStudioAndProject(
      (proj, docs) => {
        const nextRev: WorkbenchRevision = {
          id: verId,
          status: isApproved ? "Approved" : "Proposed",
          versionType: proj.revisions.length === 0 ? "Original" : "Adjustment",
          timestamp: new Date().toISOString(),
          comment: quickVersionReason.trim() || "Budget version update",
          lines: proj.lines,
          outcomes: proj.outcomes,
          approvedAmount: isApproved ? Number(quickVersionTotal) : proj.approvedAmount,
          approvedCurrency: currency,
          approvedComment: quickVersionReason.trim(),
          plannedTotal: Number(quickVersionTotal),
          changedFields: ["budgetVersion"],
        };
        return {
          project: {
            ...proj,
            approvedAmount: isApproved ? Number(quickVersionTotal) : proj.approvedAmount,
            revisions: [...proj.revisions, nextRev],
            currentRevisionId: verId,
          },
          docs,
        };
      },
      {
        actor: data?.profile?.plannerName || "Planner",
        action: isApproved ? "APPROVE_BUDGET_VERSION" : "PROPOSE_BUDGET_VERSION",
        targetId: verId,
        reason: `${quickVersionState} version (${money(quickVersionTotal, currency)}): ${quickVersionReason}`,
        sourceRef: activeProject.id,
      },
    );
    setQuickCaptureOpen(null);
  };

  // 1-Click Approve Latest Proposed Version from Command Bar
  const handleApprovePendingVersion = () => {
    const pending = versionGovernance.latestProposedVersion;
    if (!pending) return;
    const approvedVerId = makeId("ver-approved");
    mutateStudioAndProject(
      (proj, docs) => {
        const nextAmount = Number(pending.total || proj.approvedAmount);
        const nextRev: WorkbenchRevision = {
          id: approvedVerId,
          status: "Approved",
          versionType: "Adjustment",
          timestamp: new Date().toISOString(),
          comment: `Approved pending version ${pending.versionId}: ${pending.reason}`,
          lines: proj.lines,
          outcomes: proj.outcomes,
          approvedAmount: nextAmount,
          approvedCurrency: currency,
          approvedComment: "Approved via Command Bar governance action",
          plannedTotal: nextAmount,
          changedFields: ["approvedAmount"],
        };
        return {
          project: {
            ...proj,
            approvedAmount: nextAmount,
            revisions: [...proj.revisions, nextRev],
            currentRevisionId: approvedVerId,
          },
          docs,
        };
      },
      {
        actor: "Finance Reviewer",
        action: "APPROVE_PENDING_ADJUSTMENT",
        targetId: approvedVerId,
        reason: `Transitioned Proposed (${money(pending.total, currency)}) to Approved baseline`,
        sourceRef: String(pending.versionId),
      },
    );
  };

  // Quick Action 4: + Attach [[Knowledge Note]]
  const handleAttachNote = (targetNode: ProjectedNode) => {
    const newNoteId = makeId("note");
    const newNote: KnowledgeNoteItem = {
      id: newNoteId,
      projectId: activeProject.id,
      title: `Field Note · ${targetNode.label}`,
      attachedToType: targetNode.nodeType,
      attachedToId: targetNode.id,
      updatedAt: new Date().toISOString(),
      content: [
        "---",
        `author: ${data?.profile?.plannerName || "Planner"}`,
        "status: active",
        "---",
        `Context note attached to [[${targetNode.id}|${targetNode.label}]] inside [[${activeProject.id}|${activeProject.name}]].`,
        "Verify vendor specification, delivery milestone, and GL code `" +
          "001230" +
          "`.",
        "#field-note #posm #audit-ready",
      ].join("\n"),
    };
    setNotes((prev) => [newNote, ...prev]);
    setAuditEvents((prev) => [
      {
        id: makeId("audit"),
        projectId: activeProject.id,
        actor: data?.profile?.plannerName || "Planner",
        timestamp: new Date().toISOString(),
        action: "ATTACH_KNOWLEDGE_NOTE",
        targetId: newNoteId,
        reason: `Attached Obsidian note "${newNote.title}" to [[${targetNode.id}]]`,
        sourceRef: targetNode.id,
      },
      ...prev,
    ]);
    setActiveNoteId(newNoteId);
    setGraphMode("obsidian");
    setSurface("graph");
  };

  // Quick Action 5: Log On-the-Fly Expense / Quotation / PO / Invoice Line
  const handleLogQuickExpense = () => {
    const docId = makeId("doc");
    const lineId = makeId("doc-line");
    const targetItem =
      activeProject.lines.find((l) => l.id === selectedNode?.id) ??
      activeProject.lines[0];
    const targetAlloc = targetItem?.allocations?.[0];
    const openPoLine = projection.tables.Lifecycle_Lines.find(
      (l) => l.stage === "PO" && Number(l.open_commitment || 0) > 0,
    );

    mutateStudioAndProject(
      (proj, docs) => {
        const newDoc: WorkbenchDocument = {
          id: docId,
          type: quickExpenseStage,
          fileName: `${quickExpenseStage.toLowerCase().replace(/\s+/g, "-")}-${lineId}.pdf`,
          reference: `${quickExpenseStage === "Invoice" ? "INV" : quickExpenseStage === "Purchase order" ? "PO" : "QTE"}-${Date.now().toString().slice(-4)}`,
          projectId: proj.id,
          date: new Date().toISOString().slice(0, 10),
          vendor: quickExpenseVendor.trim() || "Regional partner",
          status:
            quickExpenseStage === "Invoice" ? "Posted to Actuals" : "Open commitment",
          source: "Synthetic",
          lines: [
            {
              id: lineId,
              projectId: proj.id,
              spendingLineId: targetItem?.id || "line-paper-stand",
              allocationId: targetAlloc?.id,
              description: `${quickExpenseStage} · ${quickExpenseVendor}`,
              amount: Math.max(0, Number(quickExpenseAmount) || 0),
              quantity: 100,
              currency,
              spendQuarter: quickExpenseQuarter,
              sourceDocumentLineId:
                quickExpenseStage === "Invoice" && openPoLine
                  ? String(openPoLine.document_line_id)
                  : undefined,
            },
          ],
        };
        return { project: proj, docs: [...docs, newDoc] };
      },
      {
        actor: data?.profile?.plannerName || "Planner",
        action: `LOG_${quickExpenseStage.toUpperCase().replace(/\s+/g, "_")}`,
        targetId: lineId,
        reason: `Logged ${quickExpenseStage} (${money(quickExpenseAmount, currency)}) for ${quickExpenseVendor} in ${quickExpenseQuarter}`,
        sourceRef: docId,
      },
    );
    setSelectedNodeId(lineId);
    setQuickCaptureOpen(null);
  };

  // Export Canonical Table(s)
  const handleExportCanonical = async (
    format: "tsv" | "csv" | "markdown",
    scope: CanonicalTableName | "ALL",
  ) => {
    const text =
      format === "markdown"
        ? formatCanonicalTableMarkdown(projection.tables, scope)
        : formatCanonicalTableDelimited(
            projection.tables,
            scope,
            format === "tsv" ? "\t" : ",",
          );

    if (format === "csv") {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ellies-book-${activeProject.id.toLowerCase()}-${scope.toLowerCase()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportBanner(`Downloaded ${scope} CSV (${activeProject.id})`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setExportBanner(
        `Copied ${scope} ${format === "markdown" ? "Markdown" : "Excel-safe TSV"} to clipboard`,
      );
    } catch {
      setExportBanner(`Prepared ${scope} export (use CSV download if clipboard is blocked)`);
    }
  };

  // Filtered rows for active canonical table
  const filteredTableRows = useMemo(() => {
    const rows = projection.tables[activeTable] || [];
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((val) =>
        String(Array.isArray(val) ? val.join(" ") : val ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [projection.tables, activeTable, tableSearch]);

  // Render details for the selected node across Operational, Managerial, and Accounting views
  const selectedNodePerspectives = useMemo(() => {
    const node = selectedNode;
    if (!node) return null;

    const itemRow =
      projection.tables.Purchase_Items.find(
        (r) => r.spending_line_id === node.id,
      ) ?? projection.tables.Purchase_Items[0];
    const allocRow = projection.tables.Sourcing_Allocations.find(
      (r) => r.allocation_id === node.id,
    );
    const lineRow = projection.tables.Lifecycle_Lines.find(
      (r) => r.document_line_id === node.id,
    );
    const wpRow =
      projection.tables.Work_Packages.find((r) => r.work_package_id === node.id) ??
      projection.tables.Work_Packages[0];

    const rawItem =
      activeProject.lines.find((l) => l.id === (itemRow?.spending_line_id ?? "")) ??
      activeProject.lines[0];
    const allocValidation = validateRequirementAllocations(rawItem || {});
    const allocQty = allocatedQuantity(rawItem || {});
    const unallocQty = unallocatedQuantity(rawItem || {});

    const glCodeString = String(
      itemRow?.gl_code || rawItem?.glCode || "001230",
    ).padStart(6, "0");

    return {
      operational: [
        {
          label: "Node Entity & Table",
          value: `${NODE_TYPE_META[node.nodeType]?.badge || node.nodeType} → ${node.nodeType}`,
        },
        { label: "Governed Record ID", value: node.recordId },
        {
          label: "Item / Deliverable",
          value: String(
            allocRow?.vendor_or_warehouse ||
              lineRow?.description ||
              itemRow?.description ||
              node.label,
          ),
        },
        {
          label: "Specification & Unit",
          value: `${itemRow?.specification || "A4, 350 gsm"} · ${itemRow?.unit_of_measure || "units"}`,
        },
        {
          label: "Quantity Reconciliation",
          value: `${allocQty} allocated / ${allocValidation.required} required (${unallocQty} unallocated · ${allocValidation.status})`,
        },
        {
          label: "Vendor / Country / Basis",
          value: allocRow
            ? `${allocRow.vendor_or_warehouse} · ${allocRow.source_country} (${allocRow.source_type})`
            : "Multi-vendor split (China, Vietnam, Germany)",
        },
      ],
      managerial: [
        {
          label: "Project Initiative",
          value: `${activeProject.id} · ${activeProject.name}`,
        },
        {
          label: "Work Package Stream",
          value: `${wpRow?.name || "General"} (${wpRow?.work_package_id || "wp-general"})`,
        },
        {
          label: "Authorization Boundary",
          value: `Approved Baseline ${money(projection.summary.approvedBudget, currency)} · ${versionGovernance.pendingDelta !== 0 ? `Pending Proposed Delta ${money(versionGovernance.pendingDelta, currency)}` : "Baseline Aligned"}`,
        },
        {
          label: "Available to Commit",
          value: money(projection.summary.availableToCommit, currency),
        },
        {
          label: "Outcome KPI (Non-Composite)",
          value: activeProject.outcomes[0]
            ? `${activeProject.outcomes[0].outcomeNameSnapshot || "Shelf execution coverage"}: ${activeProject.outcomes[0].current} / ${activeProject.outcomes[0].target} (Expected contribution, never proven causation)`
            : "Expected contribution tracked separately from financial spend",
        },
        {
          label: "Obsidian Knowledge Links",
          value: `${selectedNodeBacklinks.length} bidirectional backlink(s) attached`,
        },
      ],
      accounting: [
        {
          label: "Official GL Code (String-Preserved)",
          value: glCodeString,
        },
        {
          label: "Fiscal Period & Quarter",
          value: `${activeProject.period || "FY2027"} · ${String(allocRow?.quarter || lineRow?.spend_quarter || "Q1")}`,
        },
        {
          label: "Reporting Currency",
          value: `${currency} (Stationary rate basis)`,
        },
        {
          label: "Recognized Actuals (Settled)",
          value: money(projection.summary.actualTotal, currency),
        },
        {
          label: "Open Commitment (Deduped PO)",
          value: `${money(projection.summary.openCommitmentTotal, currency)} (Lineage verified: ${money(directLineageCheck.openCommitmentTotal, currency)})`,
        },
        {
          label: "Finance Mapping Status",
          value: "Contextual human confirmation required (Never auto-approved by AI)",
        },
      ],
      allocValidation,
      glCodeString,
    };
  }, [
    selectedNode,
    projection.tables,
    projection.summary,
    activeProject,
    currency,
    versionGovernance.pendingDelta,
    selectedNodeBacklinks.length,
    directLineageCheck.openCommitmentTotal,
  ]);

  // All available tag strings across notes
  const allNoteTags = useMemo(() => {
    return Object.keys(projection.backlinkIndex.byTag);
  }, [projection.backlinkIndex.byTag]);

  // Render interactive markdown preview with clickable [[TargetID|Alias]] pills
  const renderNotePreviewWithWikilinks = (markdown: string) => {
    const bodyWithoutFm = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    const lines = bodyWithoutFm.split(/\r?\n/);

    return lines.map((line, lineIdx) => {
      const parts: Array<{
        type: "text" | "wikilink" | "tag";
        text: string;
        target?: string;
      }> = [];
      const tokenRegex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]|#[a-zA-Z][a-zA-Z0-9/_-]*/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = tokenRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            type: "text",
            text: line.slice(lastIndex, match.index),
          });
        }
        if (match[0].startsWith("[[")) {
          const target = match[1].trim();
          const label = (match[2] ? match[2] : match[1]).trim();
          parts.push({ type: "wikilink", text: label, target });
        } else {
          parts.push({
            type: "tag",
            text: match[0],
            target: match[0].slice(1).toLowerCase(),
          });
        }
        lastIndex = tokenRegex.lastIndex;
      }
      if (lastIndex < line.length) {
        parts.push({ type: "text", text: line.slice(lastIndex) });
      }

      return (
        <p key={lineIdx} className="eb-md-line">
          {parts.map((part, pIdx) => {
            if (part.type === "wikilink" && part.target) {
              return (
                <button
                  key={pIdx}
                  type="button"
                  className="eb-wikilink-pill"
                  onClick={() => jumpToNode(part.target!)}
                  title={`Jump to governed node ${part.target}`}
                >
                  [[{part.text}]]
                </button>
              );
            }
            if (part.type === "tag" && part.target) {
              return (
                <button
                  key={pIdx}
                  type="button"
                  className="eb-tag-pill"
                  onClick={() => setActiveTagFilter(part.target!)}
                >
                  {part.text}
                </button>
              );
            }
            return <span key={pIdx}>{part.text}</span>;
          })}
        </p>
      );
    });
  };

  const maxQuarterChartValue = useMemo(() => {
    const vals = quarterChartRows.flatMap((r) => [
      r.approved,
      r.planned,
      r.actual + r.open,
      r.forecast,
    ]);
    return Math.max(2000, ...vals, 1);
  }, [quarterChartRows]);

  return (
    <section
      className="eb-workbench"
      data-ui="ellies-book-workbench"
      aria-label="Ellie's Book Dual-Mode Graph, Obsidian Vault and Modular Table Workbench"
    >
      {/* Top Workbench Header & Scope Switcher */}
      <div className="eb-header">
        <div className="eb-header-title">
          <div className="eb-title-row">
            <span className="eb-monogram" aria-hidden="true">
              EB
            </span>
            <div>
              <h2 className="eb-heading">
                Ellie&apos;s Book · Plan-vs-Reality Graph &amp; Relational Workbench
              </h2>
              <p className="eb-subtitle">
                Synchronized projections over one governed model ({mode} scope) ·{" "}
                <strong>{activeProject.generatedId || activeProject.id}</strong> —{" "}
                {activeProject.name}
              </p>
            </div>
          </div>
        </div>

        <div className="eb-header-controls">
          <label className="eb-project-picker">
            <span>Project scope</span>
            <select
              aria-label="Select project for graph and canonical tables"
              value={activeProject.id}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedNodeId(e.target.value);
              }}
            >
              {effectiveProjects.map((proj) => (
                <option key={proj.recordId} value={proj.id}>
                  {proj.id} · {proj.name}
                </option>
              ))}
            </select>
          </label>

          <div
            className="eb-surface-tabs"
            role="tablist"
            aria-label="Ellie's Book Workbench Surfaces"
          >
            <button
              type="button"
              role="tab"
              aria-selected={surface === "graph"}
              className={surface === "graph" ? "is-active" : ""}
              onClick={() => setSurface("graph")}
            >
              Node Graph &amp; Vault ({projection.nodes.length} nodes)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={surface === "tables"}
              className={surface === "tables" ? "is-active" : ""}
              onClick={() => setSurface("tables")}
            >
              Modular Tables &amp; Charts ({CANONICAL_TABLE_NAMES.length} tables)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip: Flat, 1px hairline dividers, tabular numbers, zero circular icon slop */}
      <div className="eb-kpi-strip" role="region" aria-label="Project Headroom and Lineage Summary">
        <div className="eb-kpi-cell eb-kpi-lead">
          <span className="eb-kpi-label">Available to Commit (Headroom)</span>
          <strong
            className={`eb-kpi-figure ${projection.summary.availableToCommit < 0 ? "is-negative" : "is-positive"}`}
          >
            {money(projection.summary.availableToCommit, currency)}
          </strong>
          <small className="eb-kpi-sub">
            Approved {money(projection.summary.approvedBudget, currency)} minus Actuals &amp; Open PO
          </small>
        </div>

        <div className="eb-kpi-cell">
          <span className="eb-kpi-label">Approved Baseline</span>
          <strong className="eb-kpi-figure">
            {money(projection.summary.approvedBudget, currency)}
          </strong>
          <small className="eb-kpi-sub">
            Version {versionGovernance.baselineVersionId || "ver-1"} (Approved)
          </small>
        </div>

        <div className="eb-kpi-cell">
          <span className="eb-kpi-label">Planned Requirement Total</span>
          <strong className="eb-kpi-figure">
            {money(projection.summary.plannedTotal, currency)}
          </strong>
          <small className="eb-kpi-sub">
            {projection.tables.Sourcing_Allocations.length} allocations replace parent estimate
          </small>
        </div>

        <div className="eb-kpi-cell">
          <span className="eb-kpi-label">Actuals + Open Commitment</span>
          <strong className="eb-kpi-figure">
            {money(
              projection.summary.actualTotal + projection.summary.openCommitmentTotal,
              currency,
            )}
          </strong>
          <small className="eb-kpi-sub">
            Actual {money(projection.summary.actualTotal, currency)} · Open PO{" "}
            {money(projection.summary.openCommitmentTotal, currency)}
          </small>
        </div>

        <div className="eb-kpi-cell">
          <span className="eb-kpi-label">Forecast Spend &amp; Variance</span>
          <strong
            className={`eb-kpi-figure ${projection.summary.projectedHeadroom < 0 ? "is-negative" : ""}`}
          >
            {money(projection.summary.forecastSpend, currency)}
          </strong>
          <small className="eb-kpi-sub">
            Projected headroom:{" "}
            {projection.summary.projectedHeadroom >= 0 ? "+" : ""}
            {money(projection.summary.projectedHeadroom, currency)}
          </small>
        </div>
      </div>

      {/* SURFACE 1: DUAL-MODE NODE WORKFLOW & OBSIDIAN KNOWLEDGE GRAPH */}
      {surface === "graph" ? (
        <div className="eb-surface-body">
          {/* Graph Mode & Canvas Toolbar */}
          <div className="eb-graph-toolbar">
            <div className="eb-mode-pills" role="group" aria-label="Graph overlay mode">
              <button
                type="button"
                className={graphMode === "dag" && !outlineFallback ? "is-active" : ""}
                onClick={() => {
                  setGraphMode("dag");
                  setOutlineFallback(false);
                }}
              >
                Mode A · Financial Lineage DAG
              </button>
              <button
                type="button"
                className={graphMode === "obsidian" ? "is-active" : ""}
                onClick={() => setGraphMode("obsidian")}
              >
                Mode B · Obsidian [[Knowledge Vault]] ({notes.filter((n) => n.projectId === activeProject.id).length})
              </button>
              <button
                type="button"
                className={outlineFallback ? "is-active" : ""}
                onClick={() => {
                  setGraphMode("dag");
                  setOutlineFallback((prev) => !prev);
                }}
              >
                {outlineFallback ? "✓ Outline Tree Fallback (390px Ready)" : "Outline Fallback View"}
              </button>
            </div>

            {graphMode === "dag" && !outlineFallback ? (
              <div className="eb-canvas-controls" aria-label="Canvas layout controls">
                <span className="eb-invariance-tag" title="Dragging or collapsing nodes never alters financial totals">
                  View State Only: ({selectedNode?.x ?? 0}, {selectedNode?.y ?? 0}) ·{" "}
                  {selectedNode?.mode ?? "expanded"}
                </span>
                <button
                  type="button"
                  onClick={() => moveNodeBy(selectedNode.id, -40, 0)}
                  title="Nudge selected node left"
                >
                  ← X
                </button>
                <button
                  type="button"
                  onClick={() => moveNodeBy(selectedNode.id, 40, 0)}
                  title="Nudge selected node right"
                >
                  X →
                </button>
                <button
                  type="button"
                  onClick={() => moveNodeBy(selectedNode.id, 0, -30)}
                  title="Nudge selected node up"
                >
                  ↑ Y
                </button>
                <button
                  type="button"
                  onClick={() => moveNodeBy(selectedNode.id, 0, 30)}
                  title="Nudge selected node down"
                >
                  Y ↓
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))))}
                >
                  Zoom −
                </button>
                <span className="eb-zoom-readout">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(2))))}
                >
                  Zoom +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                >
                  Reset Canvas
                </button>
              </div>
            ) : null}
          </div>

          {/* Typed Edge Legend Strip */}
          <div className="eb-edge-legend">
            <span>
              <i className="eb-edge-swatch eb-swatch-containment" />
              <code>containment</code> (Project → WP → Item → Allocation)
            </span>
            <span>
              <i className="eb-edge-swatch eb-swatch-plink" />
              <code>purchase_link</code> (Allocation → Quote/PO/Invoice Line)
            </span>
            <span>
              <i className="eb-edge-swatch eb-swatch-transition" />
              <code>lifecycle_transition</code> (Quote → PO → Invoice → Actual)
            </span>
            <span>
              <i className="eb-edge-swatch eb-swatch-backlink" />
              <code>knowledge_backlink</code> (Obsidian [[Wikilink]] reference)
            </span>
          </div>

          {/* Main Split Layout: Canvas / Vault on Left, Live Node Inspector Drawer on Right */}
          <div className="eb-graph-workspace">
            {graphMode === "obsidian" ? (
              /* MODE B: OBSIDIAN KNOWLEDGE GRAPH OVERLAY & BIDIRECTIONAL WIKILINK VAULT */
              <div className="eb-vault-panel">
                <div className="eb-vault-sidebar">
                  <div className="eb-vault-sidebar-head">
                    <strong>Markdown Knowledge Notes</strong>
                    <button
                      type="button"
                      className="eb-btn-small"
                      onClick={() => handleAttachNote(selectedNode)}
                    >
                      + New [[Note]]
                    </button>
                  </div>

                  <div className="eb-tag-filter-row">
                    <button
                      type="button"
                      className={`eb-tag-chip ${activeTagFilter === "all" ? "is-active" : ""}`}
                      onClick={() => setActiveTagFilter("all")}
                    >
                      All notes
                    </button>
                    {allNoteTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`eb-tag-chip ${activeTagFilter === tag ? "is-active" : ""}`}
                        onClick={() => setActiveTagFilter(tag)}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>

                  <div className="eb-note-list">
                    {notes
                      .filter((n) => n.projectId === activeProject.id)
                      .filter((n) => {
                        if (activeTagFilter === "all") return true;
                        const parsed = extractWikilinks(n.content);
                        return parsed.tags.includes(activeTagFilter);
                      })
                      .map((note) => {
                        const parsed = extractWikilinks(note.content);
                        return (
                          <button
                            key={note.id}
                            type="button"
                            className={`eb-note-item ${activeNote.id === note.id ? "is-selected" : ""}`}
                            onClick={() => {
                              setActiveNoteId(note.id);
                              setSelectedNodeId(note.id);
                            }}
                          >
                            <strong>{note.title}</strong>
                            <small>
                              Attached: <code>{note.attachedToId}</code> ·{" "}
                              {parsed.wikilinks.length} [[links]]
                            </small>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="eb-vault-editor-area">
                  <div className="eb-vault-editor-head">
                    <div>
                      <span className="eyebrow">
                        Obsidian Markdown · Attached to {activeNote.attachedToType} (
                        {activeNote.attachedToId})
                      </span>
                      <input
                        aria-label="Knowledge note title"
                        className="eb-note-title-input"
                        value={activeNote.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNotes((prev) =>
                            prev.map((n) =>
                              n.id === activeNote.id ? { ...n, title: val } : n,
                            ),
                          );
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="eb-btn-secondary"
                      onClick={() => jumpToNode(activeNote.attachedToId)}
                    >
                      Inspect Attached Node ({activeNote.attachedToId}) →
                    </button>
                  </div>

                  {/* Quick Insert [[Wikilink]] Bar */}
                  <div className="eb-wikilink-insert-bar">
                    <span>Insert [[Wikilink]]:</span>
                    {projection.nodes
                      .filter((n) => n.nodeType !== "Knowledge_Notes")
                      .slice(0, 7)
                      .map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          className="eb-insert-chip"
                          onClick={() => {
                            const snippet = ` [[${n.id}|${n.label}]]`;
                            setNotes((prev) =>
                              prev.map((note) =>
                                note.id === activeNote.id
                                  ? {
                                      ...note,
                                      content: `${note.content}${snippet}`,
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : note,
                              ),
                            );
                          }}
                        >
                          + [[{n.id}]]
                        </button>
                      ))}
                  </div>

                  <div className="eb-vault-split">
                    <div className="eb-vault-pane">
                      <label htmlFor="eb-markdown-source" className="eb-pane-label">
                        Markdown Source (YAML frontmatter + [[TargetID|Alias]] + #tags)
                      </label>
                      <textarea
                        id="eb-markdown-source"
                        rows={10}
                        className="eb-markdown-textarea"
                        value={activeNote.content}
                        onChange={(e) => {
                          const nextContent = e.target.value;
                          setNotes((prev) =>
                            prev.map((n) =>
                              n.id === activeNote.id
                                ? {
                                    ...n,
                                    content: nextContent,
                                    updatedAt: new Date().toISOString(),
                                  }
                                : n,
                            ),
                          );
                        }}
                      />
                    </div>

                    <div className="eb-vault-pane">
                      <span className="eb-pane-label">
                        Interactive Wikilink Preview (1-Click Jump to Financial Node)
                      </span>
                      <div className="eb-markdown-preview">
                        {Object.keys(parsedActiveNote.frontmatter).length > 0 ? (
                          <div className="eb-frontmatter-bar">
                            {Object.entries(parsedActiveNote.frontmatter).map(([k, v]) => (
                              <span key={k}>
                                <strong>{k}:</strong> {String(v)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {renderNotePreviewWithWikilinks(activeNote.content)}
                      </div>

                      <div className="eb-backlink-explorer">
                        <strong>
                          Bidirectional Backlink Index (
                          {projection.backlinkIndex.edges.length} active graph edges)
                        </strong>
                        <div className="eb-backlink-grid">
                          {Object.entries(projection.backlinkIndex.byTarget).map(
                            ([targetId, links]) => (
                              <div key={targetId} className="eb-backlink-card">
                                <button
                                  type="button"
                                  className="eb-wikilink-pill"
                                  onClick={() => jumpToNode(targetId)}
                                >
                                  Target: [[{targetId}]]
                                </button>
                                <small>
                                  Referenced by {links.length} note(s):{" "}
                                  {links.map((l) => l.noteTitle).join(", ")}
                                </small>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : outlineFallback ? (
              /* RESPONSIVE OUTLINE TREE FALLBACK (390px Mobile & Accessibility View) */
              <div className="eb-outline-fallback" role="tree" aria-label="Hierarchical Financial Lineage Outline">
                <div className="eb-outline-banner">
                  <strong>Structured Outline Fallback (390px–1440px Zero-Overflow Tree)</strong>
                  <span>
                    Every node below maps 1:1 to a governed relational row. Tap any node to inspect its
                    Operational, Managerial, and Accounting views.
                  </span>
                </div>
                <div className="eb-outline-list">
                  {projection.nodes.map((node) => {
                    const depth =
                      node.nodeType === "Project"
                        ? 0
                        : node.nodeType === "Work_Packages"
                          ? 1
                          : node.nodeType === "Purchase_Items" ||
                              node.nodeType === "Knowledge_Notes"
                            ? 2
                            : node.nodeType === "Sourcing_Allocations"
                              ? 3
                              : 4;
                    const primaryAmount =
                      node.financials.plannedTotal ??
                      node.financials.amount ??
                      node.financials.approvedBudget ??
                      0;
                    const backlinksCount =
                      projection.backlinkIndex.byTarget[node.id]?.length ?? 0;

                    return (
                      <div
                        key={node.id}
                        role="treeitem"
                        aria-selected={selectedNode?.id === node.id}
                        className={`eb-outline-row eb-depth-${depth} ${selectedNode?.id === node.id ? "is-selected" : ""}`}
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        <div className="eb-outline-main">
                          <span className={`eb-node-badge ${NODE_TYPE_META[node.nodeType]?.toneClass || ""}`}>
                            {NODE_TYPE_META[node.nodeType]?.badge || node.nodeType}
                          </span>
                          <strong>{node.label}</strong>
                          <code>{node.id}</code>
                          {backlinksCount > 0 ? (
                            <span className="eb-backlink-badge">
                              [[{backlinksCount} note{backlinksCount > 1 ? "s" : ""}]]
                            </span>
                          ) : null}
                        </div>
                        <div className="eb-outline-metrics">
                          {node.nodeType !== "Knowledge_Notes" ? (
                            <strong>{money(primaryAmount, currency)}</strong>
                          ) : (
                            <span className="muted">Markdown Note</span>
                          )}
                          {(node.nodeType === "Project" ||
                            node.nodeType === "Work_Packages" ||
                            node.nodeType === "Purchase_Items") ? (
                            <button
                              type="button"
                              className="eb-collapse-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNodeCollapse(node.id);
                              }}
                            >
                              {node.mode === "collapsed" ? "Expand (+)" : "Collapse (−)"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* MODE A: INTERACTIVE VISUAL NODE GRAPH CANVAS (DAG) */
              <div
                className="eb-canvas-viewport"
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
              >
                <div
                  className="eb-canvas-stage"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "0 0",
                  }}
                >
                  {/* Column Lane Guides */}
                  <div className="eb-lane-guides" aria-hidden="true">
                    <span style={{ left: 28 }}>1 · Project Pool</span>
                    <span style={{ left: 265 }}>2 · Work Packages</span>
                    <span style={{ left: 510 }}>3 · Purchase Items &amp; [[Notes]]</span>
                    <span style={{ left: 760 }}>4 · Sourcing Allocations</span>
                    <span style={{ left: 1020 }}>5 · Quote → PO → Invoice / Actual</span>
                  </div>

                  {/* Typed SVG Edges Layer */}
                  <svg
                    className="eb-edges-svg"
                    viewBox="0 0 1280 540"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id="eb-arrow-containment"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,1 L7,4 L0,7 Z" fill="#6c726a" />
                      </marker>
                      <marker
                        id="eb-arrow-plink"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,1 L7,4 L0,7 Z" fill="#2e514a" />
                      </marker>
                      <marker
                        id="eb-arrow-transition"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,1 L7,4 L0,7 Z" fill="#925b18" />
                      </marker>
                      <marker
                        id="eb-arrow-backlink"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="4"
                        orient="auto"
                      >
                        <path d="M0,1 L7,4 L0,7 Z" fill="#4f5d75" />
                      </marker>
                    </defs>

                    {projection.edges.map((edge) => {
                      const sourceNode = projection.visibleNodes.find(
                        (n) => n.id === edge.source || n.recordId === edge.source,
                      );
                      const targetNode = projection.visibleNodes.find(
                        (n) => n.id === edge.target || n.recordId === edge.target,
                      );
                      if (!sourceNode || !targetNode) return null;

                      const x1 = sourceNode.x + 210;
                      const y1 = sourceNode.y + 42;
                      const x2 = targetNode.x;
                      const y2 = targetNode.y + 42;
                      const midX = (x1 + x2) / 2;
                      const pathD =
                        edge.type === "lifecycle_transition"
                          ? `M ${sourceNode.x + 105} ${sourceNode.y + 82} C ${sourceNode.x + 145} ${(y1 + y2) / 2}, ${targetNode.x + 145} ${(y1 + y2) / 2}, ${targetNode.x + 105} ${targetNode.y}`
                          : `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

                      const labelX =
                        edge.type === "lifecycle_transition"
                          ? sourceNode.x + 115
                          : midX;
                      const labelY =
                        edge.type === "lifecycle_transition"
                          ? (sourceNode.y + 82 + targetNode.y) / 2
                          : (y1 + y2) / 2 - 6;

                      return (
                        <g key={edge.id} className={`eb-edge-group eb-edge-${edge.type}`}>
                          <path
                            d={pathD}
                            className={`eb-edge-path eb-path-${edge.type}`}
                            markerEnd={`url(#eb-arrow-${edge.type === "purchase_link" ? "plink" : edge.type === "lifecycle_transition" ? "transition" : edge.type === "knowledge_backlink" ? "backlink" : "containment"})`}
                          />
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            className="eb-edge-label"
                          >
                            {edge.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Interactive Governed Nodes Layer */}
                  {projection.visibleNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const backlinks = projection.backlinkIndex.byTarget[node.id] || [];
                    const canCollapse =
                      node.nodeType === "Project" ||
                      node.nodeType === "Work_Packages" ||
                      node.nodeType === "Purchase_Items";

                    const primaryFigure =
                      node.nodeType === "Lifecycle_Lines"
                        ? money(Number(node.financials.amount || 0), currency)
                        : node.nodeType === "Knowledge_Notes"
                          ? "Obsidian Note"
                          : money(Number(node.financials.plannedTotal || 0), currency);

                    return (
                      <div
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${node.nodeType} node ${node.label}`}
                        className={`eb-graph-node ${NODE_TYPE_META[node.nodeType]?.toneClass || ""} ${isSelected ? "is-selected" : ""} ${node.mode === "collapsed" ? "is-collapsed" : ""}`}
                        style={{ left: `${node.x}px`, top: `${node.y}px` }}
                        onPointerDown={(e) => handleNodePointerDown(e, node)}
                        onClick={() => setSelectedNodeId(node.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedNodeId(node.id);
                          }
                        }}
                      >
                        <div className="eb-node-top">
                          <span className="eb-node-type-pill">
                            {NODE_TYPE_META[node.nodeType]?.badge || node.nodeType}
                          </span>
                          {canCollapse ? (
                            <button
                              type="button"
                              className="eb-node-collapse-toggle"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNodeCollapse(node.id);
                              }}
                              title={
                                node.mode === "collapsed"
                                  ? "Expand to governed row nodes"
                                  : "Collapse into summary roll-up"
                              }
                            >
                              {node.mode === "collapsed" ? "+ Roll-up" : "− Row"}
                            </button>
                          ) : null}
                        </div>

                        <strong className="eb-node-title">{node.label}</strong>

                        <div className="eb-node-meta">
                          <code>{node.id}</code>
                          <span className="eb-node-amount">{primaryFigure}</span>
                        </div>

                        {node.nodeType === "Purchase_Items" ? (
                          <div className="eb-node-subline">
                            Alloc: {node.financials.allocatedQuantity ?? 0}u · Unalloc:{" "}
                            {node.financials.unallocatedQuantity ?? 0}u
                          </div>
                        ) : null}

                        {node.nodeType === "Lifecycle_Lines" &&
                        Number(node.financials.openCommitment || 0) > 0 ? (
                          <div className="eb-node-subline eb-subline-warning">
                            Open PO: {money(Number(node.financials.openCommitment), currency)}
                          </div>
                        ) : null}

                        {backlinks.length > 0 ? (
                          <div className="eb-node-backlink-chip">
                            [[{backlinks.length} linked note{backlinks.length > 1 ? "s" : ""}]]
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LIVE NODE INSPECTOR DRAWER (Operational / Managerial / Accounting Views + Quick Actions) */}
            <aside className="eb-inspector-drawer" aria-label="Node Inspector Drawer">
              <div className="eb-inspector-head">
                <div>
                  <span className="eyebrow">
                    Node Inspector ·{" "}
                    {selectedNode?.mode === "collapsed"
                      ? "Collapsed Summary Roll-Up"
                      : "1:1 Governed Relational Row"}
                  </span>
                  <h3>{selectedNode?.label || "Select a node"}</h3>
                  <code className="eb-inspector-id">
                    {selectedNode?.nodeType} :: {selectedNode?.id}
                  </code>
                </div>
              </div>

              {/* Three Connected Perspectives Switcher */}
              <div
                className="eb-perspective-tabs"
                role="tablist"
                aria-label="Three connected spend perspectives"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorViewTab === "operational"}
                  className={inspectorViewTab === "operational" ? "is-active" : ""}
                  onClick={() => setInspectorViewTab("operational")}
                >
                  1. Operational
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorViewTab === "managerial"}
                  className={inspectorViewTab === "managerial" ? "is-active" : ""}
                  onClick={() => setInspectorViewTab("managerial")}
                >
                  2. Managerial
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorViewTab === "accounting"}
                  className={inspectorViewTab === "accounting" ? "is-active" : ""}
                  onClick={() => setInspectorViewTab("accounting")}
                >
                  3. Accounting
                </button>
              </div>

              {selectedNodePerspectives ? (
                <dl className="eb-perspective-list">
                  {selectedNodePerspectives[inspectorViewTab].map((row) => (
                    <div key={row.label} className="eb-perspective-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {/* Lineage Connections & Bidirectional Backlinks */}
              <div className="eb-inspector-section">
                <span className="eyebrow">
                  Typed Graph Edges ({selectedNodeEdges.incoming.length} in ·{" "}
                  {selectedNodeEdges.outgoing.length} out)
                </span>
                <div className="eb-lineage-chips">
                  {selectedNodeEdges.incoming.map((edge) => (
                    <button
                      key={edge.id}
                      type="button"
                      className="eb-lineage-chip"
                      onClick={() => jumpToNode(edge.source)}
                    >
                      ← {edge.type}: <code>{edge.source}</code>
                    </button>
                  ))}
                  {selectedNodeEdges.outgoing.map((edge) => (
                    <button
                      key={edge.id}
                      type="button"
                      className="eb-lineage-chip"
                      onClick={() => jumpToNode(edge.target)}
                    >
                      → {edge.type}: <code>{edge.target}</code>
                    </button>
                  ))}
                </div>
              </div>

              {/* Obsidian Backlinks on this Node */}
              <div className="eb-inspector-section">
                <span className="eyebrow">
                  Obsidian [[Knowledge Backlinks]] ({selectedNodeBacklinks.length})
                </span>
                {selectedNodeBacklinks.length > 0 ? (
                  <div className="eb-backlink-mini-list">
                    {selectedNodeBacklinks.map((bl, idx) => (
                      <button
                        key={`${bl.noteId}-${idx}`}
                        type="button"
                        className="eb-backlink-mini-btn"
                        onClick={() => {
                          setActiveNoteId(bl.noteId);
                          setGraphMode("obsidian");
                        }}
                      >
                        <strong>{bl.noteTitle}</strong>
                        <small>
                          <code>{bl.raw}</code> · {bl.tags.map((t) => `#${t}`).join(" ")}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="eb-empty-inline">
                    No [[Knowledge Note]] references this node yet.
                  </p>
                )}
              </div>

              {/* Inspector Quick Actions */}
              <div className="eb-inspector-actions">
                <span className="eyebrow">Governed Quick Actions</span>
                <div className="eb-quick-action-grid">
                  <button
                    type="button"
                    className="eb-action-btn"
                    onClick={() => setQuickCaptureOpen("item")}
                  >
                    + Add Purchase Item
                  </button>
                  <button
                    type="button"
                    className="eb-action-btn"
                    onClick={() => setQuickCaptureOpen("allocation")}
                  >
                    + Add Sourcing Allocation
                  </button>
                  <button
                    type="button"
                    className="eb-action-btn"
                    onClick={() => setQuickCaptureOpen("version")}
                  >
                    + Propose Budget Version
                  </button>
                  <button
                    type="button"
                    className="eb-action-btn"
                    onClick={() => handleAttachNote(selectedNode)}
                  >
                    + Attach [[Knowledge Note]]
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        /* SURFACE 2: AUDITABLE MODULAR TABLE WORKBENCH & CLEAR PLAN-VS-REALITY CHARTS */
        <div className="eb-surface-body">
          {/* Plan-vs-Reality Visual Analytics Grid */}
          <div className="eb-charts-grid">
            {/* Chart 1: Quarter Trajectory Chart (Q1-Q4 Approved vs Actuals+Open vs Forecast) */}
            <article className="eb-chart-card">
              <div className="eb-chart-head">
                <div>
                  <span className="eyebrow">Plan vs. Reality Trajectory</span>
                  <h3>Q1–Q4 Approved Baseline vs. Actuals, Open PO &amp; Forecast</h3>
                </div>
                <div className="eb-chart-legend">
                  <span>
                    <i className="eb-swatch-approved" />
                    Approved
                  </span>
                  <span>
                    <i className="eb-swatch-actual" />
                    Actual
                  </span>
                  <span>
                    <i className="eb-swatch-open" />
                    Open PO
                  </span>
                  <span>
                    <i className="eb-swatch-forecast" />
                    Uncommitted Plan
                  </span>
                </div>
              </div>

              <svg
                className="eb-quarter-svg"
                viewBox="0 0 520 200"
                role="img"
                aria-label="Quarter trajectory chart showing Q1 to Q4 Approved Baseline against Actuals, Open Commitments, and Forecast"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 165 - ratio * 135;
                  const val = Math.round(maxQuarterChartValue * ratio);
                  return (
                    <g key={idx}>
                      <line
                        x1="54"
                        y1={y}
                        x2="500"
                        y2={y}
                        stroke="#e2e0d8"
                        strokeDasharray={idx === 0 ? undefined : "3 3"}
                        strokeWidth={idx === 0 ? "1.5" : "1"}
                      />
                      <text x="48" y={y + 4} textAnchor="end" className="eb-svg-tick">
                        ${(val / 1000).toFixed(1)}k
                      </text>
                    </g>
                  );
                })}

                {quarterChartRows.map((row, idx) => {
                  const groupX = 82 + idx * 106;
                  const scale = (v: number) =>
                    Math.max(0, Math.min(135, (v / maxQuarterChartValue) * 135));

                  const hApproved = scale(row.approved);
                  const hActual = scale(row.actual);
                  const hOpen = scale(row.open);
                  const hUncommitted = scale(
                    Math.max(0, row.forecast - row.actual - row.open),
                  );

                  return (
                    <g key={row.quarter}>
                      {/* Approved Baseline Bar */}
                      <rect
                        x={groupX}
                        y={165 - hApproved}
                        width="24"
                        height={hApproved}
                        fill="#cfded6"
                      />
                      {/* Stacked Reality + Forecast Bar: Actual (bottom) + Open PO (mid) + Uncommitted (top) */}
                      <rect
                        x={groupX + 28}
                        y={165 - hActual}
                        width="24"
                        height={hActual}
                        fill="#2e514a"
                      />
                      <rect
                        x={groupX + 28}
                        y={165 - hActual - hOpen}
                        width="24"
                        height={hOpen}
                        fill="#c99a55"
                      />
                      <rect
                        x={groupX + 28}
                        y={165 - hActual - hOpen - hUncommitted}
                        width="24"
                        height={hUncommitted}
                        fill="#e6dec8"
                      />
                      <text
                        x={groupX + 26}
                        y="184"
                        textAnchor="middle"
                        className="eb-svg-xlabel"
                      >
                        {row.quarter}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="eb-chart-foot-table">
                {quarterChartRows.map((r) => (
                  <div key={r.quarter} className="eb-q-mini-cell">
                    <strong>{r.quarter}</strong>
                    <span>Plan: {money(r.planned, currency)}</span>
                    <span>Act+PO: {money(r.actual + r.open, currency)}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* Chart 2: Sourcing Allocation Split & Quantity Reconciliation */}
            <article className="eb-chart-card">
              <div className="eb-chart-head">
                <div>
                  <span className="eyebrow">Sourcing Allocation Breakdown</span>
                  <h3>Vendor, Warehouse &amp; Country Split (No Double Counting)</h3>
                </div>
                <span className="status-pill status-positive">
                  {selectedNodePerspectives?.allocValidation.status || "exact"}
                </span>
              </div>

              <div className="eb-bar-list">
                {projection.tables.Sourcing_Allocations.map((alloc) => {
                  const subtotal = Number(alloc.subtotal || 0);
                  const pct = Math.min(
                    100,
                    Math.round(
                      (subtotal / Math.max(1, projection.summary.plannedTotal)) * 100,
                    ),
                  );
                  return (
                    <div
                      key={String(alloc.allocation_id)}
                      className="eb-bar-row"
                      onClick={() => jumpToNode(String(alloc.allocation_id))}
                    >
                      <div className="eb-bar-row-top">
                        <strong>
                          {String(alloc.vendor_or_warehouse)} ·{" "}
                          {String(alloc.source_country)}
                        </strong>
                        <span className="eb-tabular">
                          {Number(alloc.quantity)}u · {money(subtotal, currency)} ({pct}%)
                        </span>
                      </div>
                      <div className="eb-bar-track">
                        <span
                          className="eb-bar-fill"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <small className="muted">
                        {String(alloc.source_type)} · Unit {money(Number(alloc.unit_price), currency)} + Extra{" "}
                        {money(Number(alloc.additional_cost_estimate), currency)} ·{" "}
                        {String(alloc.quarter)}
                      </small>
                    </div>
                  );
                })}
                {projection.tables.Sourcing_Allocations.length === 0 ? (
                  <p className="eb-empty-inline">
                    Requirement uses base Quantity × Unit Price ({money(projection.summary.plannedTotal, currency)}). Add a Sourcing Allocation to split across vendors.
                  </p>
                ) : null}
              </div>

              {/* Budget Version History Timeline */}
              <div className="eb-version-timeline">
                <span className="eyebrow">
                  Budget Version Lineage &amp; Authorization Boundary
                </span>
                {projection.tables.Budget_Versions.map((ver) => (
                  <div key={String(ver.version_id)} className="eb-version-item">
                    <span
                      className={`status-pill ${ver.authorization_state === "Approved" ? "status-positive" : "status-pending"}`}
                    >
                      v{String(ver.sequence)} · {String(ver.version_type)} ·{" "}
                      {String(ver.authorization_state)}
                    </span>
                    <strong className="eb-tabular">
                      {money(Number(ver.total || 0), String(ver.currency || currency))}
                    </strong>
                    <small>{String(ver.reason || "Baseline snapshot")}</small>
                  </div>
                ))}
              </div>
            </article>
          </div>

          {/* Canonical 11-Table Explorer */}
          <div className="eb-table-explorer">
            <div className="eb-table-explorer-head">
              <div>
                <span className="eyebrow">
                  Graph-to-Table Equivalence · Zero Black-Box State
                </span>
                <h3>Canonical Relational Table Switcher (11 Governed Tables)</h3>
              </div>

              <div className="eb-table-export-controls">
                <input
                  type="search"
                  aria-label="Filter rows in active canonical table"
                  className="eb-table-search"
                  placeholder={`Filter ${activeTable} rows...`}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="eb-btn-secondary"
                  onClick={() => handleExportCanonical("tsv", activeTable)}
                >
                  Copy {activeTable} TSV
                </button>
                <button
                  type="button"
                  className="eb-btn-secondary"
                  onClick={() => handleExportCanonical("markdown", activeTable)}
                >
                  Copy Markdown
                </button>
                <button
                  type="button"
                  className="eb-btn-primary"
                  onClick={() => handleExportCanonical("csv", "ALL")}
                >
                  Download All 11 Tables (CSV)
                </button>
              </div>
            </div>

            {exportBanner ? (
              <p className="eb-export-notice" role="status">
                {exportBanner}
              </p>
            ) : null}

            {/* 11 Table Switcher Pills with Row Count Badges */}
            <div
              className="eb-table-switcher"
              role="tablist"
              aria-label="11 Canonical Relational Tables"
            >
              {(CANONICAL_TABLE_NAMES as readonly CanonicalTableName[]).map((tName) => {
                const count = projection.tables[tName]?.length ?? 0;
                return (
                  <button
                    key={tName}
                    type="button"
                    role="tab"
                    aria-selected={activeTable === tName}
                    className={`eb-table-tab ${activeTable === tName ? "is-active" : ""}`}
                    onClick={() => setActiveTable(tName)}
                  >
                    <span>{tName}</span>
                    <strong className="eb-count-pill">{count}</strong>
                  </button>
                );
              })}
            </div>

            {/* Active Relational Table Grid (Rules & Alignment, Right-Aligned Tabular Numbers) */}
            <div className="eb-table-scroll">
              {filteredTableRows.length > 0 ? (
                <table className="eb-relational-table">
                  <thead>
                    <tr>
                      {Object.keys(filteredTableRows[0]).map((col) => (
                        <th
                          key={col}
                          className={
                            typeof filteredTableRows[0][col] === "number"
                              ? "is-numeric"
                              : ""
                          }
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTableRows.map((row, rIdx) => {
                      const rowId = String(
                        row.spending_line_id ||
                          row.allocation_id ||
                          row.work_package_id ||
                          row.document_line_id ||
                          row.note_id ||
                          row.project_id ||
                          `row-${rIdx}`,
                      );
                      return (
                        <tr
                          key={rowId + "-" + rIdx}
                          onClick={() => jumpToNode(rowId)}
                          className="eb-clickable-row"
                          title="Click to inspect corresponding graph node"
                        >
                          {Object.entries(row).map(([col, val]) => {
                            const isNum = typeof val === "number";
                            const isMoneyCol =
                              isNum &&
                              /budget|total|amount|price|subtotal|commitment|spend|headroom/i.test(
                                col,
                              );
                            const formatted = isMoneyCol
                              ? money(val as number, currency)
                              : isNum
                                ? String(val)
                                : Array.isArray(val)
                                  ? val.length
                                    ? val.join(", ")
                                    : "—"
                                  : val === null || val === undefined || val === ""
                                    ? "—"
                                    : safeSpreadsheetText(val);

                            return (
                              <td
                                key={col}
                                className={isNum ? "is-numeric eb-tabular" : ""}
                              >
                                {col === "gl_code" ? (
                                  <code>{formatted}</code>
                                ) : (
                                  formatted
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="eb-table-empty">
                  <strong>No rows in {activeTable} match current filter.</strong>
                  <span>—</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK CAPTURE INLINE SHEET (Triggered from Inspector or Mobile/Desktop Command Bar) */}
      {quickCaptureOpen ? (
        <div
          className="eb-quick-capture-sheet"
          role="dialog"
          aria-label={`Quick capture: ${quickCaptureOpen}`}
        >
          <div className="eb-quick-sheet-head">
            <strong>
              {quickCaptureOpen === "item"
                ? "+ Add Purchase Item Requirement"
                : quickCaptureOpen === "allocation"
                  ? "+ Add Sourcing Allocation Split"
                  : quickCaptureOpen === "version"
                    ? "+ Propose or Approve Budget Version Snapshot"
                    : "+ Log On-the-Fly Quotation / PO / Invoice Line"}
            </strong>
            <button
              type="button"
              className="eb-btn-small"
              onClick={() => setQuickCaptureOpen(null)}
            >
              Close ✕
            </button>
          </div>

          {quickCaptureOpen === "item" ? (
            <div className="eb-quick-form">
              <label>
                <span>Requirement Description</span>
                <input
                  value={quickItemName}
                  onChange={(e) => setQuickItemName(e.target.value)}
                  placeholder="Acrylic Fragrance Tester Tray"
                />
              </label>
              <label>
                <span>Specification</span>
                <input
                  value={quickItemSpec}
                  onChange={(e) => setQuickItemSpec(e.target.value)}
                />
              </label>
              <label>
                <span>Required Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={quickItemQty}
                  onChange={(e) => setQuickItemQty(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Base Unit Price ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={quickItemPrice}
                  onChange={(e) => setQuickItemPrice(Number(e.target.value))}
                />
              </label>
              <label>
                <span>GL Code (String)</span>
                <input
                  value={quickItemGl}
                  onChange={(e) => setQuickItemGl(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="eb-btn-primary"
                onClick={handleAddPurchaseItem}
              >
                Save Purchase Item ({money(quickItemQty * quickItemPrice, currency)})
              </button>
            </div>
          ) : quickCaptureOpen === "allocation" ? (
            <div className="eb-quick-form">
              <label>
                <span>Vendor or Warehouse</span>
                <input
                  value={quickAllocVendor}
                  onChange={(e) => setQuickAllocVendor(e.target.value)}
                />
              </label>
              <label>
                <span>Country</span>
                <input
                  value={quickAllocCountry}
                  onChange={(e) => setQuickAllocCountry(e.target.value)}
                />
              </label>
              <label>
                <span>Allocated Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={quickAllocQty}
                  onChange={(e) => setQuickAllocQty(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Unit Price ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={quickAllocPrice}
                  onChange={(e) => setQuickAllocPrice(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Freight / Extra Cost ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={quickAllocExtra}
                  onChange={(e) => setQuickAllocExtra(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                className="eb-btn-primary"
                onClick={handleAddAllocation}
              >
                Save Allocation (
                {money(quickAllocQty * quickAllocPrice + quickAllocExtra, currency)})
              </button>
            </div>
          ) : quickCaptureOpen === "version" ? (
            <div className="eb-quick-form">
              <label>
                <span>Authorization State</span>
                <select
                  value={quickVersionState}
                  onChange={(e) =>
                    setQuickVersionState(e.target.value as "Proposed" | "Approved")
                  }
                >
                  <option value="Proposed">Proposed (Does not raise Approved Baseline)</option>
                  <option value="Approved">Approved (Updates Effective Approved Baseline)</option>
                </select>
              </label>
              <label>
                <span>Version Total ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={quickVersionTotal}
                  onChange={(e) => setQuickVersionTotal(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Audit Reason</span>
                <input
                  value={quickVersionReason}
                  onChange={(e) => setQuickVersionReason(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="eb-btn-primary"
                onClick={handleCreateBudgetVersion}
              >
                Create Immutable Version Snapshot
              </button>
            </div>
          ) : (
            <div className="eb-quick-form">
              <label>
                <span>Lifecycle Stage</span>
                <select
                  value={quickExpenseStage}
                  onChange={(e) =>
                    setQuickExpenseStage(
                      e.target.value as "Quotation" | "Purchase order" | "Invoice",
                    )
                  }
                >
                  <option value="Quotation">Quotation</option>
                  <option value="Purchase order">Purchase order (Commitment)</option>
                  <option value="Invoice">Invoice / Actual (Converts Open PO)</option>
                </select>
              </label>
              <label>
                <span>Vendor</span>
                <input
                  value={quickExpenseVendor}
                  onChange={(e) => setQuickExpenseVendor(e.target.value)}
                />
              </label>
              <label>
                <span>Amount ({currency})</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={quickExpenseAmount}
                  onChange={(e) => setQuickExpenseAmount(Number(e.target.value))}
                />
              </label>
              <label>
                <span>Spend Quarter</span>
                <select
                  value={quickExpenseQuarter}
                  onChange={(e) =>
                    setQuickExpenseQuarter(e.target.value as WorkbenchQuarter)
                  }
                >
                  {QUARTERS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="eb-btn-primary"
                onClick={handleLogQuickExpense}
              >
                Record {quickExpenseStage} Line
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* SURFACE 3: RESPONSIVE MOBILE & DESKTOP ON-THE-FLY COMMAND BAR (390px–1440px) */}
      <div
        className="eb-command-bar"
        role="region"
        aria-label="Mobile and Desktop On-the-Fly Command Bar"
      >
        <div className="eb-command-status">
          <span className="eb-command-kicker">On-the-Fly Command Bar (390px–1440px)</span>
          <strong>
            Active: <code>{selectedNode?.id}</code> · Headroom{" "}
            {money(projection.summary.availableToCommit, currency)}
          </strong>
        </div>

        <div className="eb-command-actions">
          <button
            type="button"
            className="eb-cmd-btn"
            onClick={() => {
              setSurface("graph");
              setOutlineFallback((prev) => !prev);
            }}
          >
            {outlineFallback ? "Switch to Node Canvas" : "390px Outline Tree"}
          </button>

          <button
            type="button"
            className="eb-cmd-btn"
            onClick={() => setQuickCaptureOpen("expense")}
          >
            + Log Expense / Quote
          </button>

          <button
            type="button"
            className="eb-cmd-btn"
            onClick={() => setQuickCaptureOpen("version")}
          >
            + Propose Version
          </button>

          {versionGovernance.latestProposedVersion ? (
            <button
              type="button"
              className="eb-cmd-btn eb-cmd-approve"
              onClick={handleApprovePendingVersion}
            >
              ✓ Approve Pending Version (
              {money(Number(versionGovernance.latestProposedVersion.total || 0), currency)})
            </button>
          ) : null}

          <button
            type="button"
            className="eb-cmd-btn"
            onClick={() => setSurface(surface === "graph" ? "tables" : "graph")}
          >
            {surface === "graph" ? "Inspect 11 Tables →" : "← Back to Node Graph"}
          </button>
        </div>
      </div>
    </section>
  );
}
