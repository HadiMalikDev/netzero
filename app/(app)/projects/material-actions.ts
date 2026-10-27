"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getProject } from "@/lib/data";
import {
  addSmqRow,
  addSmqSection,
  editSmqRow,
  editSmqSection,
  editSmqSettings,
  ensureProjectSmq,
  type RowInput,
  type SmqRowOp,
  type SmqSectionOp,
} from "@/lib/materials/smq";

/**
 * Server actions for Material Review (Sprint 3). Every action re-reads the
 * project and its own questionnaire from the database: ids posted by the form
 * are only trusted once they are found under that project.
 */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

const materialsBase = (projectId: string) => `/projects/${projectId}/materials`;

/** The project's questionnaire copy, made on first use. */
async function projectTemplateId(formData: FormData) {
  const projectId = str(formData, "projectId");
  if (!(await getProject(projectId))) throw new Error("project not found");
  const t = await ensureProjectSmq(projectId);
  if (!t) throw new Error("no material questionnaire to copy");
  return { projectId, templateId: t.id };
}

function backToForm(projectId: string, anchor?: string): never {
  revalidatePath(`${materialsBase(projectId)}/form`);
  revalidatePath(materialsBase(projectId));
  redirect(`${materialsBase(projectId)}/form${anchor ? `#${anchor}` : ""}`);
}

function rowInput(formData: FormData): RowInput {
  return {
    text: str(formData, "text"),
    projectCreditId: str(formData, "projectCreditId"),
    leedRef: str(formData, "leedRef"),
    kind: str(formData, "kind"),
    targetText: str(formData, "targetText"),
    valueUnit: str(formData, "valueUnit"),
    note: str(formData, "note"),
  };
}

/** "" = not entered; anything else must be a plain number (commas allowed). */
function optionalNumber(raw: string): number | null | undefined {
  const t = raw.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export async function saveSmqSettingsAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const boq = optionalNumber(str(formData, "boqMaterialCostSar"));
  if (boq === undefined) throw new Error("BOQ material cost must be a number");
  const ok = await editSmqSettings(templateId, {
    title: str(formData, "title"),
    expiryYears: Number(str(formData, "expiryYears")),
    boqMaterialCostSar: boq,
  });
  if (!ok) throw new Error("check the title, expiry years (1–50) and BOQ cost");
  backToForm(projectId, "settings");
}

export async function editSmqSectionAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const op = str(formData, "op") as SmqSectionOp;
  if (!["rename", "toggle", "up", "down", "parts"].includes(op)) throw new Error("bad op");
  const sectionId = str(formData, "sectionId");
  await editSmqSection(templateId, sectionId, op, {
    heading: str(formData, "heading"),
    parts: formData.getAll("parts").map(String),
  });
  backToForm(projectId, `s-${sectionId}`);
}

export async function addSmqSectionAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const id = await addSmqSection(templateId, str(formData, "heading"));
  backToForm(projectId, id ? `s-${id}` : undefined);
}

export async function editSmqRowAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const op = str(formData, "op") as SmqRowOp;
  if (!["save", "toggle", "up", "down"].includes(op)) throw new Error("bad op");
  const rowId = str(formData, "rowId");
  const ok = await editSmqRow(templateId, rowId, op, op === "save" ? rowInput(formData) : undefined);
  if (!ok) throw new Error("row not saved: it needs its requirement text, and the credit must be this project's");
  backToForm(projectId, `r-${rowId}`);
}

export async function addSmqRowAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const sectionId = str(formData, "sectionId");
  const ok = await addSmqRow(templateId, sectionId, rowInput(formData));
  if (!ok) throw new Error("row not added: it needs its requirement text");
  backToForm(projectId, `s-${sectionId}`);
}
