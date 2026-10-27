import { describe, expect, it } from "vitest";
import { buildMaterialTracker, TRACKER_COLUMNS } from "@/lib/export/material-tracker";
import { computePart } from "@/lib/materials/credits";
import { partByKey } from "@/lib/materials/parts";
import type { MaterialAnswer, MaterialSubmittal } from "@/db/schema";
import type { ProductSummary } from "@/lib/materials/products";

const submittal = { id: "s1", workspaceId: "ws", projectId: "p", ref: "TBE-0001", title: "Epoxy coated rebars", discipline: "Civil", supplier: null, submittedOn: "2026-03-15", createdAt: 0 } as MaterialSubmittal;
const product = {
  id: "r0", workspaceId: "ws", submittalId: "s1", revision: 0, previousRevisionId: null, name: "Rebar ITTIFAQ", locationOfUse: null, interior: true,
  manufacturer: "ITTIFAQ", supplier: null, countryOfOrigin: "Saudi Arabia", contactName: null, contactMobile: null, status: "A", reviewedOn: "2026-05-05",
  reviewer: "W", applicable: true, remarks: null, manufacturerSignatory: null, manufacturerSignedOn: null, contractorSignatory: null, contractorSignedOn: null,
  boqWeightT: 600, boqVolumeM3: null, boqCostSar: 1_920_000, createdAt: 0, updatedAt: 0, latest: true,
} as ProductSummary;
const answer = (over: Partial<MaterialAnswer>) =>
  ({ id: "a", productId: "r0", rowId: null, sectionId: "x", sectionHeading: "All metals", sectionKind: "material_type", sectionSeq: 1, seq: 1, text: "Recycled content", leedRef: null, creditCode: "MW-05", projectCreditId: "pc", kind: "fixed", note: null, targetText: null, answer: "yes", value: "85", unit: "%", remark: null, ...over }) as MaterialAnswer;

describe("buildMaterialTracker", () => {
  it("opens with the client's twelve tracker columns, then the Mostadam ones, one row per revision", () => {
    const parts = [computePart(partByKey("MW-05:steel")!, {
      expiryYears: 3,
      boqMaterialCostSar: null,
      products: [{ key: "r0", name: "Rebar ITTIFAQ", submittalRef: "TBE-0001", deliveries: [], revisions: [{ id: "r0", revision: 0, status: "A", reviewedOn: "2026-05-05", createdOn: "2026-03-15", interior: true, parts: ["MW-05:steel"], boq: { weightT: 600, volumeM3: null, costSar: null }, answers: [{ creditCode: "MW-05", linked: true, answer: "yes", text: "Recycled content", docs: [] }] }] }],
    }, "2026-05")];
    const wb = buildMaterialTracker({
      projectName: "Oceanarium",
      ratingSystem: "Mostadam",
      month: "2026-05",
      generatedAt: new Date("2026-05-31T12:00:00Z"),
      products: [{ product, submittal }],
      answers: [answer({}), answer({ id: "b", seq: 2, text: "Purchase orders", value: null, unit: null })],
      docs: [{ answerId: "a", fileName: "datasheet.pdf", issuedOn: "2025-11-02" }],
      deliveries: [{ id: "d", productId: "r0", deliveredOn: "2026-06-30", poNumber: "2403879", weightT: 250, volumeM3: null, costSar: 800_000, createdAt: 0 }],
      parts,
    });
    const ws = wb.getWorksheet("Tracker")!;
    const header = (ws.getRow(6).values as unknown[]).slice(1, 13);
    expect(header).toEqual([...TRACKER_COLUMNS]);
    const row = ws.getRow(7).values as unknown[];
    expect(row.slice(1, 13)).toEqual([1, "TBE-0001", "Rev 00", "A - Approved", "Epoxy coated rebars: Rebar ITTIFAQ", "2026-03-15", "Applicable", "Civil", "", "2026-06-30", "2403879", "ITTIFAQ"]);
    const headers = ws.getRow(6).values as unknown[];
    expect(row[headers.indexOf("BOQ weight (t)")]).toBe(600);
    expect(row[headers.indexOf("Delivered weight (t)")]).toBe(250);
    expect(row[headers.indexOf("MW-05 Recycled steel")]).toBe("Counts");
    expect(row[headers.indexOf("MW-05 answers")]).toBe("Yes 85 %; Yes");

    const answers = wb.getWorksheet("Answers")!;
    expect(answers.rowCount).toBe(3);
    expect((answers.getRow(2).values as unknown[])[14]).toBe("datasheet.pdf (2025-11-02)");
    expect((wb.getWorksheet("Credits")!.getRow(2).values as unknown[]).slice(1, 6)).toEqual(["MW-05", "Recycled steel", "weight", "50", 100]);
  });
});
