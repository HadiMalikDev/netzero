import { chatJSON, hasLLM } from "@/lib/ai/openrouter";

/**
 * A short "what a reviewer should confirm on pp.X–Y" note for the
 * extraction-review PDF. The note is NOT a source of truth — it only orients a
 * third party who is comparing the extracted catalog against the original
 * manual. Generation is offloaded to the LLM (grounded strictly in the fields we
 * pass), with a deterministic fallback when no key is set or the call fails.
 */

export interface ReviewNoteInput {
  code: string;
  title: string;
  aim: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  requirementTitles: string[];
}

const SYSTEM = `You write a one- to two-sentence note telling a reviewer what to confirm is present for one green-building credit, when they compare an extracted catalog entry against the original manual.
Return ONLY JSON: {"note": string}.
Rules:
- Ground the note STRICTLY in the credit title, aim, and requirement labels provided. Never invent specific thresholds, point values, standards, or requirements not given.
- Phrase it as what the reviewer should check appears on the cited pages (e.g. "Confirm the manual defines ... and lists ...").
- Keep it under 45 words, plain English, no markdown.`;

/** Human-readable page span, or null when no pages are known. */
export function formatPageSpan(
  pageStart: number | null,
  pageEnd: number | null,
): string | null {
  if (pageStart == null) return null;
  if (pageEnd == null || pageEnd === pageStart) return `p.${pageStart}`;
  return `pp.${pageStart}–${pageEnd}`;
}

/**
 * Deterministic note from the fields alone — pure and unit-testable. Used as the
 * LLM fallback and whenever no key is configured.
 */
export function fallbackReviewNote(input: ReviewNoteInput): string {
  const span = formatPageSpan(input.pageStart, input.pageEnd);
  const where = span ? ` on ${span}` : "";
  const base = (input.aim || input.title || "").trim().replace(/\s+/g, " ");
  const aimPart = base
    ? base.length > 220
      ? `${base.slice(0, 217)}…`
      : base
    : `credit ${input.code}`;
  const reqs = input.requirementTitles
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);
  const reqPart = reqs.length
    ? ` Check that these requirements are captured: ${reqs.join("; ")}.`
    : "";
  return `Confirm the manual${where} covers ${input.code} — ${aimPart}.${reqPart}`.trim();
}

/**
 * Build a reviewer note for a credit. Falls back to the deterministic note when
 * the LLM is unavailable, errors, or returns nothing usable.
 */
export async function buildReviewNote(input: ReviewNoteInput): Promise<string> {
  const fallback = fallbackReviewNote(input);
  if (!hasLLM()) return fallback;

  const span = formatPageSpan(input.pageStart, input.pageEnd);
  const reqLines = input.requirementTitles
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((t) => `- ${t}`)
    .join("\n");

  try {
    const res = await chatJSON<{ note?: string }>(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `CREDIT: ${input.code} — ${input.title}`,
            span ? `SOURCE PAGES: ${span}` : "SOURCE PAGES: unknown",
            `AIM: ${input.aim?.trim() || "(not extracted)"}`,
            reqLines
              ? `REQUIREMENT LABELS:\n${reqLines}`
              : "REQUIREMENT LABELS: (none)",
          ].join("\n"),
        },
      ],
      { maxTokens: 160 },
    );
    const note = (res.note ?? "").toString().trim().replace(/\s+/g, " ");
    return note.length >= 12 ? note : fallback;
  } catch {
    return fallback;
  }
}
