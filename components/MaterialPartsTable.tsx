import Link from "next/link";
import type { CreditCount, PartResult } from "@/lib/materials/credits";
import { formatPct } from "@/lib/materials/format";

const BASIS: Record<string, string> = { weight: "by weight", volume: "by volume", cost: "by cost", count: "every product" };

/** Percentage points gained or lost since the month before. */
function change(now: number | null, before: number | null | undefined) {
  if (now == null || before == null) return null;
  const d = now - before;
  if (Math.abs(d) < 0.05) return <span className="text-slate-400">no change</span>;
  return <span className={d > 0 ? "text-emerald-700" : "text-red-700"}>{`${d > 0 ? "+" : ""}${d.toFixed(1)} pts`}</span>;
}

const FORECAST_SOURCE =
  "The share of the BOQ quantities entered on each product (its Quantities card) held by products with status A or B that meet the credit's questionnaire rows, out of every product ticked for the part. RC-01 is out of the total BOQ material cost in the questionnaire settings.";
const ACTUAL_SOURCE = "The same share of the deliveries logged on each product up to the month's end.";

/**
 * The targeted material credits as they stood at the end of a month (D30,
 * client review 1.1): the calculated parts with forecast (BOQ) and actual
 * (deliveries) shares, the pending upside (D34) and the change since the
 * month before; the other targeted material credits as a count (D45).
 */
export function MaterialPartsTable({
  projectId,
  parts,
  previous,
  others = [],
}: {
  projectId: string;
  parts: PartResult[];
  previous?: PartResult[];
  others?: (CreditCount & { title: string })[];
}) {
  const creditLink = (code: string, label: string) => (
    <Link href={`/projects/${projectId}/credits/${encodeURIComponent(code)}#material-review`} className="font-medium text-slate-800 hover:text-brand-700">
      {code} {label}
    </Link>
  );
  if (!parts.length && !others.length)
    return <p className="px-4 py-3 text-sm text-slate-500">No targeted credit is linked to the material questionnaire.</p>;
  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Credit part</th>
            <th className="px-4 py-2">Target</th>
            <th className="px-4 py-2 text-right" title={FORECAST_SOURCE}>Forecast (BOQ) *</th>
            <th className="px-4 py-2 text-right" title={ACTUAL_SOURCE}>Actual (delivered) †</th>
            <th className="px-4 py-2 text-right">Pending</th>
            <th className="px-4 py-2 text-right">This month</th>
            <th className="px-4 py-2">Products</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {parts.map((r) => {
            const before = previous?.find((p) => p.part.key === r.part.key);
            const counted = r.products.filter((p) => p.state === "compliant").length;
            const metAny = r.met.some(Boolean);
            return (
              <tr key={r.part.key} className="align-top">
                <td className="px-4 py-2.5">
                  {creditLink(r.part.creditCode, r.part.label)}
                  {r.missingQuantity ? (
                    <div className="text-xs text-amber-700">
                      {r.missingQuantity} product{r.missingQuantity === 1 ? "" : "s"} without a BOQ quantity
                    </div>
                  ) : null}
                  {r.coverage && !r.coverage.boqTotal ? (
                    <div className="text-xs text-amber-700">BOQ material cost not entered: shares are of the products in the app</div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {r.part.thresholds.map((t) => `≥ ${t}%`).join(" / ")} {BASIS[r.part.basis]}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={`font-semibold ${r.forecast.pct == null ? "text-slate-400" : metAny ? "text-emerald-700" : "text-slate-800"}`}>
                    {formatPct(r.forecast.pct)}
                  </span>
                  {r.part.thresholds.length > 1 && r.forecast.pct != null ? (
                    <div className="text-xs text-slate-500">
                      {r.met.filter(Boolean).length} of {r.part.thresholds.length} levels met
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{r.actual ? formatPct(r.actual.pct) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">{formatPct(r.pendingPct)}</td>
                <td className="px-4 py-2.5 text-right text-xs">{change(r.forecast.pct, before?.forecast.pct) ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {r.products.length ? `${counted} of ${r.products.length} count` : <span className="text-slate-400">none yet</span>}
                </td>
              </tr>
            );
          })}
          {others.length ? (
            <tr>
              <td colSpan={7} className="bg-slate-50 px-4 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Other targeted credits on the questionnaire · no percentage: the manual sets no quantity share
              </td>
            </tr>
          ) : null}
          {others.map((c) => (
            <tr key={c.creditCode} className="align-top">
              <td className="px-4 py-2.5">{creditLink(c.creditCode, c.title)}</td>
              <td colSpan={5} />
              <td className="px-4 py-2.5 text-slate-600">
                {c.products ? `${c.comply} of ${c.products} comply` : <span className="text-slate-400">none yet</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-0.5 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <p>* Forecast (BOQ): {FORECAST_SOURCE}</p>
        <p>† Actual (delivered): {ACTUAL_SOURCE}</p>
        {others.length ? <p>Comply: status A or B, Yes on the credit&apos;s questionnaire rows, and their certificates in date.</p> : null}
      </div>
    </>
  );
}
