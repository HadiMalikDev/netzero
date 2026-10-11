import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { evidenceDocs } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { getVersion } from "@/lib/catalog";
import { getCreditByCode, getProject } from "@/lib/data";
import { parseStage } from "@/lib/evidence";
import { ChecklistReport, type ImageBytes } from "@/lib/pdf/ChecklistReport";
import { registerPdfHyphenation } from "@/lib/pdf/shared";
import { buildChecklist } from "@/lib/report/checklist";

// Registered here (the module that calls renderToBuffer) so the long-token
// wrapping actually applies. See registerPdfHyphenation's note.
registerPdfHyphenation();

/**
 * Downloads one credit's compliance checklist as a PDF, generated from the
 * project's current state (Sprint 2 item 1). getProject is workspace-scoped,
 * so a project id from another workspace is a 404, not a leak. Node runtime +
 * dynamic: @react-pdf needs Node APIs, image files are read from disk, and the
 * content is per-request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Images above this are listed by name rather than embedded; one page should not weigh 50 MB. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * What the bytes actually are, whatever the file is called. @react-pdf draws
 * nothing (silently) for bytes it cannot decode, so a mislabelled or corrupt
 * upload must be caught here and listed as unreadable instead.
 */
function sniffImage(data: Buffer): "png" | "jpg" | null {
  if (data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
    return "png";
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatGeneratedAt(d: Date): string {
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
    timeZoneName: "short",
  });
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/credits/[code]/checklist">,
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id, code } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Project not found", { status: 404 });
  const credit = await getCreditByCode(id, decodeURIComponent(code));
  if (!credit) return new Response("Credit not found", { status: 404 });

  const v = project.rsVersionId ? await getVersion(project.rsVersionId) : null;
  const ratingSystem = v
    ? `${v.ratingSystemName} ${v.version.scheme} ${v.version.stage} (${v.version.versionLabel})`
    : "—";

  const model = buildChecklist({
    projectName: project.name,
    ratingSystem,
    stage: parseStage(project.stage),
    targetTier: project.targetTier,
    credit,
    generatedAt: formatGeneratedAt(new Date()),
  });

  // Read the photographs' bytes. Scoped to the caller's workspace, and a file
  // missing or too large on disk is simply not embedded (the PDF says so).
  const images: ImageBytes = new Map();
  if (model.photos.length) {
    const rows = await db
      .select({ id: evidenceDocs.id, filePath: evidenceDocs.filePath })
      .from(evidenceDocs)
      .where(
        and(
          inArray(evidenceDocs.id, model.photos.map((p) => p.fileId)),
          eq(evidenceDocs.workspaceId, user.workspaceId),
        ),
      );
    for (const r of rows) {
      try {
        const data = await readFile(r.filePath);
        if (data.length > MAX_IMAGE_BYTES) continue;
        const format = sniffImage(data);
        if (format) images.set(r.id, { data, format });
      } catch {
        // Listed, not shown.
      }
    }
  }

  const buf = await renderToBuffer(ChecklistReport({ model, images }));
  const name = `${slugify(project.name) || "project"}-${slugify(credit.code)}-checklist.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
