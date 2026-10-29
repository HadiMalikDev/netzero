import Link from "next/link";
import { Card } from "@/components/ui";
import { MaterialStatus } from "@/components/MaterialStatus";
import type { PartResult } from "@/lib/materials/credits";
import type { CreditSlice } from "@/lib/materials/credit-slice";
import { formatPct, formatQty } from "@/lib/materials/format";
import { monthLabel } from "@/lib/materials/months";
import { revLabel } from "@/lib/materials/products";
import { ApplyPartValue } from "./ApplyPartValue";

/**
 * The credit's slice of the material reviews (Sprint 3, D8): what each
 * product's SMQ answered for this credit, by review month, and — for MW-05,
 * HC-11, RC-01 and MW-04 — the shares the credit is measured by, with "Use
 * this value" to copy one into the requirement below (D15), which says what
 * it wrote (D41).
 */

const UNIT = { weight: "t", volume: "m³", cost: "SAR", count: "" } as const;
const ANSWER = { yes: "Yes", no: "No", na: "N/A" } as const;
const STATE = {
  compliant: { label: "Counts", className: "text-emerald-700" },
  pending: { label: "Pending", className: "text-amber-700" },
  not_compliant: { label: "Does not count", className: "text-red-700" },
} as const;

function PartCard({ r, projectId, code }: { r: PartResult; projectId: string; code: string }) {
  const unit = UNIT[r.part.basis];
  return (
    <div className="border-t border-slate-100 px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{r.part.label}</h3>
          <p className="text-xs text-slate-500">{r.part.rule}</p>
        </div>
        {r.part.requirementSeqs.length && (r.forecast.pct != null || r.actual?.pct != null) ? (
          <ApplyPartValue projectId={projectId} code={code} part={r.part.key} forecast={r.forecast.pct != null} actual={r.actual?.pct != null} />
        ) : null}
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Forecast (BOQ)</dt>
          <dd className={`text-xl font-semibold ${r.met.some(Boolean) ? "text-emerald-700" : "text-slate-900"}`}>{formatPct(r.forecast.pct)}</dd>
          {r.forecast.den > 0 ? (
            <dd className="text-xs text-slate-500">
              {r.part.basis === "count" ? `${r.forecast.num} of ${r.forecast.den} products` : `${formatQty(r.forecast.num)} of ${formatQty(r.forecast.den)} ${unit}`}
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Actual (delivered)</dt>
          <dd className="text-xl font-semibold text-slate-900">{r.actual ? formatPct(r.actual.pct) : "—"}</dd>
          {r.actual && r.actual.den > 0 ? <dd className="text-xs text-slate-500">{`${formatQty(r.actual.num)} of ${formatQty(r.actual.den)} ${unit}`}</dd> : null}
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pending</dt>
          <dd className="text-xl font-semibold text-amber-700">{formatPct(r.pendingPct)}</dd>
          <dd className="text-xs text-slate-500">under review or C</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Target</dt>
          <dd className="text-sm font-medium text-slate-800">
            {r.part.thresholds.map((t, i) => (
              <span key={t} className={`mr-2 ${r.met[i] ? "text-emerald-700" : ""}`}>
                ≥ {t}% {r.met[i] ? "✓" : ""}
              </span>
            ))}
          </dd>
        </div>
      </dl>
      {r.coverage ? (
        <p className="mt-2 text-xs text-slate-600">
          {r.coverage.boqTotal
            ? `Of the project's BOQ material cost of ${formatQty(r.coverage.boqTotal)} SAR, the products in the app cover ${formatPct(r.coverage.productsBoqPct)} (${formatQty(r.coverage.productsBoq)} SAR); ${formatPct(r.coverage.deliveredPct)} is delivered.`
            : "The project's BOQ material cost is not entered (Materials › Questionnaire), so these shares are of the products in the app only."}
        </p>
      ) : null}
      {r.products.length ? (
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1.5 pr-3">Product</th>
              <th className="py-1.5 pr-3">Status</th>
              <th className="py-1.5 pr-3 text-right">BOQ{unit ? ` (${unit})` : ""}</th>
              <th className="py-1.5 pr-3 text-right">Delivered{unit ? ` (${unit})` : ""}</th>
              <th className="py-1.5">Counts?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.products.map((p) => (
              <tr key={p.key} className="align-top">
                <td className="py-1.5 pr-3">
                  <Link href={`/projects/${projectId}/materials/products/${p.revisionId}`} className="text-slate-800 hover:text-brand-700">
                    {p.name}
                  </Link>
                  <span className="ml-1 text-xs text-slate-400">{revLabel(p.revision)}</span>
                </td>
                <td className="py-1.5 pr-3">
                  <MaterialStatus status={p.status} />
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.part.basis === "count" ? "—" : formatQty(p.boqQty)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.part.basis === "count" ? "—" : formatQty(p.deliveredQty)}</td>
                <td className="py-1.5">
                  <span className={STATE[p.state].className}>{STATE[p.state].label}</span>
                  {p.state !== "compliant" && p.reasons.length ? <div className="text-xs text-slate-500">{p.reasons.join("; ")}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No product counts toward this yet. Tick it on a product under Materials.</p>
      )}
    </div>
  );
}

export function MaterialReviewSection({
  projectId,
  code,
  slice,
}: {
  projectId: string;
  code: string;
  slice: CreditSlice;
}) {
  if (!slice.parts.length && !slice.months.length) return null;
  return (
    <section id="material-review" className="mb-6 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Material Review</h2>
          <p className="text-sm text-slate-500">What the products&apos; Sustainability Material Questionnaires give this credit.</p>
        </div>
        <Link href={`/projects/${projectId}/materials`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          Materials →
        </Link>
      </div>

      {slice.parts.length ? (
        <Card className="overflow-hidden">
          {slice.parts.map((r) => (
            <PartCard key={r.part.key} r={r} projectId={projectId} code={code} />
          ))}
        </Card>
      ) : null}

      {slice.history.length > 1 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-800">Month by month (forecast · actual, at each month&apos;s end)</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2">Month</th>
                {slice.parts.map((r) => (
                  <th key={r.part.key} className="px-5 py-2 text-right">
                    {r.part.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slice.history.map((h) => (
                <tr key={h.month}>
                  <td className="px-5 py-2">
                    <Link href={`/projects/${projectId}/materials?month=${h.month}`} className="text-slate-800 hover:text-brand-700">
                      {monthLabel(h.month)}
                    </Link>
                  </td>
                  {h.parts.map((r) => (
                    <td key={r.part.key} className="px-5 py-2 text-right tabular-nums">
                      {formatPct(r.forecast.pct)}
                      {r.actual ? <span className="text-slate-400"> · {formatPct(r.actual.pct)}</span> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {slice.months.map((m) => (
        <Card key={m.month ?? "pending"} className="overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-800">
            {m.month ? `Reviewed in ${monthLabel(m.month)}` : "Not reviewed yet"}
          </div>
          <ul className="divide-y divide-slate-100">
            {m.products.map(({ product: p, submittal: s, answers }) => (
              <li key={p.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/projects/${projectId}/materials/products/${p.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                    {p.name}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {s.ref} · {revLabel(p.revision)}
                    {p.latest ? "" : " · resubmitted since"}
                  </span>
                  <MaterialStatus status={p.status} />
                </div>
                <ul className="mt-2 space-y-1.5">
                  {answers.map((a) => (
                    <li key={a.id} className="grid gap-2 text-sm sm:grid-cols-[1fr_14rem]">
                      <span className="whitespace-pre-line text-slate-600">{a.text.split("\n")[0]}</span>
                      <span className="text-slate-800">
                        <span className="font-medium">{a.answer ? ANSWER[a.answer as keyof typeof ANSWER] : "Not answered"}</span>
                        {a.value ? ` · ${a.value}${a.unit ? ` ${a.unit}` : ""}` : ""}
                        {a.targetText ? <span className="block text-xs text-slate-500">target {a.targetText.split("\n")[0]}</span> : null}
                        {a.docs.map((d) => (
                          <a key={d.docId} href={`/api/evidence/${d.docId}`} target="_blank" rel="noreferrer" className="block truncate text-xs text-brand-700 hover:text-brand-800">
                            {d.fileName}
                            {d.issuedOn ? ` (issued ${d.issuedOn})` : ""}
                          </a>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </section>
  );
}
