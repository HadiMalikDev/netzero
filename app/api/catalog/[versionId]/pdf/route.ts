import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { currentUser } from "@/lib/auth/session";
import { getVersionForExport } from "@/lib/catalog";
import { CatalogReport, registerPdfHyphenation } from "@/lib/pdf/CatalogReport";

// Registered here (the module that calls renderToBuffer) so the long-token
// wrapping actually applies. See registerPdfHyphenation's note.
registerPdfHyphenation();

/**
 * Generates the catalog extraction-review PDF for one rs_version and returns it
 * as a download. A third party reads it alongside the original manual (served by
 * /api/manual/[versionId]) to verify the extraction. Node runtime + dynamic:
 * @react-pdf/renderer needs Node APIs and the content is per-request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/catalog/[versionId]/pdf">,
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { versionId } = await ctx.params;
  const data = await getVersionForExport(versionId);
  if (!data) return new Response("Catalog version not found", { status: 404 });

  const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  const buf = await renderToBuffer(
    CatalogReport({ data, generatedAt }),
  );

  const name = slugify(
    `${data.ratingSystemName}-${data.version.scheme}-${data.version.stage}-${data.version.versionLabel}`,
  );
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}-catalog-review.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
