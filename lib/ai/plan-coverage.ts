import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import { extractDocumentText } from "@/lib/ai/evidence-review";
import type { CoverageEntry, CoverageOutcome } from "@/lib/report/inspection-sheet";

/**
 * Does the uploaded plan address each item of an inspection sheet? One JSON
 * call over the plan's text, answered per item with the sentence that proves
 * it. ADVISORY ONLY, printed in its own column of the sheet, never in the
 * Yes/No cells a human signs for.
 *
 * Grounding, as for the evidence review: a quote is kept only if it is a
 * verbatim span of the plan text (whitespace and case aside). An item whose
 * quote cannot be verified reads "not found", whatever the model claimed.
 * Nothing is stored; the read runs at download time within a time budget.
 */

export interface CoverageItem {
  no: string;
  text: string;
}

/** Characters of plan text sent to the model. */
const MAX_CHARS = 30_000;
/** Longest quote kept. */
const MAX_QUOTE = 240;

const SYSTEM = `You check whether a construction Indoor Air Quality Management Plan (or similar site plan) ADDRESSES each numbered inspection item, for a reviewer who will check your reading.

Return ONLY JSON: {"items": [{"no": string, "covered": boolean, "quote": string}]} with one entry per item number you were given.

Rules:
- "covered" is true only when the plan itself states the measure the item describes, as a commitment or procedure. A general statement of intent ("good indoor air quality will be maintained") does not cover a specific item.
- "quote" must be a VERBATIM span copied from the plan text, under 200 characters, that shows the measure. If you cannot quote it, set covered to false and quote to "".
- Never infer from the item wording, from other items, or from what such plans usually contain. Judge the text you were given only.`;

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Coerce the model's answer into one verified entry per item. */
export function normalizeCoverage(
  raw: unknown,
  items: CoverageItem[],
  planText: string,
): Record<string, CoverageEntry> {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { items?: unknown })?.items)
      ? ((raw as { items: unknown[] }).items)
      : [];
  const byNo = new Map<string, Record<string, unknown>>();
  for (const e of list) {
    if (e && typeof e === "object") {
      const o = e as Record<string, unknown>;
      byNo.set(String(o.no ?? "").trim(), o);
    }
  }
  const haystack = norm(planText);
  const out: Record<string, CoverageEntry> = {};
  for (const it of items) {
    const o = byNo.get(it.no);
    const quote = String(o?.quote ?? "").trim().slice(0, MAX_QUOTE);
    const covered = o?.covered === true && quote.length > 0 && haystack.includes(norm(quote));
    out[it.no] = covered ? { status: "covered", quote } : { status: "not_found", quote: null };
  }
  return out;
}

/** Readable text of the plan files, and which files it came from. */
export async function gatherPlanText(
  files: { filePath: string; fileName: string }[],
): Promise<{ text: string; sources: string[] }> {
  const parts: string[] = [];
  const sources: string[] = [];
  for (const f of files) {
    const t = await extractDocumentText(f.filePath, f.fileName);
    if (t) {
      parts.push(t);
      sources.push(f.fileName);
    }
  }
  return { text: parts.join("\n\n"), sources };
}

/**
 * Run the read. Never throws: every failure is an outcome with a reason the
 * sheet prints in the column header.
 */
export async function planCoverage(
  items: CoverageItem[],
  files: { filePath: string; fileName: string }[],
  opts: { timeoutMs?: number } = {},
): Promise<CoverageOutcome> {
  if (!files.length) return { ran: false, reason: "no plan uploaded yet" };
  if (!hasLLM()) return { ran: false, reason: "no model configured" };
  const { text, sources } = await gatherPlanText(files);
  if (!text) return { ran: false, reason: "the uploaded plan has no readable text (scan or image?)" };

  const truncated = text.length > MAX_CHARS;
  const user = [
    "INSPECTION ITEMS:",
    ...items.map((it) => `${it.no} ${it.text}`),
    "",
    `PLAN TEXT (${sources.join(", ")})${truncated ? " (truncated)" : ""}:`,
    text.slice(0, MAX_CHARS),
  ].join("\n");

  try {
    const raw = await chatJSON<unknown>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      { maxTokens: 2400, signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000) },
    );
    return { ran: true, byItem: normalizeCoverage(raw, items, text), sources };
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" || /abort/i.test((e as Error).message)
      ? "model timed out"
      : `model error: ${(e as Error).message.slice(0, 80)}`;
    return { ran: false, reason: msg };
  }
}
