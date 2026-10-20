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
    .some((value) => String(value).toLowerCase().includes(query));
}

export function safeSpreadsheetText(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function validateRequirementAllocations(requirement = {}) {
  const required = Number(requirement?.quantity || 0);
  const allocations = Array.isArray(requirement?.allocations) ? requirement.allocations : [];
  const allocated = allocatedQuantity(allocations);
  const unallocated = Math.max(0, required - allocated);
  const overAllocatedAmount = Math.max(0, allocated - required);
  const valid = allocated <= required;

  let status = "unallocated";
  if (!valid) {
    status = "over-allocated";
  } else if (allocated === required) {
    status = "exact";
  } else if (allocated > 0) {
    status = "partial";
  }

  return {
    valid,
    required,
    allocated,
    unallocated,
    overAllocatedAmount,
    status,
    totalAmount: requirementTotal(requirement),
  };
}

function deepFreezeSnapshot(value) {
  if (!value || typeof value !== "object") return value;
  const copy = Array.isArray(value) ? value.map(deepFreezeSnapshot) : { ...value };
  if (!Array.isArray(copy)) {
    for (const key of Object.keys(copy)) {
      copy[key] = deepFreezeSnapshot(copy[key]);
    }
  }
  return Object.freeze(copy);
}

export function createBudgetVersion(params = {}, existingVersions = []) {
  const prior =
    Array.isArray(existingVersions) && existingVersions.length
      ? existingVersions
      : Array.isArray(params.existingVersions)
        ? params.existingVersions
        : [];
  const sequence = Number(params.sequence ?? prior.length + 1);
  const versionType = params.versionType || params.type || (sequence === 1 ? "Original" : "Adjustment");
  const authorizationState = params.authorizationState || params.status || params.state || "Proposed";
  const lastPrior = prior.length ? prior[prior.length - 1] : null;
  const predecessorId =
    params.predecessorId ??
    params.predecessor_id ??
    (lastPrior ? lastPrior.versionId || lastPrior.version_id || lastPrior.id || null : null);

  const rawItems = Array.isArray(params.purchaseItems || params.items || params.lines)
    ? params.purchaseItems || params.items || params.lines
    : [];
  const frozenItems = deepFreezeSnapshot(rawItems);
  const computedTotal = rawItems.length
    ? rawItems.reduce((sum, item) => sum + requirementTotal(item), 0)
    : 0;
  const total =
    params.total !== undefined
      ? Number(params.total)
      : params.totalAmount !== undefined
        ? Number(params.totalAmount)
        : computedTotal;

  const versionId = String(params.versionId || params.version_id || params.id || `ver-${sequence}`);
  const projectId = String(params.projectId || params.project_id || "proj-default");

  return Object.freeze({
    id: versionId,
    versionId,
    version_id: versionId,
    projectId,
    project_id: projectId,
    sequence,
    versionType,
    authorizationState,
    predecessorId,
    reason: String(params.reason || params.comment || ""),
    total,
    currency: String(params.currency || params.approvedCurrency || "USD"),
    purchaseItems: frozenItems,
    createdAt: String(params.createdAt || params.timestamp || new Date().toISOString()),
  });
}

export function effectiveApprovedBudget(versions = []) {
  const list = Array.isArray(versions) ? [...versions] : [];
  list.sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));

  const approvedVersions = list.filter(
    (v) => (v.authorizationState || v.status || v.state) === "Approved",
  );
  const baselineVersion = approvedVersions.length
    ? approvedVersions[approvedVersions.length - 1]
    : null;

  const baselineSeq = baselineVersion ? Number(baselineVersion.sequence ?? 0) : 0;
  const proposedVersions = list.filter(
    (v) =>
      (v.authorizationState || v.status || v.state) === "Proposed" &&
      Number(v.sequence ?? 0) > baselineSeq,
  );
  const latestProposedVersion = proposedVersions.length
    ? proposedVersions[proposedVersions.length - 1]
    : null;

  const approvedTotal = baselineVersion
    ? Number(baselineVersion.total ?? baselineVersion.approvedAmount ?? 0)
    : 0;
  const proposedTotal = latestProposedVersion
    ? Number(latestProposedVersion.total ?? latestProposedVersion.plannedTotal ?? 0)
    : approvedTotal;

  return {
    approvedTotal,
    baselineVersion,
    baselineVersionId: baselineVersion
      ? baselineVersion.versionId || baselineVersion.version_id || baselineVersion.id
      : null,
    latestProposedVersion,
    proposedTotal,
    pendingDelta: latestProposedVersion ? proposedTotal - approvedTotal : 0,
    versionsCount: list.length,
  };
}

function normalizeStage(rawStage) {
  const text = String(rawStage || "").trim().toLowerCase();
  if (text === "quotation" || text === "quote") return "Quotation";
  if (text === "po" || text === "purchase order" || text === "purchase_order") return "PO";
  if (text === "invoice" || text === "inv") return "Invoice";
  if (text === "actual" || text === "actuals") return "Actual";
  return "PO";
}

export function computeLifecycleLineage(arg1 = {}, arg2 = [], arg3 = []) {
  const input =
    Array.isArray(arg1)
      ? { poLines: arg1, transitions: arg2, lifecycleLines: arg3, approvedBudget: 0 }
      : arg1 || {};

  const rawPoLines = Array.isArray(input.poLines) ? input.poLines : [];
  const rawLifecycleLines = Array.isArray(input.lifecycleLines) ? input.lifecycleLines : [];
  const transitions = Array.isArray(input.transitions) ? input.transitions : [];
  const approvedBudget = Number(input.approvedBudget ?? 0);

  const lineMap = new Map();
  for (const line of rawPoLines) {
    const id = String(line.id || line.document_line_id || line.lineId);
    lineMap.set(id, {
      ...line,
      id,
      stage: normalizeStage(line.stage || line.type || line.documentType || "PO"),
      amount: Number(line.reportingAmount ?? line.amount ?? 0),
    });
  }
  for (const line of rawLifecycleLines) {
    const id = String(line.id || line.document_line_id || line.lineId);
    const existing = lineMap.get(id);
    lineMap.set(id, {
      ...(existing || {}),
      ...line,
      id,
      stage: normalizeStage(line.stage || line.type || line.documentType || existing?.stage || "PO"),
      amount: Number(line.reportingAmount ?? line.amount ?? existing?.amount ?? 0),
    });
  }

  const allLines = Array.from(lineMap.values());
  const outgoingConvertedByLine = new Map();

  for (const tr of transitions) {
    const fromId = String(tr.fromLineId || tr.from_line_id || tr.sourceLineId || "");
    const toId = String(tr.toLineId || tr.to_line_id || tr.targetLineId || "");
    if (!fromId) continue;
    const toLine = lineMap.get(toId);
    const amount = Number(tr.convertedAmount ?? tr.amount ?? toLine?.amount ?? 0);
    outgoingConvertedByLine.set(fromId, (outgoingConvertedByLine.get(fromId) || 0) + amount);
  }

  const quotationLines = allLines.filter((line) => line.stage === "Quotation");
  const poLines = allLines.filter((line) => line.stage === "PO");
  const invoiceLines = allLines.filter((line) => line.stage === "Invoice");
  const actualLines = allLines.filter((line) => line.stage === "Actual");

  const quotationTotal = quotationLines.reduce((sum, line) => sum + line.amount, 0);
  const grossPoTotal = poLines.reduce((sum, line) => sum + line.amount, 0);

  const poLineStatus = poLines.map((line) => {
    const convertedAmount = Number(outgoingConvertedByLine.get(line.id) || 0);
    const openCommitment = Math.max(0, line.amount - convertedAmount);
    return {
      lineId: line.id,
      grossAmount: line.amount,
      convertedAmount: Math.min(line.amount, convertedAmount),
      openCommitment,
      status: openCommitment === 0 ? "fully-converted" : convertedAmount > 0 ? "partially-converted" : "open",
    };
  });

  const invoiceLineStatus = invoiceLines.map((line) => {
    const settledAmount = Number(outgoingConvertedByLine.get(line.id) || 0);
    const openInvoiceAmount = Math.max(0, line.amount - settledAmount);
    return {
      lineId: line.id,
      grossAmount: line.amount,
      settledAmount: Math.min(line.amount, settledAmount),
      openInvoiceAmount,
    };
  });

  const openPoCommitmentTotal = poLineStatus.reduce((sum, item) => sum + item.openCommitment, 0);
  const convertedFromPoTotal = poLineStatus.reduce((sum, item) => sum + item.convertedAmount, 0);
  const invoiceTotal = invoiceLines.reduce((sum, line) => sum + line.amount, 0);
  const openInvoiceTotal = invoiceLineStatus.reduce((sum, item) => sum + item.openInvoiceAmount, 0);
  const actualTotal = actualLines.reduce((sum, line) => sum + line.amount, 0);

  const openCommitmentTotal = openPoCommitmentTotal + openInvoiceTotal;
  const totalRecognizedExposure = openCommitmentTotal + actualTotal;
  const availableToCommit = approvedBudget - actualTotal - openCommitmentTotal;

  return {
    quotationTotal,
    grossPoTotal,
    convertedFromPoTotal,
    openPoCommitmentTotal,
    invoiceTotal,
    openInvoiceTotal,
    openCommitmentTotal,
    actualTotal,
    totalRecognizedExposure,
    availableToCommit,
    poLineStatus,
    invoiceLineStatus,
  };
}

export function extractWikilinks(markdownText = "") {
  const rawText = String(markdownText ?? "");
  const frontmatter = {};
  let body = rawText;

  const fmMatch = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    body = rawText.slice(fmMatch[0].length);
    const lines = fmMatch[1].split(/\r?\n/);
    for (const line of lines) {
      const sepIndex = line.indexOf(":");
      if (sepIndex === -1) continue;
      const key = line.slice(0, sepIndex).trim();
      const val = line.slice(sepIndex + 1).trim();
      if (key) {
        frontmatter[key] = val.replace(/^["']|["']$/g, "");
      }
    }
  }

  const wikilinks = [];
  const targetsSet = new Set();
  const linkRegex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
  let match;
  while ((match = linkRegex.exec(body)) !== null) {
    const target = match[1].trim();
    const label = (match[2] ? match[2] : match[1]).trim();
    if (!target) continue;
    wikilinks.push({
      target,
      label,
      alias: label,
      raw: match[0],
    });
    targetsSet.add(target);
  }

  const tagsSet = new Set();
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9/_-]*)/g;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(body)) !== null) {
    tagsSet.add(tagMatch[1].toLowerCase());
  }

  const tags = Array.from(tagsSet);

  return {
    frontmatter,
    wikilinks,
    targets: Array.from(targetsSet),
    tags,
    hashtags: tags.map((t) => `#${t}`),
  };
}

export function buildBacklinkIndex(notes = []) {
  const byTarget = {};
  const byNote = {};
  const byTag = {};
  const edges = [];

  for (const note of Array.isArray(notes) ? notes : []) {
    const noteId = String(note.id || note.note_id || note.noteId || "note-unknown").trim();
    const noteTitle = String(note.title || noteId);
    const content = String(note.content ?? note.markdown ?? note.body ?? "");
    const parsed = extractWikilinks(content);

    byNote[noteId] = {
      noteId,
      title: noteTitle,
      outgoingTargets: parsed.targets,
      wikilinks: parsed.wikilinks,
      tags: parsed.tags,
      frontmatter: parsed.frontmatter,
    };

    for (const link of parsed.wikilinks) {
      if (!byTarget[link.target]) {
        byTarget[link.target] = [];
      }
      byTarget[link.target].push({
        noteId,
        noteTitle,
        target: link.target,
        label: link.label,
        raw: link.raw,
        tags: parsed.tags,
        frontmatter: parsed.frontmatter,
      });
      edges.push({
        id: `edge-backlink-${noteId}-${link.target}-${edges.length + 1}`,
        type: "knowledge_backlink",
        source: noteId,
        target: link.target,
        label: link.label,
      });
    }

    if (note.attachedToId && !parsed.targets.includes(note.attachedToId)) {
      const target = String(note.attachedToId);
      if (!byTarget[target]) {
        byTarget[target] = [];
      }
      byTarget[target].push({
        noteId,
        noteTitle,
        target,
        label: noteTitle,
        raw: `[[${target}]]`,
        tags: parsed.tags,
        frontmatter: parsed.frontmatter,
      });
      edges.push({
        id: `edge-backlink-${noteId}-${target}-${edges.length + 1}`,
        type: "knowledge_backlink",
        source: noteId,
        target,
        label: noteTitle,
      });
    }

    for (const tag of parsed.tags) {
      if (!byTag[tag]) {
        byTag[tag] = [];
      }
      if (!byTag[tag].includes(noteId)) {
        byTag[tag].push(noteId);
      }
    }
  }

  return {
    byTarget,
    byNote,
    byTag,
    edges,
  };
}

export function buildProjectGraphProjection(projectData = {}) {
  const rawProject = projectData.project || projectData;
  const projectRecordId = String(rawProject.recordId || rawProject.record_id || rawProject.id || "proj-rec-default");
  const projectId = String(rawProject.id || rawProject.project_id || rawProject.generatedId || "PROJ-0001");
  const projectName = String(rawProject.name || "Untitled Project");
  const functionId = String(rawProject.functionId || rawProject.function_id || "fn-default");
  const period = String(rawProject.period || "FY27");
  const currency = String(rawProject.currency || rawProject.approvedCurrency || "USD");

  const viewState = projectData.viewState || projectData.nodeViewState || {};
  const resolveView = (id, defaultX, defaultY) => {
    const v = viewState[id] || {};
    return {
      x: Number.isFinite(Number(v.x)) ? Number(v.x) : defaultX,
      y: Number.isFinite(Number(v.y)) ? Number(v.y) : defaultY,
      collapsed: Boolean(v.collapsed),
    };
  };

  const workPackages = Array.isArray(projectData.workPackages || rawProject.workPackages) &&
    (projectData.workPackages || rawProject.workPackages).length
    ? projectData.workPackages || rawProject.workPackages
    : [{ id: "wp-general", name: "General", description: "General project expenditure" }];

  const purchaseItems = Array.isArray(projectData.purchaseItems || rawProject.purchaseItems || rawProject.lines)
    ? projectData.purchaseItems || rawProject.purchaseItems || rawProject.lines
    : [];

  const allocationsMap = new Map();
  for (const item of purchaseItems) {
    const itemId = String(item.id || item.spending_line_id || "item-default");
    for (const alloc of Array.isArray(item.allocations) ? item.allocations : []) {
      const allocId = String(alloc.id || alloc.allocation_id || `alloc-${allocationsMap.size + 1}`);
      allocationsMap.set(allocId, { ...alloc, id: allocId, spendingLineId: itemId });
    }
  }
  for (const alloc of Array.isArray(projectData.sourcingAllocations) ? projectData.sourcingAllocations : []) {
    const allocId = String(alloc.id || alloc.allocation_id || `alloc-${allocationsMap.size + 1}`);
    allocationsMap.set(allocId, {
      ...(allocationsMap.get(allocId) || {}),
      ...alloc,
      id: allocId,
      spendingLineId: String(alloc.spendingLineId || alloc.spending_line_id || allocationsMap.get(allocId)?.spendingLineId || ""),
    });
  }
  const sourcingAllocations = Array.from(allocationsMap.values());

  const budgetVersions = Array.isArray(projectData.budgetVersions || rawProject.budgetVersions || rawProject.revisions)
    ? projectData.budgetVersions || rawProject.budgetVersions || rawProject.revisions
    : [];

  const lifecycleRecords = Array.isArray(projectData.lifecycleRecords || projectData.documents)
    ? projectData.lifecycleRecords || projectData.documents
    : [];

  const lifecycleLinesMap = new Map();
  for (const doc of lifecycleRecords) {
    const docId = String(doc.id || doc.document_id || "");
    const docStage = normalizeStage(doc.type || doc.stage || "PO");
    for (const line of Array.isArray(doc.lines) ? doc.lines : []) {
      const lineId = String(line.id || line.document_line_id || `line-${lifecycleLinesMap.size + 1}`);
      lifecycleLinesMap.set(lineId, {
        ...line,
        id: lineId,
        documentId: line.documentId || line.document_id || docId,
        stage: normalizeStage(line.stage || line.type || docStage),
      });
    }
  }
  for (const line of Array.isArray(projectData.lifecycleLines) ? projectData.lifecycleLines : []) {
    const lineId = String(line.id || line.document_line_id || `line-${lifecycleLinesMap.size + 1}`);
    const existing = lifecycleLinesMap.get(lineId);
    lifecycleLinesMap.set(lineId, {
      ...(existing || {}),
      ...line,
      id: lineId,
      documentId: String(line.documentId || line.document_id || existing?.documentId || ""),
      stage: normalizeStage(line.stage || line.type || existing?.stage || "PO"),
    });
  }
  const lifecycleLines = Array.from(lifecycleLinesMap.values());

  const purchaseLinks = Array.isArray(projectData.purchaseLinks) ? [...projectData.purchaseLinks] : [];
  const lifecycleTransitions = Array.isArray(projectData.lifecycleTransitions || projectData.transitions)
    ? [...(projectData.lifecycleTransitions || projectData.transitions)]
    : [];
  const knowledgeNotes = Array.isArray(projectData.knowledgeNotes || projectData.notes)
    ? projectData.knowledgeNotes || projectData.notes
    : [];
  const auditEvents = Array.isArray(projectData.auditEvents) ? projectData.auditEvents : [];

  // Financial calculations (strictly invariant to node coordinates or collapse state)
  const plannedTotal = purchaseItems.reduce((sum, item) => sum + requirementTotal(item), 0);
  const versionState = effectiveApprovedBudget(budgetVersions);
  const approvedBudget =
    budgetVersions.length > 0
      ? versionState.approvedTotal
      : Number(rawProject.approvedAmount ?? rawProject.approved_budget ?? plannedTotal);

  const lineage = computeLifecycleLineage({
    poLines: lifecycleLines.filter((l) => l.stage === "PO"),
    transitions: lifecycleTransitions,
    lifecycleLines,
    approvedBudget,
  });

  const uncommittedPlannedCost = Math.max(
    0,
    plannedTotal - lineage.actualTotal - lineage.openCommitmentTotal,
  );
  const forecastSpend =
    lineage.actualTotal + lineage.openCommitmentTotal + uncommittedPlannedCost;
  const projectedHeadroom = approvedBudget - forecastSpend;

  const summary = {
    plannedTotal,
    approvedBudget,
    quotationTotal: lineage.quotationTotal,
    grossPoTotal: lineage.grossPoTotal,
    openPoCommitmentTotal: lineage.openPoCommitmentTotal,
    openInvoiceTotal: lineage.openInvoiceTotal,
    openCommitmentTotal: lineage.openCommitmentTotal,
    actualTotal: lineage.actualTotal,
    availableToCommit: lineage.availableToCommit,
    uncommittedPlannedCost,
    forecastSpend,
    projectedHeadroom,
    currency,
  };

  // Build Canonical Relational Table Rows
  const poStatusById = new Map(lineage.poLineStatus.map((s) => [s.lineId, s]));
  const invStatusById = new Map(
    (lineage.invoiceLineStatus || []).map((s) => [s.lineId, s]),
  );
  const backlinkIndex = buildBacklinkIndex(knowledgeNotes);

  const tables = {
    Project: [
      {
        record_id: projectRecordId,
        project_id: projectId,
        name: projectName,
        function_id: functionId,
        period,
        currency,
        approved_budget: approvedBudget,
        planned_total: plannedTotal,
        open_commitment: lineage.openCommitmentTotal,
        actual_total: lineage.actualTotal,
        available_to_commit: lineage.availableToCommit,
        forecast_spend: forecastSpend,
        projected_headroom: projectedHeadroom,
      },
    ],
    Work_Packages: workPackages.map((wp) => {
      const wpId = String(wp.id || wp.work_package_id);
      const wpItems = purchaseItems.filter(
        (item) => String(item.workPackageId || item.work_package_id || workPackages[0].id) === wpId,
      );
      return {
        work_package_id: wpId,
        project_id: projectId,
        name: String(wp.name || "General"),
        description: String(wp.description || ""),
        planned_total: wpItems.reduce((sum, item) => sum + requirementTotal(item), 0),
        item_count: wpItems.length,
      };
    }),
    Budget_Versions: budgetVersions.map((ver, idx) => ({
      version_id: String(ver.versionId || ver.version_id || ver.id || `ver-${idx + 1}`),
      project_id: projectId,
      sequence: Number(ver.sequence ?? idx + 1),
      version_type: String(ver.versionType || ver.version_type || (idx === 0 ? "Original" : "Adjustment")),
      authorization_state: String(ver.authorizationState || ver.authorization_state || ver.status || "Proposed"),
      predecessor_id: ver.predecessorId ?? ver.predecessor_id ?? null,
      reason: String(ver.reason || ver.comment || ""),
      total: Number(ver.total ?? ver.approvedAmount ?? ver.plannedTotal ?? 0),
      currency: String(ver.currency || ver.approvedCurrency || currency),
    })),
    Purchase_Items: purchaseItems.map((item) => {
      const itemId = String(item.id || item.spending_line_id);
      const itemAllocs = sourcingAllocations.filter((a) => a.spendingLineId === itemId);
      const itemWithAllocs = { ...item, allocations: itemAllocs };
      return {
        spending_line_id: itemId,
        project_id: projectId,
        work_package_id: String(item.workPackageId || item.work_package_id || workPackages[0].id),
        description: String(item.itemNameSnapshot || item.description || item.name || ""),
        specification: String(item.specification || ""),
        unit_of_measure: String(item.unitOfMeasure || item.unit_of_measure || "unit"),
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unitPrice ?? item.unit_price ?? 0),
        planned_total: requirementTotal(itemWithAllocs),
        allocated_quantity: allocatedQuantity(itemAllocs),
        unallocated_quantity: unallocatedQuantity(itemWithAllocs),
        gl_code: String(item.glCode || item.gl_code || ""),
      };
    }),
    Sourcing_Allocations: sourcingAllocations.map((alloc) => ({
      allocation_id: String(alloc.id || alloc.allocation_id),
      spending_line_id: String(alloc.spendingLineId || alloc.spending_line_id || ""),
      vendor_or_warehouse: String(alloc.vendorOrWarehouse || alloc.vendor_or_warehouse || ""),
      source_country: String(alloc.sourceCountry || alloc.source_country || ""),
      source_type: String(alloc.sourceType || alloc.source_type || "External vendor"),
      quantity: Number(alloc.quantity || 0),
      unit_price: Number(alloc.unitPrice ?? alloc.unit_price ?? 0),
      additional_cost_estimate: Number(alloc.additionalCostEstimate ?? alloc.additional_cost_estimate ?? 0),
      subtotal: allocationSubtotal(alloc),
      currency: String(alloc.currency || currency),
      quarter: String(alloc.quarter || "Q1"),
    })),
    Lifecycle_Records: lifecycleRecords.map((doc) => {
      const docId = String(doc.id || doc.document_id);
      const docLines = lifecycleLines.filter((l) => l.documentId === docId);
      return {
        document_id: docId,
        project_id: projectId,
        type: String(doc.type || "Purchase order"),
        reference: String(doc.reference || ""),
        vendor: String(doc.vendor || ""),
        date: String(doc.date || ""),
        status: String(doc.status || "Draft"),
        total_amount: docLines.reduce((sum, l) => sum + Number(l.amount || 0), 0),
        currency: String(doc.currency || currency),
      };
    }),
    Lifecycle_Lines: lifecycleLines.map((line) => {
      const poStat = poStatusById.get(line.id);
      const invStat = invStatusById.get(line.id);
      const openCommitment = poStat
        ? poStat.openCommitment
        : invStat
          ? invStat.openInvoiceAmount
          : 0;
      return {
        document_line_id: line.id,
        document_id: String(line.documentId || ""),
        project_id: projectId,
        spending_line_id: String(line.spendingLineId || line.spending_line_id || ""),
        allocation_id: line.allocationId || line.allocation_id || null,
        stage: line.stage,
        description: String(line.description || ""),
        quantity: Number(line.quantity || 0),
        amount: Number(line.amount || 0),
        open_commitment: openCommitment,
        currency: String(line.currency || currency),
        spend_quarter: String(line.spendQuarter || line.spend_quarter || "Q1"),
      };
    }),
    Purchase_Links: purchaseLinks.map((plink, idx) => ({
      purchase_link_id: String(plink.id || plink.purchase_link_id || `plink-${idx + 1}`),
      document_line_id: String(plink.documentLineId || plink.document_line_id || ""),
      spending_line_id: String(plink.spendingLineId || plink.spending_line_id || ""),
      allocation_id: plink.allocationId || plink.allocation_id || null,
      attributed_quantity: Number(plink.attributedQuantity ?? plink.attributed_quantity ?? 0),
      attributed_amount: Number(plink.attributedAmount ?? plink.attributed_amount ?? 0),
      currency: String(plink.currency || currency),
    })),
    Lifecycle_Transitions: lifecycleTransitions.map((tr, idx) => ({
      transition_id: String(tr.id || tr.transition_id || `tr-${idx + 1}`),
      from_line_id: String(tr.fromLineId || tr.from_line_id || ""),
      to_line_id: String(tr.toLineId || tr.to_line_id || ""),
      transition_type: String(tr.transitionType || tr.transition_type || "PO->Invoice"),
      converted_amount: Number(tr.convertedAmount ?? tr.converted_amount ?? 0),
      currency: String(tr.currency || currency),
    })),
    Knowledge_Notes: knowledgeNotes.map((note, idx) => {
      const noteId = String(note.id || note.note_id || `note-${idx + 1}`);
      const parsed = extractWikilinks(note.content || note.markdown || "");
      return {
        note_id: noteId,
        project_id: projectId,
        title: String(note.title || noteId),
        attached_to_type: String(note.attachedToType || note.attached_to_type || "Project"),
        attached_to_id: String(note.attachedToId || note.attached_to_id || projectId),
        wikilinks: parsed.targets,
        tags: parsed.tags,
        updated_at: String(note.updatedAt || note.updated_at || ""),
      };
    }),
    Audit_Events: auditEvents.map((ev, idx) => ({
      audit_id: String(ev.id || ev.audit_id || `audit-${idx + 1}`),
      project_id: projectId,
      actor: String(ev.actor || ev.owner || ""),
      timestamp: String(ev.timestamp || ""),
      action: String(ev.action || ""),
      target_id: String(ev.targetId || ev.target_id || ""),
      reason: String(ev.reason || ""),
      source_ref: String(ev.sourceRef || ev.source_ref || ""),
    })),
  };

  // Build Graph Nodes and Typed Edges
  const nodes = [];
  const edges = [];

  const projView = resolveView(projectId, 40, 120);
  nodes.push({
    id: projectId,
    recordId: projectId,
    nodeType: "Project",
    label: projectName,
    mode: projView.collapsed ? "collapsed" : "expanded",
    x: projView.x,
    y: projView.y,
    financials: {
      plannedTotal,
      approvedBudget,
      openCommitment: lineage.openCommitmentTotal,
      actualTotal: lineage.actualTotal,
      childCount: tables.Work_Packages.length,
    },
  });

  tables.Work_Packages.forEach((wpRow, wpIndex) => {
    const wpView = resolveView(wpRow.work_package_id, 280, 80 + wpIndex * 160);
    nodes.push({
      id: wpRow.work_package_id,
      recordId: wpRow.work_package_id,
      nodeType: "Work_Packages",
      label: wpRow.name,
      mode: wpView.collapsed ? "collapsed" : "expanded",
      x: wpView.x,
      y: wpView.y,
      hiddenByCollapse: projView.collapsed,
      financials: {
        plannedTotal: wpRow.planned_total,
        childCount: wpRow.item_count,
      },
    });
    edges.push({
      id: `edge-cont-${projectId}-${wpRow.work_package_id}`,
      type: "containment",
      source: projectId,
      target: wpRow.work_package_id,
      label: "contains",
    });
  });

  tables.Purchase_Items.forEach((itemRow, itemIndex) => {
    const itemView = resolveView(itemRow.spending_line_id, 540, 80 + itemIndex * 140);
    const parentWp = nodes.find((n) => n.recordId === itemRow.work_package_id);
    nodes.push({
      id: itemRow.spending_line_id,
      recordId: itemRow.spending_line_id,
      nodeType: "Purchase_Items",
      label: itemRow.description || itemRow.spending_line_id,
      mode: itemView.collapsed ? "collapsed" : "expanded",
      x: itemView.x,
      y: itemView.y,
      hiddenByCollapse: Boolean(projView.collapsed || parentWp?.mode === "collapsed"),
      financials: {
        plannedTotal: itemRow.planned_total,
        allocatedQuantity: itemRow.allocated_quantity,
        unallocatedQuantity: itemRow.unallocated_quantity,
      },
    });
    edges.push({
      id: `edge-cont-${itemRow.work_package_id}-${itemRow.spending_line_id}`,
      type: "containment",
      source: itemRow.work_package_id,
      target: itemRow.spending_line_id,
      label: "contains",
    });
  });

  tables.Sourcing_Allocations.forEach((allocRow, allocIndex) => {
    const allocView = resolveView(allocRow.allocation_id, 800, 60 + allocIndex * 110);
    const parentItem = nodes.find((n) => n.recordId === allocRow.spending_line_id);
    nodes.push({
      id: allocRow.allocation_id,
      recordId: allocRow.allocation_id,
      nodeType: "Sourcing_Allocations",
      label: allocRow.vendor_or_warehouse || allocRow.allocation_id,
      mode: allocView.collapsed ? "collapsed" : "expanded",
      x: allocView.x,
      y: allocView.y,
      hiddenByCollapse: Boolean(parentItem?.hiddenByCollapse || parentItem?.mode === "collapsed"),
      financials: {
        plannedTotal: allocRow.subtotal,
        quantity: allocRow.quantity,
      },
    });
    if (allocRow.spending_line_id) {
      edges.push({
        id: `edge-cont-${allocRow.spending_line_id}-${allocRow.allocation_id}`,
        type: "containment",
        source: allocRow.spending_line_id,
        target: allocRow.allocation_id,
        label: "allocated to",
      });
    }
  });

  tables.Lifecycle_Lines.forEach((lineRow, lineIndex) => {
    const lineView = resolveView(lineRow.document_line_id, 1080, 60 + lineIndex * 110);
    nodes.push({
      id: lineRow.document_line_id,
      recordId: lineRow.document_line_id,
      nodeType: "Lifecycle_Lines",
      label: `${lineRow.stage}: ${lineRow.document_line_id}`,
      mode: lineView.collapsed ? "collapsed" : "expanded",
      x: lineView.x,
      y: lineView.y,
      hiddenByCollapse: Boolean(projView.collapsed),
      financials: {
        amount: lineRow.amount,
        openCommitment: lineRow.open_commitment,
      },
    });
  });

  tables.Purchase_Links.forEach((plink) => {
    const sourceId = plink.allocation_id || plink.spending_line_id;
    if (sourceId && plink.document_line_id) {
      edges.push({
        id: `edge-plink-${plink.purchase_link_id}`,
        type: "purchase_link",
        source: sourceId,
        target: plink.document_line_id,
        label: `${plink.attributed_amount} ${plink.currency}`,
        metadata: {
          attributedQuantity: plink.attributed_quantity,
          attributedAmount: plink.attributed_amount,
        },
      });
    }
  });

  tables.Lifecycle_Transitions.forEach((tr) => {
    if (tr.from_line_id && tr.to_line_id) {
      edges.push({
        id: `edge-tr-${tr.transition_id}`,
        type: "lifecycle_transition",
        source: tr.from_line_id,
        target: tr.to_line_id,
        label: tr.transition_type,
        metadata: {
          convertedAmount: tr.converted_amount,
          transitionType: tr.transition_type,
        },
      });
    }
  });

  tables.Knowledge_Notes.forEach((noteRow, noteIndex) => {
    const noteView = resolveView(noteRow.note_id, 540, 360 + noteIndex * 100);
    nodes.push({
      id: noteRow.note_id,
      recordId: noteRow.note_id,
      nodeType: "Knowledge_Notes",
      label: noteRow.title,
      mode: noteView.collapsed ? "collapsed" : "expanded",
      x: noteView.x,
      y: noteView.y,
      hiddenByCollapse: Boolean(projView.collapsed),
      financials: { plannedTotal: 0 },
    });
  });

  for (const backlinkEdge of backlinkIndex.edges) {
    edges.push(backlinkEdge);
  }

  return {
    nodes,
    visibleNodes: nodes.filter((n) => !n.hiddenByCollapse),
    edges,
    tables,
    summary,
    backlinkIndex,
  };
}

export const CANONICAL_TABLE_NAMES = Object.freeze([
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

function quoteCell(value, delimiter) {
  const safe = safeSpreadsheetText(
    Array.isArray(value) ? value.join(" | ") : value ?? "",
  );
  if (
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r") ||
    safe.includes(delimiter)
  ) {
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function formatCanonicalTableDelimited(
  tables = {},
  tableName = "ALL",
  delimiter = "\t",
) {
  const names =
    tableName && tableName !== "ALL" && tables[tableName]
      ? [tableName]
      : CANONICAL_TABLE_NAMES.filter((name) => Array.isArray(tables[name]));

  return names
    .map((name) => {
      const rows = Array.isArray(tables[name]) ? tables[name] : [];
      const headers = rows.length ? Object.keys(rows[0]) : ["empty"];
      const headerLine = headers.map((h) => quoteCell(h, delimiter)).join(delimiter);
      const bodyLines = rows.map((row) =>
        headers.map((h) => quoteCell(row[h], delimiter)).join(delimiter),
      );
      return [quoteCell(`# ${name}`, delimiter), headerLine, ...bodyLines].join("\r\n");
    })
    .join("\r\n\r\n");
}

export function formatCanonicalTableMarkdown(tables = {}, tableName = "ALL") {
  const names =
    tableName && tableName !== "ALL" && tables[tableName]
      ? [tableName]
      : CANONICAL_TABLE_NAMES.filter((name) => Array.isArray(tables[name]));

  return names
    .map((name) => {
      const rows = Array.isArray(tables[name]) ? tables[name] : [];
      const headers = rows.length ? Object.keys(rows[0]) : ["status"];
      const effectiveRows = rows.length ? rows : [{ status: "—" }];
      const headerRow = `| ${headers.join(" | ")} |`;
      const dividerRow = `| ${headers.map(() => "---").join(" | ")} |`;
      const bodyRows = effectiveRows.map(
        (row) =>
          `| ${headers
            .map((h) => {
              const raw = Array.isArray(row[h]) ? row[h].join(", ") : row[h];
              const text = safeSpreadsheetText(raw ?? "—")
                .replaceAll("|", "\\|")
                .replaceAll("\n", " ");
              return text || "—";
            })
            .join(" | ")} |`,
      );
      return [`### ${name} (${rows.length})`, headerRow, dividerRow, ...bodyRows].join("\n");
    })
    .join("\n\n");
}

function formatMarkdownTableFromRows(rows = [], columns = []) {
  const effectiveCols =
    columns.length > 0
      ? columns
      : rows.length > 0
        ? Object.keys(rows[0])
        : ["status"];
  const effectiveRows = rows.length > 0 ? rows : [{ status: "—" }];
  const headerLine = `| ${effectiveCols.join(" | ")} |`;
  const dividerLine = `| ${effectiveCols.map(() => "---").join(" | ")} |`;
  const bodyLines = effectiveRows.map(
    (row) =>
      `| ${effectiveCols
        .map((col) => {
          const val = row[col];
          const raw = Array.isArray(val) ? val.join(", ") : val ?? "—";
          return (
            safeSpreadsheetText(raw)
              .replaceAll("|", "\\|")
              .replaceAll("\n", " ") || "—"
          );
        })
        .join(" | ")} |`,
  );
  return [headerLine, dividerLine, ...bodyLines].join("\n");
}

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
    `period: ${projectRow.period}`,
    `currency: ${currency}`,
    `approved_budget: ${projectRow.approved_budget}`,
    `planned_total: ${projectRow.planned_total}`,
    `open_commitment: ${projectRow.open_commitment}`,
    `actual_total: ${projectRow.actual_total}`,
    `available_to_commit: ${projectRow.available_to_commit}`,
    `forecast_spend: ${projectRow.forecast_spend}`,
    `projected_headroom: ${projectRow.projected_headroom}`,
    "---",
    `# ${projectId} — ${projectName}`,
    "",
    `#ellies-book #project #${periodTag || "fy27"}`,
    "",
    "## Financial Headroom Summary",
    formatMarkdownTableFromRows([projectRow], [
      "project_id",
      "approved_budget",
      "planned_total",
      "open_commitment",
      "actual_total",
      "available_to_commit",
      "forecast_spend",
      "projected_headroom",
    ]),
    "",
    "## Work Packages",
    wpLinks || "- —",
    "",
    formatCanonicalTableMarkdown(projection.tables, "Work_Packages"),
    "",
    "## Purchase Items (Operational, Managerial & Accounting)",
    itemLinks || "- —",
    "",
    formatCanonicalTableMarkdown(projection.tables, "Purchase_Items"),
    "",
    "## Lifecycle Documents & Commitment Lineage",
    docLinks || "- —",
    "",
    formatCanonicalTableMarkdown(projection.tables, "Lifecycle_Records"),
    "",
    "## Knowledge Notes",
    noteLinks || "- —",
  ].join("\n");

  // 2. WorkPackages/<wp_id>.md
  for (const wp of workPackages) {
    const wpId = String(wp.work_package_id);
    const wpItems = purchaseItems.filter((it) => it.work_package_id === wpId);
    const wpItemLinks = wpItems
      .map(
        (it) =>
          `- [[${it.spending_line_id}|${it.description || it.spending_line_id}]] (${it.planned_total} ${currency} · GL \`"${it.gl_code || "001230"}"\`)`,
      )
      .join("\n");

    vaultMap[`WorkPackages/${wpId}.md`] = [
      "---",
      "entity_type: WorkPackage",
      `work_package_id: ${wpId}`,
      `project_id: ${projectId}`,
      `name: "${String(wp.name || "General").replaceAll('"', '\\"')}"`,
      `description: "${String(wp.description || "").replaceAll('"', '\\"')}"`,
      `planned_total: ${wp.planned_total}`,
      `item_count: ${wp.item_count}`,
      "---",
      `# Work Package: ${wp.name} (${wpId})`,
      "",
      `Parent Project: [[${projectId}|${projectName}]]`,
      "#work-package #ellies-book",
      "",
      "## Contained Purchase Items",
      wpItemLinks || "- —",
      "",
      formatMarkdownTableFromRows(wpItems, [
        "spending_line_id",
        "description",
        "quantity",
        "unit_price",
        "planned_total",
        "gl_code",
      ]),
    ].join("\n");
  }

  // 3. PurchaseItems/<spending_line_id>.md
  for (const item of purchaseItems) {
    const itemId = String(item.spending_line_id);
    const glCodeStr = String(item.gl_code || "001230");
    const itemAllocs = sourcingAllocations.filter((a) => a.spending_line_id === itemId);
    const itemLines = lifecycleLines.filter((l) => l.spending_line_id === itemId);
    const itemNotes = rawNotes.filter(
      (n) =>
        String(n.attachedToId || n.attached_to_id) === itemId ||
        extractWikilinks(n.content || n.markdown || "").targets.includes(itemId),
    );

    const allocBulletLinks = itemAllocs
      .map(
        (a) =>
          `- [[${a.allocation_id}|${a.vendor_or_warehouse || a.allocation_id}]] (${a.source_country || "Global"} · ${a.quantity}u @ ${a.unit_price} ${a.currency} + ${a.additional_cost_estimate} extra = ${a.subtotal} ${a.currency})`,
      )
      .join("\n");

    const docLineBulletLinks = itemLines
      .map(
        (l) =>
          `- [[${l.document_line_id}|${l.stage}: ${l.document_line_id}]] (${l.amount} ${l.currency} · Open Commitment: ${l.open_commitment} ${l.currency})`,
      )
      .join("\n");

    const noteBulletLinks = itemNotes
      .map((n, idx) => {
        const nId = String(n.id || n.note_id || `note-${idx + 1}`);
        return `- [[${nId}|${n.title || nId}]]`;
      })
      .join("\n");

    vaultMap[`PurchaseItems/${itemId}.md`] = [
      "---",
      "entity_type: PurchaseItem",
      `spending_line_id: ${itemId}`,
      `project_id: ${projectId}`,
      `work_package_id: ${item.work_package_id}`,
      `description: "${String(item.description || "").replaceAll('"', '\\"')}"`,
      `specification: "${String(item.specification || "").replaceAll('"', '\\"')}"`,
      `unit_of_measure: "${String(item.unit_of_measure || "unit").replaceAll('"', '\\"')}"`,
      `quantity: ${item.quantity}`,
      `unit_price: ${item.unit_price}`,
      `planned_total: ${item.planned_total}`,
      `allocated_quantity: ${item.allocated_quantity}`,
      `unallocated_quantity: ${item.unallocated_quantity}`,
      `gl_code: "${glCodeStr}"`,
      "---",
      `# Purchase Item: ${item.description || itemId} (${itemId})`,
      "",
      `Project: [[${projectId}|${projectName}]] · Work Package: [[${item.work_package_id}]]`,
      `#purchase-item #gl-${glCodeStr}`,
      "",
      "## 1. Operational View",
      `- **Item Description**: ${item.description || itemId}`,
      `- **Specification**: ${item.specification || "Standard specification"}`,
      `- **Required Quantity**: ${item.quantity} ${item.unit_of_measure}`,
      `- **Sourcing Allocations (${itemAllocs.length})**:`,
      allocBulletLinks || "- Base estimate (Quantity × Unit Price)",
      "",
      "## 2. Managerial View",
      `- **Project Initiative**: [[${projectId}|${projectName}]]`,
      `- **Work Package Stream**: [[${item.work_package_id}]]`,
      `- **Requirement Planned Total**: ${item.planned_total} ${currency}`,
      `- **Quantity Reconciliation**: ${item.allocated_quantity} allocated / ${item.quantity} required (${item.unallocated_quantity} unallocated)`,
      "",
      "## 3. Accounting View",
      `- **Official GL Code (String-Preserved)**: \`"${glCodeStr}"\``,
      `- **Reporting Currency**: ${currency}`,
      `- **Governance Rule**: Contextual human confirmation required; allocations replace parent estimate without double counting.`,
      "",
      "## Sourcing Allocations Table",
      formatMarkdownTableFromRows(itemAllocs, [
        "allocation_id",
        "vendor_or_warehouse",
        "source_country",
        "source_type",
        "quantity",
        "unit_price",
        "additional_cost_estimate",
        "subtotal",
        "quarter",
      ]),
      "",
      "## Linked Lifecycle Lines & Knowledge Notes",
      docLineBulletLinks || "- No lifecycle lines attached yet.",
      noteBulletLinks || "- No knowledge notes attached yet.",
    ].join("\n");
  }

  // 4. Documents/<document_id>.md
  for (const doc of lifecycleRecords) {
    const docId = String(doc.document_id);
    const docLines = lifecycleLines.filter((l) => l.document_id === docId);
    const docLineIds = new Set(docLines.map((l) => l.document_line_id));
    const docTransitions = lifecycleTransitions.filter(
      (tr) => docLineIds.has(tr.from_line_id) || docLineIds.has(tr.to_line_id),
    );

    const linkedTargets = docLines
      .map(
        (l) =>
          `- Line \`${l.document_line_id}\` (${l.stage}) → Item [[${l.spending_line_id}]]${l.allocation_id ? ` · Allocation [[${l.allocation_id}]]` : ""} (${l.amount} ${l.currency} · Open Commitment: ${l.open_commitment} ${l.currency})`,
      )
      .join("\n");

    const transitionBullets = docTransitions
      .map(
        (tr) =>
          `- \`${tr.transition_id}\`: [[${tr.from_line_id}]] → [[${tr.to_line_id}]] (${tr.transition_type} · Converted: ${tr.converted_amount} ${tr.currency})`,
      )
      .join("\n");

    vaultMap[`Documents/${docId}.md`] = [
      "---",
      "entity_type: LifecycleRecord",
      `document_id: ${docId}`,
      `project_id: ${projectId}`,
      `type: "${String(doc.type || "Purchase order").replaceAll('"', '\\"')}"`,
      `reference: "${String(doc.reference || docId).replaceAll('"', '\\"')}"`,
      `vendor: "${String(doc.vendor || "").replaceAll('"', '\\"')}"`,
      `date: "${String(doc.date || "")}"`,
      `status: "${String(doc.status || "Draft").replaceAll('"', '\\"')}"`,
      `total_amount: ${doc.total_amount}`,
      `currency: ${doc.currency}`,
      "---",
      `# Lifecycle Document: ${doc.reference || docId} (${doc.type})`,
      "",
      `Project: [[${projectId}|${projectName}]] · Vendor: ${doc.vendor || "—"} · Status: ${doc.status}`,
      "#lifecycle-document #commitment-lineage",
      "",
      "## Attributed Spend Lines",
      linkedTargets || "- —",
      "",
      formatMarkdownTableFromRows(docLines, [
        "document_line_id",
        "stage",
        "spending_line_id",
        "allocation_id",
        "quantity",
        "amount",
        "open_commitment",
        "spend_quarter",
      ]),
      "",
      "## Commitment Progression Transitions",
      transitionBullets || "- —",
    ].join("\n");
  }

  // 5. Notes/<note_id>.md
  rawNotes.forEach((note, idx) => {
    const noteId = String(note.id || note.note_id || `note-${idx + 1}`);
    const noteTitle = String(note.title || noteId);
    const attachedToType = String(note.attachedToType || note.attached_to_type || "Project");
    const attachedToId = String(note.attachedToId || note.attached_to_id || projectId);
    const updatedAt = String(note.updatedAt || note.updated_at || "");
    const rawContent = String(note.content ?? note.markdown ?? note.body ?? "");

    const parsed = extractWikilinks(rawContent);
    const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    const bodyOnly = fmMatch ? rawContent.slice(fmMatch[0].length) : rawContent;

    const mergedFrontmatter = {
      entity_type: "KnowledgeNote",
      note_id: noteId,
      project_id: String(note.projectId || note.project_id || projectId),
      title: noteTitle,
      attached_to_type: attachedToType,
      attached_to_id: attachedToId,
      updated_at: updatedAt,
      ...parsed.frontmatter,
    };

    const fmLines = Object.entries(mergedFrontmatter).map(([k, v]) => {
      const strVal = String(v ?? "");
      const needsQuotes = strVal.includes(":") || strVal.includes('"');
      return `${k}: ${needsQuotes ? `"${strVal.replaceAll('"', '\\"')}"` : strVal}`;
    });

    vaultMap[`Notes/${noteId}.md`] = [
      "---",
      ...fmLines,
      "---",
      bodyOnly.trim(),
    ].join("\n");
  });

  const bundleMarkdown = Object.entries(vaultMap)
    .map(([filePath, content]) => `<!-- FILE: ${filePath} -->\n${content}`)
    .join("\n\n---\n\n");

  Object.defineProperties(vaultMap, {
    files: { value: vaultMap, enumerable: false },
    fileCount: { value: Object.keys(vaultMap).length, enumerable: false },
    projectId: { value: projectId, enumerable: false },
    bundleMarkdown: { value: bundleMarkdown, enumerable: false },
  });

  return vaultMap;
}

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
        openCommitment: Number(fm.open_commitment ?? 0),
        actualTotal: Number(fm.actual_total ?? 0),
        availableToCommit: Number(fm.available_to_commit ?? 0),
        forecastSpend: Number(fm.forecast_spend ?? 0),
        projectedHeadroom: Number(fm.projected_headroom ?? 0),
        frontmatter: fm,
        wikilinks: parsed.wikilinks,
        targets: parsed.targets,
        tags: parsed.tags,
      };
    } else if (filePath.startsWith("WorkPackages/") || fm.entity_type === "WorkPackage") {
      const wpId = String(fm.work_package_id || baseName);
      workPackages.push({
        id: wpId,
        work_package_id: wpId,
        projectId: String(fm.project_id || project.id),
        name: String(fm.name || wpId),
        description: String(fm.description || ""),
        plannedTotal: Number(fm.planned_total ?? 0),
        itemCount: Number(fm.item_count ?? 0),
        frontmatter: fm,
        wikilinks: parsed.wikilinks,
        targets: parsed.targets,
        tags: parsed.tags,
        path: filePath,
      });
    } else if (filePath.startsWith("PurchaseItems/") || fm.entity_type === "PurchaseItem") {
      const itemId = String(fm.spending_line_id || baseName);
      const glCode = String(fm.gl_code || "001230");
      purchaseItems.push({
        id: itemId,
        spending_line_id: itemId,
        projectId: String(fm.project_id || project.id),
        workPackageId: String(fm.work_package_id || "wp-general"),
        description: String(fm.description || itemId),
        specification: String(fm.specification || ""),
        unitOfMeasure: String(fm.unit_of_measure || "unit"),
        quantity: Number(fm.quantity ?? 0),
        unitPrice: Number(fm.unit_price ?? 0),
        plannedTotal: Number(fm.planned_total ?? 0),
        allocatedQuantity: Number(fm.allocated_quantity ?? 0),
        unallocatedQuantity: Number(fm.unallocated_quantity ?? 0),
        glCode,
        gl_code: glCode,
        frontmatter: fm,
        wikilinks: parsed.wikilinks,
        targets: parsed.targets,
        tags: parsed.tags,
        path: filePath,
      });
    } else if (filePath.startsWith("Documents/") || fm.entity_type === "LifecycleRecord") {
      const docId = String(fm.document_id || baseName);
      documents.push({
        id: docId,
        document_id: docId,
        projectId: String(fm.project_id || project.id),
        type: String(fm.type || "Purchase order"),
        reference: String(fm.reference || docId),
        vendor: String(fm.vendor || ""),
        date: String(fm.date || ""),
        status: String(fm.status || "Draft"),
        totalAmount: Number(fm.total_amount ?? 0),
        currency: String(fm.currency || project.currency),
        frontmatter: fm,
        wikilinks: parsed.wikilinks,
        targets: parsed.targets,
        tags: parsed.tags,
        path: filePath,
      });
    } else {
      const noteId = String(fm.note_id || fm.id || baseName);
      knowledgeNotes.push({
        id: noteId,
        note_id: noteId,
        projectId: String(fm.project_id || fm.projectId || project.id),
        title: String(fm.title || noteId),
        attachedToType: String(fm.attached_to_type || fm.attachedToType || "Project"),
        attachedToId: String(fm.attached_to_id || fm.attachedToId || fm.project_id || project.id),
        updatedAt: String(fm.updated_at || fm.updatedAt || ""),
        frontmatter: fm,
        content: rawContent,
        body,
        wikilinks: parsed.wikilinks,
        targets: parsed.targets,
        tags: parsed.tags,
        hashtags: parsed.hashtags,
        path: filePath,
      });
    }
  }

  return {
    project,
    workPackages,
    purchaseItems,
    documents,
    knowledgeNotes,
    backlinkIndex: buildBacklinkIndex(knowledgeNotes),
    vaultBacklinkIndex: buildBacklinkIndex(allVaultNoteRecords),
    files: normalizedFiles,
  };
}

function computeDeterministicChecksum(text = "") {
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `eb-v1-${hex1}${hex2}`;
}

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
    vaultFileCount: vaultPaths.length,
    vaultPaths,
  };
}




