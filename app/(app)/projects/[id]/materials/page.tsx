import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome, PageHeader } from "../../../_components/PageChrome";
import { ProjectTabs } from "../_components/ProjectTabs";
import { Card, primaryButtonClass } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { MaterialStatus } from "@/components/MaterialStatus";
import { getProject } from "@/lib/data";
import { listSubmittals, revLabel, STATUS_LABEL } from "@/lib/materials/products";
import { MaterialPartsTable } from "@/components/MaterialPartsTable";
import { parseMonth, todayIso } from "@/lib/materials/expiry";
import { monthLabel, monthSummaries, monthView, RESUBMIT_DAYS, type MonthProduct } from "@/lib/materials/months";
import { createSubmittalAction } from "../../material-actions";
import { SubmittalFields } from "./_components/SubmittalFields";

/**
 * Material Review (Sprint 3). At the top, the month's material checklist
 * (D3): the products reviewed that month, C/D ones still open, warnings
 * (D31) and the material credits as they stood at the month's end (D30).
 * Below it every past month (D8), then the submittals themselves.
 */

const FLAG_LABEL = {
  resubmission_overdue: "Resubmission overdue",
  certificate_expiring: "Certificate expiring",
  certificate_expired: "Certificate expired",
} as const;

function ProductTable({ rows, base, empty }: { rows: MonthProduct[]; base: string; empty: string }) {
  if (!rows.length) return <p className="px-4 py-3 text-sm text-slate-500">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-2">Product</th>
          <th className="px-4 py-2">Submittal</th>
          <th className="px-4 py-2">Reviewed</th>
          <th className="px-4 py-2">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(({ product: p, submittal: s }) => (
          <tr key={p.id}>
            <td className="px-4 py-2">
              <Link href={`${base}/products/${p.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                {p.name}
              </Link>
              <span className="ml-2 text-xs text-slate-400">{revLabel(p.revision)}</span>
              {p.latest ? null : <span className="ml-2 text-xs text-slate-500">· resubmitted since</span>}
            </td>
            <td className="px-4 py-2 text-slate-600">{s.ref}</td>
            <td className="px-4 py-2 text-slate-600">
              {p.reviewedOn}
              {p.reviewer ? <span className="text-slate-400"> · {p.reviewer}</span> : null}
            </td>
            <td className="px-4 py-2">
              <MaterialStatus status={p.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const secondary =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50";

export default async function MaterialsPage({ params, searchParams }: PageProps<"/projects/[id]/materials">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const today = todayIso();
  const current = today.slice(0, 7);
  const requested = parseMonth((await searchParams).month);
  const month = requested && requested <= current ? requested : current;
  const [submittals, view, months] = await Promise.all([listSubmittals(id), monthView(id, month, today), monthSummaries(id, today)]);
  const base = `/projects/${id}/materials`;
  const isCurrent = month === current;

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
          <div className="flex items-center gap-2">
            <a href={`/api/projects/${id}/materials/tracker`} className={secondary}>
              Material tracker (.xlsx)
            </a>
            <Link href={`${base}/form`} className={secondary}>
              Questionnaire
            </Link>
          </div>
        }
      />
      <ProjectTabs projectId={id} />

      <section id="month" className="mb-10 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isCurrent ? "This month's material checklist" : "Material checklist"} · {monthLabel(month)}
            </h2>
            <p className="text-sm text-slate-500">
              Products reviewed in {monthLabel(month)} by their review date, and the material credits as they stood {isCurrent ? "today" : "at the end of the month"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isCurrent ? null : (
              <Link href={base} className={secondary}>
                Back to this month
              </Link>
            )}
            <a href={`/api/projects/${id}/materials/months/${month}/pdf`} className={secondary}>
              Download PDF
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          <Card className="px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reviewed</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{view.reviewed.length}</div>
          </Card>
          {(["A", "B", "C", "D"] as const).map((k) => (
            <Card key={k} className="px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {k} · {STATUS_LABEL[k]}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{view.counts[k]}</div>
            </Card>
          ))}
        </div>

        {view.flags.length ? (
          <Card className="border-amber-200 bg-amber-50">
            <ul className="divide-y divide-amber-100">
              {view.flags.map((f, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-2 px-4 py-2 text-sm">
                  <span className={`font-semibold ${f.kind === "certificate_expiring" ? "text-amber-800" : "text-red-700"}`}>{FLAG_LABEL[f.kind]}</span>
                  <Link href={`${base}/products/${f.productId}`} className="font-medium text-slate-800 hover:text-brand-700">
                    {f.productName}
                  </Link>
                  <span className="text-slate-500">({f.submittalRef})</span>
                  <span className="text-slate-700">{f.detail}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Reviewed in {monthLabel(month)}</div>
          <ProductTable rows={view.reviewed} base={base} empty="No products reviewed this month." />
        </Card>

        {view.carried.length ? (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
              Still open from earlier months (C or D, waiting for a resubmission; flagged after {RESUBMIT_DAYS} days)
            </div>
            <ProductTable rows={view.carried} base={base} empty="" />
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
            Material credits {isCurrent ? "to date" : `at the end of ${monthLabel(month)}`}
          </div>
          <MaterialPartsTable projectId={id} parts={view.parts} previous={view.previous} />
        </Card>
      </section>

      {months.length > 1 || (months.length === 1 && months[0].month !== month) ? (
        <section id="past" className="mb-10 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Monthly checklists</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Reviewed</th>
                  <th className="px-4 py-2 text-right">A</th>
                  <th className="px-4 py-2 text-right">B</th>
                  <th className="px-4 py-2 text-right">C</th>
                  <th className="px-4 py-2 text-right">D</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((m) => (
                  <tr key={m.month} className={m.month === month ? "bg-brand-50/40" : ""}>
                    <td className="px-4 py-2">
                      <Link href={m.month === current ? base : `${base}?month=${m.month}`} className="font-medium text-slate-800 hover:text-brand-700">
                        {monthLabel(m.month)}
                      </Link>
                      {m.month === current ? <span className="ml-2 text-xs text-slate-500">this month</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.reviewed}</td>
                    {(["A", "B", "C", "D"] as const).map((k) => (
                      <td key={k} className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {m.counts[k] || "—"}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right">
                      <a href={`/api/projects/${id}/materials/months/${m.month}/pdf`} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ) : null}

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
