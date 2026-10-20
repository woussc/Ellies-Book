import {
  CANONICAL_TABLE_NAMES,
  buildHybridSyncReceipt,
  buildProjectGraphProjection,
  serializeProjectToObsidianVault,
  validateRequirementAllocations,
} from "../../budget-domain.mjs";
import { getDb } from "../../../db";
import {
  auditEvents,
  budgetVersions,
  businessFunctions,
  knowledgeNotes,
  lifecycleLines,
  lifecycleRecords,
  lifecycleTransitions,
  projects,
  purchaseItems,
  purchaseLinks,
  sourcingAllocations,
  workPackages,
} from "../../../db/schema";

const DEFAULT_SYNC_PROJECT = {
  project: {
    recordId: "record-mkt-003",
    id: "MKT-003",
    name: "FY27 Launch Campaign",
    functionId: "Marketing & Brand",
    period: "FY2027",
    currency: "USD",
    approvedAmount: 11600,
  },
  workPackages: [
    {
      id: "wp-posm-production",
      name: "POSM production",
      description: "Print and finish the paper table-top stands.",
    },
  ],
  purchaseItems: [
    {
      id: "line-paper-stand",
      itemNameSnapshot: "Paper table-top stand",
      specification: "A4, 350 gsm FSC countertop stand",
      unitOfMeasure: "units",
      quantity: 1200,
      unitPrice: 0,
      unitCurrency: "USD",
      workPackageId: "wp-posm-production",
      glCode: "001230",
      allocations: [
        {
          id: "alloc-china",
          sourceType: "External vendor",
          vendorOrWarehouse: "China vendor",
          sourceCountry: "China",
          quantity: 600,
          unitPrice: 10,
          additionalCostEstimate: 500,
          currency: "USD",
          quarter: "Q1",
        },
        {
          id: "alloc-vietnam",
          sourceType: "External vendor",
          vendorOrWarehouse: "Vietnam vendor",
          sourceCountry: "Vietnam",
          quantity: 400,
          unitPrice: 11,
          additionalCostEstimate: 300,
          currency: "USD",
          quarter: "Q1",
        },
        {
          id: "alloc-eu",
          sourceType: "Internal warehouse",
          vendorOrWarehouse: "European warehouse",
          sourceCountry: "Germany",
          quantity: 200,
          unitPrice: 2,
          additionalCostEstimate: 0,
          currency: "USD",
          quarter: "Q2",
        },
      ],
    },
  ],
};

export async function GET() {
  let d1Available = false;
  try {
    const db = getDb();
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
    summary: projection.summary,
    vaultFileCount: receipt.vaultFileCount,
  });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown> = DEFAULT_SYNC_PROJECT;
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      payload = body as Record<string, unknown>;
    }
  } catch {
    payload = DEFAULT_SYNC_PROJECT;
  }

  const projection = buildProjectGraphProjection(payload);
  const rawItems = Array.isArray(payload.purchaseItems)
    ? payload.purchaseItems
    : [];
  const validations = rawItems.map((item) =>
    validateRequirementAllocations(item as Record<string, unknown>),
  );
  const allValid = validations.every((v) => v.valid);

  let d1Synced = false;
  if (allValid) {
    try {
      const db = getDb();
      const projRow = projection.tables.Project[0];
      if (db && projRow) {
        await db
          .insert(businessFunctions)
          .values({
            functionId: String(projRow.function_id || "fn-default"),
            name: String(projRow.function_id || "Marketing & Brand"),
            defaultCurrency: String(projRow.currency || "USD"),
          })
          .onConflictDoNothing();

        await db
          .insert(projects)
          .values({
            recordId: String(projRow.record_id),
            projectId: String(projRow.project_id),
            functionId: String(projRow.function_id || "fn-default"),
            name: String(projRow.name),
            period: String(projRow.period || "FY27"),
            currency: String(projRow.currency || "USD"),
            approvedAmount: Number(projRow.approved_budget || 0),
          })
          .onConflictDoNothing();

        for (const wp of projection.tables.Work_Packages) {
          await db
            .insert(workPackages)
            .values({
              workPackageId: String(wp.work_package_id),
              projectRecordId: String(projRow.record_id),
              name: String(wp.name || "General"),
              description: String(wp.description || ""),
            })
            .onConflictDoNothing();
        }

        for (const ver of projection.tables.Budget_Versions) {
          await db
            .insert(budgetVersions)
            .values({
              versionId: String(ver.version_id),
              projectRecordId: String(projRow.record_id),
              sequence: Number(ver.sequence || 1),
              versionType: String(ver.version_type || "Original"),
              authorizationState: String(ver.authorization_state || "Proposed"),
              predecessorId: ver.predecessor_id ? String(ver.predecessor_id) : null,
              reason: String(ver.reason || ""),
              total: Number(ver.total || 0),
              currency: String(ver.currency || "USD"),
            })
            .onConflictDoNothing();
        }

        for (const item of projection.tables.Purchase_Items) {
          await db
            .insert(purchaseItems)
            .values({
              spendingLineId: String(item.spending_line_id),
              projectRecordId: String(projRow.record_id),
              workPackageId: String(item.work_package_id),
              description: String(item.description || ""),
              specification: String(item.specification || ""),
              unitOfMeasure: String(item.unit_of_measure || "unit"),
              quantity: Number(item.quantity || 0),
              unitPrice: Number(item.unit_price || 0),
              currency: String(projRow.currency || "USD"),
              glCode: String(item.gl_code || "001230"),
            })
            .onConflictDoNothing();
        }

        for (const alloc of projection.tables.Sourcing_Allocations) {
          await db
            .insert(sourcingAllocations)
            .values({
              allocationId: String(alloc.allocation_id),
              spendingLineId: String(alloc.spending_line_id),
              sourceType: String(alloc.source_type || "External vendor"),
              vendorOrWarehouse: String(alloc.vendor_or_warehouse || ""),
              sourceCountry: String(alloc.source_country || ""),
              quantity: Number(alloc.quantity || 0),
              unitPrice: Number(alloc.unit_price || 0),
              additionalCostEstimate: Number(alloc.additional_cost_estimate || 0),
              currency: String(alloc.currency || "USD"),
              quarter: String(alloc.quarter || "Q1"),
            })
            .onConflictDoNothing();
        }

        for (const doc of projection.tables.Lifecycle_Records) {
          await db
            .insert(lifecycleRecords)
            .values({
              documentId: String(doc.document_id),
              projectRecordId: String(projRow.record_id),
              type: String(doc.type || "Purchase order"),
              reference: String(doc.reference || ""),
              vendor: String(doc.vendor || ""),
              date: String(doc.date || ""),
              status: String(doc.status || "Draft"),
              currency: String(doc.currency || "USD"),
            })
            .onConflictDoNothing();
        }

        for (const line of projection.tables.Lifecycle_Lines) {
          if (line.document_id) {
            await db
              .insert(lifecycleLines)
              .values({
                documentLineId: String(line.document_line_id),
                documentId: String(line.document_id),
                projectRecordId: String(projRow.record_id),
                spendingLineId: String(line.spending_line_id || ""),
                allocationId: line.allocation_id ? String(line.allocation_id) : null,
                description: String(line.description || ""),
                quantity: Number(line.quantity || 0),
                amount: Number(line.amount || 0),
                currency: String(line.currency || "USD"),
                spendQuarter: String(line.spend_quarter || "Q1"),
              })
              .onConflictDoNothing();
          }
        }

        for (const plink of projection.tables.Purchase_Links) {
          if (plink.document_line_id && plink.spending_line_id) {
            await db
              .insert(purchaseLinks)
              .values({
                purchaseLinkId: String(plink.purchase_link_id),
                documentLineId: String(plink.document_line_id),
                spendingLineId: String(plink.spending_line_id),
                allocationId: plink.allocation_id ? String(plink.allocation_id) : null,
                attributedQuantity: Number(plink.attributed_quantity || 0),
                attributedAmount: Number(plink.attributed_amount || 0),
                currency: String(plink.currency || "USD"),
              })
              .onConflictDoNothing();
          }
        }

        for (const tr of projection.tables.Lifecycle_Transitions) {
          if (tr.from_line_id && tr.to_line_id) {
            await db
              .insert(lifecycleTransitions)
              .values({
                transitionId: String(tr.transition_id),
                fromLineId: String(tr.from_line_id),
                toLineId: String(tr.to_line_id),
                transitionType: String(tr.transition_type || "PO->Invoice"),
                convertedAmount: Number(tr.converted_amount || 0),
                currency: String(tr.currency || "USD"),
              })
              .onConflictDoNothing();
          }
        }

        for (const note of projection.tables.Knowledge_Notes) {
          await db
            .insert(knowledgeNotes)
            .values({
              noteId: String(note.note_id),
              projectRecordId: String(projRow.record_id),
              title: String(note.title || ""),
              attachedToType: String(note.attached_to_type || "Project"),
              attachedToId: String(note.attached_to_id || projRow.project_id),
              wikilinksJson: JSON.stringify(note.wikilinks || []),
              tagsJson: JSON.stringify(note.tags || []),
            })
            .onConflictDoNothing();
        }

        for (const ev of projection.tables.Audit_Events) {
          await db
            .insert(auditEvents)
            .values({
              auditId: String(ev.audit_id),
              projectRecordId: String(projRow.record_id),
              actor: String(ev.actor || "Planner"),
              action: String(ev.action || "SYNC"),
              targetId: String(ev.target_id || ""),
              reason: String(ev.reason || ""),
              sourceRef: String(ev.source_ref || ""),
            })
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
