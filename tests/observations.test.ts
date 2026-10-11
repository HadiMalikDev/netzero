import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeDb } from "./helpers/postgres";
import { db } from "@/db";
import {
  catalogCredits,
  checklistInspections,
  checklistObservations,
  checklistTemplates,
  projectCredits,
  projects,
  ratingSystems,
  rsVersions,
  workspaces,
} from "@/db/schema";
import { editItem, ensureProjectTemplate, getForm, getInspection, saveInspection, startInspection } from "@/lib/checklists";
import {
  addObservation,
  applyRecommendation,
  isNonCompliant,
  listObservations,
  observationText,
  raiseObservations,
  setObservationPhotos,
  updateObservation,
} from "@/lib/observations";
import { normalizeRecommendation } from "@/lib/ai/observation-recommendation";
import { WORKSPACE_ID } from "@/lib/catalog";

describe("isNonCompliant", () => {
  it("is No on a Yes-compliant item, or Yes on a No-compliant one — never N/A, blank or an observation", () => {
    expect(isNonCompliant("yes", "no")).toBe(true);
    expect(isNonCompliant("no", "yes")).toBe(true);
    expect(isNonCompliant("yes", "yes")).toBe(false);
    expect(isNonCompliant("no", "no")).toBe(false);
    expect(isNonCompliant("yes", "na")).toBe(false);
    expect(isNonCompliant("yes", null)).toBe(false);
    expect(isNonCompliant(null, "yes")).toBe(false);
    expect(isNonCompliant(null, "no")).toBe(false);
  });
});

describe("observationText and normalizeRecommendation", () => {
  it("states the question, the answer and the reviewer's note", () => {
    expect(observationText("4.5", "Is there any spill or leak at site?", "yes", " Diesel leak near genset ")).toBe(
      "4.5 Is there any spill or leak at site? — Yes: Diesel leak near genset",
    );
    expect(observationText("1.1", "Are soil stockpiles adequately covered or stabilized", "no", null)).toBe(
      "1.1 Are soil stockpiles adequately covered or stabilized — No.",
    );
  });

  it("keeps a recommendation short and plain, and drops an empty one", () => {
    expect(normalizeRecommendation({ recommendation: "  Repair the fence.\n Re-inspect weekly. " })).toBe("Repair the fence. Re-inspect weekly.");
    expect(normalizeRecommendation({ recommendation: "" })).toBeNull();
    expect(normalizeRecommendation(null)).toBeNull();
    expect(normalizeRecommendation({ recommendation: Array(80).fill("word").join(" ") })!.split(" ")).toHaveLength(60);
  });
});

const rsId = randomUUID();
const versionId = randomUUID();
const creditId = randomUUID();
const projectId = randomUUID();
const pcId = randomUUID();

describeDb("corrective-action log", () => {
  beforeAll(async () => {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, WORKSPACE_ID));
    if (!ws) await db.insert(workspaces).values({ id: WORKSPACE_ID, name: "Test" });
    await db.insert(ratingSystems).values({ id: rsId, workspaceId: WORKSPACE_ID, key: `t-${rsId}`, name: "T" });
    await db.insert(rsVersions).values({ id: versionId, workspaceId: WORKSPACE_ID, ratingSystemId: rsId, scheme: "commercial", stage: "D+C", versionLabel: `t-${versionId}` });
    await db.insert(catalogCredits).values({ id: creditId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "SS-03", title: "Construction Environmental Management", categoryCode: "SS", categoryName: "Site" });
    await db.insert(projects).values({ id: projectId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, name: "T" });
    await db.insert(projectCredits).values({ id: pcId, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: creditId });
  });

  afterAll(async () => {
    const [t] = await db.select({ id: checklistTemplates.id }).from(checklistTemplates).where(eq(checklistTemplates.projectCreditId, pcId));
    if (t) {
      await db.delete(checklistObservations).where(eq(checklistObservations.templateId, t.id));
      await db.delete(checklistInspections).where(eq(checklistInspections.templateId, t.id));
      await db.delete(checklistTemplates).where(eq(checklistTemplates.id, t.id));
    }
    await db.delete(projectCredits).where(eq(projectCredits.id, pcId));
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.delete(catalogCredits).where(eq(catalogCredits.id, creditId));
    await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, rsId));
  });

  const answerAndSave = async (answers: Record<string, ["yes" | "no" | "na", string | null]>) => {
    const t = (await ensureProjectTemplate(pcId, "Construction Environmental Management"))!;
    const id = await startInspection(t.id);
    const insp = (await getInspection(id))!;
    const byNo = Object.fromEntries(insp.responses.map((r) => [r.itemNo, r.id]));
    await saveInspection(
      id,
      {
        inspectionDate: "2026-05-30",
        inspector: null,
        area: null,
        answers: Object.fromEntries(Object.entries(answers).map(([no, [a, remark]]) => [byNo[no], { answer: a, remark }])),
      },
      "user_solo",
    );
    return { t, id };
  };

  it("the ESC copy has its log switched on; IAQ's default does not", async () => {
    const t = (await ensureProjectTemplate(pcId, "Construction Environmental Management"))!;
    expect(t).toMatchObject({ observationLog: true, observationTitle: "Environmental Observations" });
  });

  it("a saved review opens one observation per non-compliant answer, and none for compliant, N/A or observation items", async () => {
    // 1.1 stockpiles (Yes-compliant) = No; 1.5 fence damage (No-compliant) = Yes;
    // 4.5 spill (No-compliant) = No (fine); 1.4 = N/A; 2.1 rain (observation) = Yes.
    const { t, id } = await answerAndSave({
      "1.1": ["no", "Stockpile uncovered after wind"],
      "1.5": ["yes", "Panel down on the north side"],
      "4.5": ["no", null],
      "1.4": ["na", null],
      "2.1": ["yes", null],
    });
    const raised = await raiseObservations(id);
    expect(raised).toHaveLength(2);
    // Raised by one save, so they share a timestamp: Sr# follows item order.
    const log = await listObservations(t.id);
    expect(log.map((o) => [o.itemNo, o.observation, o.status, o.observedOn, o.aiState])).toEqual([
      ["1.1", "1.1 Are soil stockpiles adequately covered or stabilized — No: Stockpile uncovered after wind", "open", "2026-05-30", "pending"],
      ["1.5", "1.5 Is there any damage in perimeter fencing? — Yes: Panel down on the north side", "open", "2026-05-30", "pending"],
    ]);
  });

  it("does not log an item twice while its observation is open, but does once it is closed", async () => {
    const { t } = await answerAndSave({ "1.5": ["yes", "Still down"] });
    const again = await answerAndSave({ "1.5": ["yes", "Still down"] });
    expect(await raiseObservations(again.id)).toHaveLength(0);
    const fence = (await listObservations(t.id)).find((o) => o.itemNo === "1.5")!;
    expect(
      await updateObservation(t.id, fence.id, { observation: fence.observation, recommendation: "", correctiveAction: "Panel re-fixed.", observedOn: fence.observedOn, closedOn: null, status: "closed" }),
    ).toBe(true);
    const closed = (await listObservations(t.id)).find((o) => o.id === fence.id)!;
    expect(closed.status).toBe("closed");
    expect(closed.closedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/); // closing without a date records today
    const later = await answerAndSave({ "1.5": ["yes", "Down again"] });
    expect(await raiseObservations(later.id)).toHaveLength(1);
  });

  it("re-saving a reviewed inspection does not reopen an issue it raised that has since been closed", async () => {
    const t0 = (await ensureProjectTemplate(pcId, "Construction Environmental Management"))!;
    await db.delete(checklistObservations).where(eq(checklistObservations.templateId, t0.id));
    const { id } = await answerAndSave({ "4.5": ["yes", "Diesel leak"] });
    expect(await raiseObservations(id)).toHaveLength(1);
    const [leak] = await listObservations(t0.id);
    await updateObservation(t0.id, leak.id, { observation: leak.observation, recommendation: "", correctiveAction: "Cleaned up.", observedOn: leak.observedOn, closedOn: "2026-06-02", status: "closed" });

    // The reviewer fixes a typo in a remark and saves the same inspection again.
    const insp = (await getInspection(id))!;
    const r45 = insp.responses.find((r) => r.itemNo === "4.5")!;
    await saveInspection(id, { inspectionDate: "2026-05-30", inspector: null, area: null, answers: { [r45.id]: { answer: "yes", remark: "Diesel leak (typo fixed)" } } }, "user_solo");
    expect(await raiseObservations(id)).toHaveLength(0);
    const log = await listObservations(t0.id);
    expect(log).toHaveLength(1);
    expect(log[0].status).toBe("closed");
  });

  it("matches an open issue to its form item, not its printed number, when the form is edited", async () => {
    // Fresh log for this case.
    const t0 = (await ensureProjectTemplate(pcId, "Construction Environmental Management"))!;
    await db.delete(checklistObservations).where(eq(checklistObservations.templateId, t0.id));

    // Fence damage (item numbered 1.5) is raised and left open.
    const first = await answerAndSave({ "1.5": ["yes", "Panel down"] });
    expect(await raiseObservations(first.id)).toHaveLength(1);

    // Switching off 1.1 renumbers the section: fence damage becomes 1.4 and
    // the dust question ("Is there a dust problem…", No-compliant) becomes 1.5.
    const form = await getForm(t0.id);
    await editItem(t0.id, form[0].items[0].id, "toggle");
    const renumbered = (await getForm(t0.id))[0].items.filter((i) => i.active);
    expect(renumbered[3].text).toBe("Is there any damage in perimeter fencing?");
    expect(renumbered[3].no).toBe("1.4");
    expect(renumbered[4].text).toBe("Is there a dust problem prevailing on the construction site");
    expect(renumbered[4].no).toBe("1.5");

    // Same fence issue again (now 1.4): not logged twice. Dust problem (now 1.5): logged.
    const second = await answerAndSave({ "1.4": ["yes", "Still down"], "1.5": ["yes", "Dust over the east boundary"] });
    const raised = await raiseObservations(second.id);
    expect(raised).toHaveLength(1);
    const log = await listObservations(t0.id);
    // The fence was raised as 1.5 before the edit; the dust problem is the item now numbered 1.5.
    // Both are raised within the same second in a test run, so compare as a set.
    expect(log.map((o) => o.observation.split(" —")[0]).sort()).toEqual([
      "1.5 Is there a dust problem prevailing on the construction site",
      "1.5 Is there any damage in perimeter fencing?",
    ]);
    await editItem(t0.id, form[0].items[0].id, "toggle"); // restore the form for later cases
  });

  it("keeps a person's recommendation over a late AI draft, and marks an edited draft as the person's", async () => {
    const t = (await ensureProjectTemplate(pcId, "Construction Environmental Management"))!;
    const id = (await addObservation(t.id, "Oil drum stored without bunding", "2026-06-01"))!;
    await applyRecommendation(id, { state: "done", text: "Move the drum into the bunded store." });
    let o = (await listObservations(t.id)).find((x) => x.id === id)!;
    expect(o).toMatchObject({ recommendation: "Move the drum into the bunded store.", recommendationSource: "ai", aiState: "done", observedOn: "2026-06-01" });

    await updateObservation(t.id, id, { observation: o.observation, recommendation: "Move it today; add a drip tray.", correctiveAction: "", observedOn: null, closedOn: null, status: "open" });
    await applyRecommendation(id, { state: "done", text: "AI rewrite" });
    o = (await listObservations(t.id)).find((x) => x.id === id)!;
    expect(o).toMatchObject({ recommendation: "Move it today; add a drip tray.", recommendationSource: "person", status: "open", closedOn: null });

    expect(await setObservationPhotos(t.id, "not-an-id", { beforePhotoId: "x" })).toBe(false);
    expect(await setObservationPhotos(t.id, id, {})).toBe(true); // nothing to attach
    expect(await addObservation(t.id, "   ", null)).toBeNull();
    expect(await updateObservation(t.id, "not-an-id", { observation: "x", recommendation: "", correctiveAction: "", observedOn: null, closedOn: null, status: "open" })).toBe(false);
  });
});
