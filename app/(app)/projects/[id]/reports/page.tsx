import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../_components/PageChrome";
import { ProjectTabs } from "../_components/ProjectTabs";
import { Card, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { DownloadChecklistLink } from "@/components/DownloadChecklistLink";
import { getProject } from "@/lib/data";
import { projectReportForms, type ReportForm } from "@/lib/reports";
import { formatUploadedAt } from "@/lib/format";
import { formatInspectionDate } from "@/lib/report/inspection-sheet";
import { startInspectionAction } from "../../inspection-actions";
import { monthLabel, monthSummaries, type MonthSummary } from "@/lib/materials/months";

/**
 * Reports (Sprint 2 item 4): every generated report of the project in one
 * place — the IAQ (HC-10) and ESC (SS-03) inspection sheets — with the same
 * options the credit's own pages offer: start an inspection, edit the form,
 * review or download each inspection, the compliance checklist, and (ESC) the
 * corrective-action log. Each option goes through the same action or link as
 * on the credit, so the two places can never disagree. The monthly material
 * checklists sit beside them (Sprint 3, D8), with the material tracker.
 */

const secondary =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

function FormCard({ projectId, f }: { projectId: string; f: ReportForm }) {
  const credit = `/projects/${projectId}/credits/${encodeURIComponent(f.code)}`;
  const base = `${credit}/inspections`;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <Link href={credit} className="text-xs font-semibold uppercase tracking-wide text-brand-700 hover:text-brand-800">
            {f.code} · {f.creditTitle}
          </Link>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">{f.formTitle}</h2>
          <p className="text-sm text-slate-500">
            {f.inspections.length} inspection{f.inspections.length === 1 ? "" : "s"}
            {f.observationLog ? ` · ${f.openObservations} open observation${f.openObservations === 1 ? "" : "s"}` : ""}
            {f.ownCopy ? "" : " · uses the standard form until this project edits it or starts an inspection"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadChecklistLink projectId={projectId} code={f.code} />
          <Link href={`${base}/form`} className={secondary}>
            Edit form
          </Link>
          {f.observationLog ? (
            <Link href={`${base}#observations`} className={secondary}>
              {f.observationTitle}
            </Link>
          ) : null}
          <form action={startInspectionAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="code" value={f.code} />
            <button type="submit" className={primaryButtonClass}>
              New inspection
            </button>
          </form>
        </div>
      </div>
      {f.inspections.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          No inspections yet. Start one: the AI drafts the answers from the uploaded plan, and you review them.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Inspection date</th>
              <th className="px-5 py-2.5">Inspected by</th>
              <th className="px-5 py-2.5">Status</th>
              <th className="px-5 py-2.5 text-right">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {f.inspections.map((i) => (
              <tr key={i.id}>
                <td className="px-5 py-2.5 font-medium text-slate-800">
                  {formatInspectionDate(i.inspectionDate) ?? <span className="text-slate-400">not set</span>}
                </td>
                <td className="px-5 py-2.5 text-slate-600">{i.inspector ?? "—"}</td>
                <td className="px-5 py-2.5">
                  {i.reviewedAt ? (
                    <span className="text-emerald-700">
                      Reviewed by {i.reviewedByName ?? "—"}, {formatUploadedAt(i.reviewedAt)}
                    </span>
                  ) : i.aiState === "pending" ? (
                    <span className="text-slate-500">AI drafting…</span>
                  ) : (
                    <span className="text-amber-700">Draft, not reviewed</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className="inline-flex items-center gap-3">
                    <Link href={`${base}/${i.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                      {i.reviewedAt ? "Open" : "Review"}
                    </Link>
                    {i.reviewedAt ? (
                      <a
                        href={`/api/projects/${projectId}/credits/${encodeURIComponent(f.code)}/inspections/${i.id}/pdf`}
                        className="font-medium text-brand-600 hover:text-brand-700"
                        download
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className="text-slate-400" title="Save the review to download">
                        Download PDF
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function MaterialCard({ projectId, months }: { projectId: string; months: MonthSummary[] }) {
  const materials = `/projects/${projectId}/materials`;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <Link href={materials} className="text-xs font-semibold uppercase tracking-wide text-brand-700 hover:text-brand-800">
            Materials · SMQ
          </Link>
          <h2 className="mt-0.5 text-lg font-semibold text-slate-900">Monthly material checklists</h2>
          <p className="text-sm text-slate-500">
            Products reviewed each month against the Sustainability Material Questionnaire, and the material credits at the month&apos;s end.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/projects/${projectId}/materials/tracker`} className={secondary}>
            Material tracker (.xlsx)
          </a>
          <Link href={materials} className={primaryButtonClass}>
            Open Materials
          </Link>
        </div>
      </div>
      {months.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">No material submittals yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {months.map((m) => (
            <li key={m.month} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
              <Link href={`${materials}?month=${m.month}`} className="w-40 font-medium text-slate-800 hover:text-brand-700">
                {monthLabel(m.month)}
              </Link>
              <span className="flex-1 text-slate-500">
                {m.reviewed
                  ? `${m.reviewed} reviewed · ${(["A", "B", "C", "D"] as const)
                      .filter((k) => m.counts[k])
                      .map((k) => `${m.counts[k]} ${k}`)
                      .join(", ")}`
                  : "Nothing reviewed"}
              </span>
              <a href={`/api/projects/${projectId}/materials/months/${m.month}/pdf`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                Download PDF
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function ReportsPage({ params }: PageProps<"/projects/[id]/reports">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [forms, months] = await Promise.all([projectReportForms(id), monthSummaries(id)]);

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Reports" },
      ]}
    >
      <PageHeader
        title="Reports"
        subtitle="Monthly material checklists and inspection reports generated for this project, with the same options as on each page they come from."
      />
      <ProjectTabs projectId={id} />
      <div className="mb-6">
        <MaterialCard projectId={id} months={months} />
      </div>
      {forms.length === 0 ? (
        <EmptyState
          title="No report forms for this project"
          description="Inspection reports exist for credits with a form: Indoor Air Quality (IAQ) and Construction Environmental Management (ESC)."
        />
      ) : (
        <div className="space-y-6">
          {forms.map((f) => (
            <FormCard key={f.projectCreditId} projectId={id} f={f} />
          ))}
        </div>
      )}
    </PageChrome>
  );
}
