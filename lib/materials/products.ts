import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  evidenceDocs,
  materialAnswers,
  materialDeliveries,
  materialDocs,
  materialProductParts,
  materialProducts,
  materialProductTypes,
  materialSubmittals,
  type MaterialAnswer,
  type MaterialDelivery,
  type MaterialProduct,
  type MaterialSubmittal,
} from "@/db/schema";
import { WORKSPACE_ID } from "@/lib/catalog";
import { storeUpload } from "@/lib/uploads";
import { parseIsoDate, todayIso } from "./expiry";
import { PART_KEYS } from "./parts";
import { ensureProjectSmq, getSmq, type SmqView } from "./smq";

/**
 * Material submittals and their products (Sprint 3). A submittal (MTS / TBE)
 * holds products; each product is one SMQ: its header, the material types
 * picked for it, one answer per row shown, documents, quantities and the
 * consultant's review. A resubmission is a new revision of the product; the
 * one it replaces is frozen as it was reviewed (D9).
 */

export const STATUSES = ["A", "B", "C", "D"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  A: "Approved",
  B: "Approved as noted",
  C: "Revise and resubmit",
  D: "Rejected",
};
/** A and B count toward credits (D6). */
export const COUNTING = new Set<string>(["A", "B"]);

export function parseStatus(raw: unknown): Status | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return STATUSES.includes(s as Status) ? (s as Status) : null;
}

export const ANSWERS = ["yes", "no", "na"] as const;
export type Answer = (typeof ANSWERS)[number];
export function parseAnswer(raw: unknown): Answer | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return ANSWERS.includes(s as Answer) ? (s as Answer) : null;
}

export const SLOTS = ["submittal", "boq", "datasheet", "filled_smq"] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = {
  submittal: "Material submittal",
  boq: "BOQ line",
  datasheet: "Technical data sheet",
  filled_smq: "Filled SMQ (signed)",
};
export function parseSlot(raw: unknown): Slot | null {
  return SLOTS.includes(raw as Slot) ? (raw as Slot) : null;
}

/** "Rev 00", "Rev 01" … as on the client's submittals. */
export const revLabel = (n: number) => `Rev ${String(n).padStart(2, "0")}`;

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanLines = (s: unknown, max: number) =>
  String(s ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim()
    .slice(0, max);
const now = () => Math.floor(Date.now() / 1000);

// ---------- submittals ----------

export interface SubmittalInput {
  ref: string;
  title: string;
  discipline: string;
  supplier: string;
  submittedOn: string;
}

function submittalValues(input: SubmittalInput) {
  const ref = clean(input.ref, 120);
  const title = clean(input.title, 300);
  if (!ref || !title) return null;
  return {
    ref,
    title,
    discipline: clean(input.discipline, 80) || null,
    supplier: clean(input.supplier, 200) || null,
    submittedOn: parseIsoDate(input.submittedOn),
  };
}

export async function createSubmittal(projectId: string, input: SubmittalInput): Promise<string | null> {
  const v = submittalValues(input);
  if (!v) return null;
  const id = randomUUID();
  await db.insert(materialSubmittals).values({ id, workspaceId: WORKSPACE_ID, projectId, ...v });
  return id;
}

export async function updateSubmittal(projectId: string, submittalId: string, input: SubmittalInput): Promise<boolean> {
  const v = submittalValues(input);
  if (!v || !(await getSubmittalRow(projectId, submittalId))) return false;
  await db.update(materialSubmittals).set(v).where(eq(materialSubmittals.id, submittalId));
  return true;
}

export async function getSubmittalRow(projectId: string, submittalId: string): Promise<MaterialSubmittal | null> {
  const [s] = await db
    .select()
    .from(materialSubmittals)
    .where(
      and(
        eq(materialSubmittals.id, submittalId),
        eq(materialSubmittals.projectId, projectId),
        eq(materialSubmittals.workspaceId, WORKSPACE_ID),
      ),
    )
    .limit(1);
  return s ?? null;
}

/**
 * The day a revision starts to exist for the month views (YYYY-MM-DD): a first
 * revision from its submittal's date, since records are often entered after
 * the fact; a resubmission from the day it was entered.
 */
export function existsFrom(product: MaterialProduct, submittal: MaterialSubmittal): string {
  const entered = todayIso(new Date(product.createdAt * 1000));
  return product.revision === 0 && submittal.submittedOn && submittal.submittedOn < entered ? submittal.submittedOn : entered;
}

/** Which products have been replaced by a newer revision. */
function supersededIds(products: { id: string; previousRevisionId: string | null }[]): Set<string> {
  return new Set(products.map((p) => p.previousRevisionId).filter((x): x is string => Boolean(x)));
}

export interface ProductSummary extends MaterialProduct {
  /** False for a revision a newer one replaced: it stays as reviewed. */
  latest: boolean;
}

export interface SubmittalSummary extends MaterialSubmittal {
  products: ProductSummary[];
}

/** Every product of a project with its submittal, all revisions. */
export async function projectProducts(projectId: string): Promise<{ product: ProductSummary; submittal: MaterialSubmittal }[]> {
  const rows = await db
    .select({ product: materialProducts, submittal: materialSubmittals })
    .from(materialProducts)
    .innerJoin(materialSubmittals, eq(materialProducts.submittalId, materialSubmittals.id))
    .where(and(eq(materialSubmittals.projectId, projectId), eq(materialSubmittals.workspaceId, WORKSPACE_ID)))
    .orderBy(asc(materialProducts.createdAt));
  const replaced = supersededIds(rows.map((r) => r.product));
  return rows.map((r) => ({ submittal: r.submittal, product: { ...r.product, latest: !replaced.has(r.product.id) } }));
}

export async function listSubmittals(projectId: string): Promise<SubmittalSummary[]> {
  const subs = await db
    .select()
    .from(materialSubmittals)
    .where(and(eq(materialSubmittals.projectId, projectId), eq(materialSubmittals.workspaceId, WORKSPACE_ID)))
    .orderBy(desc(materialSubmittals.createdAt));
  const products = await projectProducts(projectId);
  return subs.map((s) => ({
    ...s,
    products: products.filter((p) => p.submittal.id === s.id).map((p) => p.product),
  }));
}

// ---------- products ----------

export interface ProductHeaderInput {
  name: string;
  locationOfUse: string;
  manufacturer: string;
  supplier: string;
  countryOfOrigin: string;
  contactName: string;
  contactMobile: string;
}

function headerValues(input: ProductHeaderInput) {
  const name = clean(input.name, 300);
  if (!name) return null;
  return {
    name,
    locationOfUse: clean(input.locationOfUse, 200) || null,
    manufacturer: clean(input.manufacturer, 200) || null,
    supplier: clean(input.supplier, 200) || null,
    countryOfOrigin: clean(input.countryOfOrigin, 120) || null,
    contactName: clean(input.contactName, 120) || null,
    contactMobile: clean(input.contactMobile, 60) || null,
  };
}

/** The product, if it belongs to this project. */
export async function getProductRow(projectId: string, productId: string): Promise<MaterialProduct | null> {
  const [r] = await db
    .select({ product: materialProducts })
    .from(materialProducts)
    .innerJoin(materialSubmittals, eq(materialProducts.submittalId, materialSubmittals.id))
    .where(
      and(
        eq(materialProducts.id, productId),
        eq(materialSubmittals.projectId, projectId),
        eq(materialProducts.workspaceId, WORKSPACE_ID),
      ),
    )
    .limit(1);
  return r?.product ?? null;
}

/** A revision some newer revision replaced. */
export async function isSuperseded(productId: string): Promise<boolean> {
  const [r] = await db
    .select({ id: materialProducts.id })
    .from(materialProducts)
    .where(eq(materialProducts.previousRevisionId, productId))
    .limit(1);
  return Boolean(r);
}

/** The product, if it is this project's and still editable (the latest revision). */
async function editableProduct(projectId: string, productId: string): Promise<MaterialProduct | null> {
  const p = await getProductRow(projectId, productId);
  if (!p || (await isSuperseded(p.id))) return null;
  return p;
}

/**
 * Answers for every active row of the given sections the product has not
 * answered yet, with the row copied in. Existing answers are left alone, so
 * re-picking a type brings its earlier answers back.
 */
async function ensureAnswers(productId: string, smq: SmqView, sectionIds: Set<string>) {
  const existing = await db
    .select({ rowId: materialAnswers.rowId })
    .from(materialAnswers)
    .where(eq(materialAnswers.productId, productId));
  const have = new Set(existing.map((a) => a.rowId));
  const values = smq.sections
    .filter((s) => sectionIds.has(s.id))
    .flatMap((s) =>
      s.rows
        .filter((r) => r.active && !have.has(r.id))
        .map((r) => ({
          id: randomUUID(),
          productId,
          rowId: r.id,
          sectionId: s.id,
          sectionHeading: s.heading,
          sectionKind: s.kind,
          sectionSeq: s.seq,
          seq: r.seq,
          text: r.text,
          leedRef: r.leedRef,
          creditCode: r.credit?.code ?? r.creditCode,
          projectCreditId: r.projectCreditId,
          kind: r.kind,
          note: r.note,
          targetText: r.targetText,
          unit: r.valueUnit,
        })),
    );
  if (values.length) await db.insert(materialAnswers).values(values).onConflictDoNothing();
}

/** A new product under the submittal, answering the "For all materials" block. */
export async function addProduct(projectId: string, submittalId: string, input: ProductHeaderInput): Promise<string | null> {
  const v = headerValues(input);
  if (!v || !(await getSubmittalRow(projectId, submittalId))) return null;
  const template = await ensureProjectSmq(projectId);
  const smq = template ? await getSmq(template.id) : null;
  if (!smq) return null;
  const id = randomUUID();
  await db.insert(materialProducts).values({ id, workspaceId: WORKSPACE_ID, submittalId, ...v });
  const all = smq.sections.filter((s) => s.kind === "all_materials");
  await ensureAnswers(id, smq, new Set(all.map((s) => s.id)));
  const parts = [...new Set(all.flatMap((s) => s.defaultParts))];
  if (parts.length) await db.insert(materialProductParts).values(parts.map((part) => ({ productId: id, part })));
  return id;
}

export async function saveProductHeader(projectId: string, productId: string, input: ProductHeaderInput): Promise<boolean> {
  const v = headerValues(input);
  if (!v || !(await editableProduct(projectId, productId))) return false;
  await db.update(materialProducts).set({ ...v, updatedAt: now() }).where(eq(materialProducts.id, productId));
  return true;
}

/**
 * Pick the product's material types (D12). Rows of newly picked types get
 * answers; a type's credit parts are ticked when it is picked and unticked
 * when it is dropped, unless another picked type also ticks them (D33). An
 * answer of a dropped type is kept, hidden.
 */
export async function setProductTypes(projectId: string, productId: string, sectionIds: string[]): Promise<boolean> {
  if (!(await editableProduct(projectId, productId))) return false;
  const template = await ensureProjectSmq(projectId);
  const smq = template ? await getSmq(template.id) : null;
  if (!smq) return false;
  const types = new Map(smq.sections.filter((s) => s.kind === "material_type").map((s) => [s.id, s]));
  const picked = new Set(sectionIds.filter((id) => types.get(id)?.active));
  const before = await db
    .select({ sectionId: materialProductTypes.sectionId })
    .from(materialProductTypes)
    .where(eq(materialProductTypes.productId, productId));
  const was = new Set(before.map((b) => b.sectionId));
  const added = [...picked].filter((id) => !was.has(id));
  const dropped = [...was].filter((id) => !picked.has(id));

  const keepParts = new Set([...picked].flatMap((id) => types.get(id)?.defaultParts ?? []));
  const addParts = new Set(added.flatMap((id) => types.get(id)?.defaultParts ?? []));
  const dropParts = dropped.flatMap((id) => types.get(id)?.defaultParts ?? []).filter((k) => !keepParts.has(k));

  await db.transaction(async (tx) => {
    if (dropped.length)
      await tx
        .delete(materialProductTypes)
        .where(and(eq(materialProductTypes.productId, productId), inArray(materialProductTypes.sectionId, dropped)));
    if (added.length) await tx.insert(materialProductTypes).values(added.map((sectionId) => ({ productId, sectionId })));
    if (dropParts.length)
      await tx
        .delete(materialProductParts)
        .where(and(eq(materialProductParts.productId, productId), inArray(materialProductParts.part, dropParts)));
    if (addParts.size)
      await tx
        .insert(materialProductParts)
        .values([...addParts].map((part) => ({ productId, part })))
        .onConflictDoNothing();
    await tx.update(materialProducts).set({ updatedAt: now() }).where(eq(materialProducts.id, productId));
  });
  await ensureAnswers(productId, smq, new Set(added));
  return true;
}

/** The reviewer's ticks (D33): which credit parts the product counts toward, and interior or not. */
export async function setProductParts(projectId: string, productId: string, parts: string[], interior: boolean): Promise<boolean> {
  if (!(await editableProduct(projectId, productId))) return false;
  const keys = [...new Set(parts.filter((k) => PART_KEYS.has(k)))];
  await db.transaction(async (tx) => {
    await tx.delete(materialProductParts).where(eq(materialProductParts.productId, productId));
    if (keys.length) await tx.insert(materialProductParts).values(keys.map((part) => ({ productId, part })));
    await tx.update(materialProducts).set({ interior, updatedAt: now() }).where(eq(materialProducts.id, productId));
  });
  return true;
}

export interface AnswerInput {
  answerId: string;
  answer: string;
  value: string;
  unit: string;
  remark: string;
}

export async function saveAnswers(projectId: string, productId: string, inputs: AnswerInput[]): Promise<boolean> {
  if (!(await editableProduct(projectId, productId))) return false;
  const own = await db
    .select({ id: materialAnswers.id })
    .from(materialAnswers)
    .where(eq(materialAnswers.productId, productId));
  const ids = new Set(own.map((a) => a.id));
  await db.transaction(async (tx) => {
    for (const i of inputs) {
      if (!ids.has(i.answerId)) continue;
      await tx
        .update(materialAnswers)
        .set({
          answer: parseAnswer(i.answer),
          value: clean(i.value, 200) || null,
          unit: clean(i.unit, 40) || null,
          remark: cleanLines(i.remark, 2000) || null,
        })
        .where(eq(materialAnswers.id, i.answerId));
    }
    await tx.update(materialProducts).set({ updatedAt: now() }).where(eq(materialProducts.id, productId));
  });
  return true;
}

export interface ReviewInput {
  status: string;
  reviewedOn: string;
  reviewer: string;
  applicable: string;
  remarks: string;
  manufacturerSignatory: string;
  manufacturerSignedOn: string;
  contractorSignatory: string;
  contractorSignedOn: string;
}

/**
 * The consultant's review. A status needs a review date: the date puts the
 * review in a month (D26). Clearing the status takes the product back to
 * "under review".
 */
export async function saveReview(projectId: string, productId: string, input: ReviewInput): Promise<boolean> {
  if (!(await editableProduct(projectId, productId))) return false;
  const status = parseStatus(input.status);
  const reviewedOn = parseIsoDate(input.reviewedOn);
  if (status && !reviewedOn) return false;
  await db
    .update(materialProducts)
    .set({
      status,
      reviewedOn: status ? reviewedOn : null,
      reviewer: clean(input.reviewer, 120) || null,
      applicable: input.applicable === "yes" ? true : input.applicable === "no" ? false : null,
      remarks: cleanLines(input.remarks, 4000) || null,
      manufacturerSignatory: clean(input.manufacturerSignatory, 120) || null,
      manufacturerSignedOn: parseIsoDate(input.manufacturerSignedOn),
      contractorSignatory: clean(input.contractorSignatory, 120) || null,
      contractorSignedOn: parseIsoDate(input.contractorSignedOn),
      updatedAt: now(),
    })
    .where(eq(materialProducts.id, productId));
  return true;
}

// ---------- quantities ----------

export interface QuantityInput {
  weightT: string;
  volumeM3: string;
  costSar: string;
}

/** "" = not entered; otherwise a non-negative number (thousands commas allowed). undefined = invalid. */
export function parseQuantity(raw: string): number | null | undefined {
  const t = raw.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function quantities(input: QuantityInput) {
  const weightT = parseQuantity(input.weightT);
  const volumeM3 = parseQuantity(input.volumeM3);
  const costSar = parseQuantity(input.costSar);
  if (weightT === undefined || volumeM3 === undefined || costSar === undefined) return null;
  return { weightT, volumeM3, costSar };
}

/** The BOQ quantities: the forecast (D13), in t, m³ and SAR (D25). */
export async function saveBoqQuantities(projectId: string, productId: string, input: QuantityInput): Promise<boolean> {
  const q = quantities(input);
  if (!q || !(await editableProduct(projectId, productId))) return false;
  await db
    .update(materialProducts)
    .set({ boqWeightT: q.weightT, boqVolumeM3: q.volumeM3, boqCostSar: q.costSar, updatedAt: now() })
    .where(eq(materialProducts.id, productId));
  return true;
}

/** One delivery: the actual (D13). Needs a date and at least one quantity. */
export async function addDelivery(
  projectId: string,
  productId: string,
  input: QuantityInput & { deliveredOn: string; poNumber: string },
): Promise<boolean> {
  const q = quantities(input);
  const deliveredOn = parseIsoDate(input.deliveredOn);
  if (!q || !deliveredOn || (q.weightT == null && q.volumeM3 == null && q.costSar == null)) return false;
  if (!(await editableProduct(projectId, productId))) return false;
  await db.insert(materialDeliveries).values({
    id: randomUUID(),
    productId,
    deliveredOn,
    poNumber: clean(input.poNumber, 120) || null,
    ...q,
  });
  return true;
}

export async function removeDelivery(projectId: string, productId: string, deliveryId: string): Promise<boolean> {
  if (!(await editableProduct(projectId, productId))) return false;
  const gone = await db
    .delete(materialDeliveries)
    .where(and(eq(materialDeliveries.id, deliveryId), eq(materialDeliveries.productId, productId)))
    .returning({ id: materialDeliveries.id });
  return gone.length > 0;
}

// ---------- documents ----------

/**
 * Attach a file to one answer's row (an issue date is required, D27) or to
 * one of the product's slots (the date is optional there: a BOQ line has
 * none). Returns an error message, or null when stored.
 */
export async function attachMaterialDoc(
  projectId: string,
  productId: string,
  file: File,
  target: { answerId: string } | { slot: Slot | null },
  issuedOnRaw: string,
): Promise<string | null> {
  if (!(await editableProduct(projectId, productId))) return "This revision can no longer be changed.";
  if (!(file instanceof File) || file.size === 0) return "No file was sent.";
  const issuedOn = parseIsoDate(issuedOnRaw);
  let answerId: string | null = null;
  let slot: Slot | null = null;
  if ("answerId" in target) {
    const [a] = await db
      .select({ id: materialAnswers.id })
      .from(materialAnswers)
      .where(and(eq(materialAnswers.id, target.answerId), eq(materialAnswers.productId, productId)))
      .limit(1);
    if (!a) return "That row is not on this product.";
    if (!issuedOn) return "Enter the date the certificate or report was issued.";
    answerId = a.id;
  } else {
    slot = target.slot;
    if (issuedOnRaw.trim() && !issuedOn) return "The issue date is not a valid date.";
  }
  const { id, filePath, size } = await storeUpload(file, projectId);
  await db.insert(evidenceDocs).values({
    id,
    workspaceId: WORKSPACE_ID,
    projectCreditId: null,
    materialProductId: productId,
    issuedOn,
    fileName: file.name,
    filePath,
    fileSize: size,
  });
  await db.insert(materialDocs).values({ id: randomUUID(), productId, answerId, slot, evidenceDocId: id });
  await db.update(materialProducts).set({ updatedAt: now() }).where(eq(materialProducts.id, productId));
  return null;
}

/**
 * Remove a file from the product. The link goes; the file itself goes only
 * when no other revision still links it.
 */
export async function removeMaterialDoc(projectId: string, productId: string, materialDocId: string): Promise<boolean> {
  if (!(await editableProduct(projectId, productId))) return false;
  const [link] = await db
    .select()
    .from(materialDocs)
    .where(and(eq(materialDocs.id, materialDocId), eq(materialDocs.productId, productId)))
    .limit(1);
  if (!link) return false;
  await db.delete(materialDocs).where(eq(materialDocs.id, link.id));
  const [{ left }] = await db
    .select({ left: sql<number>`count(*)` })
    .from(materialDocs)
    .where(eq(materialDocs.evidenceDocId, link.evidenceDocId));
  if (Number(left) === 0) {
    const [doc] = await db.select().from(evidenceDocs).where(eq(evidenceDocs.id, link.evidenceDocId)).limit(1);
    await db.delete(evidenceDocs).where(eq(evidenceDocs.id, link.evidenceDocId));
    if (doc) await rm(doc.filePath, { force: true });
  }
  return true;
}

// ---------- revisions ----------

/**
 * Resubmission (D9): Rev n+1 starts as a copy of Rev n (header, types, ticks,
 * answers, document links, quantities, deliveries) without its review. Rev n
 * is frozen from then on. Only a reviewed latest revision can be resubmitted.
 */
export async function newRevision(projectId: string, productId: string): Promise<string | null> {
  const p = await editableProduct(projectId, productId);
  if (!p || !p.status) return null;
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(materialProducts).values({
      ...p,
      id,
      createdAt: now(),
      updatedAt: now(),
      revision: p.revision + 1,
      previousRevisionId: p.id,
      status: null,
      reviewedOn: null,
      reviewer: null,
      applicable: null,
      remarks: null,
    });
    const types = await tx.select().from(materialProductTypes).where(eq(materialProductTypes.productId, p.id));
    if (types.length) await tx.insert(materialProductTypes).values(types.map((t) => ({ productId: id, sectionId: t.sectionId })));
    const parts = await tx.select().from(materialProductParts).where(eq(materialProductParts.productId, p.id));
    if (parts.length) await tx.insert(materialProductParts).values(parts.map((t) => ({ productId: id, part: t.part })));
    const answers = await tx.select().from(materialAnswers).where(eq(materialAnswers.productId, p.id));
    const newAnswerId = new Map(answers.map((a) => [a.id, randomUUID()]));
    if (answers.length)
      await tx.insert(materialAnswers).values(answers.map((a) => ({ ...a, id: newAnswerId.get(a.id)!, productId: id })));
    const docs = await tx.select().from(materialDocs).where(eq(materialDocs.productId, p.id));
    if (docs.length)
      await tx.insert(materialDocs).values(
        docs.map((d) => ({
          id: randomUUID(),
          productId: id,
          answerId: d.answerId ? newAnswerId.get(d.answerId)! : null,
          slot: d.slot,
          evidenceDocId: d.evidenceDocId,
        })),
      );
    const deliveries = await tx.select().from(materialDeliveries).where(eq(materialDeliveries.productId, p.id));
    if (deliveries.length)
      await tx
        .insert(materialDeliveries)
        .values(deliveries.map((d) => ({ ...d, id: randomUUID(), productId: id, createdAt: now() })));
  });
  return id;
}

// ---------- reading one product ----------

export interface MaterialDocView {
  linkId: string;
  docId: string;
  fileName: string;
  fileSize: number | null;
  issuedOn: string | null;
  slot: string | null;
  answerId: string | null;
}

export interface AnswerView extends MaterialAnswer {
  docs: MaterialDocView[];
}

export interface AnswerSection {
  sectionId: string | null;
  heading: string;
  kind: string;
  answers: AnswerView[];
}

export interface ProductView {
  product: MaterialProduct;
  submittal: MaterialSubmittal;
  /** False once a newer revision exists: nothing can change. */
  latest: boolean;
  smq: SmqView;
  typeIds: string[];
  parts: string[];
  /** The answers shown: "For all materials" plus the picked types, in order. */
  sections: AnswerSection[];
  /** Product-level files (named slots and extras). */
  docs: MaterialDocView[];
  deliveries: MaterialDelivery[];
  /** Every revision of this product, oldest first. */
  revisions: { id: string; revision: number; status: string | null; reviewedOn: string | null }[];
}

/** All revisions in the chain the product belongs to, oldest first. */
async function revisionChain(p: MaterialProduct) {
  const siblings = await db
    .select({ id: materialProducts.id, revision: materialProducts.revision, status: materialProducts.status, reviewedOn: materialProducts.reviewedOn, previousRevisionId: materialProducts.previousRevisionId })
    .from(materialProducts)
    .where(eq(materialProducts.submittalId, p.submittalId));
  const byId = new Map(siblings.map((s) => [s.id, s]));
  const next = new Map(siblings.filter((s) => s.previousRevisionId).map((s) => [s.previousRevisionId!, s]));
  let first = byId.get(p.id)!;
  while (first.previousRevisionId && byId.get(first.previousRevisionId)) first = byId.get(first.previousRevisionId)!;
  const chain = [first];
  while (next.get(chain[chain.length - 1].id)) chain.push(next.get(chain[chain.length - 1].id)!);
  return chain.map((c) => ({ id: c.id, revision: c.revision, status: c.status, reviewedOn: c.reviewedOn }));
}

export async function getProduct(projectId: string, productId: string): Promise<ProductView | null> {
  const product = await getProductRow(projectId, productId);
  if (!product) return null;
  const submittal = (await getSubmittalRow(projectId, product.submittalId))!;
  const template = await ensureProjectSmq(projectId);
  const smq = template ? await getSmq(template.id) : null;
  if (!smq) return null;
  const [types, parts, answers, links, deliveries, latest, revisions] = await Promise.all([
    db.select().from(materialProductTypes).where(eq(materialProductTypes.productId, productId)),
    db.select().from(materialProductParts).where(eq(materialProductParts.productId, productId)),
    db.select().from(materialAnswers).where(eq(materialAnswers.productId, productId)),
    db
      .select({
        linkId: materialDocs.id,
        docId: evidenceDocs.id,
        fileName: evidenceDocs.fileName,
        fileSize: evidenceDocs.fileSize,
        issuedOn: evidenceDocs.issuedOn,
        slot: materialDocs.slot,
        answerId: materialDocs.answerId,
      })
      .from(materialDocs)
      .innerJoin(evidenceDocs, eq(materialDocs.evidenceDocId, evidenceDocs.id))
      .where(eq(materialDocs.productId, productId))
      .orderBy(asc(materialDocs.createdAt)),
    db
      .select()
      .from(materialDeliveries)
      .where(eq(materialDeliveries.productId, productId))
      .orderBy(asc(materialDeliveries.deliveredOn), asc(materialDeliveries.createdAt)),
    isSuperseded(productId).then((s) => !s),
    revisionChain(product),
  ]);
  const typeIds = types.map((t) => t.sectionId);
  const shown = new Set(typeIds);
  const visible = answers.filter((a) => a.sectionKind === "all_materials" || (a.sectionId && shown.has(a.sectionId)));
  const sections = new Map<string, AnswerSection>();
  for (const a of [...visible].sort((x, y) => x.sectionSeq - y.sectionSeq || x.seq - y.seq)) {
    const key = a.sectionId ?? `gone:${a.sectionHeading}`;
    const s = sections.get(key) ?? { sectionId: a.sectionId, heading: a.sectionHeading, kind: a.sectionKind, answers: [] };
    s.answers.push({ ...a, docs: links.filter((l) => l.answerId === a.id) });
    sections.set(key, s);
  }
  return {
    product,
    submittal,
    latest,
    smq,
    typeIds,
    parts: parts.map((p) => p.part),
    sections: [...sections.values()],
    docs: links.filter((l) => !l.answerId),
    deliveries,
    revisions,
  };
}

/** Answers per product for a set of products (for the credit maths and reports). */
export async function answersFor(productIds: string[]) {
  if (!productIds.length) return [];
  return db.select().from(materialAnswers).where(inArray(materialAnswers.productId, productIds));
}
