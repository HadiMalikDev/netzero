import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { materialFixture } from "./helpers/material-fixture";
import { db } from "@/db";
import { evidenceDocs, smqRows, smqSections } from "@/db/schema";
import { PART_KEYS } from "@/lib/materials/parts";
import { editSmqRow, editSmqSection, ensureProjectSmq, getSmq } from "@/lib/materials/smq";
import {
  addProduct,
  attachMaterialDoc,
  createSubmittal,
  getProduct,
  listSubmittals,
  newRevision,
  removeMaterialDoc,
  saveAnswers,
  saveReview,
  setProductParts,
  setProductTypes,
  addDelivery,
  saveBoqQuantities,
} from "@/lib/materials/products";
import { loadSnapshot } from "@/lib/materials/progress";
import { monthSummaries, monthView } from "@/lib/materials/months";
import { todayIso } from "@/lib/materials/expiry";
import { UPLOAD_ROOT } from "@/lib/uploads";
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

const prodFx = materialFixture();

describeDb("material review: products", () => {
  beforeAll(() => prodFx.setup());
  afterAll(async () => {
    await prodFx.teardown();
    await rm(join(UPLOAD_ROOT, prodFx.projectId), { recursive: true, force: true });
  });

  const pid = () => prodFx.projectId;
  const header = { name: "Jotafloor Easyflow Primer HS", locationOfUse: "Flooring", manufacturer: "Jotun Saudi Limited", supplier: "", countryOfOrigin: "Norway", contactName: "", contactMobile: "" };
  const pdf = (name = "report.pdf") => new File([new Uint8Array([37, 80, 68, 70])], name, { type: "application/pdf" });

  it("a new product answers the 'For all materials' block and counts toward RC-01", async () => {
    const sub = await createSubmittal(pid(), { ref: "MTS-0411", title: "All epoxy flooring systems", discipline: "Architecture", supplier: "Jotun", submittedOn: "2026-04-28" });
    const productId = (await addProduct(pid(), sub!, header))!;
    const v = (await getProduct(pid(), productId))!;
    expect(v.sections.map((s) => s.heading)).toEqual(["For all materials"]);
    expect(v.sections[0].answers).toHaveLength(7);
    expect(v.parts).toEqual(["RC-01:ksa"]);
    expect(v.latest).toBe(true);
    expect(await addProduct(pid(), sub!, { ...header, name: "  " })).toBeNull();
  });

  it("picking types adds their rows and ticks; dropping one hides its answers and unticks", async () => {
    const [{ products }] = await listSubmittals(pid());
    const productId = products[0].id;
    const smq = (await getSmq((await ensureProjectSmq(pid()))!.id))!;
    const paints = smq.sections.find((s) => s.heading === "Paints & Coatings")!;
    const flooring = smq.sections.find((s) => s.heading === "Carpet, Hard Flooring")!;
    const ceilings = smq.sections.find((s) => s.heading === "Ceilings")!;

    expect(await setProductTypes(pid(), productId, [paints.id, flooring.id, ceilings.id])).toBe(true);
    let v = (await getProduct(pid(), productId))!;
    expect(v.sections.map((s) => s.heading)).toEqual(["For all materials", "Paints & Coatings", "Carpet, Hard Flooring", "Ceilings"]);
    expect(new Set(v.parts)).toEqual(new Set(["RC-01:ksa", "HC-11:voc", "HC-11:formaldehyde"]));

    const ceilingAnswer = v.sections[3].answers[0];
    await saveAnswers(pid(), productId, [{ answerId: ceilingAnswer.id, answer: "yes", value: "", unit: "", remark: "kept" }]);
    // The contractor's mistake in MTS-0411: Ceilings rows on a floor primer. Drop them.
    await setProductTypes(pid(), productId, [paints.id, flooring.id]);
    v = (await getProduct(pid(), productId))!;
    expect(v.sections.map((s) => s.heading)).toEqual(["For all materials", "Paints & Coatings", "Carpet, Hard Flooring"]);
    expect(new Set(v.parts)).toEqual(new Set(["RC-01:ksa", "HC-11:voc"]));
    // Picking Ceilings again brings its earlier answer back.
    await setProductTypes(pid(), productId, [paints.id, flooring.id, ceilings.id]);
    v = (await getProduct(pid(), productId))!;
    expect(v.sections[3].answers[0]).toMatchObject({ id: ceilingAnswer.id, answer: "yes", remark: "kept" });
    await setProductTypes(pid(), productId, [paints.id, flooring.id]);

    expect(await setProductParts(pid(), productId, ["HC-11:voc", "bogus"], false)).toBe(true);
    v = (await getProduct(pid(), productId))!;
    expect(v.parts).toEqual(["HC-11:voc"]);
    expect(v.product.interior).toBe(false);
  });

  it("a row's certificate needs its issue date; a slot document does not", async () => {
    const [{ products }] = await listSubmittals(pid());
    const productId = products[0].id;
    const v = (await getProduct(pid(), productId))!;
    const voc = v.sections[1].answers[0];
    expect(await attachMaterialDoc(pid(), productId, pdf(), { answerId: voc.id }, "")).toMatch(/issued/);
    expect(await attachMaterialDoc(pid(), productId, pdf(), { answerId: voc.id }, "2023-02-30")).toMatch(/issued/);
    expect(await attachMaterialDoc(pid(), productId, pdf("voc.pdf"), { answerId: voc.id }, "2023-05-12")).toBeNull();
    expect(await attachMaterialDoc(pid(), productId, pdf("boq.pdf"), { slot: "boq" }, "")).toBeNull();
    const after = (await getProduct(pid(), productId))!;
    expect(after.sections[1].answers[0].docs.map((d) => [d.fileName, d.issuedOn])).toEqual([["voc.pdf", "2023-05-12"]]);
    expect(after.docs.map((d) => [d.fileName, d.slot, d.issuedOn])).toEqual([["boq.pdf", "boq", null]]);
  });

  it("a status needs a review date; a resubmission freezes the reviewed revision", async () => {
    const [{ products }] = await listSubmittals(pid());
    const productId = products[0].id;
    const review = { status: "C", reviewedOn: "", reviewer: "Waqas Tariq", applicable: "yes", remarks: "VOC content is expired.", manufacturerSignatory: "", manufacturerSignedOn: "", contractorSignatory: "", contractorSignedOn: "" };
    expect(await newRevision(pid(), productId)).toBeNull(); // not reviewed yet
    expect(await saveReview(pid(), productId, review)).toBe(false);
    expect(await saveReview(pid(), productId, { ...review, reviewedOn: "2026-05-05" })).toBe(true);

    const rev1 = (await newRevision(pid(), productId))!;
    expect(rev1).toBeTruthy();
    const old = (await getProduct(pid(), productId))!;
    const next = (await getProduct(pid(), rev1))!;
    expect(old.latest).toBe(false);
    expect(next).toMatchObject({ latest: true, product: { revision: 1, status: null, reviewedOn: null, previousRevisionId: productId, interior: false } });
    expect(next.parts).toEqual(["HC-11:voc"]);
    expect(next.revisions.map((r) => r.revision)).toEqual([0, 1]);
    // Same answers, same files (linked, not copied).
    expect(next.sections.map((s) => s.heading)).toEqual(old.sections.map((s) => s.heading));
    expect(next.sections[1].answers[0].docs[0].docId).toBe(old.sections[1].answers[0].docs[0].docId);

    // Rev 00 can no longer change.
    expect(await saveReview(pid(), productId, { ...review, status: "A", reviewedOn: "2026-06-01" })).toBe(false);
    expect(await saveAnswers(pid(), productId, [])).toBe(false);
    expect(await newRevision(pid(), productId)).toBeNull();

    // Removing the file from Rev 01 keeps it for Rev 00.
    const link = next.sections[1].answers[0].docs[0];
    expect(await removeMaterialDoc(pid(), rev1, link.linkId)).toBe(true);
    const [still] = await db.select().from(evidenceDocs).where(eq(evidenceDocs.id, link.docId));
    expect(still).toBeTruthy();
    expect((await getProduct(pid(), productId))!.sections[1].answers[0].docs).toHaveLength(1);
  });

  it("the snapshot holds one product per revision chain, with quantities and deliveries", async () => {
    const [{ products }] = await listSubmittals(pid());
    const latest = products.find((p) => p.latest)!;
    expect(await saveBoqQuantities(pid(), latest.id, { weightT: "1,250.5", volumeM3: "", costSar: "40000" })).toBe(true);
    expect(await saveBoqQuantities(pid(), latest.id, { weightT: "-1", volumeM3: "", costSar: "" })).toBe(false);
    expect(await addDelivery(pid(), latest.id, { deliveredOn: "2026-06-01", poNumber: "PO-1", weightT: "", volumeM3: "", costSar: "" })).toBe(false);
    expect(await addDelivery(pid(), latest.id, { deliveredOn: "2026-06-01", poNumber: "PO-1", weightT: "10", volumeM3: "", costSar: "" })).toBe(true);
    const snap = await loadSnapshot(pid());
    expect(snap.products).toHaveLength(1);
    const [p] = snap.products;
    expect(p.revisions.map((r) => [r.revision, r.status])).toEqual([[0, "C"], [1, null]]);
    expect(p.revisions[1].boq).toEqual({ weightT: 1250.5, volumeM3: null, costSar: 40000 });
    expect(p.deliveries).toEqual([{ deliveredOn: "2026-06-01", weightT: 10, volumeM3: null, costSar: null }]);
    // Ceilings was dropped: its HC-11 rows are hidden and must not count.
    expect(p.revisions[1].answers.some((a) => a.text.startsWith("technical datasheet with a maximum formaldehyde"))).toBe(false);
  });

  it("a month lists its reviews, carries open C/D forward and flags overdue resubmissions as of then", async () => {
    // Rev 00 was reviewed C on 2026-05-05; Rev 01 was entered today (after October 2026 began).
    const today = todayIso();
    const may = await monthView(pid(), "2026-05", "2026-05-25");
    expect(may.reviewed.map((r) => [r.product.revision, r.product.status])).toEqual([[0, "C"]]);
    expect(may.counts).toEqual({ A: 0, B: 0, C: 1, D: 0 });
    expect(may.carried).toEqual([]);
    expect(may.flags.map((f) => f.kind)).toContain("resubmission_overdue");

    const june = await monthView(pid(), "2026-06", "2026-06-10");
    expect(june.reviewed).toEqual([]);
    expect(june.carried.map((r) => r.product.revision)).toEqual([0]);

    // Now Rev 01 exists, so nothing is open or overdue any more.
    const now = await monthView(pid(), today.slice(0, 7), today);
    expect(now.carried).toEqual([]);
    expect(now.flags.filter((f) => f.kind === "resubmission_overdue")).toEqual([]);
    expect(now.parts.map((r) => r.part.key)).toContain("HC-11:voc");

    const months = await monthSummaries(pid(), today);
    expect(months[0].month).toBe(today.slice(0, 7));
    expect(months.find((m) => m.month === "2026-05")).toMatchObject({ reviewed: 1, counts: { C: 1 } });
    expect(months.at(-1)!.month).toBe("2026-04"); // the submittal's date
  });
});
