import { eq } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocs, materialDocs } from "@/db/schema";
import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import { extractDocumentText } from "@/lib/ai/evidence-review";
import { getProductRow, saveProductHeader, setProductTypes } from "@/lib/materials/products";
import { ensureProjectSmq, getSmq } from "@/lib/materials/smq";

/**
 * Fill an uploaded product's information from its files (client review
 * Rev 01, D46): name, location of use, manufacturer, supplier, country of
 * origin, the submittal reference, and its material types. The model only
 * reads; every value is checked here, types must be ones the project's
 * questionnaire has, and the reviewer checks the result on the product page.
 */

export interface HeaderReading {
  submittalRef: string;
  name: string;
  locationOfUse: string;
  manufacturer: string;
  supplier: string;
  countryOfOrigin: string;
  typeIds: string[];
}

const FIELDS = ["submittalRef", "name", "locationOfUse", "manufacturer", "supplier", "countryOfOrigin"] as const;
// Enough for a data sheet's first pages and the SMQ header; keeps one call cheap.
const MAX_CHARS = 16000;

const SYSTEM = `You read a construction material submittal: data sheets, a BOQ extract and a Sustainability Material Questionnaire (SMQ). Return a JSON object with these keys:
- "submittalRef": the submittal reference number (e.g. "JCD-OCN-MBL-PRO-MTS-0411"), from the SMQ's "Submittal Ref. No".
- "name": the product's name as the manufacturer gives it (the SMQ's "Material Subject").
- "locationOfUse": where it is used in the project (SMQ "Location of use").
- "manufacturer", "supplier", "countryOfOrigin": as stated.
- "materialTypes": the material types this product is, chosen ONLY from the list you are given, copied exactly. Empty array if none fit.
Use only what the documents state. Use "" for anything not stated. Never guess.`;

/** Coerce the model's answer into checked values; types not on the list are dropped. */
export function normalizeHeader(raw: unknown, types: { id: string; heading: string }[]): HeaderReading {
  const o = (raw ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 200) : "");
  const byHeading = new Map(types.map((t) => [t.heading.trim().toLowerCase(), t.id]));
  const picked = Array.isArray(o.materialTypes) ? o.materialTypes : [];
  const typeIds = [...new Set(picked.map((h) => byHeading.get(text(h).toLowerCase())).filter((id): id is string => Boolean(id)))];
  const out = { typeIds } as HeaderReading;
  for (const f of FIELDS) out[f] = text(o[f]);
  return out;
}

/** The text of a product's uploaded files, each labelled with its slot and name. */
async function productText(productId: string): Promise<string> {
  const docs = await db
    .select({ slot: materialDocs.slot, fileName: evidenceDocs.fileName, filePath: evidenceDocs.filePath })
    .from(materialDocs)
    .innerJoin(evidenceDocs, eq(materialDocs.evidenceDocId, evidenceDocs.id))
    .where(eq(materialDocs.productId, productId));
  let out = "";
  for (const d of docs) {
    if (out.length >= MAX_CHARS) break;
    const text = await extractDocumentText(d.filePath, d.fileName);
    if (text) out += `\n\n=== ${d.slot ?? "attachment"}: ${d.fileName} ===\n${text}`;
  }
  return out.slice(0, MAX_CHARS);
}

/**
 * Read the product's files and fill the information still empty (the name
 * only while it is the placeholder taken from a file name). Null when there
 * is no model, no readable text, or the model fails; the product is then
 * left as uploaded.
 */
export async function fillProductFromFiles(projectId: string, productId: string, placeholderName: string): Promise<HeaderReading | null> {
  if (!hasLLM()) return null;
  const [product, template] = await Promise.all([getProductRow(projectId, productId), ensureProjectSmq(projectId)]);
  const smq = template ? await getSmq(template.id) : null;
  if (!product || !smq) return null;
  const text = await productText(productId);
  if (!text.trim()) return null;
  const types = smq.sections.filter((s) => s.kind === "material_type" && s.active).map((s) => ({ id: s.id, heading: s.heading }));
  let reading: HeaderReading;
  try {
    const raw = await chatJSON(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Material types to choose from:\n${types.map((t) => `- ${t.heading}`).join("\n")}\n\nDocuments:${text}` },
      ],
      { maxTokens: 600, signal: AbortSignal.timeout(60_000) },
    );
    reading = normalizeHeader(raw, types);
  } catch {
    return null;
  }
  const keep = (now: string | null, read: string) => now?.trim() || read;
  await saveProductHeader(projectId, productId, {
    name: product.name === placeholderName && reading.name ? reading.name : product.name,
    locationOfUse: keep(product.locationOfUse, reading.locationOfUse),
    manufacturer: keep(product.manufacturer, reading.manufacturer),
    supplier: keep(product.supplier, reading.supplier),
    countryOfOrigin: keep(product.countryOfOrigin, reading.countryOfOrigin),
    contactName: product.contactName ?? "",
    contactMobile: product.contactMobile ?? "",
  });
  if (reading.typeIds.length) await setProductTypes(projectId, productId, reading.typeIds);
  return reading;
}
