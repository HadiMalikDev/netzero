import Link from "next/link";
import type { PartResult } from "@/lib/materials/credits";
import { formatPct } from "@/lib/materials/format";

const BASIS: Record<string, string> = { weight: "by weight", volume: "by volume", cost: "by cost", count: "every product" };

/** Percentage points gained or lost since the month before. */
function change(now: number | null, before: number | null | undefined) {
  if (now == null || before == null) return null;
  const d = now - before;
  if (Math.abs(d) < 0.05) return <span className="text-slate-400">no change</span>;
  return <span className={d > 0 ? "text-emerald-700" : "text-red-700"}>{`${d > 0 ? "+" : ""}${d.toFixed(1)} pts`}</span>;
}

/**
 * The calculated credit parts as they stood at the end of a month (D30):
 * forecast (BOQ) and actual (deliveries) shares, the pending upside (D34),
 * and the change since the month before.
 */
export function MaterialPartsTable({
  projectId,
  parts,
  previous,
}: {
  projectId: string;
  parts: PartResult[];
  previous?: PartResult[];
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-2">Credit part</th>
          <th className="px-4 py-2">Target</th>
          <th className="px-4 py-2 text-right">Forecast (BOQ)</th>
          <th className="px-4 py-2 text-right">Actual (delivered)</th>
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
                <Link
                  href={`/projects/${projectId}/credits/${encodeURIComponent(r.part.creditCode)}#material-review`}
                  className="font-medium text-slate-800 hover:text-brand-700"
                >
                  {r.part.creditCode} {r.part.label}
                </Link>
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
      </tbody>
    </table>
  );
}
