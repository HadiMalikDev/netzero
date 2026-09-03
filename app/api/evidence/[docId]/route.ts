import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { evidenceDocs } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";

/**
 * Serves one uploaded evidence file, so an attachment listed under a credit can
 * actually be opened. Nothing else in the app returns a stored evidence file.
 *
 * Node runtime + dynamic: reads from the local upload directory per request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Content types we are willing to render inline. Anything else downloads, so an
 * uploaded .html or .svg can never execute against this origin.
 */
const INLINE_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/evidence/[docId]">,
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { docId } = await ctx.params;

  const [doc] = await db
    .select()
    .from(evidenceDocs)
    .where(
      and(
        eq(evidenceDocs.id, docId),
        // Scope to the caller's workspace, not just the id.
        eq(evidenceDocs.workspaceId, user.workspaceId),
      ),
    )
    .limit(1);

  if (!doc) return new Response("Not found", { status: 404 });

  const ext = extname(doc.fileName).toLowerCase();
  const inlineType = INLINE_TYPES[ext];
  // Quote-strip and drop any path segments a crafted upload name might carry.
  const safeName = basename(doc.fileName).replace(/["\\\r\n]/g, "");

  try {
    const buf = await readFile(doc.filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": inlineType ?? "application/octet-stream",
        "Content-Disposition": `${
          inlineType ? "inline" : "attachment"
        }; filename="${safeName}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Evidence file missing on disk", { status: 410 });
  }
}
