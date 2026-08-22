import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { db } from "@/db";
import {
  parsedCredits,
  parsedRequirements,
  ratingSystems,
  rsVersions,
  sourceDocuments,
  workspaces,
} from "@/db/schema";
import { applyStoredProposal, WORKSPACE_ID } from "@/lib/catalog";

// Throwaway rows for this test, cleaned up afterwards.
const rsId = randomUUID();
const versionId = randomUUID();
const docId = randomUUID();
const creditId = randomUUID();
const req1Id = randomUUID();

describeDb("applyStoredProposal — AI proposal reconciliation", () => {
  beforeAll(async () => {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, WORKSPACE_ID));
    if (!ws)
      await db
        .insert(workspaces)
        .values({ id: WORKSPACE_ID, name: "Test" });

    await db
      .insert(ratingSystems)
      .values({ id: rsId, workspaceId: WORKSPACE_ID, key: "t", name: "T" });
    await db.insert(rsVersions).values({
      id: versionId,
      workspaceId: WORKSPACE_ID,
      ratingSystemId: rsId,
      scheme: "commercial",
      stage: "D+C",
      versionLabel: `apply-${Date.now().toString(36)}`,
    });
    await db.insert(sourceDocuments).values({
      id: docId,
      workspaceId: WORKSPACE_ID,
      rsVersionId: versionId,
      fileName: "t.pdf",
      filePath: "/tmp/none",
      status: "parsed",
    });

    // One deterministic requirement (#1); the proposal corrects #1 and adds #2.
    const proposal = {
      generatedAt: 0,
      requirements: [
        {
          seq: 1,
          change: "corrected",
          proposed: {
            text: "Reduce indoor water use by 50%",
            metricType: "NUMERIC",
            unit: "%",
            pointsRaw: "3",
            measurable: ">= 50% reduction",
          },
          reasoning: "source states a 50% reduction target",
        },
        {
          seq: 2,
          change: "added",
          proposed: {
            text: "Install sub-meters on all water outlets",
            metricType: "BOOLEAN",
            unit: null,
            pointsRaw: "1",
            measurable: null,
          },
          reasoning: "requirement #2 present in source, parser missed it",
        },
        {
          seq: 3,
          change: "unchanged",
          proposed: {
            text: "ignored",
            metricType: "DESCRIPTIVE",
            unit: null,
            pointsRaw: null,
            measurable: null,
          },
          reasoning: "matches",
        },
      ],
    };

    await db.insert(parsedCredits).values({
      id: creditId,
      workspaceId: WORKSPACE_ID,
      sourceDocumentId: docId,
      scheme: "commercial",
      stage: "D+C",
      code: "W-01",
      categoryCode: "W",
      categoryName: "Water",
      title: "Indoor Water Performance",
      aiProposal: JSON.stringify(proposal),
      aiStatus: "proposed",
    });
    await db.insert(parsedRequirements).values({
      id: req1Id,
      workspaceId: WORKSPACE_ID,
      parsedCreditId: creditId,
      seq: 1,
      text: "old text",
      metricType: "DESCRIPTIVE",
    });
  });

  it("corrects #1 in place, adds #2, tags origins, marks applied", async () => {
    const { added, corrected } = await applyStoredProposal(creditId);
    expect(added).toBe(1);
    expect(corrected).toBe(1);

    const rows = await db
      .select()
      .from(parsedRequirements)
      .where(eq(parsedRequirements.parsedCreditId, creditId))
      .orderBy(parsedRequirements.seq);
    expect(rows).toHaveLength(2); // #1 corrected in place, #2 added, #3 unchanged=absent

    const r1 = rows.find((r) => r.seq === 1)!;
    expect(r1.origin).toBe("ai_corrected");
    expect(r1.metricType).toBe("NUMERIC");
    expect(r1.text).toBe("Reduce indoor water use by 50%");
    expect(JSON.parse(r1.numericSpec!).summary).toBe(">= 50% reduction");

    const r2 = rows.find((r) => r.seq === 2)!;
    expect(r2.origin).toBe("ai_added");
    expect(r2.metricType).toBe("BOOLEAN");

    const [credit] = await db
      .select()
      .from(parsedCredits)
      .where(eq(parsedCredits.id, creditId));
    expect(credit.aiStatus).toBe("applied");
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
