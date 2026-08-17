import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { sourceDocuments } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";

/**
 * Serves a rating-system version's source manual PDF inline, so requirement
 * rows can link to "View in manual · p.N" (the browser PDF viewer honours the
 * client-side #page=N fragment). Resolved via source_document.rsVersionId, since
 * rs_version.sourceDocumentId is null on uploads.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/manual/[versionId]">,
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { versionId } = await ctx.params;

  // Prefer a promoted document; fall back to any parsed one for this version.
  const [doc] =
    (await db
      .select()
      .from(sourceDocuments)
      .where(
        and(
          eq(sourceDocuments.rsVersionId, versionId),
          eq(sourceDocuments.status, "promoted"),
        ),
      )
      .limit(1)) ??
    [];
  const resolved =
    doc ??
    (
      await db
        .select()
        .from(sourceDocuments)
        .where(eq(sourceDocuments.rsVersionId, versionId))
        .limit(1)
    )[0];

  if (!resolved) return new Response("Manual not found", { status: 404 });

  try {
    const buf = await readFile(resolved.filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${resolved.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Manual file missing on disk", { status: 410 });
  }
}
