"use server";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  evidenceDocs,
  evidenceReviews,
  projectCredits,
  requirementEntries,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { runEvidenceReview } from "@/lib/ai/evidence-review";
import { createProject, getCreditByCode, WORKSPACE_ID } from "@/lib/data";

const UPLOAD_ROOT = ".data/uploads";

/**
 * Create a project and instantiate its live checklist from a selected canonical
 * catalog version. This is the setup path: manuals are standardized, so a
 * project selects a rating-system version rather than uploading a rulebook.
 */
export async function createProjectFromCatalog(formData: FormData): Promise<void> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required");
  const rsVersionId = String(formData.get("rsVersionId") ?? "").trim();
  if (!rsVersionId) throw new Error("Select a rating-system version");

  const projectId = await createProject({
    name,
    type: (String(formData.get("type") ?? "").trim() || null) as string | null,
    location:
      (String(formData.get("location") ?? "").trim() || null) as string | null,
    rsVersionId,
  });

  const credits = await db
    .select()
    .from(catalogCredits)
    .where(eq(catalogCredits.rsVersionId, rsVersionId));

  for (const c of credits) {
    const pcId = randomUUID();
    await db.insert(projectCredits).values({
      id: pcId,
      workspaceId: WORKSPACE_ID,
      projectId,
      catalogCreditId: c.id,
      status: "not_started",
    });
    const reqs = await db
      .select({ id: catalogRequirements.id })
      .from(catalogRequirements)
      .where(eq(catalogRequirements.catalogCreditId, c.id));
    for (const r of reqs) {
      await db.insert(requirementEntries).values({
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        projectCreditId: pcId,
        catalogRequirementId: r.id,
        status: "not_started",
      });
    }
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectId}/credits`);
}

// ---------- checklist entry updates ----------

/**
 * Save ALL requirement values for a credit at once (one Save button per credit).
 * Reads each entry's value from `bool-/num-/text-<entryId>` fields; the metric
 * type comes from the catalog, so the form only needs the value inputs.
 */
export async function updateCreditEntries(formData: FormData): Promise<void> {
  await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!projectId || !code) throw new Error("missing ids");

  const credit = await getCreditByCode(projectId, code);
  if (!credit) throw new Error("credit not found");
  const now = Math.floor(Date.now() / 1000);

  for (const r of credit.requirements) {
    const patch: {
      valueBool?: boolean | null;
      valueNumber?: number | null;
      valueText?: string | null;
      updatedAt: number;
    } = { updatedAt: now };

    if (r.metricType === "BOOLEAN") {
      patch.valueBool = formData.get(`bool-${r.entryId}`) === "true";
    } else if (r.metricType === "NUMERIC") {
      const raw = String(formData.get(`num-${r.entryId}`) ?? "").trim();
      patch.valueNumber = raw === "" ? null : Number(raw);
    } else if (r.metricType === "DESCRIPTIVE") {
      const raw = String(formData.get(`text-${r.entryId}`) ?? "").trim();
      patch.valueText = raw === "" ? null : raw;
    }

    await db
      .update(requirementEntries)
      .set(patch)
      .where(eq(requirementEntries.id, r.entryId));
  }

  revalidatePath(`/projects/${projectId}/credits/${code}`);
}

/**
 * Attach one or more files to a requirement. Several files can be picked at
 * once, and the same requirement can be added to repeatedly — evidence_doc is
 * a one-to-many on the entry, so uploads accumulate rather than replace.
 */
export async function uploadEvidence(formData: FormData): Promise<void> {
  await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!entryId || !projectId) throw new Error("missing ids");

  const files = formData
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("no file provided");

  // Which required document these files provide, if the upload came from a
  // checklist row. Absent or unparseable means "not assigned to a document".
  const rawSlot = String(formData.get("evidenceSpecIndex") ?? "").trim();
  const slot = /^\d+$/.test(rawSlot) ? Number(rawSlot) : null;

  const dir = join(UPLOAD_ROOT, projectId, "evidence");
  await mkdir(dir, { recursive: true });
  const uploaded: string[] = [];

  for (const file of files) {
    const id = randomUUID();
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
    const filePath = join(dir, `${id}-${safeName}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buf);

    await db.insert(evidenceDocs).values({
      id,
      workspaceId: WORKSPACE_ID,
      requirementEntryId: entryId,
      fileName: file.name,
      filePath,
      fileSize: buf.length,
      evidenceSpecIndex: slot,
    });
    uploaded.push(id);

    // The AI read of the document is queued now and runs after the response,
    // so a slow model never delays the upload. Advisory only — see
    // lib/ai/evidence-review.ts.
    await db.insert(evidenceReviews).values({
      id: randomUUID(),
      workspaceId: WORKSPACE_ID,
      evidenceDocId: id,
      state: "pending",
    });
  }

  after(async () => {
    for (const id of uploaded) await runEvidenceReview(id);
  });

  revalidatePath(`/projects/${projectId}/credits/${code}`);
  revalidatePath(`/projects/${projectId}/documents`);
}

/**
 * Detach an evidence file: remove the row, then the file on disk. Superseded
 * revisions are meant to go away rather than accumulate, so this is a hard
 * delete (see docs/feedback/2026-09-sprint-1/05-delete-attached-file).
 *
 * The row is looked up by id AND workspace, so a crafted POST cannot reach
 * another workspace's file. A missing file on disk is not an error — the row is
 * the thing the UI shows, and leaving it behind would strand it forever.
 */
export async function deleteEvidence(formData: FormData): Promise<void> {
  await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!docId || !projectId) throw new Error("missing ids");

  const [doc] = await db
    .select()
    .from(evidenceDocs)
    .where(
      and(
        eq(evidenceDocs.id, docId),
        eq(evidenceDocs.workspaceId, WORKSPACE_ID),
      ),
    )
    .limit(1);
  if (!doc) throw new Error("evidence not found");

  // The review references the doc, so it goes first.
  await db
    .delete(evidenceReviews)
    .where(eq(evidenceReviews.evidenceDocId, doc.id));
  await db.delete(evidenceDocs).where(eq(evidenceDocs.id, doc.id));
  await rm(doc.filePath, { force: true });

  revalidatePath(`/projects/${projectId}/credits/${code}`);
  revalidatePath(`/projects/${projectId}/documents`);
}

/**
 * Re-run the AI read of one attachment — after replacing a document, or when a
 * previous run failed. Resets the row to pending so the UI shows progress.
 */
export async function rerunEvidenceReview(formData: FormData): Promise<void> {
  await requireUser();
  const docId = String(formData.get("docId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!docId || !projectId) throw new Error("missing ids");

  const [doc] = await db
    .select()
    .from(evidenceDocs)
    .where(
      and(eq(evidenceDocs.id, docId), eq(evidenceDocs.workspaceId, WORKSPACE_ID)),
    )
    .limit(1);
  if (!doc) throw new Error("evidence not found");

  const patch = {
    state: "pending",
    verdict: null,
    summary: null,
    quotes: null,
    gaps: null,
    error: null,
    completedAt: null,
  };
  const updated = await db
    .update(evidenceReviews)
    .set(patch)
    .where(eq(evidenceReviews.evidenceDocId, doc.id))
    .returning({ id: evidenceReviews.id });
  if (updated.length === 0) {
    // Uploaded before reviews existed: give it a row now.
    await db.insert(evidenceReviews).values({
      id: randomUUID(),
      workspaceId: WORKSPACE_ID,
      evidenceDocId: doc.id,
      state: "pending",
    });
  }

  after(() => runEvidenceReview(doc.id));

  revalidatePath(`/projects/${projectId}/credits/${code}`);
}
