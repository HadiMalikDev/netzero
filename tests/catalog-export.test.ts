import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import {
  catalogCredits,
  catalogRequirements,
  rsVersions,
  sourceDocuments,
  workspaces,
} from "@/db/schema";
import {
  ensureRatingSystem,
  ensureVersion,
  getReviewNoteProgress,
  getVersionForExport,
  WORKSPACE_ID,
} from "@/lib/catalog";
import {
  fallbackReviewNote,
  formatPageSpan,
} from "@/lib/ai/review-notes";
import { CatalogReport } from "@/lib/pdf/CatalogReport";

describe("review-note fallback (deterministic, no LLM)", () => {
  it("formats page spans", () => {
    expect(formatPageSpan(5, 8)).toBe("pp.5–8");
    expect(formatPageSpan(5, 5)).toBe("p.5");
    expect(formatPageSpan(5, null)).toBe("p.5");
    expect(formatPageSpan(null, null)).toBeNull();
  });

  it("builds a grounded note from the credit's own fields", () => {
    const note = fallbackReviewNote({
      code: "HC-10",
      title: "Indoor Air Quality",
      aim: "Ensure healthy indoor air.",
      pageStart: 142,
      pageEnd: 148,
      requirementTitles: ["Ventilation rate", "VOC limits"],
    });
    expect(note).toContain("HC-10");
    expect(note).toContain("pp.142–148");
    expect(note).toContain("Ventilation rate");
    // Never empty even with nothing but a code.
    expect(
      fallbackReviewNote({
        code: "X-1",
        title: "",
        aim: null,
        pageStart: null,
        pageEnd: null,
        requirementTitles: [],
      }).length,
    ).toBeGreaterThan(0);
  });
});

const TEST_LABEL = `export-test-${Date.now().toString(36)}`;
let versionId = "";
const docId = randomUUID();

describe("getVersionForExport + PDF render", () => {
  beforeAll(async () => {
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

    await db.insert(sourceDocuments).values({
      id: docId,
      workspaceId: WORKSPACE_ID,
      rsVersionId: versionId,
      fileName: "commercial-dc.pdf",
      filePath: ".data/manuals/commercial-dc.pdf",
      pageCount: 269,
      status: "promoted",
    });

    const creditId = randomUUID();
    await db.insert(catalogCredits).values({
      id: creditId,
      workspaceId: WORKSPACE_ID,
      rsVersionId: versionId,
      code: "E-01",
      title: "Energy Performance",
      categoryCode: "E",
      categoryName: "Energy",
      isKeystone: true,
      pointsRaw: "15",
      aim: "Cut energy use.",
      applicability: JSON.stringify({ "Shell only": { Office: 5 } }),
      reconciliation: JSON.stringify({ ok: true, expected: 15, got: 15, note: "" }),
      sourcePageStart: 100,
      sourcePageEnd: 107,
    });
    // Two requirements: one with evidence, one with an option group + a numeric
    // spec, plus a ≤ char to exercise the WinAnsi sanitizer during render.
    await db.insert(catalogRequirements).values([
      {
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        catalogCreditId: creditId,
        seq: 1,
        title: "Compliance with SBC 601",
        text: "Comply with SBC 601 (concentration ≤ 500 units).",
        metricType: "BOOLEAN",
        optionGroup: "E-01 options",
        evidence: JSON.stringify([{ stage: "design", text: "Design report" }]),
        sourcePageStart: 100,
        sourcePageEnd: 100,
      },
      {
        id: randomUUID(),
        workspaceId: WORKSPACE_ID,
        catalogCreditId: creditId,
        seq: 2,
        title: "Dynamic Energy Modeling",
        text: "Model energy per improvement %.",
        metricType: "NUMERIC",
        unit: "%",
        optionGroup: "E-01 options",
        numericSpec: JSON.stringify({
          bands: [{ label: null, bands: [{ min: 0, points: 5 }, { min: 40, points: 15 }] }],
        }),
        sourcePageStart: 100,
        sourcePageEnd: 107,
      },
    ]);
  });

  it("shapes the version into grouped credits with parsed blobs", async () => {
    const data = await getVersionForExport(versionId);
    expect(data).not.toBeNull();
    expect(data!.totals.credits).toBe(1);
    expect(data!.totals.requirements).toBe(2);
    expect(data!.totals.reviewNotes).toBe(0);
    expect(data!.source?.fileName).toBe("commercial-dc.pdf");
    expect(data!.source?.pageCount).toBe(269);

    expect(data!.categories).toHaveLength(1);
    const cat = data!.categories[0];
    expect(cat.code).toBe("E");
    const credit = cat.credits[0];
    expect(credit.code).toBe("E-01");
    expect(credit.isKeystone).toBe(true);
    expect(credit.applicability).toEqual({ "Shell only": { Office: 5 } });
    expect(credit.reconciliation?.ok).toBe(true);
    expect(credit.requirements).toHaveLength(2);
    expect(credit.requirements[0].evidence[0].text).toBe("Design report");
    expect(credit.requirements[1].bands[0].bands).toHaveLength(2);
    expect(credit.requirements[1].optionGroup).toBe("E-01 options");
  });

  it("reports review-note progress", async () => {
    const p = await getReviewNoteProgress(versionId);
    expect(p).toEqual({ withNote: 0, total: 1 });
  });

  it("renders a valid PDF buffer (sanitizes non-WinAnsi glyphs)", async () => {
    const data = await getVersionForExport(versionId);
    const buf = await renderToBuffer(
      CatalogReport({ data: data!, generatedAt: "2026-01-01 00:00" }),
    );
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  afterAll(async () => {
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
    await db.delete(sourceDocuments).where(eq(sourceDocuments.id, docId));
    if (versionId)
      await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
  });
});
