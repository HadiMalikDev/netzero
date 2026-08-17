import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import type { ParsedCredit } from "./types";

/**
 * AI-shape layer. Operates ONLY on already-cut chunks and is forbidden from
 * adding requirements, points, or limits. Its sole job is to confirm/refine the
 * `metric_type` (and unit) the deterministic splitter guessed. Deterministic
 * decisions backed by hard evidence (a parsed limits table => NUMERIC) are kept
 * even if the model disagrees. Best-effort: any failure keeps deterministic
 * values, so the pipeline never depends on model availability.
 */

const SYSTEM =
  "You classify Mostadam sustainability requirements. For each requirement you are given, output its metric_type: " +
  "BOOLEAN (a yes/no action is done or not), NUMERIC (a measured value must meet a threshold or limit), or DESCRIPTIVE (a plan/report/document must be produced). " +
  "You MUST NOT invent requirements, points, limits, or units that are not in the provided text. " +
  'Respond ONLY as JSON: {"items":[{"seq":<n>,"metric_type":"BOOLEAN|NUMERIC|DESCRIPTIVE","unit":<string|null>}]}.';

interface ShapeResult {
  items?: { seq: number; metric_type?: string; unit?: string | null }[];
}

function valid(mt: unknown): mt is "BOOLEAN" | "NUMERIC" | "DESCRIPTIVE" {
  return mt === "BOOLEAN" || mt === "NUMERIC" || mt === "DESCRIPTIVE";
}

/** Refine metric types for one credit's requirements in a single call. */
export async function shapeCredit(credit: ParsedCredit): Promise<ParsedCredit> {
  if (!hasLLM() || credit.requirements.length === 0) return credit;

  const payload = credit.requirements.map((r) => ({
    seq: r.seq,
    text: r.text.slice(0, 600),
    has_limits: Boolean(r.numericSpec?.limits?.length),
  }));

  try {
    const res = await chatJSON<ShapeResult>(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Credit ${credit.code} "${credit.title}". Requirements:\n${JSON.stringify(payload)}`,
        },
      ],
      { maxTokens: 400 },
    );
    const byseq = new Map(
      (res.items ?? []).map((i) => [i.seq, i] as const),
    );
    for (const r of credit.requirements) {
      // Never downgrade a requirement that has a hard limits table.
      if (r.numericSpec?.limits?.length) continue;
      const hit = byseq.get(r.seq);
      if (hit && valid(hit.metric_type)) {
        r.metricType = hit.metric_type;
        if (hit.metric_type === "NUMERIC" && hit.unit) r.unit = hit.unit;
      }
    }
  } catch {
    // keep deterministic values
  }
  return credit;
}

/** Shape every credit (bounded concurrency to be gentle on free-tier limits). */
export async function shapeCredits(
  credits: ParsedCredit[],
  concurrency = 3,
): Promise<ParsedCredit[]> {
  if (!hasLLM()) return credits;
  const queue = [...credits];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        for (;;) {
          const c = queue.shift();
          if (!c) break;
          await shapeCredit(c);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return credits;
}
