"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocs, projectCredits } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { runInspectionDraft } from "@/lib/ai/inspection-draft";
import { draftRecommendations } from "@/lib/ai/observation-recommendation";
import {
  addObservation,
  raiseObservations,
  setObservationPhotos,
  updateObservation,
  type ObservationStatus,
} from "@/lib/observations";
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
  // Non-compliant answers open observations in the form's corrective-action
  // log (forms with the log on, e.g. ESC); the AI drafts their
  // recommendations after the response.
  const raised = await raiseObservations(inspectionId);
  if (raised.length) after(() => draftRecommendations(raised));
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
  await editFormText(templateId, String(formData.get("title") ?? ""), String(formData.get("confirmation") ?? ""), {
    on: formData.get("observationLog") === "on",
    title: String(formData.get("observationTitle") ?? ""),
  });
  backToForm(projectId, code);
}

// ---------- corrective-action log ----------

const PHOTO_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

/**
 * Store an observation photo as a credit-level evidence file, so the existing
 * file route serves it and it sits with the credit's other evidence. PNG or
 * JPEG only: those are what the PDF can embed. Null when no file was sent.
 */
async function savePhoto(file: FormDataEntryValue | null, projectId: string, projectCreditId: string): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!PHOTO_TYPES[ext]) throw new Error("Photos must be PNG or JPEG");
  const dir = join(".data/uploads", projectId, "evidence");
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const filePath = join(dir, `${id}-${file.name.replace(/[^\w.\-() ]+/g, "_")}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buf);
  await db.insert(evidenceDocs).values({
    id,
    workspaceId: WORKSPACE_ID,
    projectCreditId,
    requirementEntryId: null,
    fileName: file.name,
    filePath,
    fileSize: buf.length,
  });
  return id;
}

function backToInspections(projectId: string, code: string): never {
  revalidatePath(base(projectId, code));
  redirect(`${base(projectId, code)}#observations`);
}

export async function addObservationAction(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const credit = await getCreditByCode(projectId, code);
  if (!credit) throw new Error("credit not found");
  const template = await ensureProjectTemplate(credit.projectCreditId, credit.title);
  if (!template?.observationLog) throw new Error("This form has no observations log");
  const id = await addObservation(template.id, String(formData.get("observation") ?? ""), String(formData.get("observedOn") ?? ""));
  if (id) after(() => draftRecommendations([id]));
  backToInspections(projectId, code);
}

export async function updateObservationAction(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const credit = await getCreditByCode(projectId, code);
  if (!credit) throw new Error("credit not found");
  const template = await projectTemplate(credit.projectCreditId);
  if (!template) throw new Error("no form");
  // The edit is checked and saved first; photos are stored only once it has
  // been accepted, so a rejected edit (an emptied observation, another form's
  // row) never leaves a stray file on the credit.
  const observationId = String(formData.get("observationId") ?? "");
  const ok = await updateObservation(template.id, observationId, {
    observation: String(formData.get("observation") ?? ""),
    recommendation: String(formData.get("recommendation") ?? ""),
    correctiveAction: String(formData.get("correctiveAction") ?? ""),
    observedOn: String(formData.get("observedOn") ?? ""),
    closedOn: String(formData.get("closedOn") ?? ""),
    status: (String(formData.get("status") ?? "") === "closed" ? "closed" : "open") as ObservationStatus,
  });
  if (ok) {
    const before = await savePhoto(formData.get("beforePhoto"), projectId, credit.projectCreditId);
    const afterPhoto = await savePhoto(formData.get("afterPhoto"), projectId, credit.projectCreditId);
    await setObservationPhotos(template.id, observationId, {
      ...(before ? { beforePhotoId: before } : {}),
      ...(afterPhoto ? { afterPhotoId: afterPhoto } : {}),
    });
  }
  backToInspections(projectId, code);
}
