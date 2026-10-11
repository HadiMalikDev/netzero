import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { checklistObservations, evidenceDocs } from "@/db/schema";
import { WORKSPACE_ID } from "@/lib/catalog";
import { compareItemNo, getInspection, type Answer } from "@/lib/checklists";

/**
 * The corrective-action log of a project's form (Sprint 2 item 3): a running
 * list per credit — an observation stays open across inspections until
 * someone records the corrective action and closes it. Raised automatically
 * from non-compliant answers when a review is saved, or added by hand. See
 * checklist_observation in db/schema.ts.
 */

export type ObservationStatus = "open" | "closed";

/**
 * Whether a saved answer is a non-conformance: No to a "Yes is compliant"
 * item, or Yes to a "No is compliant" one. N/A, blank and observations
 * (no compliant answer) never are.
 */
export function isNonCompliant(compliant: Answer | null, answer: Answer | null): boolean {
  return (compliant === "yes" && answer === "no") || (compliant === "no" && answer === "yes");
}

/** The observation text for a non-compliant item: the question, the answer, and the reviewer's note. */
export function observationText(itemNo: string, itemText: string, answer: Answer, remark: string | null): string {
  const said = answer === "yes" ? "Yes" : "No";
  return `${itemNo} ${itemText.trim()} — ${said}${remark?.trim() ? `: ${remark.trim()}` : "."}`;
}

const today = () => new Date().toISOString().slice(0, 10);
const isoDate = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export interface ObservationRow {
  id: string;
  inspectionId: string | null;
  itemNo: string | null;
  observation: string;
  recommendation: string | null;
  recommendationSource: "ai" | "person" | null;
  aiState: string | null;
  beforePhoto: { id: string; fileName: string } | null;
  correctiveAction: string | null;
  afterPhoto: { id: string; fileName: string } | null;
  observedOn: string | null;
  closedOn: string | null;
  status: ObservationStatus;
  createdAt: number;
}

/** The log, oldest first (Sr# 1 is the first raised). */
export async function listObservations(templateId: string): Promise<ObservationRow[]> {
  const rows = await db
    .select()
    .from(checklistObservations)
    .where(and(eq(checklistObservations.workspaceId, WORKSPACE_ID), eq(checklistObservations.templateId, templateId)))
    .orderBy(asc(checklistObservations.createdAt), asc(checklistObservations.id));
  const photoIds = rows.flatMap((r) => [r.beforePhotoId, r.afterPhotoId]).filter((x): x is string => Boolean(x));
  const photos = photoIds.length
    ? await db
        .select({ id: evidenceDocs.id, fileName: evidenceDocs.fileName })
        .from(evidenceDocs)
        .where(inArray(evidenceDocs.id, photoIds))
    : [];
  const byId = new Map(photos.map((p) => [p.id, p]));
  // Sr# follows the order raised; observations raised by the same save share a
  // timestamp, so they take the checklist's item order (1.1, 1.5, 4.5), and
  // hand-added ones follow. Never the random id alone.
  rows.sort(
    (a, b) =>
      a.createdAt - b.createdAt ||
      (a.itemNo && b.itemNo ? compareItemNo(a.itemNo, b.itemNo) : a.itemNo ? -1 : b.itemNo ? 1 : 0) ||
      a.id.localeCompare(b.id),
  );
  return rows.map((r) => ({
    id: r.id,
    inspectionId: r.inspectionId,
    itemNo: r.itemNo,
    observation: r.observation,
    recommendation: r.recommendation,
    recommendationSource: r.recommendationSource === "ai" || r.recommendationSource === "person" ? r.recommendationSource : null,
    aiState: r.aiState,
    beforePhoto: r.beforePhotoId ? (byId.get(r.beforePhotoId) ?? null) : null,
    correctiveAction: r.correctiveAction,
    afterPhoto: r.afterPhotoId ? (byId.get(r.afterPhotoId) ?? null) : null,
    observedOn: r.observedOn,
    closedOn: r.closedOn,
    status: r.status === "closed" ? "closed" : "open",
    createdAt: r.createdAt,
  }));
}

/**
 * Raise an observation for every non-compliant answer of a saved inspection,
 * unless the log already has an OPEN one for that form item (a known issue is
 * not logged twice while it is being dealt with). Only on forms with the log
 * switched on. Returns the ids raised, for the AI to draft recommendations.
 */
export async function raiseObservations(inspectionId: string): Promise<string[]> {
  const insp = await getInspection(inspectionId);
  if (!insp || !insp.template.observationLog) return [];
  // Matched on the form item, never on its printed number, which shifts when
  // the form is edited.
  const open = await db
    .select({ itemId: checklistObservations.itemId })
    .from(checklistObservations)
    .where(and(eq(checklistObservations.templateId, insp.templateId), eq(checklistObservations.status, "open")));
  const openItems = new Set(open.map((o) => o.itemId).filter(Boolean));
  const raised: string[] = [];
  for (const r of insp.responses) {
    if (!r.answer || !isNonCompliant(r.compliantAnswer, r.answer)) continue;
    if (r.itemId && openItems.has(r.itemId)) continue;
    const id = randomUUID();
    await db.insert(checklistObservations).values({
      id,
      workspaceId: WORKSPACE_ID,
      templateId: insp.templateId,
      inspectionId,
      itemNo: r.itemNo,
      itemId: r.itemId,
      observation: observationText(r.itemNo, r.itemText, r.answer, r.remark),
      observedOn: isoDate(insp.inspectionDate) ?? today(),
      status: "open",
      aiState: "pending",
    });
    if (r.itemId) openItems.add(r.itemId);
    raised.push(id);
  }
  return raised;
}

/** An observation added by hand. */
export async function addObservation(templateId: string, text: string, observedOn: string | null): Promise<string | null> {
  const t = text.trim().slice(0, 1000);
  if (!t) return null;
  const id = randomUUID();
  await db.insert(checklistObservations).values({
    id,
    workspaceId: WORKSPACE_ID,
    templateId,
    observation: t,
    observedOn: isoDate(observedOn) ?? today(),
    status: "open",
    aiState: "pending",
  });
  return id;
}

export interface ObservationEdit {
  observation: string;
  recommendation: string;
  correctiveAction: string;
  observedOn: string | null;
  closedOn: string | null;
  status: ObservationStatus;
  beforePhotoId?: string | null;
  afterPhotoId?: string | null;
}

/**
 * Save one row of the log. A recommendation the person changes stops being
 * the AI's draft. Closing without a closing date records today; reopening
 * clears it.
 */
export async function updateObservation(templateId: string, id: string, e: ObservationEdit): Promise<boolean> {
  const [cur] = await db
    .select()
    .from(checklistObservations)
    .where(and(eq(checklistObservations.id, id), eq(checklistObservations.templateId, templateId)))
    .limit(1);
  if (!cur) return false;
  const observation = e.observation.trim().slice(0, 1000);
  if (!observation) return false;
  const recommendation = e.recommendation.trim().slice(0, 1000) || null;
  const recommendationSource =
    recommendation == null ? null : recommendation === cur.recommendation ? cur.recommendationSource : "person";
  const closedOn = e.status === "closed" ? (isoDate(e.closedOn) ?? today()) : null;
  await db
    .update(checklistObservations)
    .set({
      observation,
      recommendation,
      recommendationSource,
      correctiveAction: e.correctiveAction.trim().slice(0, 1000) || null,
      observedOn: isoDate(e.observedOn) ?? cur.observedOn,
      closedOn,
      status: e.status,
      ...(e.beforePhotoId !== undefined ? { beforePhotoId: e.beforePhotoId } : {}),
      ...(e.afterPhotoId !== undefined ? { afterPhotoId: e.afterPhotoId } : {}),
    })
    .where(eq(checklistObservations.id, id));
  return true;
}

/** Store the AI's recommendation draft, unless a person has written one meanwhile. */
export async function applyRecommendation(id: string, draft: { state: "done"; text: string } | { state: "failed" | "skipped" }) {
  const [cur] = await db
    .select({ recommendation: checklistObservations.recommendation, source: checklistObservations.recommendationSource })
    .from(checklistObservations)
    .where(eq(checklistObservations.id, id))
    .limit(1);
  if (!cur) return;
  if (draft.state === "done" && (cur.recommendation == null || cur.source === "ai")) {
    await db
      .update(checklistObservations)
      .set({ recommendation: draft.text, recommendationSource: "ai", aiState: "done" })
      .where(eq(checklistObservations.id, id));
  } else {
    await db.update(checklistObservations).set({ aiState: draft.state }).where(eq(checklistObservations.id, id));
  }
}
