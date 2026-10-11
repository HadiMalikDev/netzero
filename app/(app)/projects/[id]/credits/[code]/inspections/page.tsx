import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../../../_components/PageChrome";
import { Card, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { getCreditByCode, getProject } from "@/lib/data";
import { defaultTemplateFor, listInspections, projectTemplate } from "@/lib/checklists";
import { formatUploadedAt } from "@/lib/format";
import { startInspectionAction } from "../../../../inspection-actions";
import { listObservations } from "@/lib/observations";
import { ObservationLog } from "./ObservationLog";

/**
 * A credit's inspections (Sprint 2 item 3): every filled copy of the
 * project's form, newest first, with a button to start the next one. The AI
 * drafts each new inspection from the uploaded plan; a person reviews it.
 */
export default async function InspectionsPage({
  params,
}: PageProps<"/projects/[id]/credits/[code]/inspections">) {
  const { id, code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const project = await getProject(id);
  if (!project) notFound();
  const credit = await getCreditByCode(id, code);
  if (!credit) notFound();

  const own = await projectTemplate(credit.projectCreditId);
  const form = own ?? (await defaultTemplateFor(credit.title));
  if (!form) notFound();
  const inspections = own ? await listInspections(own.id) : [];
  const observations = own && form.observationLog ? await listObservations(own.id) : [];
  const base = `/projects/${id}/credits/${encodeURIComponent(code)}/inspections`;

  const start = (
    <form action={startInspectionAction}>
      <input type="hidden" name="projectId" value={id} />
      <input type="hidden" name="code" value={code} />
      <button type="submit" className={primaryButtonClass}>
        New inspection
      </button>
    </form>
  );

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Credits", href: `/projects/${id}/credits` },
        { label: credit.code, href: `/projects/${id}/credits/${encodeURIComponent(code)}` },
        { label: "Inspections" },
      ]}
    >
      <PageHeader
        title={form.title}
        subtitle={`${credit.code} ${credit.title} · one filled copy per inspection. The AI drafts answers from the uploaded plan; a person reviews them before anything prints.`}
        action={
          <div className="flex items-center gap-3">
            <Link href={`${base}/form`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Edit form
            </Link>
            {start}
          </div>
        }
      />

      {inspections.length === 0 ? (
        <EmptyState
          title="No inspections yet"
          description={
            own
              ? "Start one: the AI drafts the answers from the uploaded IAQ plan, and you review them."
              : "This project will get its own copy of the standard form when you start the first inspection or edit the form."
          }
          action={start}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Inspection date</th>
                <th className="px-5 py-3">Inspector</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inspections.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {i.inspectionDate ?? <span className="text-slate-400">not set</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{i.inspector ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{i.area ?? "—"}</td>
                  <td className="px-5 py-3">
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
                  <td className="px-5 py-3 text-right">
                    <Link href={`${base}/${i.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                      {i.reviewedAt ? "Open" : "Review"} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {form.observationLog ? (
        <ObservationLog title={form.observationTitle} rows={observations} projectId={id} code={code} />
      ) : null}
    </PageChrome>
  );
}
