import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  evidenceDocs,
  materialAnswers,
  materialDeliveries,
  materialDocs,
  materialProductParts,
  materialProductTypes,
} from "@/db/schema";
import { computeParts, type PartResult, type Snapshot, type SnapshotProduct } from "./credits";
import { existsFrom, projectProducts } from "./products";
import { ensureProjectSmq } from "./smq";

/**
 * Read a project's material reviews into the snapshot the credit maths works
 * on (lib/materials/credits.ts). One query per table, whatever the number of
 * products.
 */
export async function loadSnapshot(projectId: string): Promise<Snapshot> {
  const template = await ensureProjectSmq(projectId);
  const rows = await projectProducts(projectId);
  const ids = rows.map((r) => r.product.id);
  const [parts, types, answers, docs, deliveries] = ids.length
    ? await Promise.all([
        db.select().from(materialProductParts).where(inArray(materialProductParts.productId, ids)),
        db.select().from(materialProductTypes).where(inArray(materialProductTypes.productId, ids)),
        db.select().from(materialAnswers).where(inArray(materialAnswers.productId, ids)),
        db
          .select({ answerId: materialDocs.answerId, issuedOn: evidenceDocs.issuedOn })
          .from(materialDocs)
          .innerJoin(evidenceDocs, eq(materialDocs.evidenceDocId, evidenceDocs.id))
          .where(inArray(materialDocs.productId, ids)),
        db.select().from(materialDeliveries).where(inArray(materialDeliveries.productId, ids)),
      ])
    : [[], [], [], [], []];

  const byProduct = <T extends { productId: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(x.productId, [...(m.get(x.productId) ?? []), x]);
    return m;
  };
  const partsBy = byProduct(parts);
  const typesBy = byProduct(types);
  const answersBy = byProduct(answers);
  const deliveriesBy = byProduct(deliveries);
  const docsBy = new Map<string, { issuedOn: string | null }[]>();
  for (const d of docs) if (d.answerId) docsBy.set(d.answerId, [...(docsBy.get(d.answerId) ?? []), { issuedOn: d.issuedOn }]);

  // Chains: follow previousRevisionId back to the first revision.
  const byId = new Map(rows.map((r) => [r.product.id, r]));
  const rootOf = (id: string): string => {
    let cur = byId.get(id)!;
    while (cur.product.previousRevisionId && byId.has(cur.product.previousRevisionId)) cur = byId.get(cur.product.previousRevisionId)!;
    return cur.product.id;
  };
  const chains = new Map<string, typeof rows>();
  for (const r of rows) {
    const root = rootOf(r.product.id);
    chains.set(root, [...(chains.get(root) ?? []), r]);
  }

  const products: SnapshotProduct[] = [...chains.entries()].map(([key, chain]) => {
    const ordered = [...chain].sort((a, b) => a.product.revision - b.product.revision);
    const latest = ordered[ordered.length - 1];
    return {
      key,
      name: latest.product.name,
      submittalRef: latest.submittal.ref,
      revisions: ordered.map(({ product: p, submittal }) => {
        // Answers of a type the product no longer has are hidden, and don't count.
        const shown = new Set((typesBy.get(p.id) ?? []).map((t) => t.sectionId));
        return {
          id: p.id,
          revision: p.revision,
          status: p.status,
          reviewedOn: p.reviewedOn,
          createdOn: existsFrom(p, submittal),
          interior: p.interior,
          parts: (partsBy.get(p.id) ?? []).map((x) => x.part),
          boq: { weightT: p.boqWeightT, volumeM3: p.boqVolumeM3, costSar: p.boqCostSar },
          answers: (answersBy.get(p.id) ?? [])
            .filter((a) => a.sectionKind === "all_materials" || (a.sectionId && shown.has(a.sectionId)))
            .map((a) => ({
              creditCode: a.creditCode,
              linked: Boolean(a.projectCreditId),
              answer: a.answer,
              text: a.text,
              docs: docsBy.get(a.id) ?? [],
            })),
        };
      }),
      deliveries: (deliveriesBy.get(latest.product.id) ?? []).map((d) => ({
        deliveredOn: d.deliveredOn,
        weightT: d.weightT,
        volumeM3: d.volumeM3,
        costSar: d.costSar,
      })),
    };
  });

  return {
    expiryYears: template?.expiryYears ?? 3,
    boqMaterialCostSar: template?.boqMaterialCostSar ?? null,
    products,
  };
}

export async function creditProgress(projectId: string, month: string, creditCode?: string): Promise<PartResult[]> {
  return computeParts(await loadSnapshot(projectId), month, creditCode);
}
