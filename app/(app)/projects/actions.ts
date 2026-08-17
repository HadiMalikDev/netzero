"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  evidenceDocs,
  projectCredits,
  requirementEntries,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
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

export async function uploadEvidence(formData: FormData): Promise<void> {
  await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const code = String(formData.get("code") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new Error("no file provided");

  const dir = join(UPLOAD_ROOT, projectId, "evidence");
  await mkdir(dir, { recursive: true });
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
  });

  revalidatePath(`/projects/${projectId}/credits/${code}`);
}
