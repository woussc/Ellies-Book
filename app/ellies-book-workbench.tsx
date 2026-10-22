"use client";

import {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CANONICAL_TABLE_NAMES,
  allocatedQuantity,
  allocationSubtotal,
  buildBacklinkIndex,
  buildHybridSyncReceipt,
  buildProjectGraphProjection,
  computeLifecycleLineage,
  createBudgetVersion,
  effectiveApprovedBudget,
  extractWikilinks,
  formatCanonicalTableDelimited,
  formatCanonicalTableMarkdown,
  parseObsidianVaultBundle,
  requirementTotal,
  safeSpreadsheetText,
  serializeProjectToObsidianVault,
  unallocatedQuantity,
  validateRequirementAllocations,
} from "./budget-domain.mjs";
import { renderMarkdownDocument } from "./markdown-render";

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

type JourneyStep = "overview" | "graph" | "vault" | "tables" | "classic";

const QUARTERS: WorkbenchQuarter[] = ["Q1", "Q2", "Q3", "Q4"];

/* ================================================================
   WS-B canvas geometry (ADR 0002 view-state only — these never feed
   totals, lineage, or the sync checksum; they are pure layout maths
   for the Obsidian-like infinite canvas).
   - NODE_WIDTH / NODE_HEIGHT: the rendered card footprint used for
     edge ports and bounding-box fits (matches .eb-graph-node CSS).
   - CANVAS_ZOOM_MIN/MAX: true wide zoom range (not the old 0.75-1.25).
   - CANVAS_PADDING: breathing room so the content box is never flush
     with the viewport edge and dragged nodes stay on an open canvas.
   ================================================================ */
const NODE_WIDTH = 205;
const NODE_HEIGHT = 84;
const NODE_PORT_Y = 42;
const CANVAS_ZOOM_MIN = 0.2;
const CANVAS_ZOOM_MAX = 3;
const CANVAS_PADDING = 220;
const CANVAS_MIN_WIDTH = 1220;
const CANVAS_MIN_HEIGHT = 480;

const SEED_PROJECTS: WorkbenchProject[] = [
  {
    id: "MKT-003",
    recordId: "record-mkt-003",
    generatedId: "GUC-MU+FRAG-0001",
    idSnapshot:
      "1:Brand house=Gucci(GUC) | 2:Product category=Make-up(MU)+Perfume(FRAG)",
    name: "FY27 Launch Campaign",
    purpose: "Coordinate a traceable POSM launch across sourcing allocations",
    description:
      "One POSM requirement split across Shenzhen, Ho Chi Minh City, and Dusseldorf warehouse stock.",
    tagIds: [
      "tag-intent-growth",
      "tag-campaign",
      "tag-gucci",
      "tag-makeup",
      "tag-perfume",
    ],
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
            mappingRationale:
              "Internal warehouse handling requires Finance review.",
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
    approvedAdjustmentComment:
      "Initial project approval for synthetic POSM scenario.",
    revisions: [
      {
        id: "ver-posm-1",
        status: "Approved",
        versionType: "Original",
        timestamp: "2026-08-15T09:00:00.000Z",
        comment:
          "Original approved baseline; allocation totals replace parent estimate.",
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
    purpose: "Test a focused demand-generation motion with traceable spend",
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
    reason:
      "Approved Original baseline ($11,600.00 USD) across 3 sourcing allocations",
    sourceRef: "QTE-POSM-2026-01",
  },
  {
    id: "audit-init-2",
    projectId: "MKT-003",
    actor: "Finance Controller",
    timestamp: "2026-09-14T16:20:00Z",
    action: "CONVERT_PO_TO_ACTUAL",
    targetId: "doc-line-inv-china",
    reason:
      "Converted $6,500.00 from PO-POSM-2026-01 to INV-POSM-2026-01 without double counting",
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
  Project: {
    badge: "Project",
    toneClass: "eb-node-project",
    columnTitle: "1 · Project",
  },
  Work_Packages: {
    badge: "Deliverable",
    toneClass: "eb-node-wp",
    columnTitle: "2 · Deliverable",
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
    badge: "Vendor Split",
    toneClass: "eb-node-alloc",
    columnTitle: "4 · Vendor Split",
  },
  Lifecycle_Records: {
    badge: "Document",
    toneClass: "eb-node-doc",
    columnTitle: "Document",
  },
  Lifecycle_Lines: {
    badge: "Order / Invoice",
    toneClass: "eb-node-lifecycle",
    columnTitle: "5 · Quote / PO / Invoice",
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
    badge: "Knowledge Note",
    toneClass: "eb-node-note",
    columnTitle: "Obsidian Note",
  },
  Audit_Events: {
    badge: "Audit Event",
    toneClass: "eb-node-audit",
    columnTitle: "Audit Log",
  },
};

// Inspector detail row. `title` is an optional hover tooltip that keeps the precise
// accounting term available to auditors while the visible label stays plain language.
type PerspectiveRow = { label: string; value: string; title?: string };

export function ElliesBookWorkbench({
  data,
  setData,
  classicStudioSlot,
  onOpenClassicTab,
  onLoadSampleData,
  attentionCount = 0,
}: {
  data: WorkbenchStudioData;
  setData: Dispatch<SetStateAction<WorkbenchStudioData>>;
  classicStudioSlot?: ReactNode;
  onOpenClassicTab?: (
    tab: "profile" | "library" | "plan" | "spend" | "monitor",
  ) => void;
  onLoadSampleData?: () => void;
  attentionCount?: number;
}) {
  // Primary User Journey Step: defaults to the Visual Workflow Map (graph) per ADR 0002,
  // so the graph-first canvas is the landing surface when a project opens.
  const [journeyStep, setJourneyStep] = useState<JourneyStep>("graph");
  // Mobile navigation drawer state (< 960px)
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  // Responsive Outline Fallback toggle inside the Visual Workflow Map (Step 1)
  const [outlineFallback, setOutlineFallback] = useState<boolean>(false);
  // Dual-mode graph lens (W7-T2): the structured spending flow is always shown;
  // this toggle adds the linked-notes overlay (Obsidian [[wikilink]] backlinks) on
  // top of it. Pure view state per ADR 0002 Coordinate Invariance: it only changes
  // which links render, never any amount, allocation, lineage, or table row.
  const [showNoteLinks, setShowNoteLinks] = useState<boolean>(true);

  // True only when the caller passed real project data. When false, the
  // graph canvas shows an honest empty frame (a single "Start a new project"
  // call to action) instead of the SEED_PROJECTS demo nodes. The seed set is
  // still used as a non-empty base for the rest of the surfaces so they never
  // render against an undefined project (ADR 0006 blank-landing honesty).
  const hasRealProjects =
    Array.isArray(data?.projects) && data.projects.length > 0;

  const effectiveProjects = useMemo<WorkbenchProject[]>(() => {
    if (Array.isArray(data?.projects) && data.projects.length > 0) {
      return data.projects;
    }
    return SEED_PROJECTS;
  }, [data?.projects]);

  const dataDocuments = data?.documents;
  const effectiveDocuments = useMemo<WorkbenchDocument[]>(() => {
    if (Array.isArray(dataDocuments) && dataDocuments.length > 0) {
      return dataDocuments;
    }
    return SEED_DOCUMENTS;
  }, [dataDocuments]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("MKT-003");
  const activeProject = useMemo<WorkbenchProject>(() => {
    return (
      effectiveProjects.find(
        (p) => p.id === selectedProjectId || p.recordId === selectedProjectId,
      ) ?? effectiveProjects[0]
    );
  }, [effectiveProjects, selectedProjectId]);

  // View State: Node coordinates (x, y), zoom, pan, and collapse state (strictly view metadata)
  const [nodeViewState, setNodeViewState] = useState<
    Record<string, NodeCanvasView>
  >({
    "MKT-003": { x: 24, y: 110, collapsed: false },
    "wp-posm-production": { x: 255, y: 46, collapsed: false },
    "wp-warehouse": { x: 255, y: 196, collapsed: false },
    "wp-installation": { x: 255, y: 336, collapsed: false },
    "line-paper-stand": { x: 490, y: 76, collapsed: false },
    "alloc-china": { x: 730, y: 32, collapsed: false },
    "alloc-vietnam": { x: 730, y: 168, collapsed: false },
    "alloc-eu": { x: 730, y: 304, collapsed: false },
    "doc-line-q-paper": { x: 970, y: 24, collapsed: false },
    "doc-line-po-china": { x: 970, y: 124, collapsed: false },
    "doc-line-inv-china": { x: 970, y: 224, collapsed: false },
    "doc-line-po-vn": { x: 970, y: 324, collapsed: false },
    "note-posm-sourcing": { x: 490, y: 310, collapsed: false },
    "note-customs-audit": { x: 730, y: 420, collapsed: false },
  });

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0,
  });
  // Obsidian-like empty-canvas pan: when the pointer grabs the viewport
  // background (not a node) we translate the whole stage. Pure view state.
  const [canvasPanStart, setCanvasPanStart] = useState<{
    px: number;
    py: number;
    panX: number;
    panY: number;
  } | null>(null);
  // The scroll/zoom viewport element; used to convert pointer coordinates
  // into stage/world coordinates so zoom-to-cursor and fit maths are exact.
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  const [notes, setNotes] = useState<KnowledgeNoteItem[]>(INITIAL_NOTES);
  const [auditEvents, setAuditEvents] =
    useState<AuditEventItem[]>(INITIAL_AUDIT_EVENTS);

  const [selectedNodeId, setSelectedNodeId] =
    useState<string>("line-paper-stand");
  const [inspectorViewTab, setInspectorViewTab] = useState<
    "operational" | "managerial" | "accounting"
  >("operational");

  const [activeNoteId, setActiveNoteId] =
    useState<string>("note-posm-sourcing");
  const [activeTagFilter, setActiveTagFilter] = useState<string>("all");

  const [activeTable, setActiveTable] =
    useState<CanonicalTableName>("Purchase_Items");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [exportBanner, setExportBanner] = useState<string>("");

  const [quickCaptureOpen, setQuickCaptureOpen] = useState<
    null | "item" | "allocation" | "version" | "expense"
  >(null);
  const [quickItemName, setQuickItemName] = useState<string>("");
  const [quickItemSpec, setQuickItemSpec] = useState<string>(
    "Counter display unit",
  );
  const [quickItemQty, setQuickItemQty] = useState<number>(200);
  const [quickItemPrice, setQuickItemPrice] = useState<number>(12);
  const [quickItemGl, setQuickItemGl] = useState<string>("001230");

  const [quickAllocVendor, setQuickAllocVendor] =
    useState<string>("Milan Display Hub");
  const [quickAllocCountry, setQuickAllocCountry] = useState<string>("Italy");
  const [quickAllocQty, setQuickAllocQty] = useState<number>(150);
  const [quickAllocPrice, setQuickAllocPrice] = useState<number>(9.5);
  const [quickAllocExtra, setQuickAllocExtra] = useState<number>(120);

  const [quickVersionReason, setQuickVersionReason] = useState<string>(
    "Air-freight buffer for Q1 store installation",
  );
  const [quickVersionTotal, setQuickVersionTotal] = useState<number>(13400);
  const [quickVersionState, setQuickVersionState] = useState<
    "Proposed" | "Approved"
  >("Proposed");

  const [quickExpenseStage, setQuickExpenseStage] = useState<
    "Quotation" | "Purchase order" | "Invoice"
  >("Invoice");
  const [quickExpenseVendor, setQuickExpenseVendor] =
    useState<string>("Vietnam vendor");
  const [quickExpenseAmount, setQuickExpenseAmount] = useState<number>(2000);
  const [quickExpenseQuarter, setQuickExpenseQuarter] =
    useState<WorkbenchQuarter>("Q1");

  const currency =
    data?.settings?.currency || activeProject?.approvedCurrency || "USD";

  // Build governed input payload for buildProjectGraphProjection, serializeProjectToObsidianVault, and buildHybridSyncReceipt
  const projectPayload = useMemo(() => {
    const projId = activeProject.id;
    const projectDocs = effectiveDocuments.filter((doc) =>
      doc.lines.some((line) => line.projectId === projId),
    );
    const projectDocLines = effectiveDocuments.flatMap((doc) =>
      doc.lines
        .filter((line) => line.projectId === projId)
        .map((line) => {
          const isPostedActual =
            doc.type === "Invoice" &&
            /actual|posted|settled|converted/i.test(doc.status || "");
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

    const enrichedItems = (activeProject.lines || []).map((line) => {
      const libItem = data?.library?.spendingItems?.find(
        (it) => it.id === line.spendingItemId,
      );
      const allocGl =
        line.allocations?.find(
          (a) => a.confirmedFinanceCode || a.suggestedFinanceCode,
        )?.confirmedFinanceCode ||
        line.allocations?.find((a) => a.suggestedFinanceCode)
          ?.suggestedFinanceCode;
      return {
        ...line,
        glCode: line.glCode || libItem?.glCode || allocGl || "001230",
      };
    });

    const rawRevs = Array.isArray(activeProject.revisions)
      ? activeProject.revisions
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
            projectId: projId,
            sequence: idx + 1,
            versionType:
              rev.versionType || (idx === 0 ? "Original" : "Adjustment"),
            authorizationState: isApproved ? "Approved" : "Proposed",
            reason: rev.comment || rev.approvedComment || "Version snapshot",
            total: isApproved
              ? Number(
                  rev.approvedAmount ||
                    activeProject.approvedAmount ||
                    rev.plannedTotal,
                )
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

    return {
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
        return;
      }
    } catch {
      // No cloud connection: the local-first copy is still safe on the device.
    }
    setSyncState("local");
    setSyncMessage(
      `Saved on this device. Cloud backup is not reachable right now. Reference ${syncReceipt.checksum}`,
    );
  }

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

  // The stage + edge SVG size grows to the node bounding box so nothing is
  // ever clipped, no matter how far a node is dragged. This replaces the old
  // fixed 1220x520 box that made edges "stop rendering" past the bound.
  // Both the stage and the SVG share this one 1:1 pixel coordinate space,
  // so edge ports stay attached to node ports at any pan/zoom/drag offset.
  const stageBounds = useMemo(() => {
    const nodes = projection.visibleNodes;
    if (nodes.length === 0) {
      return { width: CANVAS_MIN_WIDTH, height: CANVAS_MIN_HEIGHT };
    }
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT));
    return {
      width: Math.max(CANVAS_MIN_WIDTH, Math.ceil(maxX) + CANVAS_PADDING),
      height: Math.max(CANVAS_MIN_HEIGHT, Math.ceil(maxY) + CANVAS_PADDING),
    };
  }, [projection.visibleNodes]);

  const vaultBacklinkIndex = useMemo(
    () =>
      buildBacklinkIndex(notes.filter((n) => n.projectId === activeProject.id)),
    [notes, activeProject.id],
  );

  const directLineageCheck = useMemo(
    () =>
      computeLifecycleLineage({
        poLines: projection.tables.Lifecycle_Lines.filter(
          (l) => l.stage === "PO",
        ),
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
  }, [
    vaultBacklinkIndex.byTarget,
    projection.backlinkIndex.byTarget,
    selectedNode,
  ]);

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
          return (
            sum + requirementTotal(item) / Math.max(1, item.quarters.length)
          );
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
  }, [
    activeProject.lines,
    projection.summary.approvedBudget,
    projection.tables.Lifecycle_Lines,
  ]);

  const mutateStudioAndProject = (
    updater: (
      project: WorkbenchProject,
      docs: WorkbenchDocument[],
    ) => {
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

  // Convert a pointer's client coordinates into stage/world coordinates.
  // The stage carries transform: translate(pan) scale(zoom) with
  // transform-origin 0 0, so world = (client - viewportOrigin - pan) / zoom.
  // One shared projection keeps edges, node drag, zoom-to-cursor and fit
  // all in the SAME coordinate space (ADR 0002: view-state maths only).
  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    const originX = rect?.left ?? 0;
    const originY = rect?.top ?? 0;
    return {
      x: (clientX - originX - pan.x) / zoom,
      y: (clientY - originY - pan.y) / zoom,
    };
  };

  const handleNodePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    node: ProjectedNode,
  ) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    const world = clientToWorld(event.clientX, event.clientY);
    setDragOffset({
      dx: world.x - node.x,
      dy: world.y - node.y,
    });
  };

  // Pointer-down on the empty viewport background starts an Obsidian-style
  // canvas pan. Nodes stop propagation, so this only fires on open canvas.
  const handleCanvasPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if ((event.target as HTMLElement).closest(".eb-graph-node")) return;
    setCanvasPanStart({
      px: event.clientX,
      py: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
  };

  const handleCanvasPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (draggingNodeId) {
      const world = clientToWorld(event.clientX, event.clientY);
      const nextX = Math.round(world.x - dragOffset.dx);
      const nextY = Math.round(world.y - dragOffset.dy);
      setNodeViewState((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: nextX,
          y: nextY,
          collapsed: prev[draggingNodeId]?.collapsed ?? false,
        },
      }));
      return;
    }
    if (canvasPanStart) {
      setPan({
        x: canvasPanStart.panX + (event.clientX - canvasPanStart.px),
        y: canvasPanStart.panY + (event.clientY - canvasPanStart.py),
      });
    }
  };

  const handleCanvasPointerUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
    if (canvasPanStart) {
      setCanvasPanStart(null);
    }
  };

  // True wheel zoom toward the cursor across a wide range. We keep the
  // world point under the cursor fixed while scaling, which is the
  // Obsidian graph-view feel. Pure view state per ADR 0002.
  const handleCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    const originX = rect?.left ?? 0;
    const originY = rect?.top ?? 0;
    const pointerX = event.clientX - originX;
    const pointerY = event.clientY - originY;
    setZoom((prevZoom) => {
      const factor = Math.exp(-event.deltaY * 0.0015);
      const nextZoom = Math.min(
        CANVAS_ZOOM_MAX,
        Math.max(CANVAS_ZOOM_MIN, Number((prevZoom * factor).toFixed(3))),
      );
      if (nextZoom === prevZoom) return prevZoom;
      // Keep the world point under the cursor stationary.
      setPan((prevPan) => {
        const worldX = (pointerX - prevPan.x) / prevZoom;
        const worldY = (pointerY - prevPan.y) / prevZoom;
        return {
          x: pointerX - worldX * nextZoom,
          y: pointerY - worldY * nextZoom,
        };
      });
      return nextZoom;
    });
  };

  const zoomAtCenter = (nextZoomRaw: number) => {
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    const vw = rect?.width ?? CANVAS_MIN_WIDTH;
    const vh = rect?.height ?? CANVAS_MIN_HEIGHT;
    const centerX = vw / 2;
    const centerY = vh / 2;
    setZoom((prevZoom) => {
      const nextZoom = Math.min(
        CANVAS_ZOOM_MAX,
        Math.max(CANVAS_ZOOM_MIN, Number(nextZoomRaw.toFixed(3))),
      );
      if (nextZoom === prevZoom) return prevZoom;
      setPan((prevPan) => {
        const worldX = (centerX - prevPan.x) / prevZoom;
        const worldY = (centerY - prevPan.y) / prevZoom;
        return {
          x: centerX - worldX * nextZoom,
          y: centerY - worldY * nextZoom,
        };
      });
      return nextZoom;
    });
  };

  // Frame a set of world-space node coordinates inside the viewport with
  // padding by setting pan/zoom only. Used by fit-to-selected and
  // fit-to-all. Never mutates node geometry (ADR 0002 Coordinate Invariance).
  const fitToNodes = (nodes: ProjectedNode[]) => {
    if (nodes.length === 0) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT));
    const boxW = Math.max(1, maxX - minX);
    const boxH = Math.max(1, maxY - minY);
    const rect = canvasViewportRef.current?.getBoundingClientRect();
    const vw = rect?.width ?? CANVAS_MIN_WIDTH;
    const vh = rect?.height ?? CANVAS_MIN_HEIGHT;
    const pad = 64;
    const scaleX = (vw - pad * 2) / boxW;
    const scaleY = (vh - pad * 2) / boxH;
    const nextZoom = Math.min(
      CANVAS_ZOOM_MAX,
      Math.max(CANVAS_ZOOM_MIN, Number(Math.min(scaleX, scaleY).toFixed(3))),
    );
    // Centre the content box in the viewport at the new zoom.
    const boxCenterX = minX + boxW / 2;
    const boxCenterY = minY + boxH / 2;
    setZoom(nextZoom);
    setPan({
      x: vw / 2 - boxCenterX * nextZoom,
      y: vh / 2 - boxCenterY * nextZoom,
    });
  };

  const fitToSelectedNode = () => {
    if (!selectedNode) return;
    const neighbourIds = new Set<string>([selectedNode.id]);
    for (const edge of selectedNodeEdges.incoming) {
      neighbourIds.add(edge.source);
    }
    for (const edge of selectedNodeEdges.outgoing) {
      neighbourIds.add(edge.target);
    }
    const frameNodes = projection.visibleNodes.filter(
      (n) => neighbourIds.has(n.id) || neighbourIds.has(n.recordId),
    );
    fitToNodes(frameNodes.length > 0 ? frameNodes : [selectedNode]);
  };

  const fitToAllNodes = () => {
    fitToNodes(projection.visibleNodes);
  };

  const resetCanvasView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const jumpToNode = (targetId: string) => {
    const cleanId = targetId.trim();
    const matched = projection.nodes.find(
      (n) =>
        n.id.toLowerCase() === cleanId.toLowerCase() ||
        n.recordId.toLowerCase() === cleanId.toLowerCase() ||
        n.label.toLowerCase() === cleanId.toLowerCase(),
    );
    if (matched) {
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
      setJourneyStep("graph");
    }
  };

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
          adjustmentComment: "Added from project workbench",
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
        sourceRef: "Project Workbench",
      },
    );
    setSelectedNodeId(lineId);
    setQuickItemName("");
    setQuickCaptureOpen(null);
  };

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
            mappingRationale:
              "Contextual allocation inherits GL precedent 001230",
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
          approvedAmount: isApproved
            ? Number(quickVersionTotal)
            : proj.approvedAmount,
          approvedCurrency: currency,
          approvedComment: quickVersionReason.trim(),
          plannedTotal: Number(quickVersionTotal),
          changedFields: ["budgetVersion"],
        };
        return {
          project: {
            ...proj,
            approvedAmount: isApproved
              ? Number(quickVersionTotal)
              : proj.approvedAmount,
            revisions: [...proj.revisions, nextRev],
            currentRevisionId: verId,
          },
          docs,
        };
      },
      {
        actor: data?.profile?.plannerName || "Planner",
        action: isApproved
          ? "APPROVE_BUDGET_VERSION"
          : "PROPOSE_BUDGET_VERSION",
        targetId: verId,
        reason: `${quickVersionState} version (${money(quickVersionTotal, currency)}): ${quickVersionReason}`,
        sourceRef: activeProject.id,
      },
    );
    setQuickCaptureOpen(null);
  };

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
          approvedComment: "Approved via governance action",
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
        "Verify vendor specification, delivery milestone, and GL code `001230`.",
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
    setJourneyStep("vault");
  };

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
            quickExpenseStage === "Invoice"
              ? "Posted to Actuals"
              : "Open commitment",
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
      setExportBanner(
        `Prepared ${scope} export (use CSV download if clipboard is blocked)`,
      );
    }
  };

  const filteredTableRows = useMemo(() => {
    const rows = projection.tables[activeTable] || [];
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((val) =>
        String(Array.isArray(val) ? val.join(" ") : (val ?? ""))
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [projection.tables, activeTable, tableSearch]);

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
      projection.tables.Work_Packages.find(
        (r) => r.work_package_id === node.id,
      ) ?? projection.tables.Work_Packages[0];

    const rawItem =
      activeProject.lines.find(
        (l) => l.id === (itemRow?.spending_line_id ?? ""),
      ) ?? activeProject.lines[0];
    const allocValidation = validateRequirementAllocations(rawItem || {});
    const allocQty = allocatedQuantity(rawItem || {});
    const unallocQty = unallocatedQuantity(rawItem || {});

    const glCodeString = String(
      itemRow?.gl_code || rawItem?.glCode || "001230",
    ).padStart(6, "0");

    return {
      operational: [
        {
          label: "Node type & table",
          value: `${NODE_TYPE_META[node.nodeType]?.badge || node.nodeType} (${node.nodeType})`,
        },
        { label: "Record ID", value: node.recordId },
        {
          label: "Item or deliverable",
          value: String(
            allocRow?.vendor_or_warehouse ||
              lineRow?.description ||
              itemRow?.description ||
              node.label,
          ),
        },
        {
          label: "Specification & unit",
          value: `${itemRow?.specification || "A4, 350 gsm"} · ${itemRow?.unit_of_measure || "units"}`,
        },
        {
          label: "Quantity reconciliation",
          value: `${allocQty} allocated / ${allocValidation.required} required (${unallocQty} unallocated · ${allocValidation.status})`,
        },
        {
          label: "Vendor & country",
          value: allocRow
            ? `${allocRow.vendor_or_warehouse} · ${allocRow.source_country} (${allocRow.source_type})`
            : "Multi-vendor split (China, Vietnam, Germany)",
        },
      ] as PerspectiveRow[],
      managerial: [
        {
          label: "Project initiative",
          value: `${activeProject.id} · ${activeProject.name}`,
        },
        {
          label: "Deliverable stream",
          value: `${wpRow?.name || "General"} (${wpRow?.work_package_id || "wp-general"})`,
        },
        {
          label: "Authorization boundary",
          value: `Approved baseline ${money(projection.summary.approvedBudget, currency)} · ${versionGovernance.pendingDelta !== 0 ? `Pending delta ${money(versionGovernance.pendingDelta, currency)}` : "Aligned"}`,
        },
        {
          label: "Remaining to commit",
          value: money(projection.summary.availableToCommit, currency),
        },
        {
          label: "Outcome progress",
          value: activeProject.outcomes[0]
            ? `${activeProject.outcomes[0].outcomeNameSnapshot || "Shelf execution coverage"}: ${activeProject.outcomes[0].current} / ${activeProject.outcomes[0].target} (Expected contribution, never proven causation)`
            : "Expected contribution tracked separately from spend",
        },
        // The inspector backlink row follows the "Show on map" lens (W7-T2): when the
        // linked-notes overlay is off, the drill-down also hides linked-note counts so
        // the inspector matches the map. Pure view state; no financial value changes.
        ...(showNoteLinks
          ? [
              {
                label: "Knowledge backlinks",
                value: `${selectedNodeBacklinks.length} linked note(s)`,
              },
            ]
          : []),
      ] as PerspectiveRow[],
      accounting: [
        {
          label: "Official GL code",
          value: glCodeString,
        },
        {
          label: "Fiscal period & quarter",
          value: `${activeProject.period || "FY2027"} · ${String(allocRow?.quarter || lineRow?.spend_quarter || "Q1")}`,
        },
        {
          label: "Reporting currency",
          value: `${currency} (Stationary rate basis)`,
        },
        {
          label: "Recognized actuals",
          value: money(projection.summary.actualTotal, currency),
        },
        {
          label: "Ordered, not yet paid",
          title: "Open PO commitment",
          value: `${money(projection.summary.openCommitmentTotal, currency)} (Lineage verified: ${money(directLineageCheck.openCommitmentTotal, currency)})`,
        },
        {
          label: "Finance mapping status",
          value: "Contextual human confirmation required",
        },
      ] as PerspectiveRow[],
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
    showNoteLinks,
  ]);

  const allNoteTags = useMemo(() => {
    return Object.keys(projection.backlinkIndex.byTag);
  }, [projection.backlinkIndex.byTag]);

  // WS-C: render the authored markdown as a polished, document-grade reading
  // experience (headings, paragraphs, lists, blockquotes, emphasis, code), not a
  // flat wall of <p> lines. The `[[wikilink]]` -> jumpToNode and `#tag` -> tag
  // filter pills keep their exact existing behaviour; parsing stays in the pure
  // engine (`extractWikilinks`). See app/markdown-render.tsx.
  const renderNotePreviewWithWikilinks = (markdown: string) =>
    renderMarkdownDocument(markdown, {
      onWikilink: (target) => jumpToNode(target),
      onTag: (tag) => setActiveTagFilter(tag),
    });

  const maxQuarterChartValue = useMemo(() => {
    const vals = quarterChartRows.flatMap((r) => [
      r.approved,
      r.planned,
      r.actual + r.open,
      r.forecast,
    ]);
    return Math.max(2000, ...vals, 1);
  }, [quarterChartRows]);

  const budgetDenominator = Math.max(
    projection.summary.approvedBudget,
    projection.summary.actualTotal + projection.summary.openCommitmentTotal,
    1,
  );
  const actualPct = Math.round(
    (projection.summary.actualTotal / budgetDenominator) * 100,
  );
  const openPoPct = Math.round(
    (projection.summary.openCommitmentTotal / budgetDenominator) * 100,
  );

  // Build rows for the Overview "The plan" table (6 columns; audit fields kept as secondary text)
  const overviewPurchaseRows = useMemo(() => {
    const rows: Array<{
      id: string;
      deliverable: string;
      item: string;
      glCode: string;
      vendor: string;
      location: string;
      quarter: string;
      costText: string;
      extraText: string;
      subtotal: number;
      status: string;
      statusTone: "status-positive" | "status-pending" | "status-muted";
    }> = [];

    for (const line of activeProject.lines || []) {
      const wp = (activeProject.workPackages || []).find(
        (w) => w.id === line.workPackageId,
      );
      const deliverableName = wp?.name || "Core deliverable";
      const itemName = line.itemNameSnapshot || "Requirement";
      const glCode = line.glCode || "001230";
      const allocs = line.allocations || [];

      if (allocs.length > 0) {
        for (const alloc of allocs) {
          const hasInvoice = projection.tables.Lifecycle_Lines.some(
            (dl) =>
              dl.allocation_id === alloc.id &&
              (dl.stage === "Actual" || dl.stage === "Invoice"),
          );
          const hasPo = projection.tables.Lifecycle_Lines.some(
            (dl) => dl.allocation_id === alloc.id && dl.stage === "PO",
          );
          rows.push({
            id: alloc.id,
            deliverable: deliverableName,
            item: itemName,
            glCode,
            vendor: alloc.vendorOrWarehouse,
            location: alloc.sourceLocation || alloc.sourceCountry,
            quarter: alloc.quarter,
            costText: `${alloc.quantity} × ${money(alloc.unitPrice, currency)}`,
            extraText:
              alloc.additionalCostEstimate > 0
                ? `+ ${money(alloc.additionalCostEstimate, currency)} freight`
                : "",
            subtotal: allocationSubtotal(alloc),
            status: hasInvoice ? "Paid" : hasPo ? "Ordered" : "Planned",
            statusTone: hasInvoice
              ? "status-positive"
              : hasPo
                ? "status-pending"
                : "status-muted",
          });
        }
      } else {
        rows.push({
          id: line.id,
          deliverable: deliverableName,
          item: itemName,
          glCode,
          vendor: "No supplier yet",
          location: "Estimate only",
          quarter: line.quarters?.[0] || "Q1",
          costText: `${line.quantity} × ${money(line.unitPrice, currency)}`,
          extraText: "",
          subtotal: requirementTotal(line),
          status: "Planned",
          statusTone: "status-muted",
        });
      }
    }
    return rows;
  }, [
    activeProject.lines,
    activeProject.workPackages,
    projection.tables.Lifecycle_Lines,
    currency,
  ]);

  // Plain-language KPI helpers (finance terms stay available as tooltips)
  const approvedRevisions = (activeProject.revisions || [])
    .filter((r) => r.status === "Approved")
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const latestApprovedRevision =
    approvedRevisions[approvedRevisions.length - 1];
  const approvedOnText = latestApprovedRevision
    ? new Date(latestApprovedRevision.timestamp).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
  const supplierCount = new Set(
    projection.tables.Sourcing_Allocations.map((a) =>
      String(a.vendor_or_warehouse),
    ),
  ).size;
  const quickCaptureTitle =
    quickCaptureOpen === "item"
      ? "Add an item"
      : quickCaptureOpen === "allocation"
        ? "Split an item across suppliers"
        : quickCaptureOpen === "version"
          ? "Propose or approve a budget change"
          : "Record a quote, order or invoice";

  return (
    <div className="eb-framed-shell">
      {/* LEFT SIDEBAR (228px on desktop, compact 48px top bar on <960px) */}
      <aside className="eb-sidebar" aria-label="Workspace navigation">
        <div className="eb-sidebar-top">
          <div className="eb-brand">
            <span className="eb-monogram" aria-hidden="true">
              EB
            </span>
            <div>
              <strong className="eb-brand-title">Ellie&apos;s Book</strong>
              <span className="eb-brand-sub">Function Budget Studio</span>
            </div>
          </div>

          <button
            type="button"
            className="eb-mobile-menu-btn"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            {mobileNavOpen ? "Close menu" : "Menu"}
          </button>
        </div>

        <div
          className={`eb-sidebar-Variable ${mobileNavOpen ? "is-open" : ""}`}
        >
          <label className="eb-sidebar-project">
            <span>Active project</span>
            <select
              aria-label="Select active project"
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

          <nav className="eb-nav-list" aria-label="Project journey">
            <span className="eb-nav-group-label">Project workspace</span>
            <button
              type="button"
              className={`eb-nav-item ${journeyStep === "graph" ? "is-active" : ""}`}
              onClick={() => {
                setJourneyStep("graph");
                setMobileNavOpen(false);
              }}
            >
              <span>1. Workflow map</span>
              <span className="eb-count-pill">{projection.nodes.length}</span>
            </button>
            <button
              type="button"
              className={`eb-nav-item ${journeyStep === "overview" ? "is-active" : ""}`}
              onClick={() => {
                setJourneyStep("overview");
                setMobileNavOpen(false);
              }}
            >
              <span>2. Overview</span>
              <span className="eb-count-pill">
                {overviewPurchaseRows.length}
              </span>
            </button>
            <button
              type="button"
              className={`eb-nav-item ${journeyStep === "vault" ? "is-active" : ""}`}
              onClick={() => {
                setJourneyStep("vault");
                setMobileNavOpen(false);
              }}
            >
              <span>3. Notes</span>
              <span className="eb-count-pill">
                {notes.filter((n) => n.projectId === activeProject.id).length}
              </span>
            </button>
            <button
              type="button"
              className={`eb-nav-item ${journeyStep === "tables" ? "is-active" : ""}`}
              onClick={() => {
                setJourneyStep("tables");
                setMobileNavOpen(false);
              }}
            >
              <span>4. Reports &amp; export</span>
              <span className="eb-count-pill">
                {CANONICAL_TABLE_NAMES.length}
              </span>
            </button>
          </nav>

          <div className="eb-nav-list">
            <span className="eb-nav-group-label">Setup</span>
            <button
              type="button"
              className={`eb-nav-item ${journeyStep === "classic" ? "is-active" : ""}`}
              onClick={() => {
                onOpenClassicTab?.("library");
                setJourneyStep("classic");
                setMobileNavOpen(false);
              }}
            >
              <span>Function Library</span>
            </button>
            <button
              type="button"
              className="eb-nav-item"
              onClick={() => {
                onOpenClassicTab?.("plan");
                setJourneyStep("classic");
                setMobileNavOpen(false);
              }}
            >
              <span>Plan &amp; Budgeting</span>
            </button>
            <button
              type="button"
              className="eb-nav-item"
              onClick={() => {
                onOpenClassicTab?.("profile");
                setJourneyStep("classic");
                setMobileNavOpen(false);
              }}
            >
              <span>Needs attention</span>
              {attentionCount > 0 ? (
                <span className="eb-count-pill">{attentionCount}</span>
              ) : null}
            </button>
          </div>

          {onLoadSampleData ? (
            <div className="eb-sidebar-utility">
              <button
                type="button"
                className="eb-sidebar-utility-btn"
                onClick={() => {
                  onLoadSampleData();
                  setMobileNavOpen(false);
                }}
              >
                <span>Sample data / Developer</span>
              </button>
              <span className="eb-sidebar-utility-note">
                Loads a complete example project onto the blank workspace.
              </span>
            </div>
          ) : null}

          <div className="eb-sidebar-footer">
            <span className="eb-save-indicator" aria-hidden="true" />
            <span>Saved on this device</span>
          </div>
        </div>
      </aside>

      {/* MAIN FRAMED WHITE SHEET */}
      <section
        className="eb-workbench"
        aria-label="Ellie's Book Project Budget and Workflow Sheet"
      >
        {journeyStep === "classic" && classicStudioSlot ? (
          <div className="eb-classic-wrapper">
            <div className="eb-classic-banner">
              <div>
                <strong>Function Budget Studio · Governance &amp; Setup</strong>
                <span>
                  Manage function presets, reusable spending definitions, and
                  profile settings.
                </span>
              </div>
              <button
                type="button"
                className="eb-btn-primary"
                onClick={() => setJourneyStep("overview")}
              >
                ← Back to Project Overview
              </button>
            </div>
            {classicStudioSlot}
          </div>
        ) : (
          <>
            {/* Sheet Header: Single 22px h1, plain-English finding, and primary actions */}
            <header className="eb-header">
              <div className="eb-header-title">
                <div className="eb-title-meta">
                  <span>
                    {data?.profile?.functionName || "Marketing & Brand"} ·{" "}
                    {activeProject.period || "FY2027"} ·{" "}
                    <code>{activeProject.id}</code>
                  </span>
                </div>
                <h1 className="eb-heading">{activeProject.name}</h1>
                <p className="eb-subtitle">
                  {activeProject.purpose} —{" "}
                  <strong>
                    {money(projection.summary.availableToCommit, currency)}{" "}
                    left to spend
                  </strong>{" "}
                  of {money(projection.summary.approvedBudget, currency)}{" "}
                  approved budget.
                </p>
              </div>

              <div className="eb-header-controls">
                <button
                  type="button"
                  className="eb-btn-primary"
                  onClick={() => {
                    onOpenClassicTab?.("plan");
                    setJourneyStep("classic");
                    setMobileNavOpen(false);
                  }}
                >
                  + Start a new project
                </button>
                <button
                  type="button"
                  className="eb-btn-secondary"
                  onClick={() => setQuickCaptureOpen("item")}
                >
                  + Add item
                </button>
                <button
                  type="button"
                  className="eb-btn-secondary"
                  onClick={() => setQuickCaptureOpen("expense")}
                >
                  + Record a quote or invoice
                </button>
                <button
                  type="button"
                  className="eb-btn-secondary"
                  onClick={() => handleAttachNote(selectedNode)}
                >
                  + Add note
                </button>
              </div>
            </header>

            {/* Quick capture: essentials first, optional fields folded away; bottom sheet on phones */}
            {quickCaptureOpen ? (
              <>
                <button
                  type="button"
                  className="eb-quick-backdrop"
                  aria-label="Close form"
                  onClick={() => setQuickCaptureOpen(null)}
                />
                <div
                  className="eb-quick-capture-sheet"
                  role="dialog"
                  aria-label={quickCaptureTitle}
                >
                  <div className="eb-quick-sheet-head">
                    <strong>{quickCaptureTitle}</strong>
                    <button
                      type="button"
                      className="eb-btn-small"
                      onClick={() => setQuickCaptureOpen(null)}
                    >
                      Close
                    </button>
                  </div>

                  {quickCaptureOpen === "item" ? (
                    <div className="eb-quick-form">
                      <label className="is-wide">
                        <span>What do you need?</span>
                        <input
                          value={quickItemName}
                          onChange={(e) => setQuickItemName(e.target.value)}
                          placeholder="e.g. Acrylic tester tray"
                        />
                      </label>
                      <label>
                        <span>Quantity</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={quickItemQty}
                          onChange={(e) =>
                            setQuickItemQty(Number(e.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>Price per unit ({currency})</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.5"
                          value={quickItemPrice}
                          onChange={(e) =>
                            setQuickItemPrice(Number(e.target.value))
                          }
                        />
                      </label>
                      <details className="eb-quick-more">
                        <summary>More details (optional)</summary>
                        <div className="eb-quick-form">
                          <label className="is-wide">
                            <span>Specification</span>
                            <input
                              value={quickItemSpec}
                              onChange={(e) => setQuickItemSpec(e.target.value)}
                            />
                          </label>
                          <label>
                            <span>Finance (GL) code</span>
                            <input
                              value={quickItemGl}
                              onChange={(e) => setQuickItemGl(e.target.value)}
                            />
                          </label>
                        </div>
                      </details>
                      <button
                        type="button"
                        className="eb-btn-primary eb-quick-save"
                        onClick={handleAddPurchaseItem}
                      >
                        Save item · {money(quickItemQty * quickItemPrice, currency)}
                      </button>
                    </div>
                  ) : quickCaptureOpen === "allocation" ? (
                    <div className="eb-quick-form">
                      <label className="is-wide">
                        <span>Supplier or warehouse</span>
                        <input
                          value={quickAllocVendor}
                          onChange={(e) => setQuickAllocVendor(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Quantity</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={quickAllocQty}
                          onChange={(e) =>
                            setQuickAllocQty(Number(e.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>Price per unit ({currency})</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.5"
                          value={quickAllocPrice}
                          onChange={(e) =>
                            setQuickAllocPrice(Number(e.target.value))
                          }
                        />
                      </label>
                      <details className="eb-quick-more">
                        <summary>More details (optional)</summary>
                        <div className="eb-quick-form">
                          <label>
                            <span>Country</span>
                            <input
                              value={quickAllocCountry}
                              onChange={(e) =>
                                setQuickAllocCountry(e.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>Freight / extra ({currency})</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="10"
                              value={quickAllocExtra}
                              onChange={(e) =>
                                setQuickAllocExtra(Number(e.target.value))
                              }
                            />
                          </label>
                        </div>
                      </details>
                      <button
                        type="button"
                        className="eb-btn-primary eb-quick-save"
                        onClick={handleAddAllocation}
                      >
                        Save split ·{" "}
                        {money(
                          quickAllocQty * quickAllocPrice + quickAllocExtra,
                          currency,
                        )}
                      </button>
                    </div>
                  ) : quickCaptureOpen === "version" ? (
                    <div className="eb-quick-form">
                      <label className="is-wide">
                        <span>What should happen?</span>
                        <select
                          value={quickVersionState}
                          onChange={(e) =>
                            setQuickVersionState(
                              e.target.value as "Proposed" | "Approved",
                            )
                          }
                        >
                          <option value="Proposed">
                            Propose a change (needs approval)
                          </option>
                          <option value="Approved">
                            Approve now (changes the budget)
                          </option>
                        </select>
                      </label>
                      <label>
                        <span>New total ({currency})</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="100"
                          value={quickVersionTotal}
                          onChange={(e) =>
                            setQuickVersionTotal(Number(e.target.value))
                          }
                        />
                      </label>
                      <label>
                        <span>Reason</span>
                        <input
                          value={quickVersionReason}
                          onChange={(e) => setQuickVersionReason(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="eb-btn-primary eb-quick-save"
                        onClick={handleCreateBudgetVersion}
                      >
                        Save budget change
                      </button>
                    </div>
                  ) : (
                    <div className="eb-quick-form">
                      <label className="is-wide">
                        <span>What is it?</span>
                        <select
                          value={quickExpenseStage}
                          onChange={(e) =>
                            setQuickExpenseStage(
                              e.target.value as
                                | "Quotation"
                                | "Purchase order"
                                | "Invoice",
                            )
                          }
                        >
                          <option value="Quotation">Quote (no money yet)</option>
                          <option value="Purchase order">
                            Purchase order (money committed)
                          </option>
                          <option value="Invoice">Invoice (money paid)</option>
                        </select>
                      </label>
                      <label>
                        <span>Supplier</span>
                        <input
                          value={quickExpenseVendor}
                          onChange={(e) => setQuickExpenseVendor(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Amount ({currency})</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="50"
                          value={quickExpenseAmount}
                          onChange={(e) =>
                            setQuickExpenseAmount(Number(e.target.value))
                          }
                        />
                      </label>
                      <details className="eb-quick-more">
                        <summary>More details (optional)</summary>
                        <div className="eb-quick-form">
                          <label>
                            <span>Quarter</span>
                            <select
                              value={quickExpenseQuarter}
                              onChange={(e) =>
                                setQuickExpenseQuarter(
                                  e.target.value as WorkbenchQuarter,
                                )
                              }
                            >
                              {QUARTERS.map((q) => (
                                <option key={q} value={q}>
                                  {q}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </details>
                      <button
                        type="button"
                        className="eb-btn-primary eb-quick-save"
                        onClick={handleLogQuickExpense}
                      >
                        Save {quickExpenseStage === "Quotation"
                          ? "quote"
                          : quickExpenseStage === "Invoice"
                            ? "invoice"
                            : "purchase order"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {/* KPI strip: plain-language labels; finance terms kept as tooltips for auditors */}
            <div
              className="eb-kpi-strip"
              role="region"
              aria-label="Project budget summary"
            >
              <div
                className="eb-kpi-cell eb-kpi-lead"
                title="Finance term: available to commit = approved budget − actuals − open purchase orders"
              >
                <span className="eb-kpi-label">Left to spend</span>
                <strong
                  className={`eb-kpi-figure ${projection.summary.availableToCommit < 0 ? "is-negative" : "is-positive"}`}
                >
                  {money(projection.summary.availableToCommit, currency)}
                </strong>
                <span className="eb-kpi-sub">
                  Budget minus what is paid or ordered
                </span>
              </div>

              <div
                className="eb-kpi-cell"
                title={`Latest approved budget version: ${versionGovernance.baselineVersionId || latestApprovedRevision?.id || "none"}`}
              >
                <span className="eb-kpi-label">Approved budget</span>
                <strong className="eb-kpi-figure">
                  {money(projection.summary.approvedBudget, currency)}
                </strong>
                <span className="eb-kpi-sub">
                  {approvedOnText
                    ? `Signed off ${approvedOnText}`
                    : "Not signed off yet"}
                  {versionGovernance.latestProposedVersion
                    ? " · 1 change waiting"
                    : ""}
                </span>
              </div>

              <div
                className="eb-kpi-cell"
                title="Finance term: planned cost = sum of supplier splits (replaces the base estimate)"
              >
                <span className="eb-kpi-label">Planned cost</span>
                <strong className="eb-kpi-figure">
                  {money(projection.summary.plannedTotal, currency)}
                </strong>
                <span className="eb-kpi-sub">
                  Across {supplierCount}{" "}
                  {supplierCount === 1 ? "supplier" : "suppliers"}
                </span>
              </div>

              <div
                className="eb-kpi-cell"
                title="Finance term: actuals + open purchase-order commitments"
              >
                <span className="eb-kpi-label">Paid &amp; ordered</span>
                <strong className="eb-kpi-figure">
                  {money(
                    projection.summary.actualTotal +
                      projection.summary.openCommitmentTotal,
                    currency,
                  )}
                </strong>
                <span className="eb-kpi-sub">
                  Paid {money(projection.summary.actualTotal, currency)} ·
                  Ordered {money(projection.summary.openCommitmentTotal, currency)}
                </span>
              </div>
            </div>

            {/* Budget progress bar */}
            <div className="eb-progress-block">
              <div className="eb-progress-legend">
                <span title="Finance term: actuals">
                  <i className="eb-dot eb-dot-actual" />
                  Paid {money(projection.summary.actualTotal, currency)} (
                  {actualPct}%)
                </span>
                <span title="Finance term: open purchase-order commitment">
                  <i className="eb-dot eb-dot-open" />
                  Ordered, not yet paid{" "}
                  {money(projection.summary.openCommitmentTotal, currency)} (
                  {openPoPct}%)
                </span>
                <span title="Finance term: available to commit">
                  <i className="eb-dot eb-dot-avail" />
                  Still available{" "}
                  {money(projection.summary.availableToCommit, currency)}
                </span>
              </div>
              <div
                className="eb-progress-track"
                role="img"
                aria-label={`Budget used: ${actualPct}% paid, ${openPoPct}% ordered`}
              >
                <span
                  className="eb-progress-seg eb-seg-actual"
                  style={{ width: `${Math.min(100, actualPct)}%` }}
                />
                <span
                  className="eb-progress-seg eb-seg-open"
                  style={{ width: `${Math.min(100 - actualPct, openPoPct)}%` }}
                />
              </div>
            </div>

            {/* =================================================================
                STEP 2: OVERVIEW & PLAN (table surface; follows the graph canvas)
               ================================================================= */}
            {journeyStep === "overview" ? (
              <div className="eb-surface-body">
                {/* Section 1: Deliverables & Vendor Purchase List */}
                <section className="eb-card">
                  <div className="eb-card-head">
                    <div>
                      <span className="eyebrow">The plan</span>
                      <h2>What we are buying, and from whom</h2>
                    </div>
                    <div className="eb-card-actions">
                      <button
                        type="button"
                        className="eb-btn-secondary"
                        onClick={() => setQuickCaptureOpen("allocation")}
                      >
                        + Split across vendors
                      </button>
                      <button
                        type="button"
                        className="eb-btn-secondary"
                        onClick={() => setJourneyStep("graph")}
                      >
                        See it as a map →
                      </button>
                    </div>
                  </div>

                  <div className="eb-table-scroll">
                    <table className="eb-relational-table eb-plan-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Supplier</th>
                          <th>Quarter</th>
                          <th className="is-numeric">Quantity × price</th>
                          <th className="is-numeric">Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewPurchaseRows.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Item">
                              <button
                                type="button"
                                className="eb-link-btn"
                                title="Show on the workflow map"
                                onClick={() => jumpToNode(row.id)}
                              >
                                {row.item}
                              </button>
                              <span className="eb-id-muted">
                                {row.deliverable} · GL {row.glCode}
                              </span>
                            </td>
                            <td data-label="Supplier">
                              <div className="eb-cell">
                                {row.vendor}
                                <span className="eb-id-muted">
                                  {row.location}
                                </span>
                              </div>
                            </td>
                            <td data-label="Quarter">{row.quarter}</td>
                            <td
                              data-label="Quantity × price"
                              className="is-numeric eb-tabular"
                            >
                              <div className="eb-cell">
                                {row.costText}
                                {row.extraText ? (
                                  <span className="eb-id-muted">
                                    {row.extraText}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td
                              data-label="Total"
                              className="is-numeric eb-tabular"
                            >
                              <strong>{money(row.subtotal, currency)}</strong>
                            </td>
                            <td data-label="Status">
                              <span
                                className={`status-pill ${row.statusTone}`}
                              >
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Section 2: Active Orders, Invoices & Attached Obsidian Notes */}
                <section className="eb-card">
                  <div className="eb-card-head">
                    <div>
                      <span className="eyebrow">The reality</span>
                      <h2>Quotes, orders, invoices and notes</h2>
                    </div>
                    <div className="eb-card-actions">
                      <button
                        type="button"
                        className="eb-btn-secondary"
                        onClick={() => setJourneyStep("vault")}
                      >
                        All notes (
                        {
                          notes.filter((n) => n.projectId === activeProject.id)
                            .length
                        }
                        ) →
                      </button>
                      <button
                        type="button"
                        className="eb-btn-secondary"
                        onClick={() => setJourneyStep("tables")}
                      >
                        Reports &amp; export →
                      </button>
                    </div>
                  </div>

                  <div className="eb-table-scroll">
                    <table className="eb-relational-table">
                      <thead>
                        <tr>
                          <th>Stage</th>
                          <th>What</th>
                          <th>Quarter</th>
                          <th className="is-numeric">Amount</th>
                          <th className="is-numeric">Still to pay</th>
                          <th>Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projection.tables.Lifecycle_Lines.map((line) => {
                          const stage = String(line.stage || "Document");
                          const lineId = String(line.document_line_id || "");
                          return (
                            <tr key={lineId}>
                              <td>
                                <span
                                  className={`status-pill ${stage === "Actual" ? "status-positive" : stage === "PO" ? "status-pending" : "status-muted"}`}
                                >
                                  {stage}
                                </span>
                              </td>
                              <td>
                                {String(line.description || "Order line")}
                                <code className="eb-id-muted">{lineId}</code>
                              </td>
                              <td>{String(line.spend_quarter || "Q1")}</td>
                              <td className="is-numeric eb-tabular">
                                {money(Number(line.amount || 0), currency)}
                              </td>
                              <td className="is-numeric eb-tabular">
                                {money(
                                  Number(line.open_commitment || 0),
                                  currency,
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="eb-btn-small"
                                  onClick={() => jumpToNode(lineId)}
                                >
                                  View →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {notes
                          .filter((n) => n.projectId === activeProject.id)
                          .map((note) => (
                            <tr key={note.id}>
                              <td>
                                <span className="status-pill status-muted">
                                  Note
                                </span>
                              </td>
                              <td>
                                <strong>{note.title}</strong>
                                <code className="eb-id-muted">
                                  about{" "}
                                  {projection.nodes.find(
                                    (n) => n.id === note.attachedToId,
                                  )?.label || note.attachedToId}
                                </code>
                              </td>
                              <td>—</td>
                              <td className="is-numeric eb-tabular">—</td>
                              <td className="is-numeric eb-tabular">—</td>
                              <td>
                                <button
                                  type="button"
                                  className="eb-btn-small"
                                  onClick={() => {
                                    setActiveNoteId(note.id);
                                    setJourneyStep("vault");
                                  }}
                                >
                                  Open →
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}

            {/* =================================================================
                STEP 1: WORKFLOW MAP (default graph-first landing canvas per ADR 0002)
               ================================================================= */}
            {journeyStep === "graph" ? (
              <div className="eb-surface-body">
                <div className="eb-graph-toolbar">
                  <div
                    className="eb-mode-pills"
                    role="group"
                    aria-label="Workflow view mode"
                  >
                    <button
                      type="button"
                      className={!outlineFallback ? "is-active" : ""}
                      onClick={() => setOutlineFallback(false)}
                    >
                      Map
                    </button>
                    <button
                      type="button"
                      className={outlineFallback ? "is-active" : ""}
                      onClick={() => setOutlineFallback(true)}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setJourneyStep("vault")}
                    >
                      Notes
                    </button>
                  </div>

                  {!outlineFallback ? (
                    <div
                      className="eb-link-lens"
                      role="group"
                      aria-label="Choose what the map shows"
                    >
                      <span className="eb-link-lens-label">Show on map</span>
                      <div className="eb-mode-pills eb-link-lens-pills">
                        <button
                          type="button"
                          className={!showNoteLinks ? "is-active" : ""}
                          aria-pressed={!showNoteLinks}
                          onClick={() => setShowNoteLinks(false)}
                        >
                          Spending flow
                        </button>
                        <button
                          type="button"
                          className={showNoteLinks ? "is-active" : ""}
                          aria-pressed={showNoteLinks}
                          onClick={() => setShowNoteLinks(true)}
                        >
                          Spending flow + notes
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!outlineFallback ? (
                    <div
                      className="eb-canvas-controls"
                      aria-label="Canvas view controls"
                    >
                      <button
                        type="button"
                        onClick={() => zoomAtCenter(zoom - 0.2)}
                      >
                        Zoom −
                      </button>
                      <span className="eb-zoom-readout">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => zoomAtCenter(zoom + 0.2)}
                      >
                        Zoom +
                      </button>
                      <button
                        type="button"
                        onClick={fitToSelectedNode}
                        title="Frame the selected node and its linked neighbours"
                      >
                        Fit to selected
                      </button>
                      <button type="button" onClick={fitToAllNodes}>
                        Fit to all
                      </button>
                      <button type="button" onClick={resetCanvasView}>
                        Reset view
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="eb-graph-workspace">
                  {outlineFallback ? (
                    <div
                      className="eb-outline-fallback"
                      role="tree"
                      aria-label="Project financial lineage outline"
                    >
                      <div className="eb-outline-banner">
                        <strong>
                          Project Financial Lineage Outline (Tap any row to
                          inspect)
                        </strong>
                        <span>
                          Every item below maps 1:1 to a governed table row.
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
                          return (
                            <div
                              key={node.id}
                              role="treeitem"
                              tabIndex={0}
                              aria-selected={selectedNode?.id === node.id}
                              className={`eb-outline-row eb-depth-${depth} ${selectedNode?.id === node.id ? "is-selected" : ""}`}
                              onClick={() => setSelectedNodeId(node.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedNodeId(node.id);
                                }
                              }}
                            >
                              <div className="eb-outline-main">
                                <span className="eb-node-badge">
                                  {NODE_TYPE_META[node.nodeType]?.badge ||
                                    node.nodeType}
                                </span>
                                <strong>{node.label}</strong>
                                <code>{node.id}</code>
                              </div>
                              <div className="eb-outline-metrics">
                                {node.nodeType !== "Knowledge_Notes" ? (
                                  <strong className="eb-tabular">
                                    {money(primaryAmount, currency)}
                                  </strong>
                                ) : (
                                  <span className="muted">Obsidian Note</span>
                                )}
                                {node.nodeType === "Project" ||
                                node.nodeType === "Work_Packages" ||
                                node.nodeType === "Purchase_Items" ? (
                                  <button
                                    type="button"
                                    className="eb-collapse-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNodeCollapse(node.id);
                                    }}
                                  >
                                    {node.mode === "collapsed"
                                      ? "Expand"
                                      : "Collapse"}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : !hasRealProjects ? (
                    <div
                      className="eb-canvas-empty"
                      role="group"
                      aria-label="No projects yet"
                    >
                      <div className="eb-canvas-empty-frame">
                        <h3 className="eb-canvas-empty-title">
                          Your canvas is empty
                        </h3>
                        <p className="eb-canvas-empty-copy">
                          Start a project to see its spending flow laid out on
                          the map.
                        </p>
                        <button
                          type="button"
                          className="eb-btn-primary"
                          onClick={() => {
                            onOpenClassicTab?.("plan");
                            setJourneyStep("classic");
                            setMobileNavOpen(false);
                          }}
                        >
                          Start a new project
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={canvasViewportRef}
                      className={`eb-canvas-viewport ${canvasPanStart ? "is-grabbing" : ""}`}
                      onPointerDown={handleCanvasPointerDown}
                      onPointerMove={handleCanvasPointerMove}
                      onPointerUp={handleCanvasPointerUp}
                      onPointerLeave={handleCanvasPointerUp}
                      onWheel={handleCanvasWheel}
                    >
                      <div
                        className="eb-canvas-stage"
                        style={{
                          width: `${stageBounds.width}px`,
                          height: `${stageBounds.height}px`,
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          transformOrigin: "0 0",
                        }}
                      >
                        <div className="eb-lane-guides" aria-hidden="true">
                          <span style={{ left: 24 }}>1 · Project</span>
                          <span style={{ left: 255 }}>2 · Deliverables</span>
                          <span style={{ left: 490 }}>
                            3 · Items &amp; [[Notes]]
                          </span>
                          <span style={{ left: 730 }}>4 · Vendor Splits</span>
                          <span style={{ left: 970 }}>
                            5 · Quotes, POs &amp; Invoices
                          </span>
                        </div>

                        <svg
                          className="eb-edges-svg"
                          width={stageBounds.width}
                          height={stageBounds.height}
                          style={{
                            width: `${stageBounds.width}px`,
                            height: `${stageBounds.height}px`,
                          }}
                        >
                          {projection.edges.map((edge) => {
                            // Dual-mode lens: the linked-notes overlay only
                            // renders when the toggle is on. This changes which
                            // links are drawn, never any underlying record.
                            if (
                              edge.type === "knowledge_backlink" &&
                              !showNoteLinks
                            ) {
                              return null;
                            }
                            const sourceNode = projection.visibleNodes.find(
                              (n) =>
                                n.id === edge.source ||
                                n.recordId === edge.source,
                            );
                            const targetNode = projection.visibleNodes.find(
                              (n) =>
                                n.id === edge.target ||
                                n.recordId === edge.target,
                            );
                            if (!sourceNode || !targetNode) return null;

                            // Ports computed from the SAME pixel coordinates
                            // the nodes are positioned at. The SVG shares this
                            // 1:1 space (no viewBox remap), so edges stay
                            // attached at any pan/zoom/drag offset.
                            const x1 = sourceNode.x + NODE_WIDTH;
                            const y1 = sourceNode.y + NODE_PORT_Y;
                            const x2 = targetNode.x;
                            const y2 = targetNode.y + NODE_PORT_Y;
                            const midX = (x1 + x2) / 2;
                            const pathD =
                              edge.type === "lifecycle_transition"
                                ? `M ${sourceNode.x + 102} ${sourceNode.y + 82} C ${sourceNode.x + 140} ${(y1 + y2) / 2}, ${targetNode.x + 140} ${(y1 + y2) / 2}, ${targetNode.x + 102} ${targetNode.y}`
                                : `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

                            return (
                              <g
                                key={edge.id}
                                className={`eb-edge-group eb-edge-${edge.type}`}
                              >
                                <path
                                  d={pathD}
                                  className={`eb-edge-path eb-path-${edge.type}`}
                                />
                              </g>
                            );
                          })}
                        </svg>

                        {projection.visibleNodes.map((node) => {
                          const isSelected = selectedNode?.id === node.id;
                          const backlinks =
                            projection.backlinkIndex.byTarget[node.id] || [];
                          const canCollapse =
                            node.nodeType === "Project" ||
                            node.nodeType === "Work_Packages" ||
                            node.nodeType === "Purchase_Items";

                          const primaryFigure =
                            node.nodeType === "Lifecycle_Lines"
                              ? money(
                                  Number(node.financials.amount || 0),
                                  currency,
                                )
                              : node.nodeType === "Knowledge_Notes"
                                ? "Obsidian Note"
                                : money(
                                    Number(node.financials.plannedTotal || 0),
                                    currency,
                                  );

                          return (
                            <div
                              key={node.id}
                              role="button"
                              tabIndex={0}
                              aria-label={`${node.nodeType} node ${node.label}`}
                              className={`eb-graph-node ${NODE_TYPE_META[node.nodeType]?.toneClass || ""} ${isSelected ? "is-selected" : ""}`}
                              style={{
                                left: `${node.x}px`,
                                top: `${node.y}px`,
                              }}
                              onPointerDown={(e) =>
                                handleNodePointerDown(e, node)
                              }
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
                                  {NODE_TYPE_META[node.nodeType]?.badge ||
                                    node.nodeType}
                                </span>
                                {canCollapse ? (
                                  <button
                                    type="button"
                                    className="eb-node-collapse-toggle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNodeCollapse(node.id);
                                    }}
                                  >
                                    {node.mode === "collapsed" ? "+" : "−"}
                                  </button>
                                ) : null}
                              </div>

                              <strong className="eb-node-title">
                                {node.label}
                              </strong>

                              <div className="eb-node-meta">
                                <code>{node.id}</code>
                                <span className="eb-node-amount">
                                  {primaryFigure}
                                </span>
                              </div>

                              {showNoteLinks && backlinks.length > 0 ? (
                                <div className="eb-node-backlink-chip">
                                  {backlinks.length} linked note
                                  {backlinks.length > 1 ? "s" : ""}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Live Node Inspector Drawer */}
                  <aside
                    className="eb-inspector-drawer"
                    aria-label="Node Inspector Drawer"
                  >
                    <div className="eb-inspector-head">
                      <span className="eyebrow">
                        Selected node ·{" "}
                        {NODE_TYPE_META[selectedNode?.nodeType]?.badge}
                      </span>
                      <h3>{selectedNode?.label || "Select a node"}</h3>
                      <code className="eb-inspector-id">
                        {selectedNode?.id}
                      </code>
                    </div>

                    <div
                      className="eb-perspective-tabs"
                      role="tablist"
                      aria-label="Three connected spend perspectives"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={inspectorViewTab === "operational"}
                        className={
                          inspectorViewTab === "operational" ? "is-active" : ""
                        }
                        onClick={() => setInspectorViewTab("operational")}
                      >
                        1. Operational
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={inspectorViewTab === "managerial"}
                        className={
                          inspectorViewTab === "managerial" ? "is-active" : ""
                        }
                        onClick={() => setInspectorViewTab("managerial")}
                      >
                        2. Managerial
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={inspectorViewTab === "accounting"}
                        className={
                          inspectorViewTab === "accounting" ? "is-active" : ""
                        }
                        onClick={() => setInspectorViewTab("accounting")}
                      >
                        3. Accounting
                      </button>
                    </div>

                    {selectedNodePerspectives ? (
                      <dl className="eb-perspective-list">
                        {selectedNodePerspectives[inspectorViewTab].map(
                          (row) => (
                            <div
                              key={row.label}
                              className="eb-perspective-row"
                            >
                              <dt title={row.title}>{row.label}</dt>
                              <dd title={row.title}>{row.value}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    ) : null}

                    <div className="eb-inspector-section">
                      <span className="eyebrow">
                        Connected nodes (
                        {selectedNodeEdges.incoming.length +
                          selectedNodeEdges.outgoing.length}
                        )
                      </span>
                      <div className="eb-lineage-chips">
                        {selectedNodeEdges.incoming.map((edge) => (
                          <button
                            key={edge.id}
                            type="button"
                            className="eb-lineage-chip"
                            onClick={() => jumpToNode(edge.source)}
                          >
                            ← {edge.source}
                          </button>
                        ))}
                        {selectedNodeEdges.outgoing.map((edge) => (
                          <button
                            key={edge.id}
                            type="button"
                            className="eb-lineage-chip"
                            onClick={() => jumpToNode(edge.target)}
                          >
                            → {edge.target}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="eb-inspector-actions">
                      <div className="eb-quick-action-grid">
                        <button
                          type="button"
                          className="eb-action-btn"
                          onClick={() => setQuickCaptureOpen("item")}
                        >
                          + Purchase Item
                        </button>
                        <button
                          type="button"
                          className="eb-action-btn"
                          onClick={() => setQuickCaptureOpen("allocation")}
                        >
                          + Vendor Split
                        </button>
                        <button
                          type="button"
                          className="eb-action-btn"
                          onClick={() => setQuickCaptureOpen("version")}
                        >
                          + Budget Version
                        </button>
                        <button
                          type="button"
                          className="eb-action-btn"
                          onClick={() => handleAttachNote(selectedNode)}
                        >
                          + Add note
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}

            {/* =================================================================
                STEP 3: NOTES (Obsidian-compatible linked notes, backup & export)
               ================================================================= */}
            {journeyStep === "vault" ? (
              <div className="eb-surface-body">
                <div className="eb-vault-panel">
                  <div className="eb-vault-sidebar">
                    <div className="eb-vault-sidebar-head">
                      <strong>Project notes</strong>
                      <button
                        type="button"
                        className="eb-btn-small"
                        onClick={() => handleAttachNote(selectedNode)}
                      >
                        + New Note
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
                          return extractWikilinks(n.content).tags.includes(
                            activeTagFilter,
                          );
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
                              <span>
                                Attached to <code>{note.attachedToId}</code> ·{" "}
                                {parsed.wikilinks.length} links
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="eb-vault-editor-area">
                    <div className="eb-vault-editor-head">
                      <div>
                        <span className="eyebrow">
                          Attached to {activeNote.attachedToType} (
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
                                n.id === activeNote.id
                                  ? { ...n, title: val }
                                  : n,
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
                        Inspect Linked Node ({activeNote.attachedToId}) →
                      </button>
                    </div>

                    <div className="eb-wikilink-insert-bar">
                      <span>Insert [[Wikilink]]:</span>
                      {projection.nodes
                        .filter((n) => n.nodeType !== "Knowledge_Notes")
                        .slice(0, 6)
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
                        <label
                          htmlFor="eb-markdown-source"
                          className="eb-pane-label"
                        >
                          Markdown source (YAML frontmatter + [[TargetID|Alias]]
                          + #tags)
                        </label>
                        <textarea
                          id="eb-markdown-source"
                          rows={9}
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
                          Interactive preview (Click any [[Wikilink]] to jump to
                          node)
                        </span>
                        <div className="eb-markdown-preview">
                          {Object.keys(parsedActiveNote.frontmatter).length >
                          0 ? (
                            <div className="eb-frontmatter-bar">
                              {Object.entries(parsedActiveNote.frontmatter).map(
                                ([k, v]) => (
                                  <span key={k}>
                                    <strong>{k}:</strong> {String(v)}
                                  </span>
                                ),
                              )}
                            </div>
                          ) : null}
                          <div className="eb-md-document">
                            {renderNotePreviewWithWikilinks(
                              activeNote.content,
                            )}
                          </div>
                        </div>

                        <div className="eb-backlink-explorer">
                          <strong>
                            Bidirectional backlink index (
                            {projection.backlinkIndex.edges.length} active graph
                            edges)
                          </strong>
                          <div className="eb-backlink-grid">
                            {Object.entries(
                              projection.backlinkIndex.byTarget,
                            ).map(([targetId, links]) => (
                              <div key={targetId} className="eb-backlink-card">
                                <button
                                  type="button"
                                  className="eb-wikilink-pill"
                                  onClick={() => jumpToNode(targetId)}
                                >
                                  [[{targetId}]]
                                </button>
                                <span>
                                  Referenced by {links.length} note(s):{" "}
                                  {links.map((l) => l.noteTitle).join(", ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="eb-backlink-explorer">
                          <div className="eb-card-head">
                            <div>
                              <strong>
                                Backup &amp; Obsidian export
                              </strong>
                              <p className="eb-muted">
                                Reference <code>{syncReceipt.checksum}</code> ·{" "}
                                {Object.keys(obsidianVaultFiles).length}{" "}
                                Markdown files (
                                {parsedVaultBundle.purchaseItems.length} items)
                              </p>
                            </div>
                            <div className="eb-card-actions">
                              <select
                                aria-label="Obsidian vault file preview"
                                className="eb-table-search"
                                value={selectedVaultFile}
                                onChange={(e) =>
                                  setSelectedVaultFile(e.target.value)
                                }
                              >
                                {Object.keys(obsidianVaultFiles).map((path) => (
                                  <option key={path} value={path}>
                                    {path}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="eb-btn-secondary"
                                onClick={triggerHybridSync}
                                disabled={syncState === "working"}
                              >
                                {syncState === "cloud"
                                  ? "Back up again"
                                  : "Back up to the cloud"}
                              </button>
                            </div>
                          </div>
                          {/* Decision 1 affordance: always show where this work is
                              safe, in plain language, from 390px to 1440px. */}
                          <div className="eb-sync-affordance" role="status">
                            <span
                              className={`status-pill ${
                                syncState === "cloud"
                                  ? "status-positive"
                                  : syncState === "working"
                                    ? "status-pending"
                                    : "status-muted"
                              }`}
                              title="Local-first with cloud backup"
                            >
                              {syncState === "cloud"
                                ? "Saved here and backed up to the cloud"
                                : syncState === "working"
                                  ? "Backing up to the cloud…"
                                  : "Saved on this device"}
                            </span>
                            <span className="eb-muted">
                              {syncState === "cloud"
                                ? "A shared copy is in the cloud. This device still keeps its own copy."
                                : "Your work is kept on this device first. Use “Back up to the cloud” to copy it to the shared cloud copy."}
                            </span>
                          </div>
                          {syncMessage ? (
                            <p className="eb-muted" role="status">
                              {syncMessage}
                            </p>
                          ) : null}
                          <pre className="eb-markdown-preview">
                            {obsidianVaultFiles[selectedVaultFile] ||
                              obsidianVaultFiles["00_Project_Overview.md"]}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* =================================================================
                STEP 4: TABLES & CHARTS (11 Canonical Tables + Plan-vs-Reality)
               ================================================================= */}
            {journeyStep === "tables" ? (
              <div className="eb-surface-body">
                <div className="eb-charts-grid">
                  {/* Chart 1: Q1-Q4 Plan vs Reality */}
                  <article className="eb-chart-card">
                    <div className="eb-chart-head">
                      <div>
                        <span className="eyebrow">
                          Plan vs. reality trajectory
                        </span>
                        <h3 title="Approved baseline vs. actuals and open PO">
                          Q1–Q4 approved baseline vs. actuals &amp; ordered, not
                          yet paid
                        </h3>
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
                        <span title="Open PO">
                          <i className="eb-swatch-open" />
                          Ordered, not yet paid
                        </span>
                        <span>
                          <i className="eb-swatch-forecast" />
                          Uncommitted
                        </span>
                      </div>
                    </div>

                    <svg
                      className="eb-quarter-svg"
                      viewBox="0 0 520 200"
                      role="img"
                      aria-label="Quarter trajectory chart showing Q1 to Q4 approved baseline against actuals and amounts ordered but not yet paid"
                    >
                      {[0, 0.5, 1].map((ratio, idx) => {
                        const y = 162 - ratio * 130;
                        const val = Math.round(maxQuarterChartValue * ratio);
                        return (
                          <g key={idx}>
                            <line
                              x1="58"
                              y1={y}
                              x2="500"
                              y2={y}
                              stroke="#e8eaec"
                              strokeWidth="1"
                            />
                            <text
                              x="50"
                              y={y + 4}
                              textAnchor="end"
                              className="eb-svg-tick"
                            >
                              ${(val / 1000).toFixed(1)}k
                            </text>
                          </g>
                        );
                      })}

                      {quarterChartRows.map((row, idx) => {
                        const groupX = 86 + idx * 104;
                        const scale = (v: number) =>
                          Math.max(
                            0,
                            Math.min(130, (v / maxQuarterChartValue) * 130),
                          );
                        const hApproved = scale(row.approved);
                        const hActual = scale(row.actual);
                        const hOpen = scale(row.open);
                        const hUncommitted = scale(
                          Math.max(0, row.forecast - row.actual - row.open),
                        );

                        return (
                          <g key={row.quarter}>
                            <rect
                              x={groupX}
                              y={162 - hApproved}
                              width="24"
                              height={hApproved}
                              fill="#cfded6"
                            />
                            <rect
                              x={groupX + 28}
                              y={162 - hActual}
                              width="24"
                              height={hActual}
                              fill="#1b6c80"
                            />
                            <rect
                              x={groupX + 28}
                              y={162 - hActual - hOpen}
                              width="24"
                              height={hOpen}
                              fill="#2f70bb"
                            />
                            <rect
                              x={groupX + 28}
                              y={162 - hActual - hOpen - hUncommitted}
                              width="24"
                              height={hUncommitted}
                              fill="#d9dde2"
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
                          <span>
                            Act+PO: {money(r.actual + r.open, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  {/* Chart 2: Vendor Split & Version Lineage */}
                  <article className="eb-chart-card">
                    <div className="eb-chart-head">
                      <div>
                        <span className="eyebrow">
                          Sourcing allocation breakdown
                        </span>
                        <h3>Vendor, warehouse &amp; country split</h3>
                      </div>
                      <span className="status-pill status-positive">
                        {selectedNodePerspectives?.allocValidation.status ||
                          "exact"}
                      </span>
                    </div>

                    <div className="eb-bar-list">
                      {projection.tables.Sourcing_Allocations.map((alloc) => {
                        const subtotal = Number(alloc.subtotal || 0);
                        const pct = Math.min(
                          100,
                          Math.round(
                            (subtotal /
                              Math.max(1, projection.summary.plannedTotal)) *
                              100,
                          ),
                        );
                        return (
                          <div
                            key={String(alloc.allocation_id)}
                            className="eb-bar-row"
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              jumpToNode(String(alloc.allocation_id))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                jumpToNode(String(alloc.allocation_id));
                              }
                            }}
                          >
                            <div className="eb-bar-row-top">
                              <strong>
                                {String(alloc.vendor_or_warehouse)} ·{" "}
                                {String(alloc.source_country)}
                              </strong>
                              <span className="eb-tabular">
                                {Number(alloc.quantity)}u ·{" "}
                                {money(subtotal, currency)} ({pct}%)
                              </span>
                            </div>
                            <div className="eb-bar-track">
                              <span
                                className="eb-bar-fill"
                                style={{ width: `${Math.max(4, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="eb-version-timeline">
                      <span className="eyebrow">
                        Budget version history &amp; authorization
                      </span>
                      {projection.tables.Budget_Versions.map((ver) => (
                        <div
                          key={String(ver.version_id)}
                          className="eb-version-item"
                        >
                          <span
                            className={`status-pill ${ver.authorization_state === "Approved" ? "status-positive" : "status-pending"}`}
                          >
                            v{String(ver.sequence)} · {String(ver.version_type)}{" "}
                            · {String(ver.authorization_state)}
                          </span>
                          <strong className="eb-tabular">
                            {money(
                              Number(ver.total || 0),
                              String(ver.currency || currency),
                            )}
                          </strong>
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
                        Same numbers as the map, as tables
                      </span>
                      <h3>All project tables</h3>
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
                        onClick={() =>
                          handleExportCanonical("tsv", activeTable)
                        }
                      >
                        Copy TSV
                      </button>
                      <button
                        type="button"
                        className="eb-btn-secondary"
                        onClick={() =>
                          handleExportCanonical("markdown", activeTable)
                        }
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

                  <div
                    className="eb-table-switcher"
                    role="tablist"
                    aria-label="11 Canonical Relational Tables"
                  >
                    {(
                      CANONICAL_TABLE_NAMES as readonly CanonicalTableName[]
                    ).map((tName) => {
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
                                        : val === null ||
                                            val === undefined ||
                                            val === ""
                                          ? "—"
                                          : safeSpreadsheetText(val);

                                  return (
                                    <td
                                      key={col}
                                      className={
                                        isNum ? "is-numeric eb-tabular" : ""
                                      }
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
                        <strong>
                          No rows in {activeTable} match current filter.
                        </strong>
                        <span>—</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* QUIET ACTION BAR AT BOTTOM OF SHEET */}
            <div
              className="eb-command-bar"
              role="region"
              aria-label="Quick actions"
            >
              <div className="eb-command-status">
                <span>Quick actions</span>
                <strong>
                  {selectedNode?.label || activeProject.name} ·{" "}
                  {money(projection.summary.availableToCommit, currency)} left
                </strong>
              </div>

              <div className="eb-command-actions">
                <button
                  type="button"
                  className="eb-cmd-btn"
                  onClick={() => setJourneyStep("overview")}
                >
                  1. Overview
                </button>
                <button
                  type="button"
                  className="eb-cmd-btn"
                  onClick={() => setJourneyStep("graph")}
                >
                  2. Workflow map
                </button>
                <button
                  type="button"
                  className="eb-cmd-btn"
                  onClick={() => setJourneyStep("vault")}
                >
                  3. Notes
                </button>
                <button
                  type="button"
                  className="eb-cmd-btn"
                  onClick={() => setJourneyStep("tables")}
                >
                  4. Reports &amp; export
                </button>
                {versionGovernance.latestProposedVersion ? (
                  <button
                    type="button"
                    className="eb-cmd-btn eb-cmd-approve"
                    onClick={handleApprovePendingVersion}
                  >
                    Approve proposed budget (
                    {money(
                      Number(
                        versionGovernance.latestProposedVersion.total || 0,
                      ),
                      currency,
                    )}
                    )
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
