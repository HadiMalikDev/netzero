import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { db } from "@/db";
import {
  catalogCredits,
  checklistInspections,
  checklistItems,
  checklistTemplates,
  projectCredits,
  projects,
  ratingSystems,
  rsVersions,
  workspaces,
} from "@/db/schema";
import {
  addItem,
  addSection,
  applyAiDraft,
  compareItemNo,
  editFormText,
  editItem,
  editSection,
  defaultTemplateFor,
  ensureProjectTemplate,
  getForm,
  getInspection,
  hasChecklist,
  listInspections,
  numberForm,
  parseAnswer,
  saveInspection,
  startInspection,
} from "@/lib/checklists";
import { WORKSPACE_ID } from "@/lib/catalog";

describe("numberForm", () => {
  const sections = [
    { id: "b", seq: 2, heading: "Source Control" },
    { id: "a", seq: 1, heading: "HVAC Protection" },
  ];
  const items = [
    { id: "a2", sectionId: "a", seq: 2, text: "Return filters", active: false, compliantAnswer: "yes" as const },
    { id: "a1", sectionId: "a", seq: 1, text: "Supply filters", active: true, compliantAnswer: "yes" as const },
    { id: "a3", sectionId: "a", seq: 3, text: "Seal diffusers", active: true, compliantAnswer: "yes" as const },
    { id: "b1", sectionId: "b", seq: 1, text: "Low-VOC products", active: true, compliantAnswer: "yes" as const },
  ];

  it("numbers sections by order and items among the active ones, leaving no gap", () => {
    const f = numberForm(sections, items);
    expect(f.map((s) => [s.no, s.heading])).toEqual([
      ["1", "HVAC Protection"],
      ["2", "Source Control"],
    ]);
    expect(f[0].items.map((i) => [i.text, i.no])).toEqual([
      ["Supply filters", "1.1"],
      ["Return filters", null],
      ["Seal diffusers", "1.2"],
    ]);
    expect(f[1].items[0].no).toBe("2.1");
  });
});

describe("compareItemNo and parseAnswer", () => {
  it("orders dotted numbers numerically", () => {
    expect(["10.1", "2.10", "2.9", "1.1"].sort(compareItemNo)).toEqual(["1.1", "2.9", "2.10", "10.1"]);
  });

  it("accepts only yes / no / na", () => {
    expect(parseAnswer("YES")).toBe("yes");
    expect(parseAnswer(" na ")).toBe("na");
    expect(parseAnswer("no")).toBe("no");
    expect(parseAnswer("maybe")).toBeNull();
    expect(parseAnswer("")).toBeNull();
    expect(parseAnswer(null)).toBeNull();
  });
});

// Against a migrated database: relies on the IAQ default seeded by 0009.
const rsId = randomUUID();
const versionId = randomUUID();
const creditId = randomUUID();
const otherCreditId = randomUUID();
const projectId = randomUUID();
const pcId = randomUUID();
const otherPcId = randomUUID();

describeDb("project checklist forms", () => {
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
    await db.insert(catalogCredits).values([
      { id: creditId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "HC-10", title: "Indoor Air Quality", categoryCode: "HC", categoryName: "Health" },
      { id: otherCreditId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "W-02", title: "Outdoor Water Performance", categoryCode: "W", categoryName: "Water" },
    ]);
    await db.insert(projects).values({ id: projectId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, name: "T" });
    await db.insert(projectCredits).values([
      { id: pcId, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: creditId },
      { id: otherPcId, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: otherCreditId },
    ]);
  });

  afterAll(async () => {
    const tpls = await db
      .select({ id: checklistTemplates.id })
      .from(checklistTemplates)
      .where(inArray(checklistTemplates.projectCreditId, [pcId, otherPcId]));
    const ids = tpls.map((t) => t.id);
    if (ids.length) {
      await db.delete(checklistInspections).where(inArray(checklistInspections.templateId, ids));
      await db.delete(checklistTemplates).where(inArray(checklistTemplates.id, ids));
    }
    await db.delete(projectCredits).where(eq(projectCredits.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.delete(catalogCredits).where(eq(catalogCredits.rsVersionId, versionId));
    await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, rsId));
  });

  it("finds the seeded IAQ default by credit title, case aside, and nothing for other credits", async () => {
    const d = await defaultTemplateFor("INDOOR AIR QUALITY");
    expect(d?.title).toBe("Construction Indoor Air Quality Inspection");
    expect(d?.planDocument).toBe("IAQ Management Plan");
    expect(d?.sheetDocument).toBe("Completed IAQ Checklist");
    expect(await defaultTemplateFor("Outdoor Water Performance")).toBeNull();
    expect(await hasChecklist(pcId, "Indoor Air Quality")).toBe(true);
    expect(await hasChecklist(otherPcId, "Outdoor Water Performance")).toBe(false);
  });

  it("copies the default into the project once, with all 6 sections and 32 items", async () => {
    const a = await ensureProjectTemplate(pcId, "Indoor Air Quality");
    const b = await ensureProjectTemplate(pcId, "Indoor Air Quality");
    expect(a?.id).toBeTruthy();
    expect(b?.id).toBe(a?.id);
    expect(a?.projectCreditId).toBe(pcId);
    const form = await getForm(a!.id);
    expect(form.map((s) => s.heading)).toEqual([
      "HVAC Protection",
      "Source Control",
      "Pathway Interruption",
      "Housekeeping",
      "Scheduling and Construction Activity Sequence",
      "Moisture & Mold Control",
    ]);
    expect(form.flatMap((s) => s.items)).toHaveLength(32);
    expect(form[0].items[0]).toMatchObject({ no: "1.1", text: "Filters at supply air intake" });
    expect(await ensureProjectTemplate(otherPcId, "Outdoor Water Performance")).toBeNull();
  });

  it("an edit to the project's copy leaves the default alone", async () => {
    const t = await ensureProjectTemplate(pcId, "Indoor Air Quality");
    const form = await getForm(t!.id);
    await db.update(checklistItems).set({ active: false }).where(eq(checklistItems.id, form[0].items[0].id));
    const def = await defaultTemplateFor("Indoor Air Quality");
    const defForm = await getForm(def!.id);
    expect(defForm[0].items[0].active).toBe(true);
    expect((await getForm(t!.id))[0].items[1].no).toBe("1.1"); // renumbered, no gap
  });

  it("an inspection snapshots the active items, and the AI draft pre-selects only until a person saves", async () => {
    const t = await ensureProjectTemplate(pcId, "Indoor Air Quality");
    const inspId = await startInspection(t!.id);
    let insp = await getInspection(inspId);
    expect(insp?.aiState).toBe("pending");
    expect(insp?.responses).toHaveLength(31); // one switched off above
    expect(insp?.responses[0]).toMatchObject({ itemNo: "1.1", itemText: "Filters at return air openings", answer: null });

    await applyAiDraft(inspId, {
      state: "done",
      sources: ["IAQ-Plan.pdf"],
      byItemNo: { "1.1": { answer: "yes", quote: "MERV 8 filters at return openings." }, "1.2": { answer: "na", quote: "No demolition on this project." } },
    });
    insp = await getInspection(inspId);
    expect(insp?.aiState).toBe("done");
    expect(insp?.responses[0]).toMatchObject({ aiAnswer: "yes", answer: "yes", aiQuote: "MERV 8 filters at return openings." });
    expect(insp?.responses[1]).toMatchObject({ aiAnswer: "na", answer: "na" });
    expect(insp?.responses[2]).toMatchObject({ aiAnswer: null, answer: null, aiQuote: null });

    // The reviewer overrides 1.1 and answers 1.3; these are what print.
    const [r1, , r3] = insp!.responses;
    await saveInspection(
      inspId,
      {
        inspectionDate: "2026-10-08",
        inspector: " A. Inspector ",
        area: "Level 2",
        answers: { [r1.id]: { answer: "no", remark: "Filters missing on AHU-3" }, [r3.id]: { answer: "yes", remark: "  " }, bogus: { answer: "yes", remark: null } },
      },
      "user_solo",
    );
    insp = await getInspection(inspId);
    expect(insp?.reviewedAt).toBeTruthy();
    expect(insp?.reviewedByName).toBeTruthy();
    expect(insp?.inspector).toBe("A. Inspector");
    expect(insp?.responses[0]).toMatchObject({ aiAnswer: "yes", answer: "no", remark: "Filters missing on AHU-3" });
    expect(insp?.responses[2]).toMatchObject({ answer: "yes", remark: null });

    // A late AI draft after the save records its suggestion but never changes an answer.
    await applyAiDraft(inspId, { state: "done", sources: [], byItemNo: { "1.1": { answer: "yes", quote: "q" }, "1.3": { answer: "na", quote: "q" } } });
    insp = await getInspection(inspId);
    expect(insp?.responses[0].answer).toBe("no");
    expect(insp?.responses[2].answer).toBe("yes");

    // Editing the form afterwards does not rewrite this inspection.
    const form = await getForm(t!.id);
    await db.update(checklistItems).set({ text: "Edited later" }).where(eq(checklistItems.id, form[0].items[1].id));
    insp = await getInspection(inspId);
    expect(insp?.responses[0].itemText).toBe("Filters at return air openings");

    const list = await listInspections(t!.id);
    expect(list.map((l) => l.id)).toContain(inspId);
  });

  it("edits the project's copy: text, switch off, reorder, add — and refuses rows of another form", async () => {
    const t = (await ensureProjectTemplate(pcId, "Indoor Air Quality"))!;
    let form = await getForm(t.id);
    const hvac = form[0];
    const second = hvac.items[2]; // currently numbered 1.2 (first item was switched off above)

    expect(await editItem(t.id, second.id, "save", "  Seal  diffusers  ")).toBe(true);
    expect(await editItem(t.id, second.id, "up")).toBe(true);
    form = await getForm(t.id);
    expect(form[0].items[1]).toMatchObject({ id: second.id, text: "Seal diffusers" });

    expect(await addItem(t.id, hvac.id, "Check MERV ratings")).toBe(true);
    expect(await addSection(t.id, "Site-specific")).toBe(true);
    expect(await editSection(t.id, hvac.id, "rename", "HVAC protection")).toBe(true);
    expect(await editSection(t.id, hvac.id, "down")).toBe(true);
    expect(await editFormText(t.id, "IAQ Inspection — Tower A", "Confirmed.")).toBe(true);
    form = await getForm(t.id);
    expect(form.map((s) => s.heading).slice(0, 2)).toEqual(["Source Control", "HVAC protection"]);
    expect(form[1].no).toBe("2");
    expect(form[1].items[form[1].items.length - 1]).toMatchObject({ text: "Check MERV ratings", active: true });
    expect(form[form.length - 1]).toMatchObject({ heading: "Site-specific", items: [] });

    // Rows of the workspace default are not this project's: refused, untouched.
    const def = await defaultTemplateFor("Indoor Air Quality");
    const defItem = (await getForm(def!.id))[0].items[0];
    expect(await editItem(t.id, defItem.id, "toggle")).toBe(false);
    expect(await editItem(t.id, defItem.id, "save", "hijacked")).toBe(false);
    expect(await addItem(t.id, (await getForm(def!.id))[0].id, "x")).toBe(false);
    expect((await getForm(def!.id))[0].items[0]).toMatchObject({ active: true, text: "Filters at supply air intake" });

    // Empty text is refused; moving the first row up is a no-op.
    expect(await editItem(t.id, second.id, "save", "   ")).toBe(false);
    expect(await addSection(t.id, "  ")).toBe(false);
    const before = await getForm(t.id);
    await editSection(t.id, before[0].id, "up");
    expect((await getForm(t.id)).map((s) => s.id)).toEqual(before.map((s) => s.id));
  });

  it("seeds the ESC form for Construction Environmental Management, laid out as the team's form", async () => {
    const esc = await defaultTemplateFor("construction environmental management");
    expect(esc).toMatchObject({
      title: "Erosion & Sedimentation Control Inspection and Corrective Action Log",
      confirmation: "",
      planDocument: "CEMP developed",
      sheetDocument: "Site audit report",
      naColumn: true,
      remarksLabel: "Notes/Comments/Non-Conformances",
      headerFields: ["ref_no", "date", "time", "inspector"],
      signatories: ["Sustainability Manager", "Environmental Manager"],
    });
    const form = await getForm(esc!.id);
    expect(form.map((s) => [s.heading, s.items.length])).toEqual([
      ["Dust control and soil erosion by wind", 6],
      ["Stormwater control measures", 11],
      ["Dewatering water", 4],
      ["Housekeeping", 7],
    ]);
    const items = form.flatMap((s) => s.items);
    const by = (t: string) => items.find((i) => i.text.startsWith(t))!;
    expect(by("Are soil stockpiles adequately covered").compliantAnswer).toBe("yes");
    expect(by("Is there any spill or leak at site").compliantAnswer).toBe("no");
    expect(by("Is there any damage in perimeter fencing").compliantAnswer).toBe("no");
    expect(by("Is there any incidence of rain").compliantAnswer).toBeNull();
    expect(items.filter((i) => i.compliantAnswer === "no")).toHaveLength(5);
    // IAQ keeps its own layout.
    const iaq = await defaultTemplateFor("Indoor Air Quality");
    expect(iaq).toMatchObject({ naColumn: false, remarksLabel: "Remarks", headerFields: ["date", "inspector", "area"], signatories: [] });
  });

  it("a project's copy keeps the layout and each item's compliant answer; an inspection snapshots it", async () => {
    const t = (await ensureProjectTemplate(otherPcId, "Outdoor Water Performance"))!;
    expect(t).toBeNull(); // W-02 has no form
    const escPc = randomUUID();
    const escCredit = randomUUID();
    await db.insert(catalogCredits).values({ id: escCredit, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "SS-03", title: "Construction Environmental Management", categoryCode: "SS", categoryName: "Site" });
    await db.insert(projectCredits).values({ id: escPc, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: escCredit });
    const copy = (await ensureProjectTemplate(escPc, "Construction Environmental Management"))!;
    expect(copy).toMatchObject({ naColumn: true, signatories: ["Sustainability Manager", "Environmental Manager"] });
    const spill = (await getForm(copy.id)).flatMap((s) => s.items).find((i) => i.text.startsWith("Is there any spill"))!;
    expect(spill.compliantAnswer).toBe("no");
    expect(await editItem(copy.id, spill.id, "compliance", undefined, "")).toBe(true);
    expect((await getForm(copy.id)).flatMap((s) => s.items).find((i) => i.id === spill.id)!.compliantAnswer).toBeNull();
    const inspId = await startInspection(copy.id);
    const insp = (await getInspection(inspId))!;
    expect(insp.responses.find((r) => r.itemText.startsWith("Are soil stockpiles"))!.compliantAnswer).toBe("yes");
    expect(insp.responses.find((r) => r.itemText.startsWith("Is there any spill"))!.compliantAnswer).toBeNull();
    await saveInspection(inspId, { inspectionDate: "2026-05-30", inspector: "Waqar Ahmed", area: null, inspectionTime: "09:00", refNo: "MBL-JCD-ESC-001", answers: {} }, "user_solo");
    expect(await getInspection(inspId)).toMatchObject({ refNo: "MBL-JCD-ESC-001", inspectionTime: "09:00" });
    await db.delete(checklistInspections).where(eq(checklistInspections.id, inspId));
    await db.delete(checklistTemplates).where(eq(checklistTemplates.id, copy.id));
    await db.delete(projectCredits).where(eq(projectCredits.id, escPc));
  });

  it("records why a draft was skipped", async () => {
    const t = await ensureProjectTemplate(pcId, "Indoor Air Quality");
    const inspId = await startInspection(t!.id);
    await applyAiDraft(inspId, { state: "skipped", reason: "no plan uploaded yet" });
    const insp = await getInspection(inspId);
    expect(insp?.aiState).toBe("skipped");
    expect(insp?.aiNote).toBe("no plan uploaded yet");
    expect(insp?.responses.every((r) => r.answer === null)).toBe(true);
  });
});
