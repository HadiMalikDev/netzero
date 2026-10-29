import { eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { evidenceDocs, materialDeliveries, materialDocs, materialProductTypes } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { getVersion } from "@/lib/catalog";
import { getProject } from "@/lib/data";
import { buildMaterialTracker } from "@/lib/export/material-tracker";
import { computeParts } from "@/lib/materials/credits";
import { todayIso } from "@/lib/materials/expiry";
import { answersFor, projectProducts } from "@/lib/materials/products";
import { loadSnapshot } from "@/lib/materials/progress";
import { slugify } from "@/lib/report/download";

/**
 * Downloads the project's Sustainability Material Tracker (Sprint 3, D22).
 * Workspace-scoped through getProject and projectProducts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]/materials/tracker">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Project not found", { status: 404 });

  const products = await projectProducts(id);
  const ids = products.map((p) => p.product.id);
  const [allAnswers, types, docs, deliveries, snap] = await Promise.all([
    answersFor(ids),
    ids.length ? db.select().from(materialProductTypes).where(inArray(materialProductTypes.productId, ids)) : [],
    ids.length
      ? db
          .select({ answerId: materialDocs.answerId, fileName: evidenceDocs.fileName, issuedOn: evidenceDocs.issuedOn })
          .from(materialDocs)
          .innerJoin(evidenceDocs, eq(materialDocs.evidenceDocId, evidenceDocs.id))
          .where(inArray(materialDocs.productId, ids))
      : [],
    ids.length ? db.select().from(materialDeliveries).where(inArray(materialDeliveries.productId, ids)) : [],
    loadSnapshot(id),
  ]);
  // Answers of a material type a product no longer has stay hidden, as on screen.
  const shown = new Set(types.map((t) => `${t.productId}:${t.sectionId}`));
  const answers = allAnswers.filter((a) => a.sectionKind === "all_materials" || shown.has(`${a.productId}:${a.sectionId}`));
  const month = todayIso().slice(0, 7);
  const v = project.rsVersionId ? await getVersion(project.rsVersionId) : null;
  const wb = buildMaterialTracker({
    projectName: project.name,
    ratingSystem: v ? `${v.ratingSystemName} ${v.version.scheme} ${v.version.stage} (${v.version.versionLabel})` : "—",
    month,
    generatedAt: new Date(),
    products,
    answers,
    docs,
    deliveries,
    parts: computeParts(snap, month),
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slugify(project.name) || "project"}-material-tracker.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
