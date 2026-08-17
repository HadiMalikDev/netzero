import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { parsedCredits, parsedRequirements, sourceDocuments } from "@/db/schema";
import { extractPdf } from "./extract";
import { mostadamGate } from "./mostadam";
import { shapeCredits } from "./shape";
import { splitCredits } from "./split";
import type { ParsedCredit } from "./types";

export interface ParseResult {
  ok: boolean;
  reason?: string;
  scheme: string | null;
  stage: string | null;
  pageCount: number;
  fullText: string;
  credits: ParsedCredit[];
}

/**
 * Keep the most complete instance when a code appears twice in ONE document
 * (e.g. the manual's "Credit layout" worked example duplicates a real credit).
 * Cross-document conflicts are handled separately at confirm/merge time.
 */
function dedupeWithinDoc(credits: ParsedCredit[]): ParsedCredit[] {
  const best = new Map<string, ParsedCredit>();
  for (const c of credits) {
    const prev = best.get(c.code);
    if (!prev) {
      best.set(c.code, c);
      continue;
    }
    const score = (x: ParsedCredit) =>
      x.requirements.length * 10 +
      x.requirements.reduce((n, r) => n + r.evidenceSpecs.length, 0) +
      (x.aim ? 1 : 0);
    // Tie favours the later page (real credits follow the intro example).
    if (score(c) >= score(prev)) best.set(c.code, c);
  }
  // Preserve original order by first appearance of each kept credit.
  const seen = new Set<string>();
  const out: ParsedCredit[] = [];
  for (const c of credits) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    out.push(best.get(c.code)!);
  }
  return out;
}

/** Pure parse: no DB. Used by tests and the store step. */
export async function parseManual(
  data: Uint8Array,
  opts: { shape?: boolean } = {},
): Promise<ParseResult> {
  const ext = await extractPdf(data);
  const gate = mostadamGate(ext.fullText, ext.pages);
  if (!gate.ok) {
    return {
      ok: false,
      reason: gate.reason,
      scheme: gate.scheme,
      stage: gate.stage,
      pageCount: ext.pageCount,
      fullText: ext.fullText,
      credits: [],
    };
  }
  let credits = splitCredits(ext.pages, gate.scheme!, gate.stage!);
  credits = dedupeWithinDoc(credits);
  if (opts.shape) credits = await shapeCredits(credits);
  return {
    ok: true,
    scheme: gate.scheme,
    stage: gate.stage,
    pageCount: ext.pageCount,
    fullText: ext.fullText,
    credits,
  };
}

/**
 * Parse a stored source document and persist DRAFT catalog rows (confirmed=0).
 * Updates the source_document status: parsing -> parsed | rejected | failed.
 */
export async function parseAndStore(sourceDocumentId: string): Promise<ParseResult> {
  const [doc] = await db
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, sourceDocumentId));
  if (!doc) throw new Error("source document not found");

  await db
    .update(sourceDocuments)
    .set({ status: "parsing", error: null })
    .where(eq(sourceDocuments.id, doc.id));

  try {
    const data = new Uint8Array(await readFile(doc.filePath));
    // Deterministic parse runs synchronously (fast, reliable). AI-shape is a
    // separate on-demand refinement (see shapeDocument) so a slow/rate-limited
    // free model never stalls the upload.
    const result = await parseManual(data, { shape: false });

    if (!result.ok) {
      await db
        .update(sourceDocuments)
        .set({
          status: "rejected",
          error: result.reason,
          scheme: result.scheme,
          stage: result.stage,
          pageCount: result.pageCount,
        })
        .where(eq(sourceDocuments.id, doc.id));
      return result;
    }

    // Replace any prior draft rows for this document (idempotent re-parse).
    const prior = await db
      .select({ id: parsedCredits.id })
      .from(parsedCredits)
      .where(eq(parsedCredits.sourceDocumentId, doc.id));
    for (const p of prior) {
      await db
        .delete(parsedRequirements)
        .where(eq(parsedRequirements.parsedCreditId, p.id));
    }
    await db
      .delete(parsedCredits)
      .where(eq(parsedCredits.sourceDocumentId, doc.id));

    for (const c of result.credits) {
      const creditId = randomUUID();
      await db.insert(parsedCredits).values({
        id: creditId,
        workspaceId: doc.workspaceId,
        sourceDocumentId: doc.id,
        scheme: c.scheme,
        stage: c.stage,
        code: c.code,
        categoryCode: c.categoryCode,
        categoryName: c.categoryName,
        title: c.title,
        isKeystone: c.isKeystone,
        pointsRaw: c.pointsRaw,
        aim: c.aim,
        references: JSON.stringify(c.references),
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
      });
      for (const r of c.requirements) {
        await db.insert(parsedRequirements).values({
          id: randomUUID(),
          workspaceId: doc.workspaceId,
          parsedCreditId: creditId,
          seq: r.seq,
          title: r.title,
          text: r.text,
          metricType: r.metricType,
          unit: r.unit,
          pointsRaw: r.pointsRaw,
          numericSpec: r.numericSpec ? JSON.stringify(r.numericSpec) : null,
          evidenceSpecs: JSON.stringify(r.evidenceSpecs),
          pageStart: r.pageStart,
          pageEnd: r.pageEnd,
        });
      }
    }

    await db
      .update(sourceDocuments)
      .set({
        status: "parsed",
        error: null,
        scheme: result.scheme,
        stage: result.stage,
        pageCount: result.pageCount,
        rawText: result.fullText.slice(0, 2_000_000),
      })
      .where(eq(sourceDocuments.id, doc.id));

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .update(sourceDocuments)
      .set({ status: "failed", error: message })
      .where(eq(sourceDocuments.id, doc.id));
    throw e;
  }
}
