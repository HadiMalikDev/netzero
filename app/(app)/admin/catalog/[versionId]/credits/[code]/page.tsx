import Link from "next/link";
import { notFound } from "next/navigation";
import { PageChrome } from "../../../../../_components/PageChrome";
import { Card } from "@/components/ui";
import { getCatalogCredit, getVersion } from "@/lib/catalog";
import { groupByOption } from "@/lib/option-group";
import { OptionGroup } from "@/components/OptionGroup";
import type { CatalogRequirement } from "@/db/schema";

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

interface EvidenceItem {
  stage: string;
  text: string;
}
type Applicability = Record<string, Record<string, number | null>>;

/** Evidence grouped by the submission stage that reviews it (audit B2). */
function EvidenceByStage({
  evidence,
  fallback,
}: {
  evidence: string | null;
  fallback: string | null;
}) {
  let items: EvidenceItem[] = [];
  try {
    if (evidence) items = JSON.parse(evidence) as EvidenceItem[];
  } catch {
    items = [];
  }
  // Back-compat: older rows only have a flat string[] in evidenceSpecs.
  if (items.length === 0 && fallback) {
    try {
      items = (JSON.parse(fallback) as string[]).map((text) => ({
        stage: "unknown",
        text,
      }));
    } catch {
      items = [];
    }
  }
  if (items.length === 0) return null;

  const stages = new Map<string, string[]>();
  for (const it of items) {
    const arr = stages.get(it.stage) ?? [];
    arr.push(it.text);
    stages.set(it.stage, arr);
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {[...stages.entries()].map(([stage, texts]) => (
        <div key={stage} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-1 text-xs font-semibold capitalize text-slate-500">
            {stage === "unknown" ? "Evidence required" : `${stage} stage evidence`}
          </div>
          <ul className="ml-4 list-disc space-y-0.5 text-xs text-slate-500">
            {texts.slice(0, 6).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Credit Applicability Conditions matrix: scope × typology → points | "—". */
function ApplicabilityMatrix({ json }: { json: string | null }) {
  let matrix: Applicability | null = null;
  try {
    if (json) matrix = JSON.parse(json) as Applicability;
  } catch {
    matrix = null;
  }
  if (!matrix || Object.keys(matrix).length === 0) return null;
  const scopes = Object.keys(matrix);
  const typologies = Object.keys(matrix[scopes[0]] ?? {});

  return (
    <Card className="mb-6 p-5">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">
        Applicability (points by scope × typology)
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold">
                Scope
              </th>
              {typologies.map((t) => (
                <th
                  key={t}
                  className="border-b border-slate-200 px-2 py-1.5 text-center font-medium"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scopes.map((s) => (
              <tr key={s}>
                <td className="border-b border-slate-100 px-2 py-1.5 font-medium text-slate-700">
                  {s}
                </td>
                {typologies.map((t) => {
                  const v = matrix![s]?.[t];
                  return (
                    <td
                      key={t}
                      className="border-b border-slate-100 px-2 py-1.5 text-center text-slate-500"
                    >
                      {typeof v === "number" ? v : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CatalogRequirementRow({
  r,
  grouped,
}: {
  r: CatalogRequirement;
  grouped: boolean;
}) {
  const spec: NumericSpec | null = r.numericSpec
    ? JSON.parse(r.numericSpec)
    : null;
  return (
    <div className="border-b border-slate-100 py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
          #{r.seq}
        </span>
        {r.title ? (
          <span className="text-sm font-semibold text-slate-800">{r.title}</span>
        ) : null}
        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
          {r.metricType}
        </span>
        {r.pointsRaw ? (
          <span className="text-xs text-slate-400">
            {r.pointsRaw} point{r.pointsRaw === "1" ? "" : "s"}
            {r.pointsType === "scaled" ? " (scaled)" : ""}
          </span>
        ) : null}
        {r.optionGroup && !grouped ? (
          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
            Option (either/or)
          </span>
        ) : null}
        {r.keystone ? (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
            Keystone
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
            {spec.threshold.op} {spec.threshold.value} {spec.threshold.unit}
          </span>
        </div>
      ) : null}
      <EvidenceByStage evidence={r.evidence} fallback={r.evidenceSpecs} />
    </div>
  );
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
          {groupByOption(requirements).map((block, i) => {
            const items = block.kind === "xor" ? block.items : [block.item];
            const body = items.map((r) => (
              <CatalogRequirementRow key={r.id} r={r} grouped={block.kind === "xor"} />
            ));
            if (block.kind === "xor")
              return (
                <OptionGroup key={`xor-${block.group}-${i}`} count={items.length}>
                  {body}
                </OptionGroup>
              );
            return <div key={items[0].id}>{body}</div>;
          })}
        </div>
      </Card>

      <ApplicabilityMatrix json={credit.applicability} />

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
