"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectCredits } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { runInspectionDraft } from "@/lib/ai/inspection-draft";
import {
  applyAiDraftPending,
  ensureProjectTemplate,
  getInspection,
  parseAnswer,
  saveInspection,
  startInspection,
  type SaveInput,
} from "@/lib/checklists";
import { getCreditByCode, WORKSPACE_ID } from "@/lib/data";

/**
 * Inspection-sheet actions (Sprint 2 item 3): start an inspection (the AI
 * drafts it in the background) and save the reviewer's answers.
 */

const base = (projectId: string, code: string) =>
  `/projects/${projectId}/credits/${encodeURIComponent(code)}/inspections`;

/** The inspection, if it belongs to this project. */
async function ownedInspection(inspectionId: string, projectId: string) {
  const insp = await getInspection(inspectionId);
  if (!insp?.projectCreditId) return null;
  const [pc] = await db
    .select({ projectId: projectCredits.projectId })
    .from(projectCredits)
    .where(and(eq(projectCredits.id, insp.projectCreditId), eq(projectCredits.workspaceId, WORKSPACE_ID)))
    .limit(1);
  return pc?.projectId === projectId ? insp : null;
}

/**
 * New inspection: copy the default form into the project if this is its first
 * use, snapshot the form's active items, start the AI draft after the
 * response, and open the review page.
 */
export async function startInspectionAction(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const credit = await getCreditByCode(projectId, code);
  if (!credit) throw new Error("credit not found");
  const template = await ensureProjectTemplate(credit.projectCreditId, credit.title);
  if (!template) throw new Error("This credit has no inspection form");
  const inspectionId = await startInspection(template.id);
  after(() => runInspectionDraft(inspectionId));
  redirect(`${base(projectId, code)}/${inspectionId}`);
}

/** Re-run the AI draft, e.g. after the plan was uploaded. Never changes saved answers. */
export async function rerunDraftAction(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const insp = await ownedInspection(inspectionId, projectId);
  if (!insp) throw new Error("inspection not found");
  await applyAiDraftPending(inspectionId);
  after(() => runInspectionDraft(inspectionId));
  revalidatePath(`${base(projectId, code)}/${inspectionId}`);
}

/** The reviewer's answers. Fields: date, inspector, area, answer:<id>, remark:<id>. */
export async function saveInspectionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const insp = await ownedInspection(inspectionId, projectId);
  if (!insp) throw new Error("inspection not found");

  const date = String(formData.get("inspectionDate") ?? "").trim();
  const input: SaveInput = {
    inspectionDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    inspector: String(formData.get("inspector") ?? ""),
    area: String(formData.get("area") ?? ""),
    answers: {},
  };
  for (const r of insp.responses) {
    input.answers[r.id] = {
      answer: parseAnswer(formData.get(`answer:${r.id}`)),
      remark: String(formData.get(`remark:${r.id}`) ?? ""),
    };
  }
  await saveInspection(inspectionId, input, user.id);
  revalidatePath(base(projectId, code));
  redirect(`${base(projectId, code)}/${inspectionId}?saved=1`);
}
