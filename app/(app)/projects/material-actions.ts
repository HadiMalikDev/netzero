"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { applyPartValue } from "@/lib/materials/apply";
import { getProject } from "@/lib/data";
import type { FormErrorCode } from "@/lib/materials/form-errors";
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
import {
  addDelivery,
  addProduct,
  attachMaterialDoc,
  createSubmittal,
  newRevision,
  parseSlot,
  productState,
  removeDelivery,
  removeMaterialDoc,
  saveAnswers,
  saveBoqQuantities,
  saveProductHeader,
  saveReview,
  setProductParts,
  setProductTypes,
  updateSubmittal,
} from "@/lib/materials/products";

/**
 * Server actions for Material Review (Sprint 3). Every action re-reads the
 * project and its own questionnaire from the database: ids posted by the form
 * are only trusted once they are found under that project.
 *
 * Actions behind an ActionForm return why a save was refused (a FormErrorCode)
 * so the form can say so in place (QA finding 1); they redirect when saved.
 * Ids that don't resolve still throw: only a tampered request posts those.
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

export async function saveSmqSettingsAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const boq = optionalNumber(str(formData, "boqMaterialCostSar"));
  if (boq === undefined || (boq !== null && boq <= 0)) return "smq_boq";
  const title = str(formData, "title");
  if (!title.trim()) return "smq_title";
  const ok = await editSmqSettings(templateId, { title, expiryYears: Number(str(formData, "expiryYears")), boqMaterialCostSar: boq });
  if (!ok) return "smq_expiry";
  backToForm(projectId, "settings");
}

export async function editSmqSectionAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const op = str(formData, "op") as SmqSectionOp;
  if (!["rename", "toggle", "up", "down", "parts"].includes(op)) throw new Error("bad op");
  const sectionId = str(formData, "sectionId");
  const ok = await editSmqSection(templateId, sectionId, op, {
    heading: str(formData, "heading"),
    parts: formData.getAll("parts").map(String),
  });
  if (!ok && op === "rename") return "type_name";
  backToForm(projectId, `s-${sectionId}`);
}

export async function addSmqSectionAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const id = await addSmqSection(templateId, str(formData, "heading"));
  if (!id) return "type_name";
  backToForm(projectId, `s-${id}`);
}

export async function editSmqRowAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const op = str(formData, "op") as SmqRowOp;
  if (!["save", "toggle", "up", "down"].includes(op)) throw new Error("bad op");
  const rowId = str(formData, "rowId");
  const ok = await editSmqRow(templateId, rowId, op, op === "save" ? rowInput(formData) : undefined);
  // The credit list offers only this project's credits, so a refusal is the missing text.
  if (!ok) return "row_text";
  backToForm(projectId, `r-${rowId}`);
}

export async function addSmqRowAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, templateId } = await projectTemplateId(formData);
  const sectionId = str(formData, "sectionId");
  const ok = await addSmqRow(templateId, sectionId, rowInput(formData));
  if (!ok) return "row_text";
  backToForm(projectId, `s-${sectionId}`);
}

// ---------- submittals and products ----------

const productPath = (projectId: string, productId: string) => `${materialsBase(projectId)}/products/${productId}`;

function refresh(projectId: string) {
  // The Materials page, credit pages and reports all read material reviews.
  revalidatePath(`/projects/${projectId}`, "layout");
}

function submittalInput(formData: FormData) {
  return {
    ref: str(formData, "ref"),
    title: str(formData, "title"),
    discipline: str(formData, "discipline"),
    supplier: str(formData, "supplier"),
    submittedOn: str(formData, "submittedOn"),
  };
}

function headerInput(formData: FormData) {
  return {
    name: str(formData, "name"),
    locationOfUse: str(formData, "locationOfUse"),
    manufacturer: str(formData, "manufacturer"),
    supplier: str(formData, "supplier"),
    countryOfOrigin: str(formData, "countryOfOrigin"),
    contactName: str(formData, "contactName"),
    contactMobile: str(formData, "contactMobile"),
  };
}

async function project(formData: FormData) {
  const projectId = str(formData, "projectId");
  if (!(await getProject(projectId))) throw new Error("project not found");
  return projectId;
}

export async function createSubmittalAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const projectId = await project(formData);
  const id = await createSubmittal(projectId, submittalInput(formData));
  if (!id) return "submittal_fields";
  refresh(projectId);
  redirect(`${materialsBase(projectId)}/submittals/${id}`);
}

export async function updateSubmittalAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const projectId = await project(formData);
  const id = str(formData, "submittalId");
  if (!(await updateSubmittal(projectId, id, submittalInput(formData)))) return "submittal_fields";
  refresh(projectId);
  redirect(`${materialsBase(projectId)}/submittals/${id}`);
}

export async function addProductAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const projectId = await project(formData);
  const id = await addProduct(projectId, str(formData, "submittalId"), headerInput(formData));
  if (!id) return "product_name";
  refresh(projectId);
  redirect(productPath(projectId, id));
}

const FROZEN = "This revision has been replaced by a newer one and can no longer be changed.";

/**
 * Every product form posts projectId + productId; the product is re-read under
 * the project. `frozen`: a newer revision replaced it (an old tab), checked
 * here so a failure further on is about the input alone.
 */
async function productTarget(formData: FormData) {
  const projectId = await project(formData);
  const productId = str(formData, "productId");
  const state = await productState(projectId, productId);
  if (state === "missing") throw new Error("product not found");
  return { projectId, productId, frozen: state === "superseded" };
}

/** For the actions without an ActionForm: an old revision can only be posted from a stale tab. */
async function editableTarget(formData: FormData) {
  const t = await productTarget(formData);
  if (t.frozen) throw new Error(FROZEN);
  return t;
}

function backToProduct(projectId: string, productId: string, anchor?: string): never {
  refresh(projectId);
  redirect(`${productPath(projectId, productId)}${anchor ? `#${anchor}` : ""}`);
}

export async function saveProductHeaderAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, productId, frozen } = await productTarget(formData);
  if (frozen) return "frozen";
  if (!(await saveProductHeader(projectId, productId, headerInput(formData)))) return "product_name";
  backToProduct(projectId, productId, "header");
}

export async function setProductTypesAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, productId } = await editableTarget(formData);
  if (!(await setProductTypes(projectId, productId, formData.getAll("types").map(String)))) throw new Error("This project has no material questionnaire.");
  backToProduct(projectId, productId, "types");
}

export async function setProductPartsAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, productId } = await editableTarget(formData);
  const ok = await setProductParts(projectId, productId, formData.getAll("parts").map(String), str(formData, "interior") !== "no");
  if (!ok) throw new Error("Not saved.");
  backToProduct(projectId, productId, "types");
}

export async function saveAnswersAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, productId } = await editableTarget(formData);
  const inputs = formData.getAll("answerId").map((v) => {
    const answerId = String(v);
    return {
      answerId,
      answer: str(formData, `answer:${answerId}`),
      value: str(formData, `value:${answerId}`),
      unit: str(formData, `unit:${answerId}`),
      remark: str(formData, `remark:${answerId}`),
    };
  });
  if (!(await saveAnswers(projectId, productId, inputs))) throw new Error("Answers not saved.");
  backToProduct(projectId, productId, "questionnaire");
}

/** Upload result for the client control: an error message, or null when stored. */
export async function uploadMaterialDocAction(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireUser();
  const { projectId, productId, frozen } = await productTarget(formData);
  if (frozen) return FROZEN;
  const answerId = str(formData, "answerId");
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return "No file was sent.";
  for (const file of files) {
    const error = await attachMaterialDoc(
      projectId,
      productId,
      file,
      answerId ? { answerId } : { slot: parseSlot(str(formData, "slot")) },
      str(formData, "issuedOn"),
    );
    if (error) return error;
  }
  refresh(projectId);
  return null;
}

export async function removeMaterialDocAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, productId } = await editableTarget(formData);
  if (!(await removeMaterialDoc(projectId, productId, str(formData, "linkId")))) throw new Error("That file is not on this product.");
  backToProduct(projectId, productId, str(formData, "anchor") || undefined);
}

export async function saveReviewAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, productId, frozen } = await productTarget(formData);
  if (frozen) return "frozen";
  const ok = await saveReview(projectId, productId, {
    status: str(formData, "status"),
    reviewedOn: str(formData, "reviewedOn"),
    reviewer: str(formData, "reviewer"),
    applicable: str(formData, "applicable"),
    remarks: str(formData, "remarks"),
    manufacturerSignatory: str(formData, "manufacturerSignatory"),
    manufacturerSignedOn: str(formData, "manufacturerSignedOn"),
    contractorSignatory: str(formData, "contractorSignatory"),
    contractorSignedOn: str(formData, "contractorSignedOn"),
  });
  if (!ok) return "review_date";
  backToProduct(projectId, productId, "review");
}

export async function newRevisionAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, productId } = await editableTarget(formData);
  const id = await newRevision(projectId, productId);
  if (!id) throw new Error("Give this revision its review status before starting a new one.");
  backToProduct(projectId, id);
}

// ---------- quantities ----------

function quantityInput(formData: FormData) {
  return { weightT: str(formData, "weightT"), volumeM3: str(formData, "volumeM3"), costSar: str(formData, "costSar") };
}

export async function saveBoqQuantitiesAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, productId, frozen } = await productTarget(formData);
  if (frozen) return "frozen";
  if (!(await saveBoqQuantities(projectId, productId, quantityInput(formData)))) return "boq_qty";
  backToProduct(projectId, productId, "quantities");
}

export async function addDeliveryAction(formData: FormData): Promise<FormErrorCode | null> {
  await requireUser();
  const { projectId, productId, frozen } = await productTarget(formData);
  if (frozen) return "frozen";
  const ok = await addDelivery(projectId, productId, {
    ...quantityInput(formData),
    deliveredOn: str(formData, "deliveredOn"),
    poNumber: str(formData, "poNumber"),
  });
  if (!ok) return "delivery";
  backToProduct(projectId, productId, "quantities");
}

export async function removeDeliveryAction(formData: FormData): Promise<void> {
  await requireUser();
  const { projectId, productId } = await editableTarget(formData);
  if (!(await removeDelivery(projectId, productId, str(formData, "deliveryId")))) throw new Error("That delivery is not on this product.");
  backToProduct(projectId, productId, "quantities");
}

// ---------- credit page ----------

export async function applyPartValueAction(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = await project(formData);
  const code = str(formData, "code");
  const which = str(formData, "which") === "actual" ? "actual" : "forecast";
  const written = await applyPartValue(projectId, code, str(formData, "part"), which);
  if (!written) throw new Error("No value to use yet: the share needs products with quantities.");
  revalidatePath(`/projects/${projectId}/credits/${encodeURIComponent(code)}`);
  redirect(`/projects/${projectId}/credits/${encodeURIComponent(code)}#material-review`);
}
