import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
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
import { WORKSPACE_ID } from "@/lib/catalog";
import { ensureProjectTemplate, saveInspection, startInspection } from "@/lib/checklists";
import { addObservation } from "@/lib/observations";
import { projectReportForms } from "@/lib/reports";

const rsId = randomUUID();
const versionId = randomUUID();
const iaq = randomUUID();
const esc = randomUUID();
const water = randomUUID();
const projectId = randomUUID();
const pcIaq = randomUUID();
const pcEsc = randomUUID();
const pcWater = randomUUID();

describeDb("Reports page: the project's report forms", () => {
  beforeAll(async () => {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, WORKSPACE_ID));
    if (!ws) await db.insert(workspaces).values({ id: WORKSPACE_ID, name: "Test" });
    await db.insert(ratingSystems).values({ id: rsId, workspaceId: WORKSPACE_ID, key: `t-${rsId}`, name: "T" });
    await db.insert(rsVersions).values({ id: versionId, workspaceId: WORKSPACE_ID, ratingSystemId: rsId, scheme: "commercial", stage: "D+C", versionLabel: `t-${versionId}` });
    await db.insert(catalogCredits).values([
      { id: iaq, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "HC-10", title: "Indoor Air Quality", categoryCode: "HC", categoryName: "H" },
      { id: esc, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "SS-03", title: "Construction Environmental Management", categoryCode: "SS", categoryName: "S" },
      { id: water, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "W-02", title: "Outdoor Water Performance", categoryCode: "W", categoryName: "W" },
    ]);
    await db.insert(projects).values({ id: projectId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, name: "T" });
    await db.insert(projectCredits).values([
      { id: pcIaq, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: iaq },
      { id: pcEsc, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: esc },
      { id: pcWater, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: water },
    ]);
  });

  afterAll(async () => {
    const tpl = await db.select({ id: checklistTemplates.id }).from(checklistTemplates).where(inArray(checklistTemplates.projectCreditId, [pcIaq, pcEsc]));
    const ids = tpl.map((t) => t.id);
    if (ids.length) {
      await db.delete(checklistObservations).where(inArray(checklistObservations.templateId, ids));
      await db.delete(checklistInspections).where(inArray(checklistInspections.templateId, ids));
      await db.delete(checklistTemplates).where(inArray(checklistTemplates.id, ids));
    }
    await db.delete(projectCredits).where(eq(projectCredits.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.delete(catalogCredits).where(eq(catalogCredits.rsVersionId, versionId));
    await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, rsId));
  });

  it("lists IAQ and ESC on the standard forms before any use, and no other credit — without copying anything", async () => {
    const forms = await projectReportForms(projectId);
    expect(forms.map((f) => [f.code, f.formTitle, f.ownCopy, f.observationLog, f.inspections.length])).toEqual([
      ["HC-10", "Construction Indoor Air Quality Inspection", false, false, 0],
      ["SS-03", "Erosion & Sedimentation Control Inspection and Corrective Action Log", false, true, 0],
    ]);
    const copies = await db.select().from(checklistTemplates).where(inArray(checklistTemplates.projectCreditId, [pcIaq, pcEsc]));
    expect(copies).toHaveLength(0);
  });

  it("shows every inspection newest first with its review state, and the open observations", async () => {
    const t = (await ensureProjectTemplate(pcEsc, "Construction Environmental Management"))!;
    const first = await startInspection(t.id);
    await saveInspection(first, { inspectionDate: "2026-10-01", inspector: "A. Inspector", area: null, answers: {} }, "user_solo");
    await db.update(checklistInspections).set({ createdAt: 1 }).where(eq(checklistInspections.id, first));
    const second = await startInspection(t.id);
    await addObservation(t.id, "Waste skip full", "2026-10-02");
    const o2 = await addObservation(t.id, "Fence panel down", "2026-10-02");
    await db.update(checklistObservations).set({ status: "closed" }).where(eq(checklistObservations.id, o2!));

    const esc = (await projectReportForms(projectId)).find((f) => f.code === "SS-03")!;
    expect(esc.ownCopy).toBe(true);
    expect(esc.inspections.map((i) => i.id)).toEqual([second, first]);
    expect(esc.inspections[1]).toMatchObject({ inspectionDate: "2026-10-01", inspector: "A. Inspector" });
    expect(esc.inspections[1].reviewedAt).toBeTruthy();
    expect(esc.inspections[0].reviewedAt).toBeNull();
    expect(esc.openObservations).toBe(1);
    const iaqForm = (await projectReportForms(projectId)).find((f) => f.code === "HC-10")!;
    expect(iaqForm).toMatchObject({ ownCopy: false, inspections: [] });
  });
});
