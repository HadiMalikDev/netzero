"use server";

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
  linkItemPhoto,
  setItemPhotos,
  unlinkItemPhoto,
  parseAnswer,
  projectTemplate,
  saveInspection,
  startInspection,
  type ItemOp,
  type SaveInput,
  type SectionOp,
} from "@/lib/checklists";
import { getCreditByCode, WORKSPACE_ID } from "@/lib/data";
import { creditPhotos } from "@/lib/report/checklist";
import { storeUpload } from "@/lib/uploads";

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
  // Refresh in place: the reader stays where they clicked, and the button
  // shows the result beside it (a redirect sent them to the top).
  revalidatePath(`${base(projectId, code)}/${inspectionId}`);
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
  const { id, filePath, size } = await storeUpload(file, projectId);
  await db.insert(evidenceDocs).values({
    id,
    workspaceId: WORKSPACE_ID,
    projectCreditId,
    requirementEntryId: null,
    fileName: file.name,
    filePath,
    fileSize: size,
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

/**
 * Photos taken during an inspection, uploaded from its review page. Stored as
 * the credit's additional attachments — the same place the credit page's
 * "Additional attachments" upload puts them — so they show on the credit and
 * in its PDFs. PNG or JPEG, several at once.
 */
export async function uploadInspectionPhotosAction(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const credit = await getCreditByCode(projectId, code);
  if (!credit) throw new Error("credit not found");
  if (!(await ownedInspection(inspectionId, projectId))) throw new Error("inspection not found");
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  // Check every file before storing any, so one wrong type stores nothing,
  // and say so on the page rather than failing the request.
  const wrong = files.filter((f) => !PHOTO_TYPES[f.name.slice(f.name.lastIndexOf(".")).toLowerCase()]);
  if (wrong.length || files.length === 0) {
    redirect(`${base(projectId, code)}/${inspectionId}?photoError=${wrong.length ? "type" : "none"}#photos`);
  }
  for (const f of files) await savePhoto(f, projectId, credit.projectCreditId);
  // No redirect on success: refreshing the page in place keeps the reader
  // where they were (a redirect sent them back to the top, Hadi 2026-10-11).
  revalidatePath(`/projects/${projectId}/credits/${encodeURIComponent(code)}`);
  revalidatePath(`${base(projectId, code)}/${inspectionId}`);
}

// ---------- item photos (camera button on each row) ----------

export interface ItemPhotoResult {
  ok: boolean;
  error?: string;
  /** Upload only: the new photos' evidence ids, so the modal can show them selected. */
  ids?: string[];
}

/**
 * Photos taken for one item from its row. Called directly by the row's
 * camera control (the rows sit inside the review form, so it cannot be a form
 * of its own). Stored as the credit's additional attachments and linked to
 * the item; the page refreshes in place, keeping scroll and unsaved answers.
 */
export async function uploadItemPhotoAction(formData: FormData): Promise<ItemPhotoResult> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const responseId = String(formData.get("responseId") ?? "");
  const insp = await ownedInspection(inspectionId, projectId);
  if (!insp || !insp.responses.some((r) => r.id === responseId)) return { ok: false, error: "Item not found" };
  const credit = await getCreditByCode(projectId, code);
  if (!credit || credit.projectCreditId !== insp.projectCreditId) return { ok: false, error: "Credit not found" };
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "No photo received" };
  if (files.some((f) => !PHOTO_TYPES[f.name.slice(f.name.lastIndexOf(".")).toLowerCase()]))
    return { ok: false, error: "Photos must be PNG or JPEG" };
  const ids: string[] = [];
  for (const f of files) {
    const id = await savePhoto(f, projectId, credit.projectCreditId);
    if (id) {
      await linkItemPhoto(responseId, id);
      ids.push(id);
    }
  }
  revalidatePath(`/projects/${projectId}/credits/${encodeURIComponent(code)}`);
  revalidatePath(`${base(projectId, code)}/${inspectionId}`);
  return { ok: true, ids };
}

/**
 * Take one photo off an item. Only the link goes: the photo stays on the
 * credit and on any other item it shows (a shared site shot). Deleting a
 * photo for good is done on the credit page.
 */
export async function removeItemPhotoAction(formData: FormData): Promise<ItemPhotoResult> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const responseId = String(formData.get("responseId") ?? "");
  const docId = String(formData.get("docId") ?? "");
  const insp = await ownedInspection(inspectionId, projectId);
  if (!insp || !insp.responses.some((r) => r.id === responseId)) return { ok: false, error: "Item not found" };
  if (!(await unlinkItemPhoto(responseId, docId))) return { ok: false, error: "Photo not found on this item" };
  revalidatePath(`${base(projectId, code)}/${inspectionId}`);
  return { ok: true };
}

/**
 * The photo modal's selection for one item: the item's photos become exactly
 * these. Every id must be one of the photos the modal offers — the credit's
 * photos on the path being pursued, never an ESC observation's before / after
 * photo — so a crafted request cannot attach another credit's file.
 */
export async function setItemPhotosAction(formData: FormData): Promise<ItemPhotoResult> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const responseId = String(formData.get("responseId") ?? "");
  const insp = await ownedInspection(inspectionId, projectId);
  const row = insp?.responses.find((r) => r.id === responseId);
  if (!insp || !row) return { ok: false, error: "Item not found" };
  const credit = await getCreditByCode(projectId, code);
  if (!credit || credit.projectCreditId !== insp.projectCreditId) return { ok: false, error: "Credit not found" };
  const offered = new Set(creditPhotos(credit).map((p) => p.fileId));
  const chosen = [...new Set(formData.getAll("docId").map(String))];
  if (chosen.some((id) => !offered.has(id))) return { ok: false, error: "That photo is not on this credit" };
  // A linked photo the modal did not offer (its either/or path was dropped
  // since) was not shown, so the selection says nothing about it: keep it.
  const unseen = row.photos.map((p) => p.id).filter((id) => !offered.has(id));
  await setItemPhotos(responseId, [...chosen, ...unseen]);
  revalidatePath(`${base(projectId, code)}/${inspectionId}`);
  return { ok: true };
}
