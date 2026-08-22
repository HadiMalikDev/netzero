import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  parsedCredits,
  parsedRequirements,
  rsVersions,
  sourceDocuments,
  workspaces,
} from "@/db/schema";
import {
  ensureRatingSystem,
  ensureVersion,
  getCatalogCredit,
  promoteToCatalog,
  WORKSPACE_ID,
} from "@/lib/catalog";
import { parseAndStore } from "@/lib/parser";
import { describeDb } from "./helpers/postgres";

const MANUAL = ".data/manuals/commercial-dc.pdf";
const d = existsSync(MANUAL) ? describeDb : describe.skip;

// Throwaway version label so the test never collides with the real seed.
const TEST_LABEL = `test-${Date.now().toString(36)}`;
let versionId = "";
let docId = "";

d("promote parsed HC-10 into the canonical catalog", () => {
  it("copies HC-10 with title, points, keystone and its 4 limits", async () => {
    // The base workspace must exist (seeded); create if a bare test DB.
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, WORKSPACE_ID));
    if (!ws)
      await db
        .insert(workspaces)
        .values({ id: WORKSPACE_ID, name: "Test Workspace" });

    const ratingSystemId = await ensureRatingSystem({
      key: "mostadam",
      name: "Mostadam",
    });
    versionId = await ensureVersion({
      ratingSystemId,
      scheme: "commercial",
      stage: "D+C",
      versionLabel: TEST_LABEL,
      status: "draft",
    });

    docId = randomUUID();
    await db.insert(sourceDocuments).values({
      id: docId,
      workspaceId: WORKSPACE_ID,
      rsVersionId: versionId,
      fileName: "commercial-dc.pdf",
      filePath: MANUAL,
      status: "uploaded",
    });
    const res = await parseAndStore(docId);
    expect(res.ok).toBe(true);

    const [hc10] = await db
      .select()
      .from(parsedCredits)
      .where(
        and(
          eq(parsedCredits.sourceDocumentId, docId),
          eq(parsedCredits.code, "HC-10"),
        ),
      );
    expect(hc10).toBeDefined();

    const { promoted } = await promoteToCatalog(versionId, [hc10.id]);
    expect(promoted).toBe(1);

    const canonical = await getCatalogCredit(versionId, "HC-10");
    expect(canonical).not.toBeNull();
    expect(canonical!.credit.title).toBe("Indoor Air Quality");
    expect(canonical!.credit.pointsRaw).toBe("3");
    expect(canonical!.credit.isKeystone).toBe(false);
    expect(canonical!.requirements).toHaveLength(2);

    const numeric = canonical!.requirements.find(
      (r) => r.metricType === "NUMERIC",
    );
    const limits: { name: string; value: number }[] = JSON.parse(
      numeric!.numericSpec!,
    ).limits;
    const val = (kw: RegExp) => limits.find((l) => kw.test(l.name))?.value;
    expect(val(/formaldehyde/i)).toBe(27);
    expect(val(/PM2\.5/i)).toBe(15);
    expect(val(/PM10/i)).toBe(150);
    expect(val(/TVOC|Volatile/i)).toBe(500);
  });

  afterAll(async () => {
    // Clean up the throwaway version so it never appears in the admin catalog.
    if (versionId) {
      const creds = await db
        .select({ id: catalogCredits.id })
        .from(catalogCredits)
        .where(eq(catalogCredits.rsVersionId, versionId));
      for (const c of creds)
        await db
          .delete(catalogRequirements)
          .where(eq(catalogRequirements.catalogCreditId, c.id));
      await db
        .delete(catalogCredits)
        .where(eq(catalogCredits.rsVersionId, versionId));
    }
    if (docId) {
      const pcs = await db
        .select({ id: parsedCredits.id })
        .from(parsedCredits)
        .where(eq(parsedCredits.sourceDocumentId, docId));
      for (const p of pcs)
        await db
          .delete(parsedRequirements)
          .where(eq(parsedRequirements.parsedCreditId, p.id));
      await db
        .delete(parsedCredits)
        .where(eq(parsedCredits.sourceDocumentId, docId));
      await db.delete(sourceDocuments).where(eq(sourceDocuments.id, docId));
    }
    if (versionId)
      await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
  });
});
