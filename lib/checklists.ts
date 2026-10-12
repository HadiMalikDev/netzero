import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistInspections,
  checklistItems,
  checklistResponsePhotos,
  checklistResponses,
  checklistSections,
  checklistTemplates,
  users,
  evidenceDocs,
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
  /** The compliant answer: "yes", "no", or null for an observation. */
  compliantAnswer: Answer | null;
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
  /** Layout of the printed sheet (see db/schema.ts). */
  naColumn: boolean;
  remarksLabel: string;
  headerFields: HeaderField[];
  signatories: string[];
  /** Print a corrective-action log instead of the plain photo list (ESC). */
  observationLog: boolean;
  observationTitle: string;
}

export type HeaderField = "ref_no" | "date" | "time" | "inspector" | "area";
const HEADER_FIELDS = new Set<string>(["ref_no", "date", "time", "inspector", "area"]);

function jsonList(raw: string | null): string[] {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Stored header-field JSON → known fields in order; the IAQ trio if none. */
export function parseHeaderFields(raw: string | null): HeaderField[] {
  const f = jsonList(raw).filter((x) => HEADER_FIELDS.has(x)) as HeaderField[];
  return f.length ? f : ["date", "inspector", "area"];
}

type TemplateDbRow = Omit<TemplateRow, "headerFields" | "signatories"> & {
  headerFields: string;
  signatories: string;
};
const toTemplate = (r: TemplateDbRow | undefined): TemplateRow | null =>
  r ? { ...r, headerFields: parseHeaderFields(r.headerFields), signatories: jsonList(r.signatories) } : null;

const templateCols = {
  id: checklistTemplates.id,
  projectCreditId: checklistTemplates.projectCreditId,
  creditTitle: checklistTemplates.creditTitle,
  title: checklistTemplates.title,
  confirmation: checklistTemplates.confirmation,
  planDocument: checklistTemplates.planDocument,
  sheetDocument: checklistTemplates.sheetDocument,
  naColumn: checklistTemplates.naColumn,
  remarksLabel: checklistTemplates.remarksLabel,
  headerFields: checklistTemplates.headerFields,
  signatories: checklistTemplates.signatories,
  observationLog: checklistTemplates.observationLog,
  observationTitle: checklistTemplates.observationTitle,
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
  return toTemplate(t);
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
  return toTemplate(t);
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
        naColumn: def.naColumn,
        remarksLabel: def.remarksLabel,
        headerFields: JSON.stringify(def.headerFields),
        signatories: JSON.stringify(def.signatories),
        observationLog: def.observationLog,
        observationTitle: def.observationTitle,
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
            compliantAnswer: i.compliantAnswer,
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
          compliantAnswer: checklistItems.compliantAnswer,
        })
        .from(checklistItems)
        .where(inArray(checklistItems.sectionId, sections.map((s) => s.id)))
    : [];
  return numberForm(sections, items.map((i) => ({ ...i, compliantAnswer: parseAnswer(i.compliantAnswer) })));
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
          compliantAnswer: i.compliantAnswer,
        })),
    );
    if (rows.length) await tx.insert(checklistResponses).values(rows);
  });
  return id;
}

export interface ResponseRow {
  id: string;
  /** The form item this answer belongs to (null only if it was removed). */
  itemId: string | null;
  itemNo: string;
  sectionNo: string;
  sectionHeading: string;
  itemText: string;
  compliantAnswer: Answer | null;
  aiAnswer: Answer | null;
  aiQuote: string | null;
  answer: Answer | null;
  remark: string | null;
  /** Site photos taken for this item from its row, oldest first. */
  photos: ItemPhoto[];
}

export interface ItemPhoto {
  /** The evidence file's id (served at /api/evidence/<id>). */
  id: string;
  fileName: string;
  createdAt: number;
}

export interface InspectionDetail {
  id: string;
  templateId: string;
  projectCreditId: string | null;
  inspectionDate: string | null;
  inspector: string | null;
  area: string | null;
  inspectionTime: string | null;
  refNo: string | null;
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
      inspectionTime: checklistInspections.inspectionTime,
      refNo: checklistInspections.refNo,
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
  const template = toTemplate(
    (
      await db
        .select(templateCols)
        .from(checklistTemplates)
        .where(eq(checklistTemplates.id, i.templateId))
        .limit(1)
    )[0],
  )!;
  const rows = await db
    .select()
    .from(checklistResponses)
    .where(eq(checklistResponses.inspectionId, inspectionId));
  const photoRows = rows.length
    ? await db
        .select({
          responseId: checklistResponsePhotos.responseId,
          id: evidenceDocs.id,
          fileName: evidenceDocs.fileName,
          createdAt: evidenceDocs.createdAt,
        })
        .from(checklistResponsePhotos)
        .innerJoin(evidenceDocs, eq(checklistResponsePhotos.evidenceDocId, evidenceDocs.id))
        .where(inArray(checklistResponsePhotos.responseId, rows.map((r) => r.id)))
        .orderBy(asc(evidenceDocs.createdAt))
    : [];
  const photosByResponse = new Map<string, ItemPhoto[]>();
  for (const p of photoRows) {
    const arr = photosByResponse.get(p.responseId) ?? [];
    arr.push({ id: p.id, fileName: p.fileName, createdAt: p.createdAt });
    photosByResponse.set(p.responseId, arr);
  }
  const responses: ResponseRow[] = rows
    .map((r) => ({
      id: r.id,
      itemId: r.itemId,
      itemNo: r.itemNo,
      sectionNo: r.sectionNo,
      sectionHeading: r.sectionHeading,
      itemText: r.itemText,
      compliantAnswer: parseAnswer(r.compliantAnswer),
      aiAnswer: parseAnswer(r.aiAnswer),
      aiQuote: r.aiQuote,
      answer: parseAnswer(r.answer),
      remark: r.remark,
      photos: photosByResponse.get(r.id) ?? [],
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
  inspectionTime?: string | null;
  refNo?: string | null;
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
        inspectionTime: input.inspectionTime?.trim() || null,
        refNo: input.refNo?.trim().slice(0, 80) || null,
        reviewedBy: userId,
        reviewedAt: Math.floor(Date.now() / 1000),
      })
      .where(and(eq(checklistInspections.id, inspectionId), eq(checklistInspections.workspaceId, WORKSPACE_ID)));
  });
}

// ---------- form editing (a project's own copy only) ----------

/** The section, if it belongs to this template. */
async function ownSection(templateId: string, sectionId: string) {
  const [s] = await db
    .select({ id: checklistSections.id, seq: checklistSections.seq })
    .from(checklistSections)
    .where(and(eq(checklistSections.id, sectionId), eq(checklistSections.templateId, templateId)))
    .limit(1);
  return s ?? null;
}

/** The item, if it belongs to this template. */
async function ownItem(templateId: string, itemId: string) {
  const [i] = await db
    .select({ id: checklistItems.id, sectionId: checklistItems.sectionId, seq: checklistItems.seq, active: checklistItems.active })
    .from(checklistItems)
    .innerJoin(checklistSections, eq(checklistItems.sectionId, checklistSections.id))
    .where(and(eq(checklistItems.id, itemId), eq(checklistSections.templateId, templateId)))
    .limit(1);
  return i ?? null;
}

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

async function touch(templateId: string) {
  await db
    .update(checklistTemplates)
    .set({ updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(checklistTemplates.id, templateId));
}

/**
 * Swap a row with its neighbour in `seq` order. Rows are re-sequenced 1..n
 * first, so gaps or ties left by earlier edits never block a move.
 */
async function moveRow(
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

export type ItemOp = "save" | "toggle" | "up" | "down" | "compliance";

/** Edit one item of a project's form. Items are switched off, never deleted. */
export async function editItem(
  templateId: string,
  itemId: string,
  op: ItemOp,
  text?: string,
  compliant?: string,
): Promise<boolean> {
  const item = await ownItem(templateId, itemId);
  if (!item) return false;
  if (op === "save") {
    const t = clean(text ?? "", 400);
    if (!t) return false;
    await db.update(checklistItems).set({ text: t }).where(eq(checklistItems.id, itemId));
  } else if (op === "compliance") {
    // "yes" | "no" | anything else = an observation with no compliant answer.
    const c = parseAnswer(compliant);
    await db
      .update(checklistItems)
      .set({ compliantAnswer: c === "yes" || c === "no" ? c : null })
      .where(eq(checklistItems.id, itemId));
  } else if (op === "toggle") {
    await db.update(checklistItems).set({ active: !item.active }).where(eq(checklistItems.id, itemId));
  } else {
    const siblings = await db
      .select({ id: checklistItems.id, seq: checklistItems.seq })
      .from(checklistItems)
      .where(eq(checklistItems.sectionId, item.sectionId));
    await moveRow(siblings, itemId, op, (id, seq) => db.update(checklistItems).set({ seq }).where(eq(checklistItems.id, id)));
  }
  await touch(templateId);
  return true;
}

export async function addItem(templateId: string, sectionId: string, text: string): Promise<boolean> {
  const t = clean(text, 400);
  if (!t || !(await ownSection(templateId, sectionId))) return false;
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${checklistItems.seq}), 0)` })
    .from(checklistItems)
    .where(eq(checklistItems.sectionId, sectionId));
  await db.insert(checklistItems).values({ id: randomUUID(), sectionId, seq: Number(max) + 1, text: t });
  await touch(templateId);
  return true;
}

export type SectionOp = "rename" | "up" | "down";

export async function editSection(templateId: string, sectionId: string, op: SectionOp, heading?: string): Promise<boolean> {
  if (!(await ownSection(templateId, sectionId))) return false;
  if (op === "rename") {
    const h = clean(heading ?? "", 200);
    if (!h) return false;
    await db.update(checklistSections).set({ heading: h }).where(eq(checklistSections.id, sectionId));
  } else {
    const all = await db
      .select({ id: checklistSections.id, seq: checklistSections.seq })
      .from(checklistSections)
      .where(eq(checklistSections.templateId, templateId));
    await moveRow(all, sectionId, op, (id, seq) => db.update(checklistSections).set({ seq }).where(eq(checklistSections.id, id)));
  }
  await touch(templateId);
  return true;
}

export async function addSection(templateId: string, heading: string): Promise<boolean> {
  const h = clean(heading, 200);
  if (!h) return false;
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${checklistSections.seq}), 0)` })
    .from(checklistSections)
    .where(eq(checklistSections.templateId, templateId));
  await db.insert(checklistSections).values({ id: randomUUID(), templateId, seq: Number(max) + 1, heading: h });
  await touch(templateId);
  return true;
}

/**
 * The form's printed title and confirmation statement, and — when given —
 * whether it prints a corrective-action log and under what heading.
 */
export async function editFormText(
  templateId: string,
  title: string,
  confirmation: string,
  log?: { on: boolean; title: string },
): Promise<boolean> {
  const t = clean(title, 200);
  // A form may have no confirmation statement (the ESC form signs off with
  // "Checked & verified by" blocks instead).
  const c = clean(confirmation, 1500);
  if (!t) return false;
  await db
    .update(checklistTemplates)
    .set({
      title: t,
      confirmation: c,
      ...(log ? { observationLog: log.on, observationTitle: clean(log.title, 120) || "Observations" } : {}),
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(checklistTemplates.id, templateId));
  return true;
}

// ---------- item photos ----------

/** Link a stored evidence file to the item (response) it shows. */
export async function linkItemPhoto(responseId: string, evidenceDocId: string): Promise<void> {
  await db.insert(checklistResponsePhotos).values({ id: randomUUID(), responseId, evidenceDocId });
}

/** The evidence file, if it is a photo linked to this response. */
export async function itemPhoto(responseId: string, evidenceDocId: string) {
  const [row] = await db
    .select({ id: evidenceDocs.id, filePath: evidenceDocs.filePath })
    .from(checklistResponsePhotos)
    .innerJoin(evidenceDocs, eq(checklistResponsePhotos.evidenceDocId, evidenceDocs.id))
    .where(and(eq(checklistResponsePhotos.responseId, responseId), eq(checklistResponsePhotos.evidenceDocId, evidenceDocId)))
    .limit(1);
  return row ?? null;
}

/**
 * How each item photo of a form is labelled in an inspection's PDF: the item
 * ("1.1 Filters at supply air intake"), plus the inspection's date when the
 * photo was taken in another inspection of the same form. `current` comes
 * first, in item order, so this inspection's photos lead the photo table.
 */
export async function itemPhotoLabels(
  templateId: string,
  currentInspectionId: string,
): Promise<Map<string, { label: string; current: boolean; itemNo: string }>> {
  const rows = await db
    .select({
      evidenceDocId: checklistResponsePhotos.evidenceDocId,
      itemNo: checklistResponses.itemNo,
      itemText: checklistResponses.itemText,
      inspectionId: checklistInspections.id,
      inspectionDate: checklistInspections.inspectionDate,
    })
    .from(checklistResponsePhotos)
    .innerJoin(checklistResponses, eq(checklistResponsePhotos.responseId, checklistResponses.id))
    .innerJoin(checklistInspections, eq(checklistResponses.inspectionId, checklistInspections.id))
    .where(eq(checklistInspections.templateId, templateId));
  const out = new Map<string, { label: string; current: boolean; itemNo: string }>();
  for (const r of rows) {
    const current = r.inspectionId === currentInspectionId;
    const item = `${r.itemNo} ${r.itemText}`;
    out.set(r.evidenceDocId, {
      label: current ? item : `${item} (inspection of ${r.inspectionDate ?? "an undated inspection"})`,
      current,
      itemNo: r.itemNo,
    });
  }
  return out;
}
