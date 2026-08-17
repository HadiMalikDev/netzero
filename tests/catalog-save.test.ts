import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  parsedCredits,
  parsedRequirements,
  ratingSystems,
  rsVersions,
  sourceDocuments,
  workspaces,
} from "@/db/schema";
import {
  saveParsedCredit,
  saveParsedRequirements,
  WORKSPACE_ID,
} from "@/lib/catalog";

const rsId = randomUUID();
const versionId = randomUUID();
const docId = randomUUID();
const creditId = randomUUID();
const req1Id = randomUUID();
const req2Id = randomUUID();

describe("saveParsedRequirements — replace-set + reconcile", () => {
  beforeAll(async () => {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, WORKSPACE_ID));
    if (!ws)
      await db.insert(workspaces).values({ id: WORKSPACE_ID, name: "Test" });

    await db
      .insert(ratingSystems)
      .values({ id: rsId, workspaceId: WORKSPACE_ID, key: "s", name: "S" });
    await db.insert(rsVersions).values({
      id: versionId,
      workspaceId: WORKSPACE_ID,
      ratingSystemId: rsId,
      scheme: "commercial",
      stage: "D+C",
      versionLabel: `save-${Date.now().toString(36)}`,
    });
    await db.insert(sourceDocuments).values({
      id: docId,
      workspaceId: WORKSPACE_ID,
      rsVersionId: versionId,
      fileName: "t.pdf",
      filePath: "/tmp/none",
      status: "parsed",
    });
    await db.insert(parsedCredits).values({
      id: creditId,
      workspaceId: WORKSPACE_ID,
      sourceDocumentId: docId,
      scheme: "commercial",
      stage: "D+C",
      code: "TC-03",
      categoryCode: "TC",
      categoryName: "Transportation",
      title: "Access to Amenities",
      pointsRaw: "2",
    });
    await db.insert(parsedRequirements).values([
      {
        id: req1Id,
        workspaceId: WORKSPACE_ID,
        parsedCreditId: creditId,
        seq: 1,
        text: "mosque and grocery",
        metricType: "BOOLEAN",
        pointsRaw: "1",
      },
      {
        id: req2Id,
        workspaceId: WORKSPACE_ID,
        parsedCreditId: creditId,
        seq: 2,
        text: "truncated from",
        metricType: "BOOLEAN",
        pointsRaw: null,
      },
      {
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        parsedCreditId: creditId,
        seq: 3,
        text: "additional amenities fragment",
        metricType: "BOOLEAN",
        pointsRaw: "1",
      },
    ]);
  });

  it("drops the phantom row, restores points, restamps reconcile", async () => {
    await saveParsedCredit(creditId, { title: "Access to Amenities" });
    await saveParsedRequirements(creditId, [
      {
        seq: 1,
        title: "Mosque and grocery",
        text: "mosque and grocery",
        pointsRaw: "1",
        metricType: "BOOLEAN",
        unit: null,
        optionGroup: null,
        pointsType: "fixed",
      },
      {
        seq: 2,
        title: "Three amenities",
        text: "from 3 additional amenities",
        pointsRaw: "1",
        metricType: "BOOLEAN",
        unit: null,
        optionGroup: null,
        pointsType: "fixed",
      },
    ]);

    const rows = await db
      .select()
      .from(parsedRequirements)
      .where(eq(parsedRequirements.parsedCreditId, creditId))
      .orderBy(parsedRequirements.seq);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.seq)).toEqual([1, 2]);
    expect(rows[1].pointsRaw).toBe("1");
    expect(rows[1].text).toMatch(/3 additional/);

    const [credit] = await db
      .select()
      .from(parsedCredits)
      .where(eq(parsedCredits.id, creditId));
    const recon = JSON.parse(credit.reconciliation!);
    expect(recon.ok).toBe(true);
    expect(recon.expected).toBe(2);
    expect(recon.got).toBe(2);
  });

  afterAll(async () => {
    await db
      .delete(parsedRequirements)
      .where(eq(parsedRequirements.parsedCreditId, creditId));
    await db.delete(parsedCredits).where(eq(parsedCredits.id, creditId));
    await db.delete(sourceDocuments).where(eq(sourceDocuments.id, docId));
    await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, rsId));
  });
});
