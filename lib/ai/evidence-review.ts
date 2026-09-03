import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogRequirements,
  evidenceDocs,
  evidenceReviews,
  requirementEntries,
} from "@/db/schema";
import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import { extractPdf } from "@/lib/parser/extract";

/**
 * Reads one uploaded document against the requirement it was attached to, and
 * says whether it appears to meet that requirement.
 *
 * ADVISORY ONLY. The verdict is never written to requirement or credit status:
 * status stays derived from the values the user entered and the files present
 * (see lib/status.ts). A model opinion must not move a compliance state on its
 * own — a reviewer accepts or dismisses it.
 *
 * Grounding rules, matching the house rule from the catalog parser: the model
 * quotes the document or says nothing. It never invents thresholds, point
 * values or standards that are not in the requirement text it was given.
 */

/** Verdicts the UI knows how to render. Anything else is coerced to "unclear". */
export const VERDICTS = [
  "met",
  "partially_met",
  "not_met",
  "unclear",
  "unreadable",
] as const;
export type Verdict = (typeof VERDICTS)[number];

/** Text types we can read without a converter. */
const PLAIN_TEXT = new Set([".txt", ".md", ".csv", ".json", ".log"]);

/** Characters of document text sent to the model. Keeps one call bounded. */
const MAX_CHARS = 24_000;

export interface ReviewResult {
  verdict: Verdict;
  summary: string;
  quotes: string[];
  gaps: string[];
}

const SYSTEM = `You review a construction/sustainability project document against ONE requirement of a green-building certification credit, for a reviewer who will check your reading.

Return ONLY JSON: {"verdict": string, "summary": string, "quotes": string[], "gaps": string[]}

verdict must be exactly one of: "met", "partially_met", "not_met", "unclear".

Rules:
- Judge ONLY against the requirement text and the expected-documents list you are given. Never invent thresholds, point values, standards, dates or obligations that are not stated there.
- Ground every claim in the document. Each entry of "quotes" must be a VERBATIM span copied from the document text, under 200 characters. If you cannot quote it, do not claim it.
- If the document is unrelated to the requirement, or too little text is present to judge, use "unclear" and say so plainly in the summary. Do not guess.
- "gaps" lists the expected documents or elements you could NOT find evidence of, copied from the expected-documents list where possible. Empty array if none.
- "summary" is at most 60 words, plain English, no markdown, addressed to a reviewer.`;

/** Pull readable text out of an uploaded file, or null when we cannot. */
export async function extractDocumentText(
  filePath: string,
  fileName: string,
): Promise<string | null> {
  const ext = extname(fileName).toLowerCase();
  try {
    if (ext === ".pdf") {
      const buf = await readFile(filePath);
      const { fullText } = await extractPdf(new Uint8Array(buf));
      const trimmed = fullText.trim();
      // A scanned drawing extracts to almost nothing. Say unreadable rather
      // than review a page of whitespace.
      return trimmed.length >= 200 ? trimmed : null;
    }
    if (PLAIN_TEXT.has(ext)) {
      const text = (await readFile(filePath, "utf8")).trim();
      return text.length > 0 ? text : null;
    }
  } catch {
    return null;
  }
  // Images, CAD, Office formats: no extractor wired up.
  return null;
}

/** Coerce whatever the model returned into the shape the UI renders. */
export function normalizeReview(raw: unknown): ReviewResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const v = String(o.verdict ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const verdict = (VERDICTS as readonly string[]).includes(v)
    ? (v as Verdict)
    : "unclear";
  const list = (x: unknown): string[] =>
    Array.isArray(x)
      ? x.map((i) => String(i).trim()).filter(Boolean).slice(0, 8)
      : [];
  return {
    // "unreadable" is decided by the extractor, never by the model.
    verdict: verdict === "unreadable" ? "unclear" : verdict,
    summary: String(o.summary ?? "").trim().slice(0, 600),
    quotes: list(o.quotes).map((q) => q.slice(0, 200)),
    gaps: list(o.gaps),
  };
}

/**
 * Run the review for one evidence file and store the outcome. Safe to call in
 * the background: it never throws, and records a failure row instead.
 */
export async function runEvidenceReview(evidenceDocId: string): Promise<void> {
  const finish = async (patch: Record<string, unknown>) => {
    await db
      .update(evidenceReviews)
      .set({ ...patch, completedAt: Math.floor(Date.now() / 1000) })
      .where(eq(evidenceReviews.evidenceDocId, evidenceDocId));
  };

  try {
    const [row] = await db
      .select({
        filePath: evidenceDocs.filePath,
        fileName: evidenceDocs.fileName,
        reqText: catalogRequirements.text,
        reqTitle: catalogRequirements.title,
        evidenceSpecs: catalogRequirements.evidenceSpecs,
        specIndex: evidenceDocs.evidenceSpecIndex,
      })
      .from(evidenceDocs)
      .innerJoin(
        requirementEntries,
        eq(evidenceDocs.requirementEntryId, requirementEntries.id),
      )
      .innerJoin(
        catalogRequirements,
        eq(requirementEntries.catalogRequirementId, catalogRequirements.id),
      )
      .where(eq(evidenceDocs.id, evidenceDocId))
      .limit(1);

    if (!row) {
      await finish({ state: "failed", error: "evidence not found" });
      return;
    }

    if (!hasLLM()) {
      await finish({
        state: "failed",
        error: "No model configured — set OPENROUTER_API_KEY to enable review.",
      });
      return;
    }

    const text = await extractDocumentText(row.filePath, row.fileName);
    if (!text) {
      await finish({
        state: "done",
        verdict: "unreadable",
        summary:
          "No text could be read from this file — it may be a scan, an image, or a format the reviewer cannot open automatically. Check it by hand.",
        quotes: "[]",
        gaps: "[]",
      });
      return;
    }

    const specs: string[] = row.evidenceSpecs
      ? (JSON.parse(row.evidenceSpecs) as string[])
      : [];
    // When the upload claimed a specific expected document, judge against that
    // one; otherwise against the whole list.
    const claimed =
      row.specIndex != null && row.specIndex < specs.length
        ? [specs[row.specIndex]]
        : specs;

    const truncated = text.length > MAX_CHARS;
    const user = [
      `REQUIREMENT${row.reqTitle ? ` — ${row.reqTitle}` : ""}:`,
      row.reqText,
      "",
      claimed.length
        ? `EXPECTED DOCUMENTS:\n${claimed.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : "EXPECTED DOCUMENTS: (none listed in the manual)",
      "",
      `DOCUMENT "${row.fileName}"${truncated ? " (truncated)" : ""}:`,
      text.slice(0, MAX_CHARS),
    ].join("\n");

    const raw = await chatJSON<unknown>(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      { maxTokens: 900 },
    );
    const result = normalizeReview(raw);

    await finish({
      state: "done",
      verdict: result.verdict,
      summary: result.summary,
      quotes: JSON.stringify(result.quotes),
      gaps: JSON.stringify(result.gaps),
      model: process.env.OPENROUTER_MODEL ?? null,
    });
  } catch (e) {
    await finish({
      state: "failed",
      error: (e as Error).message.slice(0, 300),
    });
  }
}
