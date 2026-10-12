import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { describeDb } from "./helpers/postgres";

vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "user_solo" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { db } from "@/db";
import {
  catalogCredits,
  checklistInspections,
  checklistObservations,
  checklistTemplates,
  evidenceDocs,
  projectCredits,
  projects,
  ratingSystems,
  rsVersions,
  workspaces,
} from "@/db/schema";
import { ensureProjectTemplate, getInspection, linkItemPhoto, startInspection } from "@/lib/checklists";
import { addObservation, setObservationPhotos } from "@/lib/observations";
import { WORKSPACE_ID } from "@/lib/catalog";
import { removeItemPhotoAction, setItemPhotosAction } from "@/app/(app)/projects/inspection-actions";

// The row photo picker's server actions (2026-10-12): what they accept and
// what they leave alone.

const rsId = randomUUID();
const versionId = randomUUID();
const creditId = randomUUID();
const otherCreditId = randomUUID();
const projectId = randomUUID();
const pcId = randomUUID();
const otherPcId = randomUUID();

describeDb("item photo actions", () => {
  let inspectionId = "";
  let templateId = "";
  let r11 = "";
  let r12 = "";
  const site = randomUUID(); // a credit photo: offered
  const foreign = randomUUID(); // another credit's photo: never offered
  const before = randomUUID(); // an observation's before photo: never offered
  const pdf = randomUUID(); // not a photo, so the picker never shows it

  beforeAll(async () => {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, WORKSPACE_ID));
    if (!ws) await db.insert(workspaces).values({ id: WORKSPACE_ID, name: "Test" });
    await db.insert(ratingSystems).values({ id: rsId, workspaceId: WORKSPACE_ID, key: `t-${rsId}`, name: "T" });
    await db.insert(rsVersions).values({ id: versionId, workspaceId: WORKSPACE_ID, ratingSystemId: rsId, scheme: "commercial", stage: "D+C", versionLabel: `t-${versionId}` });
    await db.insert(catalogCredits).values([
      { id: creditId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "SS-03", title: "Construction Environmental Management", categoryCode: "SS", categoryName: "Site" },
      { id: otherCreditId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, code: "HC-10", title: "Construction Indoor Air Quality", categoryCode: "HC", categoryName: "Health" },
    ]);
    await db.insert(projects).values({ id: projectId, workspaceId: WORKSPACE_ID, rsVersionId: versionId, name: "T" });
    await db.insert(projectCredits).values([
      { id: pcId, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: creditId },
      { id: otherPcId, workspaceId: WORKSPACE_ID, projectId, catalogCreditId: otherCreditId },
    ]);
    await db.insert(evidenceDocs).values([
      { id: site, workspaceId: WORKSPACE_ID, projectCreditId: pcId, fileName: "site.jpg", filePath: "/nowhere/site.jpg", fileSize: 1 },
      { id: before, workspaceId: WORKSPACE_ID, projectCreditId: pcId, fileName: "before.jpg", filePath: "/nowhere/before.jpg", fileSize: 1 },
      { id: pdf, workspaceId: WORKSPACE_ID, projectCreditId: pcId, fileName: "plan.pdf", filePath: "/nowhere/plan.pdf", fileSize: 1 },
      { id: foreign, workspaceId: WORKSPACE_ID, projectCreditId: otherPcId, fileName: "duct.jpg", filePath: "/nowhere/duct.jpg", fileSize: 1 },
    ]);
    const t = (await ensureProjectTemplate(pcId, "Construction Environmental Management"))!;
    templateId = t.id;
    const obs = (await addObservation(t.id, "Fence panel down", "2026-10-11"))!;
    await setObservationPhotos(t.id, obs, { beforePhotoId: before });
    inspectionId = await startInspection(t.id);
    const rows = (await getInspection(inspectionId))!.responses;
    r11 = rows.find((r) => r.itemNo === "1.1")!.id;
    r12 = rows.find((r) => r.itemNo === "1.2")!.id;
  });

  afterAll(async () => {
    await db.delete(checklistObservations).where(eq(checklistObservations.templateId, templateId));
    await db.delete(checklistInspections).where(eq(checklistInspections.templateId, templateId));
    await db.delete(checklistTemplates).where(eq(checklistTemplates.id, templateId));
    for (const pc of [pcId, otherPcId]) await db.delete(evidenceDocs).where(eq(evidenceDocs.projectCreditId, pc));
    for (const pc of [pcId, otherPcId]) await db.delete(projectCredits).where(eq(projectCredits.id, pc));
    await db.delete(projects).where(eq(projects.id, projectId));
    for (const c of [creditId, otherCreditId]) await db.delete(catalogCredits).where(eq(catalogCredits.id, c));
    await db.delete(rsVersions).where(eq(rsVersions.id, versionId));
    await db.delete(ratingSystems).where(eq(ratingSystems.id, rsId));
  });

  const form = (responseId: string, docIds: string[], extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("code", "SS-03");
    fd.set("inspectionId", inspectionId);
    fd.set("responseId", responseId);
    for (const id of docIds) fd.append("docId", id);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return fd;
  };
  const photoIds = async (responseId: string) =>
    (await getInspection(inspectionId))!.responses.find((r) => r.id === responseId)!.photos.map((p) => p.id).sort();

  it("attaches only photos the picker offers: not another credit's, not an observation's before / after", async () => {
    expect(await setItemPhotosAction(form(r11, [foreign]))).toEqual({ ok: false, error: "That photo is not on this credit" });
    expect(await setItemPhotosAction(form(r11, [site, before]))).toEqual({ ok: false, error: "That photo is not on this credit" });
    expect(await photoIds(r11)).toEqual([]);

    expect(await setItemPhotosAction(form(r11, [site]))).toEqual({ ok: true });
    expect(await setItemPhotosAction(form(r12, [site]))).toEqual({ ok: true });
    expect(await photoIds(r11)).toEqual([site]);
    expect(await photoIds(r12)).toEqual([site]);
  });

  it("refuses an item from another project's inspection", async () => {
    expect(await setItemPhotosAction(form(r11, [site], { projectId: randomUUID() }))).toEqual({ ok: false, error: "Item not found" });
    expect(await setItemPhotosAction(form("not-a-row", [site]))).toEqual({ ok: false, error: "Item not found" });
    expect(await removeItemPhotoAction(form(r11, [], { docId: site, projectId: randomUUID() }))).toEqual({ ok: false, error: "Item not found" });
  });

  it("keeps a linked file the picker did not show when the selection is saved", async () => {
    await linkItemPhoto(r12, pdf);
    expect(await setItemPhotosAction(form(r12, []))).toEqual({ ok: true });
    expect(await photoIds(r12)).toEqual([pdf]);
  });

  it("× takes the photo off one item only; the file stays on the credit", async () => {
    await setItemPhotosAction(form(r12, [site]));
    expect(await removeItemPhotoAction(form(r11, [], { docId: site }))).toEqual({ ok: true });
    expect(await removeItemPhotoAction(form(r11, [], { docId: site }))).toEqual({ ok: false, error: "Photo not found on this item" });
    expect(await photoIds(r11)).toEqual([]);
    expect(await photoIds(r12)).toContain(site);
    expect(await db.select({ id: evidenceDocs.id }).from(evidenceDocs).where(eq(evidenceDocs.id, site))).toHaveLength(1);
  });
});
