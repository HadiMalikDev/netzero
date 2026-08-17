import type { BandSet } from "@/lib/parser/types";

/** Reference table for a scaled requirement (Points Achieved / % improvement). */
export function BandTable({ sets }: { sets: BandSet[] }) {
  if (sets.length === 0) return null;
  return (
    <div className="mt-3 space-y-3">
      {sets.map((set, i) => (
        <div
          key={`${set.label ?? "bands"}-${i}`}
          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <div className="mb-1.5 text-xs font-semibold text-slate-500">
            Points by improvement
            {set.label ? (
              <span className="ml-1 font-normal text-slate-400">
                · {set.label}
              </span>
            ) : null}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="py-0.5 text-left font-medium">Improvement</th>
                <th className="py-0.5 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {set.bands.map((b) => (
                <tr key={`${b.min}-${b.points}`} className="text-slate-600">
                  <td className="py-0.5">≥ {b.min}%</td>
                  <td className="py-0.5 text-right font-medium">{b.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
