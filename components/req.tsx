import { bandPointsRange, formatPointsSpan } from "@/lib/points";

/** Human labels for the three metric types (rendered by MetricBadge). */
const METRIC_LABEL: Record<string, string> = {
  BOOLEAN: "Yes/No",
  NUMERIC: "Measured value",
  DESCRIPTIVE: "Document / text",
};

/**
 * The metric-type pill (Yes/No · Measured value · Document / text). One look
 * for every requirement view; pass `className` to layer a diff highlight on top.
 */
export function MetricBadge({
  metricType,
  className = "",
}: {
  metricType: string;
  className?: string;
}) {
  return (
    <span
      className={`rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500 ${className}`.trim()}
    >
      {METRIC_LABEL[metricType] ?? metricType}
    </span>
  );
}

/** Violet "either/or" pill shown on requirements that belong to an XOR option. */
export function OptionBadge() {
  return (
    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700">
      Option (either/or)
    </span>
  );
}

/** Amber "Keystone" pill (compact 10px variant). */
export function KeystoneBadge() {
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
      Keystone
    </span>
  );
}

/**
 * The points summary shown in a requirement header: a band range ("2–4 pts
 * depending on value") when the row is scaled, else the flat point count.
 */
export function PointsRange({
  spec,
  pointsRaw,
}: {
  spec: unknown;
  pointsRaw: string | null;
}) {
  const range = bandPointsRange(spec);
  if (range)
    return (
      <span className="text-xs text-slate-400">
        {formatPointsSpan(range.min, range.max)} pts depending on value
      </span>
    );
  if (!pointsRaw) return null;
  return (
    <span className="text-xs text-slate-400">
      {pointsRaw} pt{pointsRaw === "1" ? "" : "s"}
    </span>
  );
}
