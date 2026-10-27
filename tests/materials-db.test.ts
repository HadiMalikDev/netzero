import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { materialFixture } from "./helpers/material-fixture";
import { db } from "@/db";
import { evidenceDocs, smqRows, smqSections } from "@/db/schema";
import { PART_KEYS } from "@/lib/materials/parts";
import { editSmqRow, editSmqSection, ensureProjectSmq, getSmq } from "@/lib/materials/smq";
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

const copyFx = materialFixture();

describeDb("material review: the project's own questionnaire", () => {
  beforeAll(() => copyFx.setup());
  afterAll(() => copyFx.teardown());

  it("copies the default once and links each code to this project's credit", async () => {
    const a = await ensureProjectSmq(copyFx.projectId);
    const b = await ensureProjectSmq(copyFx.projectId);
    expect(a?.id).toBeTruthy();
    expect(b?.id).toBe(a?.id);
    expect(a).toMatchObject({ projectId: copyFx.projectId, expiryYears: 3, boqMaterialCostSar: null, revision: "Rev03" });

    const smq = (await getSmq(a!.id))!;
    const rows = smq.sections.flatMap((s) => s.rows);
    expect(rows).toHaveLength(85);
    const steel = smq.sections.find((s) => s.heading === "All metals")!.rows[0];
    expect(steel).toMatchObject({ creditCode: "MW-05", projectCreditId: copyFx.pcByCode.get("MW-05") });
    expect(steel.credit?.code).toBe("MW-05");
    // The fixture project has no E-01: those rows keep the code, unlinked.
    const roof = rows.find((r) => r.text === "Roof U-value")!;
    expect(roof).toMatchObject({ creditCode: "E-01", projectCreditId: null, credit: null });
  });

  it("edits the copy only: the default keeps its wording and ticks", async () => {
    const t = (await ensureProjectSmq(copyFx.projectId))!;
    const smq = (await getSmq(t.id))!;
    const paints = smq.sections.find((s) => s.heading === "Paints & Coatings")!;
    expect(await editSmqSection(t.id, paints.id, "parts", { parts: ["HC-11:voc", "not-a-part"] })).toBe(true);
    expect(await editSmqSection(t.id, paints.id, "rename", { heading: "Paints, primers & coatings" })).toBe(true);
    const row = paints.rows[0];
    expect(
      await editSmqRow(t.id, row.id, "save", {
        text: "VOC content test report",
        projectCreditId: "",
        leedRef: "",
        kind: "project_value",
        targetText: "≤ 50 g/L",
        valueUnit: "g/L",
        note: "",
      }),
    ).toBe(true);
    const after = (await getSmq(t.id))!.sections.find((s) => s.id === paints.id)!;
    expect(after.heading).toBe("Paints, primers & coatings");
    expect(after.defaultParts).toEqual(["HC-11:voc"]);
    // Clearing a linked row's credit clears its code too.
    expect(after.rows[0]).toMatchObject({ text: "VOC content test report", projectCreditId: null, creditCode: null, targetText: "≤ 50 g/L" });

    const def = (await getSmq("smq_default"))!.sections.find((s) => s.heading === "Paints & Coatings")!;
    expect(def.rows[0].creditCode).toBe("HC-11");
    expect(def.rows[0].targetText).toBeNull();
  });

  it("refuses a credit from another project and keeps 'For all materials' first and on", async () => {
    const t = (await ensureProjectSmq(copyFx.projectId))!;
    const smq = (await getSmq(t.id))!;
    const row = smq.sections[1].rows[0];
    expect(
      await editSmqRow(t.id, row.id, "save", {
        text: "x", projectCreditId: fx.pcByCode.get("MW-05")!, leedRef: "", kind: "fixed", targetText: "", valueUnit: "", note: "",
      }),
    ).toBe(false);
    expect(await editSmqSection(t.id, smq.sections[0].id, "toggle")).toBe(false);
    expect(await editSmqSection(t.id, smq.sections[0].id, "down")).toBe(false);
    expect(await editSmqSection(t.id, smq.sections[1].id, "up")).toBe(true);
    const again = (await getSmq(t.id))!;
    expect(again.sections[0].kind).toBe("all_materials");
  });
});
