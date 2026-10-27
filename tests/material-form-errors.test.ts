import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { describeDb } from "./helpers/postgres";
import { materialFixture } from "./helpers/material-fixture";

vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "user_solo" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
// A saved form redirects; the test only needs to know it got that far.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import { getProductRow, newRevision, saveReview } from "@/lib/materials/products";
import {
  addDeliveryAction,
  addProductAction,
  addSmqSectionAction,
  createSubmittalAction,
  saveBoqQuantitiesAction,
  saveReviewAction,
  saveSmqSettingsAction,
} from "@/app/(app)/projects/material-actions";

// QA finding 1: a refused save returns why, so the form can say so in place,
// instead of throwing to an error page.

const fx = materialFixture();
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ projectId: fx.projectId, ...fields })) fd.set(k, v);
  return fd;
};
const review = { status: "", reviewedOn: "", reviewer: "", applicable: "", remarks: "", manufacturerSignatory: "", manufacturerSignedOn: "", contractorSignatory: "", contractorSignedOn: "" };

describeDb("material forms: refused saves", () => {
  let productId = "";
  let submittalId = "";
  beforeAll(async () => {
    await fx.setup();
    submittalId = await fx.addSubmittal();
    productId = await fx.addProduct(submittalId);
  });
  afterAll(() => fx.teardown());

  it("questionnaire settings and material types", async () => {
    expect(await saveSmqSettingsAction(form({ title: "SMQ", expiryYears: "3", boqMaterialCostSar: "abc" }))).toBe("smq_boq");
    expect(await saveSmqSettingsAction(form({ title: "SMQ", expiryYears: "3", boqMaterialCostSar: "0" }))).toBe("smq_boq");
    expect(await saveSmqSettingsAction(form({ title: "   ", expiryYears: "3", boqMaterialCostSar: "" }))).toBe("smq_title");
    expect(await saveSmqSettingsAction(form({ title: "SMQ", expiryYears: "0", boqMaterialCostSar: "" }))).toBe("smq_expiry");
    await expect(saveSmqSettingsAction(form({ title: "SMQ", expiryYears: "3", boqMaterialCostSar: "12,500,000" }))).rejects.toThrow(/REDIRECT/);
    expect(await addSmqSectionAction(form({ heading: "  " }))).toBe("type_name");
  });

  it("submittals and products", async () => {
    expect(await createSubmittalAction(form({ ref: "  ", title: "Paints" }))).toBe("submittal_fields");
    expect(await addProductAction(form({ submittalId, name: " " }))).toBe("product_name");
  });

  it("review, quantities and deliveries, and an old revision", async () => {
    const p = { productId };
    expect(await saveReviewAction(form({ ...p, ...review, status: "C" }))).toBe("review_date");
    expect(await saveBoqQuantitiesAction(form({ ...p, weightT: "-5", volumeM3: "", costSar: "" }))).toBe("boq_qty");
    expect(await addDeliveryAction(form({ ...p, deliveredOn: "2026-05-01", poNumber: "PO-1", weightT: "", volumeM3: "", costSar: "" }))).toBe("delivery");
    expect((await getProductRow(fx.projectId, productId))!.status).toBeNull();

    expect(await saveReview(fx.projectId, productId, { ...review, status: "C", reviewedOn: "2026-05-05" })).toBe(true);
    expect(await newRevision(fx.projectId, productId)).toBeTruthy();
    expect(await saveReviewAction(form({ ...p, ...review, status: "A", reviewedOn: "2026-05-06" }))).toBe("frozen");
    expect((await getProductRow(fx.projectId, productId))!.status).toBe("C");
  });
});
