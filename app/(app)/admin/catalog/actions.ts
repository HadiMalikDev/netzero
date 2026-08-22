"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  parsedCredits,
  parsedRequirements,
  rsVersions,
  sourceDocuments,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { buildReviewNote } from "@/lib/ai/review-notes";
import {
  applyStoredProposal,
  ensureRatingSystem,
  ensureVersion,
  promoteToCatalog,
  saveParsedCredit,
  saveParsedRequirements,
  summarizeSpec,
  WORKSPACE_ID,
  type DraftReqInput,
} from "@/lib/catalog";
import { parseAndStore } from "@/lib/parser";
import { detectManualMeta } from "@/lib/parser/meta";
import { extractPdf } from "@/lib/parser/extract";
import { verifyAndCompleteCredit } from "@/lib/parser/verify";
import { readFile, rm } from "node:fs/promises";

const UPLOAD_ROOT = ".data/uploads/catalog";

/**
 * Upload one or more Mostadam manuals. Metadata (org, scheme, stage, version) is
 * detected FROM each document (LLM-backed, see detectManualMeta) — the user
 * never hand-picks it. Each manual is parsed and routed to its detected
 * rating-system version's review screen.
 */
export async function uploadManuals(formData: FormData): Promise<void> {
  await requireUser();
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Select at least one manual PDF");

  let lastVersionId: string | null = null;

  for (const file of files) {
    const dir = join(UPLOAD_ROOT);
    await mkdir(dir, { recursive: true });
    const id = randomUUID();
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const filePath = join(dir, `${id}-${safeName}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buf);

    await db.insert(sourceDocuments).values({
      id,
      workspaceId: WORKSPACE_ID,
      fileName: file.name,
      filePath,
      fileSize: buf.length,
      status: "uploaded",
    });

    let result;
    try {
      result = await parseAndStore(id);
    } catch {
      continue; // status set to "failed" inside parseAndStore
    }
    if (!result.ok) continue; // rejected (non-Mostadam)

    // Detect catalog metadata from the document itself.
    const meta = await detectManualMeta(result.fullText);
    if (!meta.scheme || !meta.stage) {
      await db
        .update(sourceDocuments)
        .set({
          status: "failed",
          error:
            "Could not determine the scheme/stage from this manual. Detection failed.",
        })
        .where(eq(sourceDocuments.id, id));
      continue;
    }

    const ratingSystemId = await ensureRatingSystem({
      key: meta.ratingSystemKey,
      name: meta.ratingSystemName,
      authority: meta.authority ?? undefined,
      country: meta.country ?? undefined,
    });
    const versionId = await ensureVersion({
      ratingSystemId,
      scheme: meta.scheme,
      stage: meta.stage,
      versionLabel: meta.versionLabel,
      status: "draft",
    });

    await db
      .update(sourceDocuments)
      .set({ rsVersionId: versionId, scheme: meta.scheme, stage: meta.stage })
      .where(eq(sourceDocuments.id, id));
    // The version id isn't known until after parsing, so parseAndStore couldn't
    // persist Table 4's per-scope totals — write them now that it exists.
    if (result.scopeTotals) {
      await db
        .update(rsVersions)
        .set({ scopeTotals: JSON.stringify(result.scopeTotals) })
        .where(eq(rsVersions.id, versionId));
    }
    lastVersionId = versionId;
  }

  revalidatePath("/admin/catalog");
  redirect(
    lastVersionId ? `/admin/catalog/${lastVersionId}/review` : "/admin/catalog",
  );
}

/** Add another manual to an existing version (skips metadata re-detection). */
export async function uploadManualToVersion(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  if (!versionId) throw new Error("versionId required");
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const dir = join(UPLOAD_ROOT, versionId);
    await mkdir(dir, { recursive: true });
    const id = randomUUID();
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const filePath = join(dir, `${id}-${safeName}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buf);
    await db.insert(sourceDocuments).values({
      id,
      workspaceId: WORKSPACE_ID,
      rsVersionId: versionId,
      fileName: file.name,
      filePath,
      fileSize: buf.length,
      status: "uploaded",
    });
    try {
      await parseAndStore(id);
    } catch {
      /* status set inside parseAndStore */
    }
  }
  revalidatePath(`/admin/catalog/${versionId}/review`);
  redirect(`/admin/catalog/${versionId}/review`);
}

/** Re-run the deterministic parser on an already-uploaded file. */
export async function reparseDocument(formData: FormData): Promise<void> {
  await requireUser();
  const documentId = String(formData.get("documentId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  if (!documentId) throw new Error("documentId required");
  await parseAndStore(documentId);
  revalidatePath("/admin/catalog");
  if (versionId) revalidatePath(`/admin/catalog/${versionId}/review`);
  redirect(versionId ? `/admin/catalog/${versionId}/review` : "/admin/catalog");
}

/**
 * Correct a version's label. The scheme/stage/org are detected from the manual,
 * but the version year often lives only on the (non-extractable) cover, so it
 * falls back to "unspecified" and can be set here.
 */
export async function updateVersionLabel(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const label = String(formData.get("versionLabel") ?? "").trim();
  if (!versionId || !label) throw new Error("version label required");
  await db
    .update(rsVersions)
    .set({ versionLabel: label })
    .where(eq(rsVersions.id, versionId));
  revalidatePath(`/admin/catalog/${versionId}`);
}

/**
 * Generate the AI reviewer note for a version's canonical credits (title + aim +
 * page span + requirement labels → a "what to verify" blurb, with a
 * deterministic fallback when no LLM key is set). Skips credits that already
 * have a note unless `regenerate` is set. Sequential to respect free-tier rate
 * limits, mirroring the per-credit verify calls.
 */
export async function generateReviewNotes(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const regenerate = String(formData.get("regenerate") ?? "") === "true";
  if (!versionId) throw new Error("versionId required");

  const credits = await db
    .select()
    .from(catalogCredits)
    .where(eq(catalogCredits.rsVersionId, versionId))
    .orderBy(catalogCredits.categoryCode, catalogCredits.code);

  for (const c of credits) {
    if (c.reviewNote && !regenerate) continue;
    const reqs = await db
      .select({
        title: catalogRequirements.title,
        text: catalogRequirements.text,
      })
      .from(catalogRequirements)
      .where(eq(catalogRequirements.catalogCreditId, c.id))
      .orderBy(catalogRequirements.seq);
    const note = await buildReviewNote({
      code: c.code,
      title: c.title,
      aim: c.aim,
      pageStart: c.sourcePageStart,
      pageEnd: c.sourcePageEnd,
      requirementTitles: reqs
        .map((r) => (r.title || r.text || "").trim())
        .filter(Boolean),
    });
    await db
      .update(catalogCredits)
      .set({ reviewNote: note })
      .where(eq(catalogCredits.id, c.id));
  }

  revalidatePath(`/admin/catalog/${versionId}`);
}

/**
 * Grounded "verify & complete" for ONE credit. Hands the LLM the credit's
 * ACTUAL source pages + the deterministic draft and stores a PROPOSAL
 * (corrections + gap-filled requirements + reasoning). Nothing is applied — a
 * human reviews the diff. Called per-credit by the client so progress is
 * visible; the PDF is extracted once and cached across calls.
 */

// Memoized page extraction so per-credit verify calls don't re-parse the PDF.
const pageCache = new Map<string, Promise<string[]>>();
function loadPages(docId: string, filePath: string): Promise<string[]> {
  let p = pageCache.get(docId);
  if (!p) {
    p = readFile(filePath).then((b) =>
      extractPdf(new Uint8Array(b)).then((x) => x.pages),
    );
    pageCache.set(docId, p);
  }
  return p;
}

export type VerifyCreditResult =
  | { code: string; ok: true; added: number; corrected: number }
  | { code: string; ok: false };

export async function verifyCreditAction(
  parsedCreditId: string,
): Promise<VerifyCreditResult> {
  await requireUser();
  const [credit] = await db
    .select()
    .from(parsedCredits)
    .where(eq(parsedCredits.id, parsedCreditId));
  if (!credit) throw new Error("credit not found");
  const [doc] = await db
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, credit.sourceDocumentId));
  if (!doc) throw new Error("document not found");

  const pages = await loadPages(doc.id, doc.filePath);
  const s = Math.max(0, (credit.pageStart ?? 1) - 1);
  const e = Math.min(pages.length, (credit.pageEnd ?? credit.pageStart ?? 1) + 1);
  const sourceText = pages.slice(s, e).join("\n");

  const reqs = await db
    .select()
    .from(parsedRequirements)
    .where(eq(parsedRequirements.parsedCreditId, parsedCreditId))
    .orderBy(parsedRequirements.seq);

  const proposal = await verifyAndCompleteCredit({
    code: credit.code,
    title: credit.title,
    aim: credit.aim,
    sourceText,
    draft: reqs.map((r) => ({
      seq: r.seq,
      text: r.text,
      metricType: r.metricType,
      pointsRaw: r.pointsRaw,
      measurable: summarizeSpec(r.numericSpec),
    })),
  });
  if (!proposal) return { code: credit.code, ok: false };

  proposal.generatedAt = Date.now();
  await db
    .update(parsedCredits)
    .set({ aiProposal: JSON.stringify(proposal), aiStatus: "proposed" })
    .where(eq(parsedCredits.id, parsedCreditId));

  const changed = proposal.requirements.filter((r) => r.change !== "unchanged");
  return {
    code: credit.code,
    ok: true,
    added: changed.filter((r) => r.change === "added").length,
    corrected: changed.filter((r) => r.change === "corrected").length,
  };
}

/**
 * Delete a document and everything derived from it (drafts, proposals, file),
 * so the PDF can be re-uploaded and retried. Drops the version too if it's now
 * empty (no other documents and nothing promoted to the catalog).
 */
export async function deleteSourceDocument(formData: FormData): Promise<void> {
  await requireUser();
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) throw new Error("documentId required");

  const [doc] = await db
    .select()
    .from(sourceDocuments)
    .where(eq(sourceDocuments.id, documentId));
  if (!doc) redirect("/admin/catalog");

  const credits = await db
    .select({ id: parsedCredits.id })
    .from(parsedCredits)
    .where(eq(parsedCredits.sourceDocumentId, documentId));
  for (const c of credits)
    await db
      .delete(parsedRequirements)
      .where(eq(parsedRequirements.parsedCreditId, c.id));
  await db
    .delete(parsedCredits)
    .where(eq(parsedCredits.sourceDocumentId, documentId));
  await db.delete(sourceDocuments).where(eq(sourceDocuments.id, documentId));
  pageCache.delete(documentId);
  await rm(doc.filePath, { force: true }).catch(() => {});

  // Drop the version if nothing else references it.
  const versionId = doc.rsVersionId;
  if (versionId) {
    const [otherDoc] = await db
      .select({ id: sourceDocuments.id })
      .from(sourceDocuments)
      .where(eq(sourceDocuments.rsVersionId, versionId))
      .limit(1);
    const [promoted] = await db
      .select({ id: catalogCredits.id })
      .from(catalogCredits)
      .where(eq(catalogCredits.rsVersionId, versionId))
      .limit(1);
    if (!otherDoc && !promoted)
      await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
  }

  revalidatePath("/admin/catalog");
  redirect("/admin/catalog");
}

/** Save a reviewer's in-place draft edits (credit + replace-set of requirements). */
export async function saveDraftAction(
  versionId: string,
  parsedCreditId: string,
  payload: {
    title: string;
    pointsRaw: string | null;
    requirements: DraftReqInput[];
  },
): Promise<void> {
  await requireUser();
  if (!parsedCreditId) throw new Error("missing ids");
  await saveParsedCredit(parsedCreditId, {
    title: payload.title,
    pointsRaw: payload.pointsRaw,
  });
  await saveParsedRequirements(parsedCreditId, payload.requirements);
  revalidatePath(`/admin/catalog/${versionId}/review`);
}

/** Apply a credit's AI proposal to its draft requirements (human-accepted). */
export async function applyAiProposal(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const parsedCreditId = String(formData.get("parsedCreditId") ?? "");
  if (!versionId || !parsedCreditId) throw new Error("missing ids");
  await applyStoredProposal(parsedCreditId);
  revalidatePath(`/admin/catalog/${versionId}/review`);
}

/** Accept every proposed credit's AI changes in a document at once. */
export async function applyAllProposals(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!versionId || !documentId) throw new Error("missing ids");

  const proposed = await db
    .select({ id: parsedCredits.id })
    .from(parsedCredits)
    .where(
      and(
        eq(parsedCredits.sourceDocumentId, documentId),
        eq(parsedCredits.aiStatus, "proposed"),
      ),
    );
  for (const c of proposed) await applyStoredProposal(c.id);

  revalidatePath(`/admin/catalog/${versionId}/review`);
}

/** Reject a credit's AI proposal — leave the deterministic draft untouched. */
export async function rejectAiProposal(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const parsedCreditId = String(formData.get("parsedCreditId") ?? "");
  if (!versionId || !parsedCreditId) throw new Error("missing ids");
  await db
    .update(parsedCredits)
    .set({ aiStatus: "rejected" })
    .where(eq(parsedCredits.id, parsedCreditId));
  revalidatePath(`/admin/catalog/${versionId}/review`);
}

/** Publish a version once it has at least one promoted (canonical) credit. */
async function publishIfPopulated(versionId: string): Promise<void> {
  const [any] = await db
    .select({ id: catalogCredits.id })
    .from(catalogCredits)
    .where(eq(catalogCredits.rsVersionId, versionId))
    .limit(1);
  if (any) {
    await db
      .update(rsVersions)
      .set({ status: "published" })
      .where(eq(rsVersions.id, versionId));
  }
}

/** Promote all non-dropped parsed credits of a document into the catalog. */
export async function promoteDocument(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!versionId || !documentId) throw new Error("missing ids");

  const drafts = await db
    .select({ id: parsedCredits.id })
    .from(parsedCredits)
    .where(
      and(
        eq(parsedCredits.sourceDocumentId, documentId),
        eq(parsedCredits.dropped, false),
      ),
    );
  await promoteToCatalog(
    versionId,
    drafts.map((d) => d.id),
  );
  await db
    .update(sourceDocuments)
    .set({ status: "promoted" })
    .where(eq(sourceDocuments.id, documentId));
  await publishIfPopulated(versionId);

  revalidatePath(`/admin/catalog/${versionId}`);
  redirect(`/admin/catalog/${versionId}`);
}

/** Promote a single parsed credit. */
export async function promoteCredit(formData: FormData): Promise<void> {
  await requireUser();
  const versionId = String(formData.get("versionId") ?? "");
  const parsedCreditId = String(formData.get("parsedCreditId") ?? "");
  if (!versionId || !parsedCreditId) throw new Error("missing ids");
  await promoteToCatalog(versionId, [parsedCreditId]);
  await publishIfPopulated(versionId);
  revalidatePath(`/admin/catalog/${versionId}/review`);
}

export async function toggleDropParsed(formData: FormData): Promise<void> {
  await requireUser();
  const parsedCreditId = String(formData.get("parsedCreditId") ?? "");
  const dropped = String(formData.get("dropped") ?? "") === "true";
  const versionId = String(formData.get("versionId") ?? "");
  await db
    .update(parsedCredits)
    .set({ dropped })
    .where(eq(parsedCredits.id, parsedCreditId));
  revalidatePath(`/admin/catalog/${versionId}/review`);
}
