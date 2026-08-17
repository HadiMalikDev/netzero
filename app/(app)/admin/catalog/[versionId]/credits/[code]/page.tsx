import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome } from "../../../../../_components/PageChrome";
import { Card } from "@/components/ui";
import { getCatalogCredit, getVersion } from "@/lib/catalog";

interface NumericLimit {
  name: string;
  op: string;
  value: number;
  unit: string;
}
interface NumericSpec {
  summary?: string;
  limits?: NumericLimit[];
  threshold?: { op: string; value: number; unit: string };
}

export default async function CatalogCreditDetail({
  params,
}: PageProps<"/admin/catalog/[versionId]/credits/[code]">) {
  const { versionId, code } = await params;
  const v = await getVersion(versionId);
  if (!v) notFound();
  const data = await getCatalogCredit(versionId, decodeURIComponent(code));
  if (!data) notFound();
  const { credit, requirements } = data;
  const references: string[] = credit.references
    ? JSON.parse(credit.references)
    : [];

  return (
    <PageChrome
      crumbs={[
        { label: "Admin" },
        { label: "Catalog" },
        { label: `${v.version.scheme} ${v.version.stage}` },
        { label: credit.code },
      ]}
    >
      <div className="mb-6">
        <Link
          href={`/admin/catalog/${versionId}`}
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          ← Back to version
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {credit.categoryCode} · {credit.categoryName}
          </span>
          {credit.isKeystone ? (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Keystone
            </span>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {credit.code} — {credit.title}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {credit.pointsRaw ? `${credit.pointsRaw} points · ` : ""}
          Source: manual pp.{credit.sourcePageStart}–{credit.sourcePageEnd}
        </p>
      </div>

      {credit.aim ? (
        <Card className="mb-6 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Aim</h2>
          <p className="text-sm text-slate-600">{credit.aim}</p>
        </Card>
      ) : null}

      <Card className="mb-6 p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">
          Requirements
        </h2>
        <div>
          {requirements.map((r) => {
            const spec: NumericSpec | null = r.numericSpec
              ? JSON.parse(r.numericSpec)
              : null;
            return (
              <div
                key={r.id}
                className="border-b border-slate-100 py-4 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                    #{r.seq}
                  </span>
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                    {r.metricType}
                  </span>
                  {r.pointsRaw ? (
                    <span className="text-xs text-slate-400">
                      {r.pointsRaw} point{r.pointsRaw === "1" ? "" : "s"}
                    </span>
                  ) : null}
                  {r.unit ? (
                    <span className="text-xs text-slate-400">unit: {r.unit}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-700">{r.text}</p>

                {spec?.summary ? (
                  <div className="mt-3 inline-block rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
                    Measurable target: {spec.summary}
                  </div>
                ) : null}

                {spec?.limits?.length ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-1.5 text-xs font-semibold text-slate-500">
                      Reference values (max concentration)
                    </div>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {spec.limits.map((l, i) => (
                        <li key={i} className="text-xs text-slate-600">
                          {l.name}:{" "}
                          <span className="font-medium">
                            ≤ {l.value} {l.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {spec?.threshold ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    Reference threshold:{" "}
                    <span className="font-medium">
                      {spec.threshold.op} {spec.threshold.value}{" "}
                      {spec.threshold.unit}
                    </span>
                  </div>
                ) : null}

                {r.evidenceSpecs &&
                (JSON.parse(r.evidenceSpecs) as string[]).length ? (
                  <div className="mt-3">
                    <div className="mb-1 text-xs font-semibold text-slate-500">
                      Evidence required
                    </div>
                    <ul className="ml-4 list-disc space-y-0.5 text-xs text-slate-500">
                      {(JSON.parse(r.evidenceSpecs) as string[])
                        .slice(0, 5)
                        .map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      {references.length ? (
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            Reference documents
          </h2>
          <ul className="ml-4 list-disc space-y-0.5 text-sm text-slate-500">
            {references.map((ref, i) => (
              <li key={i}>{ref}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </PageChrome>
  );
}
