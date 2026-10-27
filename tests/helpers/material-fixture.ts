import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  requirementEntries,
  evidenceDocs,
  materialProducts,
  materialSubmittals,
  projectCredits,
  projects,
  ratingSystems,
  rsVersions,
  smqTemplates,
  workspaces,
} from "@/db/schema";
import { WORKSPACE_ID } from "@/lib/catalog";

/** The credits a material test project is set up with, by code. */
export const FIXTURE_CODES = ["MW-04", "MW-05", "HC-11", "RC-01", "SS-05"] as const;

/**
 * A throwaway project on its own catalog version with the material credits,
 * for database tests. `setup` inserts it; `teardown` removes everything the
 * tests hung off it (questionnaire copy, submittals, products, files).
 */
export function materialFixture() {
  const rsId = randomUUID();
  const versionId = randomUUID();
  const projectId = randomUUID();
  const pcByCode = new Map<string, string>();

  async function setup(codes: readonly string[] = FIXTURE_CODES) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, WORKSPACE_ID));
    if (!ws) await db.insert(workspaces).values({ id: WORKSPACE_ID, name: "Test" });
    await db.insert(ratingSystems).values({ id: rsId, workspaceId: WORKSPACE_ID, key: `t-${rsId}`, name: "T" });
    await db.insert(rsVersions).values({
      id: versionId,
      workspaceId: WORKSPACE_ID,
      ratingSystemId: rsId,
      scheme: "commercial",
      stage: "D+C",
      versionLabel: `t-${versionId}`,
    });
    for (const code of codes) {
      const creditId = randomUUID();
      await db.insert(catalogCredits).values({
        id: creditId,
        workspaceId: WORKSPACE_ID,
        rsVersionId: versionId,
        code,
        title: code,
        categoryCode: code.split("-")[0],
        categoryName: code.split("-")[0],
      });
      pcByCode.set(code, randomUUID());
    }
    await db.insert(projects).values({ id: projectId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, name: "Material test" });
    // Project credits need the project, so insert them after it.
    const credits = await db.select().from(catalogCredits).where(eq(catalogCredits.rsVersionId, versionId));
    for (const c of credits) {
      await db.insert(projectCredits).values({ id: pcByCode.get(c.code)!, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: c.id });
    }
    // The requirements "Use this value" fills, as the parsed manual has them.
    const reqs: Record<string, string[]> = { "MW-05": ["NUMERIC", "NUMERIC", "NUMERIC"], "RC-01": ["BOOLEAN", "BOOLEAN"] };
    for (const c of credits) {
      for (const [i, metricType] of (reqs[c.code] ?? []).entries()) {
        const reqId = randomUUID();
        await db.insert(catalogRequirements).values({ id: reqId, workspaceId: WORKSPACE_ID, catalogCreditId: c.id, seq: i + 1, text: `${c.code} requirement ${i + 1}`, metricType });
        await db.insert(requirementEntries).values({ id: randomUUID(), workspaceId: WORKSPACE_ID, projectCreditId: pcByCode.get(c.code)!, catalogRequirementId: reqId });
      }
    }
  }

  async function addSubmittal(ref = "MTS-0411", title = "All epoxy flooring systems") {
    const id = randomUUID();
    await db.insert(materialSubmittals).values({ id, workspaceId: WORKSPACE_ID, projectId, ref, title });
    return id;
  }

  async function addProduct(submittalId: string, name = "Jotafloor Easyflow Primer HS") {
    const id = randomUUID();
    await db.insert(materialProducts).values({ id, workspaceId: WORKSPACE_ID, submittalId, name });
    return id;
  }

  async function teardown() {
    const subs = await db.select({ id: materialSubmittals.id }).from(materialSubmittals).where(eq(materialSubmittals.projectId, projectId));
    const subIds = subs.map((s) => s.id);
    if (subIds.length) {
      const prods = await db.select({ id: materialProducts.id }).from(materialProducts).where(inArray(materialProducts.submittalId, subIds));
      const prodIds = prods.map((p) => p.id);
      if (prodIds.length) {
        await db.delete(evidenceDocs).where(inArray(evidenceDocs.materialProductId, prodIds));
        // Newest revisions first, so no product still points at a deleted one.
        await db.update(materialProducts).set({ previousRevisionId: null }).where(inArray(materialProducts.id, prodIds));
        await db.delete(materialProducts).where(inArray(materialProducts.id, prodIds));
      }
      await db.delete(materialSubmittals).where(inArray(materialSubmittals.id, subIds));
    }
    await db.delete(smqTemplates).where(eq(smqTemplates.projectId, projectId));
    const pcIds = [...pcByCode.values()];
    if (pcIds.length) await db.delete(evidenceDocs).where(inArray(evidenceDocs.projectCreditId, pcIds));
    if (pcIds.length) await db.delete(requirementEntries).where(inArray(requirementEntries.projectCreditId, pcIds));
    await db.delete(projectCredits).where(eq(projectCredits.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    const catalog = await db.select({ id: catalogCredits.id }).from(catalogCredits).where(eq(catalogCredits.rsVersionId, versionId));
    if (catalog.length) await db.delete(catalogRequirements).where(inArray(catalogRequirements.catalogCreditId, catalog.map((c) => c.id)));
    await db.delete(catalogCredits).where(eq(catalogCredits.rsVersionId, versionId));
    await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, rsId));
  }

  return { projectId, versionId, pcByCode, setup, addSubmittal, addProduct, teardown };
}
