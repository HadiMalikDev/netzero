import { eq } from "drizzle-orm";
import { db } from "@/db";
import { requirementEntries } from "@/db/schema";
import { getCreditByCode } from "@/lib/data";
import { todayIso } from "./expiry";
import { partByKey } from "./parts";
import { creditProgress } from "./progress";

/** What "Use this value" did to one requirement. */
export type AppliedEntry =
  | { seq: number; kind: "number"; value: number }
  | { seq: number; kind: "ticked" | "left"; threshold: number };

export interface Applied {
  /** The share that was used, in %. */
  pct: number;
  entries: AppliedEntry[];
}

/**
 * "Use this value" (D15): copy a calculated share into the credit's own
 * requirement, only when a person asks. A number requirement gets the share
 * (one decimal). A yes/no one is ticked when its threshold is met and left as
 * it is when not, so a share below the threshold never unticks what someone
 * ticked by hand (D41); RC-01 has one yes/no requirement per threshold.
 * Returns what happened to each requirement, or null when there is no share
 * to use.
 */
export async function applyPartValue(
  projectId: string,
  creditCode: string,
  partKey: string,
  which: "forecast" | "actual",
): Promise<Applied | null> {
  const part = partByKey(partKey);
  if (!part || part.creditCode !== creditCode || !part.requirementSeqs.length) return null;
  const credit = await getCreditByCode(projectId, creditCode);
  if (!credit) return null;
  const [result] = await creditProgress(projectId, todayIso().slice(0, 7), creditCode).then((rs) => rs.filter((r) => r.part.key === partKey));
  const share = which === "actual" ? result?.actual : result?.forecast;
  if (!share || share.pct == null) return null;

  const entries: AppliedEntry[] = [];
  for (const [i, seq] of part.requirementSeqs.entries()) {
    const req = credit.requirements.find((r) => r.seq === seq);
    if (!req) continue;
    const now = Math.floor(Date.now() / 1000);
    if (req.metricType === "NUMERIC") {
      const value = Math.round(share.pct * 10) / 10;
      await db.update(requirementEntries).set({ valueNumber: value, updatedAt: now }).where(eq(requirementEntries.id, req.entryId));
      entries.push({ seq, kind: "number", value });
    } else if (req.metricType === "BOOLEAN") {
      const threshold = part.thresholds[i] ?? part.thresholds[0];
      if (share.pct >= threshold - 1e-9) {
        await db.update(requirementEntries).set({ valueBool: true, updatedAt: now }).where(eq(requirementEntries.id, req.entryId));
        entries.push({ seq, kind: "ticked", threshold });
      } else {
        entries.push({ seq, kind: "left", threshold });
      }
    }
  }
  return entries.length ? { pct: share.pct, entries } : null;
}

const pctText = (n: number) => `${Math.round(n * 10) / 10}%`;

/** The confirmation shown beside the buttons after "Use this value" (D41). */
export function describeApplied(applied: Applied, which: "forecast" | "actual"): string {
  const share = `The ${which} share, ${pctText(applied.pct)}`;
  return applied.entries
    .map((e) =>
      e.kind === "number"
        ? `${share}, was written into requirement #${e.seq}.`
        : e.kind === "ticked"
          ? `${pctText(applied.pct)} meets ${e.threshold}%: requirement #${e.seq} is marked done.`
          : `${pctText(applied.pct)} is below ${e.threshold}%: requirement #${e.seq} was left as it was.`,
    )
    .join(" ");
}
