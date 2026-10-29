import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { currentUser } from "@/lib/auth/session";
import { getProject } from "@/lib/data";
import { parseMonth, todayIso } from "@/lib/materials/expiry";
import { monthLabel, monthView } from "@/lib/materials/months";
import { MaterialMonthReport } from "@/lib/pdf/MaterialMonthReport";
import { registerPdfHyphenation } from "@/lib/pdf/shared";
import { generatedAt, pdfResponse, slugify } from "@/lib/report/download";

// Registered here (the module that calls renderToBuffer); see registerPdfHyphenation.
registerPdfHyphenation();

/** One month's material checklist as a PDF (Sprint 3, D22). Workspace-scoped through getProject. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]/materials/months/[month]/pdf">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id, month: raw } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Project not found", { status: 404 });
  const today = todayIso();
  const month = parseMonth(raw);
  if (!month || month > today.slice(0, 7)) return new Response("Not a past or current month", { status: 404 });
  const view = await monthView(id, month, today);
  const buf = await renderToBuffer(
    MaterialMonthReport({ view, projectName: project.name, monthName: monthLabel(month), generatedAt: generatedAt() }),
  );
  return pdfResponse(buf, `${slugify(project.name) || "project"}-material-checklist-${month}.pdf`);
}
