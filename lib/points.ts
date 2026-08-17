import { groupByOption } from "./option-group";
import type { BandSet, ScoreBand } from "./parser/types";
import type { Status } from "./status";

export function bandsFromSpec(spec: unknown): BandSet[] {
  if (!spec || typeof spec !== "object") return [];
  const bands = (spec as { bands?: BandSet[] }).bands;
  if (!Array.isArray(bands)) return [];
  return bands.filter((s) => Array.isArray(s?.bands) && s.bands.length > 0);
}

export function firstBands(spec: unknown): ScoreBand[] {
  return bandsFromSpec(spec)[0]?.bands ?? [];
}

/** Min–max points on the first band set, or null if the row is not scaled. */
export function bandPointsRange(
  spec: unknown,
): { min: number; max: number } | null {
  const bands = firstBands(spec);
  if (bands.length < 2) return null;
  const pts = bands.map((b) => b.points);
  return { min: Math.min(...pts), max: Math.max(...pts) };
}

/** Credit-level available range when any requirement is scaled. */
export function creditPointsRange(
  reqs: { numericSpec?: unknown }[],
  creditMax: string | null,
): { min: number; max: number } | null {
  let min: number | null = null;
  let maxBand: number | null = null;
  for (const r of reqs) {
    const range = bandPointsRange(r.numericSpec);
    if (!range) continue;
    min = min == null ? range.min : Math.min(min, range.min);
    maxBand = maxBand == null ? range.max : Math.max(maxBand, range.max);
  }
  if (min == null) return null;
  const cap = num(creditMax);
  return { min, max: cap ?? maxBand! };
}

export function formatPointsSpan(min: number, max: number): string {
  return min === max ? String(max) : `${min}–${max}`;
}

/** Highest band whose min is <= value. Below the first band → 0. */
export function pointsForValue(bands: ScoreBand[], value: number): number {
  if (!Number.isFinite(value) || bands.length === 0) return 0;
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  let pts = 0;
  for (const b of sorted) {
    if (value >= b.min) pts = b.points;
  }
  return pts;
}

function num(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface PointsReq {
  metricType: string;
  pointsRaw: string | null;
  optionGroup?: string | null;
  numericSpec?: unknown;
  valueNumber?: number | null;
  status: Status;
}

/**
 * Preview uses a typed number immediately. Earned requires completed
 * (value + evidence when the catalog listed any).
 */
export function pointsAwarded(
  req: PointsReq,
  mode: "preview" | "earned",
): number {
  const completed = req.status === "completed";
  if (req.metricType === "NUMERIC") {
    const bands = firstBands(req.numericSpec);
    if (bands.length) {
      if (req.valueNumber == null) return 0;
      const look = pointsForValue(bands, req.valueNumber);
      return mode === "earned" && !completed ? 0 : look;
    }
    return completed ? (num(req.pointsRaw) ?? 0) : 0;
  }
  return completed ? (num(req.pointsRaw) ?? 0) : 0;
}

/** XOR groups contribute MAX; everything else sums; then cap at credit Total. */
export function creditPointsEarned(
  reqs: PointsReq[],
  creditMax: string | null,
  mode: "earned" | "preview" = "earned",
): number {
  const blocks = groupByOption(reqs);
  let sum = 0;
  for (const b of blocks) {
    if (b.kind === "xor")
      sum += Math.max(0, ...b.items.map((r) => pointsAwarded(r, mode)));
    else sum += pointsAwarded(b.item, mode);
  }
  const cap = num(creditMax);
  return cap == null ? sum : Math.min(cap, sum);
}
