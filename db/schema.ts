import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const businessFunctions = sqliteTable("business_functions", {
  functionId: text("function_id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(6),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const projects = sqliteTable("projects", {
  recordId: text("record_id").primaryKey(),
  projectId: text("project_id").notNull(),
  functionId: text("function_id")
    .notNull()
    .references(() => businessFunctions.functionId),
  name: text("name").notNull(),
  purpose: text("purpose").notNull().default(""),
  description: text("description").notNull().default(""),
  period: text("period").notNull().default("FY27"),
  owner: text("owner").notNull().default(""),
  status: text("status").notNull().default("Active"),
  currency: text("currency").notNull().default("USD"),
  approvedAmount: real("approved_amount").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workPackages = sqliteTable("work_packages", {
  workPackageId: text("work_package_id").primaryKey(),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  name: text("name").notNull().default("General"),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const budgetVersions = sqliteTable("budget_versions", {
  versionId: text("version_id").primaryKey(),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  sequence: integer("sequence").notNull(),
  versionType: text("version_type").notNull().default("Original"),
  authorizationState: text("authorization_state").notNull().default("Proposed"),
  predecessorId: text("predecessor_id"),
  reason: text("reason").notNull().default(""),
  total: real("total").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  snapshotJson: text("snapshot_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const purchaseItems = sqliteTable("purchase_items", {
  spendingLineId: text("spending_line_id").primaryKey(),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  workPackageId: text("work_package_id")
    .notNull()
    .references(() => workPackages.workPackageId),
  spendingItemDefinitionId: text("spending_item_definition_id").notNull().default(""),
  description: text("description").notNull(),
  specification: text("specification").notNull().default(""),
  unitOfMeasure: text("unit_of_measure").notNull().default("unit"),
  quantity: real("quantity").notNull().default(0),
  unitPrice: real("unit_price").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  quartersJson: text("quarters_json").notNull().default("[]"),
  glCode: text("gl_code").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sourcingAllocations = sqliteTable("sourcing_allocations", {
  allocationId: text("allocation_id").primaryKey(),
  spendingLineId: text("spending_line_id")
    .notNull()
    .references(() => purchaseItems.spendingLineId),
  sourceType: text("source_type").notNull().default("External vendor"),
  vendorOrWarehouse: text("vendor_or_warehouse").notNull().default(""),
  sourceCountry: text("source_country").notNull().default(""),
  sourceLocation: text("source_location").notNull().default(""),
  quantity: real("quantity").notNull().default(0),
  unitPrice: real("unit_price").notNull().default(0),
  additionalCostEstimate: real("additional_cost_estimate").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  quarter: text("quarter").notNull().default("Q1"),
  financeMappingStatus: text("finance_mapping_status").notNull().default("Needs Finance review"),
  confirmedFinanceCode: text("confirmed_finance_code").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const lifecycleRecords = sqliteTable("lifecycle_records", {
  documentId: text("document_id").primaryKey(),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  type: text("type").notNull(),
  reference: text("reference").notNull().default(""),
  vendor: text("vendor").notNull().default(""),
  date: text("date").notNull().default(""),
  status: text("status").notNull().default("Draft"),
  currency: text("currency").notNull().default("USD"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const lifecycleLines = sqliteTable("lifecycle_lines", {
  documentLineId: text("document_line_id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => lifecycleRecords.documentId),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  spendingLineId: text("spending_line_id"),
  allocationId: text("allocation_id"),
  description: text("description").notNull().default(""),
  quantity: real("quantity").notNull().default(0),
  amount: real("amount").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  spendQuarter: text("spend_quarter").notNull().default("Q1"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const purchaseLinks = sqliteTable("purchase_links", {
  purchaseLinkId: text("purchase_link_id").primaryKey(),
  documentLineId: text("document_line_id")
    .notNull()
    .references(() => lifecycleLines.documentLineId),
  spendingLineId: text("spending_line_id")
    .notNull()
    .references(() => purchaseItems.spendingLineId),
  allocationId: text("allocation_id"),
  attributedQuantity: real("attributed_quantity").notNull().default(0),
  attributedAmount: real("attributed_amount").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const lifecycleTransitions = sqliteTable("lifecycle_transitions", {
  transitionId: text("transition_id").primaryKey(),
  fromLineId: text("from_line_id")
    .notNull()
    .references(() => lifecycleLines.documentLineId),
  toLineId: text("to_line_id")
    .notNull()
    .references(() => lifecycleLines.documentLineId),
  transitionType: text("transition_type").notNull(),
  convertedAmount: real("converted_amount").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const knowledgeNotes = sqliteTable("knowledge_notes", {
  noteId: text("note_id").primaryKey(),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  attachedToType: text("attached_to_type").notNull().default("Project"),
  attachedToId: text("attached_to_id").notNull(),
  wikilinksJson: text("wikilinks_json").notNull().default("[]"),
  tagsJson: text("tags_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditEvents = sqliteTable("audit_events", {
  auditId: text("audit_id").primaryKey(),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  actor: text("actor").notNull(),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
  action: text("action").notNull(),
  targetId: text("target_id").notNull().default(""),
  beforeDeltaJson: text("before_delta_json").notNull().default("{}"),
  afterDeltaJson: text("after_delta_json").notNull().default("{}"),
  reason: text("reason").notNull().default(""),
  sourceRef: text("source_ref").notNull().default(""),
});

export const outcomeDefinitions = sqliteTable("outcome_definitions", {
  outcomeId: text("outcome_id").primaryKey(),
  functionId: text("function_id").references(() => businessFunctions.functionId),
  name: text("name").notNull(),
  definition: text("definition").notNull().default(""),
  unit: text("unit").notNull().default(""),
  measurementWindow: text("measurement_window").notNull().default(""),
  direction: text("direction").notNull().default("Increase"),
  expectedEvidenceSource: text("expected_evidence_source").notNull().default(""),
  scope: text("scope").notNull().default("Reusable"),
  lifecycle: text("lifecycle").notNull().default("Active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const projectOutcomes = sqliteTable("project_outcomes", {
  projectOutcomeId: text("project_outcome_id").primaryKey(),
  projectRecordId: text("project_record_id")
    .notNull()
    .references(() => projects.recordId),
  outcomeId: text("outcome_id").references(() => outcomeDefinitions.outcomeId),
  name: text("name").notNull(),
  baseline: text("baseline").notNull().default(""),
  target: text("target").notNull().default(""),
  currentProgress: text("current_progress").notNull().default(""),
  evidenceStrength: text("evidence_strength").notNull().default("Moderate"),
  evidenceSource: text("evidence_source").notNull().default(""),
  owner: text("owner").notNull().default(""),
  measurementWindow: text("measurement_window").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});


