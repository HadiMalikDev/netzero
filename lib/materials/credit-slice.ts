import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { evidenceDocs, materialAnswers, materialDocs, materialProductTypes } from "@/db/schema";
import { computeParts, type PartResult } from "./credits";
import { todayIso } from "./expiry";
import { monthSummaries } from "./months";
import { projectProducts, type ProductSummary } from "./products";
import { loadSnapshot } from "./progress";
import type { MaterialSubmittal } from "@/db/schema";

/**
 * What the material reviews put on one credit (D8): for every product whose
 * questionnaire has rows linked to this credit, those rows' answers, values
 * and documents, grouped by the month the product was reviewed. For the
 * calculated credits, the parts' percentages now and month by month.
 */

export interface SliceAnswer {
  id: string;
  text: string;
  answer: string | null;
  value: string | null;
  unit: string | null;
  remark: string | null;
  targetText: string | null;
  docs: { docId: string; fileName: string; issuedOn: string | null }[];
}

export interface SliceProduct {
  product: ProductSummary;
  submittal: MaterialSubmittal;
  answers: SliceAnswer[];
}

export interface SliceMonth {
  /** YYYY-MM, or null for products not reviewed yet. */
  month: string | null;
  products: SliceProduct[];
}

export interface CreditSlice {
  months: SliceMonth[];
  parts: PartResult[];
  /** Month by month, newest first: each calculated part's shares at the month's end. */
  history: { month: string; parts: PartResult[] }[];
}

export async function creditSlice(projectId: string, projectCreditId: string, creditCode: string, today = todayIso()): Promise<CreditSlice> {
  const rows = await projectProducts(projectId);
  const ids = rows.map((r) => r.product.id);
  const answers = ids.length
    ? await db
        .select()
        .from(materialAnswers)
        .where(and(inArray(materialAnswers.productId, ids), eq(materialAnswers.projectCreditId, projectCreditId)))
    : [];
  const withAnswers = [...new Set(answers.map((a) => a.productId))];
  const [types, docs] = withAnswers.length
    ? await Promise.all([
        db.select().from(materialProductTypes).where(inArray(materialProductTypes.productId, withAnswers)),
        db
          .select({ answerId: materialDocs.answerId, docId: evidenceDocs.id, fileName: evidenceDocs.fileName, issuedOn: evidenceDocs.issuedOn })
          .from(materialDocs)
          .innerJoin(evidenceDocs, eq(materialDocs.evidenceDocId, evidenceDocs.id))
          .where(inArray(materialDocs.productId, withAnswers)),
      ])
    : [[], []];
  const shown = new Set(types.map((t) => `${t.productId}:${t.sectionId}`));

  const products: SliceProduct[] = [];
  for (const r of rows) {
    const mine = answers
      .filter((a) => a.productId === r.product.id)
      // Rows of a material type the product no longer has are hidden.
      .filter((a) => a.sectionKind === "all_materials" || shown.has(`${a.productId}:${a.sectionId}`))
      .sort((a, b) => a.sectionSeq - b.sectionSeq || a.seq - b.seq);
    if (!mine.length) continue;
    // A product not reviewed yet shows only as its latest revision.
    if (!r.product.reviewedOn && !r.product.latest) continue;
    products.push({
      product: r.product,
      submittal: r.submittal,
      answers: mine.map((a) => ({
        id: a.id,
        text: a.text,
        answer: a.answer,
        value: a.value,
        unit: a.unit,
        remark: a.remark,
        targetText: a.targetText,
        docs: docs.filter((d) => d.answerId === a.id).map((d) => ({ docId: d.docId, fileName: d.fileName, issuedOn: d.issuedOn })),
      })),
    });
  }

  const byMonth = new Map<string | null, SliceProduct[]>();
  for (const p of products) {
    const m = p.product.reviewedOn ? p.product.reviewedOn.slice(0, 7) : null;
    byMonth.set(m, [...(byMonth.get(m) ?? []), p]);
  }
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a < b ? 1 : -1))
    .map(([month, ps]) => ({ month, products: ps }));

  const snap = await loadSnapshot(projectId);
  const parts = computeParts(snap, today.slice(0, 7), creditCode);
  const history = parts.length
    ? (await monthSummaries(projectId, today)).map((m) => ({ month: m.month, parts: computeParts(snap, m.month, creditCode) }))
    : [];
  return { months, parts, history };
}
