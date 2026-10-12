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
    /**
     * Rating-level thresholds as JSON `[{"tier":"Green","min":25}, …]`, lowest
     * first. Full Scope only for now (the manual's Table 1). Null until set in
     * catalog admin; the project dial needs it.
     */
    tierThresholds: text("tier_thresholds"),
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
  /** The rating level being pursued (a tier name from the version's thresholds). */
  targetTier: text("target_tier"),
  /**
   * design | construction. Decides which of the manual's listed documents are
   * due now: construction-stage documents only gate completion once the
   * project is at construction stage.
   */
  stage: text("stage").notNull().default("design"),
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
    /** Whether the project is pursuing this credit. Every credit starts targeted. */
    targeted: boolean("targeted").notNull().default(true),
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
  /** false = an either/or option the project chose not to pursue. */
  planned: boolean("planned").notNull().default(true),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const evidenceDocs = pgTable("evidence_doc", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  /** The credit the file belongs to. Always set. */
  projectCreditId: text("project_credit_id")
    .notNull()
    .references(() => projectCredits.id),
  /**
   * The requirement the file was attached to. Null for a credit-level
   * "additional attachment" (revised shop drawings, approvals…) that supports
   * the credit as a whole rather than one requirement.
   */
  requirementEntryId: text("requirement_entry_id").references(
    () => requirementEntries.id,
  ),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  /**
   * Which of the requirement's extracted evidence documents this file provides,
   * as an index into catalog_requirement.evidence_specs. Null means the file is
   * attached to the requirement without claiming a specific document — the case
   * for supporting material, and for requirements whose evidence list did not
   * extract. Nullable so it can never block an upload.
   */
  evidenceSpecIndex: integer("evidence_spec_index"),
  createdAt: integer("created_at").notNull().default(now),
});

/**
 * The AI's read of one uploaded document against the requirement it was
 * attached to. ADVISORY ONLY — nothing here feeds derived status or points; a
 * model opinion must never move a compliance state on its own. One row per
 * evidence file, replaced when a review is re-run.
 */
export const evidenceReviews = pgTable("evidence_review", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  evidenceDocId: text("evidence_doc_id")
    .notNull()
    .references(() => evidenceDocs.id)
    .unique(),
  /** pending | done | failed */
  state: text("state").notNull().default("pending"),
  /** met | partially_met | not_met | unreadable | unclear — null while pending */
  verdict: text("verdict"),
  summary: text("summary"),
  /** JSON array of verbatim quotes from the document backing the verdict. */
  quotes: text("quotes"),
  /** JSON array of the requirement's expected documents judged missing. */
  gaps: text("gaps"),
  model: text("model"),
  error: text("error"),
  createdAt: integer("created_at").notNull().default(now),
  completedAt: integer("completed_at"),
});

/**
 * Inspection-sheet forms (Sprint 2 item 3). A checklist is a project-specific
 * form the site team fills at every inspection — the IAQ sheet for HC-10, a
 * site-audit sheet for SS-03 — so it is data, not code.
 *
 * A template with no `project_credit_id` is a WORKSPACE DEFAULT: matched to a
 * credit by its title (credit codes differ across Mostadam schemes) and copied
 * into a project the first time that project uses it. A project's copy is its
 * own to edit; edits never touch the default or other projects.
 */
export const checklistTemplates = pgTable(
  "checklist_template",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    /** Null for a workspace default; set for a project's own copy. */
    projectCreditId: text("project_credit_id").references(() => projectCredits.id),
    /** The credit title a default applies to, e.g. "Indoor Air Quality". */
    creditTitle: text("credit_title").notNull(),
    title: text("title").notNull(),
    /** The declaration printed above the signature line. */
    confirmation: text("confirmation").notNull(),
    /**
     * Text identifying, among the credit's required documents, the plan the AI
     * reads ("IAQ Management Plan") and the document the completed sheet
     * becomes ("Completed IAQ Checklist"). Matched case-insensitively as a
     * substring, so a re-parsed catalog keeps working.
     */
    planDocument: text("plan_document"),
    sheetDocument: text("sheet_document"),
    /**
     * How the printed sheet is laid out, per form, because each site team's
     * form differs (2026-10-08): IAQ prints N/A inside Remarks; ESC has its own
     * NA column and calls the last column "Notes/Comments/Non-Conformances".
     */
    naColumn: boolean("na_column").notNull().default(false),
    remarksLabel: text("remarks_label").notNull().default("Remarks"),
    /** Header fields, in order, as a JSON list of: ref_no, date, time, inspector, area. */
    headerFields: text("header_fields").notNull().default('["date","inspector","area"]'),
    /**
     * Sign-off positions as a JSON list, e.g. ["Sustainability Manager",
     * "Environmental Manager"]: one "Checked & verified by" block each. Empty
     * list = a single Signature / Date line under the confirmation statement.
     */
    signatories: text("signatories").notNull().default("[]"),
    /**
     * Print a corrective-action log (Sr#, Observation, Recommendation, Photo,
     * Corrective Action Taken, Photo, Obs./Closing Date, Status) instead of
     * the plain photo list. On for ESC; the heading is the form's own.
     */
    observationLog: boolean("observation_log").notNull().default(false),
    observationTitle: text("observation_title").notNull().default("Observations"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("checklist_template_project_credit_uq")
      .on(t.projectCreditId)
      .where(sql`${t.projectCreditId} is not null`),
  ],
);

export const checklistSections = pgTable("checklist_section", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  heading: text("heading").notNull(),
});

export const checklistItems = pgTable("checklist_item", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => checklistSections.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  text: text("text").notNull(),
  /**
   * Switched off rather than deleted: past inspections keep their answers, and
   * the item can come back. Off items are left out of new inspections.
   */
  active: boolean("active").notNull().default(true),
  /**
   * The answer that means compliant: "yes" (a measure in place), "no" (a
   * problem absent, e.g. "Is there any spill or leak at site?"), or null for a
   * plain observation ("Any rain in the last 24 hours?"). The AI suggests Yes
   * only where Yes is compliant, so it can never assert that a problem exists.
   */
  compliantAnswer: text("compliant_answer").default("yes"),
});

/**
 * One filled copy of a project's form: a dated inspection. The AI drafts the
 * answers; a person reviews them; only what they save goes on the PDF.
 */
export const checklistInspections = pgTable("checklist_inspection", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  templateId: text("template_id")
    .notNull()
    .references(() => checklistTemplates.id),
  /** YYYY-MM-DD, as entered. */
  inspectionDate: text("inspection_date"),
  inspector: text("inspector"),
  area: text("area"),
  inspectionTime: text("inspection_time"),
  /** The team's own reference, e.g. "MBL-JCD-ESC-001". */
  refNo: text("ref_no"),
  /** pending | done | skipped | failed — the AI draft, not the review. */
  aiState: text("ai_state").notNull().default("pending"),
  /** Why the draft was skipped or failed, or which files it read (JSON list). */
  aiNote: text("ai_note"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at"),
  createdAt: integer("created_at").notNull().default(now),
});

/**
 * One answer per item of an inspection. The item's number, section and text
 * are copied in when the inspection starts, so editing the form later never
 * rewrites a past inspection.
 */
export const checklistResponses = pgTable(
  "checklist_response",
  {
    id: text("id").primaryKey(),
    inspectionId: text("inspection_id")
      .notNull()
      .references(() => checklistInspections.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => checklistItems.id),
    itemNo: text("item_no").notNull(),
    sectionNo: text("section_no").notNull(),
    sectionHeading: text("section_heading").notNull(),
    itemText: text("item_text").notNull(),
    /** The item's compliant answer, copied in with its text. */
    compliantAnswer: text("compliant_answer"),
    /** The AI's suggestion: "yes" | "na" | null (no suggestion). Never "no". */
    aiAnswer: text("ai_answer"),
    /** The plan sentence behind the suggestion, verbatim. */
    aiQuote: text("ai_quote"),
    /** The answer that prints: "yes" | "no" | "na" | null (left blank). */
    answer: text("answer"),
    remark: text("remark"),
  },
  (t) => [index("checklist_response_inspection_idx").on(t.inspectionId)],
);

/**
 * The corrective-action log of a project's form (Sprint 2 item 3): a running
 * list per credit, not per inspection, so an issue stays open across weekly
 * inspections until someone closes it. Opened automatically when a review
 * saves a non-compliant answer, or added by hand. The AI drafts the
 * recommendation; photos, corrective action and closing are a person's.
 */
export const checklistObservations = pgTable(
  "checklist_observation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    /** The project's own copy of the form: the log belongs to that credit. */
    templateId: text("template_id")
      .notNull()
      .references(() => checklistTemplates.id, { onDelete: "cascade" }),
    /** The inspection it was raised in; null when added by hand. */
    inspectionId: text("inspection_id").references(() => checklistInspections.id, { onDelete: "set null" }),
    /** The checklist item it came from ("4.5"), for de-duplication; null if by hand. */
    itemNo: text("item_no"),
    /**
     * The form item it came from. Duplicate checks match on this, not on the
     * printed number: numbers shift when the form is edited (an item switched
     * off or moved), the item does not.
     */
    itemId: text("item_id").references(() => checklistItems.id, { onDelete: "set null" }),
    observation: text("observation").notNull(),
    recommendation: text("recommendation"),
    /** "ai" while the recommendation is the AI's untouched draft; "person" once edited. */
    recommendationSource: text("recommendation_source"),
    /** pending | done | failed | skipped — the AI recommendation draft. */
    aiState: text("ai_state"),
    beforePhotoId: text("before_photo_id").references(() => evidenceDocs.id, { onDelete: "set null" }),
    correctiveAction: text("corrective_action"),
    afterPhotoId: text("after_photo_id").references(() => evidenceDocs.id, { onDelete: "set null" }),
    /** YYYY-MM-DD. */
    observedOn: text("observed_on"),
    closedOn: text("closed_on"),
    /** open | closed */
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("checklist_observation_template_idx").on(t.templateId)],
);

/**
 * A site photo taken for one item of an inspection, from the camera button on
 * its row (2026-10-12). The file itself is the credit's evidence (an
 * additional attachment, so it shows on the credit and in its PDFs); this row
 * says which item it shows, so the inspection PDF can label it "1.1 Filters
 * at supply air intake". Removing the file removes the link.
 */
export const checklistResponsePhotos = pgTable(
  "checklist_response_photo",
  {
    id: text("id").primaryKey(),
    responseId: text("response_id")
      .notNull()
      .references(() => checklistResponses.id, { onDelete: "cascade" }),
    evidenceDocId: text("evidence_doc_id")
      .notNull()
      .references(() => evidenceDocs.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("checklist_response_photo_response_idx").on(t.responseId),
    uniqueIndex("checklist_response_photo_doc_uq").on(t.evidenceDocId),
  ],
);

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
export type EvidenceReview = typeof evidenceReviews.$inferSelect;
