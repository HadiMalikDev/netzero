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
  addItem,
  addSection,
  applyAiDraftPending,
  editFormText,
  editItem,
  editSection,
  ensureProjectTemplate,
  getInspection,
  parseAnswer,
  projectTemplate,
  saveInspection,
  startInspection,
  type ItemOp,
  type SaveInput,
  type SectionOp,
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
    inspectionTime: /^\d{2}:\d{2}$/.test(String(formData.get("inspectionTime") ?? "")) ? String(formData.get("inspectionTime")) : null,
    refNo: String(formData.get("refNo") ?? ""),
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

// ---------- form editor ----------

/**
 * The project's own copy of the form, resolved from the form fields. Editing
 * never touches the workspace default: the editor offers "make this project's
 * own copy" first, and every op checks the row belongs to that copy.
 */
async function ownTemplate(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const credit = await getCreditByCode(projectId, code);
  if (!credit) throw new Error("credit not found");
  const t = await projectTemplate(credit.projectCreditId);
  return { projectId, code, templateId: t?.id ?? null, credit };
}

function backToForm(projectId: string, code: string): never {
  revalidatePath(`${base(projectId, code)}/form`);
  redirect(`${base(projectId, code)}/form`);
}

export async function copyFormAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, code, credit } = await ownTemplate(formData);
  await ensureProjectTemplate(credit.projectCreditId, credit.title);
  backToForm(projectId, code);
}

export async function editItemAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, code, templateId } = await ownTemplate(formData);
  if (!templateId) throw new Error("make the project's own copy first");
  const op = String(formData.get("op") ?? "") as ItemOp;
  if (!["save", "toggle", "up", "down", "compliance"].includes(op)) throw new Error("bad op");
  await editItem(
    templateId,
    String(formData.get("itemId") ?? ""),
    op,
    String(formData.get("text") ?? ""),
    String(formData.get("compliant") ?? ""),
  );
  backToForm(projectId, code);
}

export async function addItemAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, code, templateId } = await ownTemplate(formData);
  if (!templateId) throw new Error("make the project's own copy first");
  await addItem(templateId, String(formData.get("sectionId") ?? ""), String(formData.get("text") ?? ""));
  backToForm(projectId, code);
}

export async function editSectionAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, code, templateId } = await ownTemplate(formData);
  if (!templateId) throw new Error("make the project's own copy first");
  const op = String(formData.get("op") ?? "") as SectionOp;
  if (!["rename", "up", "down"].includes(op)) throw new Error("bad op");
  await editSection(templateId, String(formData.get("sectionId") ?? ""), op, String(formData.get("heading") ?? ""));
  backToForm(projectId, code);
}

export async function addSectionAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, code, templateId } = await ownTemplate(formData);
  if (!templateId) throw new Error("make the project's own copy first");
  await addSection(templateId, String(formData.get("heading") ?? ""));
  backToForm(projectId, code);
}

export async function editFormTextAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, code, templateId } = await ownTemplate(formData);
  if (!templateId) throw new Error("make the project's own copy first");
  await editFormText(templateId, String(formData.get("title") ?? ""), String(formData.get("confirmation") ?? ""));
  backToForm(projectId, code);
}
