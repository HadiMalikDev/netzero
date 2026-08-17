import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  evidenceDocs,
  projectCredits,
  projects,
  requirementEntries,
} from "@/db/schema";
import {
  deriveCreditStatus,
  deriveRequirementStatus,
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

// ---------- credit status computation ----------

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
  target: string | null; // human-readable expected value, if the catalog has one
  numericSpec: unknown;
  evidenceSpecs: string[];
  requiresEvidence: boolean;
  pageStart: number | null;
  pageEnd: number | null;
  valueBool: boolean | null;
  valueNumber: number | null;
  valueText: string | null;
  note: string | null;
  evidenceCount: number;
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
      numericSpec: catalogRequirements.numericSpec,
      evidenceSpecs: catalogRequirements.evidenceSpecs,
      pageStart: catalogRequirements.sourcePageStart,
      pageEnd: catalogRequirements.sourcePageEnd,
      valueBool: requirementEntries.valueBool,
      valueNumber: requirementEntries.valueNumber,
      valueText: requirementEntries.valueText,
      note: requirementEntries.note,
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
      id: evidenceDocs.id,
    })
    .from(evidenceDocs)
    .where(
      inArray(
        evidenceDocs.requirementEntryId,
        entries.map((e) => e.entryId),
      ),
    );
  const evCount = new Map<string, number>();
  for (const e of evidence)
    evCount.set(e.entryId, (evCount.get(e.entryId) ?? 0) + 1);

  const byCredit = new Map<string, RequirementView[]>();
  for (const e of entries) {
    const evidenceSpecs: string[] = e.evidenceSpecs
      ? (JSON.parse(e.evidenceSpecs) as string[])
      : [];
    const requiresEvidence = evidenceSpecs.length > 0;
    const evidenceCount = evCount.get(e.entryId) ?? 0;
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
      target: bandsFromSpec(numericSpec).length
        ? null
        : summarizeSpec(e.numericSpec),
      numericSpec,
      evidenceSpecs,
      requiresEvidence,
      pageStart: e.pageStart,
      pageEnd: e.pageEnd,
      valueBool: e.valueBool,
      valueNumber: e.valueNumber,
      valueText: e.valueText,
      note: e.note,
      evidenceCount,
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
  requirementSeq: number;
}

/** Every evidence file attached across a project's requirements. */
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
      requirementEntries,
      eq(evidenceDocs.requirementEntryId, requirementEntries.id),
    )
    .innerJoin(
      catalogRequirements,
      eq(requirementEntries.catalogRequirementId, catalogRequirements.id),
    )
    .innerJoin(
      projectCredits,
      eq(requirementEntries.projectCreditId, projectCredits.id),
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
