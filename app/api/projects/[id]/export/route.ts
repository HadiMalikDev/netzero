import type { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getVersion } from "@/lib/catalog";
import { getProject, getProjectCredits, getProjectScore } from "@/lib/data";
import { buildScorecard } from "@/lib/export/scorecard";

/**
 * Downloads a project's scorecard as an Excel workbook (V2 feedback row 8).
 * getProject is workspace-scoped, so a project id from another workspace is a
 * 404, not a leak. Node runtime + dynamic: exceljs needs Node APIs and the
 * content is per-request.
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
  ctx: RouteContext<"/api/projects/[id]/export">,
) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Project not found", { status: 404 });

  const credits = await getProjectCredits(id);
  const score = await getProjectScore(project, credits);
  const v = project.rsVersionId ? await getVersion(project.rsVersionId) : null;
  const ratingSystem = v
    ? `${v.ratingSystemName} ${v.version.scheme} ${v.version.stage} (${v.version.versionLabel})`
    : "—";

  const wb = buildScorecard({
    projectName: project.name,
    ratingSystem,
    credits,
    score,
    generatedAt: new Date(),
  });
  const buf = await wb.xlsx.writeBuffer();

  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slugify(project.name) || "project"}-scorecard.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
