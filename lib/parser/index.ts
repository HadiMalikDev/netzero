import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  parsedCredits,
  parsedRequirements,
  rsVersions,
  sourceDocuments,
} from "@/db/schema";
import { extractPdf } from "./extract";
import { mostadamGate, parseKeystoneTable, parseScopeTotals } from "./mostadam";
import { reconcile, type ReconcileReport } from "./reconcile";
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
  // Per-scope point denominators from the manual's Table 4 (null if none).
  scopeTotals: Record<string, number> | null;
  // Reconcile-or-fail self-check against the manual's own totals (null if gated).
  reconciliation: ReconcileReport | null;
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
      x.requirements.reduce((n, r) => n + r.evidence.length, 0) +
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
      scopeTotals: null,
      reconciliation: null,
    };
  }
  let credits = splitCredits(ext.pages, gate.scheme!, gate.stage!);
  credits = dedupeWithinDoc(credits);

  // Document-wide overrides: the manual's Keystone Credits table is the
  // authoritative source for keystone status and category display names.
  const { keystoneCodes, categoryNames } = parseKeystoneTable(ext.fullText);
  for (const c of credits) {
    c.isKeystone = keystoneCodes.has(c.code);
    const detected = categoryNames.get(c.categoryCode);
    if (detected) c.categoryName = detected;
  }

  // Per-scope denominators (Table 4), keyed by the scopes the credit matrices
  // actually use, in their document order.
  const scopeOrder: string[] = [];
  for (const c of credits) {
    if (!c.applicability) continue;
    for (const s of Object.keys(c.applicability))
      if (!scopeOrder.includes(s)) scopeOrder.push(s);
  }
  const scopeTotals = parseScopeTotals(ext.fullText, scopeOrder);

  // Reconcile-or-fail: self-validate against the manual's own totals and stamp
  // each credit with its flag so the reviewer sees where extraction disagrees.
  const reconciliation = reconcile(credits, scopeTotals);
  for (const c of credits) c.reconciliation = reconciliation.credits[c.code] ?? null;

  if (opts.shape) credits = await shapeCredits(credits);
  return {
    ok: true,
    scheme: gate.scheme,
    stage: gate.stage,
    pageCount: ext.pageCount,
    fullText: ext.fullText,
    credits,
    scopeTotals,
    reconciliation,
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
        applicability: c.applicability ? JSON.stringify(c.applicability) : null,
        supportingGuidance: c.supportingGuidance,
        toolRef: c.creditTool,
        reconciliation: c.reconciliation ? JSON.stringify(c.reconciliation) : null,
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
          pointsType: r.pointsType,
          optionGroup: r.optionGroup,
          keystone: r.keystone,
          keystoneCondition: r.keystoneCondition,
          numericSpec: r.numericSpec ? JSON.stringify(r.numericSpec) : null,
          evidence: JSON.stringify(r.evidence),
          // Back-compat flat list (deprecated) derived from staged evidence.
          evidenceSpecs: JSON.stringify(r.evidence.map((e) => e.text)),
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

    // Table 4 denominators are a document-wide fact — record them on the version
    // this parse belongs to, so reconcile/forecast can use them later.
    if (doc.rsVersionId && result.scopeTotals) {
      await db
        .update(rsVersions)
        .set({ scopeTotals: JSON.stringify(result.scopeTotals) })
        .where(eq(rsVersions.id, doc.rsVersionId));
    }

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
