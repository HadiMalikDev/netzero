import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Schema (SQLite via Drizzle).
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
 */

const now = sql`(unixepoch())`;

export const workspaces = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

export const users = sqliteTable("user", {
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

export const ratingSystems = sqliteTable("rating_system", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  key: text("key").notNull(), // e.g. mostadam
  name: text("name").notNull(),
  authority: text("authority"),
  country: text("country"),
  createdAt: integer("created_at").notNull().default(now),
});

/** A scheme + stage + version_label is the addressable rating-system version. */
export const rsVersions = sqliteTable(
  "rs_version",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    ratingSystemId: text("rating_system_id")
      .notNull()
      .references(() => ratingSystems.id),
    scheme: text("scheme").notNull(), // residential | commercial | communities
    stage: text("stage").notNull(), // D+C | O+E
    versionLabel: text("version_label").notNull(), // e.g. 2019
    status: text("status").notNull().default("draft"), // draft | published
    sourceDocumentId: text("source_document_id"), // the manual it was authored from
    // Table 4 denominators: { "Shell only": 35, "Core & Shell": 130, ... }
    scopeTotals: text("scope_totals"), // JSON
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

export const catalogCredits = sqliteTable(
  "catalog_credit",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    rsVersionId: text("rs_version_id")
      .notNull()
      .references(() => rsVersions.id),
    code: text("code").notNull(), // e.g. HC-10
    title: text("title").notNull(),
    categoryCode: text("category_code").notNull(), // prefix, e.g. HC
    categoryName: text("category_name").notNull(), // e.g. Health and Comfort
    isKeystone: integer("is_keystone", { mode: "boolean" })
      .notNull()
      .default(false),
    pointsRaw: text("points_raw"),
    aim: text("aim"),
    references: text("references"), // JSON string[]
    // Credit Applicability Conditions: { scope: { typology: points|null } }
    applicability: text("applicability"), // JSON
    supportingGuidance: text("supporting_guidance"),
    toolRef: text("tool_ref"),
    // Extractor↔manual reconciliation flags: { ok, expected, got, note }
    reconciliation: text("reconciliation"), // JSON
    sourcePageStart: integer("source_page_start"),
    sourcePageEnd: integer("source_page_end"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("catalog_credit_unique").on(t.rsVersionId, t.code)],
);

export const catalogRequirements = sqliteTable("catalog_requirement", {
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
  metricType: text("metric_type").notNull(), // BOOLEAN | NUMERIC | DESCRIPTIVE
  unit: text("unit"),
  pointsRaw: text("points_raw"),
  pointsType: text("points_type"), // fixed | scaled | shared
  optionGroup: text("option_group"), // XOR grouping label, e.g. "E-01 options"
  keystone: integer("keystone", { mode: "boolean" }).notNull().default(false),
  keystoneCondition: text("keystone_condition"),
  // Reference values: { limits?: [...], threshold?: {...}, bands?: [...] }
  numericSpec: text("numeric_spec"), // JSON
  // Evidence per stage: [{ stage: "design"|"construction", text }]
  evidence: text("evidence"), // JSON
  evidenceSpecs: text("evidence_specs"), // JSON string[] (deprecated; kept for back-compat)
  sourcePageStart: integer("source_page_start"),
  sourcePageEnd: integer("source_page_end"),
  createdAt: integer("created_at").notNull().default(now),
});

// ============================================================
// 2. PARSE STAGING (parser output; promoted into the catalog)
// ============================================================

/**
 * One uploaded PDF + its parse job. During catalog authoring it belongs to an
 * `rs_version`. `status`: uploaded -> parsing -> parsed -> failed | rejected
 * (rejected = failed the Mostadam-only gate) -> promoted.
 */
export const sourceDocuments = sqliteTable("source_document", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  // Context: catalog authoring uses rsVersionId; projectId retained/nullable
  // for any legacy per-project ingestion.
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

/** Draft credit produced by the parser; awaits promotion into the catalog. */
export const parsedCredits = sqliteTable(
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
    isKeystone: integer("is_keystone", { mode: "boolean" })
      .notNull()
      .default(false),
    pointsRaw: text("points_raw"),
    aim: text("aim"),
    references: text("references"),
    applicability: text("applicability"), // JSON
    supportingGuidance: text("supporting_guidance"),
    toolRef: text("tool_ref"),
    reconciliation: text("reconciliation"), // JSON
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    promoted: integer("promoted", { mode: "boolean" }).notNull().default(false),
    dropped: integer("dropped", { mode: "boolean" }).notNull().default(false),
    // AI verify-&-complete proposal (JSON) awaiting human accept/reject.
    aiProposal: text("ai_proposal"),
    aiStatus: text("ai_status"), // proposed | applied | rejected
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("parsed_credit_doc_idx").on(t.sourceDocumentId, t.code)],
);

export const parsedRequirements = sqliteTable("parsed_requirement", {
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
  keystone: integer("keystone", { mode: "boolean" }).notNull().default(false),
  keystoneCondition: text("keystone_condition"),
  numericSpec: text("numeric_spec"),
  evidence: text("evidence"), // JSON [{stage,text}]
  evidenceSpecs: text("evidence_specs"),
  pageStart: integer("page_start"),
  pageEnd: integer("page_end"),
  // Provenance: deterministic | ai_added | ai_corrected.
  origin: text("origin").notNull().default("deterministic"),
  createdAt: integer("created_at").notNull().default(now),
});

// ============================================================
// 3. PROJECT INSTANCE (instantiated from the canonical catalog)
// ============================================================

export const projects = sqliteTable("project", {
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

/** Instance of a canonical catalog credit inside a project's live checklist. */
export const projectCredits = sqliteTable(
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

/** This project's answer to one canonical requirement. */
export const requirementEntries = sqliteTable("requirement_entry", {
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
  valueBool: integer("value_bool", { mode: "boolean" }),
  valueNumber: integer("value_number"),
  valueText: text("value_text"),
  status: text("status").notNull().default("not_started"),
  note: text("note"),
  updatedAt: integer("updated_at").notNull().default(now),
});

/** An uploaded evidence file attached to a requirement entry. */
export const evidenceDocs = sqliteTable("evidence_doc", {
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
