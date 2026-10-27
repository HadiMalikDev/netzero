import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../_components/PageChrome";
import { ProjectTabs } from "../_components/ProjectTabs";
import { Card, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { MaterialStatus } from "@/components/MaterialStatus";
import { getProject } from "@/lib/data";
import { listSubmittals, revLabel } from "@/lib/materials/products";
import { createSubmittalAction } from "../../material-actions";
import { SubmittalFields } from "./_components/SubmittalFields";

/**
 * Material Review (Sprint 3): every material submittal of the project and its
 * products, each reviewed against the project's SMQ.
 */

const secondary =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

export default async function MaterialsPage({ params }: PageProps<"/projects/[id]/materials">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const submittals = await listSubmittals(id);
  const base = `/projects/${id}/materials`;

  return (
    <PageChrome
      crumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name, href: `/projects/${id}` },
        { label: "Materials" },
      ]}
    >
      <PageHeader
        title="Materials"
        subtitle="Every material submittal, each product reviewed against the project's Sustainability Material Questionnaire (SMQ)."
        action={
          <Link href={`${base}/form`} className={secondary}>
            Questionnaire
          </Link>
        }
      />
      <ProjectTabs projectId={id} />

      <section id="submittals" className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Submittals</h2>
        <Card className="px-5 py-4">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-brand-700">New submittal</summary>
            <form action={createSubmittalAction} className="mt-3 space-y-3">
              <input type="hidden" name="projectId" value={id} />
              <SubmittalFields />
              <button type="submit" className={primaryButtonClass}>
                Create submittal
              </button>
            </form>
          </details>
        </Card>

        {submittals.length === 0 ? (
          <EmptyState
            title="No material submittals yet"
            description="Create a submittal for each MTS / TBE the contractor sends, then add its products: each one gets its own SMQ."
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Submittal</th>
                  <th className="px-4 py-2.5">Discipline</th>
                  <th className="px-4 py-2.5">Products</th>
                  <th className="px-4 py-2.5">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submittals.map((s) => {
                  const latest = s.products.filter((p) => p.latest);
                  return (
                    <tr key={s.id} className="align-top">
                      <td className="px-4 py-3">
                        <Link href={`${base}/submittals/${s.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                          {s.ref}
                        </Link>
                        <div className="text-slate-600">{s.title}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.discipline ?? "—"}</td>
                      <td className="px-4 py-3">
                        {latest.length === 0 ? (
                          <span className="text-slate-400">None yet</span>
                        ) : (
                          <ul className="space-y-1">
                            {latest.map((p) => (
                              <li key={p.id} className="flex flex-wrap items-center gap-2">
                                <Link href={`${base}/products/${p.id}`} className="text-slate-800 hover:text-brand-700">
                                  {p.name}
                                </Link>
                                <span className="text-xs text-slate-400">{revLabel(p.revision)}</span>
                                <MaterialStatus status={p.status} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.submittedOn ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </PageChrome>
  );
}
