import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import { cleanText } from "./text";

/**
 * Grounded "verify & complete" pass. Given a credit's ACTUAL source pages plus
 * the deterministic parser's draft, the LLM (a) verifies/corrects the draft and
 * (b) fills requirements the parser missed — but ONLY from the provided source
 * text. It never invents; an "added" requirement must appear in the source. The
 * result is a PROPOSAL (with reasoning) for a human to accept/reject — nothing is
 * applied here.
 */

export type ChangeKind = "unchanged" | "corrected" | "added";

export interface ProposedRequirement {
  seq: number;
  change: ChangeKind;
  proposed: {
    title: string | null; // short label, e.g. "Dynamic energy modeling"
    text: string;
    metricType: "BOOLEAN" | "NUMERIC" | "DESCRIPTIVE";
    unit: string | null;
    pointsRaw: string | null;
    // Short measurable target, e.g. ">= 45% improvement". null if none.
    measurable: string | null;
  };
  reasoning: string;
}

export interface CreditProposal {
  requirements: ProposedRequirement[];
  generatedAt: number;
}

export interface DraftRequirementInput {
  seq: number;
  text: string;
  metricType: string;
  pointsRaw: string | null;
  measurable: string | null; // the draft's current target (often none)
}

export interface VerifyInput {
  code: string;
  title: string;
  aim: string | null;
  sourceText: string;
  draft: DraftRequirementInput[];
}

const SYSTEM = `You reconcile a rule-based parser's draft against the ORIGINAL source text of one Mostadam credit.
You are given the credit's source pages and the parser's draft requirements.
Return the FINAL list of requirements for this credit, each classified:
- "unchanged": the draft's text, metric_type, points AND measurable target all already match the source — nothing to change.
- "corrected": ANY field differs from the draft, INCLUDING adding a measurable target the draft was missing (draft measurable = null but the source states one) — return the corrected values.
- "added": a requirement that IS in the source but the parser missed entirely.
For each requirement provide:
- seq (POSITIVE integer, keep the manual's numbering; new ones continue after the last, e.g. next is max+1),
- title: a short 3-6 word label naming the requirement (e.g. "Dynamic energy modeling", "IAQ Management Plan"). This is a label, NOT a summary — do not restate the whole requirement.
- metric_type: "NUMERIC" (measurable threshold/limit), "BOOLEAN" (yes/no action), or "DESCRIPTIVE" (a plan/document, no single number),
- unit (string or null),
- points_raw (string or null — the requirement's point value from the source),
- measurable: a SHORT target string exactly as the source supports (e.g. ">= 45% improvement", "<= 27 ug/m3"), or null,
- reasoning: one sentence justifying the classification, citing what the source says.
HARD RULES: Use ONLY the provided source text. NEVER invent a requirement, number, unit, or target not present in it. If the source supports the draft, mark it "unchanged".
Respond ONLY as JSON: {"requirements":[{"seq","change","title","metric_type","unit","points_raw","text","measurable","reasoning"}]}.`;

interface RawReq {
  seq?: number;
  change?: string;
  title?: string | null;
  metric_type?: string;
  unit?: string | null;
  points_raw?: string | null;
  text?: string;
  measurable?: string | null;
  reasoning?: string;
}

function normType(v: unknown): "BOOLEAN" | "NUMERIC" | "DESCRIPTIVE" {
  const s = String(v ?? "").toUpperCase();
  return s === "NUMERIC" || s === "BOOLEAN" ? s : "DESCRIPTIVE";
}

function normChange(v: unknown): ChangeKind {
  const s = String(v ?? "").toLowerCase();
  return s === "corrected" || s === "added" ? s : "unchanged";
}

export async function verifyAndCompleteCredit(
  input: VerifyInput,
): Promise<CreditProposal | null> {
  if (!hasLLM()) return null;
  try {
    const res = await chatJSON<{ requirements?: RawReq[] }>(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            `CREDIT ${input.code} "${input.title}".` +
            (input.aim ? ` Aim: ${input.aim.slice(0, 300)}.` : "") +
            `\n\nPARSER DRAFT (may be wrong or incomplete):\n${JSON.stringify(
              input.draft.map((d) => ({
                seq: d.seq,
                text: d.text.slice(0, 500),
                metric_type: d.metricType,
                points_raw: d.pointsRaw,
                measurable: d.measurable,
              })),
            )}` +
            `\n\nSOURCE TEXT:\n${input.sourceText.slice(0, 16000)}`,
        },
      ],
      { maxTokens: 2600 },
    );
    const items = (res.requirements ?? [])
      .filter((r) => typeof r.seq === "number")
      .map((r) => ({
        seq: r.seq as number,
        change: normChange(r.change),
        proposed: {
          title: r.title?.toString().trim() || null,
          text: cleanText(r.text ?? ""),
          metricType: normType(r.metric_type),
          unit: r.unit?.toString().trim() || null,
          pointsRaw: r.points_raw?.toString().trim() || null,
          measurable: r.measurable?.toString().trim() || null,
        },
        reasoning: cleanText(r.reasoning ?? ""),
      }));
    if (items.length === 0) return null;

    // Never let a bad model seq (e.g. -1) through: any non-positive seq gets a
    // fresh number after the current max, so added rows sort correctly.
    let maxSeq = Math.max(
      0,
      ...input.draft.map((d) => d.seq),
      ...items.map((i) => (i.seq > 0 ? i.seq : 0)),
    );
    for (const it of items) if (it.seq <= 0) it.seq = ++maxSeq;

    return { generatedAt: 0, requirements: items };
  } catch {
    return null;
  }
}
