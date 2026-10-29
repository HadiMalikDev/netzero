import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { currentUser } from "@/lib/auth/session";
import { getProject } from "@/lib/data";
import { todayIso } from "@/lib/materials/expiry";
import { getProduct } from "@/lib/materials/products";
import { SmqSheet } from "@/lib/pdf/SmqSheet";
import { registerPdfHyphenation } from "@/lib/pdf/shared";
import { buildSmqSheet } from "@/lib/report/smq-sheet";
import { generatedAt, pdfResponse, slugify } from "@/lib/report/download";

// Registered here (the module that calls renderToBuffer); see registerPdfHyphenation.
registerPdfHyphenation();

/**
 * One product's filled SMQ as a PDF (Sprint 3, D22). getProject and
 * getProduct are scoped to the workspace and the project, so another
 * project's product is a 404.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]/materials/products/[productId]/pdf">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id, productId } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Project not found", { status: 404 });
  const view = await getProduct(id, productId);
  if (!view) return new Response("Product not found", { status: 404 });
  const model = buildSmqSheet({ view, projectName: project.name, generatedAt: generatedAt(), today: todayIso() });
  const buf = await renderToBuffer(SmqSheet({ model }));
  return pdfResponse(buf, `${slugify(view.submittal.ref)}-${slugify(view.product.name)}-rev${String(view.product.revision).padStart(2, "0")}-smq.pdf`);
}
