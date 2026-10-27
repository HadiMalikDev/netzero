import { eq } from "drizzle-orm";
import { db } from "@/db";
import { requirementEntries } from "@/db/schema";
import { getCreditByCode } from "@/lib/data";
import { todayIso } from "./expiry";
import { partByKey } from "./parts";
import { creditProgress } from "./progress";

/**
 * "Use this value" (D15): copy a calculated share into the credit's own
 * requirement, only when a person asks. A number requirement gets the share
 * (one decimal); a yes/no one gets whether its threshold is met — RC-01 has
 * one yes/no requirement per threshold. Returns what was written, or null.
 */
export async function applyPartValue(
  projectId: string,
  creditCode: string,
  partKey: string,
  which: "forecast" | "actual",
): Promise<{ seq: number; value: number | boolean }[] | null> {
  const part = partByKey(partKey);
  if (!part || part.creditCode !== creditCode || !part.requirementSeqs.length) return null;
  const credit = await getCreditByCode(projectId, creditCode);
  if (!credit) return null;
  const [result] = await creditProgress(projectId, todayIso().slice(0, 7), creditCode).then((rs) => rs.filter((r) => r.part.key === partKey));
  const share = which === "actual" ? result?.actual : result?.forecast;
  if (!share || share.pct == null) return null;

  const written: { seq: number; value: number | boolean }[] = [];
  for (const [i, seq] of part.requirementSeqs.entries()) {
    const req = credit.requirements.find((r) => r.seq === seq);
    if (!req) continue;
    const now = Math.floor(Date.now() / 1000);
    if (req.metricType === "NUMERIC") {
      const value = Math.round(share.pct * 10) / 10;
      await db.update(requirementEntries).set({ valueNumber: value, updatedAt: now }).where(eq(requirementEntries.id, req.entryId));
      written.push({ seq, value });
    } else if (req.metricType === "BOOLEAN") {
      const value = share.pct >= (part.thresholds[i] ?? part.thresholds[0]) - 1e-9;
      await db.update(requirementEntries).set({ valueBool: value, updatedAt: now }).where(eq(requirementEntries.id, req.entryId));
      written.push({ seq, value });
    }
  }
  return written.length ? written : null;
}
