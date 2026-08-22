import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Schema (Postgres via Drizzle).
 *
 * Three layers:
 *  1. CANONICAL CATALOG (shared, versioned): rating_system -> rs_version ->
 *     catalog_credit -> catalog_requirement. Mostadam manuals are standardized,
 *     so a catalog is authored ONCE (by parsing a manual and promoting the
 *     result) and reused across all projects.
 *  2. PARSE STAGING: source_document -> parsed_credit -> parsed_requirement.
 *     The parser writes drafts here during catalog authoring; a human promotes
 *     selected drafts into the canonical catalog.
 *  3. PROJECT INSTANCE: project -> project_credit -> requirement_entry ->
 *     evidence_doc. A project selects an rs_version and instantiates its
 *     checklist from the canonical catalog. Derived status only — no points,
 *     tier, owner, or due date.
 *
 * Solo, single workspace: `workspaceId` is kept on every row so multi-tenant can
 * land later, but there is exactly one workspace now.
 *
 * Timestamps stay as unix-epoch seconds (integer) so existing app code is
 * unchanged. JSON blobs stay text; callers parse them.
 */

const now = sql`(extract(epoch from now())::integer)`;

export const workspaces = pgTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

export const users = pgTable("app_user", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

// ============================================================
// 1. CANONICAL CATALOG (shared, versioned)
// ============================================================

export const ratingSystems = pgTable("rating_system", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  key: text("key").notNull(),
  name: text("name").notNull(),
  authority: text("authority"),
  country: text("country"),
  createdAt: integer("created_at").notNull().default(now),
});

/** A scheme + stage + version_label is the addressable rating-system version. */
export const rsVersions = pgTable(
  "rs_version",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    ratingSystemId: text("rating_system_id")
      .notNull()
      .references(() => ratingSystems.id),
    scheme: text("scheme").notNull(),
    stage: text("stage").notNull(),
    versionLabel: text("version_label").notNull(),
    status: text("status").notNull().default("draft"),
    sourceDocumentId: text("source_document_id"),
    scopeTotals: text("scope_totals"),
    notes: text("notes"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("rs_version_unique").on(
      t.ratingSystemId,
      t.scheme,
      t.stage,
      t.versionLabel,
    ),
  ],
);

export const catalogCredits = pgTable(
  "catalog_credit",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    rsVersionId: text("rs_version_id")
      .notNull()
      .references(() => rsVersions.id),
    code: text("code").notNull(),
    title: text("title").notNull(),
    categoryCode: text("category_code").notNull(),
    categoryName: text("category_name").notNull(),
    isKeystone: boolean("is_keystone").notNull().default(false),
    pointsRaw: text("points_raw"),
    aim: text("aim"),
    reviewNote: text("review_note"),
    references: text("references"),
    applicability: text("applicability"),
    supportingGuidance: text("supporting_guidance"),
    toolRef: text("tool_ref"),
    reconciliation: text("reconciliation"),
    sourcePageStart: integer("source_page_start"),
    sourcePageEnd: integer("source_page_end"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("catalog_credit_unique").on(t.rsVersionId, t.code)],
);

export const catalogRequirements = pgTable("catalog_requirement", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  catalogCreditId: text("catalog_credit_id")
    .notNull()
    .references(() => catalogCredits.id),
  seq: integer("seq").notNull(),
  title: text("title"),
  text: text("text").notNull(),
  metricType: text("metric_type").notNull(),
  unit: text("unit"),
  pointsRaw: text("points_raw"),
  pointsType: text("points_type"),
  optionGroup: text("option_group"),
  keystone: boolean("keystone").notNull().default(false),
  keystoneCondition: text("keystone_condition"),
  numericSpec: text("numeric_spec"),
  evidence: text("evidence"),
  evidenceSpecs: text("evidence_specs"),
  sourcePageStart: integer("source_page_start"),
  sourcePageEnd: integer("source_page_end"),
  createdAt: integer("created_at").notNull().default(now),
});

// ============================================================
// 2. PARSE STAGING (parser output; promoted into the catalog)
// ============================================================

export const sourceDocuments = pgTable("source_document", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  rsVersionId: text("rs_version_id"),
  projectId: text("project_id"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("uploaded"),
  error: text("error"),
  pageCount: integer("page_count"),
  scheme: text("scheme"),
  stage: text("stage"),
  rawText: text("raw_text"),
  createdAt: integer("created_at").notNull().default(now),
});

export const parsedCredits = pgTable(
  "parsed_credit",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    sourceDocumentId: text("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id),
    scheme: text("scheme").notNull(),
    stage: text("stage").notNull(),
    code: text("code").notNull(),
    categoryCode: text("category_code").notNull(),
    categoryName: text("category_name").notNull(),
    title: text("title").notNull(),
    isKeystone: boolean("is_keystone").notNull().default(false),
    pointsRaw: text("points_raw"),
    aim: text("aim"),
    references: text("references"),
    applicability: text("applicability"),
    supportingGuidance: text("supporting_guidance"),
    toolRef: text("tool_ref"),
    reconciliation: text("reconciliation"),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    promoted: boolean("promoted").notNull().default(false),
    dropped: boolean("dropped").notNull().default(false),
    aiProposal: text("ai_proposal"),
    aiStatus: text("ai_status"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("parsed_credit_doc_idx").on(t.sourceDocumentId, t.code)],
);

export const parsedRequirements = pgTable("parsed_requirement", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  parsedCreditId: text("parsed_credit_id")
    .notNull()
    .references(() => parsedCredits.id),
  seq: integer("seq").notNull(),
  title: text("title"),
  text: text("text").notNull(),
  metricType: text("metric_type").notNull(),
  unit: text("unit"),
  pointsRaw: text("points_raw"),
  pointsType: text("points_type"),
  optionGroup: text("option_group"),
  keystone: boolean("keystone").notNull().default(false),
  keystoneCondition: text("keystone_condition"),
  numericSpec: text("numeric_spec"),
  evidence: text("evidence"),
  evidenceSpecs: text("evidence_specs"),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  origin: text("origin").notNull().default("deterministic"),
  createdAt: integer("created_at").notNull().default(now),
});

// ============================================================
// 3. PROJECT INSTANCE (instantiated from the canonical catalog)
// ============================================================

export const projects = pgTable("project", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  rsVersionId: text("rs_version_id").references(() => rsVersions.id),
  name: text("name").notNull(),
  type: text("type"),
  location: text("location"),
  status: text("status").notNull().default("in_progress"),
  createdAt: integer("created_at").notNull().default(now),
});

export const projectCredits = pgTable(
  "project_credit",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    catalogCreditId: text("catalog_credit_id")
      .notNull()
      .references(() => catalogCredits.id),
    status: text("status").notNull().default("not_started"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("project_credit_unique").on(t.projectId, t.catalogCreditId),
  ],
);

export const requirementEntries = pgTable("requirement_entry", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  projectCreditId: text("project_credit_id")
    .notNull()
    .references(() => projectCredits.id),
  catalogRequirementId: text("catalog_requirement_id")
    .notNull()
    .references(() => catalogRequirements.id),
  valueBool: boolean("value_bool"),
  valueNumber: doublePrecision("value_number"),
  valueText: text("value_text"),
  status: text("status").notNull().default("not_started"),
  note: text("note"),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const evidenceDocs = pgTable("evidence_doc", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  requirementEntryId: text("requirement_entry_id")
    .notNull()
    .references(() => requirementEntries.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  createdAt: integer("created_at").notNull().default(now),
});

export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type RatingSystem = typeof ratingSystems.$inferSelect;
export type RsVersion = typeof rsVersions.$inferSelect;
export type CatalogCredit = typeof catalogCredits.$inferSelect;
export type CatalogRequirement = typeof catalogRequirements.$inferSelect;
export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type ParsedCreditRow = typeof parsedCredits.$inferSelect;
export type ParsedRequirementRow = typeof parsedRequirements.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectCredit = typeof projectCredits.$inferSelect;
export type RequirementEntry = typeof requirementEntries.$inferSelect;
export type EvidenceDoc = typeof evidenceDocs.$inferSelect;
