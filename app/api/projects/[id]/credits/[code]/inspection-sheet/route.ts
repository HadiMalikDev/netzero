import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { evidenceDocs } from "@/db/schema";
import { planCoverage } from "@/lib/ai/plan-coverage";
import { currentUser } from "@/lib/auth/session";
import { getVersion } from "@/lib/catalog";
import { getCreditByCode, getProject } from "@/lib/data";
import { parseStage } from "@/lib/evidence";
import type { ImageBytes } from "@/lib/pdf/ChecklistReport";
import { InspectionSheet } from "@/lib/pdf/InspectionSheet";
import { registerPdfHyphenation } from "@/lib/pdf/shared";
import { buildInspectionSheet, planFileIds } from "@/lib/report/inspection-sheet";
import { templateFor, templateItems } from "@/lib/report/inspection-template";

registerPdfHyphenation();

/**
 * Downloads the site team's inspection sheet for a credit that has a
 * template (Sprint 2 item 2): the numbered items with blank Yes/No/Remarks,
 * an advisory "in uploaded plan" column, and the photographs already
 * attached. Workspace-scoped like the checklist route. The plan read runs
 * within a time budget so the download never hangs on the model.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const COVERAGE_TIMEOUT_MS = 25_000;

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
  ctx: RouteContext<"/api/projects/[id]/credits/[code]/inspection-sheet">,
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id, code } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Project not found", { status: 404 });
  const credit = await getCreditByCode(id, decodeURIComponent(code));
  if (!credit) return new Response("Credit not found", { status: 404 });
  const template = templateFor(credit);
  if (!template) return new Response("No inspection sheet for this credit", { status: 404 });

  const v = project.rsVersionId ? await getVersion(project.rsVersionId) : null;
  const ratingSystem = v
    ? `${v.ratingSystemName} ${v.version.scheme} ${v.version.stage} (${v.version.versionLabel})`
    : "—";

  // File rows for the plan read and the photographs, scoped to the workspace.
  const wanted = new Set([...planFileIds(credit, template.planDocument)]);
  for (const r of credit.requirements) for (const a of r.attachments) wanted.add(a.id);
  for (const a of credit.additionalAttachments) wanted.add(a.id);
  const rows = wanted.size
    ? await db
        .select({ id: evidenceDocs.id, filePath: evidenceDocs.filePath, fileName: evidenceDocs.fileName })
        .from(evidenceDocs)
        .where(and(inArray(evidenceDocs.id, [...wanted]), eq(evidenceDocs.workspaceId, user.workspaceId)))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const planFiles = planFileIds(credit, template.planDocument)
    .map((fid) => byId.get(fid))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  const coverage = await planCoverage(templateItems(template), planFiles, {
    timeoutMs: COVERAGE_TIMEOUT_MS,
  });

  const model = buildInspectionSheet({
    template,
    credit,
    projectName: project.name,
    ratingSystem,
    stage: parseStage(project.stage),
    generatedAt: formatGeneratedAt(new Date()),
    coverage,
  });

  const images: ImageBytes = new Map();
  for (const p of model.photos) {
    const r = byId.get(p.fileId);
    if (!r) continue;
    try {
      const data = await readFile(r.filePath);
      if (data.length > MAX_IMAGE_BYTES) continue;
      const format = sniffImage(data);
      if (format) images.set(p.fileId, { data, format });
    } catch {
      // Listed, not shown.
    }
  }

  const buf = await renderToBuffer(InspectionSheet({ model, images }));
  const name = `${slugify(project.name) || "project"}-${slugify(credit.code)}-${template.id}.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
