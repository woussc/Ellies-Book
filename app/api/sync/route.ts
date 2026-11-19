import { and, eq, inArray } from "drizzle-orm";
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
  workspaces,
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

export function resolveSyncContext(request?: Request) {
  // W13-D2 (Gate 2: Cloudflare Access headers + optional bearer token).
  // Pure header parsing — no DB call. Cloudflare Access sets (and overwrites)
  // Cf-Access-Authenticated-User-Email at the edge after its own verification,
  // so the email header is trusted when present. A Bearer token is accepted as
  // workspace context alongside X-Ellie-Workspace-Id; hashing it against
  // workspace_members.token_hash needs a token-issuance flow first, so that
  // validation is a defined D4 follow-up, not silently assumed here.
  const headers = request?.headers;
  const workspaceHeader = headers?.get("X-Ellie-Workspace-Id")?.trim() || "";
  const bearer = headers?.get("Authorization")?.trim() || "";
  const accessEmail =
    headers?.get("Cf-Access-Authenticated-User-Email")?.trim() || "";
  const hasBearer = /^Bearer\s+\S+$/i.test(bearer);
  if (workspaceHeader) {
    return {
      workspaceId: workspaceHeader,
      actor: accessEmail || "Workspace Operator",
      authenticatedMode: hasBearer ? "workspace-token" : "workspace-header",
    };
  }
  if (accessEmail) {
    return {
      workspaceId: "ws-local-default",
      actor: accessEmail,
      authenticatedMode: "access-user",
    };
  }
  return {
    workspaceId: "ws-local-default",
    actor: "Local Operator",
    authenticatedMode: "local-anonymous",
  };
}

// Rebuild the input payload shape (project + work packages + purchase items
// with allocations) for one stored project, so GET can hydrate from D1 and
// POST can checksum-guard against the stored snapshot (Gate 3). Returns null
// when no row matches the workspace + record id.
async function loadStoredProjectPayload(
  db: NonNullable<ReturnType<typeof getDb>>,
  workspaceId: string,
  projectRecordId: string,
) {
  const projRows = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        eq(projects.recordId, projectRecordId),
      ),
    )
    .limit(1);
  if (projRows.length === 0) {
    return null;
  }
  const proj = projRows[0];
  const wpRows = await db
    .select()
    .from(workPackages)
    .where(eq(workPackages.projectRecordId, proj.recordId));
  const itemRows = await db
    .select()
    .from(purchaseItems)
    .where(eq(purchaseItems.projectRecordId, proj.recordId));
  const itemIds = itemRows.map((row) => row.spendingLineId);
  const allocRows =
    itemIds.length > 0
      ? await db
          .select()
          .from(sourcingAllocations)
          .where(inArray(sourcingAllocations.spendingLineId, itemIds))
      : [];
  const allocationsByItem = new Map<string, unknown[]>();
  for (const alloc of allocRows) {
    const list = allocationsByItem.get(alloc.spendingLineId) ?? [];
    list.push({
      id: alloc.allocationId,
      sourceType: alloc.sourceType,
      vendorOrWarehouse: alloc.vendorOrWarehouse,
      sourceCountry: alloc.sourceCountry,
      quantity: alloc.quantity,
      unitPrice: alloc.unitPrice,
      additionalCostEstimate: alloc.additionalCostEstimate,
      currency: alloc.currency,
      quarter: alloc.quarter,
    });
    allocationsByItem.set(alloc.spendingLineId, list);
  }
  return {
    project: {
      recordId: proj.recordId,
      id: proj.projectId,
      name: proj.name,
      functionId: proj.functionId,
      period: proj.period,
      currency: proj.currency,
      approvedAmount: proj.approvedAmount,
    },
    workPackages: wpRows.map((wp) => ({
      id: wp.workPackageId,
      name: wp.name,
      description: wp.description,
    })),
    purchaseItems: itemRows.map((item) => ({
      id: item.spendingLineId,
      itemNameSnapshot: item.description,
      specification: item.specification,
      unitOfMeasure: item.unitOfMeasure,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCurrency: item.currency,
      workPackageId: item.workPackageId,
      glCode: item.glCode,
      allocations: allocationsByItem.get(item.spendingLineId) ?? [],
    })),
  };
}

export async function GET(request?: Request) {
  const ctx = resolveSyncContext(request);
  const url = request ? new URL(request.url) : null;
  const queryWorkspace = url?.searchParams.get("workspaceId")?.trim() || "";
  const queryProject = url?.searchParams.get("projectId")?.trim() || "";
  const workspaceId = queryWorkspace || ctx.workspaceId;

  let payload: Record<string, unknown> = DEFAULT_SYNC_PROJECT;
  let d1Available = false;
  let hydrated = false;
  try {
    const db = getDb();
    if (db) {
      d1Available = true;
      const recordId =
        queryProject || String(DEFAULT_SYNC_PROJECT.project.recordId);
      const stored = await loadStoredProjectPayload(db, workspaceId, recordId);
      if (stored) {
        payload = stored;
        hydrated = true;
      }
    }
  } catch {
    d1Available = false;
  }

  const projection = buildProjectGraphProjection(payload);
  const receipt = buildHybridSyncReceipt(payload, {
    d1Synced: d1Available,
  });

  return Response.json({
    ok: receipt.ok,
    mode: receipt.mode,
    checksum: receipt.checksum,
    timestamp: receipt.timestamp,
    projectId: receipt.projectId,
    workspaceId,
    hydrated,
    canonicalTables: CANONICAL_TABLE_NAMES,
    rowCounts: receipt.rowCounts,
    totalRows: receipt.totalRows,
    summary: projection.summary,
    vaultFileCount: receipt.vaultFileCount,
  });
}

export async function POST(request: Request) {
  const ctx = resolveSyncContext(request);
  // Strict cloud-auth mode (opt-in via env): anonymous local-first calls are
  // refused outright instead of writing to the default workspace. The read is
  // guarded because `process` does not exist in the Workers runtime — there
  // the flag is inert and edge Access policy is the enforcement point (D4).
  const requireWorkspaceAuth =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.REQUIRE_WORKSPACE_AUTH === "true";
  if (requireWorkspaceAuth && ctx.authenticatedMode === "local-anonymous") {
    return Response.json(
      {
        ok: false,
        error: "workspace-auth-required",
        workspaceId: ctx.workspaceId,
      },
      { status: 401 },
    );
  }

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
  // The receipt checksum is payload-only (only `mode` depends on d1Synced),
  // so it can be computed before the writes for the audit entry + If-Match.
  const preReceipt = buildHybridSyncReceipt(payload, { d1Synced: false });
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
        const recordId = String(projRow.record_id);
        // Tenant guard (Gate 2): a project record id already owned by another
        // workspace must never be overwritten by this workspace.
        const existing = await db
          .select()
          .from(projects)
          .where(eq(projects.recordId, recordId))
          .limit(1);
        if (
          existing.length > 0 &&
          String(existing[0].workspaceId) !== ctx.workspaceId
        ) {
          return Response.json(
            {
              ok: false,
              error: "workspace-mismatch",
              workspaceId: ctx.workspaceId,
              projectId: recordId,
            },
            { status: 403 },
          );
        }

        // Checksum guard (Gate 3, Option 3A): a client that passes
        // If-Match-Checksum must match the stored snapshot, or the write is
        // refused with 409 and the server checksum so the client can re-fetch.
        const ifMatch =
          request.headers.get("If-Match-Checksum")?.trim() || "";
        if (ifMatch) {
          const stored = await loadStoredProjectPayload(
            db,
            ctx.workspaceId,
            recordId,
          );
          if (stored) {
            const storedReceipt = buildHybridSyncReceipt(stored, {
              d1Synced: true,
            });
            if (storedReceipt.checksum !== ifMatch) {
              return Response.json(
                {
                  ok: false,
                  error: "checksum-mismatch",
                  serverChecksum: storedReceipt.checksum,
                  workspaceId: ctx.workspaceId,
                  projectId: recordId,
                },
                { status: 409 },
              );
            }
          }
        }

        // The workspace row must exist before any scoped write.
        await db
          .insert(workspaces)
          .values({
            workspaceId: ctx.workspaceId,
            name:
              ctx.workspaceId === "ws-local-default"
                ? "Local default workspace"
                : ctx.workspaceId,
            slug: ctx.workspaceId,
          })
          .onConflictDoNothing();

        await db
          .insert(businessFunctions)
          .values({
            functionId: String(projRow.function_id || "fn-default"),
            name: String(projRow.function_id || "Marketing & Brand"),
            defaultCurrency: String(projRow.currency || "USD"),
            workspaceId: ctx.workspaceId,
          })
          .onConflictDoUpdate({
            target: businessFunctions.functionId,
            set: {
              name: String(projRow.function_id || "Marketing & Brand"),
              defaultCurrency: String(projRow.currency || "USD"),
              workspaceId: ctx.workspaceId,
            },
          });

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
            workspaceId: ctx.workspaceId,
          })
          .onConflictDoUpdate({
            target: projects.recordId,
            set: {
              projectId: String(projRow.project_id),
              functionId: String(projRow.function_id || "fn-default"),
              name: String(projRow.name),
              period: String(projRow.period || "FY27"),
              currency: String(projRow.currency || "USD"),
              approvedAmount: Number(projRow.approved_budget || 0),
              workspaceId: ctx.workspaceId,
            },
          });

        for (const wp of projection.tables.Work_Packages) {
          await db
            .insert(workPackages)
            .values({
              workPackageId: String(wp.work_package_id),
              projectRecordId: String(projRow.record_id),
              name: String(wp.name || "General"),
              description: String(wp.description || ""),
            })
            .onConflictDoUpdate({
              target: workPackages.workPackageId,
              set: {
                projectRecordId: String(projRow.record_id),
                name: String(wp.name || "General"),
                description: String(wp.description || ""),
              },
            });
        }

        // Gate 3: budget versions stay append-only / immutable — a re-sync
        // must never overwrite a stored version row.
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
            .onConflictDoUpdate({
              target: purchaseItems.spendingLineId,
              set: {
                projectRecordId: String(projRow.record_id),
                workPackageId: String(item.work_package_id),
                description: String(item.description || ""),
                specification: String(item.specification || ""),
                unitOfMeasure: String(item.unit_of_measure || "unit"),
                quantity: Number(item.quantity || 0),
                unitPrice: Number(item.unit_price || 0),
                currency: String(projRow.currency || "USD"),
                glCode: String(item.gl_code || "001230"),
              },
            });
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
            .onConflictDoUpdate({
              target: sourcingAllocations.allocationId,
              set: {
                spendingLineId: String(alloc.spending_line_id),
                sourceType: String(alloc.source_type || "External vendor"),
                vendorOrWarehouse: String(alloc.vendor_or_warehouse || ""),
                sourceCountry: String(alloc.source_country || ""),
                quantity: Number(alloc.quantity || 0),
                unitPrice: Number(alloc.unit_price || 0),
                additionalCostEstimate: Number(
                  alloc.additional_cost_estimate || 0,
                ),
                currency: String(alloc.currency || "USD"),
                quarter: String(alloc.quarter || "Q1"),
              },
            });
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
            .onConflictDoUpdate({
              target: lifecycleRecords.documentId,
              set: {
                projectRecordId: String(projRow.record_id),
                type: String(doc.type || "Purchase order"),
                reference: String(doc.reference || ""),
                vendor: String(doc.vendor || ""),
                date: String(doc.date || ""),
                status: String(doc.status || "Draft"),
                currency: String(doc.currency || "USD"),
              },
            });
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
              .onConflictDoUpdate({
                target: lifecycleLines.documentLineId,
                set: {
                  documentId: String(line.document_id),
                  projectRecordId: String(projRow.record_id),
                  spendingLineId: String(line.spending_line_id || ""),
                  allocationId: line.allocation_id
                    ? String(line.allocation_id)
                    : null,
                  description: String(line.description || ""),
                  quantity: Number(line.quantity || 0),
                  amount: Number(line.amount || 0),
                  currency: String(line.currency || "USD"),
                  spendQuarter: String(line.spend_quarter || "Q1"),
                },
              });
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
              .onConflictDoUpdate({
                target: purchaseLinks.purchaseLinkId,
                set: {
                  documentLineId: String(plink.document_line_id),
                  spendingLineId: String(plink.spending_line_id),
                  allocationId: plink.allocation_id
                    ? String(plink.allocation_id)
                    : null,
                  attributedQuantity: Number(plink.attributed_quantity || 0),
                  attributedAmount: Number(plink.attributed_amount || 0),
                  currency: String(plink.currency || "USD"),
                },
              });
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
              .onConflictDoUpdate({
                target: lifecycleTransitions.transitionId,
                set: {
                  fromLineId: String(tr.from_line_id),
                  toLineId: String(tr.to_line_id),
                  transitionType: String(tr.transition_type || "PO->Invoice"),
                  convertedAmount: Number(tr.converted_amount || 0),
                  currency: String(tr.currency || "USD"),
                },
              });
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
            .onConflictDoUpdate({
              target: knowledgeNotes.noteId,
              set: {
                projectRecordId: String(projRow.record_id),
                title: String(note.title || ""),
                attachedToType: String(note.attached_to_type || "Project"),
                attachedToId: String(note.attached_to_id || projRow.project_id),
                wikilinksJson: JSON.stringify(note.wikilinks || []),
                tagsJson: JSON.stringify(note.tags || []),
              },
            });
        }

        // Gate 3: audit events stay append-only / immutable — a re-sync must
        // never overwrite a stored event row.
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

        // One fresh SYNC audit row per successful write (Gate 3: the audit log
        // is append-only; this row is new every sync, never an overwrite).
        await db
          .insert(auditEvents)
          .values({
            auditId: crypto.randomUUID(),
            projectRecordId: recordId,
            actor: ctx.actor,
            action: "SYNC",
            targetId: recordId,
            reason: "",
            sourceRef: preReceipt.checksum,
          })
          .onConflictDoNothing();

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
      workspaceId: ctx.workspaceId,
      vaultFiles: Object.keys(vault),
    },
    { status: receipt.ok ? 200 : 422 },
  );
}
