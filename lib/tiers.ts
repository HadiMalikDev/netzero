import { parseNum } from "./num";
import { reduceByOption } from "./option-group";

/**
 * Mostadam rating levels and a project's position against them. Thresholds
 * live on the rating-system version (rs_version.tier_thresholds), never in a
 * component: they differ by scheme, stage and scope. Full Scope only for now.
 *
 * Per the manual (§2.5), no rating level is awarded until every keystone credit
 * is achieved, whatever the points total.
 */

export interface TierThreshold {
  tier: string;
  min: number;
}

/** Stored JSON → thresholds sorted lowest first. Tolerant of null and junk. */
export function parseThresholds(raw: string | null | undefined): TierThreshold[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .map((t) => ({ tier: String(t?.tier ?? "").trim(), min: Number(t?.min) }))
      .filter((t) => t.tier && Number.isFinite(t.min))
      .sort((a, b) => a.min - b.min);
  } catch {
    return [];
  }
}

/** The highest level whose threshold `points` reaches, ignoring keystones. */
export function tierForPoints(
  points: number,
  thresholds: TierThreshold[],
): TierThreshold | null {
  let reached: TierThreshold | null = null;
  for (const t of thresholds) if (points >= t.min) reached = t;
  return reached;
}

/** The level actually awarded: none while any keystone credit is incomplete. */
export function tierReached(
  points: number,
  thresholds: TierThreshold[],
  keystonesComplete: boolean,
): TierThreshold | null {
  return keystonesComplete ? tierForPoints(points, thresholds) : null;
}

export interface PointsSpan {
  min: number;
  max: number;
}

interface CreditPoints {
  pointsMax: number | null;
  pointsMin: number | null;
  pointsEarned: number;
  pointsRaw?: string | null;
  isKeystone: boolean;
  status: string;
  targeted: boolean;
  requirements: { pointsRaw: string | null; optionGroup?: string | null }[];
}

/**
 * A credit's available points as a span: its banded floor (if any) up to its
 * Total. When the catalog has no credit Total, fall back to its requirements'
 * points (either/or groups count once, at their best option).
 */
export function creditSpan(c: CreditPoints): PointsSpan {
  const max =
    c.pointsMax ??
    reduceByOption(c.requirements, (r) => parseNum(r.pointsRaw) ?? 0);
  return { min: Math.min(c.pointsMin ?? max, max), max };
}

export function formatSpan(s: PointsSpan): string {
  return s.min === s.max ? String(s.max) : `${s.min}–${s.max}`;
}

export interface ProjectPoints {
  earned: number;
  available: PointsSpan;
  targeted: PointsSpan;
  keystones: { total: number; complete: number };
}

/** Roll a project's credits up into the numbers the dial and export show. */
export function projectPoints(credits: CreditPoints[]): ProjectPoints {
  const out: ProjectPoints = {
    earned: 0,
    available: { min: 0, max: 0 },
    targeted: { min: 0, max: 0 },
    keystones: { total: 0, complete: 0 },
  };
  for (const c of credits) {
    const span = creditSpan(c);
    out.earned += c.pointsEarned;
    out.available.min += span.min;
    out.available.max += span.max;
    if (c.targeted) {
      out.targeted.min += span.min;
      out.targeted.max += span.max;
    }
    if (c.isKeystone) {
      out.keystones.total++;
      if (c.status === "completed") out.keystones.complete++;
    }
  }
  return out;
}
