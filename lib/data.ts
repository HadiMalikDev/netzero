import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  evidenceDocs,
  evidenceReviews,
  projectCredits,
  projects,
  requirementEntries,
} from "@/db/schema";
import {
  deriveCreditStatus,
  deriveRequirementStatus,
  optionalFlags,
  missingEvidenceRequirements,
  type Status,
} from "./status";
import { summarizeSpec, WORKSPACE_ID } from "./catalog";
import { parseNum } from "./num";
import {
  bandsFromSpec,
  creditPointsEarned,
  creditPointsRange,
  pointsAwarded,
} from "./points";

// The single-tenant default workspace id lives in `./catalog`; re-exported here
// so existing `@/lib/data` importers keep working.
export { WORKSPACE_ID };

// ---------- projects ----------

export async function listProjects() {
  return db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, WORKSPACE_ID))
    .orderBy(projects.createdAt);
}

export async function getProject(id: string) {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, WORKSPACE_ID)));
  return p ?? null;
}

export async function createProject(input: {
  name: string;
  type?: string | null;
  location?: string | null;
  rsVersionId?: string | null;
}) {
  const id = randomUUID();
  await db.insert(projects).values({
    id,
    workspaceId: WORKSPACE_ID,
    rsVersionId: input.rsVersionId ?? null,
    name: input.name,
    type: input.type ?? null,
    location: input.location ?? null,
    status: "in_progress",
  });
  return id;
}

export async function firstProjectId(): Promise<string | null> {
  const rows = await listProjects();
  return rows[0]?.id ?? null;
}

/**
 * Stage of each evidence item ("design" / "construction"), index-aligned with
 * evidence_specs (both are written from the same parsed list). Tolerant of
 * null and malformed values; a missing stage comes back as null.
 */
function evidenceStages(raw: string | null, count: number): (string | null)[] {
  let items: unknown[] = [];
  try {
    const v = raw ? JSON.parse(raw) : [];
    if (Array.isArray(v)) items = v;
  } catch {
    // fall through with no stages
  }
  return Array.from({ length: count }, (_, i) => {
    const stage = (items[i] as { stage?: unknown } | undefined)?.stage;
    return typeof stage === "string" && stage !== "unknown" ? stage : null;
  });
}

/** A stored JSON array of strings, tolerant of null and malformed values. */
function jsonList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

// ---------- credit status computation ----------

/** One uploaded evidence file, as the credit screen shows it. */
/**
 * The AI's advisory read of one attachment. Never feeds status or points — see
 * lib/ai/evidence-review.ts.
 */
export interface EvidenceReviewView {
  state: string; // pending | done | failed
  verdict: string | null;
  summary: string | null;
  quotes: string[];
  gaps: string[];
  error: string | null;
}

export interface EvidenceAttachment {
  id: string;
  fileName: string;
  fileSize: number | null;
  createdAt: number;
  /** Index into the requirement's evidenceSpecs, or null if unassigned. */
  evidenceSpecIndex: number | null;
  review: EvidenceReviewView | null;
}

export interface RequirementView {
  entryId: string;
  requirementId: string;
  seq: number;
  title: string | null;
  text: string;
  metricType: string;
  unit: string | null;
  pointsRaw: string | null;
  optionGroup: string | null;
  pointsType: string | null;
  keystone: boolean;
  /** false = an either/or option the project chose not to pursue. */
  planned: boolean;
  /** Adds points, never required (see optionalFlags). */
  optional: boolean;
  target: string | null; // human-readable expected value, if the catalog has one
  numericSpec: unknown;
  evidenceSpecs: string[];
  /** Stage of each spec ("design" / "construction"), index-aligned. */
  evidenceStages: (string | null)[];
  requiresEvidence: boolean;
  pageStart: number | null;
  pageEnd: number | null;
  valueBool: boolean | null;
  valueNumber: number | null;
  valueText: string | null;
  note: string | null;
  evidenceCount: number;
  /** Files attached to this requirement, oldest first. */
  attachments: EvidenceAttachment[];
  status: Status;
  pointsEarned: number;
  pointsPreview: number;
}

export interface CreditView {
  projectCreditId: string;
  catalogCreditId: string;
  code: string;
  title: string;
  categoryCode: string;
  categoryName: string;
  isKeystone: boolean;
  pointsRaw: string | null;
  aim: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  status: Status;
  pointsEarned: number;
  pointsMax: number | null;
  pointsMin: number | null;
  requirements: RequirementView[];
  /**
   * Credit-level "additional attachments": files supporting the credit as a
   * whole, not one requirement. They never tick a required document or move
   * status — only requirement evidence does.
   */
  additionalAttachments: EvidenceAttachment[];
}

/** All confirmed credits of a project, with requirements + derived status. */
export async function getProjectCredits(projectId: string): Promise<CreditView[]> {
  const pcs = await db
    .select({
      pcId: projectCredits.id,
      catalogCreditId: catalogCredits.id,
      code: catalogCredits.code,
      title: catalogCredits.title,
      categoryCode: catalogCredits.categoryCode,
      categoryName: catalogCredits.categoryName,
      isKeystone: catalogCredits.isKeystone,
      pointsRaw: catalogCredits.pointsRaw,
      aim: catalogCredits.aim,
      pageStart: catalogCredits.sourcePageStart,
      pageEnd: catalogCredits.sourcePageEnd,
    })
    .from(projectCredits)
    .innerJoin(
      catalogCredits,
      eq(projectCredits.catalogCreditId, catalogCredits.id),
    )
    .where(eq(projectCredits.projectId, projectId))
    .orderBy(catalogCredits.categoryCode, catalogCredits.code);

  if (pcs.length === 0) return [];

  const pcIds = pcs.map((p) => p.pcId);

  // Entries + their catalog requirement (one query), then evidence counts.
  const entries = await db
    .select({
      entryId: requirementEntries.id,
      projectCreditId: requirementEntries.projectCreditId,
      requirementId: catalogRequirements.id,
      seq: catalogRequirements.seq,
      title: catalogRequirements.title,
      text: catalogRequirements.text,
      metricType: catalogRequirements.metricType,
      unit: catalogRequirements.unit,
      pointsRaw: catalogRequirements.pointsRaw,
      optionGroup: catalogRequirements.optionGroup,
      pointsType: catalogRequirements.pointsType,
      keystone: catalogRequirements.keystone,
      numericSpec: catalogRequirements.numericSpec,
      evidenceSpecs: catalogRequirements.evidenceSpecs,
      evidence: catalogRequirements.evidence,
      pageStart: catalogRequirements.sourcePageStart,
      pageEnd: catalogRequirements.sourcePageEnd,
      valueBool: requirementEntries.valueBool,
      valueNumber: requirementEntries.valueNumber,
      valueText: requirementEntries.valueText,
      note: requirementEntries.note,
      planned: requirementEntries.planned,
    })
    .from(requirementEntries)
    .innerJoin(
      catalogRequirements,
      eq(requirementEntries.catalogRequirementId, catalogRequirements.id),
    )
    .where(inArray(requirementEntries.projectCreditId, pcIds));

  const evidence = await db
    .select({
      entryId: evidenceDocs.requirementEntryId,
      projectCreditId: evidenceDocs.projectCreditId,
      id: evidenceDocs.id,
      fileName: evidenceDocs.fileName,
      fileSize: evidenceDocs.fileSize,
      createdAt: evidenceDocs.createdAt,
      evidenceSpecIndex: evidenceDocs.evidenceSpecIndex,
      reviewState: evidenceReviews.state,
      reviewVerdict: evidenceReviews.verdict,
      reviewSummary: evidenceReviews.summary,
      reviewQuotes: evidenceReviews.quotes,
      reviewGaps: evidenceReviews.gaps,
      reviewError: evidenceReviews.error,
    })
    .from(evidenceDocs)
    .leftJoin(
      evidenceReviews,
      eq(evidenceReviews.evidenceDocId, evidenceDocs.id),
    )
    .where(inArray(evidenceDocs.projectCreditId, pcIds))
    .orderBy(evidenceDocs.createdAt);
  const evByEntry = new Map<string, EvidenceAttachment[]>();
  const evByCredit = new Map<string, EvidenceAttachment[]>();
  for (const e of evidence) {
    // No requirement => a credit-level additional attachment.
    const [map, key] = e.entryId
      ? [evByEntry, e.entryId]
      : [evByCredit, e.projectCreditId];
    const arr = map.get(key) ?? [];
    arr.push({
      id: e.id,
      fileName: e.fileName,
      fileSize: e.fileSize,
      createdAt: e.createdAt,
      evidenceSpecIndex: e.evidenceSpecIndex,
      review: e.reviewState
        ? {
            state: e.reviewState,
            verdict: e.reviewVerdict,
            summary: e.reviewSummary,
            quotes: jsonList(e.reviewQuotes),
            gaps: jsonList(e.reviewGaps),
            error: e.reviewError,
          }
        : null,
    });
    map.set(key, arr);
  }

  const byCredit = new Map<string, RequirementView[]>();
  for (const e of entries) {
    const evidenceSpecs: string[] = e.evidenceSpecs
      ? (JSON.parse(e.evidenceSpecs) as string[])
      : [];
    // Evidence is mandatory for every Mostadam credit being claimed. An empty
    // evidenceSpecs list means the manual's evidence table did not extract, not
    // that the requirement can be closed without a file — so it must not soften
    // this flag. `evidenceSpecs` still drives WHICH documents are listed.
    const requiresEvidence = true;
    const attachments = evByEntry.get(e.entryId) ?? [];
    const evidenceCount = attachments.length;
    const status = deriveRequirementStatus({
      metricType: e.metricType,
      requiresEvidence,
      valueBool: e.valueBool,
      valueNumber: e.valueNumber,
      valueText: e.valueText,
      evidenceCount,
    });
    const numericSpec = e.numericSpec ? JSON.parse(e.numericSpec) : null;
    const award = {
      metricType: e.metricType,
      pointsRaw: e.pointsRaw,
      optionGroup: e.optionGroup,
      numericSpec,
      valueNumber: e.valueNumber,
      status,
      planned: e.planned,
    };
    const view: RequirementView = {
      entryId: e.entryId,
      requirementId: e.requirementId,
      seq: e.seq,
      title: e.title,
      text: e.text,
      metricType: e.metricType,
      unit: e.unit,
      pointsRaw: e.pointsRaw,
      optionGroup: e.optionGroup,
      pointsType: e.pointsType,
      keystone: e.keystone,
      planned: e.planned,
      optional: false, // per credit, below — it depends on the sibling rows
      target: bandsFromSpec(numericSpec).length
        ? null
        : summarizeSpec(e.numericSpec),
      numericSpec,
      evidenceSpecs,
      evidenceStages: evidenceStages(e.evidence, evidenceSpecs.length),
      requiresEvidence,
      pageStart: e.pageStart,
      pageEnd: e.pageEnd,
      valueBool: e.valueBool,
      valueNumber: e.valueNumber,
      valueText: e.valueText,
      note: e.note,
      evidenceCount,
      attachments,
      status,
      pointsEarned: pointsAwarded(award, "earned"),
      pointsPreview: pointsAwarded(award, "preview"),
    };
    const arr = byCredit.get(e.projectCreditId) ?? [];
    arr.push(view);
    byCredit.set(e.projectCreditId, arr);
  }

  return pcs.map((p) => {
    const reqs = (byCredit.get(p.pcId) ?? []).sort((a, b) => a.seq - b.seq);
    optionalFlags(reqs).forEach((optional, i) => (reqs[i].optional = optional));
    const cap = parseNum(p.pointsRaw);
    const range = creditPointsRange(reqs, p.pointsRaw);
    return {
      projectCreditId: p.pcId,
      catalogCreditId: p.catalogCreditId,
      code: p.code,
      title: p.title,
      categoryCode: p.categoryCode,
      categoryName: p.categoryName,
      isKeystone: p.isKeystone,
      pointsRaw: p.pointsRaw,
      aim: p.aim,
      pageStart: p.pageStart,
      pageEnd: p.pageEnd,
      status: deriveCreditStatus(reqs),
      pointsEarned: creditPointsEarned(reqs, p.pointsRaw, "earned"),
      pointsMax: cap,
      pointsMin: range?.min ?? null,
      requirements: reqs,
      additionalAttachments: evByCredit.get(p.pcId) ?? [],
    };
  });
}

export async function getCreditByCode(projectId: string, code: string) {
  const credits = await getProjectCredits(projectId);
  return credits.find((c) => c.code === code) ?? null;
}

// ---------- evidence library ----------

export interface ProjectEvidence {
  id: string;
  fileName: string;
  fileSize: number | null;
  createdAt: number;
  creditCode: string;
  creditTitle: string;
  /** Null for a credit-level additional attachment. */
  requirementSeq: number | null;
}

/** Every evidence file attached across a project's credits. */
export async function listProjectEvidence(
  projectId: string,
): Promise<ProjectEvidence[]> {
  const rows = await db
    .select({
      id: evidenceDocs.id,
      fileName: evidenceDocs.fileName,
      fileSize: evidenceDocs.fileSize,
      createdAt: evidenceDocs.createdAt,
      creditCode: catalogCredits.code,
      creditTitle: catalogCredits.title,
      requirementSeq: catalogRequirements.seq,
    })
    .from(evidenceDocs)
    .innerJoin(
      projectCredits,
      eq(evidenceDocs.projectCreditId, projectCredits.id),
    )
    .leftJoin(
      requirementEntries,
      eq(evidenceDocs.requirementEntryId, requirementEntries.id),
    )
    .leftJoin(
      catalogRequirements,
      eq(requirementEntries.catalogRequirementId, catalogRequirements.id),
    )
    .innerJoin(
      catalogCredits,
      eq(projectCredits.catalogCreditId, catalogCredits.id),
    )
    .where(eq(projectCredits.projectId, projectId))
    .orderBy(evidenceDocs.createdAt);
  return rows;
}

export interface ProjectOverview {
  totalCredits: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  missingEvidence: number; // requirements that need evidence but have none
  categories: { code: string; name: string; count: number }[];
  evidenceFiles: number;
}

export async function getProjectOverview(
  projectId: string,
): Promise<ProjectOverview> {
  const credits = await getProjectCredits(projectId);
  const evidence = await listProjectEvidence(projectId);
  let missingEvidence = 0;
  const catMap = new Map<string, { name: string; count: number }>();
  for (const c of credits) {
    const cat = catMap.get(c.categoryCode) ?? { name: c.categoryName, count: 0 };
    cat.count++;
    catMap.set(c.categoryCode, cat);
    missingEvidence += missingEvidenceRequirements(c.requirements).length;
  }
  return {
    totalCredits: credits.length,
    completed: credits.filter((c) => c.status === "completed").length,
    inProgress: credits.filter((c) => c.status === "in_progress").length,
    notStarted: credits.filter((c) => c.status === "not_started").length,
    missingEvidence,
    categories: [...catMap.entries()].map(([code, v]) => ({
      code,
      name: v.name,
      count: v.count,
    })),
    evidenceFiles: evidence.length,
  };
}
