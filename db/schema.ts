import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  type AnyPgColumn,
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
  /**
   * The credit the file belongs to. Null only for a material review file,
   * which belongs to a product instead (exactly one of the two is set): one
   * SMQ document can support several credits, or none (a LEED-only row).
   */
  projectCreditId: text("project_credit_id").references(() => projectCredits.id),
  /** The material product (one SMQ revision) the file was uploaded to. */
  materialProductId: text("material_product_id").references(
    (): AnyPgColumn => materialProducts.id,
  ),
  /**
   * When a certificate or test report was issued (YYYY-MM-DD), for the
   * project's expiry window. Required on SMQ row documents (2026-10-27).
   */
  issuedOn: text("issued_on"),
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
}, (t) => [
  check(
    "evidence_doc_one_owner",
    sql`(${t.projectCreditId} is null) <> (${t.materialProductId} is null)`,
  ),
]);

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
 * at supply air intake". One photo may be linked to several items. Removing
 * the file removes its links.
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
    // A photo can show several items (one wide site shot), but is linked to
    // the same item once (2026-10-12).
    uniqueIndex("checklist_response_photo_response_doc_uq").on(t.responseId, t.evidenceDocId),
  ],
);

/**
 * MATERIAL REVIEW (Sprint 3, 2026-10-27). The client's Sustainability Material
 * Questionnaire (SMQ): one questionnaire per product, a fixed "For all
 * materials" block plus the rows of the material types picked for it, each row
 * pointing at the credit it serves. See
 * docs/feedback/2026-10-sprint-3-material-review/01-material-review/task.md.
 *
 * Same two layers as the inspection forms: a workspace default (no
 * project_id, rows hold credit CODES because no catalog exists when it is
 * seeded) copied into a project on first use (rows then hold that project's
 * project_credit ids). Edits to a copy never touch the default.
 */
export const smqTemplates = pgTable(
  "smq_template",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    /** Null for the workspace default; set for a project's own copy. */
    projectId: text("project_id").references(() => projects.id),
    title: text("title").notNull(),
    /** The questionnaire's own revision label, e.g. "Rev03". */
    revision: text("revision"),
    /** Certificates older than this many years count as expired (D7). */
    expiryYears: integer("expiry_years").notNull().default(3),
    /**
     * The project's total construction material cost from the BOQ, in SAR:
     * the RC-01 denominator (D14). Null until entered.
     */
    boqMaterialCostSar: doublePrecision("boq_material_cost_sar"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("smq_template_project_uq")
      .on(t.projectId)
      .where(sql`${t.projectId} is not null`),
  ],
);

/**
 * One block of the questionnaire: the "For all materials" block, which every
 * product answers, or one material type ("Paints & Coatings"), whose rows a
 * product answers when the type is picked for it.
 */
export const smqSections = pgTable("smq_section", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => smqTemplates.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  /** all_materials | material_type */
  kind: text("kind").notNull().default("material_type"),
  heading: text("heading").notNull(),
  /** Switched off rather than deleted, like checklist items. */
  active: boolean("active").notNull().default(true),
  /**
   * The calculated credit parts a product of this type counts toward unless
   * the reviewer unticks it (D33), as a JSON list of part keys from
   * lib/materials/credits.ts, e.g. ["MW-05:steel"].
   */
  defaultParts: text("default_parts").notNull().default("[]"),
});

export const smqRows = pgTable("smq_row", {
  id: text("id").primaryKey(),
  sectionId: text("section_id")
    .notNull()
    .references(() => smqSections.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  /** The required documents / parameters, as the SMQ words them. */
  text: text("text").notNull(),
  /** The LEED reference, kept as text only (D2): it never counts. */
  leedRef: text("leed_ref"),
  /** The Mostadam credit code in the default ("MW-05"); kept on copies for display. */
  creditCode: text("credit_code"),
  /**
   * The credit in a project's copy, resolved once from credit_code when the
   * copy is made (D20). Null with a code = unlinked (the catalog lacks it);
   * null without one = a LEED-only row.
   */
  projectCreditId: text("project_credit_id").references(() => projectCredits.id),
  /**
   * fixed | project_value | design_package | construction_team |
   * project_requirement — the SMQ's own note on where the value comes from.
   */
  kind: text("kind").notNull().default("fixed"),
  /** The SMQ's note on the row, verbatim ("VOC content and emission test report is required…"). */
  note: text("note"),
  /** The project's target, shown beside the answer; never compared automatically (D21). */
  targetText: text("target_text"),
  /** Unit of the value the row asks for, e.g. "g/L", "%", "W/m²K". */
  valueUnit: text("value_unit"),
  active: boolean("active").notNull().default(true),
});

/** One material submittal (MTS / TBE), holding one or more products (D11). */
export const materialSubmittals = pgTable("material_submittal", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  /** The contractor's reference, e.g. "JCD-OCN-MBL-PRO-MTS-0411". */
  ref: text("ref").notNull(),
  title: text("title").notNull(),
  discipline: text("discipline"),
  supplier: text("supplier"),
  /** YYYY-MM-DD */
  submittedOn: text("submitted_on"),
  createdAt: integer("created_at").notNull().default(now),
});

/**
 * One product of a submittal at one revision: its SMQ header, review and BOQ
 * quantities. A resubmission is a new row (revision + 1) linked to the one it
 * replaces, which then stays as it was reviewed (D9); only the latest
 * revision counts.
 */
export const materialProducts = pgTable(
  "material_product",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    submittalId: text("submittal_id")
      .notNull()
      .references(() => materialSubmittals.id),
    revision: integer("revision").notNull().default(0),
    previousRevisionId: text("previous_revision_id").references(
      (): AnyPgColumn => materialProducts.id,
    ),
    /** "Material Subject" on the SMQ, e.g. "Jotafloor Easyflow Primer HS". */
    name: text("name").notNull(),
    locationOfUse: text("location_of_use"),
    /** Inside the weatherproofing line. HC-11 counts interior products only (D33). */
    interior: boolean("interior").notNull().default(true),
    manufacturer: text("manufacturer"),
    supplier: text("supplier"),
    countryOfOrigin: text("country_of_origin"),
    contactName: text("contact_name"),
    contactMobile: text("contact_mobile"),
    /** A | B | C | D, null until reviewed. A and B count toward credits (D6). */
    status: text("status"),
    /** YYYY-MM-DD: puts the review into a month (D26). */
    reviewedOn: text("reviewed_on"),
    reviewer: text("reviewer"),
    /** "The proposed material is Applicable / Not Applicable…" */
    applicable: boolean("applicable"),
    remarks: text("remarks"),
    manufacturerSignatory: text("manufacturer_signatory"),
    manufacturerSignedOn: text("manufacturer_signed_on"),
    contractorSignatory: text("contractor_signatory"),
    contractorSignedOn: text("contractor_signed_on"),
    /** BOQ quantities: the forecast (D13), in fixed units (D25). */
    boqWeightT: doublePrecision("boq_weight_t"),
    boqVolumeM3: doublePrecision("boq_volume_m3"),
    boqCostSar: doublePrecision("boq_cost_sar"),
    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("material_product_submittal_idx").on(t.submittalId)],
);

/** The material types picked for a product (D12): which sections it answers. */
export const materialProductTypes = pgTable(
  "material_product_type",
  {
    productId: text("product_id")
      .notNull()
      .references(() => materialProducts.id, { onDelete: "cascade" }),
    sectionId: text("section_id")
      .notNull()
      .references(() => smqSections.id),
  },
  (t) => [uniqueIndex("material_product_type_uq").on(t.productId, t.sectionId)],
);

/** The calculated credit parts a product counts toward (D33), e.g. "MW-05:steel". */
export const materialProductParts = pgTable(
  "material_product_part",
  {
    productId: text("product_id")
      .notNull()
      .references(() => materialProducts.id, { onDelete: "cascade" }),
    part: text("part").notNull(),
  },
  (t) => [uniqueIndex("material_product_part_uq").on(t.productId, t.part)],
);

/**
 * One answer per questionnaire row shown for a product. The row's text,
 * credit, target and kind are copied in when the answer is made, so editing
 * the project's questionnaire never rewrites a product already entered. An
 * answer whose material type is later unpicked stays, hidden, and comes back
 * if the type is picked again.
 */
export const materialAnswers = pgTable(
  "material_answer",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => materialProducts.id, { onDelete: "cascade" }),
    rowId: text("row_id").references(() => smqRows.id, { onDelete: "set null" }),
    sectionId: text("section_id").references(() => smqSections.id, { onDelete: "set null" }),
    sectionHeading: text("section_heading").notNull(),
    sectionKind: text("section_kind").notNull(),
    sectionSeq: integer("section_seq").notNull(),
    seq: integer("seq").notNull(),
    text: text("text").notNull(),
    leedRef: text("leed_ref"),
    creditCode: text("credit_code"),
    projectCreditId: text("project_credit_id").references(() => projectCredits.id),
    kind: text("kind").notNull(),
    note: text("note"),
    targetText: text("target_text"),
    /** yes | no | na | null (not answered yet). */
    answer: text("answer"),
    value: text("value"),
    unit: text("unit"),
    remark: text("remark"),
  },
  (t) => [
    index("material_answer_product_idx").on(t.productId),
    uniqueIndex("material_answer_product_row_uq").on(t.productId, t.rowId),
  ],
);

/**
 * Where a material file shows: on one answer's row, or in one of the
 * product's named slots (submittal | boq | datasheet | filled_smq), or as an
 * extra product attachment (neither). Links, not copies, so a new revision
 * carries the same file forward; the file goes when its last link does.
 */
export const materialDocs = pgTable(
  "material_doc",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => materialProducts.id, { onDelete: "cascade" }),
    answerId: text("answer_id").references(() => materialAnswers.id, { onDelete: "cascade" }),
    slot: text("slot"),
    evidenceDocId: text("evidence_doc_id")
      .notNull()
      .references(() => evidenceDocs.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("material_doc_product_idx").on(t.productId)],
);

/** One delivery of a product (date, PO, quantity, cost): the actual (D13). */
export const materialDeliveries = pgTable(
  "material_delivery",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => materialProducts.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD */
    deliveredOn: text("delivered_on").notNull(),
    poNumber: text("po_number"),
    weightT: doublePrecision("weight_t"),
    volumeM3: doublePrecision("volume_m3"),
    costSar: doublePrecision("cost_sar"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("material_delivery_product_idx").on(t.productId)],
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
export type SmqTemplate = typeof smqTemplates.$inferSelect;
export type SmqSection = typeof smqSections.$inferSelect;
export type SmqRow = typeof smqRows.$inferSelect;
export type MaterialSubmittal = typeof materialSubmittals.$inferSelect;
export type MaterialProduct = typeof materialProducts.$inferSelect;
export type MaterialAnswer = typeof materialAnswers.$inferSelect;
export type MaterialDelivery = typeof materialDeliveries.$inferSelect;
