import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { evidenceDocs } from "@/db/schema";
import { currentUser } from "@/lib/auth/session";
import { getVersion } from "@/lib/catalog";
import { getInspection } from "@/lib/checklists";
import { getCreditByCode, getProject } from "@/lib/data";
import { parseStage } from "@/lib/evidence";
import { formatUploadedAt } from "@/lib/format";
import type { ImageBytes } from "@/lib/pdf/ChecklistReport";
import { InspectionSheet } from "@/lib/pdf/InspectionSheet";
import { registerPdfHyphenation } from "@/lib/pdf/shared";
import { buildInspectionSheet } from "@/lib/report/inspection-sheet";

registerPdfHyphenation();

/**
 * Downloads one reviewed inspection as the site team's sheet (Sprint 2 item
 * 3). Prints only what the reviewer saved; an inspection nobody has reviewed
 * yet is refused (409) rather than printed with machine answers. Workspace-
 * and project-scoped: an inspection of another project is a 404.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function sniffImage(data: Buffer): "png" | "jpg" | null {
  if (data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
    return "png";
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  return null;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
  ctx: RouteContext<"/api/projects/[id]/credits/[code]/inspections/[inspectionId]/pdf">,
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id, code, inspectionId } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Project not found", { status: 404 });
  const credit = await getCreditByCode(id, decodeURIComponent(code));
  if (!credit) return new Response("Credit not found", { status: 404 });
  const insp = await getInspection(inspectionId);
  if (!insp || insp.projectCreditId !== credit.projectCreditId)
    return new Response("Inspection not found", { status: 404 });
  if (!insp.reviewedAt)
    return new Response("Save the review before downloading: only reviewed answers print.", { status: 409 });

  const v = project.rsVersionId ? await getVersion(project.rsVersionId) : null;
  const ratingSystem = v
    ? `${v.ratingSystemName} ${v.version.scheme} ${v.version.stage} (${v.version.versionLabel})`
    : "—";

  const model = buildInspectionSheet({
    inspection: insp,
    credit,
    projectName: project.name,
    ratingSystem,
    projectStage: parseStage(project.stage),
    generatedAt: formatGeneratedAt(new Date()),
    reviewedOn: formatUploadedAt(insp.reviewedAt),
  });

  const images: ImageBytes = new Map();
  const ids = model.photos.map((p) => p.fileId);
  const rows = ids.length
    ? await db
        .select({ id: evidenceDocs.id, filePath: evidenceDocs.filePath })
        .from(evidenceDocs)
        .where(and(inArray(evidenceDocs.id, ids), eq(evidenceDocs.workspaceId, user.workspaceId)))
    : [];
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

  const buf = await renderToBuffer(InspectionSheet({ model, images }));
  const name = `${slugify(project.name) || "project"}-${slugify(credit.code)}-inspection-${insp.inspectionDate ?? "undated"}.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
