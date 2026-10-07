import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistInspections,
  checklistItems,
  checklistResponses,
  checklistSections,
  checklistTemplates,
  users,
} from "@/db/schema";
import { WORKSPACE_ID } from "@/lib/catalog";

/**
 * Project checklist forms (Sprint 2 item 3): the inspection sheets a site team
 * fills at every inspection, stored per project. See db/schema.ts for the
 * tables and docs/feedback/2026-10-sprint-2/03-checklist-templates-in-db.
 *
 * A workspace default (no project) is matched to a credit by title and copied
 * into a project on first use; the project's copy is then its own.
 */

export type Answer = "yes" | "no" | "na";
const ANSWERS = new Set<string>(["yes", "no", "na"]);

export function parseAnswer(raw: unknown): Answer | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return ANSWERS.has(v) ? (v as Answer) : null;
}

// ---------- pure: numbering and ordering ----------

export interface SectionRow {
  id: string;
  seq: number;
  heading: string;
}
export interface ItemRow {
  id: string;
  sectionId: string;
  seq: number;
  text: string;
  active: boolean;
}

export interface NumberedItem extends ItemRow {
  /** "1.3" for an active item; null for one switched off. */
  no: string | null;
}
export interface NumberedSection extends SectionRow {
  no: string;
  items: NumberedItem[];
}

/**
 * Number a form the way the site team numbers it: sections 1, 2, 3… in order,
 * items 1.1, 1.2… among the ACTIVE items of their section, so switching an item
 * off leaves no gap on the printed sheet. Switched-off items keep their place
 * in the list, unnumbered.
 */
export function numberForm(sections: SectionRow[], items: ItemRow[]): NumberedSection[] {
  return [...sections]
    .sort((a, b) => a.seq - b.seq)
    .map((s, si) => {
      const no = String(si + 1);
      let n = 0;
      const own = items
        .filter((i) => i.sectionId === s.id)
        .sort((a, b) => a.seq - b.seq)
        .map((i) => ({ ...i, no: i.active ? `${no}.${++n}` : null }));
      return { ...s, no, items: own };
    });
}

/** "10.2" after "9.4": compare dotted numbers part by part. */
export function compareItemNo(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ---------- templates ----------

export interface TemplateRow {
  id: string;
  projectCreditId: string | null;
  creditTitle: string;
  title: string;
  confirmation: string;
  planDocument: string | null;
  sheetDocument: string | null;
}

const templateCols = {
  id: checklistTemplates.id,
  projectCreditId: checklistTemplates.projectCreditId,
  creditTitle: checklistTemplates.creditTitle,
  title: checklistTemplates.title,
  confirmation: checklistTemplates.confirmation,
  planDocument: checklistTemplates.planDocument,
  sheetDocument: checklistTemplates.sheetDocument,
};

/** The workspace default for a credit, matched on its title (case aside). */
export async function defaultTemplateFor(creditTitle: string): Promise<TemplateRow | null> {
  const [t] = await db
    .select(templateCols)
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.workspaceId, WORKSPACE_ID),
        isNull(checklistTemplates.projectCreditId),
        sql`lower(${checklistTemplates.creditTitle}) = lower(${creditTitle})`,
      ),
    )
    .orderBy(asc(checklistTemplates.createdAt))
    .limit(1);
  return t ?? null;
}

export async function projectTemplate(projectCreditId: string): Promise<TemplateRow | null> {
  const [t] = await db
    .select(templateCols)
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.workspaceId, WORKSPACE_ID),
        eq(checklistTemplates.projectCreditId, projectCreditId),
      ),
    )
    .limit(1);
  return t ?? null;
}

/** Whether a credit has an inspection form: its own copy, or a default to copy. */
export async function hasChecklist(projectCreditId: string, creditTitle: string): Promise<boolean> {
  return Boolean((await projectTemplate(projectCreditId)) ?? (await defaultTemplateFor(creditTitle)));
}

/**
 * The project's own copy of the form, copying the workspace default on first
 * use. Null when the credit has neither. Safe under a race: the unique index
 * on project_credit_id lets one copy win and the other re-reads it.
 */
export async function ensureProjectTemplate(
  projectCreditId: string,
  creditTitle: string,
): Promise<TemplateRow | null> {
  const own = await projectTemplate(projectCreditId);
  if (own) return own;
  const def = await defaultTemplateFor(creditTitle);
  if (!def) return null;

  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(checklistTemplates).values({
        id,
        workspaceId: WORKSPACE_ID,
        projectCreditId,
        creditTitle: def.creditTitle,
        title: def.title,
        confirmation: def.confirmation,
        planDocument: def.planDocument,
        sheetDocument: def.sheetDocument,
      });
      const sections = await tx
        .select()
        .from(checklistSections)
        .where(eq(checklistSections.templateId, def.id));
      const items = sections.length
        ? await tx
            .select()
            .from(checklistItems)
            .where(inArray(checklistItems.sectionId, sections.map((s) => s.id)))
        : [];
      const newSectionId = new Map(sections.map((s) => [s.id, randomUUID()]));
      if (sections.length)
        await tx.insert(checklistSections).values(
          sections.map((s) => ({ id: newSectionId.get(s.id)!, templateId: id, seq: s.seq, heading: s.heading })),
        );
      if (items.length)
        await tx.insert(checklistItems).values(
          items.map((i) => ({
            id: randomUUID(),
            sectionId: newSectionId.get(i.sectionId)!,
            seq: i.seq,
            text: i.text,
            active: i.active,
          })),
        );
    });
  } catch (e) {
    // Lost a race to another request copying the same default: use theirs.
    const theirs = await projectTemplate(projectCreditId);
    if (theirs) return theirs;
    throw e;
  }
  return projectTemplate(projectCreditId);
}

/** A template with its sections and items, numbered. */
export async function getForm(templateId: string): Promise<NumberedSection[]> {
  const sections = await db
    .select({ id: checklistSections.id, seq: checklistSections.seq, heading: checklistSections.heading })
    .from(checklistSections)
    .where(eq(checklistSections.templateId, templateId));
  const items = sections.length
    ? await db
        .select({
          id: checklistItems.id,
          sectionId: checklistItems.sectionId,
          seq: checklistItems.seq,
          text: checklistItems.text,
          active: checklistItems.active,
        })
        .from(checklistItems)
        .where(inArray(checklistItems.sectionId, sections.map((s) => s.id)))
    : [];
  return numberForm(sections, items);
}

// ---------- inspections ----------

export interface InspectionSummary {
  id: string;
  inspectionDate: string | null;
  inspector: string | null;
  area: string | null;
  aiState: string;
  reviewedAt: number | null;
  reviewedByName: string | null;
  createdAt: number;
}

export async function listInspections(templateId: string): Promise<InspectionSummary[]> {
  return db
    .select({
      id: checklistInspections.id,
      inspectionDate: checklistInspections.inspectionDate,
      inspector: checklistInspections.inspector,
      area: checklistInspections.area,
      aiState: checklistInspections.aiState,
      reviewedAt: checklistInspections.reviewedAt,
      reviewedByName: users.name,
      createdAt: checklistInspections.createdAt,
    })
    .from(checklistInspections)
    .leftJoin(users, eq(checklistInspections.reviewedBy, users.id))
    .where(
      and(
        eq(checklistInspections.workspaceId, WORKSPACE_ID),
        eq(checklistInspections.templateId, templateId),
      ),
    )
    .orderBy(desc(checklistInspections.createdAt));
}

/**
 * Start a filled copy of the form: one response per ACTIVE item, with its
 * number, heading and text copied in, so later edits to the form never
 * rewrite this inspection. The AI draft is left pending for the caller to run.
 */
export async function startInspection(templateId: string): Promise<string> {
  const form = await getForm(templateId);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(checklistInspections).values({
      id,
      workspaceId: WORKSPACE_ID,
      templateId,
      aiState: "pending",
    });
    const rows = form.flatMap((s) =>
      s.items
        .filter((i) => i.active && i.no)
        .map((i) => ({
          id: randomUUID(),
          inspectionId: id,
          itemId: i.id,
          itemNo: i.no!,
          sectionNo: s.no,
          sectionHeading: s.heading,
          itemText: i.text,
        })),
    );
    if (rows.length) await tx.insert(checklistResponses).values(rows);
  });
  return id;
}

export interface ResponseRow {
  id: string;
  itemNo: string;
  sectionNo: string;
  sectionHeading: string;
  itemText: string;
  aiAnswer: Answer | null;
  aiQuote: string | null;
  answer: Answer | null;
  remark: string | null;
}

export interface InspectionDetail {
  id: string;
  templateId: string;
  projectCreditId: string | null;
  inspectionDate: string | null;
  inspector: string | null;
  area: string | null;
  aiState: string;
  aiNote: string | null;
  reviewedAt: number | null;
  reviewedByName: string | null;
  createdAt: number;
  template: TemplateRow;
  responses: ResponseRow[];
}

export async function getInspection(inspectionId: string): Promise<InspectionDetail | null> {
  const [i] = await db
    .select({
      id: checklistInspections.id,
      templateId: checklistInspections.templateId,
      inspectionDate: checklistInspections.inspectionDate,
      inspector: checklistInspections.inspector,
      area: checklistInspections.area,
      aiState: checklistInspections.aiState,
      aiNote: checklistInspections.aiNote,
      reviewedAt: checklistInspections.reviewedAt,
      reviewedByName: users.name,
      createdAt: checklistInspections.createdAt,
    })
    .from(checklistInspections)
    .leftJoin(users, eq(checklistInspections.reviewedBy, users.id))
    .where(and(eq(checklistInspections.id, inspectionId), eq(checklistInspections.workspaceId, WORKSPACE_ID)))
    .limit(1);
  if (!i) return null;
  const [template] = await db
    .select(templateCols)
    .from(checklistTemplates)
    .where(eq(checklistTemplates.id, i.templateId))
    .limit(1);
  const rows = await db
    .select()
    .from(checklistResponses)
    .where(eq(checklistResponses.inspectionId, inspectionId));
  const responses: ResponseRow[] = rows
    .map((r) => ({
      id: r.id,
      itemNo: r.itemNo,
      sectionNo: r.sectionNo,
      sectionHeading: r.sectionHeading,
      itemText: r.itemText,
      aiAnswer: parseAnswer(r.aiAnswer),
      aiQuote: r.aiQuote,
      answer: parseAnswer(r.answer),
      remark: r.remark,
    }))
    .sort((a, b) => compareItemNo(a.itemNo, b.itemNo));
  return { ...i, projectCreditId: template.projectCreditId, template, responses };
}

/**
 * Store the AI's draft and pre-select its suggestions, unless a person has
 * already saved this inspection (their answers are never overwritten).
 */
export async function applyAiDraft(
  inspectionId: string,
  draft:
    | { state: "done"; sources: string[]; byItemNo: Record<string, { answer: Answer | null; quote: string | null }> }
    | { state: "skipped" | "failed"; reason: string },
): Promise<void> {
  const [insp] = await db
    .select({ reviewedAt: checklistInspections.reviewedAt })
    .from(checklistInspections)
    .where(eq(checklistInspections.id, inspectionId))
    .limit(1);
  if (!insp) return;
  if (draft.state !== "done") {
    await db
      .update(checklistInspections)
      .set({ aiState: draft.state, aiNote: draft.reason })
      .where(eq(checklistInspections.id, inspectionId));
    return;
  }
  const rows = await db
    .select({ id: checklistResponses.id, itemNo: checklistResponses.itemNo })
    .from(checklistResponses)
    .where(eq(checklistResponses.inspectionId, inspectionId));
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const s = draft.byItemNo[r.itemNo];
      const aiAnswer = s?.answer ?? null;
      await tx
        .update(checklistResponses)
        .set({
          aiAnswer,
          aiQuote: aiAnswer ? (s?.quote ?? null) : null,
          ...(insp.reviewedAt == null ? { answer: aiAnswer } : {}),
        })
        .where(eq(checklistResponses.id, r.id));
    }
    await tx
      .update(checklistInspections)
      .set({ aiState: "done", aiNote: JSON.stringify(draft.sources) })
      .where(eq(checklistInspections.id, inspectionId));
  });
}

/** Mark the draft as running again (a re-run). Saved answers are untouched. */
export async function applyAiDraftPending(inspectionId: string): Promise<void> {
  await db
    .update(checklistInspections)
    .set({ aiState: "pending", aiNote: null })
    .where(and(eq(checklistInspections.id, inspectionId), eq(checklistInspections.workspaceId, WORKSPACE_ID)));
}

export interface SaveInput {
  inspectionDate: string | null;
  inspector: string | null;
  area: string | null;
  answers: Record<string, { answer: Answer | null; remark: string | null }>;
}

/** The reviewer's answers: these are what print. Records who saved and when. */
export async function saveInspection(inspectionId: string, input: SaveInput, userId: string): Promise<void> {
  const rows = await db
    .select({ id: checklistResponses.id })
    .from(checklistResponses)
    .where(eq(checklistResponses.inspectionId, inspectionId));
  const valid = new Set(rows.map((r) => r.id));
  await db.transaction(async (tx) => {
    for (const [rid, a] of Object.entries(input.answers)) {
      if (!valid.has(rid)) continue;
      await tx
        .update(checklistResponses)
        .set({ answer: a.answer, remark: a.remark?.trim() ? a.remark.trim().slice(0, 500) : null })
        .where(eq(checklistResponses.id, rid));
    }
    await tx
      .update(checklistInspections)
      .set({
        inspectionDate: input.inspectionDate,
        inspector: input.inspector?.trim() || null,
        area: input.area?.trim() || null,
        reviewedBy: userId,
        reviewedAt: Math.floor(Date.now() / 1000),
      })
      .where(and(eq(checklistInspections.id, inspectionId), eq(checklistInspections.workspaceId, WORKSPACE_ID)));
  });
}
