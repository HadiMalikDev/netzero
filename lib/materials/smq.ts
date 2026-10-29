import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  projectCredits,
  smqRows,
  smqSections,
  smqTemplates,
  type SmqRow,
  type SmqSection,
  type SmqTemplate,
} from "@/db/schema";
import { WORKSPACE_ID } from "@/lib/catalog";
import { PART_KEYS } from "./parts";

/**
 * The project's Sustainability Material Questionnaire (SMQ): its own copy of
 * the workspace default, made on first use. The default's rows name credits
 * by code; the copy resolves each code once to this project's credit (D20),
 * so a re-parsed catalog (which keeps its ids) never breaks the link. A code
 * the project's catalog lacks stays on the row as "unlinked".
 */

export const SECTION_KINDS = ["all_materials", "material_type"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const ROW_KINDS = [
  "fixed",
  "project_value",
  "design_package",
  "construction_team",
  "project_requirement",
] as const;
export type RowKind = (typeof ROW_KINDS)[number];

/** How each kind reads on screen and in print. */
export const ROW_KIND_LABEL: Record<RowKind, string> = {
  fixed: "Fixed requirement",
  project_value: "Project target",
  design_package: "Design package",
  construction_team: "By the construction team",
  project_requirement: "As per project requirement",
};

export function parseRowKind(raw: unknown): RowKind {
  return ROW_KINDS.includes(raw as RowKind) ? (raw as RowKind) : "fixed";
}

export interface SmqRowView extends SmqRow {
  /** The linked credit's code and title in this project, if linked. */
  credit: { code: string; title: string } | null;
}

export interface SmqSectionView extends Omit<SmqSection, "defaultParts"> {
  defaultParts: string[];
  rows: SmqRowView[];
}

export interface SmqView {
  template: SmqTemplate;
  sections: SmqSectionView[];
}

export function parseParts(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && PART_KEYS.has(k)) : [];
  } catch {
    return [];
  }
}

async function defaultTemplate(): Promise<SmqTemplate | null> {
  const [t] = await db
    .select()
    .from(smqTemplates)
    .where(and(isNull(smqTemplates.projectId), eq(smqTemplates.workspaceId, WORKSPACE_ID)))
    .orderBy(asc(smqTemplates.createdAt))
    .limit(1);
  return t ?? null;
}

export async function projectSmq(projectId: string): Promise<SmqTemplate | null> {
  const [t] = await db
    .select()
    .from(smqTemplates)
    .where(and(eq(smqTemplates.projectId, projectId), eq(smqTemplates.workspaceId, WORKSPACE_ID)))
    .limit(1);
  return t ?? null;
}

/** This project's credits by code: what a default row's code resolves to. */
export async function projectCreditsByCode(projectId: string): Promise<Map<string, { id: string; title: string }>> {
  const rows = await db
    .select({ id: projectCredits.id, code: catalogCredits.code, title: catalogCredits.title })
    .from(projectCredits)
    .innerJoin(catalogCredits, eq(projectCredits.catalogCreditId, catalogCredits.id))
    .where(and(eq(projectCredits.projectId, projectId), eq(projectCredits.workspaceId, WORKSPACE_ID)));
  return new Map(rows.map((r) => [r.code, { id: r.id, title: r.title }]));
}

/**
 * The project's own questionnaire, copying the workspace default on first
 * use. Null only when there is no default at all. Safe under a race: the
 * unique index on project_id lets one copy win and the other re-reads it.
 */
export async function ensureProjectSmq(projectId: string): Promise<SmqTemplate | null> {
  const own = await projectSmq(projectId);
  if (own) return own;
  const def = await defaultTemplate();
  if (!def) return null;
  const credits = await projectCreditsByCode(projectId);

  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(smqTemplates).values({
        id,
        workspaceId: WORKSPACE_ID,
        projectId,
        title: def.title,
        revision: def.revision,
        expiryYears: def.expiryYears,
        boqMaterialCostSar: null,
      });
      const sections = await tx.select().from(smqSections).where(eq(smqSections.templateId, def.id));
      const rows = sections.length
        ? await tx.select().from(smqRows).where(inArray(smqRows.sectionId, sections.map((s) => s.id)))
        : [];
      const newSectionId = new Map(sections.map((s) => [s.id, randomUUID()]));
      if (sections.length)
        await tx.insert(smqSections).values(
          sections.map((s) => ({
            id: newSectionId.get(s.id)!,
            templateId: id,
            seq: s.seq,
            kind: s.kind,
            heading: s.heading,
            active: s.active,
            defaultParts: s.defaultParts,
          })),
        );
      if (rows.length)
        await tx.insert(smqRows).values(
          rows.map((r) => ({
            id: randomUUID(),
            sectionId: newSectionId.get(r.sectionId)!,
            seq: r.seq,
            text: r.text,
            leedRef: r.leedRef,
            creditCode: r.creditCode,
            projectCreditId: r.creditCode ? (credits.get(r.creditCode)?.id ?? null) : null,
            kind: r.kind,
            note: r.note,
            targetText: r.targetText,
            valueUnit: r.valueUnit,
            active: r.active,
          })),
        );
    });
  } catch (e) {
    // Lost a race to another request copying the default: use theirs.
    const theirs = await projectSmq(projectId);
    if (theirs) return theirs;
    throw e;
  }
  return projectSmq(projectId);
}

/** A questionnaire with its sections and rows in order, credits resolved. */
export async function getSmq(templateId: string): Promise<SmqView | null> {
  const [template] = await db.select().from(smqTemplates).where(eq(smqTemplates.id, templateId)).limit(1);
  if (!template) return null;
  const sections = await db
    .select()
    .from(smqSections)
    .where(eq(smqSections.templateId, templateId))
    .orderBy(asc(smqSections.seq));
  const rows = sections.length
    ? await db
        .select({ row: smqRows, code: catalogCredits.code, title: catalogCredits.title })
        .from(smqRows)
        .leftJoin(projectCredits, eq(smqRows.projectCreditId, projectCredits.id))
        .leftJoin(catalogCredits, eq(projectCredits.catalogCreditId, catalogCredits.id))
        .where(inArray(smqRows.sectionId, sections.map((s) => s.id)))
        .orderBy(asc(smqRows.seq))
    : [];
  return {
    template,
    sections: sections.map((s) => ({
      ...s,
      defaultParts: parseParts(s.defaultParts),
      rows: rows
        .filter((r) => r.row.sectionId === s.id)
        .map((r) => ({ ...r.row, credit: r.code ? { code: r.code, title: r.title! } : null })),
    })),
  };
}

// ---------- editing a project's copy ----------

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
/** Multi-line text keeps its line breaks (the SMQ's lists), tidied per line. */
const cleanLines = (s: string, max: number) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim()
    .slice(0, max);

async function touch(templateId: string) {
  await db.update(smqTemplates).set({ updatedAt: Math.floor(Date.now() / 1000) }).where(eq(smqTemplates.id, templateId));
}

async function ownSection(templateId: string, sectionId: string) {
  const [s] = await db
    .select()
    .from(smqSections)
    .where(and(eq(smqSections.id, sectionId), eq(smqSections.templateId, templateId)))
    .limit(1);
  return s ?? null;
}

async function ownRow(templateId: string, rowId: string) {
  const [r] = await db
    .select({ row: smqRows })
    .from(smqRows)
    .innerJoin(smqSections, eq(smqRows.sectionId, smqSections.id))
    .where(and(eq(smqRows.id, rowId), eq(smqSections.templateId, templateId)))
    .limit(1);
  return r?.row ?? null;
}

/** Swap with the neighbour in seq order, re-sequencing 1..n first. */
async function move(
  rows: { id: string; seq: number }[],
  id: string,
  dir: "up" | "down",
  write: (id: string, seq: number) => Promise<unknown>,
) {
  const ordered = [...rows].sort((a, b) => a.seq - b.seq);
  const i = ordered.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordered.length) return;
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  for (let k = 0; k < ordered.length; k++) if (ordered[k].seq !== k + 1) await write(ordered[k].id, k + 1);
}

/**
 * Put `items` in the order of `ids` (a drag and drop): seq 1..n. Refused
 * unless `ids` names each item exactly once, so a stale page can't drop or
 * duplicate one.
 */
async function reorder(
  items: { id: string; seq: number }[],
  ids: string[],
  write: (id: string, seq: number) => Promise<unknown>,
): Promise<boolean> {
  const have = new Set(items.map((x) => x.id));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || !ids.every((id) => have.has(id))) return false;
  const seq = new Map(items.map((x) => [x.id, x.seq]));
  for (let k = 0; k < ids.length; k++) if (seq.get(ids[k]) !== k + 1) await write(ids[k], k + 1);
  return true;
}

/** A section's rows in the order they were dragged to. */
export async function reorderSmqRows(templateId: string, sectionId: string, ids: string[]): Promise<boolean> {
  if (!(await ownSection(templateId, sectionId))) return false;
  const rows = await db.select({ id: smqRows.id, seq: smqRows.seq }).from(smqRows).where(eq(smqRows.sectionId, sectionId));
  const ok = await reorder(rows, ids, (id, seq) => db.update(smqRows).set({ seq }).where(eq(smqRows.id, id)));
  if (ok) await touch(templateId);
  return ok;
}

/** The material types in the order they were dragged to; "For all materials" stays first. */
export async function reorderSmqTypes(templateId: string, ids: string[]): Promise<boolean> {
  const all = await db
    .select({ id: smqSections.id, seq: smqSections.seq, kind: smqSections.kind })
    .from(smqSections)
    .where(eq(smqSections.templateId, templateId));
  // "For all materials" is seq 0; the types are 1..n, as `move` leaves them.
  const types = all.filter((s) => s.kind !== "all_materials");
  const ok = await reorder(types, ids, (id, seq) => db.update(smqSections).set({ seq }).where(eq(smqSections.id, id)));
  if (ok) await touch(templateId);
  return ok;
}

/** The questionnaire's title and the project's material settings. */
export async function editSmqSettings(
  templateId: string,
  input: { title: string; expiryYears: number; boqMaterialCostSar: number | null },
): Promise<boolean> {
  const title = clean(input.title, 200);
  if (!title || !Number.isInteger(input.expiryYears) || input.expiryYears < 1 || input.expiryYears > 50) return false;
  if (input.boqMaterialCostSar != null && !(input.boqMaterialCostSar > 0)) return false;
  await db
    .update(smqTemplates)
    .set({
      title,
      expiryYears: input.expiryYears,
      boqMaterialCostSar: input.boqMaterialCostSar,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(smqTemplates.id, templateId));
  return true;
}

export type SmqSectionOp = "save" | "rename" | "toggle" | "up" | "down" | "parts";

export async function editSmqSection(
  templateId: string,
  sectionId: string,
  op: SmqSectionOp,
  input: { heading?: string; parts?: string[] } = {},
): Promise<boolean> {
  const s = await ownSection(templateId, sectionId);
  if (!s) return false;
  if (op === "save" || op === "rename") {
    const h = clean(input.heading ?? "", 300);
    if (!h) return false;
    // "save" is the editor's one form: the name and the parts it pre-ticks.
    const parts = op === "save" ? { defaultParts: JSON.stringify([...new Set((input.parts ?? []).filter((k) => PART_KEYS.has(k)))]) } : {};
    await db.update(smqSections).set({ heading: h, ...parts }).where(eq(smqSections.id, sectionId));
  } else if (op === "toggle") {
    // The "For all materials" block is answered by every product: it stays on.
    if (s.kind === "all_materials") return false;
    await db.update(smqSections).set({ active: !s.active }).where(eq(smqSections.id, sectionId));
  } else if (op === "parts") {
    const parts = [...new Set((input.parts ?? []).filter((k) => PART_KEYS.has(k)))];
    await db.update(smqSections).set({ defaultParts: JSON.stringify(parts) }).where(eq(smqSections.id, sectionId));
  } else {
    // "For all materials" stays first.
    const all = await db
      .select({ id: smqSections.id, seq: smqSections.seq, kind: smqSections.kind })
      .from(smqSections)
      .where(eq(smqSections.templateId, templateId));
    if (s.kind === "all_materials") return false;
    await move(
      all.filter((x) => x.kind !== "all_materials"),
      sectionId,
      op,
      (id, seq) => db.update(smqSections).set({ seq }).where(eq(smqSections.id, id)),
    );
  }
  await touch(templateId);
  return true;
}

/** A new material type at the end. */
export async function addSmqSection(templateId: string, heading: string): Promise<string | null> {
  const h = clean(heading, 300);
  if (!h) return null;
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${smqSections.seq}), 0)` })
    .from(smqSections)
    .where(eq(smqSections.templateId, templateId));
  const id = randomUUID();
  await db.insert(smqSections).values({ id, templateId, seq: Number(max) + 1, kind: "material_type", heading: h });
  await touch(templateId);
  return id;
}

export interface RowInput {
  text: string;
  /** A project_credit id of this project, or "" for none. */
  projectCreditId: string;
  leedRef: string;
  kind: string;
  targetText: string;
  valueUnit: string;
  note: string;
}

/** Check a posted credit belongs to the template's project; "" clears it. */
async function resolveCredit(templateId: string, projectCreditId: string) {
  if (!projectCreditId) return { ok: true as const, id: null, code: null };
  const [t] = await db.select({ projectId: smqTemplates.projectId }).from(smqTemplates).where(eq(smqTemplates.id, templateId));
  if (!t?.projectId) return { ok: false as const };
  const [pc] = await db
    .select({ id: projectCredits.id, code: catalogCredits.code })
    .from(projectCredits)
    .innerJoin(catalogCredits, eq(projectCredits.catalogCreditId, catalogCredits.id))
    .where(and(eq(projectCredits.id, projectCreditId), eq(projectCredits.projectId, t.projectId)))
    .limit(1);
  return pc ? { ok: true as const, id: pc.id, code: pc.code } : { ok: false as const };
}

function rowValues(input: RowInput) {
  return {
    text: cleanLines(input.text, 4000),
    leedRef: clean(input.leedRef, 300) || null,
    kind: parseRowKind(input.kind),
    targetText: cleanLines(input.targetText, 2000) || null,
    valueUnit: clean(input.valueUnit, 40) || null,
    note: cleanLines(input.note, 1000) || null,
  };
}

export type SmqRowOp = "save" | "toggle" | "up" | "down";

export async function editSmqRow(templateId: string, rowId: string, op: SmqRowOp, input?: RowInput): Promise<boolean> {
  const row = await ownRow(templateId, rowId);
  if (!row) return false;
  if (op === "save") {
    if (!input) return false;
    const v = rowValues(input);
    if (!v.text) return false;
    const credit = await resolveCredit(templateId, input.projectCreditId);
    if (!credit.ok) return false;
    await db
      .update(smqRows)
      .set({
        ...v,
        projectCreditId: credit.id,
        // A linked row takes its credit's code. Saving an unlinked row without
        // picking a credit keeps the code it came with, so it still says what
        // it was meant for; clearing a linked row's credit clears the code.
        creditCode: credit.code ?? (row.projectCreditId ? null : row.creditCode),
      })
      .where(eq(smqRows.id, rowId));
  } else if (op === "toggle") {
    await db.update(smqRows).set({ active: !row.active }).where(eq(smqRows.id, rowId));
  } else {
    const siblings = await db
      .select({ id: smqRows.id, seq: smqRows.seq })
      .from(smqRows)
      .where(eq(smqRows.sectionId, row.sectionId));
    await move(siblings, rowId, op, (id, seq) => db.update(smqRows).set({ seq }).where(eq(smqRows.id, id)));
  }
  await touch(templateId);
  return true;
}

export async function addSmqRow(templateId: string, sectionId: string, input: RowInput): Promise<boolean> {
  if (!(await ownSection(templateId, sectionId))) return false;
  const v = rowValues(input);
  if (!v.text) return false;
  const credit = await resolveCredit(templateId, input.projectCreditId);
  if (!credit.ok) return false;
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${smqRows.seq}), 0)` })
    .from(smqRows)
    .where(eq(smqRows.sectionId, sectionId));
  await db.insert(smqRows).values({
    id: randomUUID(),
    sectionId,
    seq: Number(max) + 1,
    ...v,
    projectCreditId: credit.id,
    creditCode: credit.code,
  });
  await touch(templateId);
  return true;
}
