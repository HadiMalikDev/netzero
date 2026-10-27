import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { materialFixture } from "./helpers/material-fixture";
import { db } from "@/db";
import { evidenceDocs, smqRows, smqSections } from "@/db/schema";
import { PART_KEYS } from "@/lib/materials/parts";
import { WORKSPACE_ID } from "@/lib/catalog";

const fx = materialFixture();

describeDb("material review: files", () => {
  beforeAll(() => fx.setup());
  afterAll(() => fx.teardown());

  const doc = (over: Partial<typeof evidenceDocs.$inferInsert>) => ({
    id: randomUUID(),
    workspaceId: WORKSPACE_ID,
    fileName: "x.pdf",
    filePath: "/dev/null",
    ...over,
  });

  it("a file belongs to a credit or to a product, never both and never neither", async () => {
    const productId = await fx.addProduct(await fx.addSubmittal());
    const pcId = fx.pcByCode.get("MW-05")!;

    const onCredit = doc({ projectCreditId: pcId });
    const onProduct = doc({ materialProductId: productId, issuedOn: "2024-05-12" });
    await db.insert(evidenceDocs).values([onCredit, onProduct]);
    const [saved] = await db.select().from(evidenceDocs).where(eq(evidenceDocs.id, onProduct.id));
    expect(saved).toMatchObject({ projectCreditId: null, materialProductId: productId, issuedOn: "2024-05-12" });

    await expect(db.insert(evidenceDocs).values(doc({}))).rejects.toThrow();
    await expect(
      db.insert(evidenceDocs).values(doc({ projectCreditId: pcId, materialProductId: productId })),
    ).rejects.toThrow();
  });
});

describeDb("material review: the seeded SMQ Rev03 default", () => {
  it("has the 'For all materials' block first, then the material types, with every row", async () => {
    const sections = await db
      .select()
      .from(smqSections)
      .where(eq(smqSections.templateId, "smq_default"))
      .orderBy(asc(smqSections.seq));
    expect(sections).toHaveLength(48);
    expect(sections[0]).toMatchObject({ kind: "all_materials", heading: "For all materials" });
    expect(sections.slice(1).every((s) => s.kind === "material_type")).toBe(true);
    expect(sections.map((s) => s.heading)).toContain("Paints & Coatings");

    const rows = await db.select().from(smqRows).where(inArray(smqRows.sectionId, sections.map((s) => s.id)));
    expect(rows).toHaveLength(85);
    // Mostadam codes only in credit_code; LEED-only rows have none.
    expect(rows.every((r) => r.creditCode === null || /^[A-Z]{1,3}-\d{2}$/.test(r.creditCode))).toBe(true);
    const ksa = rows.filter((r) => r.creditCode === "RC-01");
    expect(ksa.map((r) => r.sectionId)).toEqual([sections[0].id, sections[0].id]);
    const epd = rows.find((r) => r.text.startsWith("1) Environmental Product Declaration"));
    expect(epd).toMatchObject({ creditCode: null, kind: "fixed" });
    expect(epd?.leedRef).toMatch(/^MRc2/);
  });

  it("leaves the project values blank and pre-ticks only known credit parts", async () => {
    const sections = await db.select().from(smqSections).where(eq(smqSections.templateId, "smq_default"));
    for (const s of sections) {
      for (const key of JSON.parse(s.defaultParts) as string[]) expect(PART_KEYS.has(key)).toBe(true);
    }
    const metals = sections.find((s) => s.heading === "All metals");
    expect(JSON.parse(metals!.defaultParts)).toEqual(["MW-05:steel"]);
    const rows = await db.select().from(smqRows).where(inArray(smqRows.sectionId, sections.map((s) => s.id)));
    expect(rows.every((r) => r.targetText === null)).toBe(true);
    expect(rows.find((r) => r.text === "Roof U-value")).toMatchObject({ kind: "design_package", valueUnit: "W/m²K", creditCode: "E-01" });
  });
});
