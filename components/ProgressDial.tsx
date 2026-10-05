import type { TierThreshold } from "@/lib/tiers";

/**
 * Progress dials (V2 feedback row 11). Plain SVG, no chart library: a small
 * ring for one credit, and a half-circle gauge for the project with its
 * rating-level thresholds marked along the arc.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** One credit: earned points against its maximum. */
export function CreditRing({
  earned,
  max,
  size = 56,
}: {
  earned: number;
  max: number | null;
  size?: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max ? clamp01(earned / max) : 0;
  const full = max != null && earned >= max && max > 0;
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={max ? `${earned} of ${max} points earned` : `${earned} points earned`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className={full ? "stroke-emerald-500" : "stroke-brand-500"}
        />
      </svg>
      <span className="absolute text-center leading-none">
        <span className="block text-sm font-semibold text-slate-800">{earned}</span>
        {max != null ? (
          <span className="block text-[10px] text-slate-400">of {max}</span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The project: earned points along a half-circle scaled to the points
 * available, with a tick per rating level. The target level's tick is
 * emphasised; the level reached (if any) is named under the number.
 */
export function TierGauge({
  earned,
  scaleMax,
  thresholds,
  target,
  reached,
}: {
  earned: number;
  scaleMax: number;
  thresholds: TierThreshold[];
  target: TierThreshold | null;
  reached: TierThreshold | null;
}) {
  const W = 260;
  const cx = W / 2;
  const cy = 130;
  const r = 100;
  const at = (t: number, radius = r) => {
    const a = Math.PI * (1 - clamp01(t));
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) };
  };
  const arc = (t: number) => {
    const s = at(0);
    const e = at(t);
    return `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`;
  };
  const scale = Math.max(scaleMax, thresholds.at(-1)?.min ?? 0, earned, 1);
  const frac = earned / scale;

  return (
    <svg
      viewBox={`0 0 ${W} 150`}
      className="w-full max-w-xs"
      role="img"
      aria-label={`${earned} of ${scale} points${reached ? `, ${reached.tier} reached` : ""}${
        target ? `, target ${target.tier} at ${target.min}` : ""
      }`}
    >
      <path d={arc(1)} fill="none" strokeWidth={14} strokeLinecap="round" className="stroke-slate-100" />
      {frac > 0 ? (
        <path
          d={arc(frac)}
          fill="none"
          strokeWidth={14}
          strokeLinecap="round"
          className={target && earned >= target.min ? "stroke-emerald-500" : "stroke-brand-500"}
        />
      ) : null}
      {thresholds.map((t) => {
        const isTarget = target?.tier === t.tier;
        const p1 = at(t.min / scale, r - 11);
        const p2 = at(t.min / scale, r + 11);
        const label = at(t.min / scale, r + 22);
        return (
          <g key={t.tier}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              strokeWidth={isTarget ? 3 : 1.5}
              className={isTarget ? "stroke-violet-600" : "stroke-slate-400"}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-[9px] ${isTarget ? "fill-violet-700 font-semibold" : "fill-slate-500"}`}
            >
              {t.tier} {t.min}
            </text>
          </g>
        );
      })}
      <text x={cx} y={cy - 22} textAnchor="middle" className="fill-slate-900 text-[30px] font-semibold">
        {earned}
      </text>
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-500 text-[10px]">
        of {scale} pts · {reached ? `${reached.tier} reached` : "no level yet"}
      </text>
    </svg>
  );
}
