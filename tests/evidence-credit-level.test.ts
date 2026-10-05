import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  evidenceDocs,
  projectCredits,
  projects,
  ratingSystems,
  requirementEntries,
  rsVersions,
  workspaces,
} from "@/db/schema";
import { getProjectCredits, listProjectEvidence, WORKSPACE_ID } from "@/lib/data";

const rsId = randomUUID();
const versionId = randomUUID();
const creditId = randomUUID();
const reqId = randomUUID();
const projectId = randomUUID();
const pcId = randomUUID();
const entryId = randomUUID();
const reqDoc = randomUUID();
const creditDoc = randomUUID();

describeDb("credit-level additional attachments", () => {
  beforeAll(async () => {
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
    await db.insert(catalogCredits).values({
      id: creditId,
      workspaceId: WORKSPACE_ID,
      rsVersionId: versionId,
      code: "PMM-03",
      title: "Fair Labor Practices",
      categoryCode: "PMM",
      categoryName: "Policies",
      pointsRaw: "2",
    });
    await db.insert(catalogRequirements).values({
      id: reqId,
      workspaceId: WORKSPACE_ID,
      catalogCreditId: creditId,
      seq: 1,
      text: "Develop and implement a Labor Subsistence Plan.",
      metricType: "DESCRIPTIVE",
      pointsRaw: "2",
      evidenceSpecs: JSON.stringify(["LSP"]),
    });
    await db.insert(projects).values({ id: projectId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, name: "T" });
    await db.insert(projectCredits).values({ id: pcId, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: creditId });
    await db.insert(requirementEntries).values({
      id: entryId,
      workspaceId: WORKSPACE_ID,
      projectCreditId: pcId,
      catalogRequirementId: reqId,
      valueText: "Plan issued.",
    });
    await db.insert(evidenceDocs).values([
      { id: reqDoc, workspaceId: WORKSPACE_ID, projectCreditId: pcId, requirementEntryId: entryId, fileName: "lsp.pdf", filePath: "/dev/null", evidenceSpecIndex: 0 },
      { id: creditDoc, workspaceId: WORKSPACE_ID, projectCreditId: pcId, requirementEntryId: null, fileName: "shop-drawing-rev3.pdf", filePath: "/dev/null" },
    ]);
  });

  afterAll(async () => {
    await db.delete(evidenceDocs).where(inArray(evidenceDocs.id, [reqDoc, creditDoc]));
    await db.delete(requirementEntries).where(eq(requirementEntries.id, entryId));
    await db.delete(projectCredits).where(eq(projectCredits.id, pcId));
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.delete(catalogRequirements).where(eq(catalogRequirements.id, reqId));
    await db.delete(catalogCredits).where(eq(catalogCredits.id, creditId));
    await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, rsId));
  });

  it("keeps credit-level files apart from requirement evidence", async () => {
    const [credit] = await getProjectCredits(projectId);
    expect(credit.additionalAttachments.map((a) => a.fileName)).toEqual(["shop-drawing-rev3.pdf"]);
    expect(credit.requirements[0].attachments.map((a) => a.fileName)).toEqual(["lsp.pdf"]);
    expect(credit.requirements[0].evidenceCount).toBe(1);
  });

  it("an additional attachment alone never satisfies a requirement", async () => {
    await db.delete(evidenceDocs).where(eq(evidenceDocs.id, reqDoc));
    const [credit] = await getProjectCredits(projectId);
    expect(credit.requirements[0].evidenceCount).toBe(0);
    expect(credit.requirements[0].status).toBe("in_progress");
    expect(credit.status).toBe("in_progress");
  });

  it("the documents library lists it as the credit's, with no requirement", async () => {
    const rows = await listProjectEvidence(projectId);
    expect(rows).toEqual([
      expect.objectContaining({ fileName: "shop-drawing-rev3.pdf", creditCode: "PMM-03", requirementSeq: null }),
    ]);
  });
});
